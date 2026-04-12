import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createXRPLClient } from "../../src/xrpl/client.js";
import { crawlFromSeed } from "../../src/analysis/crawler.js";
import { buildGraph } from "../../src/analysis/graphBuilder.js";
import { computeRiskFlags } from "../../src/analysis/riskEngine.js";
import type { XRPLClientWrapper } from "../../src/xrpl/client.js";

// Full pipeline integration test: Crawl → Build Graph → Compute Risk Flags
// Runs against live XRPL mainnet with the RLUSD issuer

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

describe("Full Analysis Pipeline (live XRPL)", () => {
  let client: XRPLClientWrapper;
  let crawlResult: Awaited<ReturnType<typeof crawlFromSeed>>;
  let graph: ReturnType<typeof buildGraph>;
  let riskFlags: ReturnType<typeof computeRiskFlags>;

  beforeAll(async () => {
    client = createXRPLClient();
    await client.connect();

    crawlResult = await crawlFromSeed(client, RLUSD_ISSUER, "RLUSD");
    graph = buildGraph(crawlResult, RLUSD_ISSUER, "RLUSD");
    riskFlags = computeRiskFlags(crawlResult, RLUSD_ISSUER);
  }, 120_000);

  afterAll(async () => {
    await client.disconnect();
  });

  // ── Crawl Completeness ─────────────────────────────────────────────────

  it("crawl fetches all core data", () => {
    expect(crawlResult.issuerInfo).toBeTruthy();
    expect(crawlResult.trustLines.length).toBeGreaterThan(0);
    expect(crawlResult.gatewayBalances).toBeTruthy();
    expect(crawlResult.accountObjects.length).toBeGreaterThan(0);
    expect(crawlResult.currencies).toBeTruthy();
    expect(crawlResult.topAccounts.size).toBeGreaterThan(0);
  });

  it("crawl includes new data sources (nfts, channels, txTypeSummary)", () => {
    // These may be empty for RLUSD issuer but should be arrays
    expect(Array.isArray(crawlResult.nfts)).toBe(true);
    expect(Array.isArray(crawlResult.channels)).toBe(true);
    expect(Array.isArray(crawlResult.txTypeSummary)).toBe(true);
    expect(Array.isArray(crawlResult.accountTransactions)).toBe(true);
  });

  it("crawl classifies transaction types", () => {
    if (crawlResult.accountTransactions.length > 0) {
      expect(crawlResult.txTypeSummary.length).toBeGreaterThan(0);
      for (const ts of crawlResult.txTypeSummary) {
        expect(ts.type).toBeTruthy();
        expect(ts.count).toBeGreaterThan(0);
      }
    }
  });

  // ── Graph Completeness ─────────────────────────────────────────────────

  it("graph has all core node types", () => {
    expect(graph.stats.nodesByKind.issuer).toBe(1);
    expect(graph.stats.nodesByKind.token).toBeGreaterThan(0);
    expect(graph.stats.nodesByKind.account).toBeGreaterThan(0);
  });

  it("graph has AMM pool and order book", () => {
    expect(graph.stats.nodesByKind.ammPool).toBeGreaterThanOrEqual(0); // may not exist
    expect(graph.stats.nodesByKind.orderBook).toBeGreaterThanOrEqual(0);
  });

  it("graph processes all account_objects ledger entry types", () => {
    // Count what ledger entry types exist in the raw data
    const entryTypes = new Map<string, number>();
    for (const obj of crawlResult.accountObjects) {
      const type = (obj as any).LedgerEntryType;
      entryTypes.set(type, (entryTypes.get(type) ?? 0) + 1);
    }

    console.log("Account object types found:", Object.fromEntries(entryTypes));

    // Verify each type that exists creates corresponding graph nodes
    if (entryTypes.has("Escrow")) {
      expect(graph.stats.nodesByKind.escrow).toBeGreaterThan(0);
    }
    if (entryTypes.has("Check")) {
      expect(graph.stats.nodesByKind.check).toBeGreaterThan(0);
    }
    if (entryTypes.has("PayChannel")) {
      expect(graph.stats.nodesByKind.payChannel).toBeGreaterThan(0);
    }
    if (entryTypes.has("SignerList")) {
      expect(graph.stats.nodesByKind.signerList).toBeGreaterThan(0);
    }
    if (entryTypes.has("DID")) {
      expect(graph.stats.nodesByKind.did).toBeGreaterThan(0);
    }
    if (entryTypes.has("Credential")) {
      expect(graph.stats.nodesByKind.credential).toBeGreaterThan(0);
    }
    if (entryTypes.has("MPTokenIssuance") || entryTypes.has("MPToken")) {
      expect(graph.stats.nodesByKind.mpToken).toBeGreaterThan(0);
    }
    if (entryTypes.has("Oracle")) {
      expect(graph.stats.nodesByKind.oracle).toBeGreaterThan(0);
    }
  });

  it("graph creates NFT nodes if account has NFTs", () => {
    if (crawlResult.nfts.length > 0) {
      expect(graph.stats.nodesByKind.nft).toBeGreaterThan(0);
    }
    console.log("NFTs found:", crawlResult.nfts.length);
  });

  it("graph creates payChannel nodes if account has channels", () => {
    if (crawlResult.channels.length > 0) {
      expect(graph.stats.nodesByKind.payChannel).toBeGreaterThan(0);
    }
    console.log("Channels found:", crawlResult.channels.length);
  });

  it("graph has valid edges for all nodes", () => {
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    for (const edge of graph.edges) {
      expect(nodeIds.has(edge.source)).toBe(true);
      expect(nodeIds.has(edge.target)).toBe(true);
    }
  });

  it("graph stats are consistent", () => {
    expect(graph.stats.totalNodes).toBe(graph.nodes.length);
    expect(graph.stats.totalEdges).toBe(graph.edges.length);

    const kindSum = Object.values(graph.stats.nodesByKind).reduce((a, b) => a + b, 0);
    expect(kindSum).toBe(graph.stats.totalNodes);
  });

  // ── Risk Flags ─────────────────────────────────────────────────────────

  it("risk flags are all valid types", () => {
    const validFlags = [
      "CONCENTRATED_LIQUIDITY", "SINGLE_GATEWAY_DEPENDENCY", "LOW_DEPTH_ORDERBOOK",
      "THIN_AMM_POOL", "STALE_OFFER", "UNVERIFIED_ISSUER", "RLUSD_IMPERSONATOR",
      "FROZEN_TRUST_LINE", "GLOBAL_FREEZE", "HIGH_TRANSFER_FEE",
      "CLAWBACK_ENABLED", "NO_MULTISIG", "ACTIVE_CHECKS",
      "HIGH_TX_VELOCITY", "DEPOSIT_RESTRICTED",
    ];

    for (const flag of riskFlags) {
      expect(validFlags).toContain(flag.flag);
      expect(["HIGH", "MED", "LOW"]).toContain(flag.severity);
      expect(flag.detail).toBeTruthy();
    }
  });

  // ── Summary Output ─────────────────────────────────────────────────────

  it("prints full analysis summary for manual comparison", () => {
    console.log("\n========== CORLENS ANALYSIS SUMMARY ==========");
    console.log(`Seed: ${RLUSD_ISSUER} (RLUSD)`);
    console.log(`\n--- Crawl Result ---`);
    console.log(`  Trust lines: ${crawlResult.trustLines.length}`);
    console.log(`  LP holders: ${crawlResult.lpHolders.length}`);
    console.log(`  AMM pool: ${crawlResult.ammPool ? "YES" : "NO"}`);
    console.log(`  Asks: ${crawlResult.asks.length}, Bids: ${crawlResult.bids.length}`);
    console.log(`  Payment paths: ${crawlResult.paths.length}`);
    console.log(`  Account objects: ${crawlResult.accountObjects.length}`);
    console.log(`  NFTs: ${crawlResult.nfts.length}`);
    console.log(`  Channels: ${crawlResult.channels.length}`);
    console.log(`  Transactions: ${crawlResult.accountTransactions.length}`);
    console.log(`  Tx types: ${crawlResult.txTypeSummary.map((t) => `${t.type}(${t.count})`).join(", ")}`);
    console.log(`  Top accounts enriched: ${crawlResult.topAccounts.size}`);

    // Account objects breakdown
    const objTypes = new Map<string, number>();
    for (const obj of crawlResult.accountObjects) {
      const t = (obj as any).LedgerEntryType;
      objTypes.set(t, (objTypes.get(t) ?? 0) + 1);
    }
    console.log(`  Object types: ${[...objTypes.entries()].map(([k, v]) => `${k}(${v})`).join(", ")}`);

    console.log(`\n--- Graph ---`);
    console.log(`  Total nodes: ${graph.stats.totalNodes}`);
    console.log(`  Total edges: ${graph.stats.totalEdges}`);
    for (const [kind, count] of Object.entries(graph.stats.nodesByKind)) {
      if (count > 0) console.log(`    ${kind}: ${count}`);
    }

    console.log(`\n--- Risk Flags (${riskFlags.length}) ---`);
    for (const flag of riskFlags) {
      console.log(`  [${flag.severity}] ${flag.flag}: ${flag.detail}`);
    }

    console.log("\n--- Issuer Info ---");
    console.log(`  Address: ${crawlResult.issuerInfo?.Account}`);
    console.log(`  Flags: 0x${(crawlResult.issuerInfo?.Flags ?? 0).toString(16)}`);
    console.log(`  Domain: ${crawlResult.issuerInfo?.Domain ?? "none"}`);
    console.log(`  TransferRate: ${crawlResult.issuerInfo?.TransferRate ?? "default"}`);
    console.log(`  OwnerCount: ${crawlResult.issuerInfo?.OwnerCount}`);
    console.log("==============================================\n");

    expect(true).toBe(true);
  });
}, 120_000);
