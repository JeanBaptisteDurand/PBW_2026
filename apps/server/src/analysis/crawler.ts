import type { XRPLClientWrapper } from "../xrpl/client.js";
import {
  fetchAccountInfo,
  fetchTrustLines,
  fetchGatewayBalances,
  fetchAMMInfo,
  fetchAMMInfoByAccount,
  fetchBookOffers,
  fetchPaymentPaths,
  fetchAccountObjects,
  fetchAccountCurrencies,
  fetchAccountTransactions,
} from "../xrpl/fetchers.js";
import { logger } from "../logger.js";

// ─── Constants ───────────────────────────────────────────────────────────────

const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const RLUSD_HEX = "524C555344000000000000000000000000000000";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TxTypeSummary {
  type: string;
  count: number;
  lastSeen?: string;
}

export interface CrawlResult {
  issuerInfo: any;
  trustLines: any[];
  gatewayBalances: any;
  ammPool: any;
  lpHolders: any[];
  asks: any[];
  bids: any[];
  paths: any[];
  accountObjects: any[];
  currencies: any;
  topAccounts: Map<string, any>;
  accountTransactions: any[];
  txTypeSummary: TxTypeSummary[];
}

export type CrawlProgressCallback = (step: string, detail?: string) => void;

// ─── Main Crawl Function ──────────────────────────────────────────────────────

