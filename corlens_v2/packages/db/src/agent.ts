import type { Prisma } from "./index.js";

export function agentDb(prisma: Prisma) {
  return {
    safePathRun: prisma.safePathRun,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type AgentDb = ReturnType<typeof agentDb>;
