interface LabeledInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}

export function LabeledInput({
  label,
  value,
  onChange,
  mono,
}: LabeledInputProps) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-xrp-500 focus:outline-none ${
          mono ? "font-mono text-xs" : ""
        }`}
      />
    </div>
  );
}
