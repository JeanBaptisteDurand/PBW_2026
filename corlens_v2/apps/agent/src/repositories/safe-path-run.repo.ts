import type { Prisma } from "@corlens/db";
import { agentDb } from "@corlens/db/agent";

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
  riskScore: number | null;
  auditHash: string | null;
  createdAt: Date;
};

export function createSafePathRunRepo(prisma: Prisma) {
  const db = agentDb(prisma);
  return {
    async create(input: {
      id?: string;
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
      riskScore?: number | null;
      auditHash?: string | null;
    }): Promise<SafePathRunRow> {
      return db.safePathRun.create({
        data: {
          ...(input.id ? { id: input.id } : {}),
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
          riskScore: input.riskScore ?? null,
          auditHash: input.auditHash ?? null,
        },
      }) as unknown as SafePathRunRow;
    },

    async findById(id: string): Promise<SafePathRunRow | null> {
      return db.safePathRun.findUnique({ where: { id } }) as unknown as SafePathRunRow | null;
    },

    async findByAuditHash(hash: string): Promise<SafePathRunRow | null> {
      return db.safePathRun.findUnique({
        where: { auditHash: hash },
      }) as unknown as SafePathRunRow | null;
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
