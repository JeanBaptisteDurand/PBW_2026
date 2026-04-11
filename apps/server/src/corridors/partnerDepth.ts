// ─── Partner depth probe ───────────────────────────────────────────────
//
// Measures real orderbook depth from partner venues and the XRPL DEX.
//
// Two fetcher types:
//  1. Bitso (off-chain CEX) — REST API, XRP/MXN proof-of-concept
//  2. XRPL DEX (on-ledger)  — book_offers via QuickNode, GateHub pairs
//
// Architecture:
//  - fetchPartnerDepth(actorKey, book) returns a normalised snapshot
//  - An in-memory TTL cache keeps hit rates low
//  - Route handler: GET /api/corridors/partner-depth/:actor/:book

import { createXRPLClient, type XRPLClientWrapper } from "../xrpl/client.js";
import { logger } from "../logger.js";

export interface PartnerDepthSnapshot {
  actor: string;
  book: string;
  venue: string;
  bidCount: number;
  askCount: number;
  topBid: { price: string; amount: string } | null;
  topAsk: { price: string; amount: string } | null;
  spreadBps: number | null;
  bidDepthBase: string;
  askDepthBase: string;
  source: string;
  fetchedAt: string;
  ttlSeconds: number;
}

interface CacheEntry {
  expiresAt: number;
  snapshot: PartnerDepthSnapshot;
}

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(actor: string, book: string): string {
  return `${actor}:${book}`;
}

// ─── Bitso fetcher ─────────────────────────────────────────────────────
// Public endpoint, no auth required.

const BITSO_BASE = "https://bitso.com/api/v3";

async function fetchBitsoDepth(
  book: string,
): Promise<PartnerDepthSnapshot> {
  const url = `${BITSO_BASE}/order_book/?book=${encodeURIComponent(book)}&aggregate=true`;
  const res = await fetch(url, {
    headers: { "User-Agent": "XRPLens/1.0 (+https://xrplens.dev)" },
  });
  if (!res.ok) {
    throw new Error(`Bitso ${book} returned HTTP ${res.status}`);
  }
  const json = (await res.json()) as {
    success: boolean;
    payload: {
      bids: Array<{ price: string; amount: string }>;
      asks: Array<{ price: string; amount: string }>;
    };
  };
  if (!json.success || !json.payload) {
    throw new Error(`Bitso ${book} returned empty payload`);
  }
  const { bids, asks } = json.payload;
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) {
      spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
    }
  }
  const bidDepth = bids.reduce((s, b) => s + Number(b.amount), 0);
  const askDepth = asks.reduce((s, a) => s + Number(a.amount), 0);
  return {
    actor: "bitso",
    book,
    venue: "Bitso",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bidDepth.toFixed(2),
    askDepthBase: askDepth.toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: CACHE_TTL_MS / 1000,
  };
}

// ─── XRPL DEX fetcher (on-ledger via book_offers) ──────────────────────
// Queries the XRPL DEX directly for GateHub IOU pairs.

// Lazy-init shared client for DEX depth queries
let dexClient: XRPLClientWrapper | null = null;
async function getDexClient(): Promise<XRPLClientWrapper> {
  if (!dexClient || !dexClient.isConnected()) {
    dexClient = createXRPLClient();
    await dexClient.connect();
  }
  return dexClient;
}

interface DexAsset {
  currency: string;
  issuer?: string;
}

interface DexPair {
  base: DexAsset;
  quote: DexAsset;
  venue: string;
}

// GateHub issuer addresses (same as catalog.ts)
const GATEHUB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";
const GATEHUB_GBP = "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g";

