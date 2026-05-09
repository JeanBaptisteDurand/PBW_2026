import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import * as marketDataMod from "../../src/connectors/market-data.js";
import { loadPathEnv } from "../../src/env.js";

const env = loadPathEnv({
  PORT: "3005",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
  WORKER_ENABLED: "false",
});

const SEED = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";

// Stub the marketData client factory so the controller's history.stream()
// path receives deterministic data without ever touching the network.
function buildMockMarketData(): ReturnType<typeof marketDataMod.createMarketDataClient> {
  return {
    accountInfo: vi.fn().mockResolvedValue({ result: { account_data: {} } }),
    trustLines: vi.fn().mockResolvedValue({ lines: [] }),
    accountObjects: vi.fn().mockResolvedValue({ result: { account_objects: [] } }),
    accountTransactions: vi.fn().mockResolvedValue({
      result: {
        transactions: [
          {
            tx_json: {
              TransactionType: "Payment",
              Destination: "rPeerAcctXXXXXXXXXXXXXXXXXXXXXXXXX",
            },
            ledger_index: 1000,
          },
        ],
      },
    }),
    accountNfts: vi.fn().mockResolvedValue({ result: { account_nfts: [] } }),
    accountChannels: vi.fn().mockResolvedValue({ result: { channels: [] } }),
    accountOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
    gatewayBalances: vi.fn().mockResolvedValue({ result: { obligations: {} } }),
    accountCurrencies: vi
      .fn()
      .mockResolvedValue({ result: { send_currencies: [], receive_currencies: [] } }),
    noripple: vi.fn().mockResolvedValue({ result: { problems: [] } }),
    bookOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
    ammByPair: vi.fn().mockResolvedValue({ result: { amm: null } }),
    ammByAccount: vi.fn().mockResolvedValue({ result: { amm: null } }),
    nftBuyOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
    nftSellOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
    pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [] } }),
  };
}

describe("history SSE stream", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    vi.spyOn(marketDataMod, "createMarketDataClient").mockImplementation(() =>
      buildMockMarketData(),
    );
    app = await buildApp(env);
  });

  afterAll(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  it("returns 400 for invalid address", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/history/stream?address=not-an-r-address",
    });
    expect(res.statusCode).toBe(400);
  });

  it("emits SSE frames including a seed_ready event", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/api/history/stream?address=${SEED}&depth=1&maxTx=10&sinceDays=7`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/event-stream");
    expect(res.headers["cache-control"]).toContain("no-cache");
    expect(res.body.startsWith(":")).toBe(true); // initial padding comment
    expect(res.body).toContain("data: ");
    expect(res.body).toContain('"type":"seed_ready"');
    expect(res.body).toContain('"type":"done"');
  });
});
