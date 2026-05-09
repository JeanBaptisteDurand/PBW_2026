import { describe, expect, it, vi } from "vitest";
import type { CrawlResult } from "../../src/domain/types.js";
import { createBfsService } from "../../src/services/bfs.service.js";

function emptyCrawl(seedAddress: string): CrawlResult {
  return {
    seedAddress,
    seedLabel: null,
    primaryCurrency: null,
    isIssuer: false,
    issuerInfo: {},
    trustLines: [],
    gatewayBalances: { obligations: {} },
    ammPool: null,
    lpHolders: [],
    asks: [],
    bids: [],
    paths: [],
    accountObjects: [],
    currencies: { send_currencies: [], receive_currencies: [] },
    topAccounts: new Map(),
    accountTransactions: [],
    nfts: [],
    channels: [],
    txTypeSummary: [],
    accountOffers: [],
    noripppleProblems: [],
    nftOffers: [],
  };
}

describe("bfs.service", () => {
  it("returns graph + crawlSummary at depth 1", async () => {
    const crawler = {
      crawl: vi.fn().mockResolvedValue(emptyCrawl("rSeed")),
    };
    const svc = createBfsService({ crawler: crawler as never });
    const out = await svc.run({ seedAddress: "rSeed", seedLabel: null, depth: 1 });
    expect(out.graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(out.crawlSummary.seedAddress).toBe("rSeed");
    expect(out.contractStats.nodeCount).toBe(out.graph.nodes.length);
    expect(out.contractStats.riskCounts).toBeDefined();
    expect(crawler.crawl).toHaveBeenCalledTimes(1);
  });

  it("expands to picked hubs and merges their subgraphs at depth 2", async () => {
    const seed = emptyCrawl("rSeed");
    // Two top trustline holders → both picked as hubs (rank 6, top_trustline_holder).
    seed.trustLines = [
      { account: "rHubA", balance: "5000", currency: "USD" },
      { account: "rHubB", balance: "3000", currency: "USD" },
    ];

    const hubA = emptyCrawl("rHubA");
    hubA.trustLines = [{ account: "rLeafA", balance: "10", currency: "USD" }];

    const hubB = emptyCrawl("rHubB");
    hubB.trustLines = [{ account: "rLeafB", balance: "20", currency: "USD" }];

    const crawl = vi.fn(async (address: string) => {
      if (address === "rSeed") return seed;
      if (address === "rHubA") return hubA;
      if (address === "rHubB") return hubB;
      throw new Error(`unexpected address: ${address}`);
    });
    const svc = createBfsService({ crawler: { crawl } as never });

    const out = await svc.run({ seedAddress: "rSeed", seedLabel: null, depth: 2 });

    expect(crawl).toHaveBeenCalledTimes(3);
    expect(out.bfsSummary).toBeDefined();
    expect(out.bfsSummary?.depth).toBe(2);
    // hubCount counts every successful crawl, including the seed (matches v1 semantics).
    expect(out.bfsSummary?.hubCount).toBe(3);
    expect(out.bfsSummary?.crawlsRun).toBe(3);
    expect(out.bfsSummary?.truncated).toBe(false);
    const hubAddrs = (out.bfsSummary?.hubs ?? []).map((h) => h.address).sort();
    expect(hubAddrs).toEqual(["rHubA", "rHubB", "rSeed"]);

    // Merged graph contains nodes contributed by both hub sub-crawls (deduped).
    const ids = new Set(out.graph.nodes.map((n) => n.id));
    expect(ids.has("issuer:rSeed")).toBe(true);
    // After reparenting, rHubA/rHubB become anchors as account nodes (not real issuers).
    expect(ids.has("account:rHubA") || ids.has("issuer:rHubA")).toBe(true);
    expect(ids.has("account:rHubB") || ids.has("issuer:rHubB")).toBe(true);
  });

  it("swallows hub-crawl errors and reports them in bfsSummary", async () => {
    const seed = emptyCrawl("rSeed");
    seed.trustLines = [{ account: "rBad", balance: "1000", currency: "USD" }];
    const crawl = vi.fn(async (address: string) => {
      if (address === "rSeed") return seed;
      throw new Error("simulated failure");
    });
    const svc = createBfsService({ crawler: { crawl } as never });
    const out = await svc.run({ seedAddress: "rSeed", seedLabel: null, depth: 2 });
    const errored = (out.bfsSummary?.hubs ?? []).find((h) => h.address === "rBad");
    expect(errored?.status).toBe("error");
    expect(out.bfsSummary?.hubCount).toBe(1); // only seed crawled successfully
  });

  it("honors AbortSignal between BFS levels", async () => {
    const seed = emptyCrawl("rSeed");
    seed.trustLines = [{ account: "rHub1", balance: "1000", currency: "USD" }];
    const ac = new AbortController();
    const crawl = vi.fn(async (address: string) => {
      if (address === "rSeed") {
        ac.abort();
        return seed;
      }
      return emptyCrawl(address);
    });
    const svc = createBfsService({ crawler: { crawl } as never });
    const out = await svc.run({
      seedAddress: "rSeed",
      seedLabel: null,
      depth: 2,
      signal: ac.signal,
    });
    // Only the seed crawl ran — BFS aborted before the hub level.
    expect(crawl).toHaveBeenCalledTimes(1);
    expect(out.bfsSummary?.crawlsRun).toBe(1);
  });
});
