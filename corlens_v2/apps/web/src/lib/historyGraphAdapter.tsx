// corlens/apps/web/src/lib/historyGraphAdapter.tsx
//
// Translates HistoryNode / HistoryEdge (produced by the server SSE stream)
// into ReactFlow Node[] / Edge[] using the same color palette as the main
// CorLens analyze graph, plus a concentric-ring radial layout so the graph
// reads as a clean network instead of a vertical pillar.
//
// Layout strategy:
//   - Seed sits at (0, 0).
//   - Every depth owns a clearly-separated zone: primary ring + satellite
//     ring + soft coloured halo background. No depth can ever overlap
//     another depth because each zone has a radial budget with built-in gap.
//   - Primaries of a given depth are placed evenly on that depth's primary
//     ring, sorted by kind so same-type nodes cluster together.
//   - Expansion children for each primary are placed on the same depth's
//     satellite ring, clustered angularly near their parent in that
//     parent's owned slice of the ring.
//
// Colours mirror `NODE_COLORS` / `EDGE_COLORS` from @corlens/core so the
// history page "feels" like the analyze page.

import type React from "react";
import type { Edge, Node, ReactFlowState } from "reactflow";
import { MarkerType, Position, useStore } from "reactflow";
import { EDGE_COLORS as CORE_EDGE_COLORS, NODE_COLORS as CORE_NODE_COLORS } from "./core-types.js";
import type { HistoryEdge, HistoryNode, NodeKind } from "./historyTypes";

// Selector picks the current viewport transform from the ReactFlow store so
// our background SVG can apply the same pan + zoom as the node layer.
const transformSelector = (state: ReactFlowState) => state.transform;

// ─── Color palette ────────────────────────────────────────────────────────
//
// Borders are sourced from @corlens/core NODE_COLORS / EDGE_COLORS so the
// history page uses the exact same swatches as the main analyze graph:
//   issuer        → CORE_NODE_COLORS.issuer
//   amm           → CORE_NODE_COLORS.ammPool
//   escrow_dest   → CORE_NODE_COLORS.escrow
//   check_dest    → CORE_NODE_COLORS.check
//   channel_dest  → CORE_NODE_COLORS.payChannel
//   multisig_member → CORE_NODE_COLORS.signerList
//   account_light → CORE_NODE_COLORS.account
//
// "seed" is history-only (the focal point) — gold so it's unmistakable.
// Labels match the vocabulary used by components/graph/Legend.tsx.

interface NodeColor {
  border: string;
  bg: string;
  accent: string; // lighter tint for header bar and accents
  label: string;
}

const NODE_COLORS: Record<NodeKind, NodeColor> = {
  seed: {
    border: "#f59e0b",
    bg: "#0f172a",
    accent: "#fbbf24",
    label: "SEED",
  },
  amm: {
    border: CORE_NODE_COLORS.ammPool,
    bg: "#0f172a",
    accent: "#60a5fa",
    label: "AMM POOL",
  },
  issuer: {
    border: CORE_NODE_COLORS.issuer,
    bg: "#0f172a",
    accent: "#f87171",
    label: "ISSUER",
  },
  multisig_member: {
    border: CORE_NODE_COLORS.signerList,
    bg: "#0f172a",
    accent: "#94a3b8",
    label: "SIGNER LIST",
  },
  escrow_dest: {
    border: CORE_NODE_COLORS.escrow,
    bg: "#0f172a",
    accent: "#fb923c",
    label: "ESCROW",
  },
  check_dest: {
    border: CORE_NODE_COLORS.check,
    bg: "#0f172a",
    accent: "#f472b6",
    label: "CHECK",
  },
  channel_dest: {
    border: CORE_NODE_COLORS.payChannel,
    bg: "#0f172a",
    accent: "#2dd4bf",
    label: "PAYMENT CHANNEL",
  },
  account_light: {
    border: CORE_NODE_COLORS.account,
    bg: "#0b1220",
    accent: "#94a3b8",
    label: "ACCOUNT",
  },
};

