import { z } from "zod";

const Env = z.object({
  VITE_API_BASE: z.string().default("/api"),
  VITE_CROSSMARK_NETWORK: z.enum(["mainnet", "testnet", "devnet"]).default("mainnet"),
});

export type WebEnv = z.infer<typeof Env>;

export const env: WebEnv = Env.parse({
  VITE_API_BASE: import.meta.env.VITE_API_BASE,
  VITE_CROSSMARK_NETWORK: import.meta.env.VITE_CROSSMARK_NETWORK,
});
