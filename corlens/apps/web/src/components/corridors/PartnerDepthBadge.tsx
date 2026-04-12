import { useEffect, useState } from "react";
import { api } from "../../api/client";

// ─── Partner Depth Badge ────────────────────────────────────────────────
//
// Live "measured, not assumed" proof for the v2 vision. Fetches
// /api/corridors/:id/partner-depth for a supported partner (currently
// only Bitso / xrp_mxn for the USD↔MXN corridor) and renders a compact
// inline chip showing:
//
//   - venue + book
//   - top bid / top ask
//   - spread in basis points
//   - cumulative bid and ask depth
//   - fetched-at timestamp
//
// Used on the USD→MXN page as the demo for what every actor row will
// look like once the live-depth ingestion rolls out. Intentionally
// narrow in scope — one partner, one corridor, one hour of work. The
// point is to prove the pattern is wired end-to-end.

type Snapshot = Awaited<ReturnType<typeof api.getPartnerDepth>>["snapshot"];

export interface PartnerDepthBadgeProps {
  corridorId: string;
  actor?: string;
  /** Display name of the actor for the header line. */
  actorLabel: string;
  /** The corridor base currency (e.g. "XRP" for xrp_mxn). */
  baseSymbol?: string;
  /** The corridor quote currency (e.g. "MXN" for xrp_mxn). */
  quoteSymbol?: string;
}

export function PartnerDepthBadge({
  corridorId,
  actor = "bitso",
  actorLabel,
  baseSymbol = "XRP",
  quoteSymbol = "MXN",
}: PartnerDepthBadgeProps) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getPartnerDepth(corridorId, actor)
      .then((res) => !cancelled && setSnap(res.snapshot))
      .catch((err) => !cancelled && setError(err?.message ?? "Failed to fetch"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [corridorId, actor]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-[11px] text-slate-500 italic">
        Fetching live orderbook from {actorLabel}…
      </div>
    );
  }

  if (error || !snap) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-4 py-3 text-[11px] text-slate-500 italic">
        {error ?? "No depth snapshot available."}
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent px-4 py-3"
      data-testid="partner-depth-badge"
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.9)] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-emerald-300">
            Live · Measured, not assumed
          </span>
        </div>
        <a
          href={snap.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[9px] font-mono text-slate-500 hover:text-slate-300 underline decoration-dotted"
          title={snap.source}
        >
          source
        </a>
      </div>
      <div className="text-xs text-white font-semibold mb-1">
        {snap.venue} · {snap.book.toUpperCase().replace("_", " / ")}
      </div>
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">
            Top bid
          </div>
          <div className="font-mono text-emerald-300">
            {snap.topBid
              ? `${Number(snap.topBid.price).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${quoteSymbol}`
              : "—"}
          </div>
          <div className="text-[9px] text-slate-500">
            {snap.bidCount} levels ·{" "}
            {Number(snap.bidDepthBase).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            {baseSymbol}
          </div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wide text-slate-500">
            Top ask
          </div>
          <div className="font-mono text-amber-300">
            {snap.topAsk
              ? `${Number(snap.topAsk.price).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${quoteSymbol}`
              : "—"}
          </div>
          <div className="text-[9px] text-slate-500">
            {snap.askCount} levels ·{" "}
            {Number(snap.askDepthBase).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            {baseSymbol}
          </div>
        </div>
      </div>
      {snap.spreadBps != null && (
        <div className="mt-2 pt-2 border-t border-emerald-500/15 flex items-center justify-between text-[10px]">
          <span className="text-slate-500 uppercase tracking-wide">Spread</span>
          <span className="font-mono text-white">
            {snap.spreadBps.toFixed(1)} bps
          </span>
        </div>
      )}
      <div className="mt-1 text-[9px] font-mono text-slate-600">
        Fetched {new Date(snap.fetchedAt).toLocaleTimeString()} · TTL{" "}
        {snap.ttlSeconds}s
      </div>
    </div>
  );
}
