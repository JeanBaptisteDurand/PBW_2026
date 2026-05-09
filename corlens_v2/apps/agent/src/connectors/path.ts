import { hmacSigner } from "@corlens/clients";

export type PathClient = {
  analyze(input: { seedAddress: string; seedLabel?: string; depth?: number }): Promise<{
    id: string;
    status: string;
  }>;
  getAnalysis(id: string): Promise<unknown | null>;
  getGraph(id: string): Promise<unknown | null>;
  chat(input: { analysisId: string; message: string }): Promise<{
    answer: string;
    sources: Array<{ id: string; snippet: string }>;
  }>;
  history(address: string): Promise<unknown>;
};

export type PathClientOptions = {
  baseUrl: string;
  hmacSecret: string;
  fetch?: typeof fetch;
};

export function createPathClient(opts: PathClientOptions): PathClient {
  const f = opts.fetch ?? fetch;
  const sign = hmacSigner({ secret: opts.hmacSecret });
  return {
    async analyze(input) {
      const bodyStr = JSON.stringify(input);
      const res = await f(`${opts.baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json", ...sign(bodyStr) },
        body: bodyStr,
      });
      if (!res.ok) throw new Error(`path analyze -> ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },
    async getAnalysis(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}`, {
        headers: sign(""),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getAnalysis -> ${res.status}`);
      return res.json();
    },
    async getGraph(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}/graph`, {
        headers: sign(""),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getGraph -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const bodyStr = JSON.stringify({ message: input.message });
      const res = await f(
        `${opts.baseUrl}/api/analysis/${encodeURIComponent(input.analysisId)}/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json", ...sign(bodyStr) },
          body: bodyStr,
        },
      );
      if (!res.ok) throw new Error(`path chat -> ${res.status}`);
      return res.json() as Promise<{
        answer: string;
        sources: Array<{ id: string; snippet: string }>;
      }>;
    },
    async history(address) {
      const res = await f(`${opts.baseUrl}/api/history/${encodeURIComponent(address)}`, {
        headers: sign(""),
      });
      if (!res.ok) throw new Error(`path history -> ${res.status}`);
      return res.json();
    },
  };
}
