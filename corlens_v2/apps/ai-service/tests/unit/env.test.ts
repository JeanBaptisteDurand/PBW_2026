import { describe, expect, it } from "vitest";
import { loadAiServiceEnv } from "../../src/env.js";

const valid = {
  PORT: "3003",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  OPENAI_API_KEY: "sk-test-1234567890",
  TAVILY_API_KEY: "tvly-test-abc",
};

describe("loadAiServiceEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadAiServiceEnv(valid);
    expect(env.PORT).toBe(3003);
    expect(env.DEFAULT_CHAT_MODEL).toBe("gpt-4o-mini");
    expect(env.DEFAULT_EMBEDDING_MODEL).toBe("text-embedding-3-small");
    expect(env.WEB_SEARCH_CACHE_HOURS).toBe(24);
  });

  it("rejects a missing OPENAI_API_KEY", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.OPENAI_API_KEY;
    expect(() => loadAiServiceEnv(partial)).toThrow(/OPENAI_API_KEY/);
  });

  it("accepts an optional TAVILY_API_KEY (web search disabled if absent)", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.TAVILY_API_KEY;
    const env = loadAiServiceEnv(partial);
    expect(env.TAVILY_API_KEY).toBeUndefined();
  });
});
