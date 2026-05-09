import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const KRAKEN_BASE = "https://api.kraken.com/0/public";

export type KrakenOptions = { pair: string; fetch?: typeof fetch; ttlSeconds: number };

export async function fetchKrakenDepth(opts: KrakenOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${KRAKEN_BASE}/Depth?pair=${encodeURIComponent(opts.pair)}&count=100`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Kraken ${opts.pair} returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    error: unknown[];
    result: Record<
      string,
      { bids: Array<[string, string, number]>; asks: Array<[string, string, number]> }
    >;
  };
  if (json.error.length > 0) throw new Error(`Kraken error: ${JSON.stringify(json.error)}`);
  const firstKey = Object.keys(json.result)[0];
  if (!firstKey) throw new Error(`Kraken ${opts.pair} returned empty result`);
  const book = json.result[firstKey];
  if (!book) throw new Error(`Kraken ${opts.pair} returned empty book`);
  const bids = book.bids.map(([price, amount]) => ({ price, amount }));
  const asks = book.asks.map(([price, amount]) => ({ price, amount }));
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "kraken",
    book: opts.pair,
    venue: "Kraken",
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
