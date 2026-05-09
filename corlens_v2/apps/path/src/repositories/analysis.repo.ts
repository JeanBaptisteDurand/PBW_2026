import { pathDb } from "@corlens/db/path";
import type { Prisma } from "@corlens/db";

export type AnalysisRow = {
  id: string;
  status: string;
  seedAddress: string;
  seedLabel: string | null;
  depth: number;
  error: string | null;
  summaryJson: unknown;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createAnalysisRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async create(input: { seedAddress: string; seedLabel: string | null; depth: number; userId: string | null }): Promise<AnalysisRow> {
      return db.analysis.create({
        data: { ...input, status: "queued" },
      }) as unknown as AnalysisRow;
    },

    async findById(id: string): Promise<AnalysisRow | null> {
      return db.analysis.findUnique({ where: { id } }) as unknown as AnalysisRow | null;
    },

    async findCachedDone(seedAddress: string, depth: number): Promise<AnalysisRow | null> {
      return db.analysis.findFirst({
        where: { seedAddress, depth, status: "done" },
        orderBy: { createdAt: "desc" },
      }) as unknown as AnalysisRow | null;
    },

    async listForAddress(seedAddress: string, limit: number): Promise<AnalysisRow[]> {
      return db.analysis.findMany({
        where: { seedAddress, status: { in: ["done", "running"] } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }) as unknown as AnalysisRow[];
    },

    async setStatus(id: string, status: string, error: string | null): Promise<void> {
      await db.analysis.update({ where: { id }, data: { status, error } });
    },

    async setSummary(id: string, summaryJson: unknown): Promise<void> {
      await db.analysis.update({ where: { id }, data: { summaryJson: summaryJson as never, status: "done" } });
    },
  };
}

export type AnalysisRepo = ReturnType<typeof createAnalysisRepo>;
