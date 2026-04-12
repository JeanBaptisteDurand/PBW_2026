import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createXRPLClient, type XRPLClientWrapper } from "../../src/xrpl/client.js";

describe("XRPL WebSocket Client", () => {
  let client: XRPLClientWrapper;

  beforeAll(async () => {
    client = createXRPLClient();
    await client.connect();
  }, 30_000);

  afterAll(async () => {
    await client.disconnect();
  }, 15_000);

  it("connects and fetches server_info", async () => {
    expect(client.isConnected()).toBe(true);

    const resp = (await client.serverInfo()) as {
      result: { info: { build_version: string; server_state: string } };
    };

    expect(resp).toBeDefined();
    expect(resp.result).toBeDefined();
    expect(resp.result.info).toBeDefined();
    expect(typeof resp.result.info.build_version).toBe("string");
    expect(resp.result.info.server_state).toBe("full");
  }, 15_000);

  it("rate limits: 5 rapid requests take ≥300ms", async () => {
    const start = Date.now();

    for (let i = 0; i < 5; i++) {
      await client.request("server_info", {});
    }

    const elapsed = Date.now() - start;
    // 5 requests with 100ms minimum between each = at least 4 gaps × 100ms = 400ms
    // Using 300ms as a conservative lower bound to account for timing variance
    expect(elapsed).toBeGreaterThanOrEqual(300);
  }, 15_000);
});
