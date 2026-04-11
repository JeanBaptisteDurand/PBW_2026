const statusClasses: Record<string, string> = {
  RED: "border border-red-500/40 bg-red-500/15 text-red-400",
  AMBER: "border border-amber-500/40 bg-amber-500/15 text-amber-400",
  GREEN: "border border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
  UNKNOWN: "border border-slate-700 bg-slate-700/30 text-slate-400",
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusClasses[status] ?? statusClasses.UNKNOWN}`}
    >
      {status}
    </span>
  );
}
