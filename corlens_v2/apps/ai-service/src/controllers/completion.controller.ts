import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ai } from "@corlens/contracts";
import type { CompletionService } from "../services/completion.service.js";

const ErrorResponse = z.object({ error: z.string(), message: z.string().optional() });

export async function registerCompletionRoutes(app: FastifyInstance, svc: CompletionService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/completion", {
    schema: { body: ai.CompletionRequest, response: { 200: ai.CompletionResponse, 500: ErrorResponse }, tags: ["ai"] },
  }, async (req) => svc.complete(req.body));
}
