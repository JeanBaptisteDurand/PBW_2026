export type MarketDataClient = {
  pathFind(input: { sourceAccount: string; destinationAccount: string; destinationAmount: unknown }): Promise<unknown>;
  bookOffers(input: { takerGetsCurrency: string; takerGetsIssuer?: string; takerPaysCurrency: string; takerPaysIssuer?: string; limit?: number }): Promise<unknown>;
  partnerDepth(actor: string, book: string): Promise<unknown>;
};

export type MarketDataClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export function createMarketDataClient(opts: MarketDataClientOptions): MarketDataClient {
  const f = opts.fetch ?? fetch;

  async function getJson(path: string): Promise<unknown> {
    const res = await f(`${opts.baseUrl}${path}`);
    if (!res.ok) throw new Error(`market-data ${path} -> ${res.status}`);
    return res.json();
  }

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const res = await f(`${opts.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`market-data ${path} -> ${res.status}`);
    return res.json();
  }

  return {
    async pathFind(input) {
      return postJson("/xrpl/path-find", input);
    },
    async bookOffers(input) {
      const params = new URLSearchParams({
        takerGetsCurrency: input.takerGetsCurrency,
        takerPaysCurrency: input.takerPaysCurrency,
        ...(input.takerGetsIssuer ? { takerGetsIssuer: input.takerGetsIssuer } : {}),
        ...(input.takerPaysIssuer ? { takerPaysIssuer: input.takerPaysIssuer } : {}),
        ...(input.limit ? { limit: String(input.limit) } : {}),
      });
      return getJson(`/xrpl/book?${params}`);
    },
    async partnerDepth(actor, book) {
      return getJson(`/partner-depth/${encodeURIComponent(actor)}/${encodeURIComponent(book)}`);
    },
  };
}
