import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadEnv } from "../src/index.js";

describe("loadEnv", () => {
  it("returns parsed values when input matches the schema", () => {
    const schema = z.object({
      PORT: z.coerce.number().int().positive(),
      NAME: z.string(),
    });
    const env = loadEnv(schema, { PORT: "3001", NAME: "identity" });
    expect(env.PORT).toBe(3001);
    expect(env.NAME).toBe("identity");
  });

  it("throws a readable error listing every missing field", () => {
    const schema = z.object({
      PORT: z.coerce.number(),
      DATABASE_URL: z.string().url(),
    });
    expect(() => loadEnv(schema, {})).toThrow(/PORT/);
    expect(() => loadEnv(schema, {})).toThrow(/DATABASE_URL/);
  });

  it("defaults source to process.env when no source is given", () => {
    const schema = z.object({ HOME: z.string().min(1) });
    const env = loadEnv(schema);
    expect(typeof env.HOME).toBe("string");
  });
});
