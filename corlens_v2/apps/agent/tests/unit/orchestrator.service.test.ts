import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/services/orchestrator.service.js";

describe("orchestrator.service", () => {
  it("emits phase-start/phase-complete for each phase and a final result", async () => {
    const corridor = {
      list: vi.fn().mockResolvedValue([{ id: "usd-mxn", label: "USD ↔ MXN", status: "GREEN" }]),
      getById: vi.fn().mockResolvedValue({ id: "usd-mxn", label: "USD ↔ MXN", status: "GREEN" }),
      chat: vi.fn().mockResolvedValue({ answer: "Healthy corridor.", sources: [] }),
    };
    const path = {
      analyze: vi.fn(),
      getAnalysis: vi.fn(),
      getGraph: vi.fn(),
      chat: vi.fn(),
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
    const orch = createOrchestrator({
      corridor: corridor as never,
      path: path as never,
      ai: ai as never,
      timeoutMs: 5000,
    });

    const events: Array<{ kind: string }> = [];
    for await (const e of orch.run({
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
    })) {
      events.push(e);
    }
    const phaseStarts = events.filter((e) => e.kind === "phase-start");
    expect(phaseStarts.length).toBe(6);
    const result = events.find((e) => e.kind === "result");
    expect(result).toBeDefined();
  });
});
