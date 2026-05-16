import { useState, useRef, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { getActiveRun, subscribe as subscribeStore, startGlobalRun, clearActiveRun } from "../stores/safePathStore";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import type {
  CorridorAnalysis,
  CorridorPath,
  CorridorPairDef,
  RiskSeverity,
} from "../lib/core-types.js";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { api } from "../api/index.js";
import { PremiumGate } from "../components/ui/PremiumGate";

// ─── Event types (mirror server) ─────────────────────────────────────────
type SafePathEvent =
  | { type: "step"; step: string; detail?: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "tool_result"; name: string; summary: string }
  | { type: "reasoning"; text: string }
  | { type: "corridor_context"; corridor: CorridorPairDef }
  | { type: "corridor_update"; analysis: CorridorAnalysis }
  | { type: "path_active"; pathIndex: number }
  | {
      type: "path_rejected";
      pathIndex: number;
      reason: string;
      flags: string[];
    }
  | { type: "partner_depth"; snapshot: Record<string, unknown> }
  | {
      type: "account_crawled";
      address: string;
      name: string;
      reason: string;
      flags: Array<Record<string, unknown>>;
      score: number;
    }
  | { type: "web_search"; query: string; results: string[] }
  | {
      type: "analysis_started";
      analysisId: string;
      address: string;
      label: string;
    }
  | {
      type: "analysis_complete";
      analysisId: string;
      nodeCount: number;
      edgeCount: number;
    }
  | { type: "rag_answer"; question: string; answer: string }
  | { type: "corridor_rag"; question: string; answer: string }
  | {
      type: "analyses_summary";
      analyses: Array<{
        id: string;
        address: string;
        label: string;
        nodeCount: number;
        edgeCount: number;
      }>;
    }
  | { type: "split_plan"; legs: SplitLeg[] }
  | { type: "report"; report: string }
  | { type: "result"; result: SafePathResult }
  | { type: "error"; error: string };

interface SplitLeg {
  percentage: number;
  path: CorridorPath | null;
  description: string;
  reason: string;
}

interface SafePathResult {
  winningPath: CorridorPath | null;
  winningPathIndex: number;
  riskScore: number;
  verdict: "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED";
  reasoning: string;
  rejected: Array<{ pathIndex: number; reason: string; flags: string[] }>;
  corridorAnalysis: CorridorAnalysis | null;
  corridor: CorridorPairDef | null;
  splitPlan: SplitLeg[] | null;
  partnerDepth: Record<string, unknown> | null;
  analysisIds?: string[];
  corridorRagAnswer?: string | null;
}

// ─── Analysis tracker ───────────────────────────────────────────────────
interface AnalysisTracker {
  id: string;
  address: string;
  label: string;
  status: "running" | "done";
  nodeCount?: number;
  edgeCount?: number;
}

// ─── Graph constants ────────────────────────────────────────────────────
const COL_X = {
  srcFiat: 50,
  srcActors: 220,
  bridge: 440,
  dstActors: 660,
  dstFiat: 830,
};
const ROW_START = 60;
const ROW_GAP = 90;

const BASE_STYLE: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  fontSize: 11,
  fontFamily: "monospace",
  color: "#e2e8f0",
  border: "1px solid #334155",
  textAlign: "center",
};

function riskColor(score: number): string {
  if (score >= 30) return "#ef4444";
  if (score >= 10) return "#f59e0b";
  return "#22c55e";
}

function nid(prefix: string, key: string): string {
  return `${prefix}:${key}`;
}

function categoryLabel(cat: string): string {
  switch (cat) {
    case "off-chain-bridge":
      return "Off-chain bridge";
    case "fiat-fiat":
      return "XRPL-native";
    default:
      return cat
        .split("-")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(" ");
  }
}

function categoryBadgeVariant(
  cat: string,
): "default" | "high" | "med" | "low" | "info" {
  if (cat === "off-chain-bridge") return "med";
  if (cat === "fiat-fiat") return "info";
  return "default";
}

// ─── Simple markdown renderer ───────────────────────────────────────────
interface MdSection {
  id: string;
  title: string;
  lines: string[];
}

function parseMarkdownSections(md: string): MdSection[] {
  const raw = md.split("\n");
  const sections: MdSection[] = [];
  let current: MdSection | null = null;

  for (const line of raw) {
    if (line.startsWith("## ")) {
      const title = line.slice(3).trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      current = { id, title, lines: [] };
      sections.push(current);
    } else if (current) {
      current.lines.push(line);
    } else {
      // Lines before first ## go into an intro section
      if (sections.length === 0) {
        current = { id: "intro", title: "Overview", lines: [] };
        sections.push(current);
      }
      current!.lines.push(line);
    }
  }
  return sections;
}

