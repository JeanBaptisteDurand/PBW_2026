import { describe, expect, it, vi } from "vitest";
import { createAIServiceClient } from "../../src/connectors/ai-service.js";

describe("ai-service connector (path)", () => {
  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on POST", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ content: "hi", tokensIn: 1, tokensOut: 2 })),
      );
    const client = createAIServiceClient({
      baseUrl: "http://ai",
      hmacSecret: "x".repeat(32),
      fetch: fetchMock as never,
    });
    await client.complete({ purpose: "p", messages: [{ role: "user", content: "hello" }] });
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["content-type"]).toBe("application/json");
  });
});
