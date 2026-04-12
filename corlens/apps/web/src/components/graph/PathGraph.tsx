import { useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";

import type { CorridorAnalysis, CorridorPath } from "@corlens/core";

// ─── Overview ────────────────────────────────────────────────────────────
// Renders a CorridorAnalysis (output of ripple_path_find + risk engine) as
// a horizontal ReactFlow graph: source on the left, destination on the
// right, every candidate path as its own row of hops in between.
//
// Path color semantics:
//   - Recommended path  → emerald (the safe, risk-adjusted winner)
//   - XRPL default path → sky blue (what ripple_path_find picks first)
//   - Both               → emerald (the winner takes precedence)
//   - Neither            → slate (alternatives the agent considered)
//
// Used by:
//   - Safe Path Agent page (renders paths as they stream in from the agent)
//   - /corridors/:id detail page (static snapshot of the full analysis)

const COLORS = {
  source: "#0ea5e9",
  dest: "#f59e0b",
  hop: "#334155",
  recommended: "#10b981",
  xrplDefault: "#0ea5e9",
  neutral: "#475569",
  riskHigh: "#ef4444",
  riskMed: "#f59e0b",
  riskLow: "#64748b",
};

export interface PathGraphProps {
  analysis: CorridorAnalysis | null;
  /** Optional subset — show only these path indices (used for streaming). */
  visiblePathIndices?: number[];
  /** Highlight a single path index (e.g. the one currently being evaluated). */
  activePathIndex?: number;
  /** Height in pixels. */
  height?: number;
}

function shortAddress(addr: string): string {
  if (!addr) return "?";
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function hopLabel(hop: CorridorPath["hops"][number]): string {
  const parts: string[] = [];
  if (hop.currency) parts.push(hop.currency);
  if (hop.account) parts.push(shortAddress(hop.account));
  else if (hop.issuer) parts.push(shortAddress(hop.issuer));
  return parts.join("\n") || hop.type;
}

function hopRiskSeverity(hop: CorridorPath["hops"][number]): "HIGH" | "MED" | "LOW" | null {
  if (hop.riskFlags.some((f) => f.severity === "HIGH")) return "HIGH";
  if (hop.riskFlags.some((f) => f.severity === "MED")) return "MED";
  if (hop.riskFlags.length > 0) return "LOW";
  return null;
}

function pathColor(
  path: CorridorPath,
  analysis: CorridorAnalysis,
): { stroke: string; kind: "recommended" | "xrpl_default" | "neutral" } {
  const isRec = path.index === analysis.recommendedPathIndex;
  const isDefault = path.index === analysis.defaultPathIndex;
  if (isRec) return { stroke: COLORS.recommended, kind: "recommended" };
  if (isDefault) return { stroke: COLORS.xrplDefault, kind: "xrpl_default" };
  return { stroke: COLORS.neutral, kind: "neutral" };
}

export function PathGraph({
  analysis,
  visiblePathIndices,
  activePathIndex,
  height = 420,
}: PathGraphProps) {
  const { nodes, edges } = useMemo(() => {
    if (!analysis || analysis.paths.length === 0) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }

    const visiblePaths = analysis.paths.filter(
      (p) => !visiblePathIndices || visiblePathIndices.includes(p.index),
    );

    // Layout: source left, destination right, paths stacked vertically.
    const laneHeight = 110;
    const totalHeight = Math.max(1, visiblePaths.length) * laneHeight;
    const midY = totalHeight / 2 - laneHeight / 2;

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Shared source node
    const sourceId = "corridor-source";
    nodes.push({
      id: sourceId,
      type: "default",
      position: { x: 0, y: midY },
      data: {
        label: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: COLORS.source, fontWeight: 700, letterSpacing: 1 }}>
              SOURCE
            </div>
            <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>
              {analysis.request.sourceCurrency}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>
              {analysis.request.sourceIssuer
                ? shortAddress(analysis.request.sourceIssuer)
                : "native"}
            </div>
          </div>
        ),
      },
      style: {
        background: "#0f172a",
        border: `2px solid ${COLORS.source}`,
        borderRadius: 8,
        width: 120,
        padding: 8,
      },
      sourcePosition: "right" as any,
      targetPosition: "left" as any,
      draggable: false,
    });

    // Shared destination node
    const destId = "corridor-dest";
    const destX = 800;
    nodes.push({
      id: destId,
      type: "default",
      position: { x: destX, y: midY },
      data: {
        label: (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 9, color: COLORS.dest, fontWeight: 700, letterSpacing: 1 }}>
              DESTINATION
            </div>
            <div style={{ fontSize: 12, color: "#f8fafc", fontWeight: 600 }}>
              {analysis.request.destCurrency}
            </div>
            <div style={{ fontSize: 9, color: "#94a3b8", fontFamily: "monospace" }}>
              {shortAddress(analysis.request.destIssuer)}
            </div>
          </div>
        ),
      },
      style: {
        background: "#0f172a",
        border: `2px solid ${COLORS.dest}`,
        borderRadius: 8,
        width: 120,
        padding: 8,
      },
      sourcePosition: "right" as any,
      targetPosition: "left" as any,
      draggable: false,
    });

    // One lane per path
    visiblePaths.forEach((path, laneIdx) => {
      const laneY = laneIdx * laneHeight - totalHeight / 2 + laneHeight / 2 + midY;
      const { stroke, kind } = pathColor(path, analysis);
      const isActive = activePathIndex === path.index;
      const strokeWidth = isActive ? 4 : kind === "neutral" ? 1.5 : 3;
      const opacity = isActive || kind !== "neutral" ? 1 : 0.55;

      // Determine hop count — if zero, direct edge source → dest
      const hops = path.hops.length > 0 ? path.hops : [];
      const hopCount = hops.length;

      // Hop spacing along the lane
      const startX = 170;
      const endX = destX - 50;
      const usableWidth = endX - startX;
      const step = hopCount > 0 ? usableWidth / (hopCount + 1) : usableWidth;

      let prevId = sourceId;

      hops.forEach((hop, hopIdx) => {
        const hopId = `p${path.index}-h${hopIdx}`;
        const hopX = startX + step * (hopIdx + 1);
        const riskSev = hopRiskSeverity(hop);
        const borderColor =
          riskSev === "HIGH"
            ? COLORS.riskHigh
            : riskSev === "MED"
            ? COLORS.riskMed
            : riskSev === "LOW"
            ? COLORS.riskLow
            : COLORS.hop;

        nodes.push({
          id: hopId,
          type: "default",
          position: { x: hopX, y: laneY },
          data: {
            label: (
              <div style={{ textAlign: "center", fontSize: 10 }}>
                <div
                  style={{
                    fontSize: 8,
                    color: stroke,
                    fontWeight: 700,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                  }}
                >
                  {hop.type}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: "#e2e8f0",
                    whiteSpace: "pre",
                    lineHeight: 1.1,
                  }}
                >
                  {hopLabel(hop)}
                </div>
                {riskSev && (
                  <div
                    style={{
                      fontSize: 8,
                      color: borderColor,
                      marginTop: 2,
                      fontWeight: 700,
                    }}
                  >
                    {hop.riskFlags.length} flag{hop.riskFlags.length > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ),
          },
          style: {
            background: "#020617",
            border: `1.5px solid ${borderColor}`,
            borderRadius: 6,
            width: 90,
            padding: 4,
            opacity,
          },
          sourcePosition: "right" as any,
          targetPosition: "left" as any,
          draggable: false,
        });

        edges.push({
          id: `e-${prevId}-${hopId}`,
          source: prevId,
          target: hopId,
          type: "default",
          style: { stroke, strokeWidth, opacity },
          animated: isActive,
        });

        prevId = hopId;
      });

      // Final hop → destination
      edges.push({
        id: `e-${prevId}-dest-${path.index}`,
        source: prevId,
        target: destId,
        type: "default",
        style: { stroke, strokeWidth, opacity },
        animated: isActive,
        label: `path #${path.index}`,
        labelStyle: {
          fill: stroke,
          fontSize: 9,
          fontWeight: 700,
        },
        labelBgStyle: {
          fill: "#020617",
          opacity: 0.85,
        },
      });
    });

    return { nodes, edges };
  }, [analysis, visiblePathIndices, activePathIndex]);

  if (!analysis || analysis.paths.length === 0) {
    return (
      <div
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
        {analysis ? "No paths found — corridor inactive" : "Waiting for paths…"}
      </div>
    );
  }

  return (
    <div
      data-testid="path-graph"
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
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1} />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      {/* Legend overlay */}
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          display: "flex",
          gap: 8,
          fontSize: 9,
          background: "rgba(2, 6, 23, 0.9)",
          border: "1px solid #1e293b",
          borderRadius: 6,
          padding: "4px 8px",
          color: "#94a3b8",
        }}
      >
        <Legend swatch={COLORS.recommended} label="Recommended (safest)" />
        <Legend swatch={COLORS.xrplDefault} label="XRPL default (cheapest)" />
        <Legend swatch={COLORS.neutral} label="Alternative" />
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span
        style={{
          width: 14,
          height: 3,
          background: swatch,
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <span>{label}</span>
    </div>
  );
}
