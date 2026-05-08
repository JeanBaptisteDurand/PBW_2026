import type { Prisma } from "./index.js";

export function marketDataDb(prisma: Prisma) {
  return {
    xrplCacheMetadata: prisma.xrplCacheMetadata,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type MarketDataDb = ReturnType<typeof marketDataDb>;
