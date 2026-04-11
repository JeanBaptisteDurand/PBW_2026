// BFS expansion wrapper around crawlFromSeed + buildGraph.
//
// Depth 1 (default) is behaviourally identical to the old single-seed
// pipeline: one crawl, one buildGraph, mark the seed's non-account nodes as
// primary and its fan-out accounts as secondary. The only functional change
// at depth 1 is the importance marking — it lets the frontend optionally hide
// the 50-top-trustline-holder ring.
//
// Depth >= 2 runs a bounded BFS: after the seed crawl we pick up to `topK`
// "heavy" neighbours (structural + tx-based, deduped), crawl each of them
// with a concurrency pool, build a sub-graph per hub, and merge everything
// into one GraphData. Every hub contributes its own full fan-out, so the
// resulting graph has multiple rich "hubs" — which is the whole point of
// the feature.
//
// Safety envelope mirrors the history BFS: maxCrawls=60, concurrency=4,
// per-crawl 45s timeout, and a hard maxNodes cap on the merged output. When
// we exceed maxNodes we trim secondary nodes from the farthest hubs first so
// the seed's primary structure is always preserved.
import type { GraphData, GraphNode, GraphEdge, NodeKind } from "@xrplens/core";
import type { XRPLClientWrapper } from "../xrpl/client.js";
import { crawlFromSeed, type CrawlResult } from "./crawler.js";
import { buildGraph } from "./graphBuilder.js";
import { classifyCounterparties } from "./counterpartyClassifier.js";
import type { HeavyKind } from "./counterpartyClassifier.js";
import { logger } from "../logger.js";

// ─── Tunables ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  concurrency: 4,
  maxCrawls: 60,
  crawlTimeoutMs: 45_000,
  topK: 8,
  maxNodes: 800,
} as const;

// Kinds that are "primary" information in the graph regardless of how they
// were discovered. Accounts are secondary by default (fan-out rings); every
// other kind is part of the core entity picture and stays primary.
const SECONDARY_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>(["account"]);

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BfsOpts {
  depth: number;
  concurrency?: number;
  maxCrawls?: number;
  crawlTimeoutMs?: number;
  topK?: number;
  maxNodes?: number;
  onProgress?: (step: string, detail?: string) => void;
  signal?: AbortSignal;
}

export interface BfsResult {
  graph: GraphData;
  crawlSummary: {
    depth: number;
    hubCount: number;
    hubs: Array<{ address: string; depth: number; status: "crawled" | "skipped" | "error"; error?: string }>;
    crawlsRun: number;
    truncated: boolean;
    seedCrawl: CrawlResult;
  };
}

