import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type {
  CorridorActor,
  CorridorDetailResponse,
  CorridorListItem,
  CorridorRouteResult,
} from "../lib/core-types.js";
import { api } from "../api/index.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { CorridorActorGraph } from "../components/graph/CorridorActorGraph";
import { CorridorStatusSparkline } from "../components/corridors/CorridorStatusSparkline";
import { PartnerDepthBadge } from "../components/corridors/PartnerDepthBadge";

// Corridors where a partner-depth live feed is wired. Keep in sync with
// PARTNER_DEPTH_BOOKS on the server (corlens/apps/server/src/corridors/partnerDepth.ts).
const PARTNER_DEPTH_CORRIDORS: Record<string, { actor: string; label: string; base: string; quote: string }> = {
  "usd-mxn": { actor: "bitso", label: "Bitso", base: "XRP", quote: "MXN" },
  "mxn-usd": { actor: "bitso", label: "Bitso", base: "XRP", quote: "MXN" },
};
import { CorridorChatBubble } from "../components/corridors/CorridorChatBubble";

// ─── Corridor Detail (pair view + routes comparison) ─────────────────────
// Loads the cached corridor (one fiat-pair), shows the winning route in
// detail, and renders every candidate route side-by-side so the operator
// can see exactly *why* the picker chose what it did.

