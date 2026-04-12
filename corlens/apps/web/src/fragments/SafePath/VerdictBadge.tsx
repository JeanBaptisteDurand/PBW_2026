import { Badge } from "../../components/ui/badge";

interface VerdictBadgeProps {
  verdict: "SAFE" | "REJECTED" | "NO_PATHS";
}

export function VerdictBadge({ verdict }: VerdictBadgeProps) {
  if (verdict === "SAFE") {
    return <Badge variant="low">SAFE</Badge>;
  }
  return <Badge variant="high">{verdict}</Badge>;
}
