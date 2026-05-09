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
  type SharedState,
  errMessage,
  makeInitialState,
  nowIso,
} from "./phases/types.js";

export type OrchestratorEvent = SafePathEvent;

export type OrchestratorService = {
  run(
    input: ag.SafePathRequest,
    signal?: AbortSignal,
  ): AsyncGenerator<SafePathEvent, SharedState, void>;
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

      let aborted = false;
      for (const phase of phases) {
        if (signal?.aborted) {
          yield { kind: "error", phase: phase.name, message: "aborted", at: nowIso() };
          aborted = true;
          break;
        }
        const started = Date.now();
        yield { kind: "phase-start", phase: phase.name, at: nowIso() };
        try {
          for await (const ev of phase.run(ctx)) {
            yield ev;
          }
        } catch (err) {
          yield {
            kind: "error",
            phase: phase.name,
            message: errMessage(err),
            at: nowIso(),
          };
          aborted = true;
          break;
        }
        yield {
          kind: "phase-complete",
          phase: phase.name,
          durationMs: Date.now() - started,
          at: nowIso(),
        };
      }

      if (!aborted) {
        yield {
          kind: "result",
          runId: state.runId,
          verdict: state.verdict,
          riskScore: state.riskScore,
          reasoning: state.reasoning.slice(0, 4000),
          at: nowIso(),
        };
      }

      return state;
    },
  };
}
