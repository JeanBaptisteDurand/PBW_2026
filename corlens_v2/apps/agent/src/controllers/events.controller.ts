import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AgentEnv } from "../env.js";
import { createHmacVerifyHook } from "../middleware/hmac-verify.js";

const EventParams = z.object({ name: z.string() });
const EventBody = z.object({ name: z.string(), payload: z.unknown() });
const EventResponse = z.object({ ok: z.literal(true) });

export async function registerEventRoutes(app: FastifyInstance, env: AgentEnv): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const hmacGuard = createHmacVerifyHook({ secret: env.INTERNAL_HMAC_SECRET });

  typed.post(
    "/events/:name",
    {
      preHandler: hmacGuard,
      schema: {
        hide: true,
        params: EventParams,
        body: EventBody,
        response: { 200: EventResponse },
      },
    },
    async (req) => {
      app.log.info({ event: req.params.name, payload: req.body.payload }, "received event");
      return { ok: true as const };
    },
  );
}
