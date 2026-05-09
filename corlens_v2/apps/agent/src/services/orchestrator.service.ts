import type { AIServiceClient } from "../connectors/ai-service.js";
import type { CorridorClient } from "../connectors/corridor.js";
import type { PathClient } from "../connectors/path.js";

const PHASES = [
  "corridor-resolution",
  "planning",
  "actor-research",
  "on-chain-path-find",
  "off-chain-bridge",
  "verdict-and-report",
] as const;

type Phase = (typeof PHASES)[number];

type Verdict = "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED";

export type OrchestratorEvent =
  | { kind: "phase-start"; phase: Phase; at: string }
  | { kind: "phase-complete"; phase: Phase; durationMs: number; at: string }
  | { kind: "reasoning"; text: string; at: string }
  | {
      kind: "corridor-context";
      corridorId: string | null;
      label: string | null;
      status: string | null;
      at: string;
    }
  | { kind: "path-active"; pathId: string; riskScore: number; cost: string | null; at: string }
  | { kind: "path-rejected"; pathId: string; reason: string; at: string }
  | { kind: "partner-depth"; actor: string; summary: unknown; at: string }
  | {
      kind: "result";
      runId: string;
      verdict: Verdict;
      riskScore: number | null;
      reasoning: string;
      at: string;
    }
  | { kind: "error"; phase: Phase | null; message: string; at: string };

export type OrchestratorContext = {
  corridorId: string | null;
  corridorLabel: string | null;
  corridorStatus: string | null;
  reasoning: string;
  verdict: Verdict;
  riskScore: number | null;
  analysisIds: string[];
  reportMarkdown: string | null;
  resultJson: Record<string, unknown>;
};

export type OrchestratorService = {
  run(input: {
    srcCcy: string;
    dstCcy: string;
    amount: string;
    maxRiskTolerance?: "LOW" | "MED" | "HIGH";
  }): AsyncGenerator<OrchestratorEvent, OrchestratorContext, void>;
};

export type OrchestratorOptions = {
  corridor: CorridorClient;
  path: PathClient;
  ai: AIServiceClient;
  timeoutMs: number;
};

