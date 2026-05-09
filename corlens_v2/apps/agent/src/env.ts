import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3006),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  CORRIDOR_BASE_URL: z.string().url(),
  PATH_BASE_URL: z.string().url(),
  MARKET_DATA_BASE_URL: z.string().url(),
  AI_SERVICE_BASE_URL: z.string().url(),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  MAX_PHASE_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(60000),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
});

export type AgentEnv = z.infer<typeof Schema>;

export function loadAgentEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): AgentEnv {
  return loadEnv(Schema, source);
}
