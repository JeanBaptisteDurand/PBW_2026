import { describe, expect, it } from "vitest";
import { ACTORS_BY_CURRENCY } from "../../../src/data/currency-meta.js";
import { OffChainBridgePhase } from "../../../src/services/phases/07-off-chain-bridge.js";
import { collectEvents, makeCtx } from "./_helpers.js";

describe("OffChainBridgePhase", () => {
  it("emits reasoning + tool-result when no on-chain paths", async () => {
    const ctx = makeCtx({ srcCcy: "USD", dstCcy: "MXN" });
    ctx.state.isOnChain = false;
    ctx.state.corridor.id = "usd-mxn";
    ctx.state.srcActors = ACTORS_BY_CURRENCY.USD ?? [];
    ctx.state.dstActors = ACTORS_BY_CURRENCY.MXN ?? [];
    const events = await collectEvents(new OffChainBridgePhase(), ctx);

    expect(events.find((e) => e.kind === "reasoning")).toBeDefined();
    expect(events.find((e) => e.kind === "tool-result")).toBeDefined();
    expect(ctx.state.verdict).toBe("OFF_CHAIN_ROUTED");
  });

  it("is a no-op when on-chain paths exist", async () => {
    const ctx = makeCtx();
    ctx.state.isOnChain = true;
    ctx.state.paths = [{ x: 1 }];
    const events = await collectEvents(new OffChainBridgePhase(), ctx);
    expect(events.length).toBe(0);
  });

  it("classifies RED when both sides have no actors", async () => {
    const ctx = makeCtx({ srcCcy: "ZZZ", dstCcy: "AAA" });
    ctx.state.isOnChain = false;
    ctx.state.corridor.id = "zzz-aaa";
    const events = await collectEvents(new OffChainBridgePhase(), ctx);
    const tr = events.find((e) => e.kind === "tool-result" && e.name === "classifyOffChainBridge");
    expect(tr).toBeDefined();
    expect(tr?.kind === "tool-result" && tr.summary.includes("RED")).toBe(true);
  });
});
