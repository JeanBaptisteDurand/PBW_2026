import type { CorridorListItem } from "@corlens/core";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Stat } from "./Stat";
import { StatusBadge } from "./StatusBadge";

const statusBorderClasses: Record<string, string> = {
  RED: "border-t-red-500",
  AMBER: "border-t-amber-500",
  GREEN: "border-t-emerald-500",
  UNKNOWN: "border-t-slate-600",
};

interface CorridorCardProps {
  item: CorridorListItem;
  onClick: () => void;
}

export function CorridorCard({ item, onClick }: CorridorCardProps) {
  const winningRoute = item.routeResults.find(
    (route) => route.routeId === item.bestRouteId,
  );
  const candidateCount = item.routeResults.length;

  return (
    <Card
      data-testid={`corridor-card-${item.id}`}
      onClick={onClick}
      className={`cursor-pointer border-t-[3px] transition-all duration-150 hover:-translate-y-0.5 ${statusBorderClasses[item.status] ?? statusBorderClasses.UNKNOWN}`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
            <span>{item.flag}</span>
            <span className="text-[9px] uppercase tracking-wide text-slate-600">
              {item.category} · {item.region} · imp {item.importance}
            </span>
          </div>
          <CardTitle className="text-base text-white">{item.label}</CardTitle>
          <div className="mt-0.5 text-[10px] font-mono text-slate-500">
            {candidateCount} route{candidateCount !== 1 ? "s" : ""} ·{" "}
            {winningRoute
              ? `winner: ${winningRoute.label}`
              : "no winner picked"}
          </div>
        </div>
        <StatusBadge status={item.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {item.aiNote ? (
          <p
            className="line-clamp-5 text-xs leading-relaxed text-slate-300"
            data-testid={`corridor-ai-note-${item.id}`}
          >
            {item.aiNote}
          </p>
        ) : (
          <p className="text-xs italic leading-relaxed text-slate-400">
            {item.description}
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-xs">
          {item.category === "off-chain-bridge" ? (
            <>
              <Stat label="On-ramps" value={String(item.sourceActors?.length ?? 0)} />
              <Stat label="Off-ramps" value={String(item.destActors?.length ?? 0)} />
              <Stat label="Bridge" value={item.bridgeAsset ?? "RLUSD"} />
            </>
          ) : (() => {
              const routes = item.routeResults ?? [];
              const active = routes.filter((r) => r.status === "GREEN" || r.status === "AMBER").length;
              return (
                <>
                  <Stat label="Routes" value={String(routes.length)} />
                  <Stat
                    label="Active"
                    value={`${active}/${routes.length}`}
                    valueClass={active > 0 ? "text-emerald-400" : "text-amber-400"}
                  />
                  <Stat label="On-ramps" value={String(item.sourceActors?.length ?? 0)} />
                </>
              );
            })()}
        </div>

        {item.liquidity?.notes && item.liquidity.notes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.liquidity.notes.slice(0, 3).map((note, idx) => (
              <span
                key={idx}
                className="rounded border border-slate-800 bg-slate-900/50 px-1.5 py-0.5 font-mono text-[9px] text-slate-400"
              >
                {note}
              </span>
            ))}
          </div>
        )}

        {item.flags.length > 0 && (
          <div className="space-y-1">
            <div className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Flags ({item.flags.length})
            </div>
            <div className="flex flex-wrap gap-1">
              {item.flags.slice(0, 4).map((flag) => (
                <span
                  key={flag.flag}
                  title={flag.detail}
                  className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                    flag.severity === "HIGH"
                      ? "border border-red-500/30 bg-red-500/10 text-red-400"
                      : flag.severity === "MED"
                        ? "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                        : "border border-slate-700 bg-slate-700/40 text-slate-400"
                  }`}
                >
                  {flag.flag}
                </span>
              ))}
              {item.flags.length > 4 && (
                <span className="self-center text-[9px] text-slate-500">
                  +{item.flags.length - 4} more
                </span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-[10px] font-semibold text-xrp-400">
          <span className="truncate">{item.useCase}</span>
          <span>Open →</span>
        </div>
      </CardContent>
    </Card>
  );
}
