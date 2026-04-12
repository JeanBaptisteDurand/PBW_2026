import { useCallback, useSyncExternalStore } from "react";

interface User {
  id: string;
  walletAddress: string;
  role: "free" | "premium";
}

interface AuthState {
  token: string | null;
  user: User | null;
}

const STORAGE_KEY = "xrplens_auth";

// ─── Shared store (singleton across all components) ──────────

let state: AuthState = loadFromStorage();
const listeners = new Set<() => void>();

function loadFromStorage(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { token: null, user: null };
}

function setState(next: AuthState) {
  state = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  listeners.forEach((fn) => fn());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return state;
}

// ─── Hook ────────────────────────────────────────────────────

export function useAuth() {
  const auth = useSyncExternalStore(subscribe, getSnapshot);

  const connect = useCallback(async (walletAddress: string) => {
    const res = await fetch("/api/auth/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    });
    if (!res.ok) throw new Error("Failed to connect");
    const data = await res.json();
    setState({ token: data.token, user: data.user });
    return data;
  }, []);

  const refresh = useCallback(async () => {
    if (!auth.token) return;
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.token}`,
      },
    });
    if (!res.ok) return;
    const data = await res.json();
    setState({ token: data.token, user: data.user });
    return data;
  }, [auth.token]);

  const logout = useCallback(() => {
    setState({ token: null, user: null });
  }, []);

  const isPremium = auth.user?.role === "premium";

  return { ...auth, connect, refresh, logout, isPremium };
}
