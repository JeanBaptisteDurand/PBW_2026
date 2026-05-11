import { describe, expect, it, type vi } from "vitest";
import { CorridorResolutionPhase } from "../../../src/services/phases/01-corridor-resolution.js";
import { collectEvents, makeCtx, makeMockDeps } from "./_helpers.js";

describe("CorridorResolutionPhase", () => {
  it("emits corridor-context with the resolved corridor", async () => {
    const deps = makeMockDeps();
    (deps.corridor.getById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "usd-mxn",
      label: "USD ↔ MXN",
      status: "GREEN",
      category: "off-chain-bridge",
    });
    const ctx = makeCtx({}, deps);

    const events = await collectEvents(new CorridorResolutionPhase(), ctx);

    const ctxEvent = events.find((e) => e.kind === "corridor-context");
    expect(ctxEvent).toBeDefined();
    expect(ctx.state.corridor.id).toBe("usd-mxn");
    expect(ctx.state.corridor.category).toBe("off-chain-bridge");
    expect(ctx.state.corridor.bridgeAsset).toBe("RLUSD");
  });

  it("emits null corridor-context when none found", async () => {
    const deps = makeMockDeps();
    (deps.corridor.getById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const ctx = makeCtx({ srcCcy: "ZZZ", dstCcy: "AAA" }, deps);

    const events = await collectEvents(new CorridorResolutionPhase(), ctx);

    const ctxEvent = events.find((e) => e.kind === "corridor-context");
    expect(ctxEvent).toBeDefined();
    expect(ctx.state.corridor.id).toBeNull();
    const reasoning = events.find((e) => e.kind === "reasoning");
    expect(reasoning).toBeDefined();
  });

  it("falls through gracefully when corridor service throws", async () => {
    const deps = makeMockDeps();
    (deps.corridor.getById as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    const ctx = makeCtx({}, deps);

    const events = await collectEvents(new CorridorResolutionPhase(), ctx);
    expect(events.find((e) => e.kind === "corridor-context")).toBeDefined();
    expect(ctx.state.corridor.id).toBeNull();
  });

  it("populates issuer/actor lists from currency-meta", async () => {
    const deps = makeMockDeps();
    (deps.corridor.getCurrencyMeta as ReturnType<typeof vi.fn>).mockImplementation(
      async (code: string) => ({
        code,
        issuers: [{ key: "gh", name: "GateHub", address: "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq" }],
        actors: [{ key: "kraken", name: "Kraken", type: "cex" }],
        updatedAt: "2026-05-12T00:00:00.000Z",
      }),
    );
    (deps.corridor.listCurrencyMeta as ReturnType<typeof vi.fn>).mockResolvedValue({
      currencies: [],
      globalHubs: [],
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    await collectEvents(new CorridorResolutionPhase(), ctx);
    expect(ctx.state.srcIssuers.length).toBeGreaterThan(0);
    expect(ctx.state.dstIssuers.length).toBeGreaterThan(0);
    expect(ctx.state.isOnChain).toBe(true);
  });

  it("populates ctx.state.currencyMeta from corridor connector", async () => {
    const deps = makeMockDeps();
    (deps.corridor.getCurrencyMeta as ReturnType<typeof vi.fn>).mockImplementation(
      async (code: string) => ({
        code,
        issuers: [],
        actors: code === "USD" ? [{ key: "k", name: "n", type: "cex" }] : [],
        updatedAt: "2026-05-12T00:00:00.000Z",
      }),
    );
    (deps.corridor.listCurrencyMeta as ReturnType<typeof vi.fn>).mockResolvedValue({
      currencies: [],
      globalHubs: [{ key: "tranglo", name: "Tranglo", type: "hub" }],
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    await collectEvents(new CorridorResolutionPhase(), ctx);
    expect(deps.corridor.getCurrencyMeta).toHaveBeenCalledWith("USD");
    expect(deps.corridor.getCurrencyMeta).toHaveBeenCalledWith("EUR");
    expect(ctx.state.currencyMeta.src?.code).toBe("USD");
    expect(ctx.state.currencyMeta.dst?.code).toBe("EUR");
    expect(ctx.state.currencyMeta.globalHubs).toHaveLength(1);
  });
});
