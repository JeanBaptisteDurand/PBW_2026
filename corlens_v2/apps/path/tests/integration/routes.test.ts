import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadPathEnv } from "../../src/env.js";

const env = loadPathEnv({
  PORT: "3005",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
  WORKER_ENABLED: "false",
});

describe("path routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(env); });
  afterAll(async () => { await app.close(); });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("POST /api/analyze with bad address returns 400", async () => {
    const res = await app.inject({ method: "POST", url: "/api/analyze", payload: { seedAddress: "not-an-address", depth: 1 } });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/analyze creates a queued analysis for a valid address", async () => {
    const res = await app.inject({ method: "POST", url: "/api/analyze", payload: { seedAddress: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", depth: 1 } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(["queued", "done"]).toContain(body.status);
  });

  it("GET /api/analysis/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/analysis/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/history/<address> returns the history shape", async () => {
    const res = await app.inject({ method: "GET", url: "/api/history/rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.address).toBe("rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De");
    expect(Array.isArray(body.analyses)).toBe(true);
  });
});
