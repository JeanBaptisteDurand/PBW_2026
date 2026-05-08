import { z } from "zod";
import { XrplAddress } from "./shared.js";

// ─── XRPL request shapes (route params/queries) ───────────────────
export const AddressParam = z.object({ address: XrplAddress });
export const NftIdParam = z.object({ nftId: z.string().regex(/^[A-F0-9]{64}$/) });
export const LimitQuery = z.object({ limit: z.coerce.number().int().min(1).max(400).optional() });
export const SinceQuery = z.object({
  limit: z.coerce.number().int().min(1).max(400).optional(),
  sinceUnixTime: z.coerce.number().int().optional(),
});
export const NoripppleQuery = z.object({ role: z.enum(["gateway", "user"]).default("gateway") });

const Asset = z.object({
  currency: z.string().min(1),
  issuer: XrplAddress.optional(),
});
export const AmmByPairQuery = z.object({
  asset1Currency: z.string(),
  asset1Issuer: XrplAddress.optional(),
  asset2Currency: z.string(),
  asset2Issuer: XrplAddress.optional(),
});
export const BookOffersQuery = z.object({
  takerGetsCurrency: z.string(),
  takerGetsIssuer: XrplAddress.optional(),
  takerPaysCurrency: z.string(),
  takerPaysIssuer: XrplAddress.optional(),
  limit: z.coerce.number().int().min(1).max(400).default(50),
});

export const PathFindRequest = z.object({
  sourceAccount: XrplAddress,
  destinationAccount: XrplAddress,
  destinationAmount: z.union([
    z.string(),
    Asset.extend({ value: z.string() }),
  ]),
});

// ─── Generic envelope ────────────────────────────────────────────
export const RawXrplResponse = z.object({
  result: z.unknown(),
}).passthrough();
export type RawXrplResponse = z.infer<typeof RawXrplResponse>;

// ─── Partner depth ───────────────────────────────────────────────
export const PartnerActor = z.enum(["bitso", "bitstamp", "kraken", "binance", "xrpl-dex"]);
export type PartnerActor = z.infer<typeof PartnerActor>;

export const PartnerDepthSnapshot = z.object({
  actor: z.string(),
  book: z.string(),
  venue: z.string(),
  bidCount: z.number().int().min(0),
  askCount: z.number().int().min(0),
  topBid: z.object({ price: z.string(), amount: z.string() }).nullable(),
  topAsk: z.object({ price: z.string(), amount: z.string() }).nullable(),
  spreadBps: z.number().nullable(),
  bidDepthBase: z.string(),
  askDepthBase: z.string(),
  source: z.string(),
  fetchedAt: z.string().datetime(),
  ttlSeconds: z.number().int().min(0),
});
export type PartnerDepthSnapshot = z.infer<typeof PartnerDepthSnapshot>;

export const PartnerDepthParams = z.object({
  actor: PartnerActor,
  book: z.string().min(1),
});
