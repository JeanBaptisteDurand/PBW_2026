// Global store for active SafePath SSE runs.
// Survives React component unmounts so navigation doesn't kill the stream.

interface SafePathRunState {
  id: string; // unique run key
  srcCcy: string;
  dstCcy: string;
  amount: string;
  tolerance: string;
  events: any[];
  result: any | null;
  report: string | null;
  error: string | null;
  running: boolean;
  abortController: AbortController | null;
}

let activeRun: SafePathRunState | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function getActiveRun(): SafePathRunState | null {
  return activeRun;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function startGlobalRun(params: {
  srcCcy: string;
  dstCcy: string;
  amount: string;
  tolerance: string;
}): void {
  // Abort any existing run
  if (activeRun?.abortController) {
    activeRun.abortController.abort();
  }

  const abort = new AbortController();
  const runId = crypto.randomUUID();

  activeRun = {
    id: runId,
    srcCcy: params.srcCcy,
    dstCcy: params.dstCcy,
    amount: params.amount,
    tolerance: params.tolerance,
    events: [],
    result: null,
    report: null,
    error: null,
    running: true,
    abortController: abort,
  };
  notify();

  // Fire off the SSE fetch - runs independently of any component
  (async () => {
    try {
      const authRaw = localStorage.getItem("xrplens_auth");
      const authToken = authRaw ? JSON.parse(authRaw)?.token : null;
      const resp = await fetch("/api/safe-path", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify({
          srcCcy: params.srcCcy,
          dstCcy: params.dstCcy,
          amount: params.amount,
          maxRiskTolerance: params.tolerance,
        }),
        signal: abort.signal,
      });

      if (!resp.ok || !resp.body) {
        const text = await resp.text().catch(() => resp.statusText);
        throw new Error(text || `HTTP ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload);
            if (activeRun?.id === runId) {
              activeRun.events.push(event);
              if (event.type === "result") activeRun.result = event.result;
              if (event.type === "report") activeRun.report = event.report;
              if (event.type === "error") activeRun.error = event.error;
              // New top-level ref so useSyncExternalStore triggers a re-render
              activeRun = { ...activeRun };
              notify();
            }
          } catch {}
        }
      }
    } catch (err: unknown) {
      const e = err as { name?: string; message?: string };
      if (e?.name !== "AbortError" && activeRun?.id === runId) {
        activeRun = { ...activeRun, error: e?.message ?? "Agent run failed" };
      }
    } finally {
      if (activeRun?.id === runId) {
        activeRun = { ...activeRun, running: false, abortController: null };
        notify();
      }
    }
  })();
}

export function clearActiveRun(): void {
  if (activeRun?.abortController) {
    activeRun.abortController.abort();
  }
  activeRun = null;
  notify();
}
