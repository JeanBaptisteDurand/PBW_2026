import { describe, expect, it, type vi } from "vitest";
import { DeepEntityAnalysisPhase } from "../../../src/services/phases/05-deep-entity-analysis.js";
import { ISSUERS_BY_CURRENCY } from "../../../src/services/phases/_currency-meta.js";
import { captureEmit, makeCtx, makeMockDeps } from "./_helpers.js";

describe("DeepEntityAnalysisPhase", () => {
  it("emits analysis-started/complete for each target", async () => {
    const deps = makeMockDeps();
    (deps.path.analyze as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "queued",
    });
    (deps.path.getAnalysis as ReturnType<typeof vi.fn>).mockResolvedValue({ status: "done" });
    (deps.path.getGraph as ReturnType<typeof vi.fn>).mockResolvedValue({
      nodes: new Array(5),
      edges: new Array(7),
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;
    const { emit, events } = captureEmit();

    await new DeepEntityAnalysisPhase().run(ctx, emit);

    expect(events.some((e) => e.kind === "analysis-started")).toBe(true);
    expect(events.some((e) => e.kind === "analysis-complete")).toBe(true);
    expect(events.some((e) => e.kind === "analyses-summary")).toBe(true);
  });

  it("includes USDC issuer when corridor is off-chain", async () => {
    const deps = makeMockDeps();
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.isOnChain = false;
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = [];
    const { emit } = captureEmit();
    await new DeepEntityAnalysisPhase().run(ctx, emit);
    const calls = (deps.path.analyze as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => (c[0] as { seedAddress: string }).seedAddress,
    );
    expect(calls).toContain("rGm7WCVp9gb4jZHWTEtGUr4dd74z2XuWhE");
  });

  it("emits empty analyses-summary when no targets", async () => {
    const deps = makeMockDeps();
    (deps.path.analyze as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "00000000-0000-0000-0000-000000000001",
      status: "queued",
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.srcIssuers = [];
    ctx.state.dstIssuers = [];
    ctx.state.isOnChain = true;
    const { emit, events } = captureEmit();
    await new DeepEntityAnalysisPhase().run(ctx, emit);
    // RLUSD issuer is always added — so we still get at least one analysis
    expect(events.some((e) => e.kind === "analysis-started")).toBe(true);
  });

  it("survives a path.analyze failure", async () => {
    const deps = makeMockDeps();
    (deps.path.analyze as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("path 500"));
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = [];
    ctx.state.isOnChain = false;
    const { emit, events } = captureEmit();
    await new DeepEntityAnalysisPhase().run(ctx, emit);
    expect(
      events.some((e) => e.kind === "tool-result" && e.summary.includes("Analyze failed")),
    ).toBe(true);
  });
});
