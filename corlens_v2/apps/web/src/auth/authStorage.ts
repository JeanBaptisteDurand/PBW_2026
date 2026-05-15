import type { identity as id } from "@corlens/contracts";

export type AuthUser = id.LoginVerifyResponse["user"];

export type AuthState = {
  token: string | null;
  user: AuthUser | null;
};

const STORAGE_KEY = "corlens_auth";

export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, user: null };
    const parsed = JSON.parse(raw) as Partial<AuthState>;
    return { token: parsed.token ?? null, user: parsed.user ?? null };
  } catch {
    return { token: null, user: null };
  }
}

export function saveAuth(next: AuthState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}
