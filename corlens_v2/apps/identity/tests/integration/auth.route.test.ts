import { deriveAddress, deriveKeypair, generateSeed, sign as rippleSign } from "ripple-keypairs";
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

function newWallet() {
  const seed = generateSeed();
  const { publicKey, privateKey } = deriveKeypair(seed);
  const address = deriveAddress(publicKey);
  return { publicKey, privateKey, address };
}
function hexFromUtf8(t: string) {
  return Buffer.from(t, "utf8").toString("hex").toUpperCase();
}

describe("auth routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp(env);
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

  it("issues a challenge and verifies a signed response, returning a JWT", async () => {
    const { publicKey, privateKey, address } = newWallet();

    const challengeRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/challenge",
      payload: { walletAddress: address },
    });
    expect(challengeRes.statusCode).toBe(200);
    const { challenge } = challengeRes.json();
    expect(challenge).toContain(address);

    const signature = rippleSign(hexFromUtf8(challenge), privateKey);

    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: { walletAddress: address, challenge, signature, publicKey },
    });
    expect(verifyRes.statusCode).toBe(200);
    const body = verifyRes.json();
    expect(body.token.split(".").length).toBe(3);
    expect(body.user.walletAddress).toBe(address);
    expect(body.user.role).toBe("free");
  });

  it("rejects login/verify when no challenge was issued", async () => {
    const { publicKey, privateKey, address } = newWallet();
    // Must be >=32 chars to pass schema validation, but was never stored in Redis
    const fakeChallenge = "Sign in to CORLens\n\nWallet: fake-nonce-never-stored";
    const sig = rippleSign(hexFromUtf8(fakeChallenge), privateKey);
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: { walletAddress: address, challenge: fakeChallenge, signature: sig, publicKey },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe("no_challenge");
  });

  it("/api/auth/profile returns the user's profile when JWT is valid", async () => {
    const { publicKey, privateKey, address } = newWallet();
    const cRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/challenge",
      payload: { walletAddress: address },
    });
    const { challenge } = cRes.json();
    const signature = rippleSign(hexFromUtf8(challenge), privateKey);
    const vRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: { walletAddress: address, challenge, signature, publicKey },
    });
    const token = vRes.json().token as string;

    const pRes = await app.inject({
      method: "GET",
      url: "/api/auth/profile",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(pRes.statusCode).toBe(200);
    expect(pRes.json().walletAddress).toBe(address);
  });

  it("/api/auth/api-key returns 403 for free users", async () => {
    const { publicKey, privateKey, address } = newWallet();
    const cRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/challenge",
      payload: { walletAddress: address },
    });
    const { challenge } = cRes.json();
    const signature = rippleSign(hexFromUtf8(challenge), privateKey);
    const vRes = await app.inject({
      method: "POST",
      url: "/api/auth/login/verify",
      payload: { walletAddress: address, challenge, signature, publicKey },
    });
    const token = vRes.json().token as string;

    const res = await app.inject({
      method: "POST",
      url: "/api/auth/api-key",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("premium_required");
  });
});