export function createOrchestrator(opts: OrchestratorOptions): OrchestratorService {
  return {
    async *run(input) {
      const ctx: OrchestratorContext = {
        corridorId: null,
        corridorLabel: null,
        corridorStatus: null,
        reasoning: "",
        verdict: "NO_PATHS",
        riskScore: null,
        analysisIds: [],
        reportMarkdown: null,
        resultJson: {},
      };

      const now = () => new Date().toISOString();

      let started = Date.now();
      yield { kind: "phase-start", phase: "corridor-resolution", at: now() };
      try {
        const matchId = `${input.srcCcy.toLowerCase()}-${input.dstCcy.toLowerCase()}`;
        const corridor = await opts.corridor.getById(matchId).catch(() => null);
        if (corridor) {
          const c = corridor as { id: string; label: string; status: string };
          ctx.corridorId = c.id;
          ctx.corridorLabel = c.label;
          ctx.corridorStatus = c.status;
          yield {
            kind: "corridor-context",
            corridorId: c.id,
            label: c.label,
            status: c.status,
            at: now(),
          };
        } else {
          yield {
            kind: "corridor-context",
            corridorId: null,
            label: null,
            status: null,
            at: now(),
          };
        }
      } catch (err) {
        yield {
          kind: "error",
          phase: "corridor-resolution",
          message: (err as Error).message,
          at: now(),
        };
      }
      yield {
        kind: "phase-complete",
        phase: "corridor-resolution",
        durationMs: Date.now() - started,
        at: now(),
      };

      started = Date.now();
      yield { kind: "phase-start", phase: "planning", at: now() };
      try {
        const planPrompt = `You are a payment-routing planner. Plan a Safe Path for ${input.amount} ${input.srcCcy} → ${input.dstCcy}.\n\nCorridor context: ${ctx.corridorLabel ?? "unknown"} (status: ${ctx.corridorStatus ?? "unknown"}).\n\nRespond in 4-5 sentences: corridor type, target actors, XRPL tools to use, risk checks.`;
        const plan = await opts.ai.complete({
          purpose: "agent.plan",
          messages: [{ role: "user", content: planPrompt }],
          temperature: 0.3,
          maxTokens: 200,
        });
        ctx.reasoning += `${plan.content}\n\n`;
        yield { kind: "reasoning", text: plan.content, at: now() };
      } catch (err) {
        yield { kind: "error", phase: "planning", message: (err as Error).message, at: now() };
      }
      yield {
        kind: "phase-complete",
        phase: "planning",
        durationMs: Date.now() - started,
        at: now(),
      };

      started = Date.now();
      yield { kind: "phase-start", phase: "actor-research", at: now() };
      try {
        if (ctx.corridorId) {
          const research = await opts.corridor.chat({
            corridorId: ctx.corridorId,
            message: `Who are the most reliable actors for ${input.srcCcy}-${input.dstCcy}, and what known issues exist?`,
          });
          ctx.reasoning += `**Actor research:** ${research.answer}\n\n`;
          yield { kind: "reasoning", text: research.answer, at: now() };
        }
      } catch (err) {
        yield {
          kind: "error",
          phase: "actor-research",
          message: (err as Error).message,
          at: now(),
        };
      }
      yield {
        kind: "phase-complete",
        phase: "actor-research",
        durationMs: Date.now() - started,
        at: now(),
      };

      started = Date.now();
      yield { kind: "phase-start", phase: "on-chain-path-find", at: now() };
      const corridorStatus = ctx.corridorStatus ?? "UNKNOWN";
      if (corridorStatus === "GREEN") {
        ctx.verdict = "SAFE";
        ctx.riskScore = 0.2;
        yield {
          kind: "path-active",
          pathId: ctx.corridorId ?? "synthetic",
          riskScore: 0.2,
          cost: null,
          at: now(),
        };
      } else if (corridorStatus === "AMBER") {
        ctx.verdict = "SAFE";
        ctx.riskScore = 0.5;
        yield {
          kind: "path-active",
          pathId: ctx.corridorId ?? "synthetic",
          riskScore: 0.5,
          cost: null,
          at: now(),
        };
      } else if (corridorStatus === "RED") {
        ctx.verdict = "REJECTED";
        ctx.riskScore = 0.9;
        yield {
          kind: "path-rejected",
          pathId: ctx.corridorId ?? "synthetic",
          reason: "corridor status RED",
          at: now(),
        };
      } else {
        ctx.verdict = "NO_PATHS";
      }
      yield {
        kind: "phase-complete",
        phase: "on-chain-path-find",
        durationMs: Date.now() - started,
        at: now(),
      };

      started = Date.now();
      yield { kind: "phase-start", phase: "off-chain-bridge", at: now() };
      yield {
        kind: "reasoning",
        text: "Off-chain bridge analysis deferred to follow-up implementation.",
        at: now(),
      };
      yield {
        kind: "phase-complete",
        phase: "off-chain-bridge",
        durationMs: Date.now() - started,
        at: now(),
      };

      started = Date.now();
      yield { kind: "phase-start", phase: "verdict-and-report", at: now() };
      try {
        const reportPrompt = `Generate a Safe Path compliance report (markdown) for the following:\n\nRequest: ${input.amount} ${input.srcCcy} → ${input.dstCcy}\nCorridor: ${ctx.corridorLabel ?? "unknown"} (${ctx.corridorStatus ?? "UNKNOWN"})\nVerdict: ${ctx.verdict}\nReasoning so far:\n${ctx.reasoning}\n\nProduce a 7-section markdown report: Executive Summary, Route, Corridor Classification, Risk Flags, Compliance Justification, Historical Status, Disclaimer. Be specific.`;
        const report = await opts.ai.complete({
          purpose: "agent.report",
          messages: [{ role: "user", content: reportPrompt }],
          temperature: 0.2,
          maxTokens: 1500,
        });
        ctx.reportMarkdown = report.content;
        ctx.reasoning = `${ctx.reasoning}\n${report.content.slice(0, 400)}`.trim();
      } catch (err) {
        yield {
          kind: "error",
          phase: "verdict-and-report",
          message: (err as Error).message,
          at: now(),
        };
      }
      yield {
        kind: "phase-complete",
        phase: "verdict-and-report",
        durationMs: Date.now() - started,
        at: now(),
      };

      ctx.resultJson = {
        corridorId: ctx.corridorId,
        corridorLabel: ctx.corridorLabel,
        corridorStatus: ctx.corridorStatus,
        riskScore: ctx.riskScore,
      };

      yield {
        kind: "result",
        runId: "00000000-0000-0000-0000-000000000000",
        verdict: ctx.verdict,
        riskScore: ctx.riskScore,
        reasoning: ctx.reasoning.slice(0, 4000),
        at: now(),
      };

      return ctx;
    },
  };
}
