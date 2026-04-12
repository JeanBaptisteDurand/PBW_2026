import { Router, type IRouter } from "express";
import type {
  CorridorAnalysis,
  CorridorAsset,
  CorridorChatRequest,
  CorridorChatResponse,
  CorridorDetailResponse,
  CorridorListItem,
  CorridorLiquiditySnapshot,
  CorridorPairDef,
  CorridorRouteResult,
  CorridorStatus,
  RiskFlagData,
} from "@corlens/core";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { CORRIDOR_CATALOG, getCatalogEntry } from "../corridors/catalog.js";
import { refreshCorridor } from "../corridors/refreshService.js";
import { corridorChat } from "../corridors/chatService.js";
import {
  fetchPartnerDepth,
  PARTNER_DEPTH_BOOKS,
} from "../corridors/partnerDepth.js";

export const corridorsRouter: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────

function rowToListItem(row: any, entry: CorridorPairDef): CorridorListItem {
  return {
    ...entry,
    highlights: (row.highlights as string[] | null) ?? entry.highlights,
    relatedCorridorIds:
      (row.relatedIds as string[] | null) ?? entry.relatedCorridorIds ?? [],
    source: (row.sourceJson as CorridorAsset | null) ?? entry.source,
    dest: (row.destJson as CorridorAsset | null) ?? entry.dest,
    status: (row.status as CorridorStatus) ?? "UNKNOWN",
    bestRouteId: row.bestRouteId ?? null,
    routeResults:
      (row.routesJson as CorridorRouteResult[] | null) ??
      entry.routes.map((r) => ({
        ...r,
        status: "UNKNOWN" as CorridorStatus,
        pathCount: 0,
        recommendedRiskScore: null,
        recommendedHops: null,
        recommendedCost: null,
        flags: [],
        liquidity: null,
        analysis: null,
        isWinner: false,
        scannedAt: new Date(0).toISOString(),
      })),
    lastRefreshedAt: row.lastRefreshedAt ? row.lastRefreshedAt.toISOString() : null,
    pathCount: row.pathCount ?? 0,
    recommendedRiskScore: row.recRiskScore ?? null,
    recommendedHops: row.recHops ?? null,
    recommendedCost: row.recCost ?? null,
    flags: (row.flagsJson as RiskFlagData[] | null) ?? [],
    aiNote: row.aiNote ?? null,
    liquidity: (row.liquidityJson as CorridorLiquiditySnapshot | null) ?? null,
  };
}

function emptyListItem(entry: CorridorPairDef): CorridorListItem {
  return {
    ...entry,
    status: "UNKNOWN",
    bestRouteId: null,
    routeResults: entry.routes.map((r) => ({
      ...r,
      status: "UNKNOWN",
      pathCount: 0,
      recommendedRiskScore: null,
      recommendedHops: null,
      recommendedCost: null,
      flags: [],
      liquidity: null,
      analysis: null,
      isWinner: false,
      scannedAt: new Date(0).toISOString(),
    })),
    lastRefreshedAt: null,
    pathCount: 0,
    recommendedRiskScore: null,
    recommendedHops: null,
    recommendedCost: null,
    flags: [],
    aiNote: null,
    liquidity: null,
  };
}

function rowToDetail(row: any, entry: CorridorPairDef): CorridorDetailResponse {
  return {
    ...rowToListItem(row, entry),
    analysis: (row.analysisJson as CorridorAnalysis | null) ?? null,
  };
}

// ─── GET /api/corridors — list (served from cache) ───────────────────────

