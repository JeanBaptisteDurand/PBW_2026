import type { Prisma } from "./index.js";

export function pathDb(prisma: Prisma) {
  return {
    analysis: prisma.analysis,
    node: prisma.node,
    edge: prisma.edge,
    riskFlag: prisma.riskFlag,
    ragDocument: prisma.ragDocument,
    ragChat: prisma.ragChat,
    ragMessage: prisma.ragMessage,
    complianceReport: prisma.complianceReport,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type PathDb = ReturnType<typeof pathDb>;
