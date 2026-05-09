import { corridor as cc } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
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
}
