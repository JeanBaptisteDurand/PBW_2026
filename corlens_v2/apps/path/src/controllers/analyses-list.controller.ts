import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
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

export function registerAnalysesListRoutes(app: FastifyInstance, analyses: AnalysisRepo): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/analyses",
    {
      schema: {
        querystring: pp.AnalysisListQuery,
        response: { 200: pp.AnalysisListResponse },
        tags: ["analysis"],
      },
    },
    async (req) => {
      const userId = (req.headers["x-user-id"] as string | undefined) ?? null;
      const rows = await analyses.listForUser(userId, req.query.limit);
      return {
        analyses: rows.map((a) => ({
          id: a.id,
          seedAddress: a.seedAddress,
          seedLabel: a.seedLabel,
          depth: a.depth,
          status: a.status as "queued" | "running" | "done" | "error",
          error: a.error,
          stats: statsFromSummary(a.summaryJson),
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
        })),
      };
    },
  );
}
