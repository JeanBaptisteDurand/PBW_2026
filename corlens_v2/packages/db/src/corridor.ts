import type { Prisma } from "./index.js";

export function corridorDb(prisma: Prisma) {
  return {
    corridor: prisma.corridor,
    corridorStatusEvent: prisma.corridorStatusEvent,
    corridorRagDocument: prisma.corridorRagDocument,
    corridorRagChat: prisma.corridorRagChat,
    corridorRagMessage: prisma.corridorRagMessage,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type CorridorDb = ReturnType<typeof corridorDb>;
