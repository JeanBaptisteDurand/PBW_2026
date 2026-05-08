import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpFanoutEventBus } from "../src/http-fanout.js";

const validPayload = {
  userId: "11111111-1111-1111-1111-111111111111",
  paymentId: "22222222-2222-2222-2222-222222222222",
  txHash: "A".repeat(64),
  amount: "10",
  currency: "XRP" as const,
  confirmedAt: new Date().toISOString(),
};

afterEach(() => vi.restoreAllMocks());

describe("HttpFanoutEventBus", () => {
  it("POSTs the payload to every subscriber url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const bus = new HttpFanoutEventBus({
      subscribers: {
        "payment.confirmed": ["http://corridor:3004/events", "http://agent:3006/events"],
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await bus.publish("payment.confirmed", validPayload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("http://corridor:3004/events");
    expect(urls).toContain("http://agent:3006/events");
  });

  it("envelopes the request body as { name, payload }", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": ["http://x/events"] },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await bus.publish("payment.confirmed", validPayload);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "payment.confirmed",
      payload: validPayload,
    });
  });

  it("validates payloads against the schema before any fetch", async () => {
    const fetchMock = vi.fn();
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": ["http://x/events"] },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(bus.publish("payment.confirmed", { userId: "bad" } as never)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when a subscriber returns an error — logs and continues", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const bus = new HttpFanoutEventBus({
      subscribers: {
        "payment.confirmed": ["http://broken/events", "http://ok/events"],
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(bus.publish("payment.confirmed", validPayload)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("swallows fetch rejections so other subscribers still run", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const bus = new HttpFanoutEventBus({
      subscribers: {
        "payment.confirmed": ["http://offline/events", "http://ok/events"],
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(bus.publish("payment.confirmed", validPayload)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("subscribe is a noop in fanout mode (cross-process delivery is HTTP)", () => {
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": [] },
      fetch: vi.fn() as unknown as typeof fetch,
    });
    expect(() => bus.subscribe("payment.confirmed", () => {})).not.toThrow();
  });
});
