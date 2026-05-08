import { z } from "zod";
import { PaymentCurrency, Status, TxHash, Uuid, XrplAddress } from "./shared.js";

export const PaymentConfirmed = z.object({
  userId: Uuid,
  paymentId: Uuid,
  txHash: TxHash,
  amount: z.string(),
  currency: PaymentCurrency,
  confirmedAt: z.string().datetime(),
});
export type PaymentConfirmed = z.infer<typeof PaymentConfirmed>;

export const UserRoleUpgraded = z.object({
  userId: Uuid,
  newRole: z.literal("premium"),
  upgradedAt: z.string().datetime(),
});
export type UserRoleUpgraded = z.infer<typeof UserRoleUpgraded>;

export const CorridorRefreshed = z.object({
  corridorId: z.string(),
  status: Status,
  refreshedAt: z.string().datetime(),
});
export type CorridorRefreshed = z.infer<typeof CorridorRefreshed>;

export const AnalysisCompleted = z.object({
  analysisId: Uuid,
  seedAddress: XrplAddress,
  completedAt: z.string().datetime(),
  riskFlagCount: z.number().int().min(0),
});
export type AnalysisCompleted = z.infer<typeof AnalysisCompleted>;

export const EventRegistry = {
  "payment.confirmed": PaymentConfirmed,
  "user.role_upgraded": UserRoleUpgraded,
  "corridor.refreshed": CorridorRefreshed,
  "analysis.completed": AnalysisCompleted,
} as const;

export type EventName = keyof typeof EventRegistry;
export type EventPayload<E extends EventName> = z.infer<(typeof EventRegistry)[E]>;
