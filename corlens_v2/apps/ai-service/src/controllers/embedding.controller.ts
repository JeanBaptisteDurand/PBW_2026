import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ai } from "@corlens/contracts";
import type { EmbeddingService } from "../services/embedding.service.js";

const ErrorResponse = z.object({ error: z.string(), message: z.string().optional() });

export async function registerEmbeddingRoutes(app: FastifyInstance, svc: EmbeddingService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/embedding", {
    schema: { body: ai.EmbeddingRequest, response: { 200: ai.EmbeddingResponse, 500: ErrorResponse }, tags: ["ai"] },
  }, async (req) => svc.embed(req.body));
}
