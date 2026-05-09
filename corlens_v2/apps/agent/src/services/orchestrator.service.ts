import type { agent as ag } from "@corlens/contracts";
import type { AIServiceClient } from "../connectors/ai-service.js";
import type { CorridorClient } from "../connectors/corridor.js";
import type { MarketDataClient } from "../connectors/market-data.js";
import type { PathClient } from "../connectors/path.js";
import { CorridorResolutionPhase } from "./phases/01-corridor-resolution.js";
import { CorridorRagPhase } from "./phases/02-corridor-rag.js";
import { PlanningPhase } from "./phases/03-planning.js";
import { ActorResearchPhase } from "./phases/04-actor-research.js";
import { DeepEntityAnalysisPhase } from "./phases/05-deep-entity-analysis.js";
import { OnChainPathFindPhase } from "./phases/06-on-chain-path-find.js";
import { OffChainBridgePhase } from "./phases/07-off-chain-bridge.js";
import { SplitPlanPhase } from "./phases/08-split-plan.js";
import { ReportPhase } from "./phases/09-report.js";
import {
  type Phase,
  type PhaseContext,
  type SafePathEvent,
  type SafePathPhase,
  type SharedState,
  makeInitialState,
  nowIso,
} from "./phases/types.js";

export type OrchestratorEvent = SafePathEvent;

export type OrchestratorContext = {
  corridorId: string | null;
  corridorLabel: string | null;
  corridorStatus: string | null;
  reasoning: string;
  verdict: SharedState["verdict"];
  riskScore: number | null;
  analysisIds: string[];
  reportMarkdown: string | null;
  resultJson: Record<string, unknown>;
};

export type OrchestratorService = {
  run(
    input: ag.SafePathRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<OrchestratorEvent, OrchestratorContext, void>;
};

export type OrchestratorOptions = {
  corridor: CorridorClient;
  path: PathClient;
  ai: AIServiceClient;
  marketData: MarketDataClient;
  timeoutMs: number;
  phases?: Phase[];
};

export function defaultPhases(): Phase[] {
  return [
    new CorridorResolutionPhase(),
    new CorridorRagPhase(),
    new PlanningPhase(),
    new ActorResearchPhase(),
    new DeepEntityAnalysisPhase(),
    new OnChainPathFindPhase(),
    new OffChainBridgePhase(),
    new SplitPlanPhase(),
    new ReportPhase(),
  ];
}

export function createOrchestrator(opts: OrchestratorOptions): OrchestratorService {
  const phases = opts.phases ?? defaultPhases();

  return {
    async *run(input, signal) {
      const state = makeInitialState();
      const ctx: PhaseContext = {
        input,
        state,
        deps: {
          corridor: opts.corridor,
          path: opts.path,
          ai: opts.ai,
          marketData: opts.marketData,
        },
        signal,
      };
      const buf: SafePathEvent[] = [];
      const emit = (e: SafePathEvent) => {
        buf.push(e);
      };

      const drain = function* (): Generator<SafePathEvent> {
        while (buf.length > 0) {
          const next = buf.shift();
          if (next) yield next;
        }
      };

      let aborted = false;
      for (const phase of phases) {
        if (signal?.aborted) {
          aborted = true;
          break;
        }
        const started = Date.now();
        emit({ kind: "phase-start", phase: phase.name, at: nowIso() });
        for (const ev of drain()) yield ev;

        try {
          await phase.run(ctx, emit);
          for (const ev of drain()) yield ev;
        } catch (err) {
          emit({
            kind: "error",
            phase: phase.name as SafePathPhase,
            message: (err as Error).message,
            at: nowIso(),
          });
          for (const ev of drain()) yield ev;
          aborted = true;
          break;
        }

        emit({
          kind: "phase-complete",
          phase: phase.name,
          durationMs: Date.now() - started,
          at: nowIso(),
        });
        for (const ev of drain()) yield ev;
      }

      if (!aborted) {
        emit({
          kind: "result",
          runId: "00000000-0000-0000-0000-000000000000",
          verdict: state.verdict,
          riskScore: state.riskScore,
          reasoning: state.reasoning.slice(0, 4000),
          at: nowIso(),
        });
        for (const ev of drain()) yield ev;
      }

      return {
        corridorId: state.corridor.id,
        corridorLabel: state.corridor.label,
        corridorStatus: state.corridor.status,
        reasoning: state.reasoning,
        verdict: state.verdict,
        riskScore: state.riskScore,
        analysisIds: state.analysisIds,
        reportMarkdown: state.reportMarkdown,
        resultJson: state.resultJson,
      };
    },
  };
}
