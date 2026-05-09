import type { CrawlerService } from "./crawler.service.js";
import { buildGraph } from "../domain/graph-builder.js";
import { computeRiskFlags } from "../domain/risk-engine.js";
import type { GraphData, CrawlResult, RiskFlagData } from "../domain/types.js";

export type BfsRunInput = { seedAddress: string; seedLabel: string | null; depth: number };

export type ContractStats = {
  nodeCount: number;
  edgeCount: number;
  riskCounts: { HIGH: number; MED: number; LOW: number };
};

export type BfsRunResult = {
  graph: GraphData;
  flags: RiskFlagData[];
  contractStats: ContractStats;
  crawlSummary: CrawlResult;
};

export type BfsServiceOptions = {
  crawler: CrawlerService;
};

export type BfsService = ReturnType<typeof createBfsService>;

export function createBfsService(opts: BfsServiceOptions) {
  return {
    async run(input: BfsRunInput): Promise<BfsRunResult> {
      const crawl = await opts.crawler.crawl(input.seedAddress, input.seedLabel);
      const graph = buildGraph(crawl, input.seedAddress, input.seedLabel ?? input.seedAddress);
      const flags = computeRiskFlags(crawl, input.seedAddress);

      // Attach flags to the seed node
      const seedNode = graph.nodes.find((n) => n.kind === "account" && (n.id === input.seedAddress || n.label === input.seedAddress)) ?? graph.nodes[0];
      if (seedNode) {
        seedNode.riskFlags = flags;
      }

      const riskCounts = flags.reduce(
        (acc, f) => { acc[f.severity] += 1; return acc; },
        { HIGH: 0, MED: 0, LOW: 0 },
      );

      const contractStats: ContractStats = {
        nodeCount: graph.nodes.length,
        edgeCount: graph.edges.length,
        riskCounts,
      };

      return { graph, flags, contractStats, crawlSummary: crawl };
    },
  };
}