const DEX_PAIRS: Record<string, DexPair> = {
  "eur-xrp": {
    base: { currency: "EUR", issuer: GATEHUB },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "xrp-eur": {
    base: { currency: "XRP" },
    quote: { currency: "EUR", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-xrp": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "xrp-usd": {
    base: { currency: "XRP" },
    quote: { currency: "USD", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-eur": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "EUR", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "eur-usd": {
    base: { currency: "EUR", issuer: GATEHUB },
    quote: { currency: "USD", issuer: GATEHUB },
    venue: "GateHub DEX (XRPL)",
  },
  "gbp-xrp": {
    base: { currency: "GBP", issuer: GATEHUB_GBP },
    quote: { currency: "XRP" },
    venue: "GateHub DEX (XRPL)",
  },
  "usd-gbp": {
    base: { currency: "USD", issuer: GATEHUB },
    quote: { currency: "GBP", issuer: GATEHUB_GBP },
    venue: "GateHub DEX (XRPL)",
  },
};

function offerAmount(offer: any): number {
  const gets = offer.taker_gets_funded ?? offer.TakerGets;
  if (typeof gets === "string") return Number(gets) / 1_000_000; // XRP in drops
  return Number(gets?.value ?? 0);
}

function offerPrice(offer: any): number {
  const gets = offer.TakerGets;
  const pays = offer.TakerPays;
  const getsVal = typeof gets === "string" ? Number(gets) / 1_000_000 : Number(gets?.value ?? 0);
  const paysVal = typeof pays === "string" ? Number(pays) / 1_000_000 : Number(pays?.value ?? 0);
  return getsVal > 0 ? paysVal / getsVal : 0;
}

async function fetchXrplDexDepth(pairKey: string): Promise<PartnerDepthSnapshot> {
  const pair = DEX_PAIRS[pairKey];
  if (!pair) throw new Error(`Unknown DEX pair: ${pairKey}`);

  const client = await getDexClient();

  // Ask side: offers selling base for quote
  const asksRes = (await client.request("book_offers", {
    taker_gets: pair.base,
    taker_pays: pair.quote,
    limit: 50,
    ledger_index: "validated",
  })) as any;
  const asks = asksRes?.result?.offers ?? [];

  // Bid side: offers selling quote for base
  const bidsRes = (await client.request("book_offers", {
    taker_gets: pair.quote,
    taker_pays: pair.base,
    limit: 50,
    ledger_index: "validated",
  })) as any;
  const bids = bidsRes?.result?.offers ?? [];

  const bidDepth = bids.reduce((s: number, o: any) => s + offerAmount(o), 0);
  const askDepth = asks.reduce((s: number, o: any) => s + offerAmount(o), 0);

  const topBid = bids[0]
    ? { price: offerPrice(bids[0]).toFixed(6), amount: offerAmount(bids[0]).toFixed(2) }
    : null;
  const topAsk = asks[0]
    ? { price: offerPrice(asks[0]).toFixed(6), amount: offerAmount(asks[0]).toFixed(2) }
    : null;

  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }

  const baseCcy = pair.base.currency === "XRP" ? "XRP" : pair.base.currency;
  return {
    actor: "xrpl-dex",
    book: `${baseCcy}/${pair.quote.currency}`,
    venue: pair.venue,
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bidDepth.toFixed(2),
    askDepthBase: askDepth.toFixed(2),
    source: "XRPL book_offers (on-ledger)",
    fetchedAt: new Date().toISOString(),
    ttlSeconds: CACHE_TTL_MS / 1000,
  };
}

// ─── Public fetcher with TTL cache ──────────────────────────────────────

export async function fetchPartnerDepth(
  actor: string,
  book: string,
): Promise<PartnerDepthSnapshot> {
  const key = cacheKey(actor, book);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.snapshot;
  }
  let snapshot: PartnerDepthSnapshot;
  if (actor === "xrpl-dex") {
    snapshot = await fetchXrplDexDepth(book);
  } else if (actor === "bitso") {
    snapshot = await fetchBitsoDepth(book);
  } else {
    throw new Error(
      `partner-depth: actor "${actor}" not supported. Supported: "bitso", "xrpl-dex".`,
    );
  }
  cache.set(key, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    snapshot,
  });
  logger.info("[partner-depth] fetched", {
    actor,
    book,
    bids: snapshot.bidCount,
    asks: snapshot.askCount,
    spreadBps: snapshot.spreadBps?.toFixed(1),
  });
  return snapshot;
}

// Book lookup: maps "corridorId:actor" → book key for that fetcher.
export const PARTNER_DEPTH_BOOKS: Record<string, string> = {
  // Bitso (off-chain CEX)
  "usd-mxn:bitso": "xrp_mxn",
  "mxn-usd:bitso": "xrp_mxn",
  // GateHub DEX (on-ledger XRPL) — book key = DEX pair key
  ...Object.fromEntries(
    Object.keys(DEX_PAIRS).map((k) => [`${k}:xrpl-dex`, k]),
  ),
};

// Export supported DEX pair keys for the corridor detail page
export const SUPPORTED_DEX_PAIRS = Object.keys(DEX_PAIRS);
