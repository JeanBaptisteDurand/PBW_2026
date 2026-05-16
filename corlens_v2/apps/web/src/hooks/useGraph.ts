import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/index.js";
import type {
  EdgeKind,
  GraphData,
  GraphEdge,
  GraphNode,
  NodeKind,
  RiskFlagData,
  RiskFlagType,
} from "../lib/core-types.js";

// v2 backend uses `nodeId`/`edgeId` and `nodeCount/edgeCount/riskCounts`; v1
// components consume `id` and `totalNodes/totalEdges/nodesByKind`. Adapt at
// the boundary so the component code stays the verbatim v1 port.
function adaptGraph(g: unknown): GraphData {
  const src = g as {
    nodes: Array<{
      nodeId: string;
      kind: string;
      label: string;
      data?: unknown;
      riskFlags: Array<{ flag: string; severity: string; detail: string; data?: unknown }>;
      aiExplanation?: string | null;
    }>;
    edges: Array<{
      edgeId: string;
      source: string;
      target: string;
      kind: string;
      label?: string | null;
      data?: unknown;
    }>;
    stats: {
      nodeCount: number;
      edgeCount: number;
      riskCounts: { HIGH: number; MED: number; LOW: number };
    };
  };
  const nodes: GraphNode[] = src.nodes.map((n) => ({
    id: n.nodeId,
    kind: n.kind as NodeKind,
    label: n.label,
    data: n.data as GraphNode["data"],
    riskFlags: n.riskFlags.map((f) => ({
      flag: f.flag as RiskFlagType,
      severity: f.severity as RiskFlagData["severity"],
      detail: f.detail,
      data: f.data as Record<string, unknown> | undefined,
    })),
    aiExplanation: n.aiExplanation ?? undefined,
  }));
  const edges: GraphEdge[] = src.edges.map((e) => ({
    id: e.edgeId,
    source: e.source,
    target: e.target,
    kind: e.kind as EdgeKind,
    label: e.label ?? undefined,
    data: (e.data as Record<string, unknown>) ?? undefined,
  }));
  // v1 stats include per-kind histograms — derive them from the nodes array
  // since the v2 endpoint doesn't return them.
  const nodesByKind = nodes.reduce<Partial<Record<NodeKind, number>>>((acc, n) => {
    acc[n.kind] = (acc[n.kind] ?? 0) + 1;
    return acc;
  }, {});
  const highRiskCount = nodes.reduce(
    (a, n) => a + n.riskFlags.filter((f) => f.severity === "HIGH").length,
    0,
  );
  const medRiskCount = nodes.reduce(
    (a, n) => a + n.riskFlags.filter((f) => f.severity === "MED").length,
    0,
  );
  const lowRiskCount = nodes.reduce(
    (a, n) => a + n.riskFlags.filter((f) => f.severity === "LOW").length,
    0,
  );
  return {
    nodes,
    edges,
    stats: {
      totalNodes: src.stats.nodeCount,
      totalEdges: src.stats.edgeCount,
      nodesByKind: nodesByKind as Record<NodeKind, number>,
      totalRiskFlags: highRiskCount + medRiskCount + lowRiskCount,
      highRiskCount,
      medRiskCount,
      lowRiskCount,
    },
  };
}

/** Fetch the ReactFlow graph data for a completed analysis (v2 → v1 shape adapter) */
export function useGraph(analysisId: string | undefined) {
  return useQuery({
    queryKey: ["graph", analysisId],
    queryFn: async () => adaptGraph(await api.path.getGraph(analysisId ?? "")),
    enabled: Boolean(analysisId),
  });
}

/** Generate (or re-generate) a compliance report for an analysis */
export function useComplianceReport(analysisId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!analysisId) throw new Error("No analysisId provided");
      return api.agent.generateComplianceAnalysis(analysisId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["compliance", analysisId] });
    },
  });
}

/** Fetch AI-generated per-node explanations */
export function useExplanations(analysisId: string | undefined) {
  return useQuery({
    queryKey: ["explanations", analysisId],
    queryFn: () => api.path.getExplanations(analysisId ?? ""),
    enabled: Boolean(analysisId),
  });
}
