import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
} from "reactflow";
import "reactflow/dist/style.css";
import type { CorridorActor, CorridorPairDef } from "@corlens/core";

// ─── Corridor Actor Graph ────────────────────────────────────────────────
// Visualises the real-world payment path for corridors that have no direct
// on-chain XRPL trust lines (off-chain-bridge category) — and also acts as
// a companion "who handles the legs" diagram for on-chain corridors that
// happen to have a populated actor registry.
//
// Layout: 5 columns left-to-right
//   col 0: source fiat node
//   col 1: source-side actors (CEX / ODL / bank / …) stacked vertically
//   col 2: XRPL bridge asset (RLUSD by default)
//   col 3: destination-side actors
//   col 4: destination fiat node
//
// Edges:
//   source fiat → each source actor
//   each source actor → bridge (blue if actor has RLUSD support, slate otherwise)
//   bridge → each destination actor
//   each destination actor → destination fiat
//
// ODL / RLUSD support is surfaced both as node badges and as edge colour.

const COLORS = {
  fiat: "#0ea5e9",
  bridge: "#10b981",
  actorOdl: "#38bdf8",
  actorRlusd: "#34d399",
  actorCex: "#94a3b8",
  actorBank: "#a78bfa",
  actorHub: "#22d3ee",
  actorMobile: "#fbbf24",
  edge: "#475569",
  edgeStrong: "#0ea5e9",
  edgeRlusd: "#10b981",
};

const ACTOR_FILL: Record<CorridorActor["type"], string> = {
  cex: "#1e293b",
  odl: "#0c4a6e",
  bank: "#3b0764",
  custodian: "#3b0764",
  hub: "#083344",
  remittance: "#064e3b",
  fintech: "#134e4a",
  "mobile-money": "#713f12",
  otc: "#701a75",
  p2p: "#881337",
};

const ACTOR_BORDER: Record<CorridorActor["type"], string> = {
  cex: "#475569",
  odl: "#38bdf8",
  bank: "#a78bfa",
  custodian: "#a78bfa",
  hub: "#22d3ee",
  remittance: "#34d399",
  fintech: "#2dd4bf",
  "mobile-money": "#fbbf24",
  otc: "#e879f9",
  p2p: "#f43f5e",
};

export interface CorridorActorGraphProps {
  corridor: CorridorPairDef;
  height?: number;
}

interface LayoutConfig {
  colX: number[]; // x position per column
  rowGapActor: number;
  actorNodeW: number;
  actorNodeH: number;
  fiatNodeW: number;
  fiatNodeH: number;
  bridgeNodeW: number;
  bridgeNodeH: number;
  topPad: number;
}

const LAYOUT: LayoutConfig = {
  colX: [40, 280, 560, 820, 1080],
  rowGapActor: 72,
  actorNodeW: 220,
  actorNodeH: 56,
  fiatNodeW: 180,
  fiatNodeH: 80,
  bridgeNodeW: 220,
  bridgeNodeH: 88,
  topPad: 40,
};

function actorLabel(a: CorridorActor): string {
  const tags: string[] = [];
  if (a.odl) tags.push("ODL");
  if (a.supportsRlusd) tags.push("RLUSD");
  if (a.supportsXrp) tags.push("XRP");
  const suffix = tags.length > 0 ? `  ·  ${tags.join(" · ")}` : "";
  const country = a.country ? `  [${a.country}]` : "";
  return `${a.name}${country}${suffix}`;
}

