import type { MarketDataClient } from "../connectors/market-data.js";
import type { CrawlResult } from "../domain/types.js";

export type CrawlerServiceOptions = {
  marketData: MarketDataClient;
};

export type CrawlerService = ReturnType<typeof createCrawlerService>;

export function createCrawlerService(opts: CrawlerServiceOptions) {
  return {
    async crawl(seedAddress: string, seedLabel: string | null): Promise<CrawlResult> {
      const md = opts.marketData;
      const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
      };

      const accountInfo = await safe(() => md.accountInfo(seedAddress) as Promise<Record<string, unknown>>, {} as Record<string, unknown>);
      const trustLinesRaw = await safe(() => md.trustLines(seedAddress, { limit: 2000 }) as Promise<{ lines?: unknown[] }>, { lines: [] });
      const accountObjects = await safe(() => md.accountObjects(seedAddress) as Promise<{ result?: { account_objects?: unknown[] } }>, { result: { account_objects: [] } });
      const accountTxs = await safe(() => md.accountTransactions(seedAddress, { limit: 200 }) as Promise<{ result?: { transactions?: unknown[] } }>, { result: { transactions: [] } });
      const nfts = await safe(() => md.accountNfts(seedAddress) as Promise<{ result?: { account_nfts?: unknown[] } }>, { result: { account_nfts: [] } });
      const channels = await safe(() => md.accountChannels(seedAddress) as Promise<{ result?: { channels?: unknown[] } }>, { result: { channels: [] } });
      const offers = await safe(() => md.accountOffers(seedAddress) as Promise<{ result?: { offers?: unknown[] } }>, { result: { offers: [] } });
      const gateway = await safe(() => md.gatewayBalances(seedAddress) as Promise<{ result?: { obligations?: Record<string, unknown> } }>, { result: { obligations: {} } });
      const noripple = await safe(() => md.noripple(seedAddress) as Promise<{ result?: { problems?: unknown[] } }>, { result: { problems: [] } });

      const obligations = (gateway.result?.obligations ?? {}) as Record<string, unknown>;
      const isIssuer = Object.keys(obligations).length > 0;
      const primaryCurrency = isIssuer ? Object.keys(obligations)[0] ?? null : null;

      const txs = (accountTxs.result?.transactions ?? []) as Array<{ tx_json?: { TransactionType?: string }; tx?: { TransactionType?: string } }>;
      const txTypeSummary: Record<string, number> = {};
      for (const t of txs) {
        const type = t.tx_json?.TransactionType ?? t.tx?.TransactionType ?? "Unknown";
        txTypeSummary[type] = (txTypeSummary[type] ?? 0) + 1;
      }

      const ammPool = await safe(() => md.ammByAccount(seedAddress) as Promise<{ result?: unknown }>, { result: null });

      return {
        seedAddress,
        seedLabel,
        primaryCurrency,
        isIssuer,
        issuerInfo: accountInfo,
        trustLines: trustLinesRaw.lines ?? [],
        gatewayBalances: gateway.result ?? null,
        ammPool: ammPool.result ?? null,
        lpHolders: [],
        asks: [],
        bids: [],
        paths: [],
        accountObjects: accountObjects.result?.account_objects ?? [],
        currencies: gateway.result ?? { obligations: {} },
        topAccounts: new Map<string, unknown>(),
        accountTransactions: txs,
        nfts: nfts.result?.account_nfts ?? [],
        channels: channels.result?.channels ?? [],
        txTypeSummary,
        accountOffers: offers.result?.offers ?? [],
        noripppleProblems: noripple.result?.problems ?? [],
        nftOffers: [],
      };
    },
  };
}
