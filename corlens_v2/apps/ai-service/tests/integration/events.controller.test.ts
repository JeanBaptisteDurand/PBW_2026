import { hmacSigner } from "@corlens/clients";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadAiServiceEnv } from "../../src/env.js";

const env = loadAiServiceEnv({
  PORT: "3003",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  OPENAI_API_KEY: "sk-test-not-used",
  TAVILY_API_KEY: "tvly-test-not-used",
  INTERNAL_HMAC_SECRET: "test-internal-hmac-secret-must-be-at-least-32-chars",
});

describe("POST /events/:name", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  const sign = hmacSigner({ secret: env.INTERNAL_HMAC_SECRET });

  beforeAll(async () => {
    app = await buildApp(env);
  });
  afterAll(async () => {
    await app.close();
  });

  const samplePayload = {
    userId: "11111111-1111-1111-1111-111111111111",
    paymentId: "22222222-2222-2222-2222-222222222222",
    txHash: "A".repeat(64),
    amount: "10",
    currency: "XRP",
    confirmedAt: new Date().toISOString(),
  };

  it("returns 401 when HMAC headers are missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/events/payment.confirmed",
      payload: { name: "payment.confirmed", payload: samplePayload },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid signature" });
  });

  it("returns 401 when the signature is invalid", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/events/payment.confirmed",
      headers: {
        "x-corlens-ts": String(Math.floor(Date.now() / 1000)),
        "x-corlens-sig": "deadbeef".repeat(8),
        "content-type": "application/json",
      },
      payload: { name: "payment.confirmed", payload: samplePayload },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "invalid signature" });
  });

  it("returns 200 { ok: true } when the signature is valid", async () => {
    const body = JSON.stringify({ name: "payment.confirmed", payload: samplePayload });
    const res = await app.inject({
      method: "POST",
      url: "/events/payment.confirmed",
      headers: { ...sign(body), "content-type": "application/json" },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
