import type { Prisma } from "./index.js";

export function aiDb(prisma: Prisma) {
  return {
    promptLog: prisma.promptLog,
    webSearchCache: prisma.webSearchCache,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type AiDb = ReturnType<typeof aiDb>;
