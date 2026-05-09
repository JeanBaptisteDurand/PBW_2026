export type PartnerDepthSummary = {
  actor: string;
  book: string;
  venue: string;
  bidCount: number;
  askCount: number;
  spreadBps: number | null;
  bidDepthBase: string;
  askDepthBase: string;
  fetchedAt: string;
};

export type MarketDataClient = {
  pathFind(input: {
    sourceAccount: string;
    destinationAccount: string;
    destinationAmount: { currency: string; issuer?: string; value: string };
  }): Promise<{ result?: { alternatives?: unknown[] } }>;
  partnerDepth(actor: string, book: string): Promise<PartnerDepthSummary>;
  accountInfo(address: string): Promise<unknown>;
  trustLines(address: string, params?: { limit?: number }): Promise<unknown>;
  gatewayBalances(address: string): Promise<unknown>;
};

export type MarketDataClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export function createMarketDataClient(opts: MarketDataClientOptions): MarketDataClient {
  const f = opts.fetch ?? fetch;

  async function getJson<T>(p: string): Promise<T> {
    const res = await f(`${opts.baseUrl}${p}`);
    if (!res.ok) throw new Error(`market-data ${p} -> ${res.status}`);
    return res.json() as Promise<T>;
  }

  async function postJson<T>(p: string, body: unknown): Promise<T> {
    const res = await f(`${opts.baseUrl}${p}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`market-data ${p} -> ${res.status}`);
    return res.json() as Promise<T>;
  }

  return {
    pathFind: (i) => postJson("/xrpl/path-find", i),
    partnerDepth: (actor, book) =>
      getJson(`/partner-depth/${encodeURIComponent(actor)}/${encodeURIComponent(book)}`),
    accountInfo: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}`),
    trustLines: (a, p) => {
      const qs = p?.limit !== undefined ? `?limit=${p.limit}` : "";
      return getJson(`/xrpl/account/${encodeURIComponent(a)}/lines${qs}`);
    },
    gatewayBalances: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/gateway-balances`),
  };
}
