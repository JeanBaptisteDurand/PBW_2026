import { aiDb } from "@corlens/db/ai";
import type { Prisma } from "@corlens/db";

export function createWebSearchCacheRepo(prisma: Prisma) {
  const db = aiDb(prisma);
  return {
    async get(query: string): Promise<unknown | null> {
      const row = await db.webSearchCache.findUnique({ where: { query } });
      if (!row) return null;
      if (row.expiresAt < new Date()) return null;
      return row.results as unknown;
    },

    async set(query: string, provider: string, results: unknown, ttlHours: number): Promise<void> {
      const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
      await db.webSearchCache.upsert({
        where: { query },
        update: { provider, results: results as never, expiresAt, createdAt: new Date() },
        create: { query, provider, results: results as never, expiresAt },
      });
    },
  };
}

export type WebSearchCacheRepo = ReturnType<typeof createWebSearchCacheRepo>;
