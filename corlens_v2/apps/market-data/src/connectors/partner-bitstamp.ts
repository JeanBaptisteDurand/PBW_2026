import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BITSTAMP_BASE = "https://www.bitstamp.net/api/v2";

export type BitstampOptions = { pair: string; fetch?: typeof fetch; ttlSeconds: number };

export async function fetchBitstampDepth(opts: BitstampOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BITSTAMP_BASE}/order_book/${encodeURIComponent(opts.pair)}/`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Bitstamp ${opts.pair} returned HTTP ${res.status}`);
  const json = (await res.json()) as { bids: Array<[string, string]>; asks: Array<[string, string]> };
  const bids = json.bids.map(([price, amount]) => ({ price, amount }));
  const asks = json.asks.map(([price, amount]) => ({ price, amount }));
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "bitstamp",
    book: opts.pair,
    venue: "Bitstamp",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bids.reduce((s, b) => s + Number(b.amount), 0).toFixed(2),
    askDepthBase: asks.reduce((s, a) => s + Number(a.amount), 0).toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
