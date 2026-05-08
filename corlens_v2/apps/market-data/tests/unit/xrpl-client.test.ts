import { describe, expect, it, vi } from "vitest";
import { createXrplClient, type ClientFactory } from "../../src/connectors/xrpl-client.js";

class FakeClient {
  isConnected_ = true;
  requestCalls: Array<{ command: string; params: unknown }> = [];
  fail: boolean | "load" = false;
  isConnected() { return this.isConnected_; }
  async connect() {}
  async disconnect() { this.isConnected_ = false; }
  async request(payload: { command: string }) {
    this.requestCalls.push({ command: payload.command, params: payload });
    if (this.fail === "load") {
      return { result: {}, warning: "load" };
    }
    if (this.fail) {
      throw new Error("WebSocket is not open");
    }
    return { result: { ok: true } };
  }
}

describe("xrpl-client", () => {
  it("connects to the first endpoint that succeeds", async () => {
    const fakes = [new FakeClient(), new FakeClient()];
    const factory: ClientFactory = vi.fn((url: string) => {
      if (url.includes("primary")) return fakes[0] as never;
      return fakes[1] as never;
    });
    const client = createXrplClient({
      primaryEndpoints: ["wss://primary.example", "wss://fallback.example"],
      pathfindEndpoints: ["wss://primary.example"],
      rateLimitIntervalMs: 5,
      clientFactory: factory,
    });
    await client.connect();
    expect(factory).toHaveBeenCalledWith("wss://primary.example", expect.anything());
  });

  it("falls back to the next endpoint when the first one's connect throws", async () => {
    const failing = new FakeClient();
    failing.connect = async () => { throw new Error("boom"); };
    const ok = new FakeClient();
    const factory: ClientFactory = vi.fn((url: string) => (url.includes("primary") ? failing : ok) as never);
    const client = createXrplClient({
      primaryEndpoints: ["wss://primary.example", "wss://fallback.example"],
      pathfindEndpoints: ["wss://primary.example"],
      rateLimitIntervalMs: 5,
      clientFactory: factory,
      maxConnectRetries: 1,
    });
    await client.connect();
    expect(factory).toHaveBeenCalledWith("wss://primary.example", expect.anything());
    expect(factory).toHaveBeenCalledWith("wss://fallback.example", expect.anything());
  });

  it("enforces minimum interval between requests", async () => {
    const fake = new FakeClient();
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 50,
      clientFactory: () => fake as never,
    });
    await client.connect();
    const start = Date.now();
    await client.request("account_info", { account: "rA" });
    await client.request("account_info", { account: "rB" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(fake.requestCalls).toHaveLength(2);
  });

  it("retries transient errors", async () => {
    const fake = new FakeClient();
    const real = fake.request.bind(fake);
    let calls = 0;
    fake.request = async (p: { command: string }) => {
      calls += 1;
      if (calls === 1) throw new Error("WebSocket is not open");
      return real(p);
    };
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 1,
      clientFactory: () => fake as never,
    });
    await client.connect();
    const out = await client.request("account_info", { account: "rA" });
    expect(out).toEqual({ result: { ok: true } });
    expect(calls).toBe(2);
  });

  it("backs off on server load warning", async () => {
    const fake = new FakeClient();
    fake.fail = "load";
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 5,
      clientFactory: () => fake as never,
      loadWarningBackoffMs: 50,
    });
    await client.connect();
    await client.request("account_info", { account: "rA" });
    fake.fail = false;
    const start = Date.now();
    await client.request("account_info", { account: "rB" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });
});
