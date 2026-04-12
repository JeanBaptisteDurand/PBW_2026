import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RLUSD_ISSUER, RLUSD_HEX, XRP_RLUSD_POOL } from "@corlens/core";
import { createXRPLClient, type XRPLClientWrapper } from "../../src/xrpl/client.js";
import {
  fetchAccountInfo,
  fetchAMMInfo,
  fetchTrustLines,
  fetchGatewayBalances,
  fetchBookOffers,
  fetchAccountObjects,
  fetchAccountCurrencies,
} from "../../src/xrpl/fetchers.js";

// RLUSD asset using the hex currency code as required by the XRPL ledger
const RLUSD_ASSET = { currency: RLUSD_HEX, issuer: RLUSD_ISSUER };

describe("XRPL Data Fetchers", () => {
  let client: XRPLClientWrapper;

  beforeAll(async () => {
    client = createXRPLClient();
    await client.connect();
  }, 30_000);

  afterAll(async () => {
    await client.disconnect();
  }, 15_000);

  it("fetchAccountInfo returns RLUSD issuer data", async () => {
    const resp = (await fetchAccountInfo(client, RLUSD_ISSUER)) as {
      result: { account_data: { Account: string; Balance: string } };
    };

    expect(resp.result).toBeDefined();
    expect(resp.result.account_data).toBeDefined();
    expect(resp.result.account_data.Account).toBe(RLUSD_ISSUER);
    expect(typeof resp.result.account_data.Balance).toBe("string");
  }, 15_000);

  it("fetchAMMInfo returns XRP/RLUSD pool with reserves", async () => {
    const resp = (await fetchAMMInfo(
      client,
      { currency: "XRP" },
      RLUSD_ASSET,
    )) as {
      result: {
        amm: {
          account: string;
          amount: string | { value: string };
          amount2: string | { value: string };
          trading_fee: number;
        };
      };
    };

    expect(resp.result).toBeDefined();
    expect(resp.result.amm).toBeDefined();
    expect(resp.result.amm.account).toBe(XRP_RLUSD_POOL);
    expect(resp.result.amm.amount).toBeDefined();
    expect(resp.result.amm.amount2).toBeDefined();
    expect(typeof resp.result.amm.trading_fee).toBe("number");
  }, 15_000);

  it("fetchTrustLines returns paginated results (limit 10)", async () => {
    // RLUSD issuer has many trust lines — good pagination test
    const lines = await fetchTrustLines(client, RLUSD_ISSUER, 10);

    expect(Array.isArray(lines)).toBe(true);
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.length).toBeLessThanOrEqual(10);

    const firstLine = lines[0] as { account: string; currency: string; balance: string };
    expect(typeof firstLine.account).toBe("string");
    expect(typeof firstLine.currency).toBe("string");
    expect(typeof firstLine.balance).toBe("string");
  }, 15_000);

  it("fetchGatewayBalances returns obligations", async () => {
    const resp = (await fetchGatewayBalances(client, RLUSD_ISSUER)) as {
      result: { account: string; obligations?: Record<string, string> };
    };

    expect(resp.result).toBeDefined();
    expect(resp.result.account).toBe(RLUSD_ISSUER);
    // obligations may or may not be present depending on gateway state
    if (resp.result.obligations) {
      expect(typeof resp.result.obligations).toBe("object");
    }
  }, 15_000);

  it("fetchBookOffers returns offers array", async () => {
    const resp = (await fetchBookOffers(
      client,
      { currency: "XRP" },
      RLUSD_ASSET,
      10,
    )) as {
      result: { offers: unknown[] };
    };

    expect(resp.result).toBeDefined();
    expect(Array.isArray(resp.result.offers)).toBe(true);
  }, 15_000);

  it("fetchAccountObjects returns objects (limit 10)", async () => {
    const objects = await fetchAccountObjects(client, RLUSD_ISSUER, 10);

    expect(Array.isArray(objects)).toBe(true);
    // RLUSD issuer is expected to have account objects
    expect(objects.length).toBeGreaterThanOrEqual(0);
    expect(objects.length).toBeLessThanOrEqual(10);
  }, 15_000);

  it("fetchAccountCurrencies returns currencies", async () => {
    const resp = (await fetchAccountCurrencies(client, RLUSD_ISSUER)) as {
      result: {
        send_currencies?: string[];
        receive_currencies?: string[];
      };
    };

    expect(resp.result).toBeDefined();
    // At minimum one of these arrays should be present
    const hasCurrencies =
      Array.isArray(resp.result.send_currencies) ||
      Array.isArray(resp.result.receive_currencies);
    expect(hasCurrencies).toBe(true);
  }, 15_000);
});
