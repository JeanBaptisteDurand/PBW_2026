import { describe, expect, it } from "vitest";
import { loadPathEnv } from "../../src/env.js";

const valid = {
  PORT: "3005",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
};

describe("loadPathEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadPathEnv(valid);
    expect(env.PORT).toBe(3005);
    expect(env.BFS_CONCURRENCY).toBe(4);
    expect(env.BFS_MAX_NODES).toBe(800);
  });

  it("rejects missing AI_SERVICE_BASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.AI_SERVICE_BASE_URL;
    expect(() => loadPathEnv(partial)).toThrow(/AI_SERVICE_BASE_URL/);
  });
});
