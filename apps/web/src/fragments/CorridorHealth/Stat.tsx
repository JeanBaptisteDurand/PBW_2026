interface StatProps {
  label: string;
  value: string;
  valueClass?: string;
}

export function Stat({ label, value, valueClass = "text-white" }: StatProps) {
  return (
    <div className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className={`text-sm font-semibold ${valueClass}`}>{value}</div>
    </div>
  );
}
