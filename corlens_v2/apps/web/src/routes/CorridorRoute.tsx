import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import type { CorridorListItem } from "../lib/core-types.js";
import { api } from "../api/index.js";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";

// ─── Corridor Route Calculator ───────────────────────────────────────────
//
// Turns the corridor atlas from a browseable directory into a **decision
// tool**. The user picks a source currency + destination currency +
// amount; we look up the matching catalog entry, classify it, surface the
// top actors by rank (ODL first, then RLUSD-supporting, then XRP-only),
// and show a one-line verdict.
//
// URL is the source of truth: ?from=USD&to=MXN&amount=1000 — which makes
// every result shareable / embeddable. Used in the hackathon demo as the
// "given a payment intent, which corridor should I use?" user story.

// ─── Helpers ─────────────────────────────────────────────────────────────

function corridorIdFor(from: string, to: string): string {
  return `${from.toLowerCase()}-${to.toLowerCase()}`;
}

function rankActors(list: CorridorListItem["sourceActors"] = []) {
  const scored = (list ?? []).map((a) => {
    let score = 0;
    if (a.odl) score += 100;
    if (a.supportsRlusd) score += 50;
    if (a.supportsXrp) score += 10;
    // Stable tiebreaker: hubs rank above plain CEXes at equal score
    if (a.type === "hub") score += 5;
    if (a.type === "odl") score += 5;
    return { a, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.a);
}

function statusGradient(status: string): string {
  switch (status) {
    case "GREEN":
      return "from-emerald-500/15 to-emerald-500/5 border-emerald-500/40";
    case "AMBER":
      return "from-amber-500/15 to-amber-500/5 border-amber-500/40";
    case "RED":
      return "from-red-500/15 to-red-500/5 border-red-500/40";
    default:
      return "from-slate-700/15 to-slate-700/5 border-slate-700";
  }
}

function statusText(status: string): string {
  switch (status) {
    case "GREEN":
      return "Production-ready rail";
    case "AMBER":
      return "Usable for small flows";
    case "RED":
      return "Not recommended";
    default:
      return "Status pending";
  }
}

function kindLabelFromCategory(category: string, routeCount: number): string {
  if (category === "off-chain-bridge") return "Off-chain bridge";
  if (routeCount === 0) return "Hybrid (legacy XRPL)";
  return "XRPL-native";
}

// Rough human-readable delivered-amount estimator for on-chain-active
// corridors. We pull the recommendedCost from the winning route (XRP-denom
// sourceAmount) and show the requested send amount unchanged on the other
// side as a "0-slippage optimistic floor" — the real delivered amount is
// path-specific and rendered on the corridor detail page.

// ─── Page ─────────────────────────────────────────────────────────────────

export default function CorridorRoute() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const fromParam = (params.get("from") || "USD").toUpperCase();
  const toParam = (params.get("to") || "MXN").toUpperCase();
  const amountParam = params.get("amount") || "1000";

  // Local form state is independent of the URL so the user can type
  // without every keystroke bouncing the URL + refetching.
  const [fromInput, setFromInput] = useState(fromParam);
  const [toInput, setToInput] = useState(toParam);
  const [amountInput, setAmountInput] = useState(amountParam);

  const [allCorridors, setAllCorridors] = useState<CorridorListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listCorridors()
      .then((res) => setAllCorridors(res.corridors))
      .finally(() => setLoading(false));
  }, []);

  // The canonical result is the catalog entry matching `${from}-${to}`. If
  // the user requests a pair we don't have (e.g. both sides have no
  // actors), we surface that as "no corridor" with a suggestion.
  const corridor = useMemo(() => {
    const id = corridorIdFor(fromParam, toParam);
    return allCorridors.find((c) => c.id === id) ?? null;
  }, [allCorridors, fromParam, toParam]);

  // Unique list of fiat currencies the user can route between (anything
  // that has a matching corridor in either direction). Derived from the
  // corridor catalog so new currencies show up automatically as the
  // atlas grows.
  const availableCurrencies = useMemo(() => {
    const set = new Set<string>();
    for (const c of allCorridors) {
      if (c.source.type === "fiat" || c.source.type === "stable") {
        set.add(c.source.symbol);
      }
      if (c.dest.type === "fiat" || c.dest.type === "stable") {
        set.add(c.dest.symbol);
      }
    }
    return Array.from(set).sort();
  }, [allCorridors]);

  const topSrcActors = useMemo(
    () => rankActors(corridor?.sourceActors).slice(0, 3),
    [corridor],
  );
  const topDstActors = useMemo(
    () => rankActors(corridor?.destActors).slice(0, 3),
    [corridor],
  );

  const submit = () => {
    setParams({
      from: fromInput.toUpperCase(),
      to: toInput.toUpperCase(),
      amount: amountInput,
    });
  };

  const swap = () => {
    const f = fromInput;
    setFromInput(toInput);
    setToInput(f);
    setParams({
      from: toInput.toUpperCase(),
      to: fromInput.toUpperCase(),
      amount: amountInput,
    });
  };

  const kind = corridor
    ? kindLabelFromCategory(corridor.category, corridor.routeResults?.length ?? 0)
    : null;

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(14,165,233,0.18) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(2,132,199,0.10) 0%, transparent 60%)",
        }}
      />
      <div className="max-w-4xl mx-auto px-6 py-10 pb-28">
        <button
          onClick={() => navigate("/corridors")}
          className="text-xs text-slate-500 hover:text-xrp-400 mb-3 flex items-center gap-1"
        >
          ← Corridor atlas
        </button>

        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.3em] text-cyan-300/80">
          Route calculator
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">
          Which XRPL corridor should I use?
        </h1>
        <p className="text-sm text-slate-400 mb-8 max-w-2xl">
          Pick a source currency, destination, and amount. CorLens tells you
          which corridor in the atlas matches, classifies how it settles on
          XRPL, and ranks the top real-world partners on each leg.
        </p>

        {/* ── Input form ── */}
        <Card className="mb-6" data-testid="route-form">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  From
                </label>
                <CurrencySelect
                  value={fromInput}
                  onChange={setFromInput}
                  options={availableCurrencies}
                  testid="route-from"
                />
              </div>
              <button
                type="button"
                onClick={swap}
                className="mb-1 rounded border border-slate-700 bg-slate-800/50 px-3 py-2 text-sm text-slate-300 hover:border-xrp-500 hover:text-white"
                title="Swap source and destination"
                data-testid="route-swap"
              >
                ⇄
              </button>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  To
                </label>
                <CurrencySelect
                  value={toInput}
                  onChange={setToInput}
                  options={availableCurrencies}
                  testid="route-to"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Amount
                </label>
                <input
                  type="text"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
                  className="w-32 rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-mono text-white focus:border-xrp-500 focus:outline-none"
                  data-testid="route-amount"
                />
              </div>
              <Button
                onClick={submit}
                className="mb-0"
                data-testid="route-submit"
              >
                Route
              </Button>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap text-[10px] text-slate-500">
              <span>Try:</span>
              {[
                ["USD", "MXN", "1000"],
                ["USD", "NGN", "500"],
                ["JPY", "PHP", "100000"],
                ["AED", "INR", "3700"],
                ["EUR", "BRL", "1000"],
              ].map(([f, t, a]) => (
                <button
                  key={`${f}-${t}`}
                  type="button"
                  onClick={() => {
                    setFromInput(f);
                    setToInput(t);
                    setAmountInput(a);
                    setParams({ from: f, to: t, amount: a });
                  }}
                  className="rounded border border-slate-800 px-2 py-0.5 text-slate-400 hover:border-xrp-500 hover:text-white font-mono"
                >
                  {f}→{t}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Result ── */}
        {loading && (
          <div className="text-slate-500 text-sm">Loading atlas…</div>
        )}

        {!loading && !corridor && (
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-2xl mb-2">🤷</div>
              <div className="text-white text-sm font-semibold mb-1">
                No corridor in the atlas for {fromParam} → {toParam}
              </div>
              <div className="text-xs text-slate-500 mb-4">
                Either one of these currencies has no actors in the research
                atlas yet, or the pair is sanctioned / banned (e.g. RUB).
                Try swapping the direction or picking another currency.
              </div>
              <Button
                variant="secondary"
                onClick={() => navigate("/corridors")}
              >
                Browse all corridors
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && corridor && (
          <>
            {/* Verdict card */}
            <div
              className={`rounded-2xl border bg-gradient-to-br px-6 py-5 mb-4 ${statusGradient(corridor.status)}`}
              data-testid="route-verdict"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-white/60 mb-1">
                    <span>{corridor.flag}</span>
                    <span>{kind}</span>
                    <span>·</span>
                    <span>{corridor.status}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {amountParam} {fromParam} → {toParam}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {statusText(corridor.status)} · via{" "}
                    <span className="font-mono">
                      {corridor.bridgeAsset ?? "RLUSD"}
                    </span>{" "}
                    on XRPL
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/corridors/${corridor.id}`)}
                    data-testid="route-open-detail"
                  >
                    Corridor detail →
                  </Button>
                  <Button
                    onClick={() =>
                      navigate(
                        `/safe-path?srcCcy=${encodeURIComponent(fromParam)}&dstCcy=${encodeURIComponent(toParam)}&amount=${encodeURIComponent(amountParam)}`,
                      )
                    }
                    data-testid="route-ai-agent"
                    className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white border-0"
                  >
                    Validate with AI Agent →
                  </Button>
                </div>
              </div>
            </div>

            {/* Top partners */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <PartnerColumn
                title={`Best ${fromParam} on-ramps`}
                actors={topSrcActors}
              />
              <PartnerColumn
                title={`Best ${toParam} off-ramps`}
                actors={topDstActors}
              />
            </div>

            {/* How this route settles — one paragraph narrative */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">How this route settles</CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-slate-300 leading-relaxed">
                {corridor.category === "off-chain-bridge" ? (
                  <>
                    There are no on-chain IOU trust lines between {fromParam}{" "}
                    and {toParam}, so XRPL path_find cannot quote this lane
                    directly. Instead the flow is:
                    <span className="block mt-2 font-mono text-[11px] bg-slate-900/60 rounded px-3 py-2 border border-slate-800">
                      {amountParam} {fromParam} →{" "}
                      <span className="text-emerald-300">
                        {topSrcActors[0]?.name ?? "source partner"}
                      </span>{" "}
                      →{" "}
                      <span className="text-emerald-300">
                        {corridor.bridgeAsset ?? "RLUSD"} on XRPL
                      </span>{" "}
                      →{" "}
                      <span className="text-amber-300">
                        {topDstActors[0]?.name ?? "destination partner"}
                      </span>{" "}
                      → {toParam}
                    </span>
                    <span className="block mt-2 text-slate-400">
                      Status is derived from real-world partner quality
                      (ODL + RLUSD + breadth), not on-ledger depth.
                      Production-ready rails (GREEN) have Ripple ODL
                      partners on both sides.
                    </span>
                  </>
                ) : (
                  <>
                    This corridor has live on-chain XRPL IOU trust lines.
                    CorLens runs path_find + liquidity scans against real
                    orderbooks on every refresh. The winning route is:
                    <span className="block mt-2 font-mono text-[11px] bg-slate-900/60 rounded px-3 py-2 border border-slate-800">
                      {corridor.routeResults?.find((r) => r.isWinner)?.label ??
                        "XRPL direct IOU path"}
                    </span>
                    <span className="block mt-2 text-slate-400">
                      Status reflects live XRPL orderbook depth and pathfind
                      results from the last scan. Open the detail page for
                      the full route comparison and liquidity breakdown.
                    </span>
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────

function CurrencySelect({
  value,
  onChange,
  options,
  testid,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testid: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm font-mono text-white focus:border-xrp-500 focus:outline-none"
      data-testid={testid}
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

function PartnerColumn({
  title,
  actors,
}: {
  title: string;
  actors: NonNullable<CorridorListItem["sourceActors"]>;
}) {
  return (
    <Card data-testid="route-partner-column">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {actors.length === 0 ? (
          <div className="text-[11px] italic text-slate-500">
            No actor registered — lane may be sanctioned or offshore-only.
          </div>
        ) : (
          actors.map((a, idx) => (
            <div
              key={a.key}
              className="rounded border border-slate-800 bg-slate-900/40 px-3 py-2 flex items-start gap-2"
            >
              <div
                className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  idx === 0
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}
              >
                {idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-white truncate">
                    {a.name}
                  </span>
                  {a.country && (
                    <span className="font-mono text-[9px] text-slate-500">
                      {a.country}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[9px] uppercase tracking-wider">
                  <span className="text-slate-500">{a.type}</span>
                  {a.odl && (
                    <Badge variant="info" className="text-[9px] px-1 py-0">
                      ODL
                    </Badge>
                  )}
                  {a.supportsRlusd && (
                    <Badge variant="low" className="text-[9px] px-1 py-0 bg-emerald-500/15 text-emerald-300 border-emerald-500/40">
                      RLUSD
                    </Badge>
                  )}
                  {a.supportsXrp && (
                    <Badge variant="med" className="text-[9px] px-1 py-0">
                      XRP
                    </Badge>
                  )}
                </div>
                {a.note && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {a.note}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
