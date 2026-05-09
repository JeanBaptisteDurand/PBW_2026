export type CorridorClient = {
  list(query: { tier?: number; limit?: number }): Promise<unknown[]>;
  getById(id: string): Promise<unknown | null>;
  chat(input: { corridorId?: string; message: string }): Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
};

export function createCorridorClient(opts: { baseUrl: string; fetch?: typeof fetch }): CorridorClient {
  const f = opts.fetch ?? fetch;
  return {
    async list(query) {
      const params = new URLSearchParams();
      if (query.tier !== undefined) params.set("tier", String(query.tier));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      const url = `${opts.baseUrl}/api/corridors${qs ? `?${qs}` : ""}`;
      const res = await f(url);
      if (!res.ok) throw new Error(`corridor list -> ${res.status}`);
      return res.json() as Promise<unknown[]>;
    },
    async getById(id) {
      const res = await f(`${opts.baseUrl}/api/corridors/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`corridor getById -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const res = await f(`${opts.baseUrl}/api/corridors/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`corridor chat -> ${res.status}`);
      return res.json() as Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
    },
  };
}
