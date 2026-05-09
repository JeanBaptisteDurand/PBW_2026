import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { corridor as cc } from "@corlens/contracts";
import type { CorridorRepo } from "../repositories/corridor.repo.js";
import type { StatusEventRepo } from "../repositories/status-event.repo.js";

const ErrorResp = z.object({ error: z.string() });

function rowToList(r: Awaited<ReturnType<CorridorRepo["list"]>>[number]) {
  return {
    id: r.id, label: r.label, shortLabel: r.shortLabel, flag: r.flag, tier: r.tier,
    region: r.region, category: r.category,
    status: (r.status as "GREEN" | "AMBER" | "RED" | "UNKNOWN"),
    pathCount: r.pathCount, recRiskScore: r.recRiskScore, recCost: r.recCost,
    lastRefreshedAt: r.lastRefreshedAt ? r.lastRefreshedAt.toISOString() : null,
  };
}

export async function registerCorridorRoutes(app: FastifyInstance, corridors: CorridorRepo, events: StatusEventRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/corridors", {
    schema: { querystring: cc.CorridorListQuery, response: { 200: z.array(cc.CorridorListItem) }, tags: ["corridor"] },
  }, async (req) => {
    const rows = await corridors.list(req.query);
    return rows.map(rowToList);
  });

  typed.get("/api/corridors/:id", {
    schema: { params: z.object({ id: z.string() }), response: { 200: cc.CorridorDetail, 404: ErrorResp }, tags: ["corridor"] },
  }, async (req, reply) => {
    const r = await corridors.findById(req.params.id);
    if (!r) { reply.status(404).send({ error: "not_found" }); return reply; }
    return {
      ...rowToList(r),
      importance: r.importance,
      description: r.description,
      useCase: r.useCase,
      highlights: (r.highlights as string[]) ?? [],
      amount: r.amount,
      source: r.sourceJson as never,
      dest: r.destJson as never,
      routes: (r.routesJson as unknown[]) ?? [],
      flags: Array.isArray(r.flagsJson) ? (r.flagsJson as unknown[]) : [],
      liquidity: r.liquidityJson,
      aiNote: r.aiNote,
    };
  });

  typed.get("/api/corridors/:id/status-history", {
    schema: { params: z.object({ id: z.string() }), querystring: cc.StatusHistoryQuery, response: { 200: cc.StatusHistoryResponse }, tags: ["corridor"] },
  }, async (req) => {
    const since = new Date(Date.now() - req.query.days * 24 * 60 * 60 * 1000).toISOString();
    const evts = await events.listSince(req.params.id, since);
    return {
      corridorId: req.params.id,
      events: evts.map((e) => ({ ...e, status: e.status as "GREEN" | "AMBER" | "RED" | "UNKNOWN" })),
    };
  });
}
