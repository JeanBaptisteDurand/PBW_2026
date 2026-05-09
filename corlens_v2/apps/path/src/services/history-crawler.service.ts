// Lightweight history crawl: 5 parallel RPCs, returns CrawlResult shape.

import type { MarketDataClient } from "../connectors/market-data.js";
import type { CrawlResult } from "../domain/types.js";

const TRUSTLINE_LIGHT_CAP = 60;
const BOOK_OFFERS_LIGHT_CAP = 10;

export type HistoryCrawlerServiceOptions = {
  marketData: MarketDataClient;
};

export type HistoryCrawlerService = ReturnType<typeof createHistoryCrawlerService>;

export function createHistoryCrawlerService(opts: HistoryCrawlerServiceOptions) {
  const md = opts.marketData;

  return {
    async crawlLight(seedAddress: string): Promise<CrawlResult> {
      const [infoResult, txsResult, trustLinesResult, asksResult, bidsResult] =
        await Promise.allSettled([
          md.accountInfo(seedAddress) as Promise<{
            result?: { account_data?: Record<string, unknown> };
          }>,
          md.accountTransactions(seedAddress, { limit: 200 }) as Promise<{
            result?: { transactions?: unknown[] };
          }>,
          md.trustLines(seedAddress, { limit: TRUSTLINE_LIGHT_CAP }) as Promise<{
            lines?: unknown[];
          }>,
          // book_offers with XRP on one side — cheap and good enough to surface
          // the top ask/bid makers for an issuer. Non-issuers just get empty.
          md.bookOffers({
            takerGetsCurrency: "XRP",
            takerPaysCurrency: "USD",
            takerPaysIssuer: seedAddress,
            limit: BOOK_OFFERS_LIGHT_CAP,
          }) as Promise<{ result?: { offers?: unknown[] } }>,
          md.bookOffers({
            takerGetsCurrency: "USD",
            takerGetsIssuer: seedAddress,
            takerPaysCurrency: "XRP",
            limit: BOOK_OFFERS_LIGHT_CAP,
          }) as Promise<{ result?: { offers?: unknown[] } }>,
        ]);

      const issuerInfo =
        infoResult.status === "fulfilled" ? (infoResult.value.result?.account_data ?? null) : null;

      const accountTransactions =
        txsResult.status === "fulfilled" ? (txsResult.value.result?.transactions ?? []) : [];

      const trustLines =
        trustLinesResult.status === "fulfilled" ? (trustLinesResult.value.lines ?? []) : [];

      const asks = asksResult.status === "fulfilled" ? (asksResult.value.result?.offers ?? []) : [];
      const bids = bidsResult.status === "fulfilled" ? (bidsResult.value.result?.offers ?? []) : [];

      return {
        issuerInfo,
        trustLines,
        gatewayBalances: { obligations: {} },
        ammPool: null,
        lpHolders: [],
        asks,
        bids,
        paths: [],
        accountObjects: [],
        currencies: null,
        topAccounts: new Map(),
        accountTransactions,
        nfts: [],
        channels: [],
        txTypeSummary: [],
        accountOffers: [],
        noripppleProblems: [],
        nftOffers: [],
      };
    },
  };
}
