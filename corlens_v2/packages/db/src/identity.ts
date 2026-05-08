import type { Prisma } from "./index.js";

export function identityDb(prisma: Prisma) {
  return {
    user: prisma.user,
    premiumSubscription: prisma.premiumSubscription,
    paymentRequest: prisma.paymentRequest,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type IdentityDb = ReturnType<typeof identityDb>;
