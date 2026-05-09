import { describe, expect, it, vi } from "vitest";
import { createMarketDataClient } from "../../src/connectors/market-data.js";

describe("market-data connector (corridor)", () => {
  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on GET", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({})));
    const client = createMarketDataClient({
      baseUrl: "http://md",
      hmacSecret: "x".repeat(32),
      fetch: fetchMock as never,
    });
    await client.partnerDepth("rActor", "USD-XRP");
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({})));
    const client = createMarketDataClient({
      baseUrl: "http://md",
      hmacSecret: "x".repeat(32),
      fetch: fetchMock as never,
    });
    await client.pathFind({
      sourceAccount: "rA",
      destinationAccount: "rB",
      destinationAmount: { currency: "XRP", value: "1" },
    });
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["content-type"]).toBe("application/json");
  });
});