function renderMdLine(line: string, idx: number): React.ReactNode {
  // Horizontal rule
  if (/^---+$/.test(line.trim())) {
    return <hr key={idx} className="border-slate-800 my-4" />;
  }
  // H3
  if (line.startsWith("### ")) {
    return (
      <h4 key={idx} className="text-[12px] font-bold text-white mt-5 mb-2">
        {renderInline(line.slice(4))}
      </h4>
    );
  }
  // Risk-colored list items (HIGH / MED / LOW keywords)
  if (/^[-*]\s/.test(line.trimStart())) {
    const indent = line.length - line.trimStart().length;
    const content = line.trimStart().slice(2);
    const isHigh = /\bHIGH\b/.test(content);
    const isMed = /\bMED\b/.test(content);
    const dotColor = isHigh ? "#ef4444" : isMed ? "#f59e0b" : "#0ea5e9";
    return (
      <div
        key={idx}
        className="flex gap-3 items-start py-1"
        style={{ paddingLeft: indent * 4 + 4 }}
      >
        <span
          className="mt-[5px] shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: dotColor }}
        />
        <span className="text-[12px] text-slate-300 leading-relaxed">
          {renderInline(content)}
        </span>
      </div>
    );
  }
  // Empty line
  if (line.trim() === "") {
    return <div key={idx} className="h-2" />;
  }
  // Plain paragraph
  return (
    <p key={idx} className="text-[13px] text-slate-400 leading-[1.6]">
      {renderInline(line)}
    </p>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`|\[HIGH\]|\[MED\]|\[LOW\])/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let ki = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const m = match[0];
    if (m === "[HIGH]") {
      parts.push(
        <span key={ki++} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/15 text-red-400 border border-red-500/30">
          HIGH
        </span>,
      );
    } else if (m === "[MED]") {
      parts.push(
        <span key={ki++} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          MED
        </span>,
      );
    } else if (m === "[LOW]") {
      parts.push(
        <span key={ki++} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-500/15 text-slate-400 border border-slate-500/30">
          LOW
        </span>,
      );
    } else if (m.startsWith("**")) {
      parts.push(
        <strong key={ki++} className="text-slate-100 font-semibold">
          {m.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code
          key={ki++}
          className="px-1.5 py-0.5 bg-[#020617] border border-slate-800 rounded text-[10px] font-mono text-xrp-400"
        >
          {m.slice(1, -1)}
        </code>,
      );
    }
    last = match.index + m.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

// ─── Page ───────────────────────────────────────────────────────────────
export default function SafePath() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [srcCcy, setSrcCcy] = useState(
    searchParams.get("srcCcy")?.toUpperCase() || "USD",
  );
  const [dstCcy, setDstCcy] = useState(
    searchParams.get("dstCcy")?.toUpperCase() || "MXN",
  );
  const [amount, setAmount] = useState(searchParams.get("amount") || "1000");
  const [tolerance, setTolerance] = useState<RiskSeverity>("MED");

  const [events, setEvents] = useState<SafePathEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SafePathResult | null>(null);
  const [report, setReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [liveCorridor, setLiveCorridor] = useState<CorridorPairDef | null>(
    null,
  );
  const [activePathIndex, setActivePathIndex] = useState<number | undefined>();
  const [analysesSummary, setAnalysesSummary] = useState<
    Array<{
      id: string;
      address: string;
      label: string;
      nodeCount: number;
      edgeCount: number;
    }>
  >([]);
  const [analyses, setAnalyses] = useState<AnalysisTracker[]>([]);
  const streamRef = useRef<HTMLDivElement | null>(null);

  // ReactFlow state for live corridor graph
  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState([]);
  // Node inspect panel — click a node in the live graph to see details
  const [inspectedNode, setInspectedNode] = useState<Node | null>(null);
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState([]);
  const srcActorIdxRef = useRef(0);
  const dstActorIdxRef = useRef(0);
  const actorMapRef = useRef(new Map<string, { side: "src" | "dst"; row: number }>());
  const crawledSetRef = useRef(new Set<string>());
  // Track which nodes got rag flash
  const ragFlashTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Currency list from corridor atlas
  const [currencies, setCurrencies] = useState<string[]>([]);
  useEffect(() => {
    api.listCorridors().then((res) => {
      const set = new Set<string>();
      for (const c of res.corridors) {
        if (c.source.type === "fiat" || c.source.type === "stable")
          set.add(c.source.symbol);
        if (c.dest.type === "fiat" || c.dest.type === "stable")
          set.add(c.dest.symbol);
      }
      setCurrencies(Array.from(set).sort());
    });
  }, []);

  // Auto-scroll stream
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [events]);

  // ─── Graph helpers ──────────────────────────────────────────────────────

  const resetGraph = useCallback(() => {
    setRfNodes([]);
    setRfEdges([]);
    srcActorIdxRef.current = 0;
    dstActorIdxRef.current = 0;
    actorMapRef.current = new Map();
    crawledSetRef.current = new Set();
    ragFlashTimerRef.current.forEach((t) => clearTimeout(t));
    ragFlashTimerRef.current = new Map();
  }, [setRfNodes, setRfEdges]);

  const addCorridorSkeleton = useCallback(
    (corridor: CorridorPairDef) => {
      const srcId = nid("fiat", "src");
      const dstId = nid("fiat", "dst");
      const bridgeId = "bridge:RLUSD";

      const fiatStyle: React.CSSProperties = {
        ...BASE_STYLE,
        background: "linear-gradient(135deg, #0c4a6e 0%, #0369a1 100%)",
        border: "2px solid #0ea5e9",
        width: 120,
        fontSize: 14,
        fontWeight: 700,
        padding: 16,
      };
      const bridgeStyle: React.CSSProperties = {
        ...BASE_STYLE,
        background: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)",
        border: "2px solid #10b981",
        boxShadow: "0 0 24px rgba(16,185,129,0.25)",
        width: 130,
        fontSize: 14,
        fontWeight: 700,
        padding: 16,
      };

      const newNodes: Node[] = [
        {
          id: srcId,
          position: { x: COL_X.srcFiat, y: 200 },
          data: {
            label: `${corridor.source.flag} ${corridor.source.symbol}`,
          },
          style: fiatStyle,
        },
        {
          id: dstId,
          position: { x: COL_X.dstFiat, y: 200 },
          data: {
            label: `${corridor.dest.flag} ${corridor.dest.symbol}`,
          },
          style: fiatStyle,
        },
        {
          id: bridgeId,
          position: { x: COL_X.bridge, y: 200 },
          data: { label: corridor.bridgeAsset ?? "RLUSD" },
          style: bridgeStyle,
        },
      ];

      const animEdge = {
        strokeDasharray: "6 3",
        animation: "dash 1.5s linear infinite",
      };

      const newEdges: Edge[] = [
        {
          id: `e-${srcId}-${bridgeId}`,
          source: srcId,
          target: bridgeId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#0ea5e9", strokeWidth: 2, ...animEdge },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#0ea5e9",
          },
        },
        {
          id: `e-${bridgeId}-${dstId}`,
          source: bridgeId,
          target: dstId,
          type: "smoothstep",
          animated: true,
          style: { stroke: "#0ea5e9", strokeWidth: 2, ...animEdge },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#0ea5e9",
          },
        },
      ];

      // Seed ALL actors from the corridor registry immediately so the
      // graph starts with the same density as the corridor detail page.
      const srcActors = corridor.sourceActors ?? [];
      const dstActors = corridor.destActors ?? [];
      const ROW_GAP = 56;

      const actorStyle = (odl: boolean, rlusd: boolean): React.CSSProperties => ({
        ...BASE_STYLE,
        background: odl ? "#0c4a6e" : rlusd ? "#064e3b" : "#1e293b",
        border: `1.5px solid ${odl ? "#38bdf8" : rlusd ? "#34d399" : "#475569"}`,
        width: 150,
        fontSize: 10,
        padding: 6,
      });

      // Source actors
      srcActors.slice(0, 8).forEach((actor, i) => {
        const nodeId = nid("actor", actor.key);
        actorMapRef.current.set(actor.key, { side: "src", row: i });
        srcActorIdxRef.current = Math.max(srcActorIdxRef.current, i + 1);
        const tags = [actor.odl ? "ODL" : null, actor.supportsRlusd ? "RLUSD" : null].filter(Boolean).join(" ");
        newNodes.push({
          id: nodeId,
          position: { x: COL_X.srcActors, y: 40 + i * ROW_GAP },
          data: { label: `${actor.name}${tags ? ` · ${tags}` : ""}` },
          style: actorStyle(!!actor.odl, !!actor.supportsRlusd),
        });
        newEdges.push({
          id: `e-${srcId}-${nodeId}`,
          source: srcId, target: nodeId, type: "smoothstep",
          style: { stroke: "#475569", strokeWidth: 1 },
        });
        newEdges.push({
          id: `e-${nodeId}-${bridgeId}`,
          source: nodeId, target: bridgeId, type: "smoothstep",
          animated: !!actor.odl || !!actor.supportsRlusd,
          style: {
            stroke: actor.odl ? "#38bdf8" : actor.supportsRlusd ? "#34d399" : "#475569",
            strokeWidth: actor.odl ? 2 : 1,
          },
        });
      });

      // Dest actors
      dstActors.slice(0, 8).forEach((actor, i) => {
        const nodeId = nid("actor", actor.key);
        actorMapRef.current.set(actor.key, { side: "dst", row: i });
        dstActorIdxRef.current = Math.max(dstActorIdxRef.current, i + 1);
        const tags = [actor.odl ? "ODL" : null, actor.supportsRlusd ? "RLUSD" : null].filter(Boolean).join(" ");
        newNodes.push({
          id: nodeId,
          position: { x: COL_X.dstActors, y: 40 + i * ROW_GAP },
          data: { label: `${actor.name}${tags ? ` · ${tags}` : ""}` },
          style: actorStyle(!!actor.odl, !!actor.supportsRlusd),
        });
        newEdges.push({
          id: `e-${bridgeId}-${nodeId}`,
          source: bridgeId, target: nodeId, type: "smoothstep",
          animated: !!actor.odl || !!actor.supportsRlusd,
          style: {
            stroke: actor.odl ? "#38bdf8" : actor.supportsRlusd ? "#34d399" : "#475569",
            strokeWidth: actor.odl ? 2 : 1,
          },
        });
        newEdges.push({
          id: `e-${nodeId}-${dstId}`,
          source: nodeId, target: dstId, type: "smoothstep",
          style: { stroke: "#475569", strokeWidth: 1 },
        });
      });

      // Center the fiat + bridge nodes vertically based on actor count
      const maxActors = Math.max(srcActors.length, dstActors.length, 1);
      const centerY = 40 + ((Math.min(maxActors, 8) - 1) * ROW_GAP) / 2;
      newNodes[0].position.y = centerY; // src fiat
      newNodes[1].position.y = centerY; // dst fiat
      newNodes[2].position.y = centerY; // bridge

      setRfNodes((prev) => [...prev, ...newNodes]);
      setRfEdges((prev) => [...prev, ...newEdges]);
    },
    [setRfNodes, setRfEdges],
  );

  const addActorNode = useCallback(
    (
      label: string,
      address: string,
      side: "src" | "dst",
      pulsing: boolean,
    ) => {
      const nodeId = nid("actor", address);
      if (actorMapRef.current.has(address)) return;
      const idxRef = side === "src" ? srcActorIdxRef : dstActorIdxRef;
      const row = idxRef.current;
      idxRef.current++;
      actorMapRef.current.set(address, { side, row });

      const colX = side === "src" ? COL_X.srcActors : COL_X.dstActors;
      const yPos = ROW_START + row * ROW_GAP;

      const newNode: Node = {
        id: nodeId,
        position: { x: colX, y: yPos },
        data: { label: `${label}\n${address.slice(0, 8)}...` },
        style: {
          ...BASE_STYLE,
          background: "#1e293b",
          border: pulsing
            ? "2px solid #38bdf8"
            : "1px solid #475569",
          boxShadow: pulsing
            ? "0 0 12px rgba(56,189,248,0.3)"
            : "none",
          width: 140,
        },
      };

      const bridgeId = "bridge:RLUSD";
      const edgeColor = side === "src" ? "#0ea5e9" : "#10b981";
      const srcNode = side === "src" ? nid("fiat", "src") : bridgeId;
      const tgtNode = side === "src" ? bridgeId : nid("fiat", "dst");

      const inEdge: Edge = {
        id: `e-${srcNode}-${nodeId}`,
        source: srcNode,
        target: nodeId,
        type: "smoothstep",
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 1.5, opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      };
      const outEdge: Edge = {
        id: `e-${nodeId}-${tgtNode}`,
        source: nodeId,
        target: tgtNode,
        type: "smoothstep",
        animated: true,
        style: { stroke: edgeColor, strokeWidth: 1.5, opacity: 0.7 },
        markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor },
      };

      setRfNodes((prev) => [...prev, newNode]);
      setRfEdges((prev) => [...prev, inEdge, outEdge]);
    },
    [setRfNodes, setRfEdges],
  );

  const settleActorNode = useCallback(
    (address: string) => {
      const nodeId = nid("actor", address);
      setRfNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                style: {
                  ...n.style,
                  border: "1px solid #475569",
                  boxShadow: "none",
                },
              }
            : n,
        ),
      );
    },
    [setRfNodes],
  );

  const addCrawledAccount = useCallback(
    (
      address: string,
      name: string,
      reason: string,
      flags: Array<Record<string, unknown>>,
      score: number,
    ) => {
      if (crawledSetRef.current.has(address)) {
        // Update border color
        setRfNodes((prev) =>
          prev.map((n) => {
            if (
              n.id === nid("actor", address) ||
              n.id === nid("account", address)
            ) {
              return {
                ...n,
                style: {
                  ...n.style,
                  border: `2px solid ${riskColor(score)}`,
                },
              };
            }
            return n;
          }),
        );
        return;
      }
      crawledSetRef.current.add(address);

      // If we don't have this address as an actor, add as generic account
      if (!actorMapRef.current.has(address)) {
        const side =
          crawledSetRef.current.size % 2 === 0 ? "src" : "dst";
        const idxRef = side === "src" ? srcActorIdxRef : dstActorIdxRef;
        const row = idxRef.current;
        idxRef.current++;
        actorMapRef.current.set(address, { side, row });

        const colX = side === "src" ? COL_X.srcActors : COL_X.dstActors;
        const yPos = ROW_START + row * ROW_GAP;
        const displayName = name || address.slice(0, 10) + "…";
        const flagStr =
          flags.length > 0 ? ` [${flags.length} flag(s)]` : "";

        const newNode: Node = {
          id: nid("account", address),
          position: { x: colX, y: yPos },
          data: { label: `${displayName}${flagStr}`, reason, address, name },
          style: {
            ...BASE_STYLE,
            background: "#1e293b",
            border: `2px solid ${riskColor(score)}`,
            width: 140,
          },
        };

        const bridgeId = "bridge:RLUSD";
        const newEdge: Edge = {
          id: `e-${bridgeId}-${nid("account", address)}`,
          source: bridgeId,
          target: nid("account", address),
          type: "smoothstep",
          animated: true,
          style: { stroke: riskColor(score), opacity: 0.6, strokeWidth: 1 },
        };

        setRfNodes((prev) => [...prev, newNode]);
        setRfEdges((prev) => [...prev, newEdge]);
      } else {
        // Update existing actor node
        const existingId = nid("actor", address);
        setRfNodes((prev) =>
          prev.map((n) =>
            n.id === existingId
              ? {
                  ...n,
                  style: {
                    ...n.style,
                    border: `2px solid ${riskColor(score)}`,
                  },
                }
              : n,
          ),
        );
      }
    },
    [setRfNodes, setRfEdges],
  );

  const addAnalysisSatellite = useCallback(
    (analysisId: string, address: string, nodeCount: number) => {
      const info = actorMapRef.current.get(address);
      if (!info) return;
      const colX =
        info.side === "src" ? COL_X.srcActors : COL_X.dstActors;
      const yPos = ROW_START + info.row * ROW_GAP;

      const satId = nid("sat", analysisId);
      const parentId =
        nid("actor", address) ||
        nid("account", address);

      const satNode: Node = {
        id: satId,
        position: { x: colX + (info.side === "src" ? -80 : 80), y: yPos + 30 },
        data: { label: `${nodeCount} nodes` },
        style: {
          ...BASE_STYLE,
          background: "#0c4a6e",
          border: "1px solid #38bdf8",
          fontSize: 9,
          padding: 6,
          width: 70,
        },
      };

      const satEdge: Edge = {
        id: `e-sat-${satId}`,
        source: parentId,
        target: satId,
        style: { stroke: "#38bdf8", strokeWidth: 1, strokeDasharray: "3 2" },
      };

      setRfNodes((prev) => {
        if (prev.some((n) => n.id === satId)) return prev;
        return [...prev, satNode];
      });
      setRfEdges((prev) => [...prev, satEdge]);
    },
    [setRfNodes, setRfEdges],
  );

  const flashNodeBorder = useCallback(
    (address: string) => {
      const ids = [nid("actor", address), nid("account", address)];
      setRfNodes((prev) =>
        prev.map((n) =>
          ids.includes(n.id)
            ? {
                ...n,
                style: {
                  ...n.style,
                  border: "2px solid #22d3ee",
                  boxShadow: "0 0 16px rgba(34,211,238,0.4)",
                },
              }
            : n,
        ),
      );
      // Revert after 1.5s
      const timer = setTimeout(() => {
        setRfNodes((prev) =>
          prev.map((n) =>
            ids.includes(n.id)
              ? {
                  ...n,
                  style: {
                    ...n.style,
                    border: (n.style as Record<string, unknown>)?.border === "2px solid #22d3ee"
                      ? "1px solid #475569"
                      : (n.style as Record<string, string>)?.border ?? "1px solid #475569",
                    boxShadow: "none",
                  },
                }
              : n,
          ),
        );
      }, 1500);
      ragFlashTimerRef.current.set(address, timer);
    },
    [setRfNodes],
  );

  const updateBridgeSpread = useCallback(
    (snapshot: Record<string, unknown>) => {
      const spread =
        typeof snapshot.spreadBps === "number"
          ? snapshot.spreadBps.toFixed(1)
          : "?";
      setRfNodes((prev) =>
        prev.map((n) =>
          n.id === "bridge:RLUSD"
            ? {
                ...n,
                data: { label: `RLUSD\n${spread}bps` },
                style: {
                  ...n.style,
                  width: 150,
                  boxShadow: "0 0 32px rgba(16,185,129,0.35)",
                },
              }
            : n,
        ),
      );
    },
    [setRfNodes],
  );

  const addCorridorPaths = useCallback(
    (analysisData: CorridorAnalysis) => {
      const hopNodes: Node[] = [];
      const hopEdges: Edge[] = [];
      const seenHops = new Set<string>();
      let hopIdx = 0;

      for (const path of analysisData.paths) {
        let prevId = "bridge:RLUSD";
        for (const hop of path.hops) {
          const addr = hop.issuer ?? hop.account;
          if (!addr) continue;
          const hopNodeId = nid("hop", addr);
          if (!seenHops.has(addr)) {
            seenHops.add(addr);
            hopNodes.push({
              id: hopNodeId,
              position: {
                x: COL_X.bridge + 100 + (hopIdx % 3) * 60,
                y: ROW_START + hopIdx * 60,
              },
              data: {
                label: `${hop.currency ?? "XRP"}\n${addr.slice(0, 6)}...`,
              },
              style: {
                ...BASE_STYLE,
                background: "#1a1a2e",
                border: "1px solid #6366f1",
                fontSize: 9,
              },
            });
            hopIdx++;
          }
          hopEdges.push({
            id: `e-path-${prevId}-${hopNodeId}-${path.index}`,
            source: prevId,
            target: hopNodeId,
            type: "smoothstep",
            animated: true,
            style: { stroke: "#6366f1", strokeWidth: 2, opacity: 0.7 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#6366f1",
            },
          });
          prevId = hopNodeId;
        }
      }

      setRfNodes((prev) => {
        const existingIds = new Set(prev.map((n) => n.id));
        return [...prev, ...hopNodes.filter((n) => !existingIds.has(n.id))];
      });
      setRfEdges((prev) => [...prev, ...hopEdges]);
    },
    [setRfNodes, setRfEdges],
  );

  // ─── Process a single SSE event into local state ─────────────────────
  const processEvent = useCallback(
    (event: SafePathEvent, allEvents: SafePathEvent[]) => {
      if (event.type === "result") {
        setResult(event.result);
        setActivePathIndex(undefined);
        if (event.result.verdict === "OFF_CHAIN_ROUTED" || event.result.verdict === "SAFE") {
          setRfEdges((prev) =>
            prev.map((edge) => {
              const isOdlEdge = edge.style?.stroke === "#38bdf8";
              const isRlusdEdge = edge.style?.stroke === "#34d399";
              if (isOdlEdge || isRlusdEdge) {
                return {
                  ...edge,
                  style: { ...edge.style, stroke: "#fbbf24", strokeWidth: 3 },
                  animated: true,
                  label: "recommended",
                  labelStyle: { fill: "#fbbf24", fontSize: 8, fontWeight: 700 },
                  labelBgStyle: { fill: "#0f172a", fillOpacity: 0.8 },
                };
              }
              return edge;
            }),
          );
        }
      } else if (event.type === "error") {
        setError(event.error);
      } else if (event.type === "corridor_context") {
        setLiveCorridor(event.corridor);
        addCorridorSkeleton(event.corridor);
        const c = event.corridor;
        if (c.sourceActors) {
          for (const a of c.sourceActors.slice(0, 6)) {
            addActorNode(a.name, a.key, "src", true);
          }
        }
        if (c.destActors) {
          for (const a of c.destActors.slice(0, 6)) {
            addActorNode(a.name, a.key, "dst", true);
          }
        }
      } else if (event.type === "corridor_update") {
        addCorridorPaths(event.analysis);
      } else if (event.type === "path_active") {
        setActivePathIndex(event.pathIndex);
      } else if (event.type === "account_crawled") {
        addCrawledAccount(event.address, event.name ?? "", event.reason ?? "", event.flags, event.score);
      } else if (event.type === "web_search") {
        const firstWord = event.query.split(" ")[0].toLowerCase();
        actorMapRef.current.forEach((_, key) => {
          if (key.toLowerCase().includes(firstWord)) settleActorNode(key);
        });
      } else if (event.type === "analysis_started") {
        setAnalyses((prev) => {
          if (prev.some((a) => a.id === event.analysisId)) return prev;
          return [
            ...prev,
            { id: event.analysisId, address: event.address, label: event.label, status: "running" },
          ];
        });
      } else if (event.type === "analysis_complete") {
        setAnalyses((prev) => {
          const exists = prev.find((a) => a.id === event.analysisId);
          if (exists) {
            return prev.map((a) =>
              a.id === event.analysisId
                ? { ...a, status: "done" as const, nodeCount: event.nodeCount, edgeCount: event.edgeCount }
                : a,
            );
          }
          const matchingStarted = allEvents.find(
            (e) =>
              e.type === "tool_result" &&
              e.name === "deepAnalyze" &&
              (e as any).summary?.includes(event.analysisId.slice(0, 8)),
          );
          const label =
            (matchingStarted as any)?.summary?.match(/for (.+?)\.$/)?.[1] ??
            `Analysis ${event.analysisId.slice(0, 8)}`;
          return [
            ...prev,
            { id: event.analysisId, address: "", label, status: "done" as const, nodeCount: event.nodeCount, edgeCount: event.edgeCount },
          ];
        });
        setAnalyses((prev) => {
          const started = prev.find((a) => a.id === event.analysisId);
          if (started) addAnalysisSatellite(event.analysisId, started.address, event.nodeCount);
          return prev;
        });
      } else if (event.type === "rag_answer") {
        actorMapRef.current.forEach((_, key) => {
          if (event.question.toLowerCase().includes(key.toLowerCase().slice(0, 6))) flashNodeBorder(key);
        });
      } else if (event.type === "partner_depth") {
        updateBridgeSpread(event.snapshot);
      } else if (event.type === "report") {
        setReport(event.report);
      } else if (event.type === "analyses_summary") {
        setAnalysesSummary(event.analyses);
      }
    },
    [addCorridorSkeleton, addActorNode, settleActorNode, addCrawledAccount, addCorridorPaths, addAnalysisSatellite, flashNodeBorder, updateBridgeSpread],
  );

  // ─── Global store sync ──────────────────────────────────────────────────
  const globalRun = useSyncExternalStore(subscribeStore, getActiveRun);
  const processedCountRef = useRef(0);
  const lastRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!globalRun) {
      processedCountRef.current = 0;
      lastRunIdRef.current = null;
      return;
    }

    // New run started — reset local state and replay all events
    if (globalRun.id !== lastRunIdRef.current) {
      lastRunIdRef.current = globalRun.id;
      processedCountRef.current = 0;
      setEvents([]);
      setResult(null);
      setReport(null);
      setError(null);
      setLiveCorridor(null);
      setActivePathIndex(undefined);
      setAnalysesSummary([]);
      setAnalyses([]);
      resetGraph();
      setSrcCcy(globalRun.srcCcy);
      setDstCcy(globalRun.dstCcy);
      setAmount(globalRun.amount);
    }

    // Process new events
    const newEvents = globalRun.events.slice(processedCountRef.current);
    if (newEvents.length > 0) {
      for (const event of newEvents) {
        processEvent(event as SafePathEvent, globalRun.events as SafePathEvent[]);
      }
      setEvents(globalRun.events as SafePathEvent[]);
      processedCountRef.current = globalRun.events.length;
    }

    setRunning(globalRun.running);
    if (globalRun.error) setError(globalRun.error);
  }, [globalRun, resetGraph, processEvent]);

  // ─── Load saved run from DB via ?runId= ─────────────────────────────────
  useEffect(() => {
    const runId = searchParams.get("runId");
    if (!runId) return;
    api.getSafePathRun(runId).then((saved) => {
      setResult(saved.resultJson as SafePathResult);
      setReport(saved.reportMarkdown ?? null);
      setSrcCcy(saved.srcCcy);
      setDstCcy(saved.dstCcy);
      setAmount(saved.amount);
      setRunning(false);
      setError(null);
      // Rebuild corridor context from saved result
      const rj = (saved.resultJson ?? {}) as {
        corridor?: unknown;
        corridorAnalysis?: unknown;
      };
      if (rj.corridor) {
        setLiveCorridor(rj.corridor as never);
        addCorridorSkeleton(rj.corridor as never);
      }
      if (rj.corridorAnalysis) {
        addCorridorPaths(rj.corridorAnalysis as never);
      }
    }).catch(() => {
      setError("Failed to load saved run");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── SSE run ──────────────────────────────────────────────────────────
  const run = useCallback(() => {
    startGlobalRun({ srcCcy, dstCcy, amount, tolerance });
  }, [srcCcy, dstCcy, amount, tolerance]);

  const stop = useCallback(() => {
    clearActiveRun();
    setRunning(false);
  }, []);

  const downloadReport = useCallback(() => {
    if (!report) return;
    const blob = new Blob([report], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `corlens-safepath-${srcCcy}-${dstCcy}-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [report, srcCcy, dstCcy]);

  // ─── Markdown sections ────────────────────────────────────────────────
  const reportSections = useMemo(
    () => (report ? parseMarkdownSections(report) : []),
    [report],
  );

  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(`report-section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSectionId(id);
    }
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <PremiumGate>
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(2,132,199,0.10) 0%, transparent 60%)",
        }}
      />
      <div className="max-w-7xl mx-auto px-6 py-10 pb-28">
        {/* Header */}
        <div className="mb-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80 mb-1">
            AI Agent — not a chatbot
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Route any fiat through XRPL safely
          </h1>
          <p className="text-slate-400 text-sm max-w-3xl">
            Pick two currencies and an amount. The AI agent calls six tools
            against the live XRPL: resolves the corridor from the atlas,
            runs the{" "}
            <a href="/analyze" className="text-xrp-400 hover:underline">Entity Audit</a>{" "}
            crawler on every hop, queries the{" "}
            <a href="/corridors" className="text-xrp-400 hover:underline">Corridor Atlas</a>{" "}
            for actor intelligence, fetches live orderbook depth, proposes
            split routing for large amounts, and generates a downloadable
            compliance report. Everything streams in real time.
          </p>
        </div>

        {/* Input form */}
        <Card className="mb-6" data-testid="safe-path-form">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  From
                </label>
                <select
                  value={srcCcy}
                  onChange={(e) => setSrcCcy(e.target.value)}
                  disabled={running}
                  className="w-full rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-mono text-white focus:border-xrp-500 focus:outline-none"
                  data-testid="sp-from"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  const t = srcCcy;
                  setSrcCcy(dstCcy);
                  setDstCcy(t);
                }}
                disabled={running}
                className="mb-1 rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-xrp-500 hover:text-white"
              >
                &#8644;
              </button>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  To
                </label>
                <select
                  value={dstCcy}
                  onChange={(e) => setDstCcy(e.target.value)}
                  disabled={running}
                  className="w-full rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-mono text-white focus:border-xrp-500 focus:outline-none"
                  data-testid="sp-to"
                >
                  {currencies.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !running && run()}
                  disabled={running}
                  className="w-full rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-mono text-white focus:border-xrp-500 focus:outline-none"
                  data-testid="sp-amount"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Max risk
                </label>
                <select
                  value={tolerance}
                  onChange={(e) =>
                    setTolerance(e.target.value as RiskSeverity)
                  }
                  disabled={running}
                  className="w-full rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm text-white focus:border-xrp-500 focus:outline-none"
                >
                  <option value="LOW">LOW</option>
                  <option value="MED">MED</option>
                  <option value="HIGH">HIGH</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={run}
                  disabled={running}
                  data-testid="sp-run"
                >
                  {running ? "Running..." : "Analyze route"}
                </Button>
                {running && (
                  <Button onClick={stop} variant="ghost">
                    Stop
                  </Button>
                )}
              </div>
            </div>
            {error && (
              <div className="mt-3 text-xs text-red-400 font-mono">
                {error}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Corridor Banner (appears during analysis) ────────────────── */}
        {liveCorridor && (
          <div
            className="mb-4 sticky top-0 z-20 bg-slate-900/95 backdrop-blur border border-slate-700 rounded-lg px-5 py-3 flex items-center justify-between gap-4 flex-wrap"
            data-testid="sp-corridor-banner"
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-lg font-bold text-white">
                {liveCorridor.source.flag} {liveCorridor.source.symbol}
                <span className="text-slate-500 mx-2">&#8594;</span>
                {liveCorridor.dest.flag} {liveCorridor.dest.symbol}
              </span>
              <Badge variant={categoryBadgeVariant(liveCorridor.category)}>
                {categoryLabel(liveCorridor.category)}
              </Badge>
              <Badge variant="default">
                Bridge: {liveCorridor.bridgeAsset ?? "RLUSD"}
              </Badge>
              <span className="text-[10px] text-slate-400 font-mono">
                {liveCorridor.sourceActors?.length ?? 0} src actors
                {" / "}
                {liveCorridor.destActors?.length ?? 0} dst actors
              </span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                navigate(`/corridors/${liveCorridor.id}`)
              }
            >
              View corridor &#8594;
            </Button>
          </div>
        )}

        {/* ── Live Analysis Preview Cards ──────────────────────────────── */}
        {analyses.length > 0 && (
          <div className="mb-4">
            <div className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mb-2">
              Deep analyses ({analyses.length})
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {analyses.map((a) => (
                <div
                  key={a.id}
                  className="shrink-0 w-[300px] bg-slate-900 border border-slate-700 rounded-lg p-3"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {a.label}
                    </span>
                    {a.status === "running" ? (
                      <span className="inline-block w-2 h-2 bg-sky-400 rounded-full animate-pulse" />
                    ) : (
                      <Badge variant="info">done</Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono mb-2">
                    {a.address.slice(0, 12)}...
                  </div>
                  {a.status === "running" && (
                    <div className="text-xs text-sky-300 animate-pulse">
                      analyzing...
                    </div>
                  )}
                  {a.status === "done" && (
                    <>
                      <div className="text-[10px] text-slate-400 mb-2">
                        {a.nodeCount} nodes, {a.edgeCount} edges
                      </div>
                      <div
                        className="w-full h-[80px] overflow-hidden rounded border border-slate-800 bg-slate-950 mb-2"
                        style={{ position: "relative" }}
                      >
                        <iframe
                          src={`/graph/${a.id}`}
                          title={`Preview ${a.label}`}
                          className="border-0"
                          style={{
                            width: 750,
                            height: 500,
                            transform: "scale(0.4)",
                            transformOrigin: "top left",
                            pointerEvents: "none",
                          }}
                        />
                      </div>
                      <a
                        href={`/graph/${a.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-full rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                      >
                        View full graph &rarr;
                      </a>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main content: SSE stream (left) + Live graph (right) ───── */}
        {(events.length > 0 || running) && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 mb-6">
            {/* Agent reasoning stream */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Agent reasoning
                  {running && (
                    <span className="inline-block w-2 h-2 bg-xrp-400 rounded-full animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  ref={streamRef}
                  data-testid="safe-path-stream"
                  className="bg-slate-950/80 border border-slate-800 rounded p-3 h-[560px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1"
                >
                  {events.map((e, i) => (
                    <EventRow key={i} event={e} />
                  ))}
                  {running && events.length === 0 && (
                    <div className="text-slate-600">
                      Connecting to XRPL...
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Live corridor discovery graph */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  Live corridor map
                  <span className="text-[10px] font-mono text-slate-500">
                    {rfNodes.length} nodes, {rfEdges.length} edges
                  </span>
                  {running && (
                    <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {rfNodes.length > 0 ? (
                  <div className="relative h-[600px] border border-slate-800 rounded bg-slate-950/50 overflow-hidden">
                    <ReactFlow
                      nodes={rfNodes}
                      edges={rfEdges}
                      onNodesChange={onRfNodesChange}
                      onEdgesChange={onRfEdgesChange}
                      onNodeClick={(_e, node) => setInspectedNode(node)}
                      onPaneClick={() => setInspectedNode(null)}
                      fitView
                      fitViewOptions={{ padding: 0.12 }}
                      proOptions={{ hideAttribution: true }}
                      minZoom={0.15}
                      maxZoom={3}
                      nodesDraggable
                    >
                      <Background
                        variant={BackgroundVariant.Dots}
                        gap={16}
                        size={0.5}
                        color="#334155"
                      />
                      <Controls
                        showInteractive={false}
                        position="top-right"
                        style={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 6 }}
                      />
                      <MiniMap
                        nodeColor={(n) => {
                          if (n.id.startsWith("fiat:")) return "#0ea5e9";
                          if (n.id.startsWith("bridge:")) return "#10b981";
                          if (n.style?.border?.toString().includes("#38bdf8")) return "#38bdf8";
                          if (n.style?.border?.toString().includes("#34d399")) return "#34d399";
                          if (n.style?.border?.toString().includes("#ef4444")) return "#ef4444";
                          return "#475569";
                        }}
                        style={{ background: "#020617", border: "1px solid #1e293b" }}
                        maskColor="rgba(0,0,0,0.7)"
                        position="bottom-left"
                      />
                    </ReactFlow>
                    {/* Node inspect panel — slides in from the right on click */}
                    {inspectedNode && (
                      <div
                        className="absolute top-0 right-0 w-[280px] h-full bg-slate-950/95 border-l border-slate-800 backdrop-blur-md z-20 overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="p-3 border-b border-slate-800 flex items-start justify-between">
                          <div>
                            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                              {inspectedNode.id.split(":")[0]}
                            </div>
                            <div className="text-sm font-semibold text-white mt-0.5">
                              {typeof inspectedNode.data?.label === "string"
                                ? inspectedNode.data.label
                                : inspectedNode.id}
                            </div>
                          </div>
                          <button
                            onClick={() => setInspectedNode(null)}
                            className="text-slate-500 hover:text-white text-xs px-1"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-3 space-y-3 text-[11px]">
                          {/* Node ID */}
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">ID</div>
                            <div className="text-slate-300 font-mono text-[10px] break-all">{inspectedNode.id}</div>
                          </div>
                          {/* Position */}
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Position</div>
                            <div className="text-slate-400 font-mono">
                              x:{Math.round(inspectedNode.position.x)} y:{Math.round(inspectedNode.position.y)}
                            </div>
                          </div>
                          {/* Type info based on ID prefix */}
                          {inspectedNode.id.startsWith("fiat:") && (
                            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-2">
                              <div className="text-sky-300 font-semibold">Fiat currency endpoint</div>
                              <div className="text-slate-400 mt-1">
                                This is the source or destination fiat currency. Real money enters/exits the XRPL corridor here through off-chain partners.
                              </div>
                            </div>
                          )}
                          {inspectedNode.id.startsWith("bridge:") && (
                            <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-2">
                              <div className="text-emerald-300 font-semibold">XRPL bridge asset</div>
                              <div className="text-slate-400 mt-1">
                                The asset that crosses the XRPL ledger. All fiat flows convert to this asset on one side and convert back on the other.
                              </div>
                              {inspectedNode.data?.label?.toString().includes("bps") && (
                                <div className="text-emerald-200 mt-1 font-mono">
                                  Live spread measured from partner orderbook.
                                </div>
                              )}
                            </div>
                          )}
                          {inspectedNode.id.startsWith("actor:") && (
                            <div className="rounded border border-slate-700 bg-slate-900/50 p-2">
                              <div className="text-white font-semibold">Off-chain actor</div>
                              <div className="text-slate-400 mt-1">
                                A CEX, ODL partner, bank, or fintech that handles the fiat↔XRPL conversion. Click "View corridor →" in the banner above to see the full actor registry.
                              </div>
                              {inspectedNode.style?.border?.toString().includes("#38bdf8") && (
                                <Badge variant="info" className="mt-1 text-[9px]">ODL Partner</Badge>
                              )}
                              {inspectedNode.style?.border?.toString().includes("#34d399") && (
                                <Badge variant="low" className="mt-1 text-[9px] bg-emerald-500/15 text-emerald-300 border-emerald-500/40">RLUSD</Badge>
                              )}
                            </div>
                          )}
                          {(inspectedNode.id.startsWith("crawled:") || inspectedNode.id.startsWith("account:")) && (
                            <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2">
                              <div className="text-amber-300 font-semibold">
                                {inspectedNode.data?.name || "Crawled XRPL account"}
                              </div>
                              {inspectedNode.data?.address && (
                                <div className="font-mono text-[9px] text-slate-500 mt-0.5 break-all">
                                  {inspectedNode.data.address}
                                </div>
                              )}
                              {inspectedNode.data?.reason && (
                                <div className="text-[10px] text-slate-400 mt-1">
                                  <span className="text-slate-500">Why crawled: </span>{inspectedNode.data.reason}
                                </div>
                              )}
                              <div className="text-slate-400 mt-1 text-[10px]">
                                Inspected on live XRPL mainnet via XRPScan + account_info. Checked for global freeze, clawback, deposit auth, domain verification, and key management.
                              </div>
                            </div>
                          )}
                          {inspectedNode.id.startsWith("satellite:") && (
                            <div className="rounded border border-sky-500/30 bg-sky-500/10 p-2">
                              <div className="text-sky-300 font-semibold">Deep analysis result</div>
                              <div className="text-slate-400 mt-1">
                                A depth-2 BFS crawl was run on this entity, discovering the node/edge counts shown. Click "View full graph" in the analysis cards above to explore.
                              </div>
                            </div>
                          )}
                          {/* Connected edges */}
                          <div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">Connections</div>
                            <div className="text-slate-400">
                              {rfEdges.filter(
                                (e) => e.source === inspectedNode.id || e.target === inspectedNode.id,
                              ).length}{" "}
                              edge(s)
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Legend */}
                    <div className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-slate-800/80 bg-black/60 backdrop-blur-md px-4 py-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400">
                        <span className="font-bold uppercase tracking-widest text-slate-500 mr-1">Nodes</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0c4a6e] border border-[#0ea5e9]" />fiat</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#064e3b] border border-[#10b981]" />bridge</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#0c4a6e] border border-[#38bdf8]" />ODL actor</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#064e3b] border border-[#34d399]" />RLUSD actor</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#1e293b] border border-[#475569]" />other actor</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/30 border border-emerald-500" />crawled ✓</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/30 border border-red-500" />risk flagged</span>
                        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sky-500/20 border border-sky-500" />analysis satellite</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400 mt-1">
                        <span className="font-bold uppercase tracking-widest text-slate-500 mr-1">Edges</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 bg-[#38bdf8]" />ODL</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 bg-[#34d399]" />RLUSD</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 bg-[#475569]" />standard</span>
                        <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-4 bg-[#fbbf24]" />recommended path</span>
                        <span className="ml-auto font-mono text-slate-500">{rfNodes.length}n · {rfEdges.length}e</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center text-slate-500 text-sm border border-slate-800 rounded bg-slate-950/50">
                    {running ? (
                      <>
                        <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin mr-2" />
                        Agent is working...
                      </>
                    ) : (
                      "Run the agent to see the live corridor map"
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Result card ─────────────────────────────────────────────── */}
        {result && (
          <Card className="mb-4" data-testid="safe-path-result">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Final verdict
                </div>
                <CardTitle className="text-lg">
                  {result.verdict === "SAFE" &&
                    "Safe on-chain path selected"}
                  {result.verdict === "OFF_CHAIN_ROUTED" &&
                    "Off-chain route via RLUSD confirmed"}
                  {result.verdict === "REJECTED" &&
                    "All paths rejected"}
                  {result.verdict === "NO_PATHS" && "No paths found"}
                </CardTitle>
              </div>
              <div className="flex gap-2 flex-wrap">
                <VerdictBadge verdict={result.verdict} />
                {result.corridor && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigate(`/corridors/${result.corridor!.id}`)
                    }
                    data-testid="sp-view-corridor"
                  >
                    View corridor
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-950/60 border border-slate-800 rounded p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                  Compliance justification
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic">
                  {result.reasoning}
                </p>
              </div>

              {/* Analysis links */}
              {result.analysisIds && result.analysisIds.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Deep analyses ({result.analysisIds.length})
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {analysesSummary.map((a) => (
                      <Button
                        key={a.id}
                        variant="secondary"
                        className="text-xs"
                        onClick={() => navigate(`/graph/${a.id}`)}
                      >
                        View analysis: {a.label} ({a.nodeCount}n,{" "}
                        {a.edgeCount}e)
                      </Button>
                    ))}
                    {analysesSummary.length === 0 &&
                      result.analysisIds.map((id) => (
                        <Button
                          key={id}
                          variant="secondary"
                          className="text-xs"
                          onClick={() => navigate(`/graph/${id}`)}
                        >
                          View analysis: {id.slice(0, 8)}...
                        </Button>
                      ))}
                  </div>
                </div>
              )}

              {/* Corridor RAG answer */}
              {result.corridorRagAnswer && (
                <div className="bg-cyan-500/5 border border-cyan-500/30 rounded p-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-cyan-400 mb-1">
                    Corridor intelligence (RAG)
                  </div>
                  <p className="text-xs text-slate-300 whitespace-pre-wrap">
                    {result.corridorRagAnswer}
                  </p>
                </div>
              )}

              {/* Split plan */}
              {result.splitPlan && result.splitPlan.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Recommended split plan
                  </div>
                  <div className="space-y-2">
                    {result.splitPlan.map((leg, i) => (
                      <div
                        key={i}
                        className="bg-cyan-500/5 border border-cyan-500/20 rounded p-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-cyan-300">
                            {leg.percentage}%
                          </span>
                          <span className="text-xs text-slate-300">
                            {leg.description}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-1">
                          {leg.reason}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Winning path */}
              {result.winningPath && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Winning path #{result.winningPath.index} --{" "}
                    {result.winningPath.hops.length} hop(s), risk{" "}
                    {result.winningPath.riskScore}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {result.winningPath.hops.map((hop, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {i > 0 && (
                          <span className="text-slate-600">
                            -&gt;
                          </span>
                        )}
                        <div className="px-2 py-1 bg-slate-900 border border-slate-700 rounded text-[10px]">
                          <div className="text-slate-400">
                            {hop.type}
                          </div>
                          <div className="text-white font-mono">
                            {hop.currency ?? "XRP"}
                            {hop.account
                              ? ` / ${hop.account.slice(0, 6)}...`
                              : ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejected */}
              {result.rejected.length > 0 && (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
                    Rejected alternatives ({result.rejected.length})
                  </div>
                  <div className="space-y-2">
                    {result.rejected.map((r) => (
                      <div
                        key={r.pathIndex}
                        className="bg-red-500/5 border border-red-500/30 rounded p-2 text-xs"
                      >
                        <div className="text-red-300">{r.reason}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {r.flags.map((f) => (
                            <span
                              key={f}
                              className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/15 text-red-400 border border-red-500/30"
                            >
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Styled Compliance Report ──────────────────────────────── */}
        {report && (
          <div className="mb-4 max-w-[900px] mx-auto" data-testid="sp-full-report">
            {/* Report header card */}
            <div className="rounded-xl border border-slate-800 bg-[#0f172a] px-8 py-6 mb-5">
              <div className="flex justify-between items-start flex-wrap gap-3">
                <div>
                  <div className="text-[9px] font-bold tracking-[2px] uppercase text-xrp-500 mb-1">
                    CorLens Safe Path Compliance Report
                  </div>
                  <h2 className="text-xl font-bold text-white">
                    {srcCcy} &rarr; {dstCcy} &middot; {amount} {srcCcy}
                  </h2>
                </div>
                <Button
                  onClick={downloadReport}
                  variant="secondary"
                  size="sm"
                  data-testid="sp-download"
                >
                  Download .md
                </Button>
              </div>

              {result && (
                <div
                  className="mt-4 rounded-md border-l-[3px] px-4 py-3 text-[13px] leading-relaxed text-slate-400"
                  style={{
                    background: "#020617",
                    borderLeftColor:
                      result.verdict === "SAFE" || result.verdict === "OFF_CHAIN_ROUTED"
                        ? "#22c55e"
                        : result.verdict === "REJECTED"
                          ? "#ef4444"
                          : "#f59e0b",
                  }}
                >
                  {result.reasoning}
                </div>
              )}
            </div>

            {/* Section navigation */}
            {reportSections.length > 1 && (
              <div className="flex gap-2 overflow-x-auto mb-5 pb-1 sticky top-14 z-10 bg-slate-950/95 backdrop-blur py-2 px-1 -mx-1 rounded-lg">
                {reportSections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => scrollToSection(s.id)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors ${
                      activeSectionId === s.id
                        ? "bg-xrp-500/20 text-xrp-300 border-xrp-500/40"
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:text-white hover:border-slate-500"
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>
            )}

            {/* Report sections */}
            {reportSections.map((section) => (
              <div
                key={section.id}
                id={`report-section-${section.id}`}
                className="rounded-xl border border-slate-800 bg-[#0f172a] px-8 py-5 mb-5"
              >
                <h3
                  className="text-[11px] font-bold tracking-[2px] uppercase text-slate-500 mb-3 pb-2 border-b border-slate-800"
                >
                  {section.title}
                </h3>
                <div className="space-y-1">
                  {section.lines.map((line, idx) =>
                    renderMdLine(line, idx),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </PremiumGate>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function VerdictBadge({
  verdict,
}: {
  verdict: SafePathResult["verdict"];
}) {
  if (verdict === "SAFE" || verdict === "OFF_CHAIN_ROUTED") {
    return (
      <Badge variant="low">
        {verdict === "SAFE" ? "SAFE" : "ROUTED"}
      </Badge>
    );
  }
  return <Badge variant="high">{verdict}</Badge>;
}

function EventRow({ event }: { event: SafePathEvent }) {
  switch (event.type) {
    case "step":
      return (
        <div className="text-xrp-300">
          * <span className="font-semibold">{event.step}</span>
          {event.detail && (
            <span className="text-slate-400"> -- {event.detail}</span>
          )}
        </div>
      );
    case "tool_call":
      return (
        <div className="text-amber-300">
          &gt; <span className="font-semibold">{event.name}</span>
          <span className="text-slate-500">
            ({JSON.stringify(event.args)})
          </span>
        </div>
      );
    case "tool_result":
      return (
        <div className="text-emerald-300 pl-4">
          + <span className="text-slate-300">{event.summary}</span>
        </div>
      );
    case "reasoning":
      return <div className="text-slate-200 italic">{event.text}</div>;
    case "corridor_rag":
      return (
        <div className="border-l-2 border-cyan-500/50 ml-2 pl-3 py-1">
          <div className="text-cyan-300 text-[10px] uppercase tracking-wider font-semibold">
            Corridor RAG
          </div>
          <div className="text-cyan-200 text-[10px] mt-0.5">
            {event.question}
          </div>
          <div className="text-slate-300 text-[10px] mt-1 whitespace-pre-wrap">
            {event.answer.slice(0, 600)}
          </div>
        </div>
      );
    case "account_crawled":
      return (
        <div className="text-sky-300 pl-4">
          ◉ <span className="font-semibold">{event.name || event.address.slice(0, 12) + "…"}</span>
          {event.name && <span className="text-slate-500 font-mono text-[9px] ml-1">({event.address.slice(0, 8)}…)</span>}
          <span className="text-slate-400"> — {event.flags.length} flag(s), risk {event.score}</span>
          {event.reason && <span className="text-slate-500 text-[9px] ml-1">[{event.reason}]</span>}
        </div>
      );
    case "partner_depth": {
      const snap = event.snapshot as Record<string, unknown>;
      const spreadBps =
        typeof snap.spreadBps === "number"
          ? snap.spreadBps.toFixed(1)
          : "?";
      return (
        <div className="text-emerald-400 pl-4">
          o live depth: {String(snap.venue ?? "")} {String(snap.book ?? "")}{" "}
          -- {spreadBps} bps spread, {String(snap.bidDepthBase ?? "?")} XRP
          bid
        </div>
      );
    }
    case "web_search":
      return (
        <div className="pl-4">
          <div className="text-violet-300">
            search: &quot;{event.query}&quot;
          </div>
          {event.results.slice(0, 3).map((r, i) => (
            <div key={i} className="text-slate-400 pl-4 text-[10px]">
              {r}
            </div>
          ))}
        </div>
      );
    case "analysis_started":
      return (
        <div className="text-sky-300">
          * deep analysis started:{" "}
          <span className="font-semibold">{event.label}</span>
          <span className="text-slate-500 text-[10px] ml-1">
            ({event.address.slice(0, 10)}...)
          </span>
        </div>
      );
    case "analysis_complete":
      return (
        <div className="text-sky-300 pl-4">
          + analysis complete: {event.nodeCount} nodes, {event.edgeCount}{" "}
          edges
        </div>
      );
    case "analyses_summary":
      return (
        <div className="text-sky-300">
          * {event.analyses.length} deep analyses completed
        </div>
      );
    case "rag_answer":
      return (
        <div className="pl-4 border-l-2 border-cyan-500/30 ml-2">
          <div className="text-cyan-300 text-[10px] uppercase tracking-wider">
            RAG insight: {event.question}
          </div>
          <div className="text-slate-300 text-[10px] mt-0.5 whitespace-pre-wrap">
            {event.answer.slice(0, 500)}
          </div>
        </div>
      );
    case "split_plan":
      return (
        <div className="text-cyan-300">
          * split plan:{" "}
          {event.legs
            .map((l: SplitLeg) => `${l.percentage}%`)
            .join(" / ")}
        </div>
      );
    case "report":
      return (
        <div className="text-emerald-300">
          * Report generated ({event.report.length} chars)
        </div>
      );
    case "result":
      return (
        <div className="text-xrp-300 font-semibold">
          ** verdict: {event.result.verdict}
        </div>
      );
    case "error":
      return <div className="text-red-400">! {event.error}</div>;
    case "corridor_context":
      return (
        <div className="text-emerald-300">
          * corridor resolved: {event.corridor.label}
        </div>
      );
    case "corridor_update":
      return (
        <div className="text-emerald-300">
          * corridor paths updated ({event.analysis.paths.length} paths)
        </div>
      );
    case "path_active":
      return (
        <div className="text-xrp-300">
          * evaluating path #{event.pathIndex}
        </div>
      );
    case "path_rejected":
      return (
        <div className="text-red-300 pl-4">
          x path #{event.pathIndex} rejected: {event.reason}
        </div>
      );
    default:
      return null;
  }
}
