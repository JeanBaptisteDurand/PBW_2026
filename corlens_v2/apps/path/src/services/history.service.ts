// History BFS orchestrator. Async generator: emits HistoryEvent frames for
// the SSE controller as the seed is classified, the heavy queue is built,
// and each crawled hub yields its expansion children + sub-edges.
//
// Ported from v1 corlens/apps/server/src/analysis/historyOrchestrator.ts.
// v2 adaptations:
//   - marketData injected (no direct xrpl client),
//   - logger drops to silent (history is best-effort),
//   - sinceDays is accepted but not honored at the connector level — the
//     v2 marketData connector has no sinceUnixTime knob; maxTx + BFS depth
//     bound the work instead. See the seed-tx fetch comment for details.

import type { path as pp } from "@corlens/contracts";
import type { MarketDataClient } from "../connectors/market-data.js";
import { classifyCounterparties } from "../domain/classifier.js";
import type { CrawlResult } from "../domain/types.js";
import type { HistoryCrawlerService } from "./history-crawler.service.js";

type HeavyKind = pp.HeavyKind;
type HistoryEdgeData = pp.HistoryEdgeData;
type HistoryEvent = pp.HistoryEvent;
type HistoryNode = pp.HistoryNode;

// Per-crawl hard timeout so a single slow XRPL RPC call cannot block the
// entire BFS pool forever. Exceeded crawls become crawl_errors and the pool
// moves on. The history light crawl runs only 5 parallel RPCs, so 20s is
// generous — crawls that exceed this are genuinely stuck on a slow node
// rather than pushing through legitimate work.
const DEFAULT_CRAWL_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_CRAWLS = 60;
const DEFAULT_CONCURRENCY = 4;

export type HistoryStreamOptions = {
  depth: number;
  maxTx: number;
  sinceDays: number;
  maxCrawls?: number;
  concurrency?: number;
  crawlTimeoutMs?: number;
  signal?: AbortSignal;
};

export type HistoryServiceOptions = {
  marketData: MarketDataClient;
  historyCrawler: HistoryCrawlerService;
};

export type HistoryService = ReturnType<typeof createHistoryService>;

type QueuedCrawl = {
  address: string;
  kind: HeavyKind;
  depth: number;
  txCount: number;
};

export function createHistoryService(opts: HistoryServiceOptions) {
  return {
    stream(seed: string, streamOpts: HistoryStreamOptions): AsyncGenerator<HistoryEvent> {
      return streamHistory(opts, seed, streamOpts);
    },
  };
}

