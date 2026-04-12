import { useMemo, useState, useCallback, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Edge,
  type Node,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { GraphChatDrawer } from "../components/chat/GraphChatDrawer";

import type { GraphNode, GraphEdge, NodeKind, EdgeKind } from "@corlens/core";
import { EDGE_COLORS, NODE_COLORS } from "@corlens/core";

const LEGEND_FILTER_STORAGE_KEY = "corlens.graphview.filters.v1";

interface PersistedFilters {
  disabledNodeKinds: NodeKind[];
  disabledEdgeKinds: EdgeKind[];
  showMinor?: boolean;
}

function loadPersistedFilters(): PersistedFilters {
  if (typeof window === "undefined")
    return { disabledNodeKinds: [], disabledEdgeKinds: [], showMinor: false };
  try {
    const raw = window.localStorage.getItem(LEGEND_FILTER_STORAGE_KEY);
    if (!raw) return { disabledNodeKinds: [], disabledEdgeKinds: [], showMinor: false };
    const parsed = JSON.parse(raw);
    return {
      disabledNodeKinds: Array.isArray(parsed.disabledNodeKinds)
        ? parsed.disabledNodeKinds
        : [],
      disabledEdgeKinds: Array.isArray(parsed.disabledEdgeKinds)
        ? parsed.disabledEdgeKinds
        : [],
      showMinor: typeof parsed.showMinor === "boolean" ? parsed.showMinor : false,
    };
  } catch {
    return { disabledNodeKinds: [], disabledEdgeKinds: [], showMinor: false };
  }
}

import { useGraph } from "../hooks/useGraph";
import { useAnalysisStatus } from "../hooks/useAnalysis";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Legend } from "../components/graph/Legend";
import TokenNode from "../components/graph/nodes/TokenNode";
import IssuerNode from "../components/graph/nodes/IssuerNode";
import AMMPoolNode from "../components/graph/nodes/AMMPoolNode";
import AccountNode from "../components/graph/nodes/AccountNode";
import { shortenAddress } from "../lib/utils";
import { GraphHeader } from "../fragments/GraphView/GraphHeader";
import { FloatingGraphChatButton } from "../fragments/GraphView/FloatingGraphChatButton";
import { NodeDetailPanel } from "../fragments/GraphView/NodeDetailPanel";

// ─── Node type registration ─────────────────────────────────
const nodeTypes: NodeTypes = {
  token: TokenNode,
  issuer: IssuerNode,
  ammPool: AMMPoolNode,
  account: AccountNode,
  orderBook: AccountNode,
  paymentPath: AccountNode,
  escrow: AccountNode,
  check: AccountNode,
  payChannel: AccountNode,
  nft: AccountNode,
  signerList: AccountNode,
  did: AccountNode,
  credential: AccountNode,
  mpToken: AccountNode,
  oracle: AccountNode,
  depositPreauth: AccountNode,
  offer: AccountNode,
  permissionedDomain: AccountNode,
  nftOffer: AccountNode,
  ticket: AccountNode,
  bridge: AccountNode,
  vault: AccountNode,
};

// ─── Layout algorithm ────────────────────────────────────────
const RING_RADII: Record<NodeKind, number> = {
  issuer: 0,
  token: 260,
  ammPool: 380,
  orderBook: 480,
  account: 560,
  paymentPath: 640,
  escrow: 720,
  check: 800,
  payChannel: 860,
  nft: 920,
  signerList: 340,
  did: 180,
  credential: 180,
  mpToken: 440,
  oracle: 440,
  depositPreauth: 500,
  offer: 520,
  permissionedDomain: 540,
  nftOffer: 940,
  ticket: 560,
  bridge: 600,
  vault: 640,
};

