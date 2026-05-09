import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadAgentEnv } from "../../src/env.js";

const env = loadAgentEnv({
  PORT: "3006",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  CORRIDOR_BASE_URL: "http://localhost:3004",
  PATH_BASE_URL: "http://localhost:3005",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
});

describe("agent routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(env); });
  afterAll(async () => { await app.close(); });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("GET /api/safe-path returns the runs list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/safe-path" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().runs)).toBe(true);
  });

  it("GET /api/safe-path/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/safe-path/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/compliance/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/compliance/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });
});
