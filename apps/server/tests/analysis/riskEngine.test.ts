import { describe, it, expect } from "vitest";
import { computeRiskFlags } from "../../src/analysis/riskEngine.js";
import type { CrawlResult } from "../../src/analysis/crawler.js";

// ─── Mock CrawlResult factory ─────────────────────────────────────────────────

const RLUSD_HEX = "524C555344000000000000000000000000000000";
const CANONICAL_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const POOL_ACCOUNT = "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3";
const HOLDER_1 = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
const HOLDER_2 = "rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe";
const HOLDER_3 = "rN7n3473SaZBCG4dFL83w7PB5AMbg9Bc7H";
const HOLDER_4 = "r4GDFMLGJUKMjNEycLyvMKrXXLNaQDHYF3";

function makeBaseCrawl(overrides: Partial<CrawlResult> = {}): CrawlResult {
  return {
    issuerInfo: {
      Account: CANONICAL_ISSUER,
      Flags: 0,
      Domain: "726970706c652e636f6d", // hex for "ripple.com"
      Balance: "1000000000",
      OwnerCount: 5,
      Sequence: 1,
      TransferRate: 1_000_000_000, // 0% fee
    },
    trustLines: [
      { account: HOLDER_1, currency: RLUSD_HEX, balance: "500" },
      { account: HOLDER_2, currency: RLUSD_HEX, balance: "200" },
    ],
    gatewayBalances: {
      account: CANONICAL_ISSUER,
      obligations: { [RLUSD_HEX]: "1000" },
    },
    ammPool: {
      account: POOL_ACCOUNT,
      amount: "100000000000", // 100,000 XRP in drops
      amount2: { currency: RLUSD_HEX, issuer: CANONICAL_ISSUER, value: "200000" },
      lp_token: { value: "141421.356" },
      trading_fee: 500,
      vote_slots: [],
    },
    lpHolders: [
      { account: HOLDER_1, currency: "03461E52", balance: "30000" },
      { account: HOLDER_2, currency: "03461E52", balance: "10000" },
      { account: HOLDER_3, currency: "03461E52", balance: "1000" },
      { account: HOLDER_4, currency: "03461E52", balance: "421" },
    ],
    asks: [
      { quality: "0.000002", TakerGets: "1000000000", TakerPays: { currency: RLUSD_HEX, value: "2000", issuer: CANONICAL_ISSUER } },
    ],
    bids: [
      { quality: "0.0000019", TakerGets: { currency: RLUSD_HEX, value: "2000", issuer: CANONICAL_ISSUER }, TakerPays: "1050000000" },
    ],
    paths: [{ paths_computed: [[{ currency: "XRP" }]] }],
    accountObjects: [],
    currencies: {
      receive_currencies: [RLUSD_HEX],
      send_currencies: [RLUSD_HEX],
    },
    topAccounts: new Map(),
    accountTransactions: [],
    nfts: [],
    channels: [],
    txTypeSummary: [],
    accountOffers: [],
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeRiskFlags", () => {
  // ── CONCENTRATED_LIQUIDITY ─────────────────────────────────────────────────

  describe("CONCENTRATED_LIQUIDITY", () => {
    it("triggers when top 3 LP holders own > 80% of pool", () => {
      const crawl = makeBaseCrawl({
        lpHolders: [
          { account: HOLDER_1, currency: "LP", balance: "85" },
          { account: HOLDER_2, currency: "LP", balance: "10" },
          { account: HOLDER_3, currency: "LP", balance: "4" },
          { account: HOLDER_4, currency: "LP", balance: "1" },
        ],
      });
      // top 3 = 85+10+4 = 99 out of 100 → 99%
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "CONCENTRATED_LIQUIDITY");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
    });

    it("does NOT trigger when top 3 LP holders own <= 80% of pool", () => {
      const crawl = makeBaseCrawl({
        lpHolders: [
          { account: HOLDER_1, currency: "LP", balance: "30" },
          { account: HOLDER_2, currency: "LP", balance: "25" },
          { account: HOLDER_3, currency: "LP", balance: "20" },
          { account: HOLDER_4, currency: "LP", balance: "25" },
        ],
      });
      // top 3 = 30+25+20 = 75 out of 100 → 75%
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "CONCENTRATED_LIQUIDITY");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when there are no LP holders", () => {
      const crawl = makeBaseCrawl({ lpHolders: [] });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "CONCENTRATED_LIQUIDITY");
      expect(flag).toBeUndefined();
    });
  });

  // ── UNVERIFIED_ISSUER ──────────────────────────────────────────────────────

  describe("UNVERIFIED_ISSUER", () => {
    it("triggers when issuer has no Domain field", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Balance: "1000000000",
          OwnerCount: 5,
          Sequence: 1,
          // no Domain
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "UNVERIFIED_ISSUER");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("LOW");
    });

    it("triggers when issuer Domain is empty string", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "",
          Balance: "1000000000",
          OwnerCount: 5,
          Sequence: 1,
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "UNVERIFIED_ISSUER");
      expect(flag).toBeDefined();
    });

    it("does NOT trigger when issuer has a Domain field", () => {
      const crawl = makeBaseCrawl();
      // Base crawl has Domain set
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "UNVERIFIED_ISSUER");
      expect(flag).toBeUndefined();
    });
  });

  // ── THIN_AMM_POOL ──────────────────────────────────────────────────────────

  describe("THIN_AMM_POOL", () => {
    it("triggers when TVL < $100k (XRP-based pool)", () => {
      const crawl = makeBaseCrawl({
        ammPool: {
          account: POOL_ACCOUNT,
          // 1000 XRP = $2000 at $2/XRP → below $100k
          amount: "1000000000", // 1000 XRP in drops
          amount2: { currency: RLUSD_HEX, issuer: CANONICAL_ISSUER, value: "1000" },
          lp_token: { value: "1000" },
          trading_fee: 500,
          vote_slots: [],
        },
      });
      // TVL = 1000 * 2 + 1000 * 1 = $3000 < $100k
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "THIN_AMM_POOL");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("MED");
      expect((flag!.data as any).tvlUsd).toBeLessThan(100_000);
    });

    it("does NOT trigger when TVL >= $100k", () => {
      const crawl = makeBaseCrawl();
      // Base crawl: 100000 XRP * 2 + 200000 tokens * 1 = $400,000 > $100k
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "THIN_AMM_POOL");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when ammPool is null", () => {
      const crawl = makeBaseCrawl({ ammPool: null });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "THIN_AMM_POOL");
      expect(flag).toBeUndefined();
    });
  });

  // ── HIGH_TRANSFER_FEE ──────────────────────────────────────────────────────

  describe("HIGH_TRANSFER_FEE", () => {
    it("triggers when TransferRate > 1,010,000,000 (> 1% fee)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
          TransferRate: 1_020_000_000, // 2% fee
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TRANSFER_FEE");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("MED");
      expect((flag!.data as any).transferRate).toBe(1_020_000_000);
    });

    it("triggers at exactly 1,010,000,001 (just over 1%)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
          TransferRate: 1_010_000_001,
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TRANSFER_FEE");
      expect(flag).toBeDefined();
    });

    it("does NOT trigger at exactly 1,010,000,000 (= 1% fee — threshold not exceeded)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
          TransferRate: 1_010_000_000, // exactly 1%
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TRANSFER_FEE");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when TransferRate is 0 (default, no fee)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
          TransferRate: 0,
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TRANSFER_FEE");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when TransferRate is 1_000_000_000 (standard, 0% fee)", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TRANSFER_FEE");
      expect(flag).toBeUndefined();
    });
  });

  // ── GLOBAL_FREEZE ──────────────────────────────────────────────────────────

  describe("GLOBAL_FREEZE", () => {
    it("triggers when GlobalFreeze flag is set (0x00400000)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0x00400000,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "GLOBAL_FREEZE");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
    });

    it("does NOT trigger when GlobalFreeze flag is not set", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "GLOBAL_FREEZE");
      expect(flag).toBeUndefined();
    });
  });

  // ── FROZEN_TRUST_LINE ──────────────────────────────────────────────────────

  describe("FROZEN_TRUST_LINE", () => {
    it("triggers when any trust line has freeze: true", () => {
      const crawl = makeBaseCrawl({
        trustLines: [
          { account: HOLDER_1, currency: RLUSD_HEX, balance: "500", freeze: true },
          { account: HOLDER_2, currency: RLUSD_HEX, balance: "200" },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "FROZEN_TRUST_LINE");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
      expect((flag!.data as any).frozenCount).toBe(1);
    });

    it("does NOT trigger when no trust lines are frozen", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "FROZEN_TRUST_LINE");
      expect(flag).toBeUndefined();
    });
  });

  // ── SINGLE_GATEWAY_DEPENDENCY ──────────────────────────────────────────────

  describe("SINGLE_GATEWAY_DEPENDENCY", () => {
    it("triggers when no payment paths and issuer has > 50 trust lines", () => {
      const manyTrustLines = Array.from({ length: 60 }, (_, i) => ({
        account: `rHolder${i}`, currency: RLUSD_HEX, balance: "100",
      }));
      const crawl = makeBaseCrawl({ paths: [], trustLines: manyTrustLines });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "SINGLE_GATEWAY_DEPENDENCY");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
    });

    it("does NOT trigger when payment paths are found", () => {
      const crawl = makeBaseCrawl({
        paths: [{ paths_computed: [[{ currency: "XRP" }]] }],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "SINGLE_GATEWAY_DEPENDENCY");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when no trust lines exist", () => {
      const crawl = makeBaseCrawl({ paths: [], trustLines: [] });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "SINGLE_GATEWAY_DEPENDENCY");
      expect(flag).toBeUndefined();
    });
  });

  // ── RLUSD_IMPERSONATOR ─────────────────────────────────────────────────────

  describe("RLUSD_IMPERSONATOR", () => {
    const FAKE_ISSUER = "rFakeIssuer123456789012345678901234567";

    it("triggers when a non-canonical address issues RLUSD (hex)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: { Account: FAKE_ISSUER, Flags: 0, Balance: "1000000000" },
        gatewayBalances: {
          account: FAKE_ISSUER,
          obligations: { [RLUSD_HEX]: "1000" },
        },
        currencies: {
          receive_currencies: [RLUSD_HEX],
          send_currencies: [RLUSD_HEX],
        },
      });
      const flags = computeRiskFlags(crawl, FAKE_ISSUER);
      const flag = flags.find((f) => f.flag === "RLUSD_IMPERSONATOR");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
    });

    it("does NOT trigger for the canonical RLUSD issuer", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "RLUSD_IMPERSONATOR");
      expect(flag).toBeUndefined();
    });
  });

  // ── LOW_DEPTH_ORDERBOOK ────────────────────────────────────────────────────

  describe("LOW_DEPTH_ORDERBOOK", () => {
    it("triggers when there are no asks and no bids", () => {
      const crawl = makeBaseCrawl({ asks: [], bids: [] });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "LOW_DEPTH_ORDERBOOK");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("MED");
    });

    it("triggers when spread > 2%", () => {
      const crawl = makeBaseCrawl({
        asks: [{ quality: "0.0001" }],  // ask price
        bids: [{ quality: "0.00005" }], // bid price → spread = (0.0001-0.00005)/0.000075 ≈ 66%
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "LOW_DEPTH_ORDERBOOK");
      expect(flag).toBeDefined();
    });

    it("does NOT trigger when spread is within 2%", () => {
      // askPrice = 0.000200, bidPrice = 0.000199 → spread = 0.5%
      const crawl = makeBaseCrawl({
        asks: [{ quality: "0.000200" }],
        bids: [{ quality: "0.000199" }],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "LOW_DEPTH_ORDERBOOK");
      expect(flag).toBeUndefined();
    });
  });

  // ── CLAWBACK_ENABLED ───────────────────────────────────────────────────────

  describe("CLAWBACK_ENABLED", () => {
    it("triggers when AllowTrustLineClawback flag is set", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0x80000000,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "CLAWBACK_ENABLED");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("HIGH");
    });

    it("does NOT trigger without clawback flag", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "CLAWBACK_ENABLED");
      expect(flag).toBeUndefined();
    });
  });

  // ── NO_MULTISIG ───────────────────────────────────────────────────────────

  describe("NO_MULTISIG", () => {
    it("triggers when token issuer has no SignerList", () => {
      const crawl = makeBaseCrawl({ accountObjects: [] });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "NO_MULTISIG");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("LOW");
    });

    it("does NOT trigger when SignerList exists in accountObjects", () => {
      const crawl = makeBaseCrawl({
        accountObjects: [
          { LedgerEntryType: "SignerList", SignerQuorum: 2, SignerEntries: [] },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "NO_MULTISIG");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when signer_lists exists in issuerInfo", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
          signer_lists: [{ SignerQuorum: 2 }],
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "NO_MULTISIG");
      expect(flag).toBeUndefined();
    });
  });

  // ── ACTIVE_CHECKS ─────────────────────────────────────────────────────────

  describe("ACTIVE_CHECKS", () => {
    it("triggers when Check objects exist in accountObjects", () => {
      const crawl = makeBaseCrawl({
        accountObjects: [
          { LedgerEntryType: "Check", Account: CANONICAL_ISSUER, Destination: HOLDER_1, SendMax: "50000000" },
          { LedgerEntryType: "Check", Account: CANONICAL_ISSUER, Destination: HOLDER_2, SendMax: "30000000" },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "ACTIVE_CHECKS");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("MED");
      expect((flag!.data as any).checkCount).toBe(2);
    });

    it("does NOT trigger when no Check objects exist", () => {
      const crawl = makeBaseCrawl({ accountObjects: [] });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "ACTIVE_CHECKS");
      expect(flag).toBeUndefined();
    });
  });

  // ── HIGH_TX_VELOCITY ──────────────────────────────────────────────────────

  describe("HIGH_TX_VELOCITY", () => {
    it("triggers when 200 txs and > 90% are the same type (bot pattern)", () => {
      const txs = Array.from({ length: 200 }, (_, i) => ({
        tx: { TransactionType: "Payment", date: 780000000 + i },
      }));
      const crawl = makeBaseCrawl({ accountTransactions: txs });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TX_VELOCITY");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("MED");
    });

    it("does NOT trigger with < 200 transactions", () => {
      const txs = Array.from({ length: 150 }, (_, i) => ({
        tx: { TransactionType: "Payment", date: 780000000 + i },
      }));
      const crawl = makeBaseCrawl({ accountTransactions: txs });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TX_VELOCITY");
      expect(flag).toBeUndefined();
    });

    it("does NOT trigger when 200 txs but diverse types (< 90% dominant)", () => {
      const txs = [
        ...Array.from({ length: 160 }, (_, i) => ({
          tx: { TransactionType: "Payment", date: 780000000 + i },
        })),
        ...Array.from({ length: 40 }, (_, i) => ({
          tx: { TransactionType: "TrustSet", date: 780000000 + i },
        })),
      ];
      const crawl = makeBaseCrawl({ accountTransactions: txs });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "HIGH_TX_VELOCITY");
      expect(flag).toBeUndefined();
    });
  });

  // ── DEPOSIT_RESTRICTED ────────────────────────────────────────────────────

  describe("DEPOSIT_RESTRICTED", () => {
    it("triggers when DepositAuth flag is set", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0x01000000,
          Domain: "726970706c652e636f6d",
          Balance: "1000000000",
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "DEPOSIT_RESTRICTED");
      expect(flag).toBeDefined();
      expect(flag!.severity).toBe("LOW");
    });

    it("does NOT trigger without DepositAuth flag", () => {
      const crawl = makeBaseCrawl();
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const flag = flags.find((f) => f.flag === "DEPOSIT_RESTRICTED");
      expect(flag).toBeUndefined();
    });
  });

  // ── General ────────────────────────────────────────────────────────────────

  it("returns an empty array when no risk conditions are met", () => {
    // Craft a crawl with healthy conditions
    const crawl: CrawlResult = {
      issuerInfo: {
        Account: CANONICAL_ISSUER,
        Flags: 0,
        Domain: "726970706c652e636f6d",
        Balance: "10000000000",
        TransferRate: 1_000_000_000, // 0% fee
        RegularKey: "rSomeRegularKey1234567890", // has regular key → no NO_REGULAR_KEY
      },
      trustLines: [
        { account: HOLDER_1, currency: RLUSD_HEX, balance: "500" },
        { account: HOLDER_2, currency: RLUSD_HEX, balance: "500" },
      ],
      gatewayBalances: {
        obligations: { USD: "1000" }, // not RLUSD hex
      },
      ammPool: {
        account: POOL_ACCOUNT,
        amount: "100000000000", // 100000 XRP → $200,000 TVL
        amount2: { currency: "USD", issuer: CANONICAL_ISSUER, value: "200000" },
        lp_token: { value: "141421" },
        trading_fee: 500,
        vote_slots: [],
      },
      lpHolders: [
        { account: HOLDER_1, currency: "LP", balance: "40" },
        { account: HOLDER_2, currency: "LP", balance: "30" },
        { account: HOLDER_3, currency: "LP", balance: "20" },
        { account: HOLDER_4, currency: "LP", balance: "10" },
      ],
      // top 3 = 40+30+20 = 90 out of 100 → wait, that's > 80%! Use even distribution:
      asks: [{ quality: "0.000200" }],
      bids: [{ quality: "0.000199" }],
      paths: [{ paths_computed: [] }],
      accountObjects: [
        { LedgerEntryType: "SignerList", SignerQuorum: 2, SignerEntries: [{ SignerEntry: { Account: HOLDER_1, SignerWeight: 1 } }] },
      ],
      currencies: { receive_currencies: ["USD"], send_currencies: ["USD"] },
      topAccounts: new Map(),
      accountTransactions: [],
      nfts: [],
      channels: [],
      txTypeSummary: [],
      accountOffers: [],
    };
    // Adjust LP holders to < 80%
    crawl.lpHolders = [
      { account: HOLDER_1, currency: "LP", balance: "25" },
      { account: HOLDER_2, currency: "LP", balance: "25" },
      { account: HOLDER_3, currency: "LP", balance: "25" },
      { account: HOLDER_4, currency: "LP", balance: "25" },
    ];

    const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
    // No flag should be triggered
    // (UNVERIFIED_ISSUER - has domain, HIGH_TRANSFER_FEE - 0%, GLOBAL_FREEZE - not set,
    //  CONCENTRATED_LIQUIDITY - 75% < 80%, THIN_AMM_POOL - TVL > $100k,
    //  SINGLE_GATEWAY_DEPENDENCY - has paths, FROZEN_TRUST_LINE - none,
    //  LOW_DEPTH_ORDERBOOK - tight spread, RLUSD_IMPERSONATOR - canonical issuer)
    expect(flags).toHaveLength(0);
  });

  // ── DEEP_FROZEN_TRUST_LINE (XLS-77) ──────────────────────────────────────
  describe("DEEP_FROZEN_TRUST_LINE (XLS-77)", () => {
    it("triggers when a RippleState has lsfLowDeepFreeze (0x02000000) set", () => {
      const crawl = makeBaseCrawl({
        accountObjects: [
          {
            LedgerEntryType: "RippleState",
            Flags: 0x02000000, // lsfLowDeepFreeze
            HighLimit: { issuer: CANONICAL_ISSUER },
            LowLimit: { issuer: HOLDER_1 },
          },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const deepFrozen = flags.find((f) => f.flag === "DEEP_FROZEN_TRUST_LINE");
      expect(deepFrozen).toBeDefined();
      expect(deepFrozen?.severity).toBe("HIGH");
      expect(deepFrozen?.data?.xlsAmendment).toBe("XLS-77");
      expect(deepFrozen?.data?.deepFrozenCount).toBe(1);
    });

    it("triggers when a RippleState has lsfHighDeepFreeze (0x04000000) set", () => {
      const crawl = makeBaseCrawl({
        accountObjects: [
          {
            LedgerEntryType: "RippleState",
            Flags: 0x04000000,
            HighLimit: { issuer: CANONICAL_ISSUER },
            LowLimit: { issuer: HOLDER_1 },
          },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      expect(flags.find((f) => f.flag === "DEEP_FROZEN_TRUST_LINE")).toBeDefined();
    });

    it("triggers from parsed account_lines.deep_freeze booleans (newer xrpl.js)", () => {
      const crawl = makeBaseCrawl({
        trustLines: [
          { account: HOLDER_1, currency: RLUSD_HEX, balance: "500", deep_freeze: true },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      expect(flags.find((f) => f.flag === "DEEP_FROZEN_TRUST_LINE")).toBeDefined();
    });

    it("does not trigger for a regular freeze only (no deep freeze bit)", () => {
      const crawl = makeBaseCrawl({
        trustLines: [
          { account: HOLDER_1, currency: RLUSD_HEX, balance: "500", freeze: true },
        ],
        accountObjects: [
          {
            LedgerEntryType: "RippleState",
            Flags: 0x00400000, // lsfLowFreeze (normal), NOT deep freeze
            HighLimit: { issuer: CANONICAL_ISSUER },
            LowLimit: { issuer: HOLDER_1 },
          },
        ],
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      expect(flags.find((f) => f.flag === "DEEP_FROZEN_TRUST_LINE")).toBeUndefined();
      // Regular FROZEN_TRUST_LINE should still fire
      expect(flags.find((f) => f.flag === "FROZEN_TRUST_LINE")).toBeDefined();
    });
  });

  // ── AMM_CLAWBACK_EXPOSURE (XLS-73) ───────────────────────────────────────
  describe("AMM_CLAWBACK_EXPOSURE (XLS-73)", () => {
    it("triggers on a pool whose non-XRP asset issuer has AllowClawback set (seed is issuer)", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0x80000000, // lsfAllowTrustLineClawback on the seed issuer
          Domain: "726970706c652e636f6d",
          TransferRate: 1_000_000_000,
        },
        ammPool: {
          account: POOL_ACCOUNT,
          amount: "100000000000",
          amount2: { currency: RLUSD_HEX, issuer: CANONICAL_ISSUER, value: "200000" },
          lp_token: { value: "1" },
          trading_fee: 500,
          vote_slots: [],
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const clawback = flags.find((f) => f.flag === "AMM_CLAWBACK_EXPOSURE");
      expect(clawback).toBeDefined();
      expect(clawback?.severity).toBe("HIGH");
      expect(clawback?.data?.xlsAmendment).toBe("XLS-73");
      expect(clawback?.data?.poolAccount).toBe(POOL_ACCOUNT);
    });

    it("triggers when an external pool asset issuer has AllowClawback (via topAccounts)", () => {
      const EXTERNAL_ISSUER = "rExtern1IssuerXXXXXXXXXXXXXXXXXXXXX";
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          TransferRate: 1_000_000_000,
        },
        ammPool: {
          account: POOL_ACCOUNT,
          amount: "100000000000",
          amount2: { currency: "USD", issuer: EXTERNAL_ISSUER, value: "1" },
          lp_token: { value: "1" },
          trading_fee: 500,
          vote_slots: [],
        },
        topAccounts: new Map([
          [EXTERNAL_ISSUER, { Account: EXTERNAL_ISSUER, Flags: 0x80000000 }],
        ]),
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      const clawback = flags.find((f) => f.flag === "AMM_CLAWBACK_EXPOSURE");
      expect(clawback).toBeDefined();
      expect((clawback?.data?.exposedAssets as any[])[0].issuer).toBe(EXTERNAL_ISSUER);
    });

    it("does NOT trigger for pool with no clawback-enabled issuers", () => {
      const crawl = makeBaseCrawl({
        issuerInfo: {
          Account: CANONICAL_ISSUER,
          Flags: 0,
          Domain: "726970706c652e636f6d",
          TransferRate: 1_000_000_000,
        },
      });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      expect(flags.find((f) => f.flag === "AMM_CLAWBACK_EXPOSURE")).toBeUndefined();
    });

    it("does NOT trigger when there is no AMM pool", () => {
      const crawl = makeBaseCrawl({ ammPool: null });
      const flags = computeRiskFlags(crawl, CANONICAL_ISSUER);
      expect(flags.find((f) => f.flag === "AMM_CLAWBACK_EXPOSURE")).toBeUndefined();
    });
  });
});
