import { describe, expect, it } from "vitest";
import { decodeCurrencyLike, expandCrawlResult } from "../../src/domain/history-expansion.js";
import type { CrawlResult } from "../../src/domain/types.js";

function emptyCrawl(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    issuerInfo: null,
    trustLines: [],
    gatewayBalances: { obligations: {} },
    ammPool: null,
    lpHolders: [],
    asks: [],
    bids: [],
    paths: [],
    accountObjects: [],
    currencies: null,
    topAccounts: new Map(),
    accountTransactions: [],
    nfts: [],
    channels: [],
    txTypeSummary: [],
    accountOffers: [],
    noripppleProblems: [],
    nftOffers: [],
    ...overrides,
  };
}

describe("expandCrawlResult", () => {
  it("keeps the top N trustline holders by abs(balance) and labels with currency", () => {
    const trustLines = Array.from({ length: 15 }, (_, i) => ({
      account: `rHolder${i}`,
      currency: "USD",
      balance: i % 2 === 0 ? `${i * 100}` : `-${i * 100}`,
    }));
    const result = emptyCrawl({ trustLines });

    const { nodes, edges } = expandCrawlResult("rIssuer", result, 1);

    expect(nodes).toHaveLength(10);
    expect(edges).toHaveLength(10);
    expect(edges[0]?.txType).toBe("Trusts USD");
    // Highest balance (rHolder14, |1400|) should be present.
    expect(nodes.some((n) => n.id === "rHolder14")).toBe(true);
    // Children inherit parent depth and link via parentId.
    expect(nodes[0]?.parentId).toBe("rIssuer");
    expect(nodes[0]?.depth).toBe(1);
    expect(nodes[0]?.crawlStatus).toBe("skipped");
  });

  it("returns no LP-holder children when lpHolders is empty (non-AMM crawl)", () => {
    const result = emptyCrawl({ lpHolders: [] });
    const { nodes, edges } = expandCrawlResult("rNonAmm", result, 1);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });

  it("dedupes asks/bids when the same Account appears on both sides", () => {
    const result = emptyCrawl({
      asks: [{ Account: "rMakerA" }, { Account: "rMakerB" }],
      bids: [{ Account: "rMakerA" }, { Account: "rMakerC" }],
    });
    const { nodes, edges } = expandCrawlResult("rIssuer", result, 1);
    // rMakerA appears once as a node (edge dedupe is per (parent,peer,txType));
    // ask edge and bid edge are distinct because txType differs.
    const ids = nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["rMakerA", "rMakerB", "rMakerC"]);
    const edgeIds = edges.map((e) => e.id);
    expect(edgeIds).toContain("rIssuer->rMakerA:Offer (ask)");
    expect(edgeIds).toContain("rIssuer->rMakerA:Offer (bid)");
    // No duplicate edge ids.
    expect(new Set(edgeIds).size).toBe(edgeIds.length);
  });

  it("skips peers equal to the crawled address", () => {
    const result = emptyCrawl({
      trustLines: [{ account: "rSelf", currency: "USD", balance: "100" }],
    });
    const { nodes, edges } = expandCrawlResult("rSelf", result, 1);
    expect(nodes).toHaveLength(0);
    expect(edges).toHaveLength(0);
  });
});

describe("decodeCurrencyLike", () => {
  it("returns 3-letter ISO codes unchanged", () => {
    expect(decodeCurrencyLike("USD")).toBe("USD");
    expect(decodeCurrencyLike("XRP")).toBe("XRP");
  });

  it("decodes printable hex codes to ASCII", () => {
    // "DOGE" hex-padded to 40 chars (20 bytes).
    const hex = `444F4745${"0".repeat(40 - 8)}`;
    expect(decodeCurrencyLike(hex)).toBe("DOGE");
  });

  it("falls back to the raw prefix for non-printable hex", () => {
    const hex = "0".repeat(40);
    expect(decodeCurrencyLike(hex)).toBe("000000");
  });

  it("returns ? for non-string or empty input", () => {
    expect(decodeCurrencyLike(null)).toBe("?");
    expect(decodeCurrencyLike("")).toBe("?");
    expect(decodeCurrencyLike(42)).toBe("?");
  });
});
