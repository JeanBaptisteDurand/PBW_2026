import { describe, expect, it } from "vitest";
import { ReportPhase } from "../../../src/services/phases/09-report.js";
import { captureEmit, makeCtx } from "./_helpers.js";

describe("ReportPhase", () => {
  it("emits a report event with markdown containing required sections", async () => {
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN", amount: "5000" });
    ctx.state.corridor.id = "usd-mxn";
    ctx.state.corridor.label = "USD ↔ MXN";
    ctx.state.corridor.status = "GREEN";
    ctx.state.corridor.category = "off-chain-bridge";
    ctx.state.verdict = "OFF_CHAIN_ROUTED";
    ctx.state.riskScore = 0.3;

    const { emit, events } = captureEmit();
    await new ReportPhase().run(ctx, emit);

    const ev = events.find((e) => e.kind === "report");
    expect(ev).toBeDefined();
    if (ev?.kind !== "report") throw new Error();
    expect(ev.markdown).toContain("# Corlens Safe Path Report");
    expect(ev.markdown).toContain("Executive Summary");
    expect(ev.markdown).toContain("Route");
    expect(ev.markdown).toContain("Risk Flags");
    expect(ev.markdown).toContain("Compliance Justification");
    expect(ev.markdown).toContain("Disclaimer");
  });

  it("populates resultJson with corridor + verdict info", async () => {
    const ctx = makeCtx();
    ctx.state.verdict = "SAFE";
    ctx.state.riskScore = 0.2;
    const { emit } = captureEmit();
    await new ReportPhase().run(ctx, emit);
    expect(ctx.state.resultJson).toMatchObject({ verdict: "SAFE", riskScore: 0.2 });
  });

  it("promotes verdict from NO_PATHS to OFF_CHAIN_ROUTED when corridor is off-chain", async () => {
    const ctx = makeCtx();
    ctx.state.corridor.id = "usd-mxn";
    ctx.state.isOnChain = false;
    ctx.state.verdict = "NO_PATHS";
    const { emit } = captureEmit();
    await new ReportPhase().run(ctx, emit);
    expect(ctx.state.verdict).toBe("OFF_CHAIN_ROUTED");
  });

  it("falls back to raw reasoning when AI polish fails", async () => {
    const ctx = makeCtx();
    ctx.state.verdict = "NO_PATHS";
    ctx.deps.ai.complete = async () => {
      throw new Error("ai down");
    };
    const { emit } = captureEmit();
    await new ReportPhase().run(ctx, emit);
    expect(ctx.state.reasoning.length).toBeGreaterThan(0);
    expect(ctx.state.reportMarkdown).not.toBeNull();
  });
});
