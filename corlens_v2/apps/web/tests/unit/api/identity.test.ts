import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { identityApi } from "../../../src/api/identity.js";

describe("identityApi", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loginChallenge POSTs to /api/auth/login/challenge with the wallet address", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ challenge: "a".repeat(32), expiresAt: "2026-05-15T13:00:00.000Z" }),
    });
    const res = await identityApi.loginChallenge("rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH");
    expect(res.challenge).toHaveLength(32);
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/login/challenge",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH" }),
      }),
    );
  });

  it("loginVerify POSTs the signature and parses the token + user", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        token: "jwt.tok.en",
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
          role: "free",
        },
      }),
    });
    const res = await identityApi.loginVerify({
      walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
      challenge: "a".repeat(32),
      signature: "sig",
      publicKey: "pk",
    });
    expect(res.token).toBe("jwt.tok.en");
    expect(res.user.role).toBe("free");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/login/verify",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws ApiError with body.error message on 4xx", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: "invalid_signature" }),
    });
    await expect(
      identityApi.loginVerify({
        walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
        challenge: "a".repeat(32),
        signature: "x",
        publicKey: "x",
      }),
    ).rejects.toMatchObject({ status: 400, message: "invalid_signature" });
  });

  it("injects Authorization header when a token is stored", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((k: string) =>
        k === "corlens_auth" ? JSON.stringify({ token: "tok-xyz" }) : null,
      ),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "u1",
        walletAddress: "r",
        role: "free",
        apiKey: null,
        createdAt: "2026",
        updatedAt: "2026",
        subscriptions: [],
        analyses: [],
      }),
    });
    await identityApi.getProfile();
    const call = fetchSpy.mock.calls[0];
    expect(call).toBeDefined();
    if (!call) return;
    const init = call[1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-xyz");
  });
});
