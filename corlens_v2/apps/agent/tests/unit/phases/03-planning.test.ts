import { describe, expect, it, type vi } from "vitest";
import { PlanningPhase } from "../../../src/services/phases/03-planning.js";
import { collectEvents, makeCtx, makeMockDeps } from "./_helpers.js";

describe("PlanningPhase", () => {
  it("emits reasoning with the AI plan content", async () => {
    const deps = makeMockDeps();
    (deps.ai.complete as ReturnType<typeof vi.fn>).mockResolvedValue({
      content: "Plan: route via Bitso.",
      tokensIn: 1,
      tokensOut: 1,
    });
    const ctx = makeCtx({}, deps);

    const events = await collectEvents(new PlanningPhase(), ctx);

    const r = events.find((e) => e.kind === "reasoning");
    expect(r).toBeDefined();
    expect(ctx.state.plan).toBe("Plan: route via Bitso.");
  });

  it("calls ai.complete with purpose=agent.plan", async () => {
    const deps = makeMockDeps();
    const ctx = makeCtx({}, deps);
    await collectEvents(new PlanningPhase(), ctx);
    const call = (deps.ai.complete as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      purpose: string;
    };
    expect(call.purpose).toBe("agent.plan");
  });

  it("swallows AI errors", async () => {
    const deps = makeMockDeps();
    (deps.ai.complete as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("ai dead"));
    const ctx = makeCtx({}, deps);
    const events = await collectEvents(new PlanningPhase(), ctx);
    expect(events.find((e) => e.kind === "tool-result")).toBeDefined();
    expect(ctx.state.plan).toBeNull();
  });
});
