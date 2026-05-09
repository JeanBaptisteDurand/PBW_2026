import { describe, expect, it, vi } from "vitest";
import { createAuthService } from "../../src/services/auth.service.js";

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();
  async set(key: string, value: string, _mode: "EX", ttl: number): Promise<"OK"> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return e.value;
  }
  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }
}

const wallet = "rExampleWallet1234567890123456789";

function makeDeps() {
  const users = {
    upsertByWallet: vi.fn(async (w: string) => ({
      id: "uid-1",
      walletAddress: w,
      role: "free" as const,
      apiKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
  const verifier = { verify: vi.fn(() => true) };
  const jwt = { sign: vi.fn(() => "stub.jwt.token"), verify: vi.fn() };
  const redis = new FakeRedis();
  return { users, verifier, jwt, redis };
}

describe("auth.service.issueChallenge", () => {
  it("stores a nonce in redis under the wallet key with the configured TTL and returns a challenge string containing it", async () => {
    const deps = makeDeps();
    const svc = createAuthService({
      users: deps.users as any,
      verifier: deps.verifier as any,
      jwt: deps.jwt as any,
      redis: deps.redis as any,
      challengeTtlSeconds: 300,
    });

    const result = await svc.issueChallenge({ walletAddress: wallet });

    expect(result.challenge).toContain(wallet);
    expect(result.challenge).toMatch(/Nonce: [0-9a-f-]{36}/);
    const stored = await deps.redis.get(`auth:challenge:${wallet}`);
    expect(stored).not.toBeNull();
    expect(result.challenge).toContain(stored!);
  });
});

describe("auth.service.verifyAndLogin", () => {
  it("rejects when no challenge is stored for the wallet", async () => {
    const deps = makeDeps();
    const svc = createAuthService({
      users: deps.users as any,
      verifier: deps.verifier as any,
      jwt: deps.jwt as any,
      redis: deps.redis as any,
      challengeTtlSeconds: 300,
    });

    await expect(
      svc.verifyAndLogin({
        walletAddress: wallet,
        challenge: "fake",
        signature: "abc",
        publicKey: "ED1234",
      }),
    ).rejects.toThrow(/no_challenge/);
  });

  it("rejects when the supplied challenge string does not match the stored one", async () => {
    const deps = makeDeps();
    const svc = createAuthService({
      users: deps.users as any,
      verifier: deps.verifier as any,
      jwt: deps.jwt as any,
      redis: deps.redis as any,
      challengeTtlSeconds: 300,
    });
    const issued = await svc.issueChallenge({ walletAddress: wallet });

    await expect(
      svc.verifyAndLogin({
        walletAddress: wallet,
        challenge: `${issued.challenge}TAMPERED`,
        signature: "abc",
        publicKey: "ED1234",
      }),
    ).rejects.toThrow(/challenge_mismatch/);
  });

  it("rejects when the signature does not verify", async () => {
    const deps = makeDeps();
    deps.verifier.verify = vi.fn(() => false);
    const svc = createAuthService({
      users: deps.users as any,
      verifier: deps.verifier as any,
      jwt: deps.jwt as any,
      redis: deps.redis as any,
      challengeTtlSeconds: 300,
    });
    const issued = await svc.issueChallenge({ walletAddress: wallet });

    await expect(
      svc.verifyAndLogin({
        walletAddress: wallet,
        challenge: issued.challenge,
        signature: "abc",
        publicKey: "ED1234",
      }),
    ).rejects.toThrow(/bad_signature/);
  });

  it("upserts the user, deletes the nonce, and returns a JWT on success", async () => {
    const deps = makeDeps();
    const svc = createAuthService({
      users: deps.users as any,
      verifier: deps.verifier as any,
      jwt: deps.jwt as any,
      redis: deps.redis as any,
      challengeTtlSeconds: 300,
    });
    const issued = await svc.issueChallenge({ walletAddress: wallet });

    const out = await svc.verifyAndLogin({
      walletAddress: wallet,
      challenge: issued.challenge,
      signature: "abc",
      publicKey: "ED1234",
    });

    expect(out.token).toBe("stub.jwt.token");
    expect(out.user.walletAddress).toBe(wallet);
    expect(deps.users.upsertByWallet).toHaveBeenCalledWith(wallet);
    expect(deps.jwt.sign).toHaveBeenCalled();
    const stored = await deps.redis.get(`auth:challenge:${wallet}`);
    expect(stored).toBeNull();
  });
});
