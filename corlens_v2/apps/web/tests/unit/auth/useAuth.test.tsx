import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();

beforeEach(() => {
  vi.resetModules();
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useAuth", () => {
  it("starts logged-out when localStorage is empty", async () => {
    const { useAuth } = await import("../../../src/auth/useAuth.js");
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.isAuthed).toBe(false);
  });

  it("hydrates from localStorage on mount", async () => {
    store.set(
      "corlens_auth",
      JSON.stringify({
        token: "tok-xyz",
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
          role: "premium",
        },
      }),
    );
    const { useAuth } = await import("../../../src/auth/useAuth.js");
    const { result } = renderHook(() => useAuth());
    expect(result.current.token).toBe("tok-xyz");
    expect(result.current.isPremium).toBe(true);
  });

  it("logout clears the in-memory state and localStorage", async () => {
    store.set(
      "corlens_auth",
      JSON.stringify({
        token: "tok-xyz",
        user: {
          id: "00000000-0000-0000-0000-000000000001",
          walletAddress: "rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH",
          role: "free",
        },
      }),
    );
    const { useAuth } = await import("../../../src/auth/useAuth.js");
    const { result } = renderHook(() => useAuth());
    expect(result.current.isAuthed).toBe(true);
    act(() => result.current.logout());
    expect(result.current.isAuthed).toBe(false);
    expect(store.get("corlens_auth")).toBeUndefined();
  });
});
