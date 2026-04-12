// xrplens/apps/web/src/routes/History.tsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type NodeMouseHandler,
} from "reactflow";
import "reactflow/dist/style.css";

import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { useHistoryStream } from "../hooks/useHistoryStream";
import {
  adaptHistoryGraph,
  adaptHistoryEdges,
  DepthRingsBackground,
  HISTORY_LEGEND,
  HISTORY_EDGE_LEGEND,
} from "../lib/historyGraphAdapter";
import { DEMO_SEED_ADDRESS, DEMO_SEED_LABEL } from "../lib/historyDemo";

// ─── Auto-fit helper ──────────────────────────────────────────────────────
// Calls `fitView()` whenever the node count jumps significantly OR the
// stream transitions to `done`. Must be rendered inside <ReactFlowProvider>.
function AutoFitView({
  nodeCount,
  status,
}: {
  nodeCount: number;
  status: string;
}) {
  const { fitView } = useReactFlow();

  useEffect(() => {
    if (nodeCount === 0) return;
    // Smoothly refit whenever the graph grows by a noticeable chunk so the
    // user always sees the full structure during streaming.
    const t = setTimeout(() => {
      fitView({ padding: 0.15, duration: 500 });
    }, 60);
    return () => clearTimeout(t);
  }, [fitView, nodeCount, status]);

  useEffect(() => {
    if (status === "done") {
      const t = setTimeout(() => {
        fitView({ padding: 0.15, duration: 700 });
      }, 100);
      return () => clearTimeout(t);
    }
  }, [fitView, status]);

  return null;
}

// ─── Page ────────────────────────────────────────────────────────────────

export default function History({ embedded }: { embedded?: boolean } = {}) {
  return (
    <ReactFlowProvider>
      <HistoryInner embedded={embedded} />
    </ReactFlowProvider>
  );
}

