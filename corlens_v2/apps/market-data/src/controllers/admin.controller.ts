import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post("/admin/refresh-corridors", {
    schema: {
      response: { 200: z.object({ accepted: z.boolean(), note: z.string() }), 503: z.object({ error: z.string(), step: z.number() }) },
      tags: ["admin"],
    },
  }, async (_req, reply) => {
    reply.status(503).send({ error: "corridor_service_not_yet_built", step: 6 });
    return reply;
  });
}
