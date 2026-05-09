import { identity as id } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { Wallet } from "xrpl";
import { z } from "zod";
import type { IdentityEnv } from "../env.js";
import type { PaymentService } from "../services/payment.service.js";

const ErrorResponse = z.object({ error: z.string() });

function bearerToken(req: { headers: { authorization?: string } }): string | undefined {
  const a = req.headers.authorization;
  return a?.startsWith("Bearer ") ? a.slice(7) : undefined;
}

function demoWalletAddress(env: IdentityEnv): string {
  if (!env.XRPL_DEMO_WALLET_SECRET) return "";
  try {
    return Wallet.fromSeed(env.XRPL_DEMO_WALLET_SECRET).address;
  } catch {
    return "";
  }
}

export async function registerPaymentRoutes(
  app: FastifyInstance,
  payments: PaymentService,
  env: IdentityEnv,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/api/payment/info",
    {
      schema: {
        response: { 200: id.PaymentInfoResponse },
        tags: ["payment"],
      },
    },
    async () => {
      return {
        options: [
          { currency: "XRP" as const, amount: env.XRP_PRICE, label: `${env.XRP_PRICE} XRP` },
          {
            currency: "RLUSD" as const,
            amount: env.RLUSD_PRICE,
            label: `${env.RLUSD_PRICE} RLUSD`,
          },
        ],
        demoWalletAddress: demoWalletAddress(env),
      };
    },
  );

  typed.post(
    "/api/payment/create",
    {
      schema: {
        body: id.CreatePaymentRequest,
        response: { 200: id.CreatePaymentResponse, 401: ErrorResponse },
        tags: ["payment"],
      },
    },
    async (req, reply) => {
      const token = bearerToken(req);
      if (!token) {
        reply.status(401).send({ error: "missing_token" });
        return reply;
      }
      let payload: id.JwtPayload;
      try {
        payload = app.jwtService.verify(token);
      } catch {
        reply.status(401).send({ error: "invalid_token" });
        return reply;
      }
      return payments.create({ userId: payload.userId, currency: req.body.currency });
    },
  );

  typed.get(
    "/api/payment/status/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: id.PaymentStatusResponse, 401: ErrorResponse },
        tags: ["payment"],
      },
    },
    async (req, reply) => {
      const token = bearerToken(req);
      if (!token) {
        reply.status(401).send({ error: "missing_token" });
        return reply;
      }
      try {
        app.jwtService.verify(token);
      } catch {
        reply.status(401).send({ error: "invalid_token" });
        return reply;
      }
      return payments.checkStatus({ paymentId: req.params.id });
    },
  );

  typed.post(
    "/api/payment/demo-pay",
    {
      schema: {
        body: z.object({ paymentId: z.string().uuid() }),
        response: { 200: z.object({ txHash: z.string() }), 400: ErrorResponse, 401: ErrorResponse },
        tags: ["payment"],
      },
    },
    async (req, reply) => {
      const token = bearerToken(req);
      if (!token) {
        reply.status(401).send({ error: "missing_token" });
        return reply;
      }
      try {
        app.jwtService.verify(token);
      } catch {
        reply.status(401).send({ error: "invalid_token" });
        return reply;
      }
      try {
        return await payments.demoPay({ paymentId: req.body.paymentId });
      } catch (err) {
        reply.status(400).send({ error: (err as Error).message });
        return reply;
      }
    },
  );
}
