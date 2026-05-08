import { z } from "zod";

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const XrplAddress = z
  .string()
  .regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, "Invalid XRPL r-address");
export type XrplAddress = z.infer<typeof XrplAddress>;

export const TxHash = z.string().regex(/^[A-F0-9]{64}$/, "Invalid XRPL tx hash");
export type TxHash = z.infer<typeof TxHash>;

export const Currency = z.string().min(3).max(20);
export type Currency = z.infer<typeof Currency>;

export const RiskTolerance = z.enum(["LOW", "MED", "HIGH"]);
export type RiskTolerance = z.infer<typeof RiskTolerance>;

export const Verdict = z.enum(["SAFE", "REJECTED", "NO_PATHS", "OFF_CHAIN_ROUTED"]);
export type Verdict = z.infer<typeof Verdict>;

export const Status = z.enum(["GREEN", "AMBER", "RED", "UNKNOWN"]);
export type Status = z.infer<typeof Status>;

export const PaymentCurrency = z.enum(["XRP", "RLUSD"]);
export type PaymentCurrency = z.infer<typeof PaymentCurrency>;

export const UserRole = z.enum(["free", "premium"]);
export type UserRole = z.infer<typeof UserRole>;

export const Pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof Pagination>;

export const ErrorResponse = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
