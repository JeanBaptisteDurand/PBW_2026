// BFS expansion wrapper around CrawlerService.crawl + buildGraph.
//
// Depth 1 is single-seed: one crawl, one buildGraph, mark seed's non-account
// nodes as "primary" and its fan-out accounts as "secondary".
//
// Depth >= 2 runs a bounded BFS: after the seed crawl we pick up to topK
// "heavy" neighbours via pickHubsFromCrawl, crawl each with a concurrency
// pool (per-crawl timeout), build a sub-graph per hub, reparent the sub-graph
// onto the merged graph, and merge nodes/edges with dedup. enforceMaxNodes
// trims secondary nodes from farthest hubs first to keep the merged output
// under maxNodes.

import { buildGraph, computeGraphStats } from "../domain/graph-builder.js";
import { enforceMaxNodes, reparentSubGraph } from "../domain/graph-merge.js";
import { computeRiskFlags } from "../domain/risk-engine.js";
import type {
  CrawlResult,
  GraphData,
  GraphEdge,
  GraphNode,
  NodeKind,
  RiskFlagData,
} from "../domain/types.js";
import type { CrawlerService } from "./crawler.service.js";
import { type QueuedHub, pickHubsFromCrawl } from "./hub-picker.service.js";

const DEFAULTS = {
  concurrency: 4,
  maxCrawls: 60,
  crawlTimeoutMs: 45_000,
  topK: 8,
  maxNodes: 800,
} as const;

const SECONDARY_KINDS: ReadonlySet<NodeKind> = new Set<NodeKind>(["account"]);

export type BfsRunInput = {
  seedAddress: string;
  seedLabel: string | null;
  depth: number;
  concurrency?: number;
  maxCrawls?: number;
  crawlTimeoutMs?: number;
  topK?: number;
  maxNodes?: number;
  signal?: AbortSignal;
};

export type ContractStats = {
  nodeCount: number;
  edgeCount: number;
  riskCounts: { HIGH: number; MED: number; LOW: number };
};

export type BfsHubMeta = {
  address: string;
  depth: number;
  status: "crawled" | "skipped" | "error";
  error?: string;
};

export type BfsSummary = {
  depth: number;
  hubCount: number;
  hubs: BfsHubMeta[];
  crawlsRun: number;
  truncated: boolean;
};

export type BfsRunResult = {
  graph: GraphData;
  flags: RiskFlagData[];
  contractStats: ContractStats;
  crawlSummary: CrawlResult;
  bfsSummary?: BfsSummary;
};

export type BfsServiceOptions = {
  crawler: CrawlerService;
};

export type BfsService = ReturnType<typeof createBfsService>;

function isSecondary(kind: NodeKind): boolean {
  return SECONDARY_KINDS.has(kind);
}

function markImportance(nodes: GraphNode[], defaultImportance: "primary" | "secondary"): void {
  for (const n of nodes) {
    if (n.importance) continue;
    n.importance = isSecondary(n.kind) ? "secondary" : defaultImportance;
  }
}

function computeContractStats(
  nodes: GraphNode[],
  edges: GraphEdge[],
  flags: RiskFlagData[],
): ContractStats {
  const riskCounts = flags.reduce(
    (acc, f) => {
      acc[f.severity] += 1;
      return acc;
    },
    { HIGH: 0, MED: 0, LOW: 0 },
  );
  return { nodeCount: nodes.length, edgeCount: edges.length, riskCounts };
}

