import type { path as pp } from "@corlens/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/app.js";
import * as marketDataMod from "../../src/connectors/market-data.js";
import { loadPathEnv } from "../../src/env.js";
import { createHistoryCrawlerService } from "../../src/services/history-crawler.service.js";
import { createHistoryService } from "../../src/services/history.service.js";

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

describe("history SSE stream (controller)", () => {
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
      url: `/api/history/stream?address=${SEED}&depth=1&maxTx=10`,
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

// Direct orchestrator tests — drive the AsyncGenerator with handcrafted stubs
// so we can assert event order, error paths, and per-task expansion semantics
// without round-tripping through Fastify.
describe("history SSE stream (orchestrator)", () => {
  async function collect(gen: AsyncGenerator<pp.HistoryEvent>): Promise<pp.HistoryEvent[]> {
    const out: pp.HistoryEvent[] = [];
    for await (const ev of gen) out.push(ev);
    return out;
  }

  it("emits a fatal_error and stops when the seed account_tx call rejects", async () => {
    const md = buildMockMarketData();
    md.accountTransactions = vi.fn().mockRejectedValue(new Error("xrpl down"));
    const historyCrawler = createHistoryCrawlerService({ marketData: md });
    const svc = createHistoryService({ marketData: md, historyCrawler });

    const events = await collect(svc.stream(SEED, { depth: 1, maxTx: 10 }));
    const types = events.map((e) => e.type);

    expect(types).toEqual(["fatal_error"]);
    expect(types).not.toContain("seed_ready");
    expect(types).not.toContain("done");
  });

  it("emits crawl_error for a failing hub but still completes with done", async () => {
    const HUB = "rIssuerHubXXXXXXXXXXXXXXXXXXXXXXXX";
    const md = buildMockMarketData();
    md.accountTransactions = vi.fn().mockImplementation(async (addr: string) => {
      if (addr === SEED) {
        return {
          result: {
            transactions: [
              {
                tx_json: {
                  TransactionType: "TrustSet",
                  LimitAmount: { currency: "USD", issuer: HUB, value: "1" },
                },
                ledger_index: 100,
              },
            ],
          },
        };
      }
      return { result: { transactions: [] } };
    });
    const historyCrawler = createHistoryCrawlerService({ marketData: md });
    historyCrawler.crawlLight = vi.fn().mockImplementation(async (addr: string) => {
      if (addr === HUB) throw new Error("rpc fail");
      throw new Error("unexpected crawl call");
    });
    const svc = createHistoryService({ marketData: md, historyCrawler });

    const events = await collect(
      svc.stream(SEED, { depth: 1, maxTx: 10, concurrency: 1, crawlTimeoutMs: 5_000 }),
    );

    const types = events.map((e) => e.type);
    expect(types).toContain("seed_ready");
    expect(types).toContain("crawl_error");
    expect(types).toContain("done");

    const ce = events.find((e) => e.type === "crawl_error");
    if (ce && ce.type === "crawl_error") {
      expect(ce.address).toBe(HUB);
      expect(ce.error).toContain("rpc fail");
    }
  });

  it("emits parent node_added BEFORE expansion children on a heavy-hub crawl", async () => {
    const HUB = "rIssuerHubXXXXXXXXXXXXXXXXXXXXXXXX";
    const HOLDER_A = "rHolderAXXXXXXXXXXXXXXXXXXXXXXXXX";
    const HOLDER_B = "rHolderBXXXXXXXXXXXXXXXXXXXXXXXXX";
    const ASK_MAKER = "rAskMakerXXXXXXXXXXXXXXXXXXXXXXXX";
    const BID_MAKER = "rBidMakerXXXXXXXXXXXXXXXXXXXXXXXX";

    const md = buildMockMarketData();
    md.accountTransactions = vi.fn().mockImplementation(async (addr: string) => {
      if (addr === SEED) {
        return {
          result: {
            transactions: [
              {
                tx_json: {
                  TransactionType: "TrustSet",
                  LimitAmount: { currency: "USD", issuer: HUB, value: "1" },
                },
                ledger_index: 100,
              },
            ],
          },
        };
      }
      return { result: { transactions: [] } };
    });
    const historyCrawler = createHistoryCrawlerService({ marketData: md });
    historyCrawler.crawlLight = vi.fn().mockImplementation(async (addr: string) => {
      if (addr !== HUB) throw new Error(`unexpected crawl: ${addr}`);
      return {
        issuerInfo: { Account: HUB },
        trustLines: [
          { account: HOLDER_A, currency: "USD", balance: "500" },
          { account: HOLDER_B, currency: "USD", balance: "100" },
        ],
        gatewayBalances: { obligations: {} },
        ammPool: null,
        lpHolders: [],
        asks: [{ Account: ASK_MAKER }],
        bids: [{ Account: BID_MAKER }],
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
      };
    });
    const svc = createHistoryService({ marketData: md, historyCrawler });

    const events = await collect(
      svc.stream(SEED, { depth: 1, maxTx: 10, concurrency: 1, crawlTimeoutMs: 5_000 }),
    );

    // High-level event order.
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("seed_ready");
    expect(types[types.length - 1]).toBe("done");

    // Locate the parent (HUB) node_added with crawlStatus="crawled".
    const parentIdx = events.findIndex(
      (e) => e.type === "node_added" && e.node.id === HUB && e.node.crawlStatus === "crawled",
    );
    expect(parentIdx).toBeGreaterThan(-1);

    // Each expansion child must arrive AFTER the parent node_added.
    for (const childId of [HOLDER_A, HOLDER_B, ASK_MAKER, BID_MAKER]) {
      const childIdx = events.findIndex((e) => e.type === "node_added" && e.node.id === childId);
      expect(childIdx).toBeGreaterThan(parentIdx);
    }

    // edges_added for the expansion must arrive AFTER the parent node_added too.
    const expansionEdgesIdx = events.findIndex(
      (e) =>
        e.type === "edges_added" && e.edges.some((ed) => ed.from === HUB && ed.to === HOLDER_A),
    );
    expect(expansionEdgesIdx).toBeGreaterThan(parentIdx);
  });
});
