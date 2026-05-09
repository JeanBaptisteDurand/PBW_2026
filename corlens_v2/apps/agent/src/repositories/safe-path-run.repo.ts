import { agentDb } from "@corlens/db/agent";
import type { Prisma } from "@corlens/db";

export type SafePathRunRow = {
  id: string;
  userId: string | null;
  srcCcy: string;
  dstCcy: string;
  amount: string;
  maxRiskTolerance: string;
  verdict: string;
  reasoning: string;
  resultJson: unknown;
  reportMarkdown: string | null;
  corridorId: string | null;
  analysisIds: unknown;
  createdAt: Date;
};

export function createSafePathRunRepo(prisma: Prisma) {
  const db = agentDb(prisma);
  return {
    async create(input: {
      userId: string | null;
      srcCcy: string;
      dstCcy: string;
      amount: string;
      maxRiskTolerance: string;
      verdict: string;
      reasoning: string;
      resultJson: unknown;
      reportMarkdown: string | null;
      corridorId: string | null;
      analysisIds: string[];
    }): Promise<SafePathRunRow> {
      return db.safePathRun.create({
        data: {
          userId: input.userId,
          srcCcy: input.srcCcy,
          dstCcy: input.dstCcy,
          amount: input.amount,
          maxRiskTolerance: input.maxRiskTolerance,
          verdict: input.verdict,
          reasoning: input.reasoning,
          resultJson: input.resultJson as never,
          reportMarkdown: input.reportMarkdown,
          corridorId: input.corridorId,
          analysisIds: input.analysisIds as never,
        },
      }) as unknown as SafePathRunRow;
    },

    async findById(id: string): Promise<SafePathRunRow | null> {
      return db.safePathRun.findUnique({ where: { id } }) as unknown as SafePathRunRow | null;
    },

    async listForUser(userId: string | null, limit: number): Promise<SafePathRunRow[]> {
      const where: Record<string, unknown> = userId ? { userId } : {};
      return db.safePathRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }) as unknown as SafePathRunRow[];
    },
  };
}

export type SafePathRunRepo = ReturnType<typeof createSafePathRunRepo>;