export function createBfsService(opts: BfsServiceOptions) {
  return {
    async run(input: BfsRunInput): Promise<BfsRunResult> {
      const depth = input.depth;
      const concurrency = input.concurrency ?? DEFAULTS.concurrency;
      const maxCrawls = input.maxCrawls ?? DEFAULTS.maxCrawls;
      const crawlTimeoutMs = input.crawlTimeoutMs ?? DEFAULTS.crawlTimeoutMs;
      const topK = input.topK ?? DEFAULTS.topK;
      const maxNodes = input.maxNodes ?? DEFAULTS.maxNodes;

      const seedCrawl = await opts.crawler.crawl(input.seedAddress, input.seedLabel);
      const seedGraph = buildGraph(
        seedCrawl,
        input.seedAddress,
        input.seedLabel ?? input.seedAddress,
      );
      const seedFlags = computeRiskFlags(seedCrawl, input.seedAddress);

      // Attach seed flags to the seed node (matches v2 depth-1 contract).
      const seedNodeForFlags =
        seedGraph.nodes.find(
          (n) =>
            n.kind === "account" && (n.id === input.seedAddress || n.label === input.seedAddress),
        ) ?? seedGraph.nodes[0];
      if (seedNodeForFlags) {
        seedNodeForFlags.riskFlags = seedFlags;
      }

      // Depth 1 — preserve the original single-seed contract verbatim.
      if (depth < 2) {
        const contractStats = computeContractStats(seedGraph.nodes, seedGraph.edges, seedFlags);
        return {
          graph: seedGraph,
          flags: seedFlags,
          contractStats,
          crawlSummary: seedCrawl,
        };
      }

      const merged = new Map<string, GraphNode>();
      const mergedEdges = new Map<string, GraphEdge>();
      for (const n of seedGraph.nodes) merged.set(n.id, n);
      for (const e of seedGraph.edges) mergedEdges.set(e.id, e);
      markImportance(Array.from(merged.values()), "primary");
      const seedAnchorId = `issuer:${input.seedAddress}`;
      const seedAnchor = merged.get(seedAnchorId);
      if (seedAnchor) seedAnchor.isHub = true;

      const hubsMeta: BfsHubMeta[] = [{ address: input.seedAddress, depth: 0, status: "crawled" }];
      const visited = new Set<string>([input.seedAddress]);
      let crawlsRun = 1;
      let truncated = false;

      let frontier = pickHubsFromCrawl(seedCrawl, input.seedAddress, visited, 1, topK);
      for (const h of frontier) visited.add(h.address);
      let nextFrontier: QueuedHub[] = [];

      const runHubCrawl = async (hub: QueuedHub): Promise<void> => {
        if (crawlsRun >= maxCrawls) {
          truncated = true;
          hubsMeta.push({
            address: hub.address,
            depth: hub.depth,
            status: "skipped",
            error: "maxCrawls",
          });
          return;
        }
        crawlsRun++;
        try {
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error(`crawl timeout after ${crawlTimeoutMs}ms`)),
              crawlTimeoutMs,
            );
          });
          const crawl = (await Promise.race([
            opts.crawler.crawl(hub.address, null),
            timeoutPromise,
          ]).finally(() => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          })) as CrawlResult;

          const sub = buildGraph(crawl, hub.address, hub.address.slice(0, 8));
          markImportance(sub.nodes, "primary");

          const isRealIssuer = Object.keys(crawl.gatewayBalances?.obligations ?? {}).length > 0;
          reparentSubGraph(sub, hub.address, merged, mergedEdges, isRealIssuer);
          hubsMeta.push({ address: hub.address, depth: hub.depth, status: "crawled" });

          if (hub.depth + 1 <= depth - 1) {
            const next = pickHubsFromCrawl(crawl, hub.address, visited, hub.depth + 1, topK);
            for (const h of next) {
              visited.add(h.address);
              nextFrontier.push(h);
            }
          }
        } catch (err) {
          hubsMeta.push({
            address: hub.address,
            depth: hub.depth,
            status: "error",
            error: err instanceof Error ? err.message : "hub crawl failed",
          });
        }
      };

      for (let level = 1; level <= depth - 1; level++) {
        if (input.signal?.aborted) break;
        nextFrontier = [];
        for (let i = 0; i < frontier.length; i += concurrency) {
          if (input.signal?.aborted) break;
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

      const { dropped } = enforceMaxNodes(merged, mergedEdges, seedAnchorId, maxNodes);
      if (dropped > 0) truncated = true;

      const finalNodes = Array.from(merged.values());
      const finalEdges = Array.from(mergedEdges.values());
      const finalStats = computeGraphStats(finalNodes, finalEdges);
      const graph: GraphData = { nodes: finalNodes, edges: finalEdges, stats: finalStats };
      const contractStats = computeContractStats(finalNodes, finalEdges, seedFlags);

      return {
        graph,
        flags: seedFlags,
        contractStats,
        crawlSummary: seedCrawl,
        bfsSummary: {
          depth,
          hubCount: hubsMeta.filter((h) => h.status === "crawled").length,
          hubs: hubsMeta,
          crawlsRun,
          truncated,
        },
      };
    },
  };
}