// Edge color lookup keyed on the XRPL TransactionType / semantic edge label.
// Each branch maps back to a @corlens/core EDGE_COLORS swatch so trustlines,
// AMM deposits, offers, escrows, etc. are drawn with exactly the same colors
// as the main analyze graph. Falls back to a soft slate if the type is
// unknown.
function edgeColor(txType: string): string {
  const t = txType.toLowerCase();
  if (t.startsWith("trust")) return CORE_EDGE_COLORS.TRUSTS;
  if (t.startsWith("payment")) return CORE_EDGE_COLORS.ROUTES_THROUGH; // green cash movement
  if (
    t.startsWith("ammdeposit") ||
    t.startsWith("ammwithdraw") ||
    t.startsWith("ammvote") ||
    t.startsWith("ammbid") ||
    t === "lp holder"
  )
    return CORE_EDGE_COLORS.PROVIDES_LIQUIDITY;
  if (t.startsWith("offer") || t.startsWith("offer (ask)") || t.startsWith("offer (bid)"))
    return CORE_EDGE_COLORS.TRADES_ON;
  if (t.startsWith("escrow")) return CORE_EDGE_COLORS.ESCROWS_TO;
  if (t.startsWith("check")) return CORE_EDGE_COLORS.CHECKS_TO;
  if (t.startsWith("paymentchannel")) return CORE_EDGE_COLORS.CHANNELS_TO;
  if (t.startsWith("signer")) return CORE_EDGE_COLORS.SIGNED_BY;
  if (t.startsWith("nft")) return CORE_EDGE_COLORS.OWNS_NFT;
  return "#475569";
}

