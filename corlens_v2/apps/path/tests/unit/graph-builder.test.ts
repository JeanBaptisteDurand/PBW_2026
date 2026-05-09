import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/domain/graph-builder.js";
import type { CrawlResult } from "../../src/domain/types.js";

const empty: CrawlResult = {
  seedAddress: "rSeed",
  seedLabel: null,
  primaryCurrency: null,
  isIssuer: false,
  issuerInfo: null,
  trustLines: [],
  gatewayBalances: null,
  ammPool: null,
  lpHolders: [],
  asks: [],
  bids: [],
  paths: [],
  accountObjects: [],
  currencies: { obligations: {} },
  topAccounts: new Map(),
  accountTransactions: [],
  nfts: [],
  channels: [],
  txTypeSummary: {},
  accountOffers: [],
  noripppleProblems: [],
  nftOffers: [],
};

describe("buildGraph", () => {
  it("creates at least one node (the seed) for an empty crawl", () => {
    const g = buildGraph(empty, "rSeed", "Seed");
    expect(g.nodes.length).toBeGreaterThanOrEqual(1);
    // v1 stats use totalNodes / totalEdges (not nodeCount / edgeCount)
    expect(g.stats.totalNodes).toBe(g.nodes.length);
    expect(g.stats.totalEdges).toBe(g.edges.length);
  });

  it("creates a token node when the seed has trust lines via gatewayBalances", () => {
    // trust lines alone don't create token nodes — tokens come from gatewayBalances.obligations
    const crawl: CrawlResult = {
      ...empty,
      gatewayBalances: { obligations: { USD: "1000" } },
      trustLines: [{ account: "rIss", currency: "USD", balance: "100" }],
    };
    const g = buildGraph(crawl, "rSeed", "Seed");
    const tokenNode = g.nodes.find((n) => n.kind === "token");
    expect(tokenNode).toBeDefined();
  });
});
