import type { XrplClient } from "./xrpl-client.js";

export type XrplAsset = { currency: string; issuer?: string };

export function formatAsset(asset: XrplAsset): { currency: string; issuer?: string } {
  if (asset.currency === "XRP") return { currency: "XRP" };
  return { currency: asset.currency, issuer: asset.issuer };
}

export const fetchAccountInfo = (c: XrplClient, account: string) =>
  c.request("account_info", { account, signer_lists: true, ledger_index: "validated" });

export async function fetchTrustLines(
  c: XrplClient,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_lines", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { lines: unknown[]; marker?: unknown } };
    out.push(...resp.result.lines);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountObjects(
  c: XrplClient,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_objects", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { account_objects: unknown[]; marker?: unknown } };
    out.push(...resp.result.account_objects);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountTransactions(
  c: XrplClient,
  account: string,
  opts: { limit?: number; sinceUnixTime?: number; apiVersion?: 1 | 2 } = {},
) {
  const limit = opts.limit ?? 100;
  const apiVersion = opts.apiVersion ?? 2;
  const resp = (await c.request("account_tx", {
    account,
    limit,
    ledger_index_min: -1,
    ledger_index_max: -1,
    api_version: apiVersion,
  })) as { result: { transactions: unknown[] } };
  let txs = resp.result?.transactions ?? [];
  if (opts.sinceUnixTime) {
    const cutoff = new Date(opts.sinceUnixTime * 1000).toISOString();
    txs = (txs as Array<{ close_time_iso?: string }>).filter(
      (t) => !t.close_time_iso || t.close_time_iso >= cutoff,
    ) as unknown[];
  }
  return txs;
}

export async function fetchAccountNFTs(
  c: XrplClient,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_nfts", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { account_nfts: unknown[]; marker?: unknown } };
    out.push(...resp.result.account_nfts);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountChannels(
  c: XrplClient,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_channels", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { channels: unknown[]; marker?: unknown } };
    out.push(...resp.result.channels);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountOffers(
  c: XrplClient,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_offers", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { offers: unknown[]; marker?: unknown } };
    out.push(...resp.result.offers);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export const fetchAccountCurrencies = (c: XrplClient, account: string) =>
  c.request("account_currencies", { account, ledger_index: "validated" });

export const fetchGatewayBalances = (c: XrplClient, account: string) =>
  c.request("gateway_balances", { account, ledger_index: "validated", strict: true });

export const fetchNoripppleCheck = (
  c: XrplClient,
  account: string,
  role: "gateway" | "user" = "gateway",
) => c.request("noripple_check", { account, role, ledger_index: "validated", limit: 20 });

export const fetchAMMInfoByPair = (c: XrplClient, asset1: XrplAsset, asset2: XrplAsset) =>
  c.request("amm_info", {
    asset: formatAsset(asset1),
    asset2: formatAsset(asset2),
    ledger_index: "validated",
  });

export const fetchAMMInfoByAccount = (c: XrplClient, ammAccount: string) =>
  c.request("amm_info", { amm_account: ammAccount, ledger_index: "validated" });

export const fetchBookOffers = (
  c: XrplClient,
  takerGets: XrplAsset,
  takerPays: XrplAsset,
  limit = 50,
) =>
  c.request("book_offers", {
    taker_gets: formatAsset(takerGets),
    taker_pays: formatAsset(takerPays),
    limit,
    ledger_index: "validated",
  });

export const fetchPaymentPaths = (
  c: XrplClient,
  sourceAccount: string,
  destAccount: string,
  destAmount: unknown,
) =>
  c.pathFind({
    subcommand: "create",
    source_account: sourceAccount,
    destination_account: destAccount,
    destination_amount: destAmount,
  });

export async function fetchNFTBuyOffers(
  c: XrplClient,
  nftId: string,
  limit = 50,
): Promise<unknown[]> {
  try {
    const resp = (await c.request("nft_buy_offers", {
      nft_id: nftId,
      limit,
      ledger_index: "validated",
    })) as { result: { offers?: unknown[] } };
    return resp.result.offers ?? [];
  } catch {
    return [];
  }
}

export async function fetchNFTSellOffers(
  c: XrplClient,
  nftId: string,
  limit = 50,
): Promise<unknown[]> {
  try {
    const resp = (await c.request("nft_sell_offers", {
      nft_id: nftId,
      limit,
      ledger_index: "validated",
    })) as { result: { offers?: unknown[] } };
    return resp.result.offers ?? [];
  } catch {
    return [];
  }
}
