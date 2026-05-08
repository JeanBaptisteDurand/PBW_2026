import { describe, expect, it } from "vitest";
import { createJwtService } from "../../src/services/jwt.service.js";

const SECRET = "test-secret-must-be-at-least-32-characters-long";

const samplePayload = {
  userId: "11111111-1111-1111-1111-111111111111",
  walletAddress: "rPaymentDestinationABCDEFGHJKMNPQRS",
  role: "free" as const,
};

describe("jwt.service", () => {
  it("signs and verifies a JwtPayload round-trip", () => {
    const svc = createJwtService({ secret: SECRET, ttlSeconds: 60 });
    const token = svc.sign(samplePayload);
    expect(token).toEqual(expect.any(String));
    expect(token.split(".").length).toBe(3);
    const decoded = svc.verify(token);
    expect(decoded.userId).toBe(samplePayload.userId);
    expect(decoded.walletAddress).toBe(samplePayload.walletAddress);
    expect(decoded.role).toBe("free");
  });

  it("rejects tokens signed with a different secret", () => {
    const a = createJwtService({ secret: SECRET, ttlSeconds: 60 });
    const b = createJwtService({ secret: "z".repeat(40), ttlSeconds: 60 });
    const token = a.sign(samplePayload);
    expect(() => b.verify(token)).toThrow();
  });

  it("returns the same payload on a happy round-trip with default ttl", () => {
    const svc = createJwtService({ secret: SECRET, ttlSeconds: 60 });
    const out = svc.verify(svc.sign(samplePayload));
    expect(out).toMatchObject(samplePayload);
  });

  it("rejects expired tokens", async () => {
    const svc = createJwtService({ secret: SECRET, ttlSeconds: 1 });
    const token = svc.sign(samplePayload);
    await new Promise((r) => setTimeout(r, 1500));
    expect(() => svc.verify(token)).toThrow();
  });
});
