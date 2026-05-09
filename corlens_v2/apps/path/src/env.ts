import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3005),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MARKET_DATA_BASE_URL: z.string().url(),
  AI_SERVICE_BASE_URL: z.string().url(),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  BFS_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  BFS_MAX_NODES: z.coerce.number().int().min(50).max(5000).default(800),
  BFS_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(45000),
  WORKER_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
});

export type PathEnv = z.infer<typeof Schema>;

export function loadPathEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): PathEnv {
  return loadEnv(Schema, source);
}
