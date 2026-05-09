import { describe, expect, it, vi } from "vitest";
import { createRagIndexService } from "../../src/services/rag-index.service.js";

describe("rag-index.service", () => {
  it("clears existing docs, embeds nodes, and adds a flags-summary doc", async () => {
    const ai = { complete: vi.fn(), embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2], tokensIn: 5 }) };
    const repo = {
      upsertDoc: vi.fn(async () => undefined),
      searchByEmbedding: vi.fn(),
      clearDocs: vi.fn(async () => undefined),
      createChat: vi.fn(),
      appendMessage: vi.fn(),
    };
    const svc = createRagIndexService({ ai: ai as never, repo: repo as never });
    const out = await svc.index({
      analysisId: "00000000-0000-0000-0000-000000000001",
      nodes: [
        { id: "n1", kind: "account", label: "Seed", data: {}, riskFlags: [] },
        { id: "n2", kind: "issuer", label: "Bitstamp", data: { domain: "bitstamp.net" }, riskFlags: [] },
      ],
      flags: [{ flag: "FROZEN_TRUST_LINE", severity: "HIGH", detail: "1 frozen line" }],
    });
    expect(repo.clearDocs).toHaveBeenCalledWith("00000000-0000-0000-0000-000000000001");
    expect(out.indexed).toBe(3); // 2 nodes + 1 flags-summary
    expect(repo.upsertDoc).toHaveBeenCalledTimes(3);
  });
});
