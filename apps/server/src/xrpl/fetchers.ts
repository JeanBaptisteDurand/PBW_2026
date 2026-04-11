import type { XRPLAsset } from "@xrplens/core";
import type { XRPLClientWrapper } from "./client.js";

/**
 * Format an XRPLAsset into the wire format expected by XRPL commands.
 * XRP has no issuer; all other currencies require both currency + issuer.
 */
export function formatAsset(asset: XRPLAsset): { currency: string; issuer?: string } {
  if (asset.currency === "XRP") {
    return { currency: "XRP" };
  }
  return { currency: asset.currency, issuer: asset.issuer };
}

// ─── 1. Account Info ────────────────────────────────────────────────────────

export async function fetchAccountInfo(
  client: XRPLClientWrapper,
  account: string,
): Promise<unknown> {
  return client.request("account_info", {
    account,
    signer_lists: true,
    ledger_index: "validated",
  });
}

// ─── 2. AMM Info ────────────────────────────────────────────────────────────

export async function fetchAMMInfo(
  client: XRPLClientWrapper,
  asset1: XRPLAsset,
  asset2: XRPLAsset,
): Promise<unknown> {
  return client.request("amm_info", {
    asset: formatAsset(asset1),
    asset2: formatAsset(asset2),
    ledger_index: "validated",
  });
}

// ─── 3. Trust Lines (paginated) ─────────────────────────────────────────────

