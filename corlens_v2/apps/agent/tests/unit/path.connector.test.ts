import { describe, expect, it, vi } from "vitest";
import { createPathClient } from "../../src/connectors/path.js";

const SECRET = "x".repeat(32);

describe("path connector (agent)", () => {
  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on POST analyze", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "1", status: "queued" })));
    const client = createPathClient({
      baseUrl: "http://path:3005",
      hmacSecret: SECRET,
      fetch: fetchMock as never,
    });
    await client.analyze({ seedAddress: "rABC" });
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
    expect(headers["content-type"]).toBe("application/json");
  });

  it("attaches x-corlens-ts and x-corlens-sig HMAC headers on GET history", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({})));
    const client = createPathClient({
      baseUrl: "http://path:3005",
      hmacSecret: SECRET,
      fetch: fetchMock as never,
    });
    await client.history("rABC");
    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("fetch not called");
    const [, init] = call;
    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["x-corlens-ts"]).toMatch(/^\d+$/);
    expect(headers["x-corlens-sig"]).toMatch(/^[0-9a-f]{64}$/);
  });
});