function computeLayout(nodes: GraphNode[]): Node[] {
  const issuerNodes = nodes.filter((n) => n.kind === "issuer");
  const otherNodes = nodes.filter((n) => n.kind !== "issuer");

  // Group by kind
  const byKind: Record<string, GraphNode[]> = {};
  for (const node of otherNodes) {
    if (!byKind[node.kind]) byKind[node.kind] = [];
    byKind[node.kind].push(node);
  }

  const result: Node[] = [];
  const cx = 0;
  const cy = 0;

  // Place issuers at center
  issuerNodes.forEach((node, i) => {
    const offset =
      issuerNodes.length > 1 ? (i - (issuerNodes.length - 1) / 2) * 80 : 0;
    result.push({
      id: node.id,
      type: node.kind,
      position: { x: cx + offset, y: cy },
      data: node,
      draggable: true,
    });
  });

  // Place other kinds in concentric rings
  for (const [kind, kindNodes] of Object.entries(byKind)) {
    const radius = RING_RADII[kind as NodeKind] ?? 500;
    const count = kindNodes.length;
    kindNodes.forEach((node, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      result.push({
        id: node.id,
        type: node.kind,
        position: {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        },
        data: node,
        draggable: true,
      });
    });
  }

  return result;
}

function buildEdges(edges: GraphEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    type: e.kind === "ROUTES_THROUGH" ? "smoothstep" : "default",
    animated: e.kind === "ROUTES_THROUGH",
    style: {
      stroke: EDGE_COLORS[e.kind] ?? "var(--token-colors-border-default)",
      strokeWidth: 1.5,
      opacity: 0.7,
    },
    labelStyle: {
      fill: "var(--token-colors-text-tertiary)",
      fontSize: 9,
    },
    labelBgStyle: {
      fill: "var(--token-colors-bg-primary)",
      opacity: 0.8,
    },
  }));
}