function shortAddr(addr: string): string {
  if (!addr || addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ─── Radial layout ────────────────────────────────────────────────────────

interface Pos {
  x: number;
  y: number;
}

// Radii + colors for every depth present in the graph. Exported so the
// History page can render a coloured background ring layer that matches
// the node positions exactly.
export interface DepthRingConfig {
  depth: number;
  /** Radius of the primary node ring at this depth (where issuers/AMMs sit). */
  primaryRadius: number;
  /** Radius of the satellite ring where this depth's expansion children sit. */
  satelliteRadius: number;
  /** Outer edge of this depth's "zone" used to draw the background halo. */
  outerRadius: number;
  /** Inner edge of this depth's zone. */
  innerRadius: number;
  /** Colour used for the ring halo and label at this depth. */
  color: string;
  /** Human label shown next to the ring ("Direct counterparties", etc). */
  label: string;
}

// Fixed radii. Depth zones are well separated so a parent's satellite halo
// can never cross into the next depth's primary ring, regardless of how many
// children it has. Each zone is a 500-pixel wide annulus around its primary
// ring, with a 200px gap between zones.
const SEED_ZONE_OUTER = 180;
const DEPTH_BASE_RADIUS = 420; // first depth primary ring
const DEPTH_PRIMARY_SATELLITE_GAP = 360; // from primary to its satellite ring
const DEPTH_ZONE_HALF_WIDTH = 460; // distance from primary ring to zone edges (both sides)
const DEPTH_INTER_GAP = 220; // padding between successive depth zones

function buildDepthConfigs(depths: number[]): Map<number, DepthRingConfig> {
  const configs = new Map<number, DepthRingConfig>();
  const palette: Array<{ color: string; label: string }> = [
    { color: "#0ea5e9", label: "Direct counterparties" }, // sky-500
    { color: "#8b5cf6", label: "Second hop" }, // violet-500
    { color: "#ec4899", label: "Third hop" }, // pink-500
    { color: "#22c55e", label: "Fourth hop" }, // green-500
  ];

  let prevOuter = SEED_ZONE_OUTER;
  for (const d of depths) {
    // Primary ring is positioned so the zone (primary ± halfWidth) starts
    // just outside the previous zone.
    const innerRadius = prevOuter + DEPTH_INTER_GAP;
    const primaryRadius = Math.max(
      DEPTH_BASE_RADIUS + (d - 1) * (DEPTH_ZONE_HALF_WIDTH * 2 + DEPTH_INTER_GAP),
      innerRadius + (DEPTH_ZONE_HALF_WIDTH - DEPTH_PRIMARY_SATELLITE_GAP / 2),
    );
    const satelliteRadius = primaryRadius + DEPTH_PRIMARY_SATELLITE_GAP / 2;
    const outerRadius = primaryRadius + DEPTH_ZONE_HALF_WIDTH;
    const realInner = primaryRadius - DEPTH_ZONE_HALF_WIDTH;
    const paletteEntry = palette[(d - 1) % palette.length];
    configs.set(d, {
      depth: d,
      primaryRadius,
      satelliteRadius,
      outerRadius,
      innerRadius: realInner,
      color: paletteEntry.color,
      label: `L${d} · ${paletteEntry.label}`,
    });
    prevOuter = outerRadius;
  }
  return configs;
}

export interface LayoutResult {
  positions: Map<string, Pos>;
  depthConfigs: DepthRingConfig[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

export function computeLayout(nodes: HistoryNode[]): LayoutResult {
  const positions = new Map<string, Pos>();

  // 1. Partition: seed, primaries (no parentId), and expansion children (with parentId).
  let seed: HistoryNode | undefined;
  const primaries: HistoryNode[] = [];
  const childrenByParent = new Map<string, HistoryNode[]>();

  for (const n of nodes) {
    if (n.kind === "seed") {
      seed = n;
    } else if (n.parentId) {
      const bucket = childrenByParent.get(n.parentId) ?? [];
      bucket.push(n);
      childrenByParent.set(n.parentId, bucket);
    } else {
      primaries.push(n);
    }
  }

  // 2. Seed at origin.
  if (seed) positions.set(seed.id, { x: 0, y: 0 });

  // 3. Group primaries by depth and sort each bucket by kind so same-kind
  //    nodes cluster together on the ring.
  const kindOrder: Record<string, number> = {
    amm: 0,
    issuer: 1,
    multisig_member: 2,
    escrow_dest: 3,
    check_dest: 4,
    channel_dest: 5,
    account_light: 6,
  };

  const primariesByDepth = new Map<number, HistoryNode[]>();
  for (const p of primaries) {
    const bucket = primariesByDepth.get(p.depth) ?? [];
    bucket.push(p);
    primariesByDepth.set(p.depth, bucket);
  }
  for (const [, bucket] of primariesByDepth) {
    bucket.sort((a, b) => (kindOrder[a.kind] ?? 99) - (kindOrder[b.kind] ?? 99));
  }

  // 4. Build depth ring configs. If primary count at a depth is very large,
  //    the ring radius needs to grow so primaries don't collide on the arc.
  const sortedDepths = Array.from(primariesByDepth.keys()).sort((a, b) => a - b);
  const depthConfigs = buildDepthConfigs(sortedDepths);

  // Enforce a minimum arc length per primary so they never overlap on the
  // ring, potentially pushing the primary ring outward.
  const arcPerPrimary = 280;
  for (const [depth, config] of depthConfigs) {
    const bucket = primariesByDepth.get(depth) ?? [];
    const count = bucket.length;
    if (count > 0) {
      const minRadius = (count * arcPerPrimary) / (2 * Math.PI);
      if (minRadius > config.primaryRadius) {
        const delta = minRadius - config.primaryRadius;
        config.primaryRadius += delta;
        config.satelliteRadius += delta;
        config.outerRadius += delta;
        config.innerRadius += delta;
      }
    }
  }

  // 5. Place primaries evenly on their depth ring.
  for (const [depth, bucket] of primariesByDepth) {
    const config = depthConfigs.get(depth)!;
    const count = bucket.length;
    bucket.forEach((p, i) => {
      const angle = count === 1 ? -Math.PI / 2 : (2 * Math.PI * i) / count - Math.PI / 2;
      positions.set(p.id, {
        x: config.primaryRadius * Math.cos(angle),
        y: config.primaryRadius * Math.sin(angle),
      });
    });
  }

  // 6. Place expansion children for each parent on the parent's depth
  //    satellite ring. Children cluster angularly near their parent, with
  //    multi-sub-ring stacking when there are too many children to fit in
  //    the parent's angular window.
  for (const [parentId, children] of childrenByParent) {
    const parentPos = positions.get(parentId);
    if (!parentPos) continue;
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) continue;
    const config = depthConfigs.get(parent.depth);
    if (!config) continue;

    const parentAngle = Math.atan2(parentPos.y, parentPos.x);

    // Angular window each parent owns on the satellite ring. Equal slice of
    // the ring, capped so very small graphs don't give one parent a huge arc.
    const primaryCount = primariesByDepth.get(parent.depth)?.length ?? 1;
    const fullSlice = (2 * Math.PI) / primaryCount;
    const arcWindow = Math.min(fullSlice * 0.85, Math.PI / 2); // max 90° per parent
    const half = arcWindow / 2;

    // Arc length available to each sub-ring, vs. space one satellite needs
    const minSatelliteSpacing = 90; // px
    const childRingGap = 110; // radial gap between sub-rings
    const childCount = children.length;

    // How many sub-rings do we need?
    let ringIdx = 0;
    let placed = 0;
    while (placed < childCount) {
      const currentR = config.satelliteRadius + ringIdx * childRingGap;
      const arcLength = currentR * arcWindow;
      const perRing = Math.max(1, Math.floor(arcLength / minSatelliteSpacing));
      const remaining = childCount - placed;
      const thisRing = Math.min(perRing, remaining);

      for (let i = 0; i < thisRing; i++) {
        const t = thisRing === 1 ? 0.5 : i / (thisRing - 1);
        const angle = parentAngle - half + t * arcWindow;
        const c = children[placed + i];
        positions.set(c.id, {
          x: currentR * Math.cos(angle),
          y: currentR * Math.sin(angle),
        });
      }
      placed += thisRing;
      ringIdx += 1;
      // Safety cap to prevent a pathological parent from spawning infinite
      // sub-rings that crash into the next depth zone.
      if (ringIdx > 5) break;
    }
  }

  // 7. Compute bounds for the caller.
  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  // 8. Tighten each depth config's inner/outer radius to the actual node
  //    extent we ended up with, so the background halo hugs the nodes
  //    instead of stopping short or overshooting.
  //
  //    For each depth: innerRadius = min distance from origin of any node
  //    at that depth (or at that depth's primary ring, whichever is
  //    smaller), outerRadius = max distance from origin of any node
  //    attached to that depth (primary or satellite child).
  const depthMinR = new Map<number, number>();
  const depthMaxR = new Map<number, number>();
  for (const n of nodes) {
    if (n.kind === "seed") continue;
    const pos = positions.get(n.id);
    if (!pos) continue;
    // For satellite children we attribute them to their parent's depth.
    let depth = n.depth;
    if (n.parentId) {
      const parent = nodes.find((x) => x.id === n.parentId);
      if (parent) depth = parent.depth;
    }
    const r = Math.hypot(pos.x, pos.y);
    const curMin = depthMinR.get(depth);
    const curMax = depthMaxR.get(depth);
    if (curMin === undefined || r < curMin) depthMinR.set(depth, r);
    if (curMax === undefined || r > curMax) depthMaxR.set(depth, r);
  }
  for (const [depth, config] of depthConfigs) {
    const minR = depthMinR.get(depth);
    const maxR = depthMaxR.get(depth);
    if (minR !== undefined) {
      config.innerRadius = Math.max(0, minR - 80);
    }
    if (maxR !== undefined) {
      config.outerRadius = maxR + 120;
    }
  }

  return {
    positions,
    depthConfigs: Array.from(depthConfigs.values()),
    bounds: { minX, minY, maxX, maxY },
  };
}

// ─── Node builder ─────────────────────────────────────────────────────────

/**
 * Compute layout + return ReactFlow-ready nodes. Also returns the depth
 * ring configs so the caller can render a background ring layer that
 * matches the node positions.
 */
export function adaptHistoryGraph(
  nodes: HistoryNode[],
  selectedId?: string,
): { nodes: Node[]; depthConfigs: DepthRingConfig[] } {
  const layout = computeLayout(nodes);
  const positions = layout.positions;
  const rfNodes = buildRFNodes(nodes, positions, selectedId);
  return { nodes: rfNodes, depthConfigs: layout.depthConfigs };
}

// Legacy wrapper kept for backward compatibility with any callers still
// using the old one-returner API.
export function adaptHistoryNodes(nodes: HistoryNode[], selectedId?: string): Node[] {
  return adaptHistoryGraph(nodes, selectedId).nodes;
}

function buildRFNodes(
  nodes: HistoryNode[],
  positions: Map<string, Pos>,
  selectedId?: string,
): Node[] {
  return nodes.map((n) => {
    const colors = NODE_COLORS[n.kind];
    const pos = positions.get(n.id) ?? { x: 0, y: 0 };
    const isSelected = n.id === selectedId;
    const isSeed = n.kind === "seed";
    const isLight = n.kind === "account_light";
    const isPending = n.crawlStatus === "pending";
    const isError = n.crawlStatus === "error";

    const width = isSeed ? 170 : isLight ? 100 : 150;

    return {
      id: n.id,
      type: "default",
      position: pos,
      data: {
        label: (
          <div
            style={{
              borderRadius: 10,
              background: colors.bg,
              border: `${isSelected ? 2.5 : 1.5}px solid ${
                isSelected
                  ? "#f8fafc"
                  : isError
                    ? "#ef4444"
                    : colors.border + (isLight ? "80" : "cc")
              }`,
              boxShadow: isSelected
                ? `0 0 18px ${colors.border}80`
                : isSeed
                  ? `0 0 22px ${colors.border}40`
                  : isLight
                    ? "none"
                    : `0 0 10px ${colors.border}22`,
              overflow: "hidden",
              width,
              opacity: isPending ? 0.55 : 1,
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            {/* Header bar */}
            <div
              style={{
                background: `${colors.border}22`,
                borderBottom: `1px solid ${colors.border}40`,
                padding: "4px 8px",
                fontSize: isSeed ? 9 : 8,
                fontWeight: 800,
                letterSpacing: 1.2,
                color: colors.accent,
                textTransform: "uppercase",
                textAlign: "center",
                borderStyle: isPending ? "dashed" : "solid",
              }}
            >
              {colors.label}
              {isPending && " · pending"}
              {isError && " · error"}
            </div>

            {/* Body */}
            <div
              style={{
                padding: "6px 8px 7px",
                display: "flex",
                flexDirection: "column",
                gap: 3,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: isSeed ? 11 : 10,
                  color: "#e2e8f0",
                  fontWeight: 600,
                }}
              >
                {n.label ?? shortAddr(n.address)}
              </div>
              {n.txCount > 0 && !isSeed && (
                <div style={{ fontSize: 8, color: "#64748b" }}>{n.txCount} tx</div>
              )}
              {isSeed && (
                <div style={{ fontSize: 9, color: "#94a3b8" }}>{n.txCount} tx in window</div>
              )}
              {n.riskFlags && n.riskFlags.length > 0 && (
                <div
                  style={{
                    fontSize: 8,
                    color: "#ef4444",
                    fontWeight: 700,
                    marginTop: 1,
                  }}
                >
                  ⚠ {n.riskFlags.length} flag{n.riskFlags.length > 1 ? "s" : ""}
                </div>
              )}
            </div>
          </div>
        ),
      },
      style: {
        background: "transparent",
        border: "none",
        padding: 0,
        width,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      draggable: true,
    };
  });
}

// ─── Edge builder ─────────────────────────────────────────────────────────

export function adaptHistoryEdges(edges: HistoryEdge[]): Edge[] {
  return edges.map((e) => {
    const color = edgeColor(e.txType);
    const width = Math.min(5, 0.8 + Math.log2(e.count + 1));
    return {
      id: e.id,
      source: e.from,
      target: e.to,
      type: "default",
      label: `${e.txType} ×${e.count}`,
      labelStyle: { fill: "#cbd5e1", fontSize: 9, fontWeight: 600 },
      labelBgStyle: { fill: "#020617", opacity: 0.88 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
      style: {
        stroke: color,
        strokeWidth: width,
        opacity: 0.75,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color,
        width: 12,
        height: 12,
      },
      animated: false,
    };
  });
}

// ─── Legend metadata (re-exported so History.tsx can render a legend) ─────

// Legend entries use the same labels as components/graph/Legend.tsx so the
// history page and the analyze page speak the same vocabulary ("Issuer",
// "AMM Pool", "Signer List", "Payment Channel", "Account", etc.).
export const HISTORY_LEGEND = [
  { key: "seed", label: "Seed", color: NODE_COLORS.seed.border },
  { key: "amm", label: "AMM Pool", color: NODE_COLORS.amm.border },
  { key: "issuer", label: "Issuer", color: NODE_COLORS.issuer.border },
  { key: "multisig_member", label: "Signer List", color: NODE_COLORS.multisig_member.border },
  { key: "escrow_dest", label: "Escrow", color: NODE_COLORS.escrow_dest.border },
  { key: "check_dest", label: "Check", color: NODE_COLORS.check_dest.border },
  { key: "channel_dest", label: "Payment Channel", color: NODE_COLORS.channel_dest.border },
  { key: "account_light", label: "Account", color: NODE_COLORS.account_light.border },
] as const;

export const HISTORY_EDGE_LEGEND = [
  { label: "Trusts", color: CORE_EDGE_COLORS.TRUSTS },
  { label: "Routes Through", color: CORE_EDGE_COLORS.ROUTES_THROUGH },
  { label: "Provides Liquidity", color: CORE_EDGE_COLORS.PROVIDES_LIQUIDITY },
  { label: "Trades On", color: CORE_EDGE_COLORS.TRADES_ON },
  { label: "Escrows To", color: CORE_EDGE_COLORS.ESCROWS_TO },
  { label: "Checks To", color: CORE_EDGE_COLORS.CHECKS_TO },
  { label: "Channels To", color: CORE_EDGE_COLORS.CHANNELS_TO },
] as const;

// ─── Background depth-ring layer ──────────────────────────────────────────
//
// Rendered inside <ReactFlowProvider>. Reads the live viewport transform
// from the ReactFlow store via `useStore(transformSelector)` and applies
// the same translate+zoom to its own SVG so the rings stay locked to the
// node layer while the user pans/zooms. Draws a soft coloured halo + inner
// and outer boundary rings + a pill label for every depth present, so the
// user can instantly read "this is level 1, this is level 2".

interface DepthRingsBackgroundProps {
  depthConfigs: DepthRingConfig[];
}

export function DepthRingsBackground({
  depthConfigs,
}: DepthRingsBackgroundProps): React.ReactElement | null {
  // Read the live viewport transform so the background ring layer pans and
  // zooms with the node layer.
  const [tx, ty, zoom] = useStore(transformSelector);

  if (depthConfigs.length === 0) return null;

  // Outer-most radius in the layout. Used so the SVG is big enough to draw
  // every ring without clipping.
  const outermost = Math.max(...depthConfigs.map((c) => c.outerRadius));
  const size = outermost * 2 + 400;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        // Just above ReactFlow's pane background + edge svg (which sit at
        // z-index 0 inside the viewport), but explicitly below the nodes
        // which ReactFlow places at z-index 1000+. Keeps the rings visible
        // as a backdrop without obscuring node cards.
        zIndex: 4,
      }}
    >
      {/*
        Two-level wrapper so our SVG ends up at the exact same screen
        position as ReactFlow's own .react-flow__viewport.

        Outer wrapper: position:absolute at the layout origin (tx, ty), with
        scale(zoom) applied and transform-origin 0 0. This mirrors how
        ReactFlow places its viewport content — a child at CSS offset (x, y)
        from this wrapper ends up at screen (tx + x*zoom, ty + y*zoom).

        Inner SVG: sized `size × size` but offset so its centre lies at the
        wrapper's origin — thanks to the wrapper's transform, SVG centre
        then ends up at screen (tx, ty), which is where the layout origin
        (0, 0) lives in ReactFlow's coordinate system.
      */}
      <div
        style={{
          position: "absolute",
          left: tx,
          top: ty,
          transform: `scale(${zoom})`,
          transformOrigin: "0 0",
        }}
      >
        <svg
          width={size}
          height={size}
          style={{
            position: "absolute",
            left: -size / 2,
            top: -size / 2,
            overflow: "visible",
          }}
        >
          <defs>
            {depthConfigs.map((cfg) => (
              <radialGradient
                key={`grad-${cfg.depth}`}
                id={`depth-grad-${cfg.depth}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={cfg.color} stopOpacity="0.0" />
                <stop offset="70%" stopColor={cfg.color} stopOpacity="0.08" />
                <stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
              </radialGradient>
            ))}
          </defs>

          {/* Central gradient around the seed */}
          <circle cx={size / 2} cy={size / 2} r={180} fill="#f59e0b" fillOpacity="0.12" />

          {/* One group per depth: halo ring + inner/outer boundary + label */}
          {depthConfigs.map((cfg) => {
            const cx = size / 2;
            const cy = size / 2;
            return (
              <g key={cfg.depth}>
                {/* Filled halo between inner and outer radius (donut via
                  evenodd fill rule on a path with two circles) */}
                <path
                  d={donutPath(cx, cy, cfg.innerRadius, cfg.outerRadius)}
                  fill={cfg.color}
                  fillOpacity="0.12"
                  fillRule="evenodd"
                />
                {/* Inner boundary — dashed line */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={cfg.innerRadius}
                  fill="none"
                  stroke={cfg.color}
                  strokeOpacity="0.7"
                  strokeWidth={4}
                  strokeDasharray="16 16"
                />
                {/* Outer boundary — glowing solid line */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={cfg.outerRadius}
                  fill="none"
                  stroke={cfg.color}
                  strokeOpacity="0.8"
                  strokeWidth={4}
                />
                {/* Primary ring — a dimmer thinner guide so the user sees
                  where the ring of primary nodes sits */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={cfg.primaryRadius}
                  fill="none"
                  stroke={cfg.color}
                  strokeOpacity="0.35"
                  strokeWidth={2}
                  strokeDasharray="6 12"
                />
                {/* Label on the top of each outer ring */}
                <g transform={`translate(${cx}, ${cy - cfg.outerRadius - 20})`}>
                  <rect
                    x={-180}
                    y={-28}
                    width={360}
                    height={48}
                    rx={24}
                    fill="#020617"
                    fillOpacity="0.95"
                    stroke={cfg.color}
                    strokeOpacity="0.9"
                    strokeWidth={3}
                  />
                  <text
                    x={0}
                    y={6}
                    textAnchor="middle"
                    fill={cfg.color}
                    style={{
                      fontSize: 22,
                      fontWeight: 800,
                      fontFamily: "Inter, system-ui, sans-serif",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                    }}
                  >
                    {cfg.label}
                  </text>
                </g>
              </g>
            );
          })}

          {/* SEED marker ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={180}
            fill="none"
            stroke="#f59e0b"
            strokeOpacity="0.8"
            strokeWidth={3}
            strokeDasharray="8 10"
          />
          <g transform={`translate(${size / 2}, ${size / 2 - 180 - 20})`}>
            <rect
              x={-120}
              y={-28}
              width={240}
              height={48}
              rx={24}
              fill="#020617"
              fillOpacity="0.95"
              stroke="#f59e0b"
              strokeOpacity="0.9"
              strokeWidth={3}
            />
            <text
              x={0}
              y={6}
              textAnchor="middle"
              fill="#fbbf24"
              style={{
                fontSize: 22,
                fontWeight: 800,
                fontFamily: "Inter, system-ui, sans-serif",
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              L0 · Seed
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// SVG path for a donut (annulus) — outer circle CW, inner circle CCW, with
// fillRule=evenodd this renders as a filled ring.
function donutPath(cx: number, cy: number, innerR: number, outerR: number): string {
  return [
    `M ${cx - outerR} ${cy}`,
    `a ${outerR} ${outerR} 0 1 0 ${outerR * 2} 0`,
    `a ${outerR} ${outerR} 0 1 0 ${-outerR * 2} 0`,
    `M ${cx - innerR} ${cy}`,
    `a ${innerR} ${innerR} 0 1 1 ${innerR * 2} 0`,
    `a ${innerR} ${innerR} 0 1 1 ${-innerR * 2} 0`,
    "Z",
  ].join(" ");
}
