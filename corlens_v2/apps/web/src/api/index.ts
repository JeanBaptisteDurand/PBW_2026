import type {
  CorridorActor,
  CorridorAsset,
  CorridorDetailResponse,
  CorridorListItem,
  CorridorRouteCandidate,
  CorridorRouteResult,
} from "../lib/core-types.js";
import { agentApi } from "./agent.js";
import { corridorApi, invalidateCorridorCache } from "./corridor.js";
import { identityApi } from "./identity.js";
import { pathApi } from "./path.js";

export { ApiError } from "./client.js";
export { invalidateCorridorCache };

// v2's typed namespace API.
const namespaced = {
  identity: identityApi,
  corridor: corridorApi,
  path: pathApi,
  agent: agentApi,
} as const;

// ─── v1-shape enrichers for the v2 corridor responses ────────────
// v2 list returns ~12 fields; v1's CorridorListItem demands every
// CorridorPairDef field. Fill the v2-absent fields with empty defaults
// so the v1 components type-check without changing their data-access
// patterns. Detail responses already carry more fields from v2 — pass
// them through and stub only the truly absent ones (routeResults, etc.).

const EMPTY_ASSET: CorridorAsset = { symbol: "?", type: "fiat", flag: "" };

function enrichListItem(v2: {
  id: string;
  label: string;
  shortLabel: string;
  flag: string;
  tier: number;
  region: string;
  category: string;
  status: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
  pathCount: number;
  recRiskScore: number | null;
  recCost: string | null;
  lastRefreshedAt: string | null;
}): CorridorListItem {
  return {
    id: v2.id,
    label: v2.label,
    shortLabel: v2.shortLabel,
    flag: v2.flag,
    tier: v2.tier as CorridorListItem["tier"],
    importance: 0,
    region: v2.region as CorridorListItem["region"],
    category: v2.category as CorridorListItem["category"],
    description: "",
    useCase: "",
    highlights: [],
    source: EMPTY_ASSET,
    dest: EMPTY_ASSET,
    amount: "0",
    routes: [] as CorridorRouteCandidate[],
    status: v2.status,
    bestRouteId: null,
    routeResults: [] as CorridorRouteResult[],
    lastRefreshedAt: v2.lastRefreshedAt,
    pathCount: v2.pathCount,
    recommendedRiskScore: v2.recRiskScore,
    recommendedHops: null,
    recommendedCost: v2.recCost,
    flags: [],
    aiNote: null,
    liquidity: null,
  };
}

function enrichDetail(v2: Record<string, unknown>): CorridorDetailResponse {
  // v2 detail already exposes most CorridorPairDef fields. Fall back to
  // stubs for the few that don't ride along.
  return {
    ...(enrichListItem(v2 as never) as CorridorDetailResponse),
    importance: (v2.importance as number) ?? 0,
    description: (v2.description as string) ?? "",
    useCase: (v2.useCase as string) ?? "",
    highlights: (v2.highlights as string[]) ?? [],
    amount: (v2.amount as string) ?? "0",
    source: ((v2.source as CorridorAsset) ?? EMPTY_ASSET) as CorridorAsset,
    dest: ((v2.dest as CorridorAsset) ?? EMPTY_ASSET) as CorridorAsset,
    routes: (v2.routes as CorridorRouteCandidate[]) ?? [],
    aiNote: (v2.aiNote as string | null) ?? null,
    liquidity: null,
    flags: [],
    analysis: null,
  };
}

