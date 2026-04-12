import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  OPENAI_API_KEY: z.string().default(""),
  XRPL_PRIMARY_RPC: z.string().default("wss://maximum-clean-putty.xrp-mainnet.quiknode.pro/01e5586369513fba1030d8a7ef3c3fd3c7017214/"),
  XRPL_PATHFIND_RPC: z.string().default("wss://maximum-clean-putty.xrp-mainnet.quiknode.pro/01e5586369513fba1030d8a7ef3c3fd3c7017214/"),
  XRPL_TESTNET_RPC: z.string().default("wss://capable-greatest-wave.xrp-testnet.quiknode.pro/16302802b274af307661284007ee144f92e85cce/"),
  JWT_SECRET: z.string().default("corlens-dev-secret"),
  XRPL_PAYMENT_WALLET_ADDRESS: z.string().default(""),
  XRPL_PAYMENT_WALLET_SECRET: z.string().default(""),
  XRPL_DEMO_WALLET_SECRET: z.string().default(""),
});

export const config = envSchema.parse(process.env);
