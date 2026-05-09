import { describe, expect, it, vi } from "vitest";
import { createIdentityClient } from "../../src/connectors/identity.js";

describe("identity connector", () => {
  it("getPremiumStatus builds the correct URL with QS-encoded userId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ isPremium: true, expiresAt: null }),
    });

    const client = createIdentityClient({
      baseUrl: "http://identity:3001",
      hmacSecret: "x".repeat(32),
      fetch: fetchMock as unknown as typeof fetch,
    });
    const out = await client.getPremiumStatus("user with spaces");

    expect(out).toEqual({ isPremium: true, expiresAt: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [url] = call;
    expect(url).toBe("http://identity:3001/internal/premium-status?userId=user%20with%20spaces");
  });

  it("attaches x-corlens-ts and x-corlens-sig HMAC headers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ isPremium: false, expiresAt: null }),
    });
    const client = createIdentityClient({
      baseUrl: "http://identity:3001/",
      hmacSecret: "y".repeat(32),
      fetch: fetchMock as unknown as typeof fetch,
    });
    await client.getPremiumStatus("11111111-1111-1111-1111-111111111111");
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
  });

  it("throws on non-2xx responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    });
    const client = createIdentityClient({
      baseUrl: "http://identity:3001",
      hmacSecret: "z".repeat(32),
      fetch: fetchMock as unknown as typeof fetch,
    });
    await expect(client.getPremiumStatus("u1")).rejects.toThrow(/500/);
  });
});
