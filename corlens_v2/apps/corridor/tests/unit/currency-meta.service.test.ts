import { describe, expect, it, vi } from "vitest";
import { createCurrencyMetaService } from "../../src/services/currency-meta.service.js";

describe("currency-meta.service", () => {
  it("returns one CurrencyMeta by code, normalized to ISO datetime", async () => {
    const repo = {
      findByCode: vi.fn(async (code: string) =>
        code === "USD"
          ? {
              code: "USD",
              issuers: [
                {
                  key: "rlusd",
                  name: "Ripple (RLUSD)",
                  address: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
                },
              ],
              actors: [{ key: "coinbase", name: "Coinbase", type: "cex" }],
              updatedAt: new Date("2026-05-11T00:00:00Z"),
            }
          : null,
      ),
      list: vi.fn(async () => []),
    };
    const svc = createCurrencyMetaService({ repo, globalHubs: [] });
    const usd = await svc.getByCode("USD");
    expect(usd?.code).toBe("USD");
    expect(usd?.issuers).toHaveLength(1);
    expect(usd?.updatedAt).toBe("2026-05-11T00:00:00.000Z");
    expect(await svc.getByCode("ZZZ")).toBeNull();
  });

  it("list returns currencies + globalHubs", async () => {
    const repo = {
      findByCode: vi.fn(),
      list: vi.fn(async () => [
        { code: "EUR", issuers: [], actors: [], updatedAt: new Date("2026-05-11T00:00:00Z") },
      ]),
    };
    const hubs = [{ key: "tranglo", name: "Tranglo", type: "hub" }];
    const svc = createCurrencyMetaService({ repo, globalHubs: hubs });
    const result = await svc.list();
    expect(result.currencies).toHaveLength(1);
    expect(result.globalHubs).toEqual(hubs);
  });
});
