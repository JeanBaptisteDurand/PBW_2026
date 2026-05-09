import { corridorDb } from "@corlens/db/corridor";
import type { Prisma } from "@corlens/db";

export function createStatusEventRepo(prisma: Prisma) {
  const db = corridorDb(prisma);
  return {
    async append(input: { corridorId: string; status: string; pathCount: number; recCost: string | null; source: string }) {
      await db.corridorStatusEvent.create({
        data: { ...input },
      });
    },

    async listSince(corridorId: string, sinceIso: string) {
      const rows = await db.corridorStatusEvent.findMany({
        where: { corridorId, at: { gte: new Date(sinceIso) } },
        orderBy: { at: "asc" },
      });
      return rows.map((r) => ({
        status: r.status,
        pathCount: r.pathCount,
        recCost: r.recCost,
        source: r.source,
        at: r.at.toISOString(),
      }));
    },
  };
}

export type StatusEventRepo = ReturnType<typeof createStatusEventRepo>;
