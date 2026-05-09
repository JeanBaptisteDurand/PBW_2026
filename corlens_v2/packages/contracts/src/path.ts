import { z } from "zod";
import { XrplAddress } from "./shared.js";

export const AnalysisStatus = z.enum(["queued", "running", "done", "error"]);
export type AnalysisStatus = z.infer<typeof AnalysisStatus>;

export const AnalyzeRequest = z.object({
  seedAddress: XrplAddress,
  seedLabel: z.string().max(200).optional(),
  depth: z.coerce.number().int().min(1).max(3).default(1),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;

export const AnalyzeResponse = z.object({
  id: z.string().uuid(),
  status: AnalysisStatus,
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponse>;

export const RiskSeverity = z.enum(["HIGH", "MED", "LOW"]);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const RiskFlag = z.object({
  flag: z.string(),
  severity: RiskSeverity,
  detail: z.string(),
  data: z.unknown().optional(),
});
export type RiskFlag = z.infer<typeof RiskFlag>;

export const GraphStats = z.object({
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
  riskCounts: z.object({
    HIGH: z.number().int().min(0),
    MED: z.number().int().min(0),
    LOW: z.number().int().min(0),
  }),
});
export type GraphStats = z.infer<typeof GraphStats>;

export const AnalysisSummary = z.object({
  id: z.string().uuid(),
  seedAddress: XrplAddress,
  seedLabel: z.string().nullable(),
  depth: z.number().int().min(1).max(3),
  status: AnalysisStatus,
  error: z.string().nullable(),
  stats: GraphStats.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AnalysisSummary = z.infer<typeof AnalysisSummary>;

export const GraphNode = z.object({
  nodeId: z.string(),
  kind: z.string(),
  label: z.string(),
  data: z.unknown(),
  riskFlags: z.array(RiskFlag).default([]),
  aiExplanation: z.string().nullable().optional(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.string(),
  label: z.string().nullable(),
  data: z.unknown().nullable(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const GraphResponse = z.object({
  analysisId: z.string().uuid(),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  stats: GraphStats,
});
export type GraphResponse = z.infer<typeof GraphResponse>;

export const ExplanationItem = z.object({
  nodeId: z.string(),
  explanation: z.string(),
});
export type ExplanationItem = z.infer<typeof ExplanationItem>;

export const ExplanationsResponse = z.object({
  analysisId: z.string().uuid(),
  items: z.array(ExplanationItem),
});

export const ChatRequest = z.object({
  message: z.string().min(1).max(2000),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});
export type ChatResponse = z.infer<typeof ChatResponse>;

export const HistoryItem = z.object({
  id: z.string().uuid(),
  status: AnalysisStatus,
  depth: z.number().int(),
  stats: GraphStats.nullable(),
  createdAt: z.string().datetime(),
});
export type HistoryItem = z.infer<typeof HistoryItem>;

export const HistoryResponse = z.object({
  address: XrplAddress,
  analyses: z.array(HistoryItem),
});

// ─── History SSE stream contracts ────────────────────────────────────────────
// Mirrors v1 corlens/apps/server/src/analysis/historyTypes.ts. Used by the
// /api/history/stream SSE endpoint to type each `data:` frame.

export const HeavyKind = z.enum([
  "amm",
  "issuer",
  "multisig_member",
  "escrow_dest",
  "check_dest",
  "channel_dest",
]);
export type HeavyKind = z.infer<typeof HeavyKind>;

export const HistoryNodeKind = z.union([z.literal("seed"), z.literal("account_light"), HeavyKind]);
export type HistoryNodeKind = z.infer<typeof HistoryNodeKind>;

export const HistoryCrawlStatus = z.enum(["pending", "crawled", "skipped", "error"]);
export type HistoryCrawlStatus = z.infer<typeof HistoryCrawlStatus>;

export const HistoryNode = z.object({
  id: z.string(),
  kind: HistoryNodeKind,
  address: z.string(),
  label: z.string().optional(),
  depth: z.number().int().min(0),
  txCount: z.number().int().min(0),
  riskFlags: z.array(z.string()).optional(),
  crawlStatus: HistoryCrawlStatus,
  crawledAt: z.string().optional(),
  parentId: z.string().optional(),
});
export type HistoryNode = z.infer<typeof HistoryNode>;

export const HistoryEdgeData = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  txType: z.string(),
  count: z.number().int().min(0),
  lastLedger: z.number().int().optional(),
  lastDate: z.string().optional(),
});
export type HistoryEdgeData = z.infer<typeof HistoryEdgeData>;

export const TxTypeSummaryItem = z.object({
  type: z.string(),
  count: z.number().int().min(0),
  lastLedger: z.number().int().optional(),
});
export type TxTypeSummaryItem = z.infer<typeof TxTypeSummaryItem>;

export const HistoryEvent = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("seed_ready"),
    seed: HistoryNode,
    lightNodes: z.array(HistoryNode),
    heavyQueue: z.array(HistoryNode),
    edges: z.array(HistoryEdgeData),
    txTypeSummary: z.array(TxTypeSummaryItem),
  }),
  z.object({
    type: z.literal("node_added"),
    node: HistoryNode,
    edges: z.array(HistoryEdgeData),
  }),
  z.object({
    type: z.literal("edges_added"),
    edges: z.array(HistoryEdgeData),
  }),
  z.object({
    type: z.literal("crawl_error"),
    address: z.string(),
    error: z.string(),
  }),
  z.object({
    type: z.literal("fatal_error"),
    error: z.string(),
  }),
  z.object({
    type: z.literal("done"),
    stats: z.object({
      nodes: z.number().int().min(0),
      edges: z.number().int().min(0),
      crawlsRun: z.number().int().min(0),
      durationMs: z.number().int().min(0),
      truncated: z.boolean(),
    }),
  }),
]);
export type HistoryEvent = z.infer<typeof HistoryEvent>;

export const HistoryStreamQuery = z.object({
  address: XrplAddress,
  depth: z.coerce.number().int().min(1).max(3).default(2),
  maxTx: z.coerce.number().int().min(1).max(500).default(200),
  sinceDays: z.coerce.number().int().min(1).max(90).default(30),
});
export type HistoryStreamQuery = z.infer<typeof HistoryStreamQuery>;
