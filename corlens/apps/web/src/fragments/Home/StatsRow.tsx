interface StatItem {
  value: string;
  label: string;
}

interface StatsRowProps {
  stats: StatItem[];
}

export function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="mx-auto mb-16 grid max-w-lg grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className="flex flex-col items-center gap-1">
          <span className="text-2xl font-bold text-xrp-400">{stat.value}</span>
          <span className="text-xs uppercase tracking-widest text-slate-500">
            {stat.label}
          </span>
        </div>
      ))}
    </div>
  );
}
