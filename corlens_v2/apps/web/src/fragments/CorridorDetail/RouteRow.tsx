import type { CorridorRouteResult } from "../../lib/core-types.js";
import { StatusBadge } from "./StatusBadge";

interface RouteRowProps {
  route: CorridorRouteResult;
  selected: boolean;
  onSelect: () => void;
}

export function RouteRow({ route, selected, onSelect }: RouteRowProps) {
  const liqStr = (() => {
    const parts: string[] = [];
    if (route.liquidity?.xrpLeg) {
      parts.push(
        `xrp ${route.liquidity.xrpLeg.toIouOffers}/${route.liquidity.xrpLeg.toXrpOffers}`,
      );
    }
    if (route.liquidity?.directBook) {
      parts.push(
        `direct ${route.liquidity.directBook.fwdOffers}/${route.liquidity.directBook.revOffers}`,
      );
    }
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
      className={`cursor-pointer border-b border-slate-900 transition ${selected ? "bg-xrp-500/10" : "hover:bg-slate-900/40"}`}
    >
      <td className="py-2 pr-3">
        <div className="text-white">{route.label}</div>
        <div className="font-mono text-[10px] text-slate-600">
          {route.routeId}
        </div>
      </td>
      <td className="py-2 pr-3">
        <StatusBadge status={route.status} />
      </td>
      <td className="py-2 pr-3 text-right text-white">{route.pathCount}</td>
      <td className="py-2 pr-3 text-right">
        <span
          className={
            route.recommendedRiskScore != null &&
            route.recommendedRiskScore > 20
              ? "text-red-400"
              : route.recommendedRiskScore != null &&
                  route.recommendedRiskScore > 0
                ? "text-amber-400"
                : "text-emerald-400"
          }
        >
          {route.recommendedRiskScore ?? "—"}
        </span>
      </td>
      <td className="py-2 pr-3 font-mono text-[11px] text-slate-400">
        {liqStr}
      </td>
      <td className="py-2 text-[11px]">
        {route.isWinner ? (
          <span className="font-semibold text-emerald-400">★ winner</span>
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
