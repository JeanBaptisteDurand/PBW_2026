import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { describe, expect, it, vi } from "vitest";
import { registerChatRoutes } from "../../src/controllers/chat.controller.js";

function makeApp(chat: any) {
  const app = Fastify().withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerChatRoutes(app, chat);
  return app;
}

describe("corridor chat-retrieval", () => {
  it("GET /api/corridors/chat/:chatId returns chat history with messages in ASC order", async () => {
    const chat = {
      ask: vi.fn(),
      getById: vi.fn(async () => ({
        chatId: "00000000-0000-0000-0000-000000000020",
        corridorId: "usd-mxn",
        messages: [
          {
            role: "user",
            content: "what about USD-MXN?",
            sources: null,
            createdAt: "2026-05-11T00:00:00.000Z",
          },
          {
            role: "assistant",
            content: "RLUSD via Bitso",
            sources: [{ id: "x" }],
            createdAt: "2026-05-11T00:00:01.000Z",
          },
        ],
      })),
    };
    const app = makeApp(chat);
    const res = await app.inject({
      method: "GET",
      url: "/api/corridors/chat/00000000-0000-0000-0000-000000000020",
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.chatId).toBe("00000000-0000-0000-0000-000000000020");
    expect(body.corridorId).toBe("usd-mxn");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("user");
    await app.close();
  });

  it("404 when chat is missing", async () => {
    const chat = {
      ask: vi.fn(),
      getById: vi.fn(async () => null),
    };
    const app = makeApp(chat);
    const res = await app.inject({
      method: "GET",
      url: "/api/corridors/chat/00000000-0000-0000-0000-000000000099",
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toBe("not_found");
    await app.close();
  });

  it("supports null corridorId (whole-atlas chat)", async () => {
    const chat = {
      ask: vi.fn(),
      getById: vi.fn(async () => ({
        chatId: "00000000-0000-0000-0000-000000000021",
        corridorId: null,
        messages: [],
      })),
    };
    const app = makeApp(chat);
    const res = await app.inject({
      method: "GET",
      url: "/api/corridors/chat/00000000-0000-0000-0000-000000000021",
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().corridorId).toBeNull();
    await app.close();
  });
});
