import { randomUUID } from "node:crypto";
import type { EventBus } from "@corlens/events";
import type { PaymentRepo } from "../repositories/payment.repo.js";
import type { XrplPaymentClient } from "../connectors/xrpl.js";

export type PaymentEnv = {
  XRPL_PAYMENT_WALLET_ADDRESS: string;
  XRP_PRICE: string;
  RLUSD_PRICE: string;
  PAYMENT_EXPIRY_MINUTES: number;
  XRPL_DEMO_WALLET_SECRET?: string;
};

export type PaymentServiceOptions = {
  payments: PaymentRepo;
  xrpl: XrplPaymentClient;
  events: EventBus;
  env: PaymentEnv;
};

export type PaymentService = ReturnType<typeof createPaymentService>;

export function createPaymentService(opts: PaymentServiceOptions) {
  function priceFor(currency: "XRP" | "RLUSD"): string {
    return currency === "XRP" ? opts.env.XRP_PRICE : opts.env.RLUSD_PRICE;
  }

  return {
    async create(input: { userId: string; currency: "XRP" | "RLUSD" }) {
      const memo = randomUUID();
      const expiresAt = new Date(Date.now() + opts.env.PAYMENT_EXPIRY_MINUTES * 60 * 1000);
      const created = await opts.payments.create({
        userId: input.userId,
        amount: priceFor(input.currency),
        currency: input.currency,
        destination: opts.env.XRPL_PAYMENT_WALLET_ADDRESS,
        memo,
        expiresAt,
      });
      return {
        paymentId: created.id,
        destination: created.destination,
        amount: created.amount,
        currency: input.currency,
        memo: created.memo,
      };
    },

    async checkStatus(input: { paymentId: string }):
      Promise<
        | { status: "pending" }
        | { status: "confirmed"; txHash: string }
        | { status: "expired" }
        | { status: "not_found" }
      >
    {
      const req = await opts.payments.findById(input.paymentId);
      if (!req) return { status: "not_found" };
      if (req.status === "confirmed") return { status: "confirmed", txHash: req.txHash! };
      if (req.status === "expired") return { status: "expired" };
      if (new Date() > req.expiresAt) {
        await opts.payments.expire(req.id);
        return { status: "expired" };
      }

      const incoming = await opts.xrpl.pollIncomingByMemo({
        destination: req.destination,
        memo: req.memo,
      });
      if (!incoming) return { status: "pending" };

      const { req: confirmed, alreadyConfirmed } = await opts.payments.confirmAtomic({
        paymentId: req.id,
        txHash: incoming.txHash,
        walletAddress: incoming.sourceAccount,
      });

      if (!alreadyConfirmed) {
        const confirmedAt = new Date().toISOString();
        await opts.events.publish("payment.confirmed", {
          userId: confirmed.userId,
          paymentId: confirmed.id,
          txHash: incoming.txHash,
          amount: confirmed.amount,
          currency: confirmed.currency as "XRP" | "RLUSD",
          confirmedAt,
        });
        await opts.events.publish("user.role_upgraded", {
          userId: confirmed.userId,
          newRole: "premium",
          upgradedAt: confirmedAt,
        });
      }

      return { status: "confirmed", txHash: incoming.txHash };
    },

    async demoPay(input: { paymentId: string }): Promise<{ txHash: string }> {
      if (!opts.env.XRPL_DEMO_WALLET_SECRET) {
        throw new Error("demo_wallet_not_configured");
      }
      const req = await opts.payments.findById(input.paymentId);
      if (!req) throw new Error("payment_not_found");
      if (req.status === "confirmed") throw new Error("already_confirmed");
      return opts.xrpl.submitDemoPayment({
        demoWalletSecret: opts.env.XRPL_DEMO_WALLET_SECRET,
        destination: req.destination,
        memo: req.memo,
        amount: req.amount,
        currency: req.currency as "XRP" | "RLUSD",
      });
    },
  };
}
