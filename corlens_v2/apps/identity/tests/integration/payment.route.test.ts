import { deriveAddress, deriveKeypair, generateSeed, sign as rippleSign } from "ripple-keypairs";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
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

function newWallet() {
  const seed = generateSeed();
  const { publicKey, privateKey } = deriveKeypair(seed);
  return { publicKey, privateKey, address: deriveAddress(publicKey) };
}
function hexFromUtf8(t: string) {
  return Buffer.from(t, "utf8").toString("hex").toUpperCase();
}

async function loginAndGetToken(app: Awaited<ReturnType<typeof buildApp>>) {
  const { publicKey, privateKey, address } = newWallet();
  const c = await app.inject({
    method: "POST",
    url: "/api/auth/login/challenge",
    payload: { walletAddress: address },
  });
  const { challenge } = c.json();
  const signature = rippleSign(hexFromUtf8(challenge), privateKey);
  const v = await app.inject({
    method: "POST",
    url: "/api/auth/login/verify",
    payload: { walletAddress: address, challenge, signature, publicKey },
  });
  return { token: v.json().token as string, address };
}

describe("payment routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp(env);
    app.xrpl.pollIncomingByMemo = vi.fn(async () => null);
  });
  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await app.prisma.paymentRequest.deleteMany({});
    await app.prisma.premiumSubscription.deleteMany({});
    await app.prisma.user.deleteMany({});
    const keys = await app.redis.keys("auth:challenge:*");
    if (keys.length > 0) await app.redis.del(...keys);
  });

  it("GET /api/payment/info returns the price options publicly", async () => {
    const res = await app.inject({ method: "GET", url: "/api/payment/info" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.options).toHaveLength(2);
    expect(body.options[0].currency).toBe("XRP");
  });

  it("POST /api/payment/create requires a JWT", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/payment/create",
      payload: { currency: "XRP" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/payment/create with a JWT creates a payment request", async () => {
    const { token } = await loginAndGetToken(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/payment/create",
      headers: { authorization: `Bearer ${token}` },
      payload: { currency: "XRP" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.amount).toBe("10");
    expect(body.currency).toBe("XRP");
    expect(body.memo).toMatch(/[0-9a-f-]{36}/);
  });

  it("GET /api/payment/status/:id returns pending while no XRPL match", async () => {
    const { token } = await loginAndGetToken(app);
    const cRes = await app.inject({
      method: "POST",
      url: "/api/payment/create",
      headers: { authorization: `Bearer ${token}` },
      payload: { currency: "XRP" },
    });
    const { paymentId } = cRes.json();
    const sRes = await app.inject({
      method: "GET",
      url: `/api/payment/status/${paymentId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sRes.statusCode).toBe(200);
    expect(sRes.json().status).toBe("pending");
  });

  it("GET /api/payment/status/:id confirms when XRPL stub returns a match, upgrades user", async () => {
    const { token } = await loginAndGetToken(app);
    const cRes = await app.inject({
      method: "POST",
      url: "/api/payment/create",
      headers: { authorization: `Bearer ${token}` },
      payload: { currency: "XRP" },
    });
    const { paymentId } = cRes.json();

    app.xrpl.pollIncomingByMemo = vi.fn(async () => ({
      txHash: "A".repeat(64),
      sourceAccount: "rPayer",
    }));

    const sRes = await app.inject({
      method: "GET",
      url: `/api/payment/status/${paymentId}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(sRes.statusCode).toBe(200);
    expect(sRes.json().status).toBe("confirmed");

    const profile = await app.inject({
      method: "GET",
      url: "/api/auth/profile",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(profile.json().role).toBe("premium");
  });
});
