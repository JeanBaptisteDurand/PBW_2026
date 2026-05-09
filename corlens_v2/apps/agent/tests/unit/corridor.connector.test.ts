import { describe, expect, it, vi } from "vitest";
import { createCorridorClient } from "../../src/connectors/corridor.js";

const SECRET = "x".repeat(32);

describe("corridor connector (agent)", () => {
  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on GET list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify([])));
    const client = createCorridorClient({
      baseUrl: "http://corridor:3004",
      hmacSecret: SECRET,
      fetch: fetchMock as never,
    });
    await client.list({ tier: 1, limit: 10 });
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on POST chat", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ answer: "ok", sources: [] })));
    const client = createCorridorClient({
      baseUrl: "http://corridor:3004",
      hmacSecret: SECRET,
      fetch: fetchMock as never,
    });
    await client.chat({ message: "hi" });
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["content-type"]).toBe("application/json");
  });
});
