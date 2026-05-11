import { z } from "zod";
import { Currency, RiskTolerance, Verdict } from "./shared.js";

export const SafePathRequest = z.object({
  srcCcy: Currency,
  dstCcy: Currency,
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  maxRiskTolerance: RiskTolerance.optional(),
});
export type SafePathRequest = z.infer<typeof SafePathRequest>;

export const SafePathPhase = z.enum([
  "corridor-resolution",
  "corridor-rag",
  "planning",
  "actor-research",
  "deep-entity-analysis",
  "on-chain-path-find",
  "off-chain-bridge",
  "split-plan",
  "report",
]);
export type SafePathPhase = z.infer<typeof SafePathPhase>;

export const RiskFlag = z.object({
  flag: z.string(),
  severity: z.enum(["LOW", "MED", "HIGH"]),
  detail: z.string().optional(),
  data: z.record(z.unknown()).optional(),
});
export type RiskFlag = z.infer<typeof RiskFlag>;

export const SplitLeg = z.object({
  percentage: z.number(),
  description: z.string(),
  reason: z.string(),
  path: z.unknown().optional(),
});
export type SplitLeg = z.infer<typeof SplitLeg>;

export const AnalysesSummaryEntry = z.object({
  id: z.string(),
  address: z.string(),
  label: z.string(),
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
});
export type AnalysesSummaryEntry = z.infer<typeof AnalysesSummaryEntry>;

export const SafePathEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("phase-start"), phase: SafePathPhase, at: z.string().datetime() }),
  z.object({
    kind: z.literal("phase-complete"),
    phase: SafePathPhase,
    durationMs: z.number().int(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("step"),
    step: z.string(),
    detail: z.string().nullable(),
    at: z.string().datetime(),
  }),
  z.object({ kind: z.literal("reasoning"), text: z.string(), at: z.string().datetime() }),
  z.object({
    kind: z.literal("corridor-context"),
    corridorId: z.string().nullable(),
    label: z.string().nullable(),
    status: z.string().nullable(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("corridor-rag"),
    question: z.string(),
    answer: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("corridor-update"),
    analysisJson: z.unknown(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("tool-call"),
    name: z.string(),
    args: z.record(z.unknown()),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("tool-result"),
    name: z.string(),
    summary: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("web-search"),
    query: z.string(),
    results: z.array(z.string()),
    at: z.string().datetime(),
  }),
  // TODO(D.x): no producer yet — agent will emit once path service exposes a /api/risk-engine/evaluate endpoint or risk-engine is published as a shared package.
  z.object({
    kind: z.literal("account-crawled"),
    address: z.string(),
    name: z.string(),
    reason: z.string(),
    flags: z.array(RiskFlag),
    score: z.number(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("analysis-started"),
    analysisId: z.string(),
    address: z.string(),
    label: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("analysis-complete"),
    analysisId: z.string(),
    nodeCount: z.number().int().min(0),
    edgeCount: z.number().int().min(0),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("analyses-summary"),
    analyses: z.array(AnalysesSummaryEntry),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("rag-answer"),
    question: z.string(),
    answer: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("path-active"),
    pathId: z.string(),
    riskScore: z.number(),
    cost: z.string().nullable(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("path-rejected"),
    pathId: z.string(),
    reason: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("partner-depth"),
    actor: z.string(),
    summary: z.unknown(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("split-plan"),
    legs: z.array(SplitLeg),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("report"),
    markdown: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("result"),
    runId: z.string().uuid(),
    verdict: Verdict,
    riskScore: z.number().nullable(),
    reasoning: z.string(),
    at: z.string().datetime(),
  }),
  z.object({
    kind: z.literal("error"),
    phase: SafePathPhase.nullable(),
    message: z.string(),
    at: z.string().datetime(),
  }),
]);
export type SafePathEvent = z.infer<typeof SafePathEvent>;

export const SafePathRunSummary = z.object({
  id: z.string().uuid(),
  srcCcy: Currency,
  dstCcy: Currency,
  amount: z.string(),
  maxRiskTolerance: RiskTolerance,
  verdict: Verdict,
  riskScore: z.number().nullable(),
  reasoning: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type SafePathRunSummary = z.infer<typeof SafePathRunSummary>;

export const SafePathRunDetail = SafePathRunSummary.extend({
  resultJson: z.unknown(),
  reportMarkdown: z.string().nullable(),
  analysisIds: z.array(z.string().uuid()),
});
export type SafePathRunDetail = z.infer<typeof SafePathRunDetail>;

export const SafePathHistoryResponse = z.object({
  runs: z.array(SafePathRunSummary),
});

export const ComplianceResponse = z.object({
  runId: z.string().uuid(),
  markdown: z.string(),
});
export type ComplianceResponse = z.infer<typeof ComplianceResponse>;

export const ComplianceVerifyResponse = z.object({
  valid: z.literal(true),
  runId: z.string().uuid(),
  generatedAt: z.string().datetime(),
  verdict: Verdict,
  srcCcy: Currency,
  dstCcy: Currency,
});
export type ComplianceVerifyResponse = z.infer<typeof ComplianceVerifyResponse>;

export const ChatRequest = z.object({
  analysisId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});

export const AnalysisComplianceRequest = z.object({
  travelRule: z
    .object({
      originatorName: z.string().optional(),
      beneficiaryName: z.string().optional(),
    })
    .optional(),
  sanctionsCheck: z.boolean().optional(),
});
export type AnalysisComplianceRequest = z.infer<typeof AnalysisComplianceRequest>;

export const AnalysisComplianceResponse = z.object({
  analysisId: z.string().uuid(),
  markdown: z.string(),
  auditHash: z.string().length(64),
});
export type AnalysisComplianceResponse = z.infer<typeof AnalysisComplianceResponse>;
