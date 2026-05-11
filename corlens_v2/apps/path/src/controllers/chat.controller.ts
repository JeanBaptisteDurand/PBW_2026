import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ChatService } from "../services/chat.service.js";

export async function registerChatRoutes(app: FastifyInstance, chat: ChatService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/api/analysis/:id/chat",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: pp.ChatRequest,
        response: { 200: pp.ChatResponse },
        tags: ["analysis"],
      },
    },
    async (req) => chat.ask({ analysisId: req.params.id, message: req.body.message }),
  );

  typed.get(
    "/api/analysis/:id/chat",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: pp.ChatHistoryResponse, 404: z.object({ error: z.string() }) },
        tags: ["analysis"],
      },
    },
    async (req, reply) => {
      const result = await chat.getLatestForAnalysis(req.params.id);
      if (!result) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return result;
    },
  );
}