interface QueuedHub {
  address: string;
  kind: HeavyKind | "structural";
  depth: number;
  reason: string;
  rank: number; // lower is more important
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSecondary(kind: NodeKind): boolean {
  return SECONDARY_KINDS.has(kind);
}

function markImportance(nodes: GraphNode[], defaultImportance: "primary" | "secondary"): void {
  for (const n of nodes) {
    if (n.importance) continue; // don't clobber prior marking
    n.importance = isSecondary(n.kind) ? "secondary" : defaultImportance;
  }
}

// Rewrites a sub-crawl's graph so it attaches cleanly into the merged graph.
// Every buildGraph() output has an `issuer:${seed}` root node even when the
// seed is a wallet or AMM pool; if we just dropped those into the merged
// graph we'd get fake issuer nodes for every crawled hub. Instead we pick an
// "anchor" — the node that already represents this hub in the merged graph
// (ammPool:X, account:X, issuer:X) — and rewire all edges that pointed to
// the sub-crawl's `issuer:${hub}` root to point at the anchor. The fake
// issuer node is then discarded unless the hub really is an issuer (has
// obligations).
function reparentSubGraph(
  sub: GraphData,
  hubAddress: string,
  merged: Map<string, GraphNode>,
  mergedEdges: Map<string, GraphEdge>,
  isRealIssuer: boolean,
): { anchorId: string } {
  const subIssuerId = `issuer:${hubAddress}`;
  // Pick the anchor id: prefer an ammPool node if one exists, then the
  // sub-crawl's own issuer (if the hub is a real issuer), else an account
  // node for the hub (creating it if needed).
  let anchorId: string | undefined;
  const ammId = `ammPool:${hubAddress}`;
  const acctId = `account:${hubAddress}`;
  if (merged.has(ammId)) {
    anchorId = ammId;
  } else if (isRealIssuer) {
    anchorId = subIssuerId;
  } else if (merged.has(acctId)) {
    anchorId = acctId;
  } else {
    anchorId = acctId;
    // Synthesize a minimal account node for the hub so edges have a target.
    merged.set(acctId, {
      id: acctId,
      kind: "account",
      label: hubAddress.slice(0, 8),
      data: { address: hubAddress } as GraphNode["data"],
      riskFlags: [],
      isHub: true,
    });
  }

  // Drop the sub-crawl's root issuer node if the hub isn't really an issuer.
  const subNodes = isRealIssuer
    ? sub.nodes
    : sub.nodes.filter((n) => n.id !== subIssuerId);

  // Merge nodes (dedupe by id).
  for (const n of subNodes) {
    if (!merged.has(n.id)) {
      merged.set(n.id, n);
    } else {
      // Union risk flags when a node is re-seen from another crawl.
      const prev = merged.get(n.id)!;
      if (n.riskFlags?.length) {
        const seen = new Set(prev.riskFlags.map((f) => f.flag));
        for (const f of n.riskFlags) {
          if (!seen.has(f.flag)) prev.riskFlags.push(f);
        }
      }
    }
  }

  // Merge edges, rewriting any reference to the sub-crawl's issuer root.
  for (const e of sub.edges) {
    const src = e.source === subIssuerId && !isRealIssuer ? anchorId! : e.source;
    const tgt = e.target === subIssuerId && !isRealIssuer ? anchorId! : e.target;
    // Skip self-loops introduced by the rewrite.
    if (src === tgt) continue;
    // Skip edges whose endpoints got dropped.
    if (!merged.has(src) || !merged.has(tgt)) continue;
    const id = src === e.source && tgt === e.target
      ? e.id
      : `${src}--${e.kind}--${tgt}`;
    if (!mergedEdges.has(id)) {
      mergedEdges.set(id, { ...e, id, source: src, target: tgt });
    }
  }

  // Mark the anchor as a hub.
  const anchor = merged.get(anchorId);
  if (anchor) anchor.isHub = true;

  return { anchorId };
}

// Detect heavies to expand next from a crawl result. Unions:
//   - structural heavies: AMM pool account, AMM counter-issuer, top-3
//     trustline holders by abs(balance).
//   - tx-based heavies from classifyCounterparties on the crawl's own
//     account_tx sample.
// Results are ranked (issuer/amm kinds ahead of plain accounts) and the
// top-K per hub are returned.
function pickHubsFromCrawl(
  crawl: CrawlResult,
  seedAddress: string,
  visited: Set<string>,
  depth: number,
  topK: number,
): QueuedHub[] {
  const candidates = new Map<string, QueuedHub>();

  const push = (
    address: string | undefined,
    kind: HeavyKind | "structural",
    reason: string,
    rank: number,
  ) => {
    if (!address) return;
    if (address === seedAddress) return;
    if (visited.has(address)) return;
    const prev = candidates.get(address);
    if (!prev || rank < prev.rank) {
      candidates.set(address, { address, kind, depth, reason, rank });
    }
  };

  // Structural: AMM pool account.
  if (crawl.ammPool?.account) {
    push(crawl.ammPool.account, "amm", "amm_pool", 0);
  }
  // Structural: AMM counter-asset issuer (when it's a IOU on the other side).
  const a2 = crawl.ammPool?.amount2;
  if (a2 && typeof a2 === "object" && a2.issuer && a2.issuer !== seedAddress) {
    push(a2.issuer, "issuer", "amm_counter_issuer", 1);
  }
  const a1 = crawl.ammPool?.amount;
  if (a1 && typeof a1 === "object" && a1.issuer && a1.issuer !== seedAddress) {
    push(a1.issuer, "issuer", "amm_counter_issuer", 1);
  }

  // Tx-based: classify seed's transactions.
  try {
    const cls = classifyCounterparties(seedAddress, crawl.accountTransactions ?? []);
    for (const [addr, entry] of cls.heavy) {
      // Rank heavy by kind: issuer > amm > others, break ties by txCount.
      const kindRank = entry.kind === "issuer" ? 2 : entry.kind === "amm" ? 3 : 5;
      const txPenalty = -Math.min(entry.txCount, 50) * 0.01;
      push(addr, entry.kind, `tx_heavy:${entry.kind}`, kindRank + txPenalty);
    }
  } catch (err: any) {
    logger.warn("[bfs] classifier failed", { error: err?.message, seedAddress });
  }

  // Structural: top-3 trustline holders by balance (last-resort accounts).
  const topTrust = [...crawl.trustLines]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 3);
  for (const t of topTrust) {
    push(t.account, "issuer", "top_trustline_holder", 6);
  }

