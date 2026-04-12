// corlens/apps/server/src/analysis/historyOrchestrator.ts
import type { XRPLClientWrapper } from "../xrpl/client.js";
import { fetchAccountTransactions, fetchAMMInfo } from "../xrpl/fetchers.js";
import { crawlFromSeedLight } from "./historyCrawler.js";
import { classifyCounterparties } from "./counterpartyClassifier.js";
import type {
  HistoryEvent,
  HistoryNode,
  HistoryEdge,
  HeavyKind,
} from "./historyTypes.js";
import { logger } from "../logger.js";

interface Opts {
  depth: number;
  maxTx: number;
  sinceDays: number;
  maxCrawls?: number;
  concurrency?: number;
  crawlTimeoutMs?: number;
  signal?: AbortSignal;
}

// Per-crawl hard timeout so a single slow XRPL RPC call cannot block the
// entire BFS pool forever. Exceeded crawls become crawl_errors and the pool
// moves on. The history BFS uses the lightweight crawl (historyCrawler.ts)
// which only runs 5 parallel RPCs, so 20s is generous — crawls that exceed
// this are genuinely stuck on a slow node rather than pushing through
// legitimate work.
const DEFAULT_CRAWL_TIMEOUT_MS = 20_000;

interface QueuedCrawl {
  address: string;
  kind: HeavyKind;
  depth: number;
  txCount: number;
}