// v1 ported the SPA with a flat `api.<method>` surface. The legacy aliases
// below preserve those call sites while routing each through the v2 typed
// wrappers, so we don't rewrite ~14 kLOC of components for the rename.
//
// Where v1 + v2 contracts diverge, the alias normalises in one place rather
// than per-callsite.
const legacy = {
  // ─── Corridor ────────────────────────────────────────────────
  // v1 list shape requires every CorridorPairDef field; v2 list is thinner.
  // enrichListItem fills the gap.
  listCorridors: async (): Promise<{ corridors: CorridorListItem[] }> => {
    const v2 = await corridorApi.listCorridors();
    return { corridors: v2.corridors.map(enrichListItem as never) };
  },
  refreshCache: invalidateCorridorCache,
  getCorridor: async (id: string): Promise<{ corridor: CorridorDetailResponse }> => {
    const v2 = await corridorApi.getCorridor(id);
    return { corridor: enrichDetail(v2 as unknown as Record<string, unknown>) };
  },
  getCorridorHistory: (id: string, days = 30) => corridorApi.getStatusHistory(id, days),
  corridorChat: async (req: { corridorId?: string; message: string }) => {
    const r = await corridorApi.chat(req);
    return {
      chatId: req.corridorId ?? "",
      message: { role: "assistant" as const, content: r.answer },
      sources: r.sources.map((s) => ({
        corridorId: s.id,
        label: s.id,
        snippet: s.snippet,
        score: 0,
      })),
    };
  },

  // v1 had a manual force-refresh; v2's scanner runs on a cron so the route
  // does not exist. Resolve with the latest cached snapshot so callers don't
  // crash — the next scanner tick picks up changes.
  refreshCorridor: async (id: string): Promise<{ corridor: CorridorDetailResponse }> => {
    const v2 = await corridorApi.getCorridor(id);
    return { corridor: enrichDetail(v2 as unknown as Record<string, unknown>) };
  },

  // v1: getPartnerDepth(corridorId, actor='bitso'); v2: (actor, book).
  // Derive `book` from corridorId (e.g. "usd-mxn" → "USD-MXN" → "XRP/MXN")
  // — the v2 endpoint accepts arbitrary book strings, the adapter on the
  // backend picks the right partner-orderbook.
  getPartnerDepth: (corridorId: string, actor = "bitso") => {
    const parts = corridorId.toUpperCase().split("-");
    const book = parts.length === 2 ? `XRP/${parts[1]}` : corridorId.toUpperCase();
    return corridorApi.getPartnerDepth(actor, book) as Promise<{
      snapshot: {
        actor: string;
        book: string;
        venue: string;
        bidCount: number;
        askCount: number;
        topBid: { price: string; amount: string } | null;
        topAsk: { price: string; amount: string } | null;
        spreadBps: number | null;
        bidDepthBase: string;
        askDepthBase: string;
        source: string;
        fetchedAt: string;
        ttlSeconds: number;
      };
    }>;
  },

  // ─── Analysis (path service) ────────────────────────────────
  startAnalysis: pathApi.startAnalysis,
  getAnalysisStatus: pathApi.getAnalysis,
  getAnalysisHistory: async () => (await pathApi.listAnalyses()).analyses,
  getGraph: pathApi.getGraph,

  // ─── Chat ────────────────────────────────────────────────────
  sendChatMessage: async (
    analysisId: string,
    message: string,
    _chatId?: string,
  ): Promise<{ chatId: string; message: { role: "assistant"; content: string } }> => {
    const res = await pathApi.chat(analysisId, message);
    return { chatId: analysisId, message: { role: "assistant", content: res.answer } };
  },
  getChatHistory: async (analysisId: string) => {
    const res = await pathApi.getChat(analysisId);
    return res.messages.map((m) => ({
      role: m.role === "user" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    }));
  },

  // ─── Compliance (agent service) ─────────────────────────────
  generateComplianceReport: agentApi.generateComplianceAnalysis,
  getComplianceReports: async (analysisId: string) => [
    await agentApi.getComplianceAnalysisMarkdown(analysisId),
  ],

  // ─── Auth ────────────────────────────────────────────────────
  getProfile: identityApi.getProfile,
  generateApiKey: identityApi.generateApiKey,
  revokeApiKey: identityApi.revokeApiKey,

  // ─── Payment ─────────────────────────────────────────────────
  getPaymentInfo: identityApi.getPaymentInfo,
  createPaymentRequest: identityApi.createPaymentRequest,
  getPaymentStatus: identityApi.getPaymentStatus,
  demoPay: identityApi.demoPay,

  // ─── Safe Path ───────────────────────────────────────────────
  getSafePathHistory: async () => (await agentApi.listSafePathRuns()).runs,
  getSafePathRun: agentApi.getSafePathRun,
};

export const api = { ...namespaced, ...legacy };
export type Api = typeof api;
