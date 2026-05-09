import { describe, expect, it, vi } from "vitest";
import { createCrawlerService } from "../../src/services/crawler.service.js";

const stubMarketData = () => ({
  accountInfo: vi.fn().mockResolvedValue({
    result: { account_data: { Account: "rSeed", Domain: "636F726C656E732E696F" } },
  }),
  trustLines: vi.fn().mockResolvedValue({ lines: [] }),
  accountObjects: vi.fn().mockResolvedValue({ result: { account_objects: [] } }),
  accountTransactions: vi.fn().mockResolvedValue({ result: { transactions: [] } }),
  accountNfts: vi.fn().mockResolvedValue({ result: { account_nfts: [] } }),
  accountChannels: vi.fn().mockResolvedValue({ result: { channels: [] } }),
  accountOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
  gatewayBalances: vi.fn().mockResolvedValue({ result: { obligations: {} } }),
  noripple: vi.fn().mockResolvedValue({ result: { problems: [] } }),
  bookOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
  ammByPair: vi.fn().mockResolvedValue({ result: null }),
  ammByAccount: vi.fn().mockResolvedValue({ result: null }),
  nftBuyOffers: vi.fn(),
  nftSellOffers: vi.fn(),
  pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [] } }),
});

describe("crawler.service", () => {
  it("returns a CrawlResult shape with every field populated (defaults if empty)", async () => {
    const md = stubMarketData();
    const svc = createCrawlerService({ marketData: md as never });
    const out = await svc.crawl("rSeed", "Seed Label");
    expect(out.seedAddress).toBe("rSeed");
    expect(out.seedLabel).toBe("Seed Label");
    expect(Array.isArray(out.trustLines)).toBe(true);
    expect(out.topAccounts instanceof Map).toBe(true);
    expect(md.accountInfo).toHaveBeenCalledWith("rSeed");
  });

  it("tolerates a single failed RPC by setting that field to a default and continuing", async () => {
    const md = stubMarketData();
    md.accountTransactions.mockRejectedValueOnce(new Error("rpc timeout"));
    const svc = createCrawlerService({ marketData: md as never });
    const out = await svc.crawl("rSeed", null);
    expect(out.accountTransactions).toEqual([]);
  });
});
