import { describe, expect, it, vi } from "vitest";
import { createChatService } from "../../src/services/chat.service.js";

describe("chat.service", () => {
  it("embeds the user query, retrieves top-k context, and generates an answer", async () => {
    const ai = {
      embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2], tokensIn: 4 }),
      complete: vi.fn().mockResolvedValue({
        content: "The seed appears to be a healthy issuer.",
        tokensIn: 100,
        tokensOut: 30,
      }),
    };
    const repo = {
      searchByEmbedding: vi.fn().mockResolvedValue([
        {
          id: "doc-1",
          analysisId: "a-1",
          content: "issuer with high trust lines",
          metadata: {},
          distance: 0.1,
        },
      ]),
      createChat: vi.fn(async () => ({ id: "chat-1", analysisId: "a-1", createdAt: new Date() })),
      appendMessage: vi.fn(async () => undefined),
      upsertDoc: vi.fn(),
      clearDocs: vi.fn(),
    };
    const svc = createChatService({ ai: ai as never, repo: repo as never, topK: 3 });
    const out = await svc.ask({ analysisId: "a-1", message: "How healthy is this seed?" });
    expect(out.answer).toMatch(/issuer/i);
    expect(out.sources).toHaveLength(1);
    expect(repo.appendMessage).toHaveBeenCalledTimes(2);
  });
});
