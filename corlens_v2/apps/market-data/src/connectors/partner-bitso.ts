import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BITSO_BASE = "https://bitso.com/api/v3";

export type BitsoOptions = {
  book: string;
  fetch?: typeof fetch;
  ttlSeconds: number;
};

export async function fetchBitsoDepth(opts: BitsoOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BITSO_BASE}/order_book/?book=${encodeURIComponent(opts.book)}&aggregate=true`;
  const res = await f(url, { headers: { "User-Agent": "CorLens/2.0 (+https://cor-lens.xyz)" } });
  if (!res.ok) throw new Error(`Bitso ${opts.book} returned HTTP ${res.status}`);
  const json = (await res.json()) as { success: boolean; payload: { bids: Array<{ price: string; amount: string }>; asks: Array<{ price: string; amount: string }> } };
  if (!json.success || !json.payload) throw new Error(`Bitso ${opts.book} returned empty payload`);
  const { bids, asks } = json.payload;
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "bitso",
    book: opts.book,
    venue: "Bitso",
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
