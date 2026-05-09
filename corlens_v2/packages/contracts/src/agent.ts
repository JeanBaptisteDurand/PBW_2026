import { z } from "zod";
import { Verdict, RiskTolerance, Currency } from "./shared.js";

export const SafePathRequest = z.object({
  srcCcy: Currency,
  dstCcy: Currency,
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  maxRiskTolerance: RiskTolerance.optional(),
});
export type SafePathRequest = z.infer<typeof SafePathRequest>;

export const SafePathPhase = z.enum([
  "corridor-resolution",
  "planning",
  "actor-research",
  "on-chain-path-find",
  "off-chain-bridge",
  "verdict-and-report",
]);
export type SafePathPhase = z.infer<typeof SafePathPhase>;

export const SafePathEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("phase-start"), phase: SafePathPhase, at: z.string().datetime() }),
  z.object({ kind: z.literal("phase-complete"), phase: SafePathPhase, durationMs: z.number().int(), at: z.string().datetime() }),
  z.object({ kind: z.literal("reasoning"), text: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("corridor-context"), corridorId: z.string().nullable(), label: z.string().nullable(), status: z.string().nullable(), at: z.string().datetime() }),
  z.object({ kind: z.literal("path-active"), pathId: z.string(), riskScore: z.number(), cost: z.string().nullable(), at: z.string().datetime() }),
  z.object({ kind: z.literal("path-rejected"), pathId: z.string(), reason: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("partner-depth"), actor: z.string(), summary: z.unknown(), at: z.string().datetime() }),
  z.object({ kind: z.literal("result"), runId: z.string().uuid(), verdict: Verdict, riskScore: z.number().nullable(), reasoning: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("error"), phase: SafePathPhase.nullable(), message: z.string(), at: z.string().datetime() }),
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

export const ChatRequest = z.object({
  analysisId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});
