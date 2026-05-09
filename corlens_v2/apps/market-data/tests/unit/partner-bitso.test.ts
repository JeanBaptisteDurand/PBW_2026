import { describe, expect, it, vi } from "vitest";
import { fetchBitsoDepth } from "../../src/connectors/partner-bitso.js";

describe("partner-bitso", () => {
  it("parses Bitso order_book payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        payload: {
          bids: [
            { price: "0.5", amount: "100" },
            { price: "0.49", amount: "50" },
          ],
          asks: [
            { price: "0.51", amount: "120" },
            { price: "0.52", amount: "60" },
          ],
        },
      }),
    });
    const snapshot = await fetchBitsoDepth({
      book: "xrp_mxn",
      fetch: fetchMock as unknown as typeof fetch,
      ttlSeconds: 60,
    });
    expect(snapshot.actor).toBe("bitso");
    expect(snapshot.book).toBe("xrp_mxn");
    expect(snapshot.bidCount).toBe(2);
    expect(snapshot.askCount).toBe(2);
    expect(snapshot.topBid).toEqual({ price: "0.5", amount: "100" });
    expect(snapshot.topAsk).toEqual({ price: "0.51", amount: "120" });
    expect(snapshot.spreadBps).toBeGreaterThan(0);
    expect(snapshot.bidDepthBase).toBe("150.00");
    expect(snapshot.askDepthBase).toBe("180.00");
  });

  it("throws on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      fetchBitsoDepth({ book: "x", fetch: fetchMock as unknown as typeof fetch, ttlSeconds: 60 }),
    ).rejects.toThrow();
  });
});
