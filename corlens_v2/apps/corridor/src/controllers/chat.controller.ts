import { corridor as cc } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ChatService } from "../services/chat.service.js";

export async function registerChatRoutes(app: FastifyInstance, chat: ChatService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/api/corridors/chat",
    {
      schema: { body: cc.ChatRequest, response: { 200: cc.ChatResponse }, tags: ["corridor"] },
    },
    async (req) => chat.ask(req.body),
  );

  typed.get(
    "/api/corridors/chat/:chatId",
    {
      schema: {
        params: z.object({ chatId: z.string().uuid() }),
        response: { 200: cc.ChatHistoryResponse, 404: z.object({ error: z.string() }) },
        tags: ["corridor"],
      },
    },
    async (req, reply) => {
      const r = await chat.getById(req.params.chatId);
      if (!r) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return r;
    },
  );
}
