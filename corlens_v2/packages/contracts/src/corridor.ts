import { z } from "zod";
import { Status, XrplAddress } from "./shared.js";

export const CorridorTier = z.number().int().min(1).max(4);
export type CorridorTier = z.infer<typeof CorridorTier>;

export const CorridorAsset = z.object({
  currency: z.string(),
  issuer: z.string().optional(),
  label: z.string().optional(),
});
export type CorridorAsset = z.infer<typeof CorridorAsset>;

export const CorridorActor = z.object({
  name: z.string(),
  type: z.string(),
  region: z.string().optional(),
  notes: z.string().optional(),
});
export type CorridorActor = z.infer<typeof CorridorActor>;

export const CorridorListItem = z.object({
  id: z.string(),
  label: z.string(),
  shortLabel: z.string(),
  flag: z.string(),
  tier: CorridorTier,
  region: z.string(),
  category: z.string(),
  status: Status,
  pathCount: z.number().int().min(0),
  recRiskScore: z.number().int().nullable(),
  recCost: z.string().nullable(),
  lastRefreshedAt: z.string().datetime().nullable(),
});
export type CorridorListItem = z.infer<typeof CorridorListItem>;

export const CorridorDetail = CorridorListItem.extend({
  importance: z.number().int(),
  description: z.string(),
  useCase: z.string(),
  highlights: z.array(z.string()),
  amount: z.string().nullable(),
  source: CorridorAsset.nullable(),
  dest: CorridorAsset.nullable(),
  routes: z.array(z.unknown()),
  flags: z.array(z.unknown()),
  liquidity: z.unknown().nullable(),
  aiNote: z.string().nullable(),
});
export type CorridorDetail = z.infer<typeof CorridorDetail>;

export const CorridorListQuery = z.object({
  tier: z.coerce.number().int().min(1).max(4).optional(),
  status: Status.optional(),
  currency: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type CorridorListQuery = z.infer<typeof CorridorListQuery>;

export const StatusEvent = z.object({
  status: Status,
  pathCount: z.number().int().min(0),
  recCost: z.string().nullable(),
  source: z.string(),
  at: z.string().datetime(),
});
export type StatusEvent = z.infer<typeof StatusEvent>;

export const StatusHistoryQuery = z.object({
  days: z.coerce.number().int().min(1).max(180).default(30),
});

export const StatusHistoryResponse = z.object({
  corridorId: z.string(),
  events: z.array(StatusEvent),
});

export const ChatRequest = z.object({
  corridorId: z.string().optional(),
  message: z.string().min(1).max(2000),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});
export type ChatResponse = z.infer<typeof ChatResponse>;

export const IssuerEntry = z.object({
  key: z.string(),
  name: z.string(),
  address: XrplAddress,
});
export type IssuerEntry = z.infer<typeof IssuerEntry>;

export const ActorEntry = z.object({
  key: z.string(),
  name: z.string(),
  type: z.string(),
  country: z.string().optional(),
  supportsXrp: z.boolean().optional(),
  supportsRlusd: z.boolean().optional(),
  odl: z.boolean().optional(),
  direction: z.enum(["in", "out", "both"]).optional(),
  note: z.string().optional(),
});
export type ActorEntry = z.infer<typeof ActorEntry>;

export const CurrencyMeta = z.object({
  code: z.string().min(3).max(8),
  issuers: z.array(IssuerEntry),
  actors: z.array(ActorEntry),
  updatedAt: z.string().datetime(),
});
export type CurrencyMeta = z.infer<typeof CurrencyMeta>;

export const CurrencyMetaListResponse = z.object({
  currencies: z.array(CurrencyMeta),
  globalHubs: z.array(ActorEntry),
});
export type CurrencyMetaListResponse = z.infer<typeof CurrencyMetaListResponse>;
