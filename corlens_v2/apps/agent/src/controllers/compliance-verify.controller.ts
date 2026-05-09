import { agent as ag } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";

const ErrorResp = z.object({ valid: z.literal(false), error: z.string() });
const Query = z.object({
  hash: z
    .string()
    .min(32)
    .max(64)
    .regex(/^[0-9a-fA-F]+$/),
});

export async function registerComplianceVerifyRoutes(
  app: FastifyInstance,
  runs: SafePathRunRepo,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/api/compliance/verify",
    {
      schema: {
        querystring: Query,
        response: { 200: ag.ComplianceVerifyResponse, 404: ErrorResp },
        tags: ["compliance"],
      },
    },
    async (req, reply) => {
      const r = await runs.findByAuditHash(req.query.hash.toLowerCase());
      if (!r) {
        reply.code(404).send({ valid: false, error: "not_found" });
        return reply;
      }
      return {
        valid: true as const,
        runId: r.id,
        generatedAt: r.createdAt.toISOString(),
        verdict: r.verdict as "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED",
        srcCcy: r.srcCcy,
        dstCcy: r.dstCcy,
      };
    },
  );
}
