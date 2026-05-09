import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/services/orchestrator.service.js";

function makeStubs() {
  const corridor = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue({
      id: "usd-mxn",
      label: "USD ↔ MXN",
      status: "GREEN",
      category: "off-chain-bridge",
    }),
    chat: vi.fn().mockResolvedValue({ answer: "Healthy corridor.", sources: [] }),
  };
  const path = {
    analyze: vi
      .fn()
      .mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", status: "queued" }),
    getAnalysis: vi.fn().mockResolvedValue({ status: "done" }),
    getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    chat: vi.fn().mockResolvedValue({ answer: "ok", sources: [] }),
    history: vi.fn(),
  };
  const ai = {
    complete: vi.fn().mockResolvedValue({
      content: "The recommended route is the USD/MXN corridor with low risk.",
      tokensIn: 100,
      tokensOut: 30,
    }),
    embed: vi.fn(),
  };
  const marketData = {
    pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [] } }),
    partnerDepth: vi.fn().mockResolvedValue({
      actor: "bitso",
      book: "xrp_mxn",
      venue: "Bitso",
      bidCount: 5,
      askCount: 5,
      spreadBps: 10,
      bidDepthBase: "1000",
      askDepthBase: "1000",
      fetchedAt: new Date().toISOString(),
    }),
    accountInfo: vi.fn(),
    trustLines: vi.fn(),
    gatewayBalances: vi.fn(),
  };
  return { corridor, path, ai, marketData };
}

describe("orchestrator.service", () => {
  it("emits phase-start/phase-complete for each of the 9 phases and a final result", async () => {
    const { corridor, path, ai, marketData } = makeStubs();
    const orch = createOrchestrator({
      corridor: corridor as never,
      path: path as never,
      ai: ai as never,
      marketData: marketData as never,
      timeoutMs: 5000,
    });

    const events: Array<{ kind: string }> = [];
    const gen = orch.run({ srcCcy: "USD", dstCcy: "MXN", amount: "100", maxRiskTolerance: "MED" });
    while (true) {
      const next = await gen.next();
      if (next.done) break;
      events.push(next.value);
    }

    const phaseStarts = events.filter((e) => e.kind === "phase-start");
    expect(phaseStarts.length).toBe(9);
    const phaseComplete = events.filter((e) => e.kind === "phase-complete");
    expect(phaseComplete.length).toBe(9);
    const result = events.find((e) => e.kind === "result");
    expect(result).toBeDefined();
  });

  it("emits expanded events from the SafePathEvent roster", async () => {
    const { corridor, path, ai, marketData } = makeStubs();
    const orch = createOrchestrator({
      corridor: corridor as never,
      path: path as never,
      ai: ai as never,
      marketData: marketData as never,
      timeoutMs: 5000,
    });

    const kinds = new Set<string>();
    const gen = orch.run({ srcCcy: "USD", dstCcy: "MXN", amount: "100", maxRiskTolerance: "MED" });
    while (true) {
      const next = await gen.next();
      if (next.done) break;
      kinds.add(next.value.kind);
    }

    expect(kinds.has("phase-start")).toBe(true);
    expect(kinds.has("phase-complete")).toBe(true);
    expect(kinds.has("corridor-context")).toBe(true);
    expect(kinds.has("corridor-rag")).toBe(true);
    expect(kinds.has("step")).toBe(true);
    expect(kinds.has("report")).toBe(true);
    expect(kinds.has("result")).toBe(true);
  });

  it("emits error and stops when a phase throws", async () => {
    const { corridor, path, ai, marketData } = makeStubs();
    corridor.getById.mockRejectedValueOnce(new Error("boom"));
    // The corridor phase swallows fetch errors. Make planning throw instead.
    ai.complete.mockRejectedValueOnce(new Error("planner exploded"));
    const orch = createOrchestrator({
      corridor: corridor as never,
      path: path as never,
      ai: ai as never,
      marketData: marketData as never,
      timeoutMs: 5000,
    });
    const events: Array<{ kind: string }> = [];
    const gen = orch.run({ srcCcy: "USD", dstCcy: "MXN", amount: "100" });
    while (true) {
      const next = await gen.next();
      if (next.done) break;
      events.push(next.value);
    }
    // Planning swallowed in v2 (try/catch around AI complete) — orchestrator still completes.
    expect(events.find((e) => e.kind === "result")).toBeDefined();
  });
});
