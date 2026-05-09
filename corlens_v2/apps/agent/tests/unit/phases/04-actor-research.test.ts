import { describe, expect, it, type vi } from "vitest";
import { ActorResearchPhase } from "../../../src/services/phases/04-actor-research.js";
import { ACTORS_BY_CURRENCY } from "../../../src/services/phases/_currency-meta.js";
import { captureEmit, makeCtx, makeMockDeps } from "./_helpers.js";

describe("ActorResearchPhase", () => {
  it("emits a web-search event per top actor", async () => {
    const deps = makeMockDeps();
    (deps.ai.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "- founded 2014\n- HQ MX",
      tokensIn: 1,
      tokensOut: 1,
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.srcActors = ACTORS_BY_CURRENCY.USD ?? [];
    ctx.state.dstActors = ACTORS_BY_CURRENCY.MXN ?? [];
    const { emit, events } = captureEmit();

    await new ActorResearchPhase().run(ctx, emit);

    const searches = events.filter((e) => e.kind === "web-search");
    expect(searches.length).toBeGreaterThan(0);
  });

  it("fetches partner depth when actor has a known book mapping", async () => {
    const deps = makeMockDeps();
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.corridor.id = "usd-mxn";
    ctx.state.srcActors = ACTORS_BY_CURRENCY.USD ?? [];
    ctx.state.dstActors = ACTORS_BY_CURRENCY.MXN ?? [];
    const { emit, events } = captureEmit();

    await new ActorResearchPhase().run(ctx, emit);

    expect(deps.marketData.partnerDepth).toHaveBeenCalled();
    expect(events.find((e) => e.kind === "partner-depth")).toBeDefined();
  });

  it("does not call partner depth when no corridor.id", async () => {
    const deps = makeMockDeps();
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.srcActors = ACTORS_BY_CURRENCY.USD ?? [];
    ctx.state.dstActors = ACTORS_BY_CURRENCY.MXN ?? [];
    const { emit } = captureEmit();
    await new ActorResearchPhase().run(ctx, emit);
    expect(deps.marketData.partnerDepth).not.toHaveBeenCalled();
  });

  it("gracefully handles partner-depth failure", async () => {
    const deps = makeMockDeps();
    (deps.marketData.partnerDepth as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("md down"),
    );
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.corridor.id = "usd-mxn";
    ctx.state.srcActors = ACTORS_BY_CURRENCY.USD ?? [];
    ctx.state.dstActors = ACTORS_BY_CURRENCY.MXN ?? [];
    const { emit, events } = captureEmit();

    await new ActorResearchPhase().run(ctx, emit);
    const tr = events.find((e) => e.kind === "tool-result" && e.name === "fetchPartnerDepth");
    expect(tr).toBeDefined();
    expect(ctx.state.partnerDepth).toBeNull();
  });
});