export async function fetchTrustLines(
  client: XRPLClientWrapper,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const lines: unknown[] = [];
  let marker: unknown;

  do {
    const resp = (await client.request("account_lines", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { lines: unknown[]; marker?: unknown } };

    lines.push(...resp.result.lines);
    marker = resp.result.marker;

    if (limit && lines.length >= limit) return lines.slice(0, limit);
  } while (marker);

  return lines;
}

// ─── 4. Gateway Balances ────────────────────────────────────────────────────

export async function fetchGatewayBalances(
  client: XRPLClientWrapper,
  account: string,
): Promise<unknown> {
  return client.request("gateway_balances", {
    account,
    ledger_index: "validated",
    strict: true,
  });
}

// ─── 5. Book Offers ─────────────────────────────────────────────────────────

export async function fetchBookOffers(
  client: XRPLClientWrapper,
  takerGets: XRPLAsset,
  takerPays: XRPLAsset,
  limit = 50,
): Promise<unknown> {
  return client.request("book_offers", {
    taker_gets: formatAsset(takerGets),
    taker_pays: formatAsset(takerPays),
    limit,
    ledger_index: "validated",
  });
}

// ─── 6. Payment Paths ───────────────────────────────────────────────────────

export async function fetchPaymentPaths(
  client: XRPLClientWrapper,
  sourceAccount: string,
  destAccount: string,
  destAmount: unknown,
): Promise<unknown> {
  return client.pathFind({
    subcommand: "create",
    source_account: sourceAccount,
    destination_account: destAccount,
    destination_amount: destAmount,
  });
}

// ─── 7. Account Transactions ──────────────────────────────��─────────────────

export async function fetchAccountTransactions(
  client: XRPLClientWrapper,
  account: string,
  opts: { limit?: number; sinceUnixTime?: number; apiVersion?: 1 | 2 } = {},
): Promise<any[]> {
  const limit = opts.limit ?? 100;
  const apiVersion = opts.apiVersion ?? 2;
  const resp = (await client.request("account_tx", {
    account,
    limit,
    ledger_index_min: -1,
    ledger_index_max: -1,
    api_version: apiVersion,
  })) as { result: { transactions: any[] } };
  let txs = resp.result?.transactions ?? [];
  if (opts.sinceUnixTime) {
    const cutoffIso = new Date(opts.sinceUnixTime * 1000).toISOString();
    txs = txs.filter((t) => !t.close_time_iso || t.close_time_iso >= cutoffIso);
  }
  return txs;
}

// ─── 8. Account Objects (paginated) ─────────────────────────────────────────

export async function fetchAccountObjects(
  client: XRPLClientWrapper,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const objects: unknown[] = [];
  let marker: unknown;

  do {
    const resp = (await client.request("account_objects", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { account_objects: unknown[]; marker?: unknown } };

    objects.push(...resp.result.account_objects);
    marker = resp.result.marker;

    if (limit && objects.length >= limit) return objects.slice(0, limit);
  } while (marker);

  return objects;
}

// ─── 9. Account Currencies ──────────────────────────────────────────────────

export async function fetchAccountCurrencies(
  client: XRPLClientWrapper,
  account: string,
): Promise<unknown> {
  return client.request("account_currencies", {
    account,
    ledger_index: "validated",
  });
}

// ─── 10. Account NFTs (paginated) ──────────────────────────────────────────

export async function fetchAccountNFTs(
  client: XRPLClientWrapper,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const nfts: unknown[] = [];
  let marker: unknown;

  do {
    const resp = (await client.request("account_nfts", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { account_nfts: unknown[]; marker?: unknown } };

    nfts.push(...resp.result.account_nfts);
    marker = resp.result.marker;

    if (limit && nfts.length >= limit) return nfts.slice(0, limit);
  } while (marker);

  return nfts;
}

// ─── 11. Account Channels (paginated) ──────────────────────────────────────

export async function fetchAccountChannels(
  client: XRPLClientWrapper,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const channels: unknown[] = [];
  let marker: unknown;

  do {
    const resp = (await client.request("account_channels", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { channels: unknown[]; marker?: unknown } };

    channels.push(...resp.result.channels);
    marker = resp.result.marker;

    if (limit && channels.length >= limit) return channels.slice(0, limit);
  } while (marker);

  return channels;
}

// ─── 12. Noripple Check ───────────────────────────────────────────────────

export async function fetchNoripppleCheck(
  client: XRPLClientWrapper,
  account: string,
  role: "gateway" | "user" = "gateway",
): Promise<unknown> {
  return client.request("noripple_check", {
    account,
    role,
    ledger_index: "validated",
    limit: 20,
  });
}

// ─── 13. NFT Buy/Sell Offers ──────────────────────────────────────────────

export async function fetchNFTBuyOffers(
  client: XRPLClientWrapper,
  nftId: string,
  limit = 50,
): Promise<unknown[]> {
  try {
    const resp = (await client.request("nft_buy_offers", {
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
  client: XRPLClientWrapper,
  nftId: string,
  limit = 50,
): Promise<unknown[]> {
  try {
    const resp = (await client.request("nft_sell_offers", {
      nft_id: nftId,
      limit,
      ledger_index: "validated",
    })) as { result: { offers?: unknown[] } };
    return resp.result.offers ?? [];
  } catch {
    return [];
  }
}

// ─── 14. AMM Info by Account ──────────────────────────────────────────────

export async function fetchAMMInfoByAccount(
  client: XRPLClientWrapper,
  ammAccount: string,
): Promise<unknown> {
  return client.request("amm_info", {
    amm_account: ammAccount,
    ledger_index: "validated",
  });
}

// ─── 15. Account Offers (paginated) ───────────────────────────────────────

export async function fetchAccountOffers(
  client: XRPLClientWrapper,
  account: string,
  limit?: number,
): Promise<unknown[]> {
  const offers: unknown[] = [];
  let marker: unknown;

  do {
    const resp = (await client.request("account_offers", {
      account,
      limit: 400,
      ledger_index: "validated",
      ...(marker ? { marker } : {}),
    })) as { result: { offers: unknown[]; marker?: unknown } };

    offers.push(...resp.result.offers);
    marker = resp.result.marker;

    if (limit && offers.length >= limit) return offers.slice(0, limit);
  } while (marker);

  return offers;
}
