import { describe, expect, it, type vi } from "vitest";
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
    (deps.marketData.pathFind as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: {
        alternatives: [
          { paths_computed: [[]], source_amount: "100" },
          { paths_computed: [[], []], source_amount: "100" },
        ],
      },
    });
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
    (deps.marketData.pathFind as ReturnType<typeof vi.fn>).mockResolvedValue({
      result: { alternatives: [{ paths_computed: [[]], source_amount: "100" }] },
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
    (deps.marketData.pathFind as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("xrpl down"),
    );
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
});
