import { describe, expect, it } from "vitest";
import { loadAgentEnv } from "../../src/env.js";

const valid = {
  PORT: "3006",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  CORRIDOR_BASE_URL: "http://localhost:3004",
  PATH_BASE_URL: "http://localhost:3005",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
};

describe("loadAgentEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadAgentEnv(valid);
    expect(env.PORT).toBe(3006);
    expect(env.MAX_PHASE_TIMEOUT_MS).toBe(60000);
  });

  it("rejects missing PATH_BASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.PATH_BASE_URL;
    expect(() => loadAgentEnv(partial)).toThrow(/PATH_BASE_URL/);
  });
});
