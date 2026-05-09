import { describe, expect, it, vi } from "vitest";
import { createWebSearchService } from "../../src/services/web-search.service.js";

const tavilyHit = {
  query: "x", answer: "yes", results: [{ title: "t", url: "https://x", snippet: "s", score: 1 }],
};

function makeDeps() {
  return {
    tavily: { search: vi.fn().mockResolvedValue(tavilyHit) },
    cache: { get: vi.fn(async () => null), set: vi.fn(async () => undefined) },
    promptLog: { insert: vi.fn(async () => ({ id: "log-1" })), rollupByPurpose: vi.fn() },
  };
}

describe("web-search.service", () => {
  it("hits tavily on cache miss, stores cache, marks fromCache=false", async () => {
    const d = makeDeps();
    const svc = createWebSearchService({ tavily: d.tavily as never, cache: d.cache as never, promptLog: d.promptLog as never, ttlHours: 24 });
    const out = await svc.search({ purpose: "p", query: "x", maxResults: 5 });
    expect(out.fromCache).toBe(false);
    expect(out.results).toHaveLength(1);
    expect(d.tavily.search).toHaveBeenCalledTimes(1);
    expect(d.cache.set).toHaveBeenCalledTimes(1);
  });

  it("returns fromCache=true on cache hit and does not call tavily", async () => {
    const d = makeDeps();
    d.cache.get = vi.fn(async () => ({ query: "x", answer: "cached", results: [] }));
    const svc = createWebSearchService({ tavily: d.tavily as never, cache: d.cache as never, promptLog: d.promptLog as never, ttlHours: 24 });
    const out = await svc.search({ purpose: "p", query: "x", maxResults: 5 });
    expect(out.fromCache).toBe(true);
    expect(out.answer).toBe("cached");
    expect(d.tavily.search).not.toHaveBeenCalled();
  });

  it("throws web_search_disabled when tavily client is null (api key absent)", async () => {
    const d = makeDeps();
    const svc = createWebSearchService({ tavily: null, cache: d.cache as never, promptLog: d.promptLog as never, ttlHours: 24 });
    await expect(svc.search({ purpose: "p", query: "x", maxResults: 1 })).rejects.toThrow(/web_search_disabled/);
  });
});
