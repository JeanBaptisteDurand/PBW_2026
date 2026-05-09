import { describe, expect, it, vi } from "vitest";
import { createRagIndexService } from "../../src/services/rag-index.service.js";

describe("rag-index.service", () => {
  it("clears existing docs and inserts new ones with embeddings", async () => {
    const ai = { complete: vi.fn(), embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2], tokensIn: 5 }) };
    const repo = {
      upsertDoc: vi.fn(async () => undefined),
      searchByEmbedding: vi.fn(),
      clearDocs: vi.fn(async () => undefined),
      createChat: vi.fn(),
      appendMessage: vi.fn(),
    };
    const svc = createRagIndexService({ ai: ai as never, repo: repo as never });
    await svc.index({
      corridor: { id: "usd-mxn", label: "USD ↔ MXN", description: "test", useCase: "test", aiNote: "ok" },
      chunks: ["chunk 1", "chunk 2"],
    });
    expect(repo.clearDocs).toHaveBeenCalledWith("usd-mxn");
    expect(ai.embed).toHaveBeenCalledTimes(2);
    expect(repo.upsertDoc).toHaveBeenCalledTimes(2);
  });
});
