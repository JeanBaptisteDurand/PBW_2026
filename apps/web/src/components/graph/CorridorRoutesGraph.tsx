import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CorridorDetailResponse, CorridorPathHop } from "@xrplens/core";

// ─── Overview ────────────────────────────────────────────────────────────
// Renders EVERY candidate route of a corridor in a single deduplicated
// graph. Where PathGraph shows one CorridorAnalysis, this component takes
// the full corridor and walks every route's paths, merging nodes that
// represent the same (currency, issuer/account) so a 3×3 corridor with
// direct books renders as exactly 6 nodes (3 sources + 3 destinations)
// plus whatever intermediate hops the pathfinder actually uses.
//
// Deduplication keys:
//   - source node = "src:${currency}:${issuer}" — one per source issuer
//   - dest   node = "dst:${currency}:${issuer}" — one per dest issuer
//   - hop    node = "hop:${currency}:${account|issuer}" — currency
//                    conversion steps + gateway pass-throughs dedupe naturally
//   - If a hop's address matches a known source/dest issuer, it MERGES into
//     that source/dest node (ensures the graph stays connected).
//
// Edge rendering:
//   - Edge color priority: winner-recommended > winner-alternative > other
//   - If the user selected a specific route row, its edges are highlighted
//     in amber and every other edge is dimmed
//   - Edge count (how many paths traverse the same edge) bumps stroke width

const COLORS = {
  source: "#0ea5e9",
  dest: "#f59e0b",
  hop: "#64748b",
  winnerRecommended: "#10b981",
  winnerAlt: "#0ea5e9",
  otherRoute: "#475569",
  selected: "#fbbf24",
  riskHigh: "#ef4444",
  riskMed: "#f59e0b",
  riskLow: "#94a3b8",
};

export interface CorridorRoutesGraphProps {
  corridor: CorridorDetailResponse;
  /** Highlight one route's edges in amber and dim the rest. */
  selectedRouteId?: string | null;
  /**
   * When true and `selectedRouteId` is set, non-selected routes (and nodes
   * they exclusively touch) are removed from the graph entirely. Lets the
   * same component serve as both the "all routes" comparison view and the
   * "single path detail" view without needing a second chart.
   */
  focusMode?: boolean;
  height?: number;
}

interface NodeMeta {
  key: string;
  kind: "source" | "dest" | "hop";
  currency: string;
  issuerName?: string;
  addressShort?: string;
  column: number;
  riskSeverity: "HIGH" | "MED" | "LOW" | null;
}

interface EdgeMeta {
  key: string;
  source: string;
  target: string;
  routeIds: Set<string>;
  isWinnerRecommended: boolean;
  isWinner: boolean;
  /** "candidate" = structural edge for a route that hasn't been path_found yet */
  isCandidateOnly: boolean;
  count: number;
}

