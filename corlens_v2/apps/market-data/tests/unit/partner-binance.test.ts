import { describe, expect, it, vi } from "vitest";
import { fetchBinanceDepth } from "../../src/connectors/partner-binance.js";

describe("partner-binance", () => {
  it("parses Binance depth payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bids: [["0.50000000", "100.0"], ["0.49000000", "50.0"]],
        asks: [["0.51000000", "120.0"], ["0.52000000", "60.0"]],
      }),
    });
    const snapshot = await fetchBinanceDepth({ symbol: "XRPUSDT", fetch: fetchMock as unknown as typeof fetch, ttlSeconds: 60 });
    expect(snapshot.actor).toBe("binance");
    expect(snapshot.book).toBe("XRPUSDT");
    expect(snapshot.bidCount).toBe(2);
    expect(snapshot.topBid).toEqual({ price: "0.50000000", amount: "100.0" });
    expect(snapshot.spreadBps).toBeGreaterThan(0);
  });
});
