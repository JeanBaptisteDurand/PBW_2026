import type { CorridorRouteResult } from "@xrplens/core";

interface RouteLiquidityPanelProps {
  route: CorridorRouteResult;
  destSymbol: string;
}

export function RouteLiquidityPanel({
  route,
  destSymbol,
}: RouteLiquidityPanelProps) {
  const liquidity = route.liquidity;

  return (
    <div className="grid grid-cols-1 gap-2 text-xs text-slate-400 md:grid-cols-2">
      {liquidity?.xrpLeg && (
        <LiquidityRow
          label="XRP ↔ destination orderbook"
          value={`${liquidity.xrpLeg.toIouOffers} / ${liquidity.xrpLeg.toXrpOffers}`}
          hint="XRP→IOU / IOU→XRP offers"
        />
      )}
      {liquidity?.directBook && (
        <LiquidityRow
          label="Direct cross-book"
          value={`${liquidity.directBook.fwdOffers} / ${liquidity.directBook.revOffers}`}
          hint="fwd / rev offers"
        />
      )}
      {liquidity?.amm?.xrpReserve && (
        <LiquidityRow
          label="AMM pool"
          value={`${Math.round(Number(liquidity.amm.xrpReserve) / 1_000_000).toLocaleString()} XRP`}
          hint={
            liquidity.amm.iouReserve
              ? `+ ${Number(liquidity.amm.iouReserve).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${destSymbol}`
              : ""
          }
        />
      )}
      {liquidity?.issuerObligation && (
        <LiquidityRow
          label="Issuer float"
          value={`${Number(liquidity.issuerObligation).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${destSymbol}`}
          hint="outstanding obligation"
        />
      )}
      {!liquidity && (
        <p className="col-span-2 italic text-slate-500">
          No liquidity scan recorded for this route.
        </p>
      )}
    </div>
  );
}

interface LiquidityRowProps {
  label: string;
  value: string;
  hint?: string;
}

function LiquidityRow({ label, value, hint }: LiquidityRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-slate-800 pb-1 last:border-0">
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        {hint && <div className="text-[9px] text-slate-600">{hint}</div>}
      </div>
      <div className="font-mono text-sm text-white">{value}</div>
    </div>
  );
}
