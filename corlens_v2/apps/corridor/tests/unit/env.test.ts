import { describe, expect, it } from "vitest";
import { loadCorridorEnv } from "../../src/env.js";

const valid = {
  PORT: "3004",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
};

describe("loadCorridorEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadCorridorEnv(valid);
    expect(env.PORT).toBe(3004);
    expect(env.SCAN_CONCURRENCY).toBe(4);
    expect(env.REFRESH_CRON).toBe("0 * * * *");
  });

  it("rejects a missing MARKET_DATA_BASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    partial.MARKET_DATA_BASE_URL = undefined;
    expect(() => loadCorridorEnv(partial)).toThrow(/MARKET_DATA_BASE_URL/);
  });
});
