import type { Prisma } from "@corlens/db";
import { aiDb } from "@corlens/db/ai";

export type PromptLogInput = {
  purpose: string;
  model: string;
  promptHash: string;
  prompt: unknown;
  response?: unknown;
  tokensIn?: number;
  tokensOut?: number;
  latencyMs?: number;
  error?: string;
};

export function createPromptLogRepo(prisma: Prisma) {
  const db = aiDb(prisma);
  return {
    async insert(input: PromptLogInput): Promise<{ id: string }> {
      const row = await db.promptLog.create({
        data: {
          purpose: input.purpose,
          model: input.model,
          promptHash: input.promptHash,
          prompt: input.prompt as never,
          response: (input.response ?? null) as never,
          tokensIn: input.tokensIn ?? null,
          tokensOut: input.tokensOut ?? null,
          latencyMs: input.latencyMs ?? null,
          error: input.error ?? null,
        },
        select: { id: true },
      });
      return { id: row.id };
    },

    async rollupByPurpose(
      sinceIso: string,
    ): Promise<Array<{ purpose: string; callCount: number; tokensIn: number; tokensOut: number }>> {
      const rows = await db.promptLog.groupBy({
        by: ["purpose"],
        where: { createdAt: { gte: new Date(sinceIso) }, error: null },
        _count: { _all: true },
        _sum: { tokensIn: true, tokensOut: true },
      });
      return rows.map((r) => ({
        purpose: r.purpose,
        callCount: r._count._all,
        tokensIn: r._sum.tokensIn ?? 0,
        tokensOut: r._sum.tokensOut ?? 0,
      }));
    },
  };
}

export type PromptLogRepo = ReturnType<typeof createPromptLogRepo>;
