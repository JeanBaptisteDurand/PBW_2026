import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { AnalysisQueue } from "../workers/analysis.worker.js";

export async function registerAnalyzeRoutes(
  app: FastifyInstance,
  analyses: AnalysisRepo,
  queue: AnalysisQueue,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post(
    "/api/analyze",
    {
      schema: {
        body: pp.AnalyzeRequest,
        response: { 200: pp.AnalyzeResponse },
        tags: ["analysis"],
      },
    },
    async (req) => {
      const { seedAddress, seedLabel, depth } = req.body;
      const cached = await analyses.findCachedDone(seedAddress, depth);
      if (cached) return { id: cached.id, status: "done" as const };
      const created = await analyses.create({
        seedAddress,
        seedLabel: seedLabel ?? null,
        depth,
        userId: null,
      });
      await queue.enqueue({
        analysisId: created.id,
        seedAddress,
        seedLabel: seedLabel ?? null,
        depth,
      });
      return { id: created.id, status: "queued" as const };
    },
  );
}