function buildGraph(corridor: CorridorPairDef): { nodes: Node[]; edges: Edge[] } {
  const src = corridor.sourceActors ?? [];
  const dst = corridor.destActors ?? [];
  const bridge = corridor.bridgeAsset ?? "RLUSD";

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Column heights — centre each column around the tallest (max actor
  // count). This keeps the fiat and bridge nodes vertically aligned with
  // the middle of the actor stacks.
  const maxActors = Math.max(src.length, dst.length, 1);
  const totalHeight = LAYOUT.topPad + maxActors * LAYOUT.rowGapActor + 40;

  const centerY = LAYOUT.topPad + ((maxActors - 1) * LAYOUT.rowGapActor) / 2;

  // ── Source fiat node (col 0) ──
  nodes.push({
    id: "src-fiat",
    position: {
      x: LAYOUT.colX[0],
      y: centerY - LAYOUT.fiatNodeH / 2 + LAYOUT.actorNodeH / 2,
    },
    data: {
      label: (
        <div className="flex flex-col items-center justify-center px-2 py-1">
          <div className="text-2xl leading-none">{corridor.source.flag}</div>
          <div className="mt-1 font-mono text-sm font-bold text-sky-300">
            {corridor.source.symbol}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-slate-500">
            {corridor.source.label ?? corridor.source.symbol}
          </div>
        </div>
      ),
    },
    style: {
      width: LAYOUT.fiatNodeW,
      height: LAYOUT.fiatNodeH,
      background: "#0f172a",
      border: `2px solid ${COLORS.fiat}`,
      borderRadius: 12,
      boxShadow: "0 0 24px rgba(14,165,233,0.25)",
      padding: 0,
    },
    sourcePosition: "right" as any,
    targetPosition: "left" as any,
    selectable: false,
  });

  // ── Source actor nodes (col 1) ──
  src.forEach((actor, i) => {
    const y = LAYOUT.topPad + i * LAYOUT.rowGapActor;
    const id = `src-actor-${actor.key}`;
    nodes.push({
      id,
      position: { x: LAYOUT.colX[1], y },
      data: {
        label: (
          <div className="flex flex-col px-2 py-1 text-left">
            <div className="flex items-center gap-1 truncate">
              <span className="font-semibold text-white text-[11px] truncate">
                {actor.name}
              </span>
              {actor.country && (
                <span className="ml-auto font-mono text-[9px] text-slate-500">
                  {actor.country}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider">
              <span className="text-slate-500">{actor.type}</span>
              {actor.odl && (
                <span className="rounded bg-sky-500/20 px-1 text-sky-300 font-bold">
                  ODL
                </span>
              )}
              {actor.supportsRlusd && (
                <span className="rounded bg-emerald-500/20 px-1 text-emerald-300 font-bold">
                  RLUSD
                </span>
              )}
              {actor.supportsXrp && (
                <span className="rounded bg-amber-500/20 px-1 text-amber-300 font-bold">
                  XRP
                </span>
              )}
            </div>
          </div>
        ),
      },
      style: {
        width: LAYOUT.actorNodeW,
        height: LAYOUT.actorNodeH,
        background: ACTOR_FILL[actor.type] ?? "#1e293b",
        border: `1.5px solid ${ACTOR_BORDER[actor.type] ?? "#475569"}`,
        borderRadius: 8,
        padding: 0,
      },
      sourcePosition: "right" as any,
      targetPosition: "left" as any,
      selectable: false,
    });
    // Edge: fiat → actor
    edges.push({
      id: `e-srcfiat-${actor.key}`,
      source: "src-fiat",
      target: id,
      type: "smoothstep",
      animated: true,
      style: { stroke: COLORS.edge, strokeWidth: 1.2 },
    });
    // Edge: actor → bridge
    edges.push({
      id: `e-${actor.key}-bridge`,
      source: id,
      target: "bridge",
      type: "smoothstep",
      animated: actor.supportsRlusd || actor.odl,
      style: {
        stroke: actor.supportsRlusd
          ? COLORS.edgeRlusd
          : actor.odl
            ? COLORS.edgeStrong
            : COLORS.edge,
        strokeWidth: actor.supportsRlusd || actor.odl ? 2 : 1.2,
      },
    });
  });

  // ── Bridge node (col 2) ──
  nodes.push({
    id: "bridge",
    position: {
      x: LAYOUT.colX[2],
      y: centerY - LAYOUT.bridgeNodeH / 2 + LAYOUT.actorNodeH / 2,
    },
    data: {
      label: (
        <div className="flex flex-col items-center justify-center px-3 py-2">
          <div className="text-[9px] uppercase tracking-widest text-emerald-400/80">
            XRPL hop
          </div>
          <div className="mt-1 font-mono text-base font-bold text-emerald-300">
            {bridge}
          </div>
          <div className="mt-0.5 text-[9px] text-slate-400 text-center leading-tight">
            {bridge === "RLUSD"
              ? "Ripple USD (NYDFS)"
              : bridge === "USDC"
                ? "Circle USDC (native)"
                : bridge === "XRP"
                  ? "XRP bridge asset"
                  : "XRPL native asset"}
          </div>
        </div>
      ),
    },
    style: {
      width: LAYOUT.bridgeNodeW,
      height: LAYOUT.bridgeNodeH,
      background: "#042f2e",
      border: `2px solid ${COLORS.bridge}`,
      borderRadius: 14,
      boxShadow: "0 0 30px rgba(16,185,129,0.35)",
      padding: 0,
    },
    sourcePosition: "right" as any,
    targetPosition: "left" as any,
    selectable: false,
  });

  // ── Destination actor nodes (col 3) ──
  dst.forEach((actor, i) => {
    const y = LAYOUT.topPad + i * LAYOUT.rowGapActor;
    const id = `dst-actor-${actor.key}`;
    nodes.push({
      id,
      position: { x: LAYOUT.colX[3], y },
      data: {
        label: (
          <div className="flex flex-col px-2 py-1 text-left">
            <div className="flex items-center gap-1 truncate">
              <span className="font-semibold text-white text-[11px] truncate">
                {actor.name}
              </span>
              {actor.country && (
                <span className="ml-auto font-mono text-[9px] text-slate-500">
                  {actor.country}
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider">
              <span className="text-slate-500">{actor.type}</span>
              {actor.odl && (
                <span className="rounded bg-sky-500/20 px-1 text-sky-300 font-bold">
                  ODL
                </span>
              )}
              {actor.supportsRlusd && (
                <span className="rounded bg-emerald-500/20 px-1 text-emerald-300 font-bold">
                  RLUSD
                </span>
              )}
              {actor.supportsXrp && (
                <span className="rounded bg-amber-500/20 px-1 text-amber-300 font-bold">
                  XRP
                </span>
              )}
            </div>
          </div>
        ),
      },
      style: {
        width: LAYOUT.actorNodeW,
        height: LAYOUT.actorNodeH,
        background: ACTOR_FILL[actor.type] ?? "#1e293b",
        border: `1.5px solid ${ACTOR_BORDER[actor.type] ?? "#475569"}`,
        borderRadius: 8,
        padding: 0,
      },
      sourcePosition: "right" as any,
      targetPosition: "left" as any,
      selectable: false,
    });
    // Edge: bridge → actor
    edges.push({
      id: `e-bridge-${actor.key}`,
      source: "bridge",
      target: id,
      type: "smoothstep",
      animated: actor.supportsRlusd || actor.odl,
      style: {
        stroke: actor.supportsRlusd
          ? COLORS.edgeRlusd
          : actor.odl
            ? COLORS.edgeStrong
            : COLORS.edge,
        strokeWidth: actor.supportsRlusd || actor.odl ? 2 : 1.2,
      },
    });
    // Edge: actor → dest fiat
    edges.push({
      id: `e-${actor.key}-dstfiat`,
      source: id,
      target: "dst-fiat",
      type: "smoothstep",
      animated: true,
      style: { stroke: COLORS.edge, strokeWidth: 1.2 },
    });
  });

  // ── Destination fiat node (col 4) ──
  nodes.push({
    id: "dst-fiat",
    position: {
      x: LAYOUT.colX[4],
      y: centerY - LAYOUT.fiatNodeH / 2 + LAYOUT.actorNodeH / 2,
    },
    data: {
      label: (
        <div className="flex flex-col items-center justify-center px-2 py-1">
          <div className="text-2xl leading-none">{corridor.dest.flag}</div>
          <div className="mt-1 font-mono text-sm font-bold text-amber-300">
            {corridor.dest.symbol}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-slate-500">
            {corridor.dest.label ?? corridor.dest.symbol}
          </div>
        </div>
      ),
    },
    style: {
      width: LAYOUT.fiatNodeW,
      height: LAYOUT.fiatNodeH,
      background: "#0f172a",
      border: `2px solid ${"#f59e0b"}`,
      borderRadius: 12,
      boxShadow: "0 0 24px rgba(245,158,11,0.25)",
      padding: 0,
    },
    sourcePosition: "right" as any,
    targetPosition: "left" as any,
    selectable: false,
  });

  return { nodes, edges };
}

// ─── Legend config ───────────────────────────────────────────────────────
// The graph uses colour to communicate two things: node type (actor role)
// and edge role (RLUSD / ODL / other). The legend below mirrors those
// mappings exactly so the user can cross-reference without guessing.

interface NodeLegendEntry {
  label: string;
  fill: string;
  border: string;
  // Short explanation shown on hover/tooltip.
  title: string;
}

const NODE_LEGEND: NodeLegendEntry[] = [
  { label: "source fiat", fill: "#0f172a", border: "#0ea5e9", title: "Source currency (sky ring)" },
  { label: "bridge", fill: "#042f2e", border: "#10b981", title: "XRPL bridge asset — RLUSD / USDC / XRP (emerald ring)" },
  { label: "dest fiat", fill: "#0f172a", border: "#f59e0b", title: "Destination currency (amber ring)" },
  { label: "CEX", fill: ACTOR_FILL.cex, border: ACTOR_BORDER.cex, title: "Licensed centralised exchange" },
  { label: "ODL", fill: ACTOR_FILL.odl, border: ACTOR_BORDER.odl, title: "Ripple ODL / Ripple Payments partner" },
  { label: "bank", fill: ACTOR_FILL.bank, border: ACTOR_BORDER.bank, title: "Bank or qualified custodian" },
  { label: "hub", fill: ACTOR_FILL.hub, border: ACTOR_BORDER.hub, title: "Cross-country ODL super-hub (Tranglo, Onafriq, …)" },
  { label: "remittance", fill: ACTOR_FILL.remittance, border: ACTOR_BORDER.remittance, title: "Remittance operator" },
  { label: "fintech", fill: ACTOR_FILL.fintech, border: ACTOR_BORDER.fintech, title: "E-money / BaaS / card fintech" },
  { label: "mobile-money", fill: ACTOR_FILL["mobile-money"], border: ACTOR_BORDER["mobile-money"], title: "Mobile-money bridge (M-Pesa / MTN / Orange)" },
  { label: "OTC", fill: ACTOR_FILL.otc, border: ACTOR_BORDER.otc, title: "OTC desk / institutional market-maker" },
  { label: "P2P", fill: ACTOR_FILL.p2p, border: ACTOR_BORDER.p2p, title: "Peer-to-peer venue" },
];

interface EdgeLegendEntry {
  label: string;
  color: string;
  title: string;
}

const EDGE_LEGEND: EdgeLegendEntry[] = [
  { label: "RLUSD leg", color: COLORS.edgeRlusd, title: "Actor holds RLUSD on XRPL — the preferred bridge leg" },
  { label: "ODL leg", color: COLORS.edgeStrong, title: "Ripple ODL partner — bridges via XRP if no RLUSD" },
  { label: "other leg", color: COLORS.edge, title: "Fiat rail from/to the actor; not an XRPL hop" },
];

function NodeDot({ entry }: { entry: NodeLegendEntry }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-sm flex-shrink-0"
      style={{
        background: entry.fill,
        border: `1.5px solid ${entry.border}`,
      }}
    />
  );
}

function EdgeDot({ entry }: { entry: EdgeLegendEntry }) {
  return (
    <span
      className="inline-block h-[2px] w-4 flex-shrink-0"
      style={{ background: entry.color }}
    />
  );
}

export function CorridorActorGraph({
  corridor,
  height = 480,
}: CorridorActorGraphProps) {
  const { nodes, edges } = useMemo(() => buildGraph(corridor), [corridor]);
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg border border-slate-800"
      style={{ height, background: "#020617" }}
      data-testid="corridor-actor-graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.1 }}
        panOnDrag
        zoomOnScroll={false}
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="#1e293b"
        />
      </ReactFlow>

      {/* Top-left: path caption */}
      <div className="pointer-events-none absolute top-3 left-4 text-[9px] font-mono uppercase tracking-[0.25em] text-slate-500">
        Real-world path via {corridor.bridgeAsset ?? "RLUSD"} on XRPL
      </div>

      {/* Legend bar: docked to the bottom of the graph container, spans
          the full width with a subtle backdrop so it's readable over the
          dotted background without stealing focus from the graph. Two
          rows: node types + edge types. */}
      <div
        data-testid="corridor-actor-graph-legend"
        className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-slate-800/80 bg-black/60 backdrop-blur-md px-4 py-2"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500 mr-1">
            Nodes
          </span>
          {NODE_LEGEND.map((n) => (
            <span
              key={n.label}
              title={n.title}
              className="flex items-center gap-1 text-[10px] text-slate-300"
              data-testid={`legend-node-${n.label.replace(/\s+/g, "-")}`}
            >
              <NodeDot entry={n} />
              <span className="font-mono lowercase">{n.label}</span>
            </span>
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500 mr-1">
            Edges
          </span>
          {EDGE_LEGEND.map((e) => (
            <span
              key={e.label}
              title={e.title}
              className="flex items-center gap-1 text-[10px] text-slate-300"
              data-testid={`legend-edge-${e.label.replace(/\s+/g, "-")}`}
            >
              <EdgeDot entry={e} />
              <span className="font-mono lowercase">{e.label}</span>
            </span>
          ))}
          <span className="ml-auto text-[9px] font-mono text-slate-600">
            ({corridor.sourceActors?.length ?? 0} src · {corridor.destActors?.length ?? 0} dst)
          </span>
        </div>
      </div>
    </div>
  );
}
