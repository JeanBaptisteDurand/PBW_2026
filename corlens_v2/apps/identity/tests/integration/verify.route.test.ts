import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadIdentityEnv } from "../../src/env.js";

const env = loadIdentityEnv({
  PORT: "3001",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  JWT_SECRET: "test-secret-must-be-at-least-32-characters-long",
  XRPL_PAYMENT_WALLET_ADDRESS: "rPaymentDestinationABCDEFGHJKMNPQRS",
  XRPL_TESTNET_RPC: "wss://s.altnet.rippletest.net:51233",
  CHALLENGE_TTL_SECONDS: "300",
  PAYMENT_EXPIRY_MINUTES: "15",
  XRP_PRICE: "10",
  RLUSD_PRICE: "5",
});

describe("GET /verify", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp(env);
  });
  afterAll(async () => {
    await app.close();
  });

  it("returns 200 with X-User-* headers when a valid Bearer JWT is presented", async () => {
    const token = app.jwtService.sign({
      userId: "11111111-1111-1111-1111-111111111111",
      walletAddress: "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh",
      role: "free",
    });

    const res = await app.inject({
      method: "GET",
      url: "/verify",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-user-id"]).toBe("11111111-1111-1111-1111-111111111111");
    expect(res.headers["x-user-role"]).toBe("free");
    expect(res.headers["x-user-wallet"]).toBe("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh");
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await app.inject({ method: "GET", url: "/verify" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when the token is invalid", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/verify",
      headers: { authorization: "Bearer not.a.real.token" },
    });
    expect(res.statusCode).toBe(401);
  });
});