corridorsRouter.get("/", async (_req, res) => {
  try {
    const rows = await prisma.corridor.findMany({
      orderBy: [{ importance: "desc" }, { id: "asc" }],
    });
    const byId = new Map(rows.map((r) => [r.id, r] as const));

    const items: CorridorListItem[] = CORRIDOR_CATALOG.map((entry) => {
      const row = byId.get(entry.id);
      return row ? rowToListItem(row, entry) : emptyListItem(entry);
    });

    res.json({ corridors: items });
  } catch (err: any) {
    logger.error("[corridors] list failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

// ─── GET /api/corridors/:id — detail ─────────────────────────────────────

corridorsRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const entry = getCatalogEntry(id);
    if (!entry) {
      res.status(404).json({ error: "corridor not found" });
      return;
    }
    const row = await prisma.corridor.findUnique({ where: { id } });
    if (!row) {
      res.json({
        corridor: { ...emptyListItem(entry), analysis: null } as CorridorDetailResponse,
      });
      return;
    }
    res.json({ corridor: rowToDetail(row, entry) });
  } catch (err: any) {
    logger.error("[corridors] detail failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

// ─── GET /api/corridors/:id/partner-depth — live partner orderbook ──────
//
// Proof-of-concept "measured, not assumed" endpoint: returns a live
// orderbook snapshot from a supported partner venue for a given
// corridor. Currently only Bitso (xrp_mxn book) is wired up, used on
// the USD→MXN and MXN→USD pages as the demo for what v2 of CorLens
// looks like when every actor publishes measured depth alongside the
// research-derived classification.

corridorsRouter.get("/:id/partner-depth", async (req, res) => {
  try {
    const { id } = req.params;
    const entry = getCatalogEntry(id);
    if (!entry) {
      res.status(404).json({ error: "corridor not found" });
      return;
    }
    const actor = String(req.query.actor ?? "bitso").toLowerCase();
    const bookKey = `${id}:${actor}`;
    const book = PARTNER_DEPTH_BOOKS[bookKey];
    if (!book) {
      res.status(404).json({
        error: `No partner depth feed wired for corridor=${id} actor=${actor}. Currently only bitso on usd-mxn / mxn-usd is supported (proof-of-concept).`,
        supported: Object.keys(PARTNER_DEPTH_BOOKS),
      });
      return;
    }
    const snapshot = await fetchPartnerDepth(actor, book);
    res.json({ snapshot });
  } catch (err: any) {
    logger.error("[corridors] partner-depth failed", {
      id: req.params.id,
      error: err?.message,
    });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

// ─── GET /api/corridors/:id/history — 30-day status timeline ─────────────

corridorsRouter.get("/:id/history", async (req, res) => {
  try {
    const { id } = req.params;
    const entry = getCatalogEntry(id);
    if (!entry) {
      res.status(404).json({ error: "corridor not found" });
      return;
    }
    const days = Math.min(
      90,
      Math.max(1, Number.parseInt(String(req.query.days ?? "30"), 10) || 30),
    );
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await prisma.corridorStatusEvent.findMany({
      where: { corridorId: id, at: { gte: since } },
      orderBy: { at: "asc" },
      take: 2000,
      select: {
        id: true,
        status: true,
        pathCount: true,
        recCost: true,
        source: true,
        at: true,
      },
    });
    res.json({
      corridorId: id,
      windowDays: days,
      events: events.map((e) => ({
        id: e.id,
        status: e.status,
        pathCount: e.pathCount,
        recCost: e.recCost,
        source: e.source,
        at: e.at.toISOString(),
      })),
    });
  } catch (err: any) {
    logger.error("[corridors] history failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

// ─── POST /api/corridors/refresh/:id — on-demand refresh ─────────────────

corridorsRouter.post("/refresh/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const entry = getCatalogEntry(id);
    if (!entry) {
      res.status(404).json({ error: "corridor not found" });
      return;
    }
    const result = await refreshCorridor(entry, { forceAiNote: false });
    const row = await prisma.corridor.findUnique({ where: { id } });
    res.json({
      refresh: result,
      corridor: row ? rowToDetail(row, entry) : null,
    });
  } catch (err: any) {
    logger.error("[corridors] refresh failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

// ─── POST /api/corridors/chat — RAG chat ─────────────────────────────────

corridorsRouter.post("/chat", async (req, res) => {
  try {
    const body = req.body as CorridorChatRequest | undefined;
    if (!body?.message || typeof body.message !== "string") {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const result = await corridorChat({
      message: body.message,
      corridorId: body.corridorId ?? null,
      chatId: body.chatId ?? null,
    });
    const response: CorridorChatResponse = {
      chatId: result.chatId,
      message: { role: "assistant", content: result.content },
      sources: result.sources,
    };
    res.json(response);
  } catch (err: any) {
    logger.error("[corridors] chat failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});

corridorsRouter.get("/chat/:chatId", async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await prisma.corridorRagChat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!chat) {
      res.status(404).json({ error: "chat not found" });
      return;
    }
    res.json({
      chatId: chat.id,
      corridorId: chat.corridorId,
      messages: chat.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources ?? undefined,
        createdAt: m.createdAt,
      })),
    });
  } catch (err: any) {
    logger.error("[corridors] chat history failed", { error: err?.message });
    res.status(500).json({ error: err?.message ?? "internal error" });
  }
});
