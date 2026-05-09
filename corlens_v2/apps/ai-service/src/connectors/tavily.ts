export type SearchInput = {
  query: string;
  maxResults: number;
};

export type SearchOutput = {
  query: string;
  answer: string | null;
  results: Array<{ title: string; url: string; snippet: string; score?: number }>;
};

export interface TavilyClient {
  search(input: SearchInput): Promise<SearchOutput>;
}

export type TavilyClientOptions = {
  apiKey: string;
  fetch?: typeof fetch;
};

const TAVILY_URL = "https://api.tavily.com/search";

export function createTavilyClient(opts: TavilyClientOptions): TavilyClient {
  const fetchImpl = opts.fetch ?? fetch;
  return {
    async search(input) {
      const body = {
        api_key: opts.apiKey,
        query: input.query,
        max_results: input.maxResults,
        include_answer: true,
        search_depth: "basic",
      };
      const res = await fetchImpl(TAVILY_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Tavily search failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        query: string;
        answer: string | null;
        results: Array<{ title: string; url: string; content: string; score?: number }>;
      };
      return {
        query: json.query,
        answer: json.answer,
        results: json.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content, score: r.score })),
      };
    },
  };
}
