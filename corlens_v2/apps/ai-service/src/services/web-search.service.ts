import type { TavilyClient } from "../connectors/tavily.js";
import type { WebSearchCacheRepo } from "../repositories/web-search-cache.repo.js";
import type { PromptLogRepo } from "../repositories/prompt-log.repo.js";
import type { WebSearchResponse } from "@corlens/contracts/dist/ai.js";
import { createHash } from "node:crypto";

export type WebSearchServiceOptions = {
  tavily: TavilyClient | null;
  cache: WebSearchCacheRepo;
  promptLog: PromptLogRepo;
  ttlHours: number;
};

export type WebSearchService = ReturnType<typeof createWebSearchService>;

export function createWebSearchService(opts: WebSearchServiceOptions) {
  return {
    async search(input: { purpose: string; query: string; maxResults: number }): Promise<WebSearchResponse> {
      if (!opts.tavily) {
        throw new Error("web_search_disabled");
      }

      const cacheKey = `${input.query}::${input.maxResults}`;
      const cached = await opts.cache.get(cacheKey);
      if (cached) {
        return { ...(cached as Omit<WebSearchResponse, "fromCache">), fromCache: true };
      }

      const start = Date.now();
      const result = await opts.tavily.search({ query: input.query, maxResults: input.maxResults });
      const response: Omit<WebSearchResponse, "fromCache"> = {
        query: result.query,
        answer: result.answer,
        results: result.results,
      };

      await Promise.all([
        opts.cache.set(cacheKey, "tavily", response, opts.ttlHours),
        opts.promptLog.insert({
          purpose: input.purpose,
          model: "tavily/search",
          promptHash: createHash("sha256").update(input.query).digest("hex").slice(0, 16),
          prompt: { query: input.query, maxResults: input.maxResults },
          response: { resultCount: result.results.length, hasAnswer: !!result.answer },
          latencyMs: Date.now() - start,
        }).catch(() => undefined),
      ]);

      return { ...response, fromCache: false };
    },
  };
}
