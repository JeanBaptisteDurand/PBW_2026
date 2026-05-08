import { describe, expect, it, vi } from "vitest";
import { createPaymentService } from "../../src/services/payment.service.js";

const env = {
  XRPL_PAYMENT_WALLET_ADDRESS: "rDestination",
  XRP_PRICE: "10",
  RLUSD_PRICE: "5",
  PAYMENT_EXPIRY_MINUTES: 15,
  XRPL_DEMO_WALLET_SECRET: "sEdTM1uX8pu2do5XmTTqxnVghLeVfDB",
};

function deps() {
  return {
    payments: {
      create: vi.fn(async (input) => ({
        id: "pmt-1",
        userId: input.userId,
        amount: input.amount,
        currency: input.currency,
        destination: input.destination,
        memo: input.memo,
        status: "pending",
        txHash: null,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
      })),
      findById: vi.fn(),
      confirmAtomic: vi.fn(),
      expire: vi.fn(),
    },
    xrpl: {
      pollIncomingByMemo: vi.fn(),
      submitDemoPayment: vi.fn(),
      close: vi.fn(),
    },
    events: {
      publish: vi.fn(),
      subscribe: vi.fn(),
      close: vi.fn(),
    },
  };
}

describe("payment.service.create", () => {
  it("creates a request with the configured price for XRP", async () => {
    const d = deps();
    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    const out = await svc.create({ userId: "u1", currency: "XRP" });
    expect(d.payments.create).toHaveBeenCalled();
    const call = d.payments.create.mock.calls[0][0];
    expect(call.userId).toBe("u1");
    expect(call.amount).toBe("10");
    expect(call.currency).toBe("XRP");
    expect(call.destination).toBe("rDestination");
    expect(call.memo).toMatch(/[0-9a-f-]{36}/);
    expect(out.paymentId).toBe("pmt-1");
  });

  it("creates a request with the configured price for RLUSD", async () => {
    const d = deps();
    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    const out = await svc.create({ userId: "u1", currency: "RLUSD" });
    expect(d.payments.create.mock.calls[0][0].amount).toBe("5");
    expect(out.currency).toBe("RLUSD");
  });
});

describe("payment.service.checkStatus", () => {
  it("returns confirmed when the request is already confirmed in DB", async () => {
    const d = deps();
    d.payments.findById = vi.fn(async () => ({ id: "pmt-1", status: "confirmed", txHash: "ABCD" }));
    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    const out = await svc.checkStatus({ paymentId: "pmt-1" });
    expect(out).toEqual({ status: "confirmed", txHash: "ABCD" });
  });

  it("returns not_found when the request does not exist", async () => {
    const d = deps();
    d.payments.findById = vi.fn(async () => null);
    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    expect(await svc.checkStatus({ paymentId: "missing" })).toEqual({ status: "not_found" });
  });

  it("expires the request when past expiry and returns expired", async () => {
    const d = deps();
    const past = new Date(Date.now() - 60_000);
    d.payments.findById = vi.fn(async () => ({ id: "pmt-1", status: "pending", expiresAt: past, destination: "rD", memo: "x", userId: "u1" }));
    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    expect(await svc.checkStatus({ paymentId: "pmt-1" })).toEqual({ status: "expired" });
    expect(d.payments.expire).toHaveBeenCalledWith("pmt-1");
  });

  it("polls XRPL when pending, confirms atomically, and publishes events", async () => {
    const d = deps();
    const future = new Date(Date.now() + 60_000);
    d.payments.findById = vi.fn(async () => ({
      id: "pmt-1",
      status: "pending",
      expiresAt: future,
      destination: "rD",
      memo: "memo-uuid",
      userId: "u1",
      amount: "10",
      currency: "XRP",
    }));
    d.xrpl.pollIncomingByMemo = vi.fn(async () => ({ txHash: "DEADBEEF".repeat(8), sourceAccount: "rPayer" }));
    d.payments.confirmAtomic = vi.fn(async () => ({
      req: { id: "pmt-1", status: "confirmed", txHash: "DEADBEEF".repeat(8), userId: "u1", amount: "10", currency: "XRP" },
      alreadyConfirmed: false,
    }));

    const svc = createPaymentService({ payments: d.payments as any, xrpl: d.xrpl as any, events: d.events as any, env });
    const out = await svc.checkStatus({ paymentId: "pmt-1" });

    expect(out.status).toBe("confirmed");
    expect(d.payments.confirmAtomic).toHaveBeenCalled();
    expect(d.events.publish).toHaveBeenCalledWith("payment.confirmed", expect.any(Object));
    expect(d.events.publish).toHaveBeenCalledWith("user.role_upgraded", expect.any(Object));
  });
});
