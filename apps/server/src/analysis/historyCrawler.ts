// xrplens/apps/server/src/analysis/historyCrawler.ts
//
// Lightweight crawler tailored to the /history page. The canonical
// crawlFromSeed() (analysis/crawler.ts) runs 18 sequential RPC calls,
// several of which are slow for large accounts:
//
//   - trust_lines paginated up to 2000 (2-5 s for big issuers)
//   - ripple_path_find (5-30 s, the main killer)
//   - account_objects paginated up to 1000 (2-5 s)
//   - a sequential account_info enrich of the top 20 holders (2-4 s)
//
// For the history page we only consume two things from the result:
//   1. accountTransactions      — drives BFS into the next depth
//   2. trustLines / asks / bids — drive the satellite expansion halo
//
// Everything else (payment paths, account objects, NFT offers, noripple
// check, currencies, enrichment, risk engine) is dead weight that caused
// crawl timeouts on RLUSD, Bitstamp, Sologenic, etc. This file issues
// only the calls the history page actually needs, in parallel, and
// returns the same CrawlResult shape so the orchestrator doesn't need
// to branch.
//
// Expected wall time per call: < 3 s for large accounts.

import type { XRPLClientWrapper } from "../xrpl/client.js";
import {
  fetchAccountInfo,
  fetchAccountTransactions,
  fetchTrustLines,
  fetchBookOffers,
} from "../xrpl/fetchers.js";
import type { CrawlResult } from "./crawler.js";
import { logger } from "../logger.js";

const TRUSTLINE_LIGHT_CAP = 60;
const BOOK_OFFERS_LIGHT_CAP = 10;

export async function crawlFromSeedLight(
  client: XRPLClientWrapper,
  seedAddress: string,
): Promise<CrawlResult> {
  // Kick everything off in parallel. Promise.allSettled so any one slow or
  // failing call is isolated and the rest still return useful data.
  const [infoResult, txsResult, trustLinesResult, asksResult, bidsResult] =
    await Promise.allSettled([
      fetchAccountInfo(client, seedAddress),
      fetchAccountTransactions(client, seedAddress, { limit: 200 }),
      fetchTrustLines(client, seedAddress, TRUSTLINE_LIGHT_CAP),
      // book_offers with XRP on one side — cheap and good enough to surface
      // the top ask/bid makers for an issuer. If the account is not an
      // issuer the call still succeeds with an empty offers array.
      fetchBookOffers(
        client,
        { currency: "XRP" },
        { currency: "USD", issuer: seedAddress },
        BOOK_OFFERS_LIGHT_CAP,
      ),
      fetchBookOffers(
        client,
        { currency: "USD", issuer: seedAddress },
        { currency: "XRP" },
        BOOK_OFFERS_LIGHT_CAP,
      ),
    ]);

  const issuerInfo =
    infoResult.status === "fulfilled"
      ? ((infoResult.value as any)?.result?.account_data ?? null)
      : null;

  const accountTransactions: any[] =
    txsResult.status === "fulfilled" ? (txsResult.value as any[]) : [];

  const trustLines: any[] =
    trustLinesResult.status === "fulfilled"
      ? (trustLinesResult.value as any[])
      : [];

  const asks: any[] =
    asksResult.status === "fulfilled"
      ? ((asksResult.value as any)?.result?.offers ?? [])
      : [];
  const bids: any[] =
    bidsResult.status === "fulfilled"
      ? ((bidsResult.value as any)?.result?.offers ?? [])
      : [];

  // Record any individual failures at debug level so operators can see
  // patterns without polluting warn/error logs during normal runs.
  for (const [name, r] of [
    ["account_info", infoResult],
    ["account_tx", txsResult],
    ["trust_lines", trustLinesResult],
    ["book_offers asks", asksResult],
    ["book_offers bids", bidsResult],
  ] as const) {
    if (r.status === "rejected") {
      logger.debug("[history/lightCrawler] sub-call failed", {
        seedAddress,
        call: name,
        error: (r.reason as any)?.message ?? String(r.reason),
      });
    }
  }

  // Produce a CrawlResult-compatible shape. Everything the history page
  // doesn't consume is defaulted to empty so the orchestrator and
  // graphBuilder (if ever reused) see a valid object.
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
}
