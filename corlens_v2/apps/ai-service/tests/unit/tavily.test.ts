import { describe, expect, it, vi } from "vitest";
import { createTavilyClient } from "../../src/connectors/tavily.js";

describe("tavily client", () => {
  it("POSTs to /search with API key + query and parses results", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        query: "RLUSD issuer",
        answer: "RLUSD is issued by Ripple's RLUSD account on XRPL.",
        results: [
          { title: "RLUSD info", url: "https://example.com/rlusd", content: "RLUSD on XRPL...", score: 0.95 },
          { title: "RLUSD launch", url: "https://example.com/launch", content: "Launched by Ripple", score: 0.80 },
        ],
      }),
    });

    const client = createTavilyClient({ apiKey: "tvly-test", fetch: fetchMock as unknown as typeof fetch });
    const out = await client.search({ query: "RLUSD issuer", maxResults: 5 });

    expect(out.query).toBe("RLUSD issuer");
    expect(out.answer).toContain("RLUSD");
    expect(out.results).toHaveLength(2);
    expect(out.results[0]).toEqual({ title: "RLUSD info", url: "https://example.com/rlusd", snippet: "RLUSD on XRPL...", score: 0.95 });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "content-type": "application/json" }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.api_key).toBe("tvly-test");
    expect(body.query).toBe("RLUSD issuer");
    expect(body.max_results).toBe(5);
    expect(body.include_answer).toBe(true);
  });

  it("throws on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" });
    const client = createTavilyClient({ apiKey: "bad", fetch: fetchMock as unknown as typeof fetch });
    await expect(client.search({ query: "x", maxResults: 1 })).rejects.toThrow(/401/);
  });

  it("returns empty results when Tavily returns no hits", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ query: "no hits", answer: null, results: [] }),
    });
    const client = createTavilyClient({ apiKey: "tvly-test", fetch: fetchMock as unknown as typeof fetch });
    const out = await client.search({ query: "no hits", maxResults: 3 });
    expect(out.results).toEqual([]);
    expect(out.answer).toBeNull();
  });
});
