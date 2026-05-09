import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  XRPL_PAYMENT_WALLET_ADDRESS: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/),
  XRPL_TESTNET_RPC: z.string().url(),
  XRPL_DEMO_WALLET_SECRET: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  CHALLENGE_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(300),
  PAYMENT_EXPIRY_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  XRP_PRICE: z.string().default("10"),
  RLUSD_PRICE: z.string().default("5"),
  HOST: z.string().default("0.0.0.0"),
  AI_SERVICE_BASE_URL: z.string().url().default("http://ai-service:3003"),
  AGENT_BASE_URL: z.string().url().default("http://agent:3006"),
});

export type IdentityEnv = z.infer<typeof Schema>;

export function loadIdentityEnv(
  source?: NodeJS.ProcessEnv | Record<string, string | undefined>,
): IdentityEnv {
  return loadEnv(Schema, source);
}
