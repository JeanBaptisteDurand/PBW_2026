import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BINANCE_BASE = "https://api.binance.com/api/v3";

export type BinanceOptions = {
  symbol: string;
  fetch?: typeof fetch;
  ttlSeconds: number;
};

export async function fetchBinanceDepth(opts: BinanceOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BINANCE_BASE}/depth?symbol=${encodeURIComponent(opts.symbol)}&limit=100`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Binance ${opts.symbol} returned HTTP ${res.status}`);
  const json = (await res.json()) as {
    bids: Array<[string, string]>;
    asks: Array<[string, string]>;
  };
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
    actor: "binance",
    book: opts.symbol,
    venue: "Binance",
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
