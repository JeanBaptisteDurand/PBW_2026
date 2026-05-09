import { describe, expect, it } from "vitest";
import { computeRiskFlags } from "../../src/domain/risk-engine.js";
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

describe("computeRiskFlags", () => {
  it("returns an empty array for a minimal crawl", () => {
    // A null issuerInfo has no Domain so UNVERIFIED_ISSUER fires.
    // All other checks are guarded by their conditions.
    const flags = computeRiskFlags(empty, "rSeed");
    const flagNames = flags.map((f) => f.flag);
    expect(flagNames).toContain("UNVERIFIED_ISSUER");
    // No other flags should fire
    const unexpected = flagNames.filter((f) => f !== "UNVERIFIED_ISSUER");
    expect(unexpected).toEqual([]);
  });

  it("emits FROZEN_TRUST_LINE when trust lines have freeze flags", () => {
    const crawl: CrawlResult = {
      ...empty,
      trustLines: [{ account: "rIss", currency: "USD", balance: "100", freeze: true }],
    };
    const flags = computeRiskFlags(crawl, "rSeed");
    const frozen = flags.find((f) => f.flag === "FROZEN_TRUST_LINE");
    expect(frozen).toBeDefined();
    expect(frozen?.severity).toBe("HIGH");
  });
});