export async function crawlFromSeed(
  client: XRPLClientWrapper,
  seedAddress: string,
  seedLabel?: string,
  onProgress?: CrawlProgressCallback,
): Promise<CrawlResult> {
  const progress = (step: string, detail?: string) => {
    logger.info(`[crawler] ${step}`, { detail, seedAddress });
    onProgress?.(step, detail);
  };

  // ── Step 1: Fetch issuer account_info ──────────────────────────────────────
  progress("fetch_issuer_info", `Fetching account info for ${seedAddress}`);
  const issuerInfoResp = (await fetchAccountInfo(client, seedAddress)) as any;
  const issuerInfo = issuerInfoResp?.result?.account_data ?? null;
  if (issuerInfoResp?.result?.signer_lists) {
    issuerInfo.signer_lists = issuerInfoResp.result.signer_lists;
  }
  logger.debug("[crawler] issuerInfo fetched", {
    address: issuerInfo?.Account,
    flags: issuerInfo?.Flags,
    signerLists: issuerInfo?.signer_lists?.length ?? 0,
  });

  // ── Step 2: Fetch trust lines (paginated, cap 2000) ────────────────────────
  progress("fetch_trust_lines", `Fetching trust lines for ${seedAddress}`);
  const trustLines = (await fetchTrustLines(client, seedAddress, 2000)) as any[];
  logger.debug("[crawler] trustLines fetched", { count: trustLines.length });

  // ── Step 3: Fetch gateway balances ─────────────────────────────────────────
  progress("fetch_gateway_balances", `Fetching gateway balances for ${seedAddress}`);
  let gatewayBalances: any = null;
  try {
    const gatewayBalancesResp = (await fetchGatewayBalances(client, seedAddress)) as any;
    gatewayBalances = gatewayBalancesResp?.result ?? null;
    logger.debug("[crawler] gatewayBalances fetched", {
      obligations: Object.keys(gatewayBalances?.obligations ?? {}),
    });
  } catch (err: any) {
    logger.warn("[crawler] gateway_balances failed, treating as non-issuer", {
      error: err?.message,
    });
    gatewayBalances = { obligations: {} };
  }

  // Detect primary currency from obligations (used in steps 4, 6, 7)
  const obligations = gatewayBalances?.obligations ?? {};
  const tokenCurrency = Object.keys(obligations)[0] ?? RLUSD_HEX;

  // ── Step 4: Fetch AMM pool info ────────────────────────────────────────────
  progress("fetch_amm_pool", `Fetching AMM pool info for XRP/${seedLabel ?? seedAddress}`);
  let ammPool: any = null;

  const isAmmAccount = !!issuerInfo?.AMMID;
  if (isAmmAccount) {
    try {
      const ammResp = (await fetchAMMInfoByAccount(client, seedAddress)) as any;
      ammPool = ammResp?.result?.amm ?? null;
      logger.debug("[crawler] ammPool fetched (direct AMM account)", { account: ammPool?.account });
    } catch (err: any) {
      logger.warn("[crawler] Failed to fetch AMM info for AMM account", { error: err?.message });
    }
  } else {
    try {
      const ammResp = (await fetchAMMInfo(
        client,
        { currency: "XRP" },
        { currency: tokenCurrency, issuer: seedAddress },
      )) as any;
      ammPool = ammResp?.result?.amm ?? null;
      logger.debug("[crawler] ammPool fetched", { account: ammPool?.account });
    } catch (err: any) {
      logger.warn("[crawler] No AMM pool found (expected if not an AMM issuer)", {
        error: err?.message,
      });
    }
  }

  // ── Step 5: Fetch LP holders (trust lines on pool account) ────────────────
  progress("fetch_lp_holders", "Fetching LP holder trust lines");
  let lpHolders: any[] = [];
  if (ammPool?.account) {
    try {
      lpHolders = (await fetchTrustLines(client, ammPool.account, 500)) as any[];
      logger.debug("[crawler] lpHolders fetched", { count: lpHolders.length });
    } catch (err: any) {
      logger.warn("[crawler] Failed to fetch LP holders", { error: err?.message });
    }
  }

  // ── Step 6: Fetch order book both sides ────────────────────────────────────
  progress("fetch_order_book", "Fetching order book (asks and bids)");
  let asks: any[] = [];
  let bids: any[] = [];
  try {
    const asksResp = (await fetchBookOffers(
      client,
      { currency: "XRP" },
      { currency: tokenCurrency, issuer: seedAddress },
      50,
    )) as any;
    asks = asksResp?.result?.offers ?? [];
    logger.debug("[crawler] asks fetched", { count: asks.length });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch asks", { error: err?.message });
  }

  try {
    const bidsResp = (await fetchBookOffers(
      client,
      { currency: tokenCurrency, issuer: seedAddress },
      { currency: "XRP" },
      50,
    )) as any;
    bids = bidsResp?.result?.offers ?? [];
    logger.debug("[crawler] bids fetched", { count: bids.length });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch bids", { error: err?.message });
  }

  // ── Step 7: Fetch payment paths ────────────────────────────────────────────
  progress("fetch_payment_paths", "Fetching payment paths");
  let paths: any[] = [];
  try {
    const pathsResp = (await fetchPaymentPaths(
      client,
      seedAddress,
      RLUSD_ISSUER,
      {
        currency: tokenCurrency,
        issuer: seedAddress,
        value: "1",
      },
    )) as any;
    paths = pathsResp?.result?.alternatives ?? [];
    logger.debug("[crawler] payment paths fetched", { count: paths.length });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch payment paths", { error: err?.message });
  }

  // ── Step 8: Fetch account objects ─────────────────────────────────────────
  progress("fetch_account_objects", `Fetching account objects for ${seedAddress}`);
  let accountObjects: any[] = [];
  try {
    accountObjects = (await fetchAccountObjects(client, seedAddress, 1000)) as any[];
    logger.debug("[crawler] accountObjects fetched", { count: accountObjects.length });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch account objects", { error: err?.message });
  }

  // ── Step 9: Fetch & classify account transactions ────────────────────────
  progress("fetch_transactions", `Fetching transactions for ${seedAddress}`);
  let accountTransactions: any[] = [];
  let txTypeSummary: TxTypeSummary[] = [];
  try {
    accountTransactions = await fetchAccountTransactions(client, seedAddress, { limit: 200 });
    logger.debug("[crawler] transactions fetched", { count: accountTransactions.length });

    const txCounts = new Map<string, { count: number; lastSeen?: string }>();
    for (const tx of accountTransactions) {
      const txType =
        tx?.tx_json?.TransactionType ??
        tx?.tx?.TransactionType ??
        tx?.TransactionType ??
        "Unknown";
      const entry = txCounts.get(txType) ?? { count: 0 };
      entry.count++;
      const date = tx?.tx_json?.date ?? tx?.tx?.date ?? tx?.close_time_iso;
      if (date) entry.lastSeen = String(date);
      txCounts.set(txType, entry);
    }
    txTypeSummary = Array.from(txCounts.entries())
      .map(([type, { count, lastSeen }]) => ({ type, count, lastSeen }))
      .sort((a, b) => b.count - a.count);
    logger.debug("[crawler] txTypeSummary", { types: txTypeSummary.map((t) => t.type) });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch transactions", { error: err?.message });
  }

  progress("fetch_currencies", `Fetching account currencies for ${seedAddress}`);
  let currencies: any = null;
  try {
    const currenciesResp = (await fetchAccountCurrencies(client, seedAddress)) as any;
    currencies = currenciesResp?.result ?? null;
    logger.debug("[crawler] currencies fetched", {
      send: currencies?.send_currencies?.length,
      receive: currencies?.receive_currencies?.length,
    });
  } catch (err: any) {
    logger.warn("[crawler] Failed to fetch currencies", { error: err?.message });
  }

  // ── Step 10: Enrich top 20 accounts ───────────────────────────────────────
  progress("enrich_top_accounts", "Enriching top 20 accounts with account_info");
  const topAccounts = new Map<string, any>();

  const sortedLpHolders = [...lpHolders]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 10);

  const sortedTrustLineHolders = [...trustLines]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 10);

  const topAddresses = new Set<string>([
    ...sortedLpHolders.map((h) => h.account),
    ...sortedTrustLineHolders.map((h) => h.account),
  ]);

  for (const address of topAddresses) {
    if (!address) continue;
    try {
      progress("enrich_account", `Fetching info for ${address}`);
      const infoResp = (await fetchAccountInfo(client, address)) as any;
      const accountData = infoResp?.result?.account_data ?? null;
      if (accountData) {
        topAccounts.set(address, accountData);
      }
    } catch (err: any) {
      logger.warn("[crawler] Failed to enrich account", { address, error: err?.message });
    }
  }

  logger.info("[crawler] Crawl complete", {
    seedAddress,
    trustLines: trustLines.length,
    lpHolders: lpHolders.length,
    asks: asks.length,
    bids: bids.length,
    paths: paths.length,
    accountObjects: accountObjects.length,
    txTypes: txTypeSummary.length,
    topAccounts: topAccounts.size,
  });

  progress("done", "Crawl complete");

  return {
    issuerInfo,
    trustLines,
    gatewayBalances,
    ammPool,
    lpHolders,
    asks,
    bids,
    paths,
    accountObjects,
    currencies,
    topAccounts,
    accountTransactions,
    txTypeSummary,
  };
}
