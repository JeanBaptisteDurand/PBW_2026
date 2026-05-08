import { z } from "zod";
import { PaymentCurrency, TxHash, UserRole, Uuid, XrplAddress } from "./shared.js";

export const JwtPayload = z.object({
  userId: Uuid,
  walletAddress: XrplAddress,
  role: UserRole,
});
export type JwtPayload = z.infer<typeof JwtPayload>;

export const LoginChallengeRequest = z.object({
  walletAddress: XrplAddress,
});
export type LoginChallengeRequest = z.infer<typeof LoginChallengeRequest>;

export const LoginChallengeResponse = z.object({
  challenge: z.string().min(32),
  expiresAt: z.string().datetime(),
});
export type LoginChallengeResponse = z.infer<typeof LoginChallengeResponse>;

export const LoginVerifyRequest = z.object({
  walletAddress: XrplAddress,
  challenge: z.string().min(32),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});
export type LoginVerifyRequest = z.infer<typeof LoginVerifyRequest>;

export const LoginVerifyResponse = z.object({
  token: z.string().min(1),
  user: z.object({
    id: Uuid,
    walletAddress: XrplAddress,
    role: UserRole,
  }),
});
export type LoginVerifyResponse = z.infer<typeof LoginVerifyResponse>;

export const PaymentInfoResponse = z.object({
  options: z.array(
    z.object({
      currency: PaymentCurrency,
      amount: z.string(),
      label: z.string(),
    }),
  ),
  demoWalletAddress: z.string(),
});
export type PaymentInfoResponse = z.infer<typeof PaymentInfoResponse>;

export const CreatePaymentRequest = z.object({
  currency: PaymentCurrency.default("XRP"),
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequest>;

export const CreatePaymentResponse = z.object({
  paymentId: Uuid,
  destination: z.string(),
  amount: z.string(),
  currency: PaymentCurrency,
  memo: z.string(),
});
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponse>;

export const PaymentStatusResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("confirmed"), txHash: TxHash }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("not_found") }),
]);
export type PaymentStatusResponse = z.infer<typeof PaymentStatusResponse>;
