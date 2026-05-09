import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { agent as ag } from "@corlens/contracts";
import type { PathClient } from "../connectors/path.js";
import type { CorridorClient } from "../connectors/corridor.js";

export async function registerChatRoutes(app: FastifyInstance, path: PathClient, corridor: CorridorClient): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/api/chat", {
    schema: { body: ag.ChatRequest, response: { 200: ag.ChatResponse }, tags: ["chat"] },
  }, async (req) => {
    if (req.body.analysisId) {
      return path.chat({ analysisId: req.body.analysisId, message: req.body.message });
    }
    return corridor.chat({ message: req.body.message });
  });
}
