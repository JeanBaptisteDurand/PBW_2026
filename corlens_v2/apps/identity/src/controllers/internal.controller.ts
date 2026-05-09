import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { IdentityEnv } from "../env.js";
import { createHmacVerifyHook } from "../middleware/hmac-verify.js";
import { createUserRepo } from "../repositories/user.repo.js";

const PremiumStatusQuery = z.object({ userId: z.string().uuid() });
const PremiumStatusResponse = z.object({
  isPremium: z.boolean(),
  // v2 schema has no expiry: once-paid is forever-premium. Always null today.
  expiresAt: z.string().nullable(),
});
const ErrorResponse = z.object({ error: z.string() });

export async function registerInternalRoutes(
  app: FastifyInstance,
  env: IdentityEnv,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const users = createUserRepo(app.db);
  const hmacGuard = createHmacVerifyHook({ secret: env.INTERNAL_HMAC_SECRET });

  typed.get(
    "/internal/premium-status",
    {
      preHandler: hmacGuard,
      schema: {
        hide: true,
        querystring: PremiumStatusQuery,
        response: {
          200: PremiumStatusResponse,
          401: ErrorResponse,
          404: ErrorResponse,
        },
      },
    },
    async (req, reply) => {
      const { userId } = req.query;
      const user = await users.findById(userId);
      if (!user) {
        reply.code(404).send({ error: "user not found" });
        return reply;
      }
      return { isPremium: user.role === "premium", expiresAt: null };
    },
  );
}
