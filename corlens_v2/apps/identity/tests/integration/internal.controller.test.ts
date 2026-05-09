import { hmacSigner } from "@corlens/clients";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadIdentityEnv } from "../../src/env.js";

const env = loadIdentityEnv({
  PORT: "3001",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  JWT_SECRET: "test-secret-must-be-at-least-32-characters-long",
  INTERNAL_HMAC_SECRET: "test-internal-hmac-secret-must-be-at-least-32-chars",
  XRPL_PAYMENT_WALLET_ADDRESS: "rPaymentDestinationABCDEFGHJKMNPQRS",
  XRPL_TESTNET_RPC: "wss://s.altnet.rippletest.net:51233",
  CHALLENGE_TTL_SECONDS: "300",
  PAYMENT_EXPIRY_MINUTES: "15",
  XRP_PRICE: "10",
  RLUSD_PRICE: "5",
});

describe("GET /internal/premium-status", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const sign = hmacSigner({ secret: env.INTERNAL_HMAC_SECRET });

  beforeAll(async () => {
    app = await buildApp(env);
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(async () => {
    await app.prisma.premiumSubscription.deleteMany({});
    await app.prisma.user.deleteMany({});
  });

  it("returns 401 when HMAC headers are missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/premium-status?userId=11111111-1111-1111-1111-111111111111",
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid signature" });
  });

  it("returns 401 when the signature is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/premium-status?userId=11111111-1111-1111-1111-111111111111",
      headers: {
        "x-corlens-ts": String(Math.floor(Date.now() / 1000)),
        "x-corlens-sig": "deadbeef".repeat(8),
      },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid signature" });
  });

  it("returns 200 { isPremium: true, expiresAt: null } for a premium user", async () => {
    const user = await app.prisma.user.create({
      data: { walletAddress: "rPremiumUserTestABCDEFGHJKMNPQRSTU", role: "premium" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/internal/premium-status?userId=${user.id}`,
      headers: sign(""),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ isPremium: true, expiresAt: null });
  });

  it("returns 200 { isPremium: false, expiresAt: null } for a non-premium user", async () => {
    const user = await app.prisma.user.create({
      data: { walletAddress: "rFreeUserTestABCDEFGHJKMNPQRSTUVWX", role: "free" },
    });
    const res = await app.inject({
      method: "GET",
      url: `/internal/premium-status?userId=${user.id}`,
      headers: sign(""),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ isPremium: false, expiresAt: null });
  });

  it("returns 404 when the userId is unknown", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/internal/premium-status?userId=00000000-0000-0000-0000-000000000000",
      headers: sign(""),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: "user not found" });
  });
});
