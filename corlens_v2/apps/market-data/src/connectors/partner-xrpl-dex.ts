import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";
import type { XrplClient } from "./xrpl-client.js";

const GATEHUB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";
const GATEHUB_GBP = "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g";

type DexAsset = { currency: string; issuer?: string };
type DexPair = { base: DexAsset; quote: DexAsset; venue: string };

const DEX_PAIRS: Record<string, DexPair> = {
  "eur-xrp": { base: { currency: "EUR", issuer: GATEHUB }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "xrp-eur": { base: { currency: "XRP" }, quote: { currency: "EUR", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "usd-xrp": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "xrp-usd": { base: { currency: "XRP" }, quote: { currency: "USD", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "usd-eur": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "EUR", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "eur-usd": { base: { currency: "EUR", issuer: GATEHUB }, quote: { currency: "USD", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "gbp-xrp": { base: { currency: "GBP", issuer: GATEHUB_GBP }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "usd-gbp": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "GBP", issuer: GATEHUB_GBP }, venue: "GateHub DEX (XRPL)" },
};

export const SUPPORTED_DEX_PAIRS = Object.keys(DEX_PAIRS);

function offerAmount(offer: { taker_gets_funded?: unknown; TakerGets?: unknown }): number {
  const gets = offer.taker_gets_funded ?? offer.TakerGets;
  if (typeof gets === "string") return Number(gets) / 1_000_000;
  return Number((gets as { value?: string })?.value ?? 0);
}
function offerPrice(offer: { TakerGets?: unknown; TakerPays?: unknown }): number {
  const gets = offer.TakerGets;
  const pays = offer.TakerPays;
  const getsVal = typeof gets === "string" ? Number(gets) / 1_000_000 : Number((gets as { value?: string })?.value ?? 0);
  const paysVal = typeof pays === "string" ? Number(pays) / 1_000_000 : Number((pays as { value?: string })?.value ?? 0);
  return getsVal > 0 ? paysVal / getsVal : 0;
}

export type XrplDexOptions = { pairKey: string; client: XrplClient; ttlSeconds: number };

export async function fetchXrplDexDepth(opts: XrplDexOptions): Promise<PartnerDepthSnapshot> {
  const pair = DEX_PAIRS[opts.pairKey];
  if (!pair) throw new Error(`Unknown DEX pair: ${opts.pairKey}`);

  const asksRes = (await opts.client.request("book_offers", {
    taker_gets: pair.base, taker_pays: pair.quote, limit: 50, ledger_index: "validated",
  })) as { result: { offers?: unknown[] } };
  const asks = (asksRes.result.offers ?? []) as Array<Parameters<typeof offerAmount>[0]>;

  const bidsRes = (await opts.client.request("book_offers", {
    taker_gets: pair.quote, taker_pays: pair.base, limit: 50, ledger_index: "validated",
  })) as { result: { offers?: unknown[] } };
  const bids = (bidsRes.result.offers ?? []) as Array<Parameters<typeof offerAmount>[0]>;

  const bidDepth = bids.reduce((s, o) => s + offerAmount(o), 0);
  const askDepth = asks.reduce((s, o) => s + offerAmount(o), 0);

  const topBid = bids[0] ? { price: offerPrice(bids[0]).toFixed(6), amount: offerAmount(bids[0]).toFixed(2) } : null;
  const topAsk = asks[0] ? { price: offerPrice(asks[0]).toFixed(6), amount: offerAmount(asks[0]).toFixed(2) } : null;

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
    ttlSeconds: opts.ttlSeconds,
  };
}
