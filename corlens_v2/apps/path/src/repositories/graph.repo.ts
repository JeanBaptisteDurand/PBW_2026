import type { Prisma } from "@corlens/db";
import { pathDb } from "@corlens/db/path";

export type GraphPersistInput = {
  analysisId: string;
  nodes: Array<{ nodeId: string; kind: string; label: string; data: unknown }>;
  edges: Array<{
    edgeId: string;
    source: string;
    target: string;
    kind: string;
    label: string | null;
    data: unknown;
  }>;
  riskFlags: Array<{
    nodeId: string;
    flag: string;
    severity: string;
    detail: string;
    data: unknown;
  }>;
};

export function createGraphRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async persist(
      input: GraphPersistInput,
    ): Promise<{ nodeCount: number; edgeCount: number; flagCount: number }> {
      await db.riskFlag.deleteMany({ where: { analysisId: input.analysisId } });
      await db.edge.deleteMany({ where: { analysisId: input.analysisId } });
      await db.node.deleteMany({ where: { analysisId: input.analysisId } });

      if (input.nodes.length > 0) {
        await db.node.createMany({
          data: input.nodes.map((n) => ({
            analysisId: input.analysisId,
            nodeId: n.nodeId,
            kind: n.kind,
            label: n.label,
            data: n.data as never,
          })),
          skipDuplicates: true,
        });
      }
      if (input.edges.length > 0) {
        await db.edge.createMany({
          data: input.edges.map((e) => ({
            analysisId: input.analysisId,
            edgeId: e.edgeId,
            source: e.source,
            target: e.target,
            kind: e.kind,
            label: e.label,
            data: (e.data ?? null) as never,
          })),
          skipDuplicates: true,
        });
      }
      if (input.riskFlags.length > 0) {
        await db.riskFlag.createMany({
          data: input.riskFlags.map((f) => ({
            analysisId: input.analysisId,
            nodeId: f.nodeId,
            flag: f.flag,
            severity: f.severity,
            detail: f.detail,
            data: (f.data ?? null) as never,
          })),
        });
      }
      return {
        nodeCount: input.nodes.length,
        edgeCount: input.edges.length,
        flagCount: input.riskFlags.length,
      };
    },

    async loadGraph(analysisId: string) {
      const [nodes, edges, flags] = await Promise.all([
        db.node.findMany({ where: { analysisId } }),
        db.edge.findMany({ where: { analysisId } }),
        db.riskFlag.findMany({ where: { analysisId } }),
      ]);
      return { nodes, edges, flags };
    },

    async writeExplanation(analysisId: string, nodeId: string, explanation: string): Promise<void> {
      await db.node.updateMany({
        where: { analysisId, nodeId },
        data: { aiExplanation: explanation },
      });
    },

    async listExplanations(analysisId: string) {
      const rows = await db.node.findMany({
        where: { analysisId, aiExplanation: { not: null } },
        select: { nodeId: true, aiExplanation: true },
      });
      return rows.map((r) => ({ nodeId: r.nodeId, explanation: r.aiExplanation as string }));
    },
  };
}

export type GraphRepo = ReturnType<typeof createGraphRepo>;
