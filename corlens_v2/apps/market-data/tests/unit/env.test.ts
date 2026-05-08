import { describe, expect, it } from "vitest";
import { loadMarketDataEnv } from "../../src/env.js";

const validEnv = {
  PORT: "3002",
  REDIS_URL: "redis://localhost:6381",
  XRPL_PRIMARY_RPC: "wss://xrplcluster.com",
  XRPL_PATHFIND_RPC: "wss://xrplcluster.com",
};

describe("loadMarketDataEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadMarketDataEnv(validEnv);
    expect(env.PORT).toBe(3002);
    expect(env.PARTNER_DEPTH_TTL_SECONDS).toBe(60);
  });

  it("rejects a missing XRPL_PRIMARY_RPC", () => {
    const partial: Record<string, string | undefined> = { ...validEnv };
    delete partial.XRPL_PRIMARY_RPC;
    expect(() => loadMarketDataEnv(partial)).toThrow(/XRPL_PRIMARY_RPC/);
  });

  it("rejects a non-WS XRPL_PRIMARY_RPC", () => {
    expect(() => loadMarketDataEnv({ ...validEnv, XRPL_PRIMARY_RPC: "http://wrong" })).toThrow(/XRPL_PRIMARY_RPC/);
  });
});
