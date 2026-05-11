import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerChatRoutes } from "../../src/controllers/chat.controller.js";

function makeApp(chat: any) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerChatRoutes(app, chat);
  return app;
}

describe("path chat-retrieval", () => {
  it("GET /api/analysis/:id/chat returns chat history in createdAt asc", async () => {
    const chat = {
      ask: vi.fn(),
      getLatestForAnalysis: vi.fn(async () => ({
        chatId: "00000000-0000-0000-0000-000000000010",
        analysisId: "00000000-0000-0000-0000-000000000001",
        messages: [
          { role: "user", content: "hi", sources: null, createdAt: "2026-05-11T00:00:00.000Z" },
          { role: "assistant", content: "hello", sources: null, createdAt: "2026-05-11T00:00:01.000Z" },
        ],
      })),
    };
    const app = makeApp(chat);
    const res = await app.inject({
      method: "GET",
      url: "/api/analysis/00000000-0000-0000-0000-000000000001/chat",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("user");
    expect(body.chatId).toBe("00000000-0000-0000-0000-000000000010");
    await app.close();
  });

  it("404 when no chat exists", async () => {
    const chat = {
      ask: vi.fn(),
      getLatestForAnalysis: vi.fn(async () => null),
    };
    const app = makeApp(chat);
    const res = await app.inject({
      method: "GET",
      url: "/api/analysis/00000000-0000-0000-0000-000000000099/chat",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
    await app.close();
  });
});