export default function CorridorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [corridor, setCorridor] = useState<CorridorDetailResponse | null>(null);
  const [related, setRelated] = useState<CorridorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([api.getCorridor(id), api.listCorridors()])
      .then(([detail, list]) => {
        if (cancelled) return;
        setCorridor(detail.corridor);
        // Don't pre-select a route on load — selecting dims every other
        // edge in the unified graph, which hid most of the routes on first
        // paint. The user can click a row to highlight one.
        setSelectedRouteId(null);
        const relIds = new Set(detail.corridor.relatedCorridorIds ?? []);
        setRelated(list.corridors.filter((c) => relIds.has(c.id)));
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load corridor");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleRefresh = async () => {
    if (!id) return;
    setRefreshing(true);
    try {
      const res = await api.refreshCorridor(id);
      setCorridor(res.corridor);
      setSelectedRouteId(res.corridor.bestRouteId ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const selectedRoute = useMemo(() => {
    if (!corridor) return null;
    return (
      corridor.routeResults.find((r) => r.routeId === selectedRouteId) ??
      corridor.routeResults.find((r) => r.routeId === corridor.bestRouteId) ??
      corridor.routeResults[0] ??
      null
    );
  }, [corridor, selectedRouteId]);

  // Classify the corridor into one of three narrative kinds so the UI can
  // tell a coherent story. The kind drives both the top-of-page banner and
  // whether the legacy XRPL orderbook section is shown.
  //
  //   off-chain-bridge: no on-chain IOU trust lines, only real-world rails
  //                     via RLUSD on XRPL. (category === "off-chain-bridge")
  //   on-chain-legacy:  category has IOU routes but every candidate is RED
  //                     and the total live path count is 0. The on-chain
  //                     story is effectively dead (e.g. CHF↔USD via Bitstamp
  //                     legacy IOUs) — real flow is the off-chain actors.
  //   on-chain-active:  at least one candidate route had a real path_find
  //                     hit (pathCount > 0). Depth-only GREEN from the
  //                     fallback classifier does not count — if nothing
  //                     was actually routeable on the last scan, the
  //                     on-chain story is dead regardless of orderbook
  //                     depth and we hide the XRPL routes table.
  type CorridorKind = "off-chain-bridge" | "on-chain-legacy" | "on-chain-active";
  const corridorKind: CorridorKind = useMemo(() => {
    if (!corridor) return "on-chain-active";
    if (corridor.category === "off-chain-bridge") return "off-chain-bridge";
    const routes = corridor.routeResults ?? [];
    if (routes.length === 0) return "on-chain-legacy";
    const anyLive = routes.some((r) => r.pathCount > 0);
    return anyLive ? "on-chain-active" : "on-chain-legacy";
  }, [corridor]);

  if (!id) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Corridor not found</h1>
        <Button onClick={() => navigate("/corridors")}>Back to atlas</Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
          Loading corridor…
        </div>
      </div>
    );
  }

  if (!corridor || error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-bold text-white mb-2">Corridor not found</h1>
        <p className="text-sm text-slate-400 mb-6">
          {error ?? `No corridor matched ${id}.`}
        </p>
        <Button onClick={() => navigate("/corridors")}>Back to atlas</Button>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(2,132,199,0.10) 0%, transparent 60%)",
        }}
      />
      <div className="max-w-7xl mx-auto px-6 py-8 pb-28">
        {/* Header */}
        <button
          onClick={() => navigate("/corridors")}
          className="text-xs text-slate-500 hover:text-xrp-400 mb-3 flex items-center gap-1"
        >
          ← Corridor atlas
        </button>
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className="text-xl leading-none">{corridor.flag}</span>
              <span className="rounded bg-slate-800/60 border border-slate-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                {kindLabel(corridorKind)}
              </span>
              <span className="rounded bg-slate-800/60 border border-slate-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300">
                {regionLabel(corridor.region)}
              </span>
              <span
                className="rounded bg-slate-800/60 border border-slate-700 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-slate-300"
                title="Internal priority score used to rank corridors in the atlas (higher = more important)"
              >
                Priority {corridor.importance}/99
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-0.5">{corridor.label}</h1>
            {/* Show the short label only when it actually adds information
                beyond the main "SRC → DST" title. The off-chain-bridge
                suffix duplicates the emerald banner right below, and the
                "(N routes)" suffix is redundant with the routes table
                header for on-chain-active corridors. */}
            {corridor.shortLabel !== corridor.label &&
              !corridor.shortLabel.includes("off-chain via") &&
              !corridor.shortLabel.includes("routes)") && (
                <div className="text-xs font-mono text-slate-500">
                  {corridor.shortLabel}
                </div>
              )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={corridor.status} />
            {/* Quote chips — shown only for on-chain-active corridors
                where path_find actually ran and returned a cost. The
                `amount` on CorridorRequest is the *destination* delivery
                amount (path_find takes destination_amount), and the
                winner's `recommendedCost` is the source spend required
                to deliver it. We surface both as honest numbers — no
                slippage %-computation since the implied FX rate varies. */}
            {corridorKind === "on-chain-active" &&
              corridor.bestRouteId &&
              (() => {
                const winner = corridor.routeResults.find(
                  (r) => r.routeId === corridor.bestRouteId,
                );
                const cost = winner?.recommendedCost;
                if (!cost) return null;
                const ratio = Number(cost) / Math.max(Number(corridor.amount), 1);
                const isBadQuote = ratio > 5;
                return (
                  <>
                    <Badge
                      variant="info"
                      title={`XRPL path_find target: deliver ${corridor.amount} ${corridor.dest.symbol} on the destination side via the best on-chain IOU route.`}
                    >
                      Deliver: {corridor.amount} {corridor.dest.symbol}
                    </Badge>
                    <Badge
                      variant={isBadQuote ? "med" : "info"}
                      title={
                        isBadQuote
                          ? `On-chain IOU quote from live XRPL path_find. This rate is poor because the on-chain ${corridor.source.symbol}↔${corridor.dest.symbol} orderbooks are thin. Real-world payments on this corridor use the off-chain partner network (RLUSD bridge) at much better rates.`
                          : `Source-side cost from live XRPL path_find via the winning on-chain IOU route (${winner?.label ?? ""}). This is a real on-ledger quote, not an estimate.`
                      }
                    >
                      Quote: {Number(cost).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}{" "}
                      {corridor.source.symbol}
                      {isBadQuote && " ⚠️"}
                    </Badge>
                  </>
                );
              })()}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              data-testid="refresh-corridor"
              title={
                corridorKind === "off-chain-bridge"
                  ? "Re-computes the corridor status from the actor registry. No XRPL scan runs — off-chain-bridge lanes have no on-ledger trust lines to path_find."
                  : "Runs a fresh XRPL path_find + liquidity scan across every candidate route."
              }
            >
              {refreshing
                ? "Refreshing…"
                : corridorKind === "off-chain-bridge"
                  ? "Recompute status"
                  : "Refresh scan"}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                navigate(
                  `/safe-path?srcCcy=${encodeURIComponent(corridor.source.symbol)}&dstCcy=${encodeURIComponent(corridor.dest.symbol)}&amount=${encodeURIComponent(corridor.amount ?? "1000")}`,
                )
              }
              className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white border-0"
              data-testid="corridor-to-safepath"
            >
              Analyze with Safe Path →
            </Button>
          </div>
        </div>

        {/* Corridor kind banner — the one-sentence story of what this
            page is showing. Driven by the corridorKind classifier so
            judges and users immediately understand whether they're
            looking at an on-chain XRPL lane, an off-chain-bridge lane
            via RLUSD, or a legacy on-chain lane whose real flow is now
            off-chain. Prevents the "why are these two sections telling
            different stories?" confusion on corridors like CHF→USD. */}
        <CorridorKindBanner kind={corridorKind} corridor={corridor} />

        {/* AI note */}
        <Card className="mb-4" data-testid="ai-note-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI commentary</CardTitle>
          </CardHeader>
          <CardContent>
            {corridor.aiNote ? (
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {corridor.aiNote}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No AI commentary yet — the first refresh hasn't generated one for
                this corridor. Click "Refresh scan" to force one.
              </p>
            )}
            <div className="mt-3 text-[10px] uppercase tracking-widest text-slate-600">
              {corridor.lastRefreshedAt
                ? `${corridorKind === "off-chain-bridge" ? "Last refreshed" : "Last scan"}: ${new Date(corridor.lastRefreshedAt).toLocaleString("en-GB", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                : corridorKind === "off-chain-bridge"
                  ? "Never refreshed"
                  : "Never scanned"}
            </div>
          </CardContent>
        </Card>

        {/* 30-day status timeline — append-only history from the
            CorridorStatusEvent log. Gives judges the "is this corridor
            actually alive?" signal at a glance. */}
        <div className="mb-4">
          <CorridorStatusSparkline corridorId={id} days={30} />
        </div>

        {/* Off-chain ramp actors — shown for every corridor that has a
            populated sourceActors / destActors list (research atlas). For
            off-chain-bridge corridors this is the ONLY routing info; for
            on-chain corridors it enriches the XRPL graph with the real-world
            partners on each leg. */}
        {(corridor.sourceActors?.length || corridor.destActors?.length) && (
          <Card className="mb-4" data-testid="corridor-actors-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Real-world on/off-ramp actors
                <span className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  · XRPL hop: {corridor.bridgeAsset ?? "RLUSD"}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Live partner depth — the "measured, not assumed"
                  proof-of-concept. Renders ONLY for corridors where a
                  partner public orderbook feed is wired. Marked
                  explicitly as v1/demo so judges see both the
                  research-based classification and the live depth side
                  by side — and understand the v2 vision: every actor
                  row gets its own measured feed. */}
              {PARTNER_DEPTH_CORRIDORS[id] && (
                <PartnerDepthBadge
                  corridorId={id}
                  actor={PARTNER_DEPTH_CORRIDORS[id].actor}
                  actorLabel={PARTNER_DEPTH_CORRIDORS[id].label}
                  baseSymbol={PARTNER_DEPTH_CORRIDORS[id].base}
                  quoteSymbol={PARTNER_DEPTH_CORRIDORS[id].quote}
                />
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ActorColumn
                  title={`${corridor.source.symbol} on-ramps`}
                  flag={corridor.source.flag}
                  actors={corridor.sourceActors ?? []}
                />
                <ActorColumn
                  title={`${corridor.dest.symbol} off-ramps`}
                  flag={corridor.dest.flag}
                  actors={corridor.destActors ?? []}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* XRPL on-chain IOU orderbook — shown ONLY when the corridor
            actually has live on-ledger liquidity (corridorKind
            "on-chain-active"). For off-chain-bridge corridors there is
            nothing on-chain to compare; for legacy on-chain corridors
            (all routes RED with zero paths) we hide this section
            entirely and let the actor graph tell the story — otherwise
            judges see a dead XRPL orderbook next to a live CEX graph
            and think the corridor is broken. */}
        {corridorKind === "on-chain-active" && (
        <>
        <Card className="mb-4" data-testid="routes-comparison">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              XRPL on-chain IOU orderbook
              <span className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                · {corridor.routeResults.length} candidate
                {corridor.routeResults.length !== 1 ? "s" : ""} · reference depth
              </span>
            </CardTitle>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              These are direct IOU trust lines on XRPL. Modern fiat
              payments on this corridor flow through the real-world
              partner graph below (via {corridor.bridgeAsset ?? "RLUSD"}
              ); the numbers here are a complementary on-ledger depth
              snapshot, not an alternative route.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
                  <th className="text-left py-2 pr-3">Route</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-right py-2 pr-3">Paths</th>
                  <th className="text-right py-2 pr-3">Risk</th>
                  <th className="text-left py-2 pr-3">Liquidity</th>
                  <th className="text-left py-2">Verdict</th>
                </tr>
              </thead>
              <tbody>
                {corridor.routeResults.map((r) => (
                  <RouteRow
                    key={r.routeId}
                    route={r}
                    selected={r.routeId === selectedRouteId}
                    onSelect={() => setSelectedRouteId(r.routeId)}
                  />
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Selected route detail */}
        {selectedRoute && (
          <Card className="mb-4" data-testid="selected-route-card">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-sm">
                Route detail: {selectedRoute.label}
              </CardTitle>
              {selectedRoute.isWinner && (
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                  Winner
                </span>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              <RouteLiquidityPanel route={selectedRoute} destSymbol={corridor.dest.symbol} />
              {selectedRoute.flags.length > 0 && (
                <div className="space-y-1">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                    Risk flags ({selectedRoute.flags.length})
                  </div>
                  <div className="flex flex-wrap gap-1" data-testid="route-flags">
                    {selectedRoute.flags.map((f) => (
                      <span
                        key={f.flag}
                        title={f.detail}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          f.severity === "HIGH"
                            ? "bg-red-500/10 text-red-400 border border-red-500/30"
                            : f.severity === "MED"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-slate-700/40 text-slate-400 border border-slate-700"
                        }`}
                      >
                        {f.flag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {selectedRoute.rationale && (
                <p className="text-xs text-slate-400 italic">
                  Rationale: {selectedRoute.rationale}
                </p>
              )}
              {selectedRoute.rejectedReason && (
                <p className="text-xs text-amber-400">
                  Picker rejected: {selectedRoute.rejectedReason}
                </p>
              )}
            </CardContent>
          </Card>
        )}
        </>
        )}

        {/* Static description + highlights — hidden for off-chain-bridge
            corridors because the auto-generated description is a literal
            substring of the AI commentary, and the highlights bullets
            ("N on-ramps · N off-ramps") duplicate the actor card above.
            Kept for on-chain-active corridors where the override copy
            (for USD-EUR, USD-CNY, etc.) adds curated context on top of
            the AI note. */}
        {corridorKind !== "off-chain-bridge" && (
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">What this corridor is</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-400">
              <p className="leading-relaxed">{corridor.description}</p>
              <p className="text-slate-500 italic">Use case: {corridor.useCase}</p>
              {corridor.highlights.length > 0 && (
                <ul className="list-disc list-inside space-y-1 text-slate-300">
                  {corridor.highlights.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Real-world actor graph — the ONLY graph on this page. Shown
            for every corridor that has a populated actor registry
            (on-chain or off-chain-bridge). The XRPL routes graph has been
            removed at user request: the actor graph tells the full real-
            world story and the routes-comparison table above surfaces the
            on-chain route numbers in tabular form for on-chain corridors. */}
        {(corridor.sourceActors?.length || corridor.destActors?.length) && (
          <Card className="mb-4" data-testid="actor-graph-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                Real-world partner graph
                <span className="ml-2 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                  · settles via {corridor.bridgeAsset ?? "RLUSD"} on XRPL
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <CorridorActorGraph corridor={corridor} height={600} />
            </CardContent>
          </Card>
        )}

        {/* Related corridors */}
        {related.length > 0 && (
          <Card data-testid="related-corridors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Related corridors</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {related.map((r) => (
                <button
                  key={r.id}
                  onClick={() => navigate(`/corridors/${r.id}`)}
                  className="text-left bg-slate-900/50 border border-slate-800 rounded px-3 py-2 hover:border-xrp-500 transition"
                >
                  <div className="text-xs font-semibold text-white">{r.label}</div>
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {r.shortLabel}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusBadge status={r.status} />
                    <span className="text-[9px] text-slate-500">imp {r.importance}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Floating chat bubble bound to this corridor */}
      <CorridorChatBubble corridorId={id} />
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    RED: "bg-red-500/15 text-red-400 border border-red-500/40",
    AMBER: "bg-amber-500/15 text-amber-400 border border-amber-500/40",
    GREEN: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40",
    UNKNOWN: "bg-slate-700/30 text-slate-400 border border-slate-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase ${
        map[status] ?? map.UNKNOWN
      }`}
    >
      {status}
    </span>
  );
}

function RouteRow({
  route,
  selected,
  onSelect,
}: {
  route: CorridorRouteResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const liqStr = (() => {
    const parts: string[] = [];
    if (route.liquidity?.xrpLeg)
      parts.push(`xrp ${route.liquidity.xrpLeg.toIouOffers}/${route.liquidity.xrpLeg.toXrpOffers}`);
    if (route.liquidity?.directBook)
      parts.push(
        `direct ${route.liquidity.directBook.fwdOffers}/${route.liquidity.directBook.revOffers}`,
      );
    if (route.liquidity?.amm?.xrpReserve) {
      const xrp = Number(route.liquidity.amm.xrpReserve) / 1_000_000;
      parts.push(`AMM ${Math.round(xrp)} XRP`);
    }
    return parts.join(" · ") || "—";
  })();

  return (
    <tr
      onClick={onSelect}
      data-testid={`route-row-${route.routeId}`}
      className={`border-b border-slate-900 cursor-pointer transition ${
        selected ? "bg-xrp-500/10" : "hover:bg-slate-900/40"
      }`}
    >
      <td className="py-2 pr-3">
        <div className="text-white">{route.label}</div>
        <div className="text-[10px] font-mono text-slate-600">{route.routeId}</div>
      </td>
      <td className="py-2 pr-3">
        <StatusBadge status={route.status} />
      </td>
      <td className="py-2 pr-3 text-right text-white">{route.pathCount}</td>
      <td className="py-2 pr-3 text-right">
        <span
          className={
            route.recommendedRiskScore != null && route.recommendedRiskScore > 20
              ? "text-red-400"
              : route.recommendedRiskScore != null && route.recommendedRiskScore > 0
              ? "text-amber-400"
              : "text-emerald-400"
          }
        >
          {route.recommendedRiskScore ?? "—"}
        </span>
      </td>
      <td className="py-2 pr-3 text-slate-400 font-mono text-[11px]">{liqStr}</td>
      <td className="py-2 text-[11px]">
        {route.isWinner ? (
          <span className="text-emerald-400 font-semibold">★ winner</span>
        ) : route.rejectedReason ? (
          <span className="text-slate-500" title={route.rejectedReason}>
            rejected
          </span>
        ) : (
          <span className="text-slate-500">alternative</span>
        )}
      </td>
    </tr>
  );
}

function RouteLiquidityPanel({
  route,
  destSymbol,
}: {
  route: CorridorRouteResult;
  destSymbol: string;
}) {
  const liq = route.liquidity;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400">
      {liq?.xrpLeg && (
        <LiquidityRow
          label="XRP ↔ destination orderbook"
          value={`${liq.xrpLeg.toIouOffers} / ${liq.xrpLeg.toXrpOffers}`}
          hint="XRP→IOU / IOU→XRP offers"
        />
      )}
      {liq?.directBook && (
        <LiquidityRow
          label="Direct cross-book"
          value={`${liq.directBook.fwdOffers} / ${liq.directBook.revOffers}`}
          hint="fwd / rev offers"
        />
      )}
      {liq?.amm?.xrpReserve && (
        <LiquidityRow
          label="AMM pool"
          value={`${Math.round(Number(liq.amm.xrpReserve) / 1_000_000).toLocaleString()} XRP`}
          hint={
            liq.amm.iouReserve
              ? `+ ${Number(liq.amm.iouReserve).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${destSymbol}`
              : ""
          }
        />
      )}
      {liq?.issuerObligation && (
        <LiquidityRow
          label="Issuer float"
          value={`${Number(liq.issuerObligation).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${destSymbol}`}
          hint="outstanding obligation"
        />
      )}
      {!liq && (
        <p className="col-span-2 text-slate-500 italic">No liquidity scan recorded for this route.</p>
      )}
    </div>
  );
}

// ─── Header chip label helpers ──────────────────────────────────────────
// Turn internal enum values (FIAT-FIAT, CROSS, OFF-CHAIN-BRIDGE) into
// human-readable chip text. These are rendered in the small metadata row
// right above the corridor title and are the first thing a judge sees —
// so they must not look like raw enum dumps.

function kindLabel(
  kind: "off-chain-bridge" | "on-chain-legacy" | "on-chain-active",
): string {
  switch (kind) {
    case "off-chain-bridge":
      return "Off-chain bridge";
    case "on-chain-legacy":
      return "Hybrid (legacy XRPL)";
    case "on-chain-active":
      return "XRPL-native";
  }
}

function regionLabel(region: string): string {
  switch (region) {
    case "global":
      return "Global";
    case "europe":
      return "Europe";
    case "asia":
      return "Asia";
    case "oceania":
      return "Oceania";
    case "latam":
      return "LatAm";
    case "africa":
      return "Africa";
    case "middle_east":
      return "Middle East";
    case "cross":
      return "Cross-region";
    default:
      return region;
  }
}

// ─── Corridor kind banner ───────────────────────────────────────────────
// A one-sentence story explaining what the user is looking at. Sits at
// the top of the detail page so there's never ambiguity between the
// real-world partner graph and whatever legacy XRPL section follows.

function CorridorKindBanner({
  kind,
  corridor,
}: {
  kind: "off-chain-bridge" | "on-chain-legacy" | "on-chain-active";
  corridor: CorridorDetailResponse;
}) {
  const bridge = corridor.bridgeAsset ?? "RLUSD";
  if (kind === "off-chain-bridge") {
    return (
      <div
        data-testid="corridor-kind-banner"
        className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3"
      >
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-emerald-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
          Off-chain rail via {bridge} on XRPL
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
          This corridor has <strong>no on-chain IOU trust lines</strong> on
          either side. The real flow is: <span className="font-mono">{corridor.source.symbol}</span> →
          off-chain partner → <span className="font-mono">{bridge}</span> held
          on XRPL by the partner → off-chain partner on the destination side
          → <span className="font-mono">{corridor.dest.symbol}</span>. The
          graph below shows the real partners end-to-end. CorLens does not
          path_find this lane — status is derived from partner quality, not
          on-ledger depth.
        </p>
      </div>
    );
  }
  if (kind === "on-chain-legacy") {
    return (
      <div
        data-testid="corridor-kind-banner"
        className="mb-4 rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3"
      >
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-sky-300">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(14,165,233,0.8)]" />
          Hybrid corridor · legacy XRPL IOUs + live off-chain rails
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
          This corridor <em>does</em> have on-chain XRPL IOU trust lines
          (historically via GateHub / Bitstamp) but they are effectively
          dead — zero live paths on the last scan. The real flow today
          runs through the off-chain partners below and bridges via{" "}
          <span className="font-mono">{bridge}</span> on XRPL. We hide the
          legacy XRPL orderbook section here so the page tells one coherent
          story; status is governed by the real-world rail, not the
          deprecated IOU depth.
        </p>
      </div>
    );
  }
  // on-chain-active
  return (
    <div
      data-testid="corridor-kind-banner"
      className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3"
    >
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-amber-300">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.8)]" />
        XRPL-native corridor · on-chain IOU orderbook + off-chain rails
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-slate-300">
        This corridor has live on-chain XRPL liquidity via direct IOU
        trust lines — the routes table below scans real orderbooks, AMM
        pools, and path_find results. It <em>also</em> has a full
        real-world partner rail via{" "}
        <span className="font-mono">{bridge}</span>, shown in the graph
        below. Both are valid ways to move{" "}
        <span className="font-mono">{corridor.source.symbol}</span> →{" "}
        <span className="font-mono">{corridor.dest.symbol}</span>; the
        on-chain numbers show the best-case direct XRPL depth, the
        partner graph shows who actually handles retail flow today.
      </p>
    </div>
  );
}

// ─── Actor column (off-chain ramp registry) ─────────────────────────────
// Renders one side of the corridor's real-world partner list. Each row is
// colour-coded by actor type: ODL partners in blue, CEXes in slate, banks
// in purple, mobile-money bridges in amber.

function actorBadge(type: CorridorActor["type"]): string {
  switch (type) {
    case "odl": return "border-sky-500/40 text-sky-300 bg-sky-500/10";
    case "bank": return "border-violet-500/40 text-violet-300 bg-violet-500/10";
    case "custodian": return "border-violet-500/40 text-violet-300 bg-violet-500/10";
    case "hub": return "border-cyan-500/40 text-cyan-300 bg-cyan-500/10";
    case "remittance": return "border-emerald-500/40 text-emerald-300 bg-emerald-500/10";
    case "mobile-money": return "border-amber-500/40 text-amber-300 bg-amber-500/10";
    case "fintech": return "border-teal-500/40 text-teal-300 bg-teal-500/10";
    case "otc": return "border-fuchsia-500/40 text-fuchsia-300 bg-fuchsia-500/10";
    case "p2p": return "border-rose-500/40 text-rose-300 bg-rose-500/10";
    case "cex": default: return "border-slate-600 text-slate-300 bg-slate-800/40";
  }
}

function ActorColumn({
  title,
  flag,
  actors,
}: {
  title: string;
  flag: string;
  actors: CorridorActor[];
}) {
  if (actors.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          <span className="text-sm">{flag}</span>
          {title}
        </div>
        <div className="text-[11px] italic text-slate-500">
          No actor recorded in the research atlas. This currency is either
          sanctioned, under a crypto ban, or only reachable via an ODL
          super-hub (Tranglo, Onafriq).
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">
        <span className="text-sm">{flag}</span>
        {title}
        <span className="ml-auto font-mono text-[9px] text-slate-600">
          {actors.length}
        </span>
      </div>
      <ul className="space-y-1.5">
        {actors.map((a) => (
          <li
            key={a.key}
            className="flex items-start gap-2 text-[11px]"
            data-testid={`actor-${a.key}`}
          >
            <span
              className={`mt-0.5 inline-block rounded border px-1 py-0 font-mono text-[9px] uppercase tracking-wider ${actorBadge(a.type)}`}
            >
              {a.type}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-white truncate">
                  {a.name}
                </span>
                {a.country && (
                  <span className="font-mono text-[9px] text-slate-500">
                    {a.country}
                  </span>
                )}
                {a.odl && (
                  <span className="rounded bg-sky-500/15 border border-sky-500/40 px-1 text-[9px] font-bold text-sky-300 uppercase tracking-wider">
                    ODL
                  </span>
                )}
                {a.supportsRlusd && (
                  <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-1 text-[9px] font-bold text-emerald-300 uppercase tracking-wider">
                    RLUSD
                  </span>
                )}
                {a.supportsXrp && (
                  <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1 text-[9px] font-bold text-amber-300 uppercase tracking-wider">
                    XRP
                  </span>
                )}
              </div>
              {a.note && (
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {a.note}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LiquidityRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-800 pb-1 last:border-0">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
        {hint && <div className="text-[9px] text-slate-600">{hint}</div>}
      </div>
      <div className="font-mono text-sm text-white">{value}</div>
    </div>
  );
}
