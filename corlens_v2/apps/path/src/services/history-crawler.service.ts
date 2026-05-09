// Lightweight crawler tailored to the /history page. Issues only the 5 RPCs
// the history page actually consumes (account_info, account_tx, trust_lines,
// book_offers asks, book_offers bids), in parallel via Promise.allSettled,
// and returns a CrawlResult-shaped object so the orchestrator does not need
// to branch. Ported from v1 corlens/apps/server/src/analysis/historyCrawler.ts.
//
// v2 simplification vs. v1: the marketData connector does not expose the
// `sinceUnixTime` / `apiVersion` knobs of fetchAccountTransactions, so the
// light crawler ignores those (uses `limit: 200`). The history page never
// relies on them — date filtering happens upstream in the orchestrator's seed
// fetch via `ledgerIndexMin`.

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
          // book_offers with XRP on one side — cheap and good enough to
          // surface the top ask/bid makers for an issuer. If the account is
          // not an issuer the call still succeeds with an empty offers array.
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

      // Produce a CrawlResult-compatible shape. Everything the history page
      // does not consume defaults to empty so the orchestrator (and any
      // accidental reuse) sees a valid object.
      return {
        issuerInfo,
        trustLines: trustLines as unknown[],
        gatewayBalances: { obligations: {} },
        ammPool: null,
        lpHolders: [],
        asks: asks as unknown[],
        bids: bids as unknown[],
        paths: [],
        accountObjects: [],
        currencies: null,
        topAccounts: new Map(),
        accountTransactions: accountTransactions as unknown[],
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
