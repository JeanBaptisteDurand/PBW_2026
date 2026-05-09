import { describe, expect, it } from "vitest";
import type { CrawlResult } from "../../src/domain/types.js";
import { pickHubsFromCrawl } from "../../src/services/hub-picker.service.js";

const SEED = "rSeed";

function emptyCrawl(): CrawlResult {
  return {
    seedAddress: SEED,
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

describe("pickHubsFromCrawl", () => {
  it("returns empty list for an empty crawl", () => {
    const out = pickHubsFromCrawl(emptyCrawl(), SEED, new Set([SEED]), 1, 8);
    expect(out).toEqual([]);
  });

  it("picks AMM pool, AMM counter-issuer, top trustline holders, and tx-heavy issuers", () => {
    const crawl = emptyCrawl();
    crawl.ammPool = {
      account: "rAmmPool",
      amount: "1000000",
      amount2: { currency: "USD", issuer: "rCounterIssuer", value: "100" },
    };
    crawl.trustLines = [
      { account: "rHolder1", balance: "5000" },
      { account: "rHolder2", balance: "-3000" },
      { account: "rHolder3", balance: "100" },
      { account: "rHolder4", balance: "10" },
    ];
    crawl.accountTransactions = [
      {
        tx_json: {
          TransactionType: "TrustSet",
          LimitAmount: { currency: "USD", issuer: "rTxIssuerA", value: "1000" },
        },
      },
      {
        tx_json: {
          TransactionType: "Payment",
          Destination: "rDest",
          Amount: { currency: "USD", issuer: "rTxIssuerB", value: "50" },
        },
      },
    ];

    const visited = new Set([SEED]);
    const hubs = pickHubsFromCrawl(crawl, SEED, visited, 1, 20);

    const addresses = hubs.map((h) => h.address);
    expect(addresses).toContain("rAmmPool");
    expect(addresses).toContain("rCounterIssuer");
    expect(addresses).toContain("rTxIssuerA");
    expect(addresses).toContain("rTxIssuerB");
    // Top-3 trustline holders by abs(balance): rHolder1, rHolder2, rHolder3
    expect(addresses).toContain("rHolder1");
    expect(addresses).toContain("rHolder2");
    expect(addresses).toContain("rHolder3");
    // Below top-3 cap
    expect(addresses).not.toContain("rHolder4");

    // Ranking: AMM pool first (rank 0), then counter-issuer (rank 1), then tx-heavy issuers (rank ~2)
    expect(hubs[0]?.address).toBe("rAmmPool");
    expect(hubs[0]?.reason).toBe("amm_pool");
    expect(hubs[1]?.address).toBe("rCounterIssuer");
  });

  it("skips the seed and already-visited addresses", () => {
    const crawl = emptyCrawl();
    crawl.ammPool = { account: SEED }; // self-reference: should be skipped
    crawl.trustLines = [
      { account: "rVisited", balance: "5000" },
      { account: "rFresh", balance: "100" },
    ];
    const visited = new Set([SEED, "rVisited"]);
    const hubs = pickHubsFromCrawl(crawl, SEED, visited, 1, 8);
    const addresses = hubs.map((h) => h.address);
    expect(addresses).not.toContain(SEED);
    expect(addresses).not.toContain("rVisited");
    expect(addresses).toContain("rFresh");
  });

  it("respects topK cap", () => {
    const crawl = emptyCrawl();
    crawl.trustLines = Array.from({ length: 50 }, (_, i) => ({
      account: `rH${i}`,
      balance: String(1000 - i),
    }));
    crawl.accountTransactions = Array.from({ length: 10 }, (_, i) => ({
      tx_json: {
        TransactionType: "TrustSet",
        LimitAmount: { currency: "USD", issuer: `rIss${i}`, value: "1" },
      },
    }));
    const out = pickHubsFromCrawl(crawl, SEED, new Set([SEED]), 1, 3);
    expect(out.length).toBe(3);
  });

  it("is deterministic on rank ties (stable sort by insertion / address)", () => {
    const crawl = emptyCrawl();
    // All three trustline holders share the same rank (6, top_trustline_holder).
    // Different abs balances so the sort order is well-defined upstream.
    crawl.trustLines = [
      { account: "rA", balance: "300" },
      { account: "rB", balance: "200" },
      { account: "rC", balance: "100" },
    ];
    const a = pickHubsFromCrawl(crawl, SEED, new Set([SEED]), 1, 8);
    const b = pickHubsFromCrawl(crawl, SEED, new Set([SEED]), 1, 8);
    expect(a.map((h) => h.address)).toEqual(b.map((h) => h.address));
  });

  it("annotates depth on each picked hub", () => {
    const crawl = emptyCrawl();
    crawl.trustLines = [{ account: "rH", balance: "100" }];
    const out = pickHubsFromCrawl(crawl, SEED, new Set([SEED]), 2, 8);
    expect(out[0]?.depth).toBe(2);
  });
});
