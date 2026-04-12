import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CorridorListItem } from "@corlens/core";
import { api } from "../api/client";
import { Card, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { CorridorChatBubble } from "../components/corridors/CorridorChatBubble";
import { CorridorGlobe } from "../components/corridors/CorridorGlobe";
import { SelectFilter } from "../fragments/CorridorHealth/SelectFilter";
import { CorridorCard } from "../fragments/CorridorHealth/CorridorCard";

// ─── Corridor Atlas (pair view) ─────────────────────────────────────────
// Each card represents a fiat-pair corridor (USD→EUR, USD→CNY, …). The
// underlying multi-route picker has already chosen the winning issuer
// combination — we surface the winner's stats here and link to the detail
// page where every candidate route is compared side-by-side.

type StatusFilter = "ALL" | "GREEN" | "AMBER" | "RED" | "UNKNOWN";

const CATEGORY_LABEL: Record<string, string> = {
  ALL: "All",
  "fiat-fiat": "Fiat ↔ Fiat",
  "stable-onramp": "Stablecoin On-ramp",
  "stable-offramp": "Stablecoin Off-ramp",
  "xrp-offramp": "XRP Off-ramp",
  "crypto-spot": "Crypto Spot",
  special: "Special",
};

export default function CorridorHealth() {
  const navigate = useNavigate();
  const [corridors, setCorridors] = useState<CorridorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [currencyFrom, setCurrencyFrom] = useState<string>("ALL");
  const [currencyTo, setCurrencyTo] = useState<string>("ALL");
  const [region, setRegion] = useState<string>("ALL");
  const [category, setCategory] = useState<string>("ALL");
  const [status, setStatus] = useState<StatusFilter>("ALL");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .listCorridors()
      .then((res) => {
        if (!cancelled) setCorridors(res.corridors);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to load corridors");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const optionFromCurrencies = useMemo(
    () => uniqueSorted(corridors.map((c) => c.source.symbol)),
    [corridors],
  );
  const optionToCurrencies = useMemo(
    () => uniqueSorted(corridors.map((c) => c.dest.symbol)),
    [corridors],
  );
  const optionRegions = useMemo(
    () => uniqueSorted(corridors.map((c) => c.region)),
    [corridors],
  );
  const optionCategories = useMemo(
    () => uniqueSorted(corridors.map((c) => c.category)),
    [corridors],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return corridors
      .filter((c) => {
        if (status !== "ALL" && c.status !== status) return false;
        if (currencyFrom !== "ALL" && c.source.symbol !== currencyFrom)
          return false;
        if (currencyTo !== "ALL" && c.dest.symbol !== currencyTo) return false;
        if (region !== "ALL" && c.region !== region) return false;
        if (category !== "ALL" && c.category !== category) return false;
        if (needle) {
          const blob =
            `${c.label} ${c.shortLabel} ${c.description} ${c.useCase} ${c.category} ${c.aiNote ?? ""} ${c.routeResults.map((r) => r.label).join(" ")}`.toLowerCase();
          if (!blob.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => b.importance - a.importance);
  }, [corridors, search, currencyFrom, currencyTo, region, category, status]);

  const counts = useMemo(() => {
    const acc = { RED: 0, AMBER: 0, GREEN: 0, UNKNOWN: 0 };
    for (const c of filtered) acc[c.status] = (acc[c.status] ?? 0) + 1;
    return acc;
  }, [filtered]);

  const resetFilters = () => {
    setSearch("");
    setCurrencyFrom("ALL");
    setCurrencyTo("ALL");
    setRegion("ALL");
    setCategory("ALL");
    setStatus("ALL");
  };

  return (
    <div className="app-content-min-height relative overflow-hidden">
      <div
        aria-hidden
        className="route-atmosphere pointer-events-none absolute inset-0 -z-10"
      />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-6">
          <div className="text-xs font-bold uppercase tracking-widest text-xrp-400 mb-2">
            2,436 live corridors · 48 currencies · ~200 actors
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            XRPL Corridor Atlas
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Every fiat-to-fiat lane that can settle through XRPL — classified
            by how it actually moves money: native IOU orderbooks, hybrid
            legacy, or off-chain RLUSD bridge via named partners. Click any
            corridor for AI commentary, 30-day status history, and the full
            real-world actor registry.
          </p>
        </div>

        {/* ─── 3D Globe — fiat-fiat corridor network ─── */}
        <div className="mb-8">
          <CorridorGlobe
            corridors={corridors}
            onCorridorClick={(id) => navigate(`/corridors/${id}`)}
          />
        </div>

        {/* ─── Filter bar ─── */}
        <Card className="mb-6" data-testid="corridor-filters">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                  Search
                </label>
                <input
                  data-testid="filter-search"
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. RLUSD, RippleFox, on-ramp…"
                  className="w-full bg-slate-900/60 border border-slate-800 rounded px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-xrp-500"
                />
              </div>
              <SelectFilter
                testId="filter-from"
                label="From"
                value={currencyFrom}
                onChange={setCurrencyFrom}
                options={["ALL", ...optionFromCurrencies]}
              />
              <SelectFilter
                testId="filter-to"
                label="To"
                value={currencyTo}
                onChange={setCurrencyTo}
                options={["ALL", ...optionToCurrencies]}
              />
              <SelectFilter
                testId="filter-region"
                label="Region"
                value={region}
                onChange={setRegion}
                options={["ALL", ...optionRegions]}
              />
              <SelectFilter
                testId="filter-category"
                label="Category"
                value={category}
                onChange={setCategory}
                options={["ALL", ...optionCategories]}
                labelMap={CATEGORY_LABEL}
              />
              <div>
                <label className="text-[10px] uppercase tracking-wide text-slate-500 block mb-1">
                  Status
                </label>
                <div className="flex gap-1" data-testid="filter-status">
                  {(
                    [
                      "ALL",
                      "GREEN",
                      "AMBER",
                      "RED",
                      "UNKNOWN",
                    ] as StatusFilter[]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      data-testid={`status-${s}`}
                      className={`px-2 py-1 text-[10px] font-bold tracking-wide rounded border transition ${
                        status === s
                          ? "border-xrp-500 bg-xrp-500/20 text-xrp-300"
                          : "border-slate-700 text-slate-400 hover:border-slate-500"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            </div>
            <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
              <span data-testid="result-count">
                {filtered.length} of {corridors.length} corridors
              </span>
              <Badge variant="high">RED {counts.RED}</Badge>
              <Badge variant="med">AMBER {counts.AMBER}</Badge>
              <Badge variant="low">GREEN {counts.GREEN}</Badge>
              {counts.UNKNOWN > 0 && (
                <span className="text-slate-600">UNKNOWN {counts.UNKNOWN}</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Grid ─── */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-8">
            <span className="inline-block w-4 h-4 border-2 border-slate-600 border-t-slate-300 rounded-full animate-spin" />
            Loading corridor atlas…
          </div>
        )}
        {error && !loading && (
          <div className="py-6 text-sm text-red-400">{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-12 text-center text-sm text-slate-500">
            No corridors match these filters.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <CorridorCard
              key={c.id}
              item={c}
              onClick={() => navigate(`/corridors/${c.id}`)}
            />
          ))}
        </div>
      </div>

      {/* Floating chat bubble (global atlas context) */}
      <CorridorChatBubble corridorId={null} />
    </div>
  );
}

function uniqueSorted(arr: string[]): string[] {
  return Array.from(new Set(arr)).sort();
}
