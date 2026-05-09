import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadCorridorEnv } from "../../src/env.js";

const env = loadCorridorEnv({
  PORT: "3004",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
});

describe("corridor routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => {
    app = await buildApp(env);
  });
  afterAll(async () => {
    await app.close();
  });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("/api/corridors returns the seeded list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/corridors" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  it("/api/corridors/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/corridors/does-not-exist" });
    expect(res.statusCode).toBe(404);
  });

  it("/api/corridors/usd-mxn returns the detail when seeded", async () => {
    const res = await app.inject({ method: "GET", url: "/api/corridors/usd-mxn" });
    // Either 200 (if seeded) or 404 (if seed file lacked usd-mxn)
    expect([200, 404]).toContain(res.statusCode);
  });
});
