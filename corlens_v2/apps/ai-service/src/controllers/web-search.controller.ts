import { ai } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { WebSearchService } from "../services/web-search.service.js";

const ErrorResponse = z.object({ error: z.string(), message: z.string().optional() });

export async function registerWebSearchRoutes(
  app: FastifyInstance,
  svc: WebSearchService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/web-search",
    {
      schema: {
        body: ai.WebSearchRequest,
        response: { 200: ai.WebSearchResponse, 503: ErrorResponse, 500: ErrorResponse },
        tags: ["ai"],
      },
    },
    async (req, reply) => {
      try {
        return await svc.search(req.body);
      } catch (err) {
        const msg = (err as Error).message;
        if (msg === "web_search_disabled") {
          reply.status(503).send({ error: "web_search_disabled" });
          return reply;
        }
        throw err;
      }
    },
  );
}
