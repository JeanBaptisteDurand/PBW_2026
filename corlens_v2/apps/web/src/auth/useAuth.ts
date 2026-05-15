import { useCallback, useSyncExternalStore } from "react";
import { api } from "../api/index.js";
import { type AuthState, clearAuth, loadAuth, saveAuth } from "./authStorage.js";
import { connectCrossmark } from "./crossmark.js";

let state: AuthState = loadAuth();
const listeners = new Set<() => void>();

function emit(): void {
  for (const fn of listeners) fn();
}

function setState(next: AuthState): void {
  state = next;
  if (next.token && next.user) {
    saveAuth(next);
  } else {
    clearAuth();
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === "corlens_auth") {
      state = loadAuth();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): AuthState {
  return state;
}

export type UseAuth = AuthState & {
  isAuthed: boolean;
  isPremium: boolean;
  connect: () => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => void;
};

export function useAuth(): UseAuth {
  const auth = useSyncExternalStore(subscribe, getSnapshot);

  const connect = useCallback(async () => {
    const result = await connectCrossmark();
    setState({ token: result.token, user: result.user });
  }, []);

  const refresh = useCallback(async () => {
    if (!state.token) return;
    const { token } = await api.identity.refresh();
    setState({ token, user: state.user });
  }, []);

  const logout = useCallback(() => {
    setState({ token: null, user: null });
  }, []);

  return {
    ...auth,
    isAuthed: Boolean(auth.token && auth.user),
    isPremium: auth.user?.role === "premium",
    connect,
    refresh,
    logout,
  };
}
