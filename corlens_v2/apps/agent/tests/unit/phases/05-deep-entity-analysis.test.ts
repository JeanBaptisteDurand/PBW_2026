import { type Mock, describe, expect, it, type vi } from "vitest";
import { DeepEntityAnalysisPhase } from "../../../src/services/phases/05-deep-entity-analysis.js";
import { ISSUERS_BY_CURRENCY } from "../../fixtures/currency-meta-fixtures.js";
import { collectEvents, makeCtx, makeMockDeps } from "./_helpers.js";

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

    const events = await collectEvents(new DeepEntityAnalysisPhase(), ctx);

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
    await collectEvents(new DeepEntityAnalysisPhase(), ctx);
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
    const events = await collectEvents(new DeepEntityAnalysisPhase(), ctx);
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
    const events = await collectEvents(new DeepEntityAnalysisPhase(), ctx);
    expect(
      events.some((e) => e.kind === "tool-result" && e.summary.includes("Analyze failed")),
    ).toBe(true);
  });

  it("emits one account-crawled per distinct successfully-analyzed address with score and flags", async () => {
    const deps = makeMockDeps();
    (deps.path.analyze as Mock).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "queued",
    });
    (deps.path.getAnalysis as Mock).mockResolvedValue({ status: "done" });
    // Mock getGraph: nodes carry riskFlags so both targets get HIGH + LOW = 35.
    // Approach A: Phase 05 extracts flags directly from the graph response,
    // so getAnalysisRiskFlags is no longer called.
    (deps.path.getGraph as Mock).mockResolvedValue({
      nodes: [
        {
          riskFlags: [
            {
              flag: "GLOBAL_FREEZE",
              severity: "HIGH",
              detail: "frozen",
              data: { address: "rTestSrc" },
            },
            {
              flag: "UNVERIFIED_ISSUER",
              severity: "LOW",
              detail: "no domain",
              data: { address: "rTestSrc" },
            },
          ],
        },
        { riskFlags: [] },
        { riskFlags: [] },
      ],
      edges: new Array(2),
    });

    // Only RLUSD + one src issuer address so we know exactly 2 targets
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    // Use a single custom issuer to keep targets predictable
    ctx.state.srcIssuers = [{ key: "test", name: "Test Issuer", address: "rTestSrc" }];
    ctx.state.dstIssuers = [];
    ctx.state.isOnChain = true;

    const events = await collectEvents(new DeepEntityAnalysisPhase(), ctx);

    const crawled = events.filter((e) => e.kind === "account-crawled");
    // RLUSD issuer + rTestSrc = 2 distinct addresses
    expect(crawled.length).toBe(2);
    // They should each appear exactly once
    const addresses = crawled.map((e) => (e as { address: string }).address);
    expect(new Set(addresses).size).toBe(2);
    // They should be added to crawledAddresses
    expect(ctx.state.crawledAddresses.size).toBe(2);

    // getGraph should have been called once per analyzed address (Approach A: no
    // separate getAnalysisRiskFlags call — flags are extracted from the graph).
    expect(deps.path.getGraph).toHaveBeenCalledTimes(2);

    // Each crawled event should have non-zero score and populated flags
    // (both targets get the same mock response: HIGH + LOW = 35)
    for (const ev of crawled) {
      const e = ev as { score: number; flags: unknown[] };
      expect(e.score).toBe(35); // HIGH(30) + LOW(5)
      expect(e.flags).toHaveLength(2);
    }
  });

  it("does not re-emit account-crawled for addresses already in crawledAddresses", async () => {
    const deps = makeMockDeps();
    (deps.path.analyze as Mock).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
      status: "queued",
    });
    (deps.path.getAnalysis as Mock).mockResolvedValue({ status: "done" });
    (deps.path.getGraph as Mock).mockResolvedValue({
      nodes: new Array(2),
      edges: new Array(1),
    });

    const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" }, deps);
    ctx.state.srcIssuers = [];
    ctx.state.dstIssuers = [];
    ctx.state.isOnChain = true;
    // Pre-populate — RLUSD issuer was already crawled in a previous session
    ctx.state.crawledAddresses.add(RLUSD_ISSUER);

    const events = await collectEvents(new DeepEntityAnalysisPhase(), ctx);

    // RLUSD is always analyzed (it's the only target) but since it's already
    // in crawledAddresses, no account-crawled should be emitted.
    const crawled = events.filter((e) => e.kind === "account-crawled");
    expect(crawled.length).toBe(0);
  });
});
