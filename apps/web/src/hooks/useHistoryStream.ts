// xrplens/apps/web/src/hooks/useHistoryStream.ts
import { useCallback, useReducer, useRef } from "react";
import type {
  HistoryEdge,
  HistoryEvent,
  HistoryNode,
  TxTypeSummary,
} from "../lib/historyTypes";

export interface HistoryState {
  status: "idle" | "streaming" | "done" | "error";
  seed?: HistoryNode;
  nodes: Map<string, HistoryNode>;
  edges: Map<string, HistoryEdge>;
  queueSize: number;
  crawlsRun: number;
  errors: Array<{ address: string; error: string }>;
  txTypeSummary: TxTypeSummary[];
  stats?: {
    nodes: number;
    edges: number;
    crawlsRun: number;
    durationMs: number;
    truncated: boolean;
  };
  fatalError?: string;
  selectedNodeId?: string;
}

type Action =
  | { type: "start" }
  | { type: "event"; event: HistoryEvent }
  | { type: "select"; id: string | undefined }
  | { type: "reset" }
  | { type: "stopped" };

const initial: HistoryState = {
  status: "idle",
  nodes: new Map(),
  edges: new Map(),
  queueSize: 0,
  crawlsRun: 0,
  errors: [],
  txTypeSummary: [],
};

function reducer(state: HistoryState, action: Action): HistoryState {
  switch (action.type) {
    case "start":
      return { ...initial, nodes: new Map(), edges: new Map(), status: "streaming" };
    case "reset":
      return { ...initial, nodes: new Map(), edges: new Map() };
    case "stopped":
      return { ...state, status: "done" };
    case "select":
      return { ...state, selectedNodeId: action.id };
    case "event": {
      const ev = action.event;
      const nodes = new Map(state.nodes);
      const edges = new Map(state.edges);
      switch (ev.type) {
        case "seed_ready": {
          nodes.set(ev.seed.id, ev.seed);
          for (const n of ev.lightNodes) nodes.set(n.id, n);
          for (const n of ev.heavyQueue) nodes.set(n.id, n);
          for (const e of ev.edges) edges.set(e.id, e);
          return {
            ...state,
            seed: ev.seed,
            nodes,
            edges,
            queueSize: ev.heavyQueue.length,
            txTypeSummary: ev.txTypeSummary,
          };
        }
        case "node_added": {
          nodes.set(ev.node.id, ev.node);
          for (const e of ev.edges) edges.set(e.id, e);
          return {
            ...state,
            nodes,
            edges,
            crawlsRun:
              ev.node.crawlStatus === "crawled" || ev.node.crawlStatus === "error"
                ? state.crawlsRun + 1
                : state.crawlsRun,
            queueSize: Math.max(0, state.queueSize - 1),
          };
        }
        case "edges_added": {
          for (const e of ev.edges) edges.set(e.id, e);
          return { ...state, edges };
        }
        case "crawl_error":
          return {
            ...state,
            errors: [...state.errors, { address: ev.address, error: ev.error }],
          };
        case "fatal_error":
          return { ...state, status: "error", fatalError: ev.error };
        case "done":
          return { ...state, status: "done", stats: ev.stats };
      }
      return state;
    }
  }
}

export function useHistoryStream() {
  const [state, dispatch] = useReducer(reducer, initial);
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback((address: string, depth: number) => {
    if (esRef.current) esRef.current.close();
    dispatch({ type: "start" });
    const url = `/api/history/stream?address=${encodeURIComponent(address)}&depth=${depth}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as HistoryEvent;
        dispatch({ type: "event", event });
        if (event.type === "done" || event.type === "fatal_error") {
          es.close();
          esRef.current = null;
        }
      } catch {
        /* ignore malformed frames */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnects; server closes the stream on end */
    };
  }, []);

  const stop = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }
    dispatch({ type: "stopped" });
  }, []);

  const select = useCallback((id: string | undefined) => {
    dispatch({ type: "select", id });
  }, []);

  return { state, start, stop, select };
}
