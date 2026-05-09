import { describe, expect, it, vi } from "vitest";
import { createChatService } from "../../src/services/chat.service.js";

describe("chat.service", () => {
  it("embeds the user query, retrieves top-k context, and generates an answer", async () => {
    const ai = {
      embed: vi.fn().mockResolvedValue({ embedding: [0.1, 0.2], tokensIn: 4 }),
      complete: vi
        .fn()
        .mockResolvedValue({ content: "USD/MXN is healthy.", tokensIn: 100, tokensOut: 30 }),
    };
    const repo = {
      searchByEmbedding: vi.fn().mockResolvedValue([
        {
          id: "doc-1",
          corridorId: "usd-mxn",
          content: "USD/MXN: healthy corridor",
          metadata: {},
          distance: 0.1,
        },
      ]),
      createChat: vi.fn(async () => ({
        id: "chat-1",
        corridorId: "usd-mxn",
        createdAt: new Date(),
      })),
      appendMessage: vi.fn(async () => undefined),
      upsertDoc: vi.fn(),
      clearDocs: vi.fn(),
    };
    const svc = createChatService({ ai: ai as never, repo: repo as never, topK: 3 });
    const out = await svc.ask({ corridorId: "usd-mxn", message: "How healthy is this corridor?" });
    expect(out.answer).toMatch(/healthy/i);
    expect(out.sources).toHaveLength(1);
    expect(repo.appendMessage).toHaveBeenCalledTimes(2);
  });
});
