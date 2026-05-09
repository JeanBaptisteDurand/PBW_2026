import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3004),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MARKET_DATA_BASE_URL: z.string().url(),
  AI_SERVICE_BASE_URL: z.string().url(),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  SCAN_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  SCAN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(20000),
  REFRESH_CRON: z.string().default("0 * * * *"),
  REFRESH_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
  AI_NOTE_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
});

export type CorridorEnv = z.infer<typeof Schema>;

export function loadCorridorEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): CorridorEnv {
  return loadEnv(Schema, source);
}
