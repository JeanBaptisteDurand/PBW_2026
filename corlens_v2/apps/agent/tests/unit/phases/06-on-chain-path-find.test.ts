import { type Mock, describe, expect, it } from "vitest";
import { OnChainPathFindPhase } from "../../../src/services/phases/06-on-chain-path-find.js";
import { ISSUERS_BY_CURRENCY } from "../../fixtures/currency-meta-fixtures.js";
import { collectEvents, makeCtx, makeMockDeps } from "./_helpers.js";

describe("OnChainPathFindPhase", () => {
  it("skips when no on-chain issuers", async () => {
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" });
    ctx.state.isOnChain = false;
    const events = await collectEvents(new OnChainPathFindPhase(), ctx);
    expect(events.find((e) => e.kind === "reasoning")).toBeDefined();
    expect(events.find((e) => e.kind === "tool-call")).toBeUndefined();
  });

  it("emits path-active for each surviving alternative", async () => {
    const deps = makeMockDeps();
    (deps.marketData.pathFind as Mock).mockResolvedValue({
      result: {
        alternatives: [
          {
            paths_computed: [[{ account: "rHopA" }, { account: "rHopB" }]],
            source_amount: "100",
          },
          {
            paths_computed: [[{ account: "rHopA" }, { account: "rHopC" }]],
            source_amount: "100",
          },
        ],
      },
    });
    (deps.path.quickEvalRisk as Mock).mockImplementation(async (address: string) => ({
      address,
      score: 10,
      flags: [],
      summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
    }));
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;
    const events = await collectEvents(new OnChainPathFindPhase(), ctx);

    expect(events.filter((e) => e.kind === "path-active").length).toBeGreaterThan(0);
    expect(ctx.state.verdict).toBe("SAFE");
  });

  it("rejects all paths when corridor.status is RED", async () => {
    const deps = makeMockDeps();
    (deps.marketData.pathFind as Mock).mockResolvedValue({
      result: {
        alternatives: [{ paths_computed: [[{ account: "rHopA" }]], source_amount: "100" }],
      },
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;
    ctx.state.corridor.status = "RED";
    const events = await collectEvents(new OnChainPathFindPhase(), ctx);

    expect(events.find((e) => e.kind === "path-rejected")).toBeDefined();
    expect(ctx.state.verdict).toBe("REJECTED");
  });

  it("handles pathFind failure gracefully", async () => {
    const deps = makeMockDeps();
    (deps.marketData.pathFind as Mock).mockRejectedValue(new Error("xrpl down"));
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;
    const events = await collectEvents(new OnChainPathFindPhase(), ctx);
    const tr = events.find(
      (e) => e.kind === "tool-result" && e.summary.includes("Path find failed"),
    );
    expect(tr).toBeDefined();
  });

  it("emits account-crawled per unique hop, computes max score, rejects path > tolerance", async () => {
    const deps = makeMockDeps();
    // Two paths: path1 has rA + rB (safe), path2 has rA + rRisky (risky)
    (deps.marketData.pathFind as Mock).mockResolvedValue({
      result: {
        alternatives: [
          {
            paths_computed: [[{ account: "rA" }, { account: "rB" }]],
            source_amount: "100",
          },
          {
            paths_computed: [[{ account: "rA" }, { account: "rRisky" }]],
            source_amount: "100",
          },
        ],
      },
    });
    (deps.path.quickEvalRisk as Mock).mockImplementation(async (address: string) => ({
      address,
      score: address === "rRisky" ? 80 : 10,
      flags: [],
      summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
    }));
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR", maxRiskTolerance: "MED" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;

    const events = await collectEvents(new OnChainPathFindPhase(), ctx);

    const crawled = events.filter((e) => e.kind === "account-crawled");
    // rA, rB, rRisky — rA deduped across paths (only emitted once)
    expect(crawled).toHaveLength(3);
    // path2 rejected (max score 80 > tolerance 60)
    expect(ctx.state.rejected).toHaveLength(1);
    expect(ctx.state.verdict).toBe("SAFE");
    // riskScore = max of accepted paths' max-scores = max(10, 10) = 10
    expect(ctx.state.riskScore).toBe(10);
  });

  it("dedup: account-crawled not re-emitted for addresses already in crawledAddresses", async () => {
    const deps = makeMockDeps();
    (deps.marketData.pathFind as Mock).mockResolvedValue({
      result: {
        alternatives: [
          {
            paths_computed: [[{ account: "rAlreadyCrawled" }]],
            source_amount: "100",
          },
        ],
      },
    });
    (deps.path.quickEvalRisk as Mock).mockImplementation(async (address: string) => ({
      address,
      score: 5,
      flags: [],
      summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
    }));
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;
    // Pre-populate crawledAddresses as if Phase 05 already saw this address
    ctx.state.crawledAddresses.add("rAlreadyCrawled");

    const events = await collectEvents(new OnChainPathFindPhase(), ctx);

    const crawled = events.filter((e) => e.kind === "account-crawled");
    // Should not re-emit since it was already in crawledAddresses
    expect(crawled).toHaveLength(0);
    // But path should still be scored/accepted (quickEvalRisk still called for scoring)
    expect(ctx.state.verdict).toBe("SAFE");
  });

  it("sets verdict to REJECTED when all paths exceed risk tolerance", async () => {
    const deps = makeMockDeps();
    (deps.marketData.pathFind as Mock).mockResolvedValue({
      result: {
        alternatives: [
          {
            paths_computed: [[{ account: "rVeryRisky" }]],
            source_amount: "100",
          },
        ],
      },
    });
    (deps.path.quickEvalRisk as Mock).mockResolvedValue({
      address: "rVeryRisky",
      score: 90,
      flags: [{ flag: "BLACKLISTED", severity: "HIGH", detail: "OFAC listed" }],
      summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
    });
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "EUR", maxRiskTolerance: "MED" }, deps);
    ctx.state.srcIssuers = ISSUERS_BY_CURRENCY.USD ?? [];
    ctx.state.dstIssuers = ISSUERS_BY_CURRENCY.EUR ?? [];
    ctx.state.isOnChain = true;

    const events = await collectEvents(new OnChainPathFindPhase(), ctx);

    expect(events.find((e) => e.kind === "path-rejected")).toBeDefined();
    expect(ctx.state.verdict).toBe("REJECTED");
    expect(ctx.state.riskScore).toBeNull();
  });
});
