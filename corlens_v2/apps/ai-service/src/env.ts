import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3003),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  OPENAI_API_KEY: z.string().min(10),
  TAVILY_API_KEY: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  DEFAULT_CHAT_MODEL: z.string().default("gpt-4o-mini"),
  DEFAULT_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  WEB_SEARCH_CACHE_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  INTERNAL_HMAC_SECRET: z.string().min(32),
});

export type AiServiceEnv = z.infer<typeof Schema>;

export function loadAiServiceEnv(
  source?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): AiServiceEnv {
  return loadEnv(Schema, source);
}
