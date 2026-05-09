import { randomUUID } from "node:crypto";
import type { agent as ag } from "@corlens/contracts";
import type { AIServiceClient } from "../../connectors/ai-service.js";
import type { CorridorClient } from "../../connectors/corridor.js";
import type { MarketDataClient } from "../../connectors/market-data.js";
import type { PathClient } from "../../connectors/path.js";

export type SafePathPhase = ag.SafePathPhase;
export type SafePathEvent = ag.SafePathEvent;
export type SafePathRequest = ag.SafePathRequest;
export type SplitLeg = ag.SplitLeg;
export type RiskFlag = ag.RiskFlag;

export type Verdict = "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED";

export type AnalysisSummary = {
  id: string;
  address: string;
  label: string;
  nodeCount: number;
  edgeCount: number;
};

export type DeepAnalysisResult = {
  label: string;
  nodeCount: number;
  edgeCount: number;
  ragInsight?: string;
};

export type PartnerDepthSnapshot = {
  actor: string;
  book: string;
  venue: string;
  bidCount: number;
  askCount: number;
  spreadBps: number | null;
  bidDepthBase: string;
  askDepthBase: string;
  fetchedAt: string;
};

export type SharedState = {
  runId: string;
  corridor: {
    id: string | null;
    label: string | null;
    status: string | null;
    category: string | null;
    bridgeAsset: string | null;
  };
  isOnChain: boolean;
  srcIssuers: Array<{ key: string; name: string; address: string }>;
  dstIssuers: Array<{ key: string; name: string; address: string }>;
  srcActors: Array<{
    key: string;
    name: string;
    type: string;
    country?: string;
    supportsXrp?: boolean;
    supportsRlusd?: boolean;
    odl?: boolean;
    note?: string;
  }>;
  dstActors: SharedState["srcActors"];
  corridorRagAnswer: string | null;
  plan: string | null;
  actorResearch: Map<string, string[]>;
  partnerDepth: PartnerDepthSnapshot | null;
  analysisIds: string[];
  analysisSummaries: AnalysisSummary[];
  deepAnalyses: Map<string, DeepAnalysisResult>;
  ragInsights: Map<string, string>;
  analyzedAddresses: Set<string>;
  paths: unknown[];
  rejected: Array<{ pathId: string; reason: string; flags: string[] }>;
  splitPlan: SplitLeg[] | null;
  verdict: Verdict;
  riskScore: number | null;
  reasoning: string;
  reportMarkdown: string | null;
  resultJson: Record<string, unknown>;
};

export type PhaseDeps = {
  corridor: CorridorClient;
  path: PathClient;
  ai: AIServiceClient;
  marketData: MarketDataClient;
};

export type PhaseContext = {
  input: SafePathRequest;
  state: SharedState;
  deps: PhaseDeps;
  signal?: AbortSignal;
};

export interface Phase {
  readonly name: SafePathPhase;
  run(ctx: PhaseContext): AsyncGenerator<SafePathEvent, void, void>;
}

export function makeInitialState(): SharedState {
  return {
    runId: randomUUID(),
    corridor: { id: null, label: null, status: null, category: null, bridgeAsset: null },
    isOnChain: false,
    srcIssuers: [],
    dstIssuers: [],
    srcActors: [],
    dstActors: [],
    corridorRagAnswer: null,
    plan: null,
    actorResearch: new Map(),
    partnerDepth: null,
    analysisIds: [],
    analysisSummaries: [],
    deepAnalyses: new Map(),
    ragInsights: new Map(),
    analyzedAddresses: new Set(),
    paths: [],
    rejected: [],
    splitPlan: null,
    verdict: "NO_PATHS",
    riskScore: null,
    reasoning: "",
    reportMarkdown: null,
    resultJson: {},
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return "unknown error";
  }
}