  // Rank and take topK.
  return Array.from(candidates.values())
    .sort((a, b) => a.rank - b.rank)
    .slice(0, topK);
}

// Hard cap: if merged graph exceeded maxNodes, trim secondary nodes — from
// the farthest-from-seed hubs first — until we're under budget. Primary nodes
// (everything non-account) and the seed's subgraph are protected.
function enforceMaxNodes(
  merged: Map<string, GraphNode>,
  mergedEdges: Map<string, GraphEdge>,
  seedAnchorId: string,
  maxNodes: number,
): { dropped: number } {
  if (merged.size <= maxNodes) return { dropped: 0 };

  // Compute BFS distance from seedAnchorId over merged edges.
  const adj = new Map<string, Set<string>>();
  for (const e of mergedEdges.values()) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  const dist = new Map<string, number>();
  const queue: string[] = [seedAnchorId];
  dist.set(seedAnchorId, 0);
  while (queue.length) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }

  // Candidates to drop: secondary nodes only, sorted by distance descending.
  const droppable = Array.from(merged.values())
    .filter((n) => n.importance === "secondary")
    .sort((a, b) => (dist.get(b.id) ?? 99) - (dist.get(a.id) ?? 99));

  let dropped = 0;
  for (const n of droppable) {
    if (merged.size <= maxNodes) break;
    merged.delete(n.id);
    dropped++;
  }
  // Drop edges whose endpoints vanished.
  for (const [id, e] of mergedEdges) {
    if (!merged.has(e.source) || !merged.has(e.target)) {
      mergedEdges.delete(id);
    }
  }
  return { dropped };
}

function computeStats(nodes: GraphNode[], edges: GraphEdge[]) {
  const nodesByKind: Record<string, number> = {};
  let totalRiskFlags = 0, highRiskCount = 0, medRiskCount = 0, lowRiskCount = 0;
  for (const n of nodes) {
    nodesByKind[n.kind] = (nodesByKind[n.kind] ?? 0) + 1;
    for (const f of n.riskFlags ?? []) {
      totalRiskFlags++;
      if (f.severity === "HIGH") highRiskCount++;
      else if (f.severity === "MED") medRiskCount++;
      else lowRiskCount++;
    }
  }
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalRiskFlags,
    highRiskCount,
    medRiskCount,
    lowRiskCount,
    nodesByKind: nodesByKind as GraphData["stats"]["nodesByKind"],
  };
}

// ─── Main orchestrator ───────────────────────────────────────────────────────

