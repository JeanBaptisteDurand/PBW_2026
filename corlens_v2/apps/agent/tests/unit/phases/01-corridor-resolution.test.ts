import { describe, expect, it, type vi } from "vitest";
import { CorridorResolutionPhase } from "../../../src/services/phases/01-corridor-resolution.js";
import { captureEmit, makeCtx, makeMockDeps } from "./_helpers.js";

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
    const { emit, events } = captureEmit();

    await new CorridorResolutionPhase().run(ctx, emit);

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
    const { emit, events } = captureEmit();

    await new CorridorResolutionPhase().run(ctx, emit);

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
    const { emit, events } = captureEmit();

    await new CorridorResolutionPhase().run(ctx, emit);
    expect(events.find((e) => e.kind === "corridor-context")).toBeDefined();
    expect(ctx.state.corridor.id).toBeNull();
  });

  it("populates issuer/actor lists from currency-meta", async () => {
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" });
    const { emit } = captureEmit();
    await new CorridorResolutionPhase().run(ctx, emit);
    expect(ctx.state.srcIssuers.length).toBeGreaterThan(0);
    expect(ctx.state.dstIssuers.length).toBeGreaterThan(0);
    expect(ctx.state.isOnChain).toBe(true);
  });
});
