import { agent as ag } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";
import type { OrchestratorService } from "../services/orchestrator.service.js";
import { errMessage, makeInitialState } from "../services/phases/types.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerSafePathRoutes(
  app: FastifyInstance,
  orchestrator: OrchestratorService,
  runs: SafePathRunRepo,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/api/safe-path",
    { schema: { body: ag.SafePathRequest, tags: ["safe-path"] } },
    async (req, reply) => {
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders?.();

      const userId = (req.headers["x-user-id"] as string | undefined) ?? null;

      const send = (data: unknown) => {
        reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      let finalState = makeInitialState();

      try {
        const gen = orchestrator.run(req.body);
        while (true) {
          const next = await gen.next();
          if (next.done) {
            finalState = next.value;
            break;
          }
          send(next.value);
        }
      } catch (err) {
        send({
          kind: "error",
          phase: null,
          message: errMessage(err),
          at: new Date().toISOString(),
        });
      }

      await runs.create({
        id: finalState.runId,
        userId,
        srcCcy: req.body.srcCcy,
        dstCcy: req.body.dstCcy,
        amount: req.body.amount,
        maxRiskTolerance: req.body.maxRiskTolerance ?? "MED",
        verdict: finalState.verdict,
        reasoning: finalState.reasoning || "(no reasoning)",
        resultJson: finalState.resultJson,
        reportMarkdown: finalState.reportMarkdown,
        corridorId: finalState.corridor.id,
        analysisIds: finalState.analysisIds,
        riskScore: finalState.riskScore,
      });
      reply.raw.write("data: [DONE]\n\n");
      reply.raw.end();
    },
  );

  typed.get(
    "/api/safe-path",
    { schema: { response: { 200: ag.SafePathHistoryResponse }, tags: ["safe-path"] } },
    async (req) => {
      const userId = (req.headers["x-user-id"] as string | undefined) ?? null;
      const rows = await runs.listForUser(userId, 50);
      return {
        runs: rows.map((r) => ({
          id: r.id,
          srcCcy: r.srcCcy,
          dstCcy: r.dstCcy,
          amount: r.amount,
          maxRiskTolerance: r.maxRiskTolerance as "LOW" | "MED" | "HIGH",
          verdict: r.verdict as "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED",
          riskScore: (r.resultJson as { riskScore?: number } | null)?.riskScore ?? null,
          reasoning: r.reasoning,
          createdAt: r.createdAt.toISOString(),
        })),
      };
    },
  );

  typed.get(
    "/api/safe-path/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: ag.SafePathRunDetail, 404: ErrorResp },
        tags: ["safe-path"],
      },
    },
    async (req, reply) => {
      const r = await runs.findById(req.params.id);
      if (!r) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return {
        id: r.id,
        srcCcy: r.srcCcy,
        dstCcy: r.dstCcy,
        amount: r.amount,
        maxRiskTolerance: r.maxRiskTolerance as "LOW" | "MED" | "HIGH",
        verdict: r.verdict as "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED",
        riskScore: (r.resultJson as { riskScore?: number } | null)?.riskScore ?? null,
        reasoning: r.reasoning,
        createdAt: r.createdAt.toISOString(),
        resultJson: r.resultJson,
        reportMarkdown: r.reportMarkdown,
        analysisIds: Array.isArray(r.analysisIds) ? (r.analysisIds as string[]) : [],
      };
    },
  );
}
