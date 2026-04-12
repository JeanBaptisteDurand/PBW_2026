// corlens/apps/server/tests/analysis/historyOrchestrator.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { HistoryEvent } from "../../src/analysis/historyTypes.js";

const SEED = "rSeed11111111111111111111111111111";

// Mock the module layer the orchestrator depends on so that the generator
// under test is pure logic. We pass a fakeClient through; it is never used
// directly because the mocked fetchers/crawler ignore it.

vi.mock("../../src/xrpl/fetchers.js", async () => {
  return {
    fetchAccountTransactions: vi.fn(),
    fetchAMMInfo: vi.fn(),
  };
});

vi.mock("../../src/analysis/historyCrawler.js", async () => {
  return {
    crawlFromSeedLight: vi.fn(),
  };
});

import {
  fetchAccountTransactions,
  fetchAMMInfo,
} from "../../src/xrpl/fetchers.js";
import { crawlFromSeedLight } from "../../src/analysis/historyCrawler.js";
import { streamHistory } from "../../src/analysis/historyOrchestrator.js";

const mockFetchTx = vi.mocked(fetchAccountTransactions);
const mockFetchAmm = vi.mocked(fetchAMMInfo);
const mockCrawl = vi.mocked(crawlFromSeedLight);

function paymentTx(to: string, ledger = 1) {
  return {
    ledger_index: ledger,
    close_time_iso: "2026-04-08T12:00:00Z",
    tx_json: {
      TransactionType: "Payment",
      Account: SEED,
      Destination: to,
      Amount: "1000000",
    },
  };
}

function trustTx(issuer: string, ledger = 1) {
  return {
    ledger_index: ledger,
    close_time_iso: "2026-04-08T12:00:00Z",
    tx_json: {
      TransactionType: "TrustSet",
      Account: SEED,
      LimitAmount: { currency: "USD", issuer, value: "100" },
    },
  };
}

const emptyCrawlResult: any = {
  issuerInfo: {},
  trustLines: [],
  gatewayBalances: {},
  ammPool: null,
  lpHolders: [],
  asks: [],
  bids: [],
  paths: [],
  accountObjects: [],
  currencies: {},
  topAccounts: new Map(),
  accountTransactions: [],
  nfts: [],
  channels: [],
  txTypeSummary: [],
  accountOffers: [],
  noripppleProblems: [],
  nftOffers: [],
};

const fakeClient = {} as any;

beforeEach(() => {
  vi.clearAllMocks();
  mockCrawl.mockResolvedValue(emptyCrawlResult);
  mockFetchAmm.mockResolvedValue({});
});

async function collect(gen: AsyncGenerator<HistoryEvent>): Promise<HistoryEvent[]> {
  const out: HistoryEvent[] = [];
  for await (const ev of gen) out.push(ev);
  return out;
}

describe("streamHistory", () => {
  it("emits seed_ready first, then done", async () => {
    mockFetchTx.mockResolvedValue([]);
    const events = await collect(
      streamHistory(fakeClient, SEED, { depth: 1, maxTx: 200, sinceDays: 30 }),
    );
    expect(events[0].type).toBe("seed_ready");
    expect(events[events.length - 1].type).toBe("done");
  });

  it("depth=1 crawls each heavy counterparty once", async () => {
    mockFetchTx.mockResolvedValue([
      trustTx("rIssuer1111111111111111111111111111"),
      trustTx("rIssuer2222222222222222222222222222"),
    ]);
    const events = await collect(
      streamHistory(fakeClient, SEED, { depth: 1, maxTx: 200, sinceDays: 30 }),
    );
    expect(mockCrawl).toHaveBeenCalledTimes(2);
    expect(events.filter((e) => e.type === "node_added").length).toBeGreaterThanOrEqual(2);
  });

  it("depth=2 expands heavies returned from depth=1 crawl", async () => {
    mockFetchTx.mockResolvedValue([trustTx("rIssuerA111111111111111111111111111")]);
    mockCrawl.mockImplementation(async (_c: any, addr: string) => ({
      ...emptyCrawlResult,
      accountTransactions:
        addr === "rIssuerA111111111111111111111111111"
          ? [trustTx("rIssuerB111111111111111111111111111")]
          : [],
    }));
    await collect(
      streamHistory(fakeClient, SEED, { depth: 2, maxTx: 200, sinceDays: 30 }),
    );
    const addrs = mockCrawl.mock.calls.map((c) => c[1]);
    expect(addrs).toContain("rIssuerA111111111111111111111111111");
    expect(addrs).toContain("rIssuerB111111111111111111111111111");
  });

  it("respects maxCrawls cap and sets truncated=true", async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      trustTx(`rIssuer${String(i).padStart(27, "0")}`),
    );
    mockFetchTx.mockResolvedValue(many);
    const events = await collect(
      streamHistory(fakeClient, SEED, {
        depth: 1,
        maxTx: 200,
        sinceDays: 30,
        maxCrawls: 5,
      }),
    );
    expect(mockCrawl).toHaveBeenCalledTimes(5);
    const done = events.find((e) => e.type === "done");
    expect(done && done.type === "done" && done.stats.truncated).toBe(true);
  });

  it("concurrency pool caps in-flight crawls", async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      trustTx(`rIssuer${String(i).padStart(27, "0")}`),
    );
    mockFetchTx.mockResolvedValue(many);
    let inFlight = 0;
    let maxInFlight = 0;
    mockCrawl.mockImplementation(async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return emptyCrawlResult;
    });
    await collect(
      streamHistory(fakeClient, SEED, {
        depth: 1,
        maxTx: 200,
        sinceDays: 30,
        concurrency: 4,
      }),
    );
    expect(maxInFlight).toBeLessThanOrEqual(4);
    expect(maxInFlight).toBeGreaterThan(1);
  });

  it("abort mid-stream stops enqueueing new crawls", async () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      trustTx(`rIssuer${String(i).padStart(27, "0")}`),
    );
    mockFetchTx.mockResolvedValue(many);
    mockCrawl.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 10));
      return emptyCrawlResult;
    });
    const ctrl = new AbortController();
    const gen = streamHistory(fakeClient, SEED, {
      depth: 1,
      maxTx: 200,
      sinceDays: 30,
      signal: ctrl.signal,
    });
    const events: HistoryEvent[] = [];
    for await (const ev of gen) {
      events.push(ev);
      if (ev.type === "seed_ready") ctrl.abort();
    }
    expect(mockCrawl.mock.calls.length).toBeLessThan(20);
  });

  it("emits crawl_error on crawlFromSeed rejection and continues", async () => {
    mockFetchTx.mockResolvedValue([
      trustTx("rBad11111111111111111111111111111111"),
      trustTx("rGood11111111111111111111111111111111"),
    ]);
    mockCrawl.mockImplementation(async (_c: any, addr: string) => {
      if (addr === "rBad11111111111111111111111111111111") {
        throw new Error("boom");
      }
      return emptyCrawlResult;
    });
    const events = await collect(
      streamHistory(fakeClient, SEED, { depth: 1, maxTx: 200, sinceDays: 30 }),
    );
    expect(events.some((e) => e.type === "crawl_error")).toBe(true);
  });
});