function HistoryInner({ embedded }: { embedded?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [addressInput, setAddressInput] = useState(
    embedded ? "" : (searchParams.get("address") ?? ""),
  );
  const [depth, setDepth] = useState<number>(
    embedded ? 1 : (Number(searchParams.get("depth") ?? "1") || 1),
  );

  const { state, start, stop, select } = useHistoryStream();

  // Sync URL params when address/depth change externally (standalone only)
  useEffect(() => {
    if (embedded) return;
    const urlAddr = searchParams.get("address") ?? "";
    const urlDepth = Number(searchParams.get("depth") ?? "1") || 1;
    if (urlAddr !== addressInput) setAddressInput(urlAddr);
    if (urlDepth !== depth) setDepth(urlDepth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, embedded]);

  const handleRun = () => {
    const addr = addressInput.trim();
    if (!addr) return;
    if (!embedded) setSearchParams({ address: addr, depth: String(depth) });
    start(addr, depth);
  };

  const handleLoadExample = () => {
    setAddressInput(DEMO_SEED_ADDRESS);
    if (!embedded) setSearchParams({ address: DEMO_SEED_ADDRESS, depth: "2" });
    setDepth(2);
    start(DEMO_SEED_ADDRESS, 2);
  };

  // ─── Graph data ───────────────────────────────────────────────────────
  const graphLayout = useMemo(
    () => adaptHistoryGraph(Array.from(state.nodes.values()), state.selectedNodeId),
    [state.nodes, state.selectedNodeId],
  );
  const rfNodes = graphLayout.nodes;
  const depthConfigs = graphLayout.depthConfigs;

  const rfEdges = useMemo(
    () => adaptHistoryEdges(Array.from(state.edges.values())),
    [state.edges],
  );

  const handleNodeClick: NodeMouseHandler = (_evt, node) => {
    select(state.selectedNodeId === node.id ? undefined : node.id);
  };

  // ─── Selected node detail ────────────────────────────────────────────
  const selectedNode = state.selectedNodeId
    ? state.nodes.get(state.selectedNodeId)
    : undefined;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Background gradient */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.12) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(139,92,246,0.08) 0%, transparent 60%)",
        }}
      />

      <div className="max-w-[1400px] mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-xrp-400 mb-2">
            XRPLens · Account History
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">History Graph</h1>
          <p className="text-slate-400 text-sm max-w-3xl">
            Crawl an XRPL account's transaction history and visualise the account graph.
            Depth 1 shows direct counterparties; depth 2–3 expands into their networks.
          </p>
        </div>

        {/* Controls bar */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  XRPL address
                </label>
                <input
                  type="text"
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRun()}
                  placeholder="r…"
                  className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-xrp-500"
                />
              </div>

              {/* Depth selector */}
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Depth
                </label>
                <div className="flex gap-1">
                  {([1, 2, 3] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDepth(d)}
                      className={`px-3 py-2 rounded text-sm font-semibold transition-colors ${
                        depth === d
                          ? "bg-xrp-600/30 text-xrp-400 border border-xrp-600/50"
                          : "bg-slate-900 text-slate-400 border border-slate-700 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 items-end">
                <Button
                  onClick={handleRun}
                  disabled={state.status === "streaming" || !addressInput.trim()}
                  variant="primary"
                >
                  {state.status === "streaming" ? "Crawling…" : "Run"}
                </Button>
                {state.status === "streaming" && (
                  <Button onClick={stop} variant="ghost">
                    Stop
                  </Button>
                )}
              </div>
            </div>

            {/* Example wallet link */}
            <div className="mt-2">
              <button
                onClick={handleLoadExample}
                className="text-xs text-xrp-400 hover:text-xrp-300 underline underline-offset-2"
              >
                Load example wallet
              </button>
              <span className="text-xs text-slate-600 ml-2">{DEMO_SEED_LABEL}</span>
            </div>
          </CardContent>
        </Card>

        {/* Main two-panel layout */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left panel (30%) ────────────────────────────────────────── */}
          <div className="w-full lg:w-[30%] space-y-4 flex-shrink-0">

            {/* Seed info card */}
            {state.seed && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Seed account</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="text-[11px] text-slate-400 font-mono break-all">
                    {state.seed.address}
                  </div>
                  {state.seed.label && (
                    <div className="text-xs text-slate-300">{state.seed.label}</div>
                  )}
                  <div className="flex gap-3 mt-2 text-xs text-slate-500">
                    <span>{state.seed.txCount} txs</span>
                    <span>depth {state.seed.depth}</span>
                    <span className="capitalize">{state.seed.crawlStatus}</span>
                  </div>
                  {state.seed.riskFlags && state.seed.riskFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {state.seed.riskFlags.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/15 text-red-400 border border-red-500/30"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Progress card */}
            {(state.status === "streaming" || state.status === "done" || state.stats) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    Progress
                    {state.status === "streaming" && (
                      <span className="inline-block w-2 h-2 bg-xrp-400 rounded-full animate-pulse" />
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-slate-500">Nodes</span>
                    <span className="text-white font-mono">{state.nodes.size}</span>
                    <span className="text-slate-500">Edges</span>
                    <span className="text-white font-mono">{state.edges.size}</span>
                    <span className="text-slate-500">Crawled</span>
                    <span className="text-white font-mono">{state.crawlsRun}</span>
                    <span className="text-slate-500">Queue</span>
                    <span className="text-white font-mono">{state.queueSize}</span>
                  </div>

                  {/* Stats banner */}
                  {state.stats && (
                    <div className="mt-3 p-2 bg-emerald-500/10 border border-emerald-500/30 rounded text-xs space-y-1">
                      <div className="text-emerald-400 font-semibold">Crawl complete</div>
                      <div className="text-slate-400">
                        {state.stats.nodes} nodes · {state.stats.edges} edges ·{" "}
                        {(state.stats.durationMs / 1000).toFixed(1)}s
                      </div>
                      {state.stats.truncated && (
                        <div className="text-amber-400">
                          Results truncated (too many nodes)
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fatal error */}
                  {state.fatalError && (
                    <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400">
                      {state.fatalError}
                    </div>
                  )}

                  {/* Crawl errors */}
                  {state.errors.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Errors ({state.errors.length})
                      </div>
                      {state.errors.map((err, i) => (
                        <div key={i} className="text-[10px] text-red-400 font-mono break-all">
                          {err.address.slice(0, 10)}… — {err.error}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tx type summary */}
            {state.txTypeSummary.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Transaction types</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {state.txTypeSummary.map((t) => (
                      <div key={t.type} className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-mono">{t.type}</span>
                        <span className="text-white font-semibold">{t.count}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected node detail */}
            {selectedNode && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Selected node</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-[11px] text-slate-400 font-mono break-all">
                    {selectedNode.address}
                  </div>
                  {selectedNode.label && (
                    <div className="text-xs text-slate-300">{selectedNode.label}</div>
                  )}
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs mt-1">
                    <span className="text-slate-500">Kind</span>
                    <span className="text-white capitalize">
                      {selectedNode.kind.replace(/_/g, " ")}
                    </span>
                    <span className="text-slate-500">Depth</span>
                    <span className="text-white">{selectedNode.depth}</span>
                    <span className="text-slate-500">Txs</span>
                    <span className="text-white">{selectedNode.txCount}</span>
                    <span className="text-slate-500">Status</span>
                    <span className="text-white capitalize">{selectedNode.crawlStatus}</span>
                  </div>
                  {selectedNode.riskFlags && selectedNode.riskFlags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedNode.riskFlags.map((f) => (
                        <span
                          key={f}
                          className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/15 text-red-400 border border-red-500/30"
                        >
                          {f}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="pt-1">
                    <Link
                      to={`/analyze?address=${encodeURIComponent(selectedNode.address)}`}
                      className="inline-block text-xs text-xrp-400 hover:text-xrp-300 underline underline-offset-2"
                    >
                      Open in Analyze →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ── Right panel (70%) ────────────────────────────────────────── */}
          <div className="flex-1 min-w-0">
            <div
              data-testid="history-graph"
              style={{
                height: "calc(100vh - 260px)",
                minHeight: 640,
                background: "#020617",
                border: "1px solid #1e293b",
                borderRadius: 8,
                overflow: "hidden",
                position: "relative",
              }}
            >
              {rfNodes.length === 0 ? (
                <div
                  style={{
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#475569",
                    fontSize: 13,
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {state.status === "streaming" ? (
                    <>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          border: "3px solid rgba(14,165,233,0.3)",
                          borderTopColor: "#0ea5e9",
                          borderRadius: "50%",
                          display: "inline-block",
                          animation: "spin 0.8s linear infinite",
                        }}
                      />
                      <span>Crawling account history…</span>
                    </>
                  ) : (
                    <span>Enter an address above and click Run to build the graph.</span>
                  )}
                </div>
              ) : (
                <ReactFlow
                  nodes={rfNodes}
                  edges={rfEdges}
                  onNodeClick={handleNodeClick}
                  fitView
                  fitViewOptions={{ padding: 0.15 }}
                  minZoom={0.05}
                  maxZoom={3}
                  nodesDraggable
                  nodesConnectable={false}
                  proOptions={{ hideAttribution: true }}
                  style={{ background: "#020617" }}
                >
                  <AutoFitView nodeCount={rfNodes.length} status={state.status} />
                  <DepthRingsBackground depthConfigs={depthConfigs} />
                  <Background
                    variant={BackgroundVariant.Dots}
                    color="#1e293b"
                    gap={30}
                    size={1}
                  />
                  <Controls
                    showInteractive={false}
                    position="bottom-right"
                    style={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 8,
                    }}
                  />
                  <MiniMap
                    position="bottom-left"
                    nodeColor={(n) => {
                      // Match the border color rendered inside the custom node label.
                      // ReactFlow mini-map can only see style.background, so we fall
                      // back to a slate default.
                      const id = n.id;
                      const hn = state.nodes.get(id);
                      if (!hn) return "#334155";
                      const map: Record<string, string> = {
                        seed: "#f59e0b",
                        amm: "#3b82f6",
                        issuer: "#ef4444",
                        multisig_member: "#64748b",
                        escrow_dest: "#f97316",
                        check_dest: "#ec4899",
                        channel_dest: "#14b8a6",
                        account_light: "#475569",
                      };
                      return map[hn.kind] ?? "#334155";
                    }}
                    style={{
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                    }}
                    maskColor="rgba(2,6,23,0.8)"
                  />
                </ReactFlow>
              )}

              {/* Graph legend (floats top-left, outside ReactFlow so it stays
                 fixed while the canvas pans) */}
              {rfNodes.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 10,
                    left: 10,
                    background: "rgba(2,6,23,0.92)",
                    border: "1px solid #1e293b",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 10,
                    color: "#cbd5e1",
                    maxWidth: 240,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: "#64748b",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Node kinds
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "4px 10px",
                      marginBottom: 8,
                    }}
                  >
                    {HISTORY_LEGEND.map((k) => (
                      <div
                        key={k.key}
                        style={{ display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <span
                          style={{
                            width: 9,
                            height: 9,
                            borderRadius: 2,
                            background: k.color,
                            boxShadow: `0 0 6px ${k.color}80`,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 9 }}>{k.label}</span>
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: "#64748b",
                      letterSpacing: 1,
                      textTransform: "uppercase",
                      marginBottom: 5,
                    }}
                  >
                    Edge types
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "3px 10px",
                    }}
                  >
                    {HISTORY_EDGE_LEGEND.map((e) => (
                      <div
                        key={e.label}
                        style={{ display: "flex", alignItems: "center", gap: 5 }}
                      >
                        <span
                          style={{
                            width: 12,
                            height: 2,
                            background: e.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 9 }}>{e.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Keyframe for the spinner in the empty-state */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
