import { corridorDb } from "@corlens/db/corridor";
import type { Prisma } from "@corlens/db";

export type CorridorRow = {
  id: string;
  label: string;
  shortLabel: string;
  flag: string;
  tier: number;
  importance: number;
  region: string;
  category: string;
  description: string;
  useCase: string;
  highlights: unknown;
  status: string;
  pathCount: number;
  recRiskScore: number | null;
  recCost: string | null;
  flagsJson: unknown;
  routesJson: unknown;
  liquidityJson: unknown;
  aiNote: string | null;
  amount: string | null;
  sourceJson: unknown;
  destJson: unknown;
  lastRefreshedAt: Date | null;
};

export function createCorridorRepo(prisma: Prisma) {
  const db = corridorDb(prisma);
  return {
    async upsertSeed(rows: Array<Omit<CorridorRow, "status" | "pathCount" | "recRiskScore" | "recCost" | "flagsJson" | "routesJson" | "liquidityJson" | "aiNote" | "lastRefreshedAt"> & { highlights: unknown; sourceJson: unknown; destJson: unknown }>) {
      for (const row of rows) {
        await db.corridor.upsert({
          where: { id: row.id },
          update: {
            label: row.label,
            shortLabel: row.shortLabel,
            flag: row.flag,
            tier: row.tier,
            importance: row.importance,
            region: row.region,
            category: row.category,
            description: row.description,
            useCase: row.useCase,
            highlights: row.highlights as never,
            amount: row.amount,
            sourceJson: row.sourceJson as never,
            destJson: row.destJson as never,
          },
          create: {
            id: row.id,
            label: row.label,
            shortLabel: row.shortLabel,
            flag: row.flag,
            tier: row.tier,
            importance: row.importance,
            region: row.region,
            category: row.category,
            description: row.description,
            useCase: row.useCase,
            highlights: row.highlights as never,
            amount: row.amount,
            sourceJson: row.sourceJson as never,
            destJson: row.destJson as never,
            status: "UNKNOWN",
          },
        });
      }
    },

    async list(filter: { tier?: number; status?: string; currency?: string; limit: number; offset: number }) {
      const where: Record<string, unknown> = {};
      if (filter.tier !== undefined) where.tier = filter.tier;
      if (filter.status) where.status = filter.status;
      if (filter.currency) {
        where.OR = [
          { id: { contains: filter.currency.toLowerCase() } },
        ];
      }
      return db.corridor.findMany({
        where,
        orderBy: [{ tier: "asc" }, { importance: "desc" }],
        take: filter.limit,
        skip: filter.offset,
      });
    },

    async findById(id: string) {
      return db.corridor.findUnique({ where: { id } });
    },

    async updateScan(id: string, update: { status: string; pathCount: number; recRiskScore: number | null; recCost: string | null; flagsJson: unknown; routesJson: unknown; liquidityJson: unknown }) {
      await db.corridor.update({
        where: { id },
        data: {
          status: update.status,
          pathCount: update.pathCount,
          recRiskScore: update.recRiskScore,
          recCost: update.recCost,
          flagsJson: update.flagsJson as never,
          routesJson: update.routesJson as never,
          liquidityJson: update.liquidityJson as never,
          lastRefreshedAt: new Date(),
        },
      });
    },

    async updateAiNote(id: string, aiNote: string, hash: string) {
      await db.corridor.update({
        where: { id },
        data: { aiNote, aiNoteHash: hash },
      });
    },

    async count() {
      return db.corridor.count();
    },
  };
}

export type CorridorRepo = ReturnType<typeof createCorridorRepo>;
