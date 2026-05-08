import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "../src/in-memory.js";

describe("InMemoryEventBus", () => {
  it("delivers a published event to a subscribed handler", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("payment.confirmed", handler);

    await bus.publish("payment.confirmed", {
      userId: "11111111-1111-1111-1111-111111111111",
      paymentId: "22222222-2222-2222-2222-222222222222",
      txHash: "A".repeat(64),
      amount: "10",
      currency: "XRP",
      confirmedAt: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("delivers to every handler subscribed to the same event", async () => {
    const bus = new InMemoryEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("user.role_upgraded", a);
    bus.subscribe("user.role_upgraded", b);

    await bus.publish("user.role_upgraded", {
      userId: "11111111-1111-1111-1111-111111111111",
      newRole: "premium",
      upgradedAt: new Date().toISOString(),
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("rejects payloads that fail schema validation", async () => {
    const bus = new InMemoryEventBus();
    bus.subscribe("payment.confirmed", () => {});

    await expect(
      bus.publish("payment.confirmed", {
        userId: "not-a-uuid",
      } as never),
    ).rejects.toThrow(/payment\.confirmed/);
  });

  it("isolates handler errors so other subscribers still run", async () => {
    const bus = new InMemoryEventBus();
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    bus.subscribe("corridor.refreshed", failing);
    bus.subscribe("corridor.refreshed", ok);

    await bus.publish("corridor.refreshed", {
      corridorId: "usd-mxn",
      status: "GREEN",
      refreshedAt: new Date().toISOString(),
    });

    expect(failing).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
