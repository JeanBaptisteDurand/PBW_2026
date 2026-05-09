import { describe, expect, it, vi } from "vitest";
import { createMarketDataClient } from "../../src/connectors/market-data.js";

describe("market-data connector", () => {
  it("encodes addresses and forwards query params", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ ok: true }))));
    const client = createMarketDataClient({ baseUrl: "http://md", fetch: fetchMock as never });

    await client.trustLines("rABC", { limit: 100 });
    expect(fetchMock).toHaveBeenCalledWith("http://md/xrpl/account/rABC/lines?limit=100");

    await client.bookOffers({
      takerGetsCurrency: "USD",
      takerGetsIssuer: "rIss",
      takerPaysCurrency: "XRP",
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://md/xrpl/book?takerGetsCurrency=USD&takerGetsIssuer=rIss&takerPaysCurrency=XRP",
    );
  });

  it("throws on non-ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    const client = createMarketDataClient({ baseUrl: "http://md", fetch: fetchMock as never });
    await expect(client.accountInfo("rABC")).rejects.toThrow(/502/);
  });
});