// ─── Main Page ───────────────────────────────────────────────
export default function GraphView() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  const { data: graphData, isLoading, isError, error } = useGraph(analysisId);
  const { data: statusData } = useAnalysisStatus(analysisId);

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  // Filter state — hydrated from localStorage so the demo machine remembers
  // the presenter's last configuration between reloads.
  const [disabledNodeKinds, setDisabledNodeKinds] = useState<Set<NodeKind>>(
    () => {
      const persisted = loadPersistedFilters();
      return new Set(persisted.disabledNodeKinds);
    },
  );
  const [disabledEdgeKinds, setDisabledEdgeKinds] = useState<Set<EdgeKind>>(
    () => {
      const persisted = loadPersistedFilters();
      return new Set(persisted.disabledEdgeKinds);
    },
  );
  const [showMinor, setShowMinor] = useState<boolean>(
    () => loadPersistedFilters().showMinor ?? false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const payload: PersistedFilters = {
      disabledNodeKinds: Array.from(disabledNodeKinds),
      disabledEdgeKinds: Array.from(disabledEdgeKinds),
      showMinor,
    };
    window.localStorage.setItem(
      LEGEND_FILTER_STORAGE_KEY,
      JSON.stringify(payload),
    );
  }, [disabledNodeKinds, disabledEdgeKinds, showMinor]);

  const toggleNodeKind = useCallback((kind: NodeKind) => {
    setDisabledNodeKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  const toggleEdgeKind = useCallback((kind: EdgeKind) => {
    setDisabledEdgeKinds((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  }, []);

  // Counts per kind in the *raw* graph (not the filtered view) — used by the
  // legend to show "Account (42)" and to hide legend rows for kinds that don't
  // appear at all.
  const nodeCounts = useMemo<Partial<Record<NodeKind, number>>>(() => {
    if (!graphData) return {};
    const counts: Partial<Record<NodeKind, number>> = {};
    for (const n of graphData.nodes) counts[n.kind] = (counts[n.kind] ?? 0) + 1;
    return counts;
  }, [graphData]);

  const edgeCounts = useMemo<Partial<Record<EdgeKind, number>>>(() => {
    if (!graphData) return {};
    const counts: Partial<Record<EdgeKind, number>> = {};
    for (const e of graphData.edges) counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    return counts;
  }, [graphData]);

  // Count secondary (minor) nodes in the raw graph so the toggle button can
  // show "Show 247 minor nodes". If there are zero we hide the button
  // altogether (legacy single-seed depth-1 analyses that pre-date the BFS
  // feature just look like they always did).
  const minorCount = useMemo(() => {
    if (!graphData) return 0;
    return graphData.nodes.filter((n) => n.importance === "secondary").length;
  }, [graphData]);

  // Filtered graph data — apply disabled sets *and* the importance filter
  // before layout and edge build. Edges are also dropped when either
  // endpoint was filtered out, so the canvas never shows orphan stubs.
  const filteredGraph = useMemo(() => {
    if (!graphData)
      return { nodes: [] as GraphNode[], edges: [] as GraphEdge[] };
    const visibleNodes = graphData.nodes.filter(
      (n) =>
        !disabledNodeKinds.has(n.kind) &&
        (showMinor || n.importance !== "secondary"),
    );
    const visibleIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = graphData.edges.filter(
      (e) =>
        !disabledEdgeKinds.has(e.kind) &&
        visibleIds.has(e.source) &&
        visibleIds.has(e.target),
    );
    return { nodes: visibleNodes, edges: visibleEdges };
  }, [graphData, disabledNodeKinds, disabledEdgeKinds, showMinor]);

  // Use stateful nodes/edges so dragging actually persists on the canvas.
  // We recompute the initial layout whenever the filtered graph changes
  // (via useEffect below) but leave position updates under user control
  // once the graph is rendered.
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    setNodes(computeLayout(filteredGraph.nodes));
    setEdges(buildEdges(filteredGraph.edges));
  }, [filteredGraph, setNodes, setEdges]);

  const [chatOpen, setChatOpen] = useState(false);

  const handleShowAll = useCallback(() => {
    setDisabledNodeKinds(new Set());
    setDisabledEdgeKinds(new Set());
  }, []);

  const handleHideAll = useCallback(() => {
    setDisabledNodeKinds(new Set(Object.keys(NODE_COLORS) as NodeKind[]));
    setDisabledEdgeKinds(new Set(Object.keys(EDGE_COLORS) as EdgeKind[]));
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const graphNode = node.data as GraphNode;
    setSelectedNode(graphNode);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const stats = graphData?.stats;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-4">
        <span className="inline-block w-8 h-8 border-4 border-xrp-500/30 border-t-xrp-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Loading graph data…</p>
      </div>
    );
  }

  if (isError || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] gap-4">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-red-400">Failed to load graph</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-400 mb-4">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const seedLabel =
    statusData?.seedLabel ??
    shortenAddress(statusData?.seedAddress ?? analysisId ?? "");

  return (
    <div className="flex h-[calc(100vh-var(--token-layout-navbarHeight))] flex-col">
      <GraphHeader
        seedLabel={seedLabel}
        stats={stats}
      >
        {minorCount > 0 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowMinor((v) => !v)}
            title={
              showMinor
                ? "Hide fan-out accounts around each crawled hub"
                : "Reveal fan-out accounts around each crawled hub"
            }
          >
            {showMinor ? `Hide ${minorCount} minor` : `Show ${minorCount} minor`}
          </Button>
        )}
      </GraphHeader>

      {/* ReactFlow canvas */}
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodesDraggable
          nodesConnectable={false}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.1}
          maxZoom={3}
          style={{ background: "var(--token-colors-bg-primary)" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="var(--token-colors-border-subtle)"
            gap={30}
            size={1}
          />
          <Controls
            position="bottom-right"
            style={{
              background: "var(--token-colors-bg-secondary)",
              border: "1px solid var(--token-colors-border-subtle)",
              borderRadius: "var(--token-radius-md)",
            }}
          />
          <MiniMap
            position="bottom-left"
            nodeColor={(n) => {
              const gn = n.data as GraphNode;
              return (
                NODE_COLORS[gn.kind] ?? "var(--token-colors-border-default)"
              );
            }}
            style={{
              background: "var(--token-colors-bg-secondary)",
              border: "1px solid var(--token-colors-border-subtle)",
            }}
            maskColor="var(--token-colors-overlay-graphMask)"
          />
        </ReactFlow>

        {/* Legend floats top-left */}
        <Legend
          disabledNodeKinds={disabledNodeKinds}
          disabledEdgeKinds={disabledEdgeKinds}
          nodeCounts={nodeCounts}
          edgeCounts={edgeCounts}
          onToggleNodeKind={toggleNodeKind}
          onToggleEdgeKind={toggleEdgeKind}
          onShowAll={handleShowAll}
          onHideAll={handleHideAll}
        />

        {/* Floating chat drawer button (right side when closed) */}
        {!chatOpen && (
          <FloatingGraphChatButton onOpen={() => setChatOpen(true)} />
        )}

        {/* Detail panel */}
        {selectedNode && (
          <NodeDetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}

        {/* Chat drawer — overlays the graph without blocking it */}
        {chatOpen && analysisId && (
          <GraphChatDrawer
            analysisId={analysisId}
            onClose={() => setChatOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
