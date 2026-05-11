import { corridor as cc } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { CurrencyMetaService } from "../services/currency-meta.service.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerCurrencyMetaRoutes(
  app: FastifyInstance,
  svc: CurrencyMetaService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/api/corridors/currency-meta",
    {
      schema: {
        response: { 200: cc.CurrencyMetaListResponse },
        tags: ["corridor"],
      },
    },
    async (_req, reply) => {
      reply.header("Cache-Control", "public, max-age=300");
      return svc.list();
    },
  );

  typed.get(
    "/api/corridors/currency-meta/:code",
    {
      schema: {
        params: z.object({ code: z.string().min(3).max(8) }),
        response: { 200: cc.CurrencyMeta, 404: ErrorResp },
        tags: ["corridor"],
      },
    },
    async (req, reply) => {
      const row = await svc.getByCode(req.params.code);
      if (!row) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      reply.header("Cache-Control", "public, max-age=300");
      return row;
    },
  );
}