export async function* streamHistory(
  client: XRPLClientWrapper,
  seed: string,
  opts: Opts,
): AsyncGenerator<HistoryEvent> {
  const startedAt = Date.now();
  const maxCrawls = opts.maxCrawls ?? 60;
  const concurrency = opts.concurrency ?? 4;
  const crawlTimeoutMs = opts.crawlTimeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
  const signal = opts.signal;

  const nodes = new Map<string, HistoryNode>();
  const edges = new Map<string, HistoryEdge>();
  const visited = new Set<string>();
  let crawlsRun = 0;
  let truncated = false;

  const putNode = (n: HistoryNode) => {
    const prev = nodes.get(n.id);
    if (!prev) nodes.set(n.id, n);
    else nodes.set(n.id, { ...prev, ...n });
  };
  const putEdge = (e: HistoryEdge) => {
    const prev = edges.get(e.id);
    if (!prev) edges.set(e.id, e);
    else edges.set(e.id, { ...prev, count: prev.count + e.count });
  };
  const aborted = () => signal?.aborted === true;

  // ─── Step 1: seed tx fetch ─────────────────────────────────────────────
  let seedTxs: any[] = [];
  try {
    seedTxs = await fetchAccountTransactions(client, seed, {
      limit: opts.maxTx,
      sinceUnixTime: Math.floor(Date.now() / 1000) - opts.sinceDays * 86400,
      apiVersion: 2,
    });
  } catch (err: any) {
    yield { type: "fatal_error", error: err?.message ?? "account_tx failed" };
    return;
  }
  if (aborted()) return;

  const classification = classifyCounterparties(seed, seedTxs);

  // Seed node
  const seedNode: HistoryNode = {
    id: seed,
    kind: "seed",
    address: seed,
    depth: 0,
    txCount: seedTxs.length,
    crawlStatus: "skipped",
  };
  putNode(seedNode);
  visited.add(seed);

  // Light nodes from classification
  const lightNodes: HistoryNode[] = [];
  for (const [addr, entry] of classification.light) {
    const n: HistoryNode = {
      id: addr,
      kind: "account_light",
      address: addr,
      depth: 1,
      txCount: entry.txCount,
      crawlStatus: "skipped",
    };
    putNode(n);
    lightNodes.push(n);
  }

  // Heavy queue from direct heavy matches
  const queue: QueuedCrawl[] = [];
  for (const [addr, entry] of classification.heavy) {
    queue.push({ address: addr, kind: entry.kind, depth: 1, txCount: entry.txCount });
  }

  // Resolve pending AMM pairs to AMM account addresses
  for (const pair of classification.pendingAmmPairs) {
    if (aborted()) return;
    try {
      const resp: any = await fetchAMMInfo(client, pair.asset1, pair.asset2);
      const ammAcct: string | undefined =
        resp?.result?.amm?.account ?? resp?.amm?.account;
      if (ammAcct) {
        queue.push({ address: ammAcct, kind: "amm", depth: 1, txCount: pair.txCount });
      }
    } catch (err: any) {
      logger.warn("[history] amm_info resolve failed", { error: err?.message });
    }
  }

  // Create pending placeholders for heavy nodes
  const heavyPlaceholders: HistoryNode[] = [];
  for (const q of queue) {
    const n: HistoryNode = {
      id: q.address,
      kind: q.kind,
      address: q.address,
      depth: q.depth,
      txCount: q.txCount,
      crawlStatus: "pending",
    };
    putNode(n);
    heavyPlaceholders.push(n);
  }

  // Push classification edges
  for (const e of classification.edges) putEdge(e);

  yield {
    type: "seed_ready",
    seed: seedNode,
    lightNodes,
    heavyQueue: heavyPlaceholders,
    edges: classification.edges,
    txTypeSummary: classification.txTypeSummary,
  };

  // Mark all initial queue items as visited
  for (const q of queue) visited.add(q.address);

  // ─── Step 2: BFS with concurrency pool ─────────────────────────────────
  const pending: Array<{ task: QueuedCrawl; promise: Promise<HistoryEvent[]> }> = [];
  let dispatched = 0;

  const runCrawl = async (task: QueuedCrawl): Promise<HistoryEvent[]> => {
    const out: HistoryEvent[] = [];
    try {
      // Wrap the crawl in a timeout race so a slow XRPL node cannot stall
      // the orchestrator indefinitely. The losing promise is leaked but that
      // is acceptable — it will eventually resolve or reject in the
      // background and be garbage-collected.
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`crawl timeout after ${crawlTimeoutMs}ms`)),
          crawlTimeoutMs,
        );
      });
      const result: any = await Promise.race([
        crawlFromSeedLight(client, task.address),
        timeoutPromise,
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      });
      const node: HistoryNode = {
        id: task.address,
        kind: task.kind,
        address: task.address,
        depth: task.depth,
        txCount: task.txCount,
        crawlStatus: "crawled",
        crawledAt: new Date().toISOString(),
        riskFlags: extractRiskFlags(result),
      };
      putNode(node);

      // Expand this crawled heavy into child nodes so the graph mirrors the
      // richness of the analyze page: top trustline holders, LP holders, and
      // order-book makers become terminal account_light children connected
      // with type-labelled edges.
      const expansion = expandCrawlResult(task.address, result, task.depth);
      const expansionNodes: HistoryNode[] = [];
      for (const child of expansion.nodes) {
        if (!nodes.has(child.id)) {
          putNode(child);
          expansionNodes.push(child);
        }
      }
      for (const e of expansion.edges) putEdge(e);
      // Stream expansion as a single bundle per crawl so the UI updates once.
      for (const child of expansionNodes) {
        out.push({ type: "node_added", node: child, edges: [] });
      }
      if (expansion.edges.length) {
        out.push({ type: "edges_added", edges: expansion.edges });
      }

      // Mine counterparties from this crawl's accountTransactions for next depth
      if (task.depth < opts.depth) {
        const sub = classifyCounterparties(task.address, result.accountTransactions ?? []);
        for (const [addr, entry] of sub.heavy) {
          if (!visited.has(addr)) {
            visited.add(addr);
            const placeholder: HistoryNode = {
              id: addr,
              kind: entry.kind,
              address: addr,
              depth: task.depth + 1,
              txCount: entry.txCount,
              crawlStatus: "pending",
            };
            putNode(placeholder);
            queue.push({
              address: addr,
              kind: entry.kind,
              depth: task.depth + 1,
              txCount: entry.txCount,
            });
            out.push({ type: "node_added", node: placeholder, edges: [] });
          }
        }
        // Sub-edges: re-target from task.address, not seed
        const subEdges: HistoryEdge[] = sub.edges.map((e) => ({
          ...e,
          from: task.address,
          id: `${task.address}->${e.to}:${e.txType}`,
        }));
        for (const e of subEdges) putEdge(e);
        if (subEdges.length) out.push({ type: "edges_added", edges: subEdges });
      }

      out.push({ type: "node_added", node, edges: [] });
    } catch (err: any) {
      const errNode: HistoryNode = {
        id: task.address,
        kind: task.kind,
        address: task.address,
        depth: task.depth,
        txCount: task.txCount,
        crawlStatus: "error",
      };
      putNode(errNode);
      out.push({ type: "crawl_error", address: task.address, error: err?.message ?? "crawl failed" });
      out.push({ type: "node_added", node: errNode, edges: [] });
    } finally {
      crawlsRun++;
    }
    return out;
  };

  while ((queue.length > 0 || pending.length > 0) && !aborted()) {
    // Fill pool up to concurrency, respecting the global cap
    while (
      pending.length < concurrency &&
      queue.length > 0 &&
      dispatched < maxCrawls
    ) {
      const task = queue.shift()!;
      dispatched++;
      pending.push({ task, promise: runCrawl(task) });
    }
    if (pending.length === 0) break;

    // If we've dispatched all we can and there's still work queued, drop it
    if (dispatched >= maxCrawls && queue.length > 0) {
      truncated = true;
      queue.length = 0;
    }

    // Wait for any one to finish
    const finishedIdx = await Promise.race(
      pending.map((p, i) => p.promise.then(() => i)),
    );
    const [finished] = pending.splice(finishedIdx, 1);
    const emitted = await finished.promise;
    for (const ev of emitted) yield ev;
  }

  // Drain remaining pending after abort / cap
  while (pending.length > 0) {
    const p = pending.shift()!;
    try {
      const emitted = await p.promise;
      for (const ev of emitted) yield ev;
    } catch {
      /* already handled inside runCrawl */
    }
  }

  yield {
    type: "done",
    stats: {
      nodes: nodes.size,
      edges: edges.size,
      crawlsRun,
      durationMs: Date.now() - startedAt,
      truncated,
    },
  };
}

