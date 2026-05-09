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

export function createPathClient(opts: { baseUrl: string; fetch?: typeof fetch }): PathClient {
  const f = opts.fetch ?? fetch;
  return {
    async analyze(input) {
      const res = await f(`${opts.baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`path analyze -> ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },
    async getAnalysis(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getAnalysis -> ${res.status}`);
      return res.json();
    },
    async getGraph(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}/graph`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getGraph -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const res = await f(
        `${opts.baseUrl}/api/analysis/${encodeURIComponent(input.analysisId)}/chat`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ message: input.message }),
        },
      );
      if (!res.ok) throw new Error(`path chat -> ${res.status}`);
      return res.json() as Promise<{
        answer: string;
        sources: Array<{ id: string; snippet: string }>;
      }>;
    },
    async history(address) {
      const res = await f(`${opts.baseUrl}/api/history/${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error(`path history -> ${res.status}`);
      return res.json();
    },
  };
}
