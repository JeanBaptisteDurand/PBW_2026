import { describe, expect, it, vi } from "vitest";
import { CompositeEventBus } from "../src/composite.js";
import { HttpFanoutEventBus } from "../src/http-fanout.js";
import { InMemoryEventBus } from "../src/in-memory.js";

const validPayload = {
  userId: "11111111-1111-1111-1111-111111111111",
  paymentId: "22222222-2222-2222-2222-222222222222",
  txHash: "A".repeat(64),
  amount: "10",
  currency: "XRP" as const,
  confirmedAt: new Date().toISOString(),
};

describe("CompositeEventBus", () => {
  it("delegates publish to every wrapped bus", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const inMem = new InMemoryEventBus();
    const fanout = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": ["http://x/events"] },
      fetch: fetchMock as unknown as typeof fetch,
    });
    const handler = vi.fn();
    const bus = new CompositeEventBus([inMem, fanout]);
    bus.subscribe("payment.confirmed", handler);

    await bus.publish("payment.confirmed", validPayload);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("registers subscribers on every wrapped bus", () => {
    const a = new InMemoryEventBus();
    const b = new InMemoryEventBus();
    const subA = vi.spyOn(a, "subscribe");
    const subB = vi.spyOn(b, "subscribe");
    const bus = new CompositeEventBus([a, b]);
    bus.subscribe("payment.confirmed", () => {});

    expect(subA).toHaveBeenCalledTimes(1);
    expect(subB).toHaveBeenCalledTimes(1);
  });

  it("closes every wrapped bus", async () => {
    const a = new InMemoryEventBus();
    const b = new InMemoryEventBus();
    const closeA = vi.spyOn(a, "close");
    const closeB = vi.spyOn(b, "close");
    const bus = new CompositeEventBus([a, b]);

    await bus.close();

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);
  });
});