async function* streamHistory(
  deps: HistoryServiceOptions,
  seed: string,
  opts: HistoryStreamOptions,
): AsyncGenerator<HistoryEvent> {
  const startedAt = Date.now();
  const maxCrawls = opts.maxCrawls ?? DEFAULT_MAX_CRAWLS;
  const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
  const crawlTimeoutMs = opts.crawlTimeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
  const signal = opts.signal;

  const nodes = new Map<string, HistoryNode>();
  const edges = new Map<string, HistoryEdgeData>();
  const visited = new Set<string>();
  let crawlsRun = 0;
  let truncated = false;

  const putNode = (n: HistoryNode): void => {
    const prev = nodes.get(n.id);
    if (!prev) nodes.set(n.id, n);
    else nodes.set(n.id, { ...prev, ...n });
  };
  const putEdge = (e: HistoryEdgeData): void => {
    const prev = edges.get(e.id);
    if (!prev) edges.set(e.id, e);
    else edges.set(e.id, { ...prev, count: prev.count + e.count });
  };
  const aborted = (): boolean => signal?.aborted === true;

  // ─── Step 1: seed tx fetch ───────────────────────────────────────────────
  // v1 used `sinceUnixTime` to clip txs by close-time. The v2 marketData
  // connector does not expose a unix-time cutoff, so we honor the seed limit
  // (`maxTx`) and let the orchestrator's BFS bound the depth instead. This
  // is consistent with the light crawler, which has the same limitation.
  let seedTxs: unknown[] = [];
  try {
    const txResp = (await deps.marketData.accountTransactions(seed, {
      limit: opts.maxTx,
    })) as { result?: { transactions?: unknown[] } };
    seedTxs = txResp.result?.transactions ?? [];
  } catch (err) {
    yield { type: "fatal_error", error: errMessage(err) || "account_tx failed" };
    return;
  }
  if (aborted()) return;

  const classification = classifyCounterparties(seed, seedTxs);

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

  const queue: QueuedCrawl[] = [];
  for (const [addr, entry] of classification.heavy) {
    queue.push({ address: addr, kind: entry.kind, depth: 1, txCount: entry.txCount });
  }

  for (const pair of classification.pendingAmmPairs) {
    if (aborted()) return;
    try {
      const ammResp = (await deps.marketData.ammByPair({
        asset1Currency: pair.asset1.currency,
        ...(pair.asset1.currency !== "XRP" && pair.asset1.issuer
          ? { asset1Issuer: pair.asset1.issuer }
          : {}),
        asset2Currency: pair.asset2.currency,
        ...(pair.asset2.currency !== "XRP" && pair.asset2.issuer
          ? { asset2Issuer: pair.asset2.issuer }
          : {}),
      })) as { result?: { amm?: { account?: string } } };
      const ammAcct = ammResp.result?.amm?.account;
      if (ammAcct) {
        queue.push({ address: ammAcct, kind: "amm", depth: 1, txCount: pair.txCount });
      }
    } catch {
      // amm_info resolution is best-effort; missing AMMs just don't get added.
    }
  }

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

  for (const e of classification.edges) putEdge(e);

  yield {
    type: "seed_ready",
    seed: seedNode,
    lightNodes,
    heavyQueue: heavyPlaceholders,
    edges: classification.edges,
    txTypeSummary: classification.txTypeSummary,
  };

  for (const q of queue) visited.add(q.address);

  // ─── Step 2: BFS with concurrency pool ───────────────────────────────────
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
      const result = (await Promise.race([
        deps.historyCrawler.crawlLight(task.address),
        timeoutPromise,
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      })) as CrawlResult;

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
      for (const child of expansionNodes) {
        out.push({ type: "node_added", node: child, edges: [] });
      }
      if (expansion.edges.length) {
        out.push({ type: "edges_added", edges: expansion.edges });
      }

      // Mine counterparties from this crawl's accountTransactions for next depth.
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
        // Sub-edges: re-target from task.address, not seed.
        const subEdges: HistoryEdgeData[] = sub.edges.map((e) => ({
          ...e,
          from: task.address,
          id: `${task.address}->${e.to}:${e.txType}`,
        }));
        for (const e of subEdges) putEdge(e);
        if (subEdges.length) out.push({ type: "edges_added", edges: subEdges });
      }

      out.push({ type: "node_added", node, edges: [] });
    } catch (err) {
      const errNode: HistoryNode = {
        id: task.address,
        kind: task.kind,
        address: task.address,
        depth: task.depth,
        txCount: task.txCount,
        crawlStatus: "error",
      };
      putNode(errNode);
      out.push({
        type: "crawl_error",
        address: task.address,
        error: errMessage(err) || "crawl failed",
      });
      out.push({ type: "node_added", node: errNode, edges: [] });
    } finally {
      crawlsRun++;
    }
    return out;
  };

  while ((queue.length > 0 || pending.length > 0) && !aborted()) {
    while (pending.length < concurrency && queue.length > 0 && dispatched < maxCrawls) {
      const task = queue.shift();
      if (!task) break;
      dispatched++;
      pending.push({ task, promise: runCrawl(task) });
    }
    if (pending.length === 0) break;

    if (dispatched >= maxCrawls && queue.length > 0) {
      truncated = true;
      queue.length = 0;
    }

    const finishedIdx = await Promise.race(pending.map((p, i) => p.promise.then(() => i)));
    const removed = pending.splice(finishedIdx, 1);
    const finished = removed[0];
    if (!finished) continue;
    const emitted = await finished.promise;
    for (const ev of emitted) yield ev;
  }

  // Drain remaining pending after abort / cap.
  while (pending.length > 0) {
    const p = pending.shift();
    if (!p) break;
    try {
      const emitted = await p.promise;
      for (const ev of emitted) yield ev;
    } catch {
      // already handled inside runCrawl
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

// ─── Private helpers ─────────────────────────────────────────────────────────

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}

function extractRiskFlags(result: CrawlResult & { riskFlags?: unknown }): string[] {
  const raw = (result as { riskFlags?: unknown }).riskFlags;
  if (Array.isArray(raw)) {
    return raw.map((f) => {
      if (f && typeof f === "object") {
        const o = f as { code?: unknown; flag?: unknown };
        if (typeof o.code === "string") return o.code;
        if (typeof o.flag === "string") return o.flag;
      }
      return String(f);
    });
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
  result: CrawlResult,
  parentDepth: number,
): { nodes: HistoryNode[]; edges: HistoryEdgeData[] } {
  const nodes: HistoryNode[] = [];
  const edges: HistoryEdgeData[] = [];
  const seen = new Set<string>([crawledAddress]);
  const CAP = 10;

  const pushChild = (peer: string, txType: string, count = 1): void => {
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
  const trustLines = Array.isArray(result.trustLines) ? result.trustLines : [];
  const topTrust = [...trustLines]
    .sort(
      (a, b) =>
        Math.abs(Number((b as { balance?: unknown }).balance ?? 0)) -
        Math.abs(Number((a as { balance?: unknown }).balance ?? 0)),
    )
    .slice(0, CAP);
  for (const line of topTrust) {
    const l = line as { account?: string; currency?: unknown };
    if (!l.account) continue;
    const ccy = decodeCurrencyLike(l.currency);
    pushChild(l.account, `Trusts ${ccy}`);
  }

  // LP holders — only present when the crawled account is itself an AMM.
  const lpHolders = Array.isArray(result.lpHolders) ? result.lpHolders : [];
  const topLp = [...lpHolders]
    .sort(
      (a, b) =>
        Math.abs(Number((b as { balance?: unknown }).balance ?? 0)) -
        Math.abs(Number((a as { balance?: unknown }).balance ?? 0)),
    )
    .slice(0, CAP);
  for (const holder of topLp) {
    const h = holder as { account?: string };
    if (h.account) pushChild(h.account, "LP holder");
  }

  // Order book — take the accounts posting the top asks and bids.
  const asks = Array.isArray(result.asks) ? result.asks : [];
  const bids = Array.isArray(result.bids) ? result.bids : [];
  for (const offer of asks.slice(0, 5)) {
    const o = offer as { Account?: string };
    if (o.Account) pushChild(o.Account, "Offer (ask)");
  }
  for (const offer of bids.slice(0, 5)) {
    const o = offer as { Account?: string };
    if (o.Account) pushChild(o.Account, "Offer (bid)");
  }

  return { nodes, edges };
}

// Best-effort decode of an XRPL currency code. 20-byte hex codes get ASCII-
// decoded if they look printable; otherwise we keep the 3-letter ISO code or
// fall back to a truncated hex label so the edge stays readable.
function decodeCurrencyLike(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "?";
  if (raw.length <= 3) return raw;
  let out = "";
  for (let i = 0; i < raw.length; i += 2) {
    const code = Number.parseInt(raw.slice(i, i + 2), 16);
    if (code > 0 && code < 128) out += String.fromCharCode(code);
  }
  out = out.replace(/\0+$/, "").trim();
  return out || raw.slice(0, 6);
}
