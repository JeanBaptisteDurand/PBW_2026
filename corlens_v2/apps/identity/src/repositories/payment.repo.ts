import type { IdentityDb } from "@corlens/db/identity";

export function createPaymentRepo(db: IdentityDb) {
  return {
    async create(input: {
      userId: string;
      amount: string;
      currency: string;
      destination: string;
      memo: string;
      expiresAt: Date;
    }) {
      return db.paymentRequest.create({
        data: { ...input, status: "pending" },
      });
    },

    async findById(id: string) {
      return db.paymentRequest.findUnique({ where: { id } });
    },

    async confirmAtomic(input: {
      paymentId: string;
      txHash: string;
      walletAddress: string;
    }) {
      const req = await db.paymentRequest.findUnique({ where: { id: input.paymentId } });
      if (!req) throw new Error("payment_not_found");
      if (req.status === "confirmed") return { req, alreadyConfirmed: true };

      const [updated, sub] = await db.$transaction([
        db.paymentRequest.update({
          where: { id: input.paymentId },
          data: { status: "confirmed", txHash: input.txHash },
        }),
        db.premiumSubscription.create({
          data: {
            userId: req.userId,
            txHash: input.txHash,
            amount: req.amount,
            currency: req.currency,
            walletAddress: input.walletAddress,
            memo: req.memo,
          },
        }),
        db.user.update({
          where: { id: req.userId },
          data: { role: "premium" },
        }),
      ]);

      return { req: updated, sub, alreadyConfirmed: false };
    },

    async expire(paymentId: string) {
      await db.paymentRequest.update({ where: { id: paymentId }, data: { status: "expired" } });
    },
  };
}

export type PaymentRepo = ReturnType<typeof createPaymentRepo>;
