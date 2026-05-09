import { describe, expect, it, vi } from "vitest";
import { createExplanationsService } from "../../src/services/explanations.service.js";

describe("explanations.service", () => {
  it("calls ai-service complete and writes the explanation back to the graph repo", async () => {
    const ai = { complete: vi.fn().mockResolvedValue({ content: "This is an issuer node.", tokensIn: 50, tokensOut: 12 }), embed: vi.fn() };
    const graph = { writeExplanation: vi.fn(async () => undefined), persist: vi.fn(), loadGraph: vi.fn(), listExplanations: vi.fn() };
    const svc = createExplanationsService({ ai: ai as never, graph: graph as never });
    const out = await svc.generate({
      analysisId: "00000000-0000-0000-0000-000000000001",
      nodes: [{ id: "node-1", kind: "issuer", label: "Bitstamp", data: { domain: "bitstamp.net" }, riskFlags: [] }],
    });
    expect(out.count).toBe(1);
    expect(graph.writeExplanation).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001", "node-1", "This is an issuer node.");
    expect(ai.complete).toHaveBeenCalledWith(expect.objectContaining({ purpose: "path.explanation" }));
  });
});
