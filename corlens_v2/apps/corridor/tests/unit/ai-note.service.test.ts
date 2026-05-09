import { describe, expect, it, vi } from "vitest";
import { createAiNoteService } from "../../src/services/ai-note.service.js";

describe("ai-note.service", () => {
  it("generates a note via ai-service.complete and returns it with hash", async () => {
    const ai = { complete: vi.fn().mockResolvedValue({ content: "Healthy corridor with high liquidity.", tokensIn: 50, tokensOut: 20 }), embed: vi.fn() };
    const svc = createAiNoteService({ ai: ai as never });
    const out = await svc.generate({ corridor: { id: "usd-mxn", label: "USD ↔ MXN", description: "test", useCase: "test", status: "GREEN", pathCount: 3, recCost: "100" } });
    expect(out.note).toContain("Healthy");
    expect(out.hash).toMatch(/^[a-f0-9]{16}$/);
    expect(ai.complete).toHaveBeenCalledWith(expect.objectContaining({ purpose: "corridor.ai-note" }));
  });
});
