import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { path as pp } from "@corlens/contracts";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { GraphRepo } from "../repositories/graph.repo.js";

const ErrorResp = z.object({ error: z.string() });

type ContractStats = { nodeCount: number; edgeCount: number; riskCounts: { HIGH: number; MED: number; LOW: number } };

function statsFromSummary(summaryJson: unknown): ContractStats | null {
  if (!summaryJson || typeof summaryJson !== "object") return null;
  const stats = (summaryJson as { stats?: ContractStats }).stats;
  return stats ?? null;
}

export async function registerAnalysisRoutes(app: FastifyInstance, analyses: AnalysisRepo, graphs: GraphRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/analysis/:id", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.AnalysisSummary, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    return {
      id: a.id,
      seedAddress: a.seedAddress,
      seedLabel: a.seedLabel,
      depth: a.depth,
      status: a.status as "queued" | "running" | "done" | "error",
      error: a.error,
      stats: statsFromSummary(a.summaryJson),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  });

  typed.get("/api/analysis/:id/graph", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.GraphResponse, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    const { nodes, edges, flags } = await graphs.loadGraph(req.params.id);
    const flagsByNode = new Map<string, Array<{ flag: string; severity: "HIGH" | "MED" | "LOW"; detail: string; data: unknown }>>();
    for (const f of flags) {
      const list = flagsByNode.get(f.nodeId) ?? [];
      list.push({ flag: f.flag, severity: f.severity as "HIGH" | "MED" | "LOW", detail: f.detail, data: f.data });
      flagsByNode.set(f.nodeId, list);
    }
    const stats = statsFromSummary(a.summaryJson) ?? { nodeCount: nodes.length, edgeCount: edges.length, riskCounts: { HIGH: 0, MED: 0, LOW: 0 } };
    return {
      analysisId: a.id,
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId, kind: n.kind, label: n.label, data: n.data,
        riskFlags: flagsByNode.get(n.nodeId) ?? [],
        aiExplanation: n.aiExplanation,
      })),
      edges: edges.map((e) => ({ edgeId: e.edgeId, source: e.source, target: e.target, kind: e.kind, label: e.label ?? null, data: e.data ?? null })),
      stats,
    };
  });

  typed.get("/api/analysis/:id/explanations", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.ExplanationsResponse, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    const items = await graphs.listExplanations(req.params.id);
    return { analysisId: a.id, items };
  });
}
