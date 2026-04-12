import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createXRPLClient } from "../../src/xrpl/client.js";
import type { XRPLClientWrapper } from "../../src/xrpl/client.js";
import { crawlFromSeed } from "../../src/analysis/crawler.js";
import type { CrawlResult } from "../../src/analysis/crawler.js";

// ─── Constants ─────────────────────────────────────────────────────────────

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

// ─── Live XRPL test ────────────────────────────────────────────────────────

describe("crawlFromSeed (live XRPL)", () => {
  let client: XRPLClientWrapper;
  let crawlResult: CrawlResult;

  beforeAll(async () => {
    client = createXRPLClient();
    await client.connect();

    const steps: string[] = [];
    crawlResult = await crawlFromSeed(client, RLUSD_ISSUER, "RLUSD", (step, detail) => {
      steps.push(`${step}${detail ? `: ${detail}` : ""}`);
      console.log(`[progress] ${step}`, detail ?? "");
    });

    console.log("Crawl steps completed:", steps.length);
  }, 120_000);

  afterAll(async () => {
    if (client?.isConnected()) {
      await client.disconnect();
    }
  });

  it("returns issuerInfo with account data", () => {
    expect(crawlResult.issuerInfo).toBeDefined();
    expect(crawlResult.issuerInfo).not.toBeNull();
    expect(crawlResult.issuerInfo.Account).toBe(RLUSD_ISSUER);
  });

  it("returns trust lines (non-empty)", () => {
    expect(Array.isArray(crawlResult.trustLines)).toBe(true);
    expect(crawlResult.trustLines.length).toBeGreaterThan(0);
    console.log(`Trust lines fetched: ${crawlResult.trustLines.length}`);
  });

  it("returns gateway balances with obligations", () => {
    expect(crawlResult.gatewayBalances).toBeDefined();
    expect(crawlResult.gatewayBalances).not.toBeNull();
    // Should have an obligations object
    const obligations = crawlResult.gatewayBalances?.obligations ?? {};
    expect(Object.keys(obligations).length).toBeGreaterThan(0);
    console.log("Obligations:", Object.keys(obligations));
  });

  it("returns ammPool (may be null if no AMM exists for RLUSD)", () => {
    // The RLUSD issuer may or may not have an AMM pool; we just check the field exists
    expect("ammPool" in crawlResult).toBe(true);
    if (crawlResult.ammPool) {
      expect(crawlResult.ammPool.account).toBeDefined();
      console.log(`AMM pool account: ${crawlResult.ammPool.account}`);
    } else {
      console.log("No AMM pool found for RLUSD issuer (expected)");
    }
  });

  it("returns lpHolders array", () => {
    expect(Array.isArray(crawlResult.lpHolders)).toBe(true);
    if (crawlResult.ammPool) {
      console.log(`LP holders fetched: ${crawlResult.lpHolders.length}`);
    }
  });

  it("returns asks array", () => {
    expect(Array.isArray(crawlResult.asks)).toBe(true);
    console.log(`Asks fetched: ${crawlResult.asks.length}`);
  });

  it("returns bids array", () => {
    expect(Array.isArray(crawlResult.bids)).toBe(true);
    console.log(`Bids fetched: ${crawlResult.bids.length}`);
  });

  it("returns currencies data", () => {
    // currencies may be null if the call fails, but the field must exist
    expect("currencies" in crawlResult).toBe(true);
    if (crawlResult.currencies) {
      console.log("Send currencies:", crawlResult.currencies.send_currencies?.length ?? 0);
      console.log("Receive currencies:", crawlResult.currencies.receive_currencies?.length ?? 0);
    }
  });

  it("returns accountObjects array", () => {
    expect(Array.isArray(crawlResult.accountObjects)).toBe(true);
    console.log(`Account objects: ${crawlResult.accountObjects.length}`);
  });

  it("returns topAccounts map", () => {
    expect(crawlResult.topAccounts instanceof Map).toBe(true);
    console.log(`Top accounts enriched: ${crawlResult.topAccounts.size}`);
  });

  it("returns accountTransactions array", () => {
    expect(Array.isArray(crawlResult.accountTransactions)).toBe(true);
  });

  it("all top account entries have account data", () => {
    for (const [address, data] of crawlResult.topAccounts.entries()) {
      expect(data).not.toBeNull();
      expect(data.Account).toBe(address);
    }
  });
});
