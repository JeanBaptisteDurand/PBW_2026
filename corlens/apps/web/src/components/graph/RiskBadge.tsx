import type { RiskFlagData, RiskSeverity } from "@corlens/core";
import { RISK_COLORS } from "@corlens/core";

interface RiskBadgeProps {
  riskFlags: RiskFlagData[];
}

function highestSeverity(flags: RiskFlagData[]): RiskSeverity {
  if (flags.some((f) => f.severity === "HIGH")) return "HIGH";
  if (flags.some((f) => f.severity === "MED")) return "MED";
  return "LOW";
}

export function RiskBadge({ riskFlags }: RiskBadgeProps) {
  if (!riskFlags || riskFlags.length === 0) return null;

  const severity = highestSeverity(riskFlags);
  const color = RISK_COLORS[severity];

  return (
    <div
      title={`${riskFlags.length} risk flag${riskFlags.length > 1 ? "s" : ""} — highest: ${severity}`}
      style={{
        position: "absolute",
        top: -6,
        right: -6,
        backgroundColor: color,
        borderRadius: "50%",
        width: 18,
        height: 18,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 9,
        fontWeight: 700,
        color: "#fff",
        zIndex: 10,
        border: "2px solid #020617",
        boxShadow: `0 0 6px ${color}80`,
      }}
    >
      {riskFlags.length}
    </div>
  );
}
