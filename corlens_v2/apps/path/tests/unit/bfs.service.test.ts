import { describe, expect, it, vi } from "vitest";
import { createBfsService } from "../../src/services/bfs.service.js";

describe("bfs.service", () => {
  it("returns graph + crawlSummary at depth 1", async () => {
    const crawler = { crawl: vi.fn().mockResolvedValue({
      seedAddress: "rSeed", seedLabel: null, primaryCurrency: null, isIssuer: false,
      issuerInfo: null, trustLines: [], gatewayBalances: null, ammPool: null, lpHolders: [],
      asks: [], bids: [], paths: [], accountObjects: [], currencies: { obligations: {} }, topAccounts: new Map(),
      accountTransactions: [], nfts: [], channels: [], txTypeSummary: {}, accountOffers: [],
      noripppleProblems: [], nftOffers: [],
    }) };
    const svc = createBfsService({ crawler: crawler as never });
    const out = await svc.run({ seedAddress: "rSeed", seedLabel: null, depth: 1 });
    expect(out.graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(out.crawlSummary.seedAddress).toBe("rSeed");
    expect(out.contractStats.nodeCount).toBe(out.graph.nodes.length);
    expect(out.contractStats.riskCounts).toBeDefined();
    expect(crawler.crawl).toHaveBeenCalledTimes(1);
  });
});
