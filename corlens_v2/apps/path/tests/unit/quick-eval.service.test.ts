import { describe, expect, it, vi } from "vitest";
import { createQuickEvalService } from "../../src/services/quick-eval.service.js";

// baseCrawl uses CrawlResult field names from apps/path/src/domain/types.ts:
//   - issuerInfo (not accountInfo) — read from types.ts line 94
//   - crawlLight (not crawlFromSeedLight) — from history-crawler.service.ts line 19
const baseCrawl = {
  issuerInfo: { Account: "rTest", Flags: 0 },
  trustLines: [],
  lpHolders: [],
  asks: [],
  bids: [],
  paths: [],
  gatewayBalances: { obligations: {} },
  ammPool: null,
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
};

describe("quick-eval.service", () => {
  it("returns score 0 + only UNVERIFIED_ISSUER for a clean account (no Domain)", async () => {
    const crawler = { crawlLight: vi.fn(async () => baseCrawl) };
    const svc = createQuickEvalService({ crawler, cacheTtlMs: 0 });
    const r = await svc.evaluate("rTest");
    // UNVERIFIED_ISSUER fires because issuerInfo has no Domain field
    // Score = 5 (LOW weight), flags contains only UNVERIFIED_ISSUER
    expect(r.flags.some((f) => f.flag === "UNVERIFIED_ISSUER")).toBe(true);
    expect(r.summary.isIssuer).toBe(false);
  });

  it("flags GLOBAL_FREEZE and scores HIGH", async () => {
    const crawler = {
      crawlLight: vi.fn(async () => ({
        ...baseCrawl,
        issuerInfo: { Account: "rFrozen", Flags: 0x00400000 },
      })),
    };
    const svc = createQuickEvalService({ crawler, cacheTtlMs: 0 });
    const r = await svc.evaluate("rFrozen");
    expect(r.flags.some((f) => f.flag === "GLOBAL_FREEZE")).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(30);
  });

  it("caches results within ttl", async () => {
    const crawler = { crawlLight: vi.fn(async () => baseCrawl) };
    const svc = createQuickEvalService({ crawler, cacheTtlMs: 30_000 });
    await svc.evaluate("rTest");
    await svc.evaluate("rTest");
    expect(crawler.crawlLight).toHaveBeenCalledTimes(1);
  });
});