function extractRiskFlags(result: any): string[] {
  if (Array.isArray(result?.riskFlags)) {
    return result.riskFlags.map((f: any) => f.code ?? f.flag ?? String(f));
  }
  return [];
}

// Expand a crawl result into rich child nodes so the history graph mirrors
// the density of the analyze page. For each crawled heavy we add:
//   - Top N trustline holders → account_light children with TRUSTS edges
//   - Top N LP holders (if the crawl found an AMM pool) → LP_HOLDS edges
//   - Top N order-book ask/bid makers → MAKES_OFFER edges
// Children are terminal (never enqueued for further crawling) so the graph
// stays bounded regardless of depth.
function expandCrawlResult(
  crawledAddress: string,
  result: any,
  parentDepth: number,
): { nodes: HistoryNode[]; edges: HistoryEdge[] } {
  const nodes: HistoryNode[] = [];
  const edges: HistoryEdge[] = [];
  const seen = new Set<string>([crawledAddress]);
  const CAP = 10;

  const pushChild = (
    peer: string,
    txType: string,
    count = 1,
  ) => {
    if (!peer || peer === crawledAddress) return;
    if (!seen.has(peer)) {
      seen.add(peer);
      nodes.push({
        id: peer,
        kind: "account_light",
        address: peer,
        depth: parentDepth,
        txCount: count,
        crawlStatus: "skipped",
        parentId: crawledAddress,
      });
    }
    const edgeId = `${crawledAddress}->${peer}:${txType}`;
    if (!edges.find((e) => e.id === edgeId)) {
      edges.push({
        id: edgeId,
        from: crawledAddress,
        to: peer,
        txType,
        count,
      });
    }
  };

  // Trust line holders — anyone with a non-zero balance against this account.
  const trustLines: any[] = Array.isArray(result?.trustLines) ? result.trustLines : [];
  const topTrust = [...trustLines]
    .sort((a, b) => Math.abs(Number(b.balance ?? 0)) - Math.abs(Number(a.balance ?? 0)))
    .slice(0, CAP);
  for (const line of topTrust) {
    const peer = line.account;
    const ccy = decodeCurrencyLike(line.currency);
    pushChild(peer, `Trusts ${ccy}`);
  }

  // LP holders — only present when the crawled account is itself an AMM.
  const lpHolders: any[] = Array.isArray(result?.lpHolders) ? result.lpHolders : [];
  const topLp = [...lpHolders]
    .sort((a, b) => Math.abs(Number(b.balance ?? 0)) - Math.abs(Number(a.balance ?? 0)))
    .slice(0, CAP);
  for (const holder of topLp) {
    pushChild(holder.account, "LP holder");
  }

  // Order book — take the accounts posting the top asks and bids.
  const asks: any[] = Array.isArray(result?.asks) ? result.asks : [];
  const bids: any[] = Array.isArray(result?.bids) ? result.bids : [];
  for (const offer of asks.slice(0, 5)) {
    pushChild(offer.Account, "Offer (ask)");
  }
  for (const offer of bids.slice(0, 5)) {
    pushChild(offer.Account, "Offer (bid)");
  }

  return { nodes, edges };
}

// Best-effort decode of an XRPL currency code. 20-byte hex codes get ASCII-
// decoded if they look printable; otherwise we keep the 3-letter ISO code or
// fall back to a truncated hex label so the edge stays readable.
function decodeCurrencyLike(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "?";
  if (raw.length <= 3) return raw;
  // 40-hex-char format — decode ASCII bytes, trim trailing zeros.
  let out = "";
  for (let i = 0; i < raw.length; i += 2) {
    const code = parseInt(raw.slice(i, i + 2), 16);
    if (code > 0 && code < 128) out += String.fromCharCode(code);
  }
  out = out.replace(/\0+$/, "").trim();
  return out || raw.slice(0, 6);
}
