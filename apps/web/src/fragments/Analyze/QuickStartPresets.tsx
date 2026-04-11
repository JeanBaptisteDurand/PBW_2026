import { Button } from "../../components/ui/button";

interface Preset {
  label: string;
  address: string;
  seedLabel: string;
}

interface QuickStartPresetsProps {
  presets: Preset[];
  onSelect: (preset: Preset) => void;
}

export function QuickStartPresets({
  presets,
  onSelect,
}: QuickStartPresetsProps) {
  return (
    <div className="mb-6 flex flex-wrap gap-2">
      <span className="mr-1 self-center text-xs text-slate-500">
        Quick start:
      </span>
      {presets.map((preset) => (
        <Button
          key={preset.address}
          variant="secondary"
          size="sm"
          onClick={() => onSelect(preset)}
        >
          {preset.label}
        </Button>
      ))}
    </div>
  );
}
