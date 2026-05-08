import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  HOST: z.string().default("0.0.0.0"),
  REDIS_URL: z.string().url(),
  XRPL_PRIMARY_RPC: z.string().regex(/^wss?:\/\//, "must be a ws:// or wss:// URL"),
  XRPL_PATHFIND_RPC: z.string().regex(/^wss?:\/\//, "must be a ws:// or wss:// URL"),
  XRPL_RATE_LIMIT_INTERVAL_MS: z.coerce.number().int().min(1).max(1000).default(20),
  PARTNER_DEPTH_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  ACCOUNT_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  BOOK_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(120).default(10),
  PREWARM_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
  PREWARM_CRON: z.string().default("0 * * * *"),
});

export type MarketDataEnv = z.infer<typeof Schema>;

export function loadMarketDataEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): MarketDataEnv {
  return loadEnv(Schema, source);
}