export async function runBfsAnalysis(
  client: XRPLClientWrapper,
  seedAddress: string,
  seedLabel: string | undefined,
  opts: BfsOpts,
): Promise<BfsResult> {
  const depth = Math.max(1, Math.min(3, opts.depth || 1));
  const concurrency = opts.concurrency ?? DEFAULTS.concurrency;
  const maxCrawls = opts.maxCrawls ?? DEFAULTS.maxCrawls;
  const crawlTimeoutMs = opts.crawlTimeoutMs ?? DEFAULTS.crawlTimeoutMs;
  const topK = opts.topK ?? DEFAULTS.topK;
  const maxNodes = opts.maxNodes ?? DEFAULTS.maxNodes;
  const progress = opts.onProgress ?? (() => {});

  const hubsMeta: BfsResult["crawlSummary"]["hubs"] = [];
  const visited = new Set<string>([seedAddress]);
  let crawlsRun = 0;

  // ── Seed crawl (depth 0) ────────────────────────────────────────────────
  progress("crawling", `Crawling seed ${seedAddress}`);
  const seedCrawl = await crawlFromSeed(client, seedAddress, seedLabel, progress);
  crawlsRun++;
  progress("building_graph", "Building seed subgraph");
  const seedGraph = buildGraph(seedCrawl, seedAddress, seedLabel);

  // Merge structures.
  const merged = new Map<string, GraphNode>();
  const mergedEdges = new Map<string, GraphEdge>();
  for (const n of seedGraph.nodes) merged.set(n.id, n);
  for (const e of seedGraph.edges) mergedEdges.set(e.id, e);
  markImportance(Array.from(merged.values()), "primary");
  const seedAnchorId = `issuer:${seedAddress}`;
  const seedAnchor = merged.get(seedAnchorId);
  if (seedAnchor) seedAnchor.isHub = true;
  hubsMeta.push({ address: seedAddress, depth: 0, status: "crawled" });

  // Depth 1 → done. Single-seed mode, identical to the old pipeline.
  if (depth < 2) {
    return {
      graph: {
        nodes: Array.from(merged.values()),
        edges: Array.from(mergedEdges.values()),
        stats: computeStats(Array.from(merged.values()), Array.from(mergedEdges.values())),
      },
      crawlSummary: {
        depth,
        hubCount: 1,
        hubs: hubsMeta,
        crawlsRun,
        truncated: false,
        seedCrawl,
      },
    };
  }

  // ── BFS queue ───────────────────────────────────────────────────────────
  // Depth parameter semantics: depth=2 expands the seed's heavies; depth=3
  // then expands each of those hubs' heavies in turn. We process one "level"
  // at a time so the concurrency pool never mixes depths.
  let frontier = pickHubsFromCrawl(seedCrawl, seedAddress, visited, 1, topK);
  for (const h of frontier) visited.add(h.address);
  let truncated = false;

  // Declared up-front so the hub crawl closure can push the next level's
  // frontier into it (the assignment inside the for loop reassigns the
  // binding each level, which the closure picks up correctly).
  let nextFrontier: QueuedHub[] = [];

  const runHubCrawl = async (hub: QueuedHub): Promise<void> => {
    if (crawlsRun >= maxCrawls) {
      truncated = true;
      hubsMeta.push({ address: hub.address, depth: hub.depth, status: "skipped", error: "maxCrawls" });
      return;
    }
    crawlsRun++;
    progress(
      "crawling",
      `Hub ${crawlsRun}: ${hub.kind} ${hub.address.slice(0, 8)} (${hub.reason})`,
    );
    try {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(
          () => reject(new Error(`crawl timeout after ${crawlTimeoutMs}ms`)),
          crawlTimeoutMs,
        );
      });
      const crawl = (await Promise.race([
        crawlFromSeed(client, hub.address),
        timeoutPromise,
      ]).finally(() => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
      })) as CrawlResult;

      // Build the sub-graph and mark its fan-out as secondary.
      const sub = buildGraph(crawl, hub.address, hub.address.slice(0, 8));
      markImportance(sub.nodes, "primary");

      const isRealIssuer =
        Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
      reparentSubGraph(sub, hub.address, merged, mergedEdges, isRealIssuer);
      hubsMeta.push({ address: hub.address, depth: hub.depth, status: "crawled" });

      // If we're not at max depth, seed the next level with this hub's
      // heavies (deferred via closure so the outer loop picks them up).
      if (hub.depth + 1 <= depth - 1) {
        const next = pickHubsFromCrawl(crawl, hub.address, visited, hub.depth + 1, topK);
        for (const h of next) {
          visited.add(h.address);
          nextFrontier.push(h);
        }
      }
    } catch (err: any) {
      hubsMeta.push({
        address: hub.address,
        depth: hub.depth,
        status: "error",
        error: err?.message ?? "hub crawl failed",
      });
      logger.warn("[bfs] hub crawl failed", { hub: hub.address, error: err?.message });
    }
  };

  // Process one level at a time. At depth=2 this loops once; at depth=3 twice.
  for (let level = 1; level <= depth - 1; level++) {
    progress(
      "bfs_level",
      `Level ${level}: ${frontier.length} hubs (concurrency ${concurrency})`,
    );
    nextFrontier = [];
    // Run the current frontier through a fixed-concurrency pool.
    for (let i = 0; i < frontier.length; i += concurrency) {
      if (opts.signal?.aborted) break;
      if (crawlsRun >= maxCrawls) {
        truncated = true;
        break;
      }
      const batch = frontier.slice(i, i + concurrency);
      await Promise.all(batch.map((hub) => runHubCrawl(hub)));
    }
    frontier = nextFrontier;
    if (frontier.length === 0) break;
  }

  // ── Enforce hard cap ────────────────────────────────────────────────────
  const { dropped } = enforceMaxNodes(merged, mergedEdges, seedAnchorId, maxNodes);
  if (dropped > 0) {
    truncated = true;
    logger.info("[bfs] trimmed secondary nodes to fit maxNodes", { dropped, maxNodes });
  }

  const finalNodes = Array.from(merged.values());
  const finalEdges = Array.from(mergedEdges.values());

  return {
    graph: {
      nodes: finalNodes,
      edges: finalEdges,
      stats: computeStats(finalNodes, finalEdges),
    },
    crawlSummary: {
      depth,
      hubCount: hubsMeta.filter((h) => h.status === "crawled").length,
      hubs: hubsMeta,
      crawlsRun,
      truncated,
      seedCrawl,
    },
  };
}
