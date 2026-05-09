export type MarketDataClient = {
  accountInfo(address: string): Promise<unknown>;
  trustLines(address: string, params?: { limit?: number; marker?: unknown }): Promise<unknown>;
  accountObjects(address: string): Promise<unknown>;
  accountTransactions(
    address: string,
    params?: { limit?: number; ledgerIndexMin?: number },
  ): Promise<unknown>;
  accountNfts(address: string): Promise<unknown>;
  accountChannels(address: string): Promise<unknown>;
  accountOffers(address: string): Promise<unknown>;
  gatewayBalances(address: string): Promise<unknown>;
  accountCurrencies(address: string): Promise<unknown>;
  noripple(address: string): Promise<unknown>;
  bookOffers(input: {
    takerGetsCurrency: string;
    takerGetsIssuer?: string;
    takerPaysCurrency: string;
    takerPaysIssuer?: string;
    limit?: number;
  }): Promise<unknown>;
  ammByPair(input: {
    asset1Currency: string;
    asset1Issuer?: string;
    asset2Currency: string;
    asset2Issuer?: string;
  }): Promise<unknown>;
  ammByAccount(account: string): Promise<unknown>;
  nftBuyOffers(nftId: string): Promise<unknown>;
  nftSellOffers(nftId: string): Promise<unknown>;
  pathFind(input: {
    sourceAccount: string;
    destinationAccount: string;
    destinationAmount: unknown;
  }): Promise<unknown>;
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

  function qs(params: Record<string, string | number | boolean | undefined>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : "";
  }

  return {
    accountInfo: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}`),
    trustLines: (a, p) =>
      getJson(`/xrpl/account/${encodeURIComponent(a)}/lines${qs({ limit: p?.limit })}`),
    accountObjects: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/objects`),
    accountTransactions: (a, p) =>
      getJson(
        `/xrpl/account/${encodeURIComponent(a)}/transactions${qs({ limit: p?.limit, ledgerIndexMin: p?.ledgerIndexMin })}`,
      ),
    accountNfts: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/nfts`),
    accountChannels: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/channels`),
    accountOffers: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/offers`),
    gatewayBalances: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/gateway-balances`),
    accountCurrencies: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/currencies`),
    noripple: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/noripple`),
    bookOffers: (i) => getJson(`/xrpl/book${qs(i)}`),
    ammByPair: (i) => getJson(`/xrpl/amm/by-pair${qs(i)}`),
    ammByAccount: (a) => getJson(`/xrpl/amm/by-account/${encodeURIComponent(a)}`),
    nftBuyOffers: (n) => getJson(`/xrpl/nft/${encodeURIComponent(n)}/buy-offers`),
    nftSellOffers: (n) => getJson(`/xrpl/nft/${encodeURIComponent(n)}/sell-offers`),
    pathFind: (i) => postJson("/xrpl/path-find", i),
  };
}
