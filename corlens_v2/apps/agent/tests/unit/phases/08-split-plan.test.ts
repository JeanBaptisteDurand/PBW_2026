import { describe, expect, it } from "vitest";
import { SplitPlanPhase, computeSplitPlan } from "../../../src/services/phases/08-split-plan.js";
import { captureEmit, makeCtx } from "./_helpers.js";

describe("computeSplitPlan", () => {
  it("returns null for small amounts", () => {
    expect(computeSplitPlan(1000, 2, null)).toBeNull();
  });

  it("returns null when only 1 surviving path and no partner depth", () => {
    expect(computeSplitPlan(200_000, 1, null)).toBeNull();
  });

  it("returns 60/40 split for large amount with 2+ paths", () => {
    const plan = computeSplitPlan(200_000, 2, null);
    expect(plan).not.toBeNull();
    expect(plan?.length).toBe(2);
    expect(plan?.[0]?.percentage).toBe(60);
    expect(plan?.[1]?.percentage).toBe(40);
  });

  it("uses partner depth when available", () => {
    const plan = computeSplitPlan(200_000, 2, {
      bidDepthBase: "10000",
      venue: "Bitso",
    });
    expect(plan).not.toBeNull();
    expect(plan?.[0]?.percentage).toBeLessThanOrEqual(80);
  });
});

describe("SplitPlanPhase", () => {
  it("emits split-plan event when plan is computed", async () => {
    const ctx = makeCtx({ amount: "200000" });
    ctx.state.paths = [{}, {}, {}];
    ctx.state.rejected = [];
    const { emit, events } = captureEmit();
    await new SplitPlanPhase().run(ctx, emit);
    expect(events.find((e) => e.kind === "split-plan")).toBeDefined();
  });

  it("does not emit when amount is small", async () => {
    const ctx = makeCtx({ amount: "100" });
    const { emit, events } = captureEmit();
    await new SplitPlanPhase().run(ctx, emit);
    expect(events.find((e) => e.kind === "split-plan")).toBeUndefined();
  });
});