function shortAddress(addr?: string): string {
  if (!addr) return "";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hopRiskSeverity(hop: CorridorPathHop): NodeMeta["riskSeverity"] {
  if (hop.riskFlags.some((f) => f.severity === "HIGH")) return "HIGH";
  if (hop.riskFlags.some((f) => f.severity === "MED")) return "MED";
  if (hop.riskFlags.length > 0) return "LOW";
  return null;
}

function mergeRisk(
  a: NodeMeta["riskSeverity"],
  b: NodeMeta["riskSeverity"],
): NodeMeta["riskSeverity"] {
  const rank = { HIGH: 3, MED: 2, LOW: 1, null: 0 } as const;
  return (rank[a ?? "null"] >= rank[b ?? "null"] ? a : b) ?? null;
}

export function CorridorRoutesGraph({
  corridor,
  selectedRouteId,
  focusMode = false,
  height = 520,
}: CorridorRoutesGraphProps) {
  const { rfNodes, rfEdges, counts } = useMemo(() => {
    const isFocused = focusMode && !!selectedRouteId;
    const nodes = new Map<string, NodeMeta>();
    const edges = new Map<string, EdgeMeta>();

    // ── Precompute known issuer addresses so hop-account steps that
    //    happen to reference a source or dest issuer merge into those nodes
    //    instead of spawning a second ghost hop node.
    const srcIssuerIndex = new Map<string, { currency: string; name?: string }>();
    const dstIssuerIndex = new Map<string, { currency: string; name?: string }>();
    for (const r of corridor.routeResults) {
      if (r.request.sourceIssuer) {
        srcIssuerIndex.set(r.request.sourceIssuer, {
          currency: r.request.sourceCurrency,
          name: r.sourceIssuerName,
        });
      }
      dstIssuerIndex.set(r.request.destIssuer, {
        currency: r.request.destCurrency,
        name: r.destIssuerName,
      });
    }

    const ensureNode = (meta: NodeMeta) => {
      const existing = nodes.get(meta.key);
      if (!existing) {
        nodes.set(meta.key, meta);
        return;
      }
      // Keep the smallest column so hops that also show up as alt rows
      // settle to the left. Merge risk severity to show the worst.
      existing.column = Math.min(existing.column, meta.column);
      existing.riskSeverity = mergeRisk(existing.riskSeverity, meta.riskSeverity);
      if (!existing.issuerName && meta.issuerName) existing.issuerName = meta.issuerName;
      if (!existing.addressShort && meta.addressShort) existing.addressShort = meta.addressShort;
    };

    const ensureEdge = (
      source: string,
      target: string,
      routeId: string,
      isWinner: boolean,
      isRecommended: boolean,
      isCandidateOnly = false,
    ) => {
      const key = `${source}→${target}`;
      let e = edges.get(key);
      if (!e) {
        e = {
          key,
          source,
          target,
          routeIds: new Set<string>(),
          isWinnerRecommended: false,
          isWinner: false,
          isCandidateOnly: true, // flipped to false the first time a real analysis edge lands
          count: 0,
        };
        edges.set(key, e);
      }
      e.routeIds.add(routeId);
      if (isWinner) e.isWinner = true;
      if (isWinner && isRecommended) e.isWinnerRecommended = true;
      if (!isCandidateOnly) e.isCandidateOnly = false;
      e.count += 1;
    };

    const resolveHopNode = (
      hop: CorridorPathHop,
      depth: number,
    ): { key: string; meta: NodeMeta } => {
      const currency = hop.currency ?? "XRP";
      const addr = hop.account ?? hop.issuer ?? "";
      const riskSeverity = hopRiskSeverity(hop);

      // Source merge
      if (addr && srcIssuerIndex.has(addr)) {
        const s = srcIssuerIndex.get(addr)!;
        const key = `src:${s.currency}:${addr}`;
        return {
          key,
          meta: {
            key,
            kind: "source",
            currency: s.currency,
            issuerName: s.name,
            addressShort: shortAddress(addr),
            column: 0,
            riskSeverity,
          },
        };
      }
      // Dest merge
      if (addr && dstIssuerIndex.has(addr)) {
        const d = dstIssuerIndex.get(addr)!;
        const key = `dst:${d.currency}:${addr}`;
        return {
          key,
          meta: {
            key,
            kind: "dest",
            currency: d.currency,
            issuerName: d.name,
            addressShort: shortAddress(addr),
            column: 999, // will be rewritten to maxHopCol + 1
            riskSeverity,
          },
        };
      }
      // Intermediate hop
      const key = `hop:${currency}:${addr}`;
      return {
        key,
        meta: {
          key,
          kind: "hop",
          currency,
          addressShort: shortAddress(addr),
          column: depth,
          riskSeverity,
        },
      };
    };

    // ── Pass 1: materialize every candidate route's src + dst node and emit
    // a candidate edge between them. This guarantees every issuer pair shows
    // up in the graph even when path_find hasn't explored it yet, so a 3×3
    // corridor always renders 3 sources + 3 dests.
    for (const route of corridor.routeResults) {
      const srcKey =
        route.request.sourceCurrency === "XRP"
          ? `src:XRP:`
          : `src:${route.request.sourceCurrency}:${route.request.sourceIssuer}`;
      ensureNode({
        key: srcKey,
        kind: "source",
        currency: route.request.sourceCurrency,
        issuerName: route.sourceIssuerName,
        addressShort: shortAddress(route.request.sourceIssuer),
        column: 0,
        riskSeverity: null,
      });

      const dstKey = `dst:${route.request.destCurrency}:${route.request.destIssuer}`;
      ensureNode({
        key: dstKey,
        kind: "dest",
        currency: route.request.destCurrency,
        issuerName: route.destIssuerName,
        addressShort: shortAddress(route.request.destIssuer),
        column: 999,
        riskSeverity: null,
      });

      // Structural candidate edge — will stay candidate-only unless pass 2
      // replaces it with real analysis data.
      ensureEdge(srcKey, dstKey, route.routeId, route.isWinner, false, true);
    }

    // ── Pass 2: walk every route's cached analysis and emit real hops/edges
    for (const route of corridor.routeResults) {
      const analysis = route.analysis;
      if (!analysis || analysis.paths.length === 0) continue;

      const srcKey =
        route.request.sourceCurrency === "XRP"
          ? `src:XRP:`
          : `src:${route.request.sourceCurrency}:${route.request.sourceIssuer}`;
      const dstKey = `dst:${route.request.destCurrency}:${route.request.destIssuer}`;

      for (const path of analysis.paths) {
        const isRecommended = path.index === analysis.recommendedPathIndex;
        let prevKey = srcKey;
        let depth = 1;
        for (const hop of path.hops) {
          const { key: hopKey, meta } = resolveHopNode(hop, depth);
          ensureNode(meta);
          ensureEdge(prevKey, hopKey, route.routeId, route.isWinner, isRecommended);
          prevKey = hopKey;
          depth++;
        }
        // Final hop → destination
        ensureEdge(prevKey, dstKey, route.routeId, route.isWinner, isRecommended);
      }
    }

    // ── Focus mode: drop every edge that is not in the selected route,
    //    then drop every node that no surviving edge touches. The src/dst
    //    endpoints of the selected route are always kept so the graph
    //    reads as a clean single-path chain.
    if (isFocused) {
      for (const [key, e] of Array.from(edges.entries())) {
        if (!e.routeIds.has(selectedRouteId!)) edges.delete(key);
      }
      const touched = new Set<string>();
      for (const e of edges.values()) {
        touched.add(e.source);
        touched.add(e.target);
      }
      for (const key of Array.from(nodes.keys())) {
        if (!touched.has(key)) nodes.delete(key);
      }
    }

    // ── Column assignment for destinations (rightmost)
    const hopCols = Array.from(nodes.values())
      .filter((n) => n.kind === "hop")
      .map((n) => n.column);
    const maxHopCol = hopCols.length > 0 ? Math.max(...hopCols) : 0;
    const destCol = maxHopCol + 1;
    for (const n of nodes.values()) {
      if (n.kind === "dest") n.column = destCol;
    }

    // ── Group by column → assign Y positions centered
    const COLUMN_WIDTH = 220;
    const ROW_HEIGHT = 95;
    const byColumn = new Map<number, NodeMeta[]>();
    for (const n of nodes.values()) {
      if (!byColumn.has(n.column)) byColumn.set(n.column, []);
      byColumn.get(n.column)!.push(n);
    }
    for (const col of byColumn.values()) {
      col.sort(
        (a, b) =>
          (a.issuerName ?? "").localeCompare(b.issuerName ?? "") ||
          a.key.localeCompare(b.key),
      );
    }

    const positions = new Map<string, { x: number; y: number }>();
    for (const [col, list] of byColumn.entries()) {
      const x = col * COLUMN_WIDTH;
      const totalH = list.length * ROW_HEIGHT;
      const startY = -totalH / 2;
      list.forEach((n, i) => {
        positions.set(n.key, { x, y: startY + i * ROW_HEIGHT });
      });
    }

    // ── Build ReactFlow nodes
    const rfNodes: Node[] = [];
    for (const n of nodes.values()) {
      const pos = positions.get(n.key)!;
      const baseColor =
        n.kind === "source" ? COLORS.source : n.kind === "dest" ? COLORS.dest : COLORS.hop;
      const riskBorder =
        n.riskSeverity === "HIGH"
          ? COLORS.riskHigh
          : n.riskSeverity === "MED"
            ? COLORS.riskMed
            : n.riskSeverity === "LOW"
              ? COLORS.riskLow
              : null;
      const border = riskBorder ?? baseColor;
      rfNodes.push({
        id: n.key,
        type: "default",
        position: pos,
        data: {
          label: (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: 8,
                  color: baseColor,
                  fontWeight: 700,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                {n.kind}
              </div>
              <div style={{ fontSize: 13, color: "#f8fafc", fontWeight: 700 }}>
                {n.currency}
              </div>
              {n.issuerName ? (
                <div style={{ fontSize: 10, color: "#cbd5e1" }}>{n.issuerName}</div>
              ) : n.addressShort ? (
                <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>
                  {n.addressShort}
                </div>
              ) : null}
              {n.riskSeverity && (
                <div
                  style={{
                    fontSize: 8,
                    color: border,
                    marginTop: 2,
                    fontWeight: 700,
                  }}
                >
                  {n.riskSeverity} risk
                </div>
              )}
            </div>
          ),
        },
        style: {
          background: "#0f172a",
          border: `2px solid ${border}`,
          borderRadius: 10,
          width: 160,
          padding: 8,
        },
        sourcePosition: "right" as any,
        targetPosition: "left" as any,
        draggable: false,
      });
    }

    // ── Build ReactFlow edges
    const rfEdges: Edge[] = [];
    for (const e of edges.values()) {
      const isSelected = selectedRouteId ? e.routeIds.has(selectedRouteId) : false;
      const dimmed = !!selectedRouteId && !isSelected;
      let color = COLORS.otherRoute;
      let strokeWidth = 2;
      let opacity = 0.85;
      let dashed = false;
      if (e.isWinnerRecommended) {
        color = COLORS.winnerRecommended;
        strokeWidth = 3.5;
        opacity = 1;
      } else if (e.isWinner) {
        color = COLORS.winnerAlt;
        strokeWidth = 3;
        opacity = 1;
      } else if (e.isCandidateOnly) {
        // Structural edge for a route that wasn't path_found yet — still
        // needs to be visible, just subtler than real analysis edges.
        color = "#94a3b8";
        strokeWidth = 1.5;
        opacity = 0.85;
        dashed = true;
      } else if (e.count >= 2) {
        color = "#cbd5e1";
        strokeWidth = 2.5;
        opacity = 0.9;
      }
      if (isSelected) {
        color = COLORS.selected;
        strokeWidth = 4;
        opacity = 1;
      }
      // Softer dim so non-selected edges stay visible as ghost lines
      if (dimmed) opacity = 0.28;
      rfEdges.push({
        id: e.key,
        source: e.source,
        target: e.target,
        type: "default",
        style: {
          stroke: color,
          strokeWidth,
          opacity,
          strokeDasharray: dashed ? "5 4" : undefined,
        },
        animated: isSelected,
      });
    }

    return {
      rfNodes,
      rfEdges,
      counts: {
        sources: Array.from(nodes.values()).filter((n) => n.kind === "source").length,
        dests: Array.from(nodes.values()).filter((n) => n.kind === "dest").length,
        hops: Array.from(nodes.values()).filter((n) => n.kind === "hop").length,
        edges: edges.size,
        totalNodes: nodes.size,
      },
    };
  }, [corridor, selectedRouteId, focusMode]);

  if (rfNodes.length === 0) {
    return (
      <div
        data-testid="corridor-routes-graph-empty"
        style={{
          height,
          background: "#020617",
          border: "1px solid #1e293b",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#475569",
          fontSize: 12,
        }}
      >
        No cached path data for any route on this corridor yet.
      </div>
    );
  }

  return (
    <div
      data-testid="corridor-routes-graph"
      style={{
        height,
        background: "#020617",
        border: "1px solid #1e293b",
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
      }}
    >
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        minZoom={0.15}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          fontSize: 9,
          background: "rgba(2, 6, 23, 0.92)",
          border: "1px solid #1e293b",
          borderRadius: 6,
          padding: "6px 10px",
          color: "#94a3b8",
          maxWidth: 300,
        }}
      >
        <div style={{ fontWeight: 700, color: "#cbd5e1", letterSpacing: 1 }}>
          {focusMode && selectedRouteId ? "FOCUS · SINGLE ROUTE" : "ALL ROUTES · DEDUPED"}
        </div>
        <div>
          {counts.sources} source{counts.sources !== 1 ? "s" : ""} ×{" "}
          {counts.dests} dest{counts.dests !== 1 ? "s" : ""} ·{" "}
          {counts.hops} intermediate · {counts.edges} edges
        </div>
        <Legend swatch={COLORS.winnerRecommended} label="Winner · recommended" />
        <Legend swatch={COLORS.winnerAlt} label="Winner · alt paths" />
        <Legend swatch={COLORS.otherRoute} label="Other routes" />
        <Legend swatch={COLORS.otherRoute} label="Candidate (not scanned)" dashed />
        {selectedRouteId && (
          <Legend swatch={COLORS.selected} label={`Selected: ${selectedRouteId}`} />
        )}
      </div>
    </div>
  );
}

function Legend({
  swatch,
  label,
  dashed = false,
}: {
  swatch: string;
  label: string;
  dashed?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 3,
          background: dashed
            ? `repeating-linear-gradient(90deg, ${swatch} 0 3px, transparent 3px 6px)`
            : swatch,
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
