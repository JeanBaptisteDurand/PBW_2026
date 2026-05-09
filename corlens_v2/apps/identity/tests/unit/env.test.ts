import { describe, expect, it } from "vitest";
import { loadIdentityEnv } from "../../src/env.js";

const validEnv = {
  PORT: "3001",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  JWT_SECRET: "x".repeat(32),
  INTERNAL_HMAC_SECRET: "y".repeat(32),
  XRPL_PAYMENT_WALLET_ADDRESS: "rPaymentDestinationABCDEFGHJKMNPQRS",
  XRPL_TESTNET_RPC: "wss://s.altnet.rippletest.net:51233",
  CHALLENGE_TTL_SECONDS: "300",
  PAYMENT_EXPIRY_MINUTES: "15",
  XRP_PRICE: "10",
  RLUSD_PRICE: "5",
};

describe("loadIdentityEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadIdentityEnv(validEnv);
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET).toHaveLength(32);
    expect(env.CHALLENGE_TTL_SECONDS).toBe(300);
    expect(env.XRPL_DEMO_WALLET_SECRET).toBeUndefined();
  });

  it("rejects a JWT_SECRET shorter than 32 chars", () => {
    expect(() => loadIdentityEnv({ ...validEnv, JWT_SECRET: "tooshort" })).toThrow(/JWT_SECRET/);
  });

  it("rejects a missing DATABASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...validEnv };
    partial.DATABASE_URL = undefined;
    expect(() => loadIdentityEnv(partial)).toThrow(/DATABASE_URL/);
  });

  it("accepts an optional XRPL_DEMO_WALLET_SECRET", () => {
    const env = loadIdentityEnv({
      ...validEnv,
      XRPL_DEMO_WALLET_SECRET: "sEdTM1uX8pu2do5XmTTqxnVghLeVfDB",
    });
    expect(env.XRPL_DEMO_WALLET_SECRET).toBe("sEdTM1uX8pu2do5XmTTqxnVghLeVfDB");
  });
});
