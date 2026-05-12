import { describe, expect, it, vi } from "vitest";
import { runGetPartnerDepth } from "../../src/tools/partner-depth.js";

const makeSnapshot = (overrides: Record<string, unknown> = {}) => ({
  actor: "bitso",
  book: "xrp_mxn",
  venue: "Bitso",
  bidCount: 20,
  askCount: 20,
  topBid: { price: "12.50", amount: "500" },
  topAsk: { price: "12.51", amount: "400" },
  spreadBps: 8,
  bidDepthBase: "1200",
  askDepthBase: "1000",
  source: "bitso-api",
  fetchedAt: "2026-05-12T00:00:00Z",
  ttlSeconds: 30,
  ...overrides,
});

describe("get_partner_depth tool", () => {
  it("returns formatted depth info", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify(makeSnapshot()), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await runGetPartnerDepth("bitso", "xrp_mxn", {
      fetchImpl: fakeFetch,
      baseUrl: "http://api",
    });

    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("Bitso");
    expect(result.content[0].text).toContain("8");
    expect(fakeFetch).toHaveBeenCalledWith(
      "http://api/corridors/partner-depth/bitso/xrp_mxn",
    );
  });

  it("includes spread and top bid/ask in output", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify(makeSnapshot()), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await runGetPartnerDepth("bitso", "xrp_mxn", {
      fetchImpl: fakeFetch,
      baseUrl: "http://api",
    });

    expect(result.content[0].text).toContain("12.50");
    expect(result.content[0].text).toContain("12.51");
  });

  it("returns 'no data' message when spreadBps is null and counts are zero", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify(
          makeSnapshot({
            bidCount: 0,
            askCount: 0,
            topBid: null,
            topAsk: null,
            spreadBps: null,
          }),
        ),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const result = await runGetPartnerDepth("bitso", "xrp_mxn", {
      fetchImpl: fakeFetch,
      baseUrl: "http://api",
    });

    expect(result.content[0].text).toContain("No partner-depth data");
  });

  it("throws on non-OK HTTP status", async () => {
    const fakeFetch = vi.fn(async () =>
      new Response("server error", { status: 503 }),
    ) as unknown as typeof fetch;

    await expect(
      runGetPartnerDepth("bitso", "xrp_mxn", {
        fetchImpl: fakeFetch,
        baseUrl: "http://api",
      }),
    ).rejects.toThrow(/503/);
  });
});
