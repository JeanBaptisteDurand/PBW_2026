interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  testId: string;
  labelMap?: Record<string, string>;
}

export function SelectFilter({
  label,
  value,
  onChange,
  options,
  testId,
  labelMap,
}: SelectFilterProps) {
  return (
    <div>
      <label className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </label>
      <select
        data-testid={testId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-slate-800 bg-slate-900/60 px-2 py-1.5 text-sm text-white focus:border-xrp-500 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {labelMap?.[option] ?? option}
          </option>
        ))}
      </select>
    </div>
  );
}
