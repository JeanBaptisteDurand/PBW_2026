import { hmacSigner } from "@corlens/clients";
import { corridor as cc } from "@corlens/contracts";

export type CorridorClient = {
  list(query: { tier?: number; limit?: number }): Promise<unknown[]>;
  getById(id: string): Promise<unknown | null>;
  chat(input: { corridorId?: string; message: string }): Promise<{
    answer: string;
    sources: Array<{ id: string; snippet: string }>;
  }>;
  getCurrencyMeta(code: string): Promise<cc.CurrencyMeta | null>;
  listCurrencyMeta(): Promise<cc.CurrencyMetaListResponse>;
};

export type CorridorClientOptions = {
  baseUrl: string;
  hmacSecret: string;
  fetch?: typeof fetch;
};

export function createCorridorClient(opts: CorridorClientOptions): CorridorClient {
  const f = opts.fetch ?? fetch;
  const sign = hmacSigner({ secret: opts.hmacSecret });
  return {
    async list(query) {
      const params = new URLSearchParams();
      if (query.tier !== undefined) params.set("tier", String(query.tier));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      const url = `${opts.baseUrl}/api/corridors${qs ? `?${qs}` : ""}`;
      const res = await f(url, { headers: sign("") });
      if (!res.ok) throw new Error(`corridor list -> ${res.status}`);
      return res.json() as Promise<unknown[]>;
    },
    async getById(id) {
      const res = await f(`${opts.baseUrl}/api/corridors/${encodeURIComponent(id)}`, {
        headers: sign(""),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`corridor getById -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const bodyStr = JSON.stringify(input);
      const res = await f(`${opts.baseUrl}/api/corridors/chat`, {
        method: "POST",
        headers: { "content-type": "application/json", ...sign(bodyStr) },
        body: bodyStr,
      });
      if (!res.ok) throw new Error(`corridor chat -> ${res.status}`);
      return res.json() as Promise<{
        answer: string;
        sources: Array<{ id: string; snippet: string }>;
      }>;
    },
    async getCurrencyMeta(code) {
      const res = await f(
        `${opts.baseUrl}/api/corridors/currency-meta/${encodeURIComponent(code)}`,
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`corridor getCurrencyMeta -> ${res.status}`);
      return cc.CurrencyMeta.parse(await res.json());
    },
    async listCurrencyMeta() {
      const res = await f(`${opts.baseUrl}/api/corridors/currency-meta`);
      if (!res.ok) throw new Error(`corridor listCurrencyMeta -> ${res.status}`);
      return cc.CurrencyMetaListResponse.parse(await res.json());
    },
  };
}
