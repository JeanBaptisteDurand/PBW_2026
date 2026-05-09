import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";

type ContractStats = {
  nodeCount: number;
  edgeCount: number;
  riskCounts: { HIGH: number; MED: number; LOW: number };
};

function statsFromSummary(summaryJson: unknown): ContractStats | null {
  if (!summaryJson || typeof summaryJson !== "object") return null;
  const stats = (summaryJson as { stats?: ContractStats }).stats;
  return stats ?? null;
}

export async function registerHistoryRoutes(
  app: FastifyInstance,
  analyses: AnalysisRepo,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get(
    "/api/history/:address",
    {
      schema: {
        params: z.object({ address: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/) }),
        response: { 200: pp.HistoryResponse },
        tags: ["history"],
      },
    },
    async (req) => {
      const rows = await analyses.listForAddress(req.params.address, 10);
      return {
        address: req.params.address,
        analyses: rows.map((a) => ({
          id: a.id,
          status: a.status as "queued" | "running" | "done" | "error",
          depth: a.depth,
          stats: statsFromSummary(a.summaryJson),
          createdAt: a.createdAt.toISOString(),
        })),
      };
    },
  );
}
