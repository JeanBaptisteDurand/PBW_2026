import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

interface GraphStats {
  totalNodes?: number;
  totalEdges?: number;
  highRiskCount?: number;
  medRiskCount?: number;
  lowRiskCount?: number;
}

interface GraphHeaderProps {
  seedLabel: string;
  analysisId?: string;
  stats?: GraphStats;
  onCompliance: () => void;
  onChat: () => void;
  children?: React.ReactNode;
}

export function GraphHeader({
  seedLabel,
  stats,
  onCompliance,
  onChat,
  children,
}: GraphHeaderProps) {
  return (
    <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-slate-800 bg-slate-950 px-4 py-2">
      <span className="mr-2 text-sm font-medium text-white">{seedLabel}</span>

      <Badge variant="default">{stats?.totalNodes ?? 0} nodes</Badge>
      <Badge variant="default">{stats?.totalEdges ?? 0} edges</Badge>

      {(stats?.highRiskCount ?? 0) > 0 && (
        <Badge variant="high">HIGH: {stats?.highRiskCount}</Badge>
      )}
      {(stats?.medRiskCount ?? 0) > 0 && (
        <Badge variant="med">MED: {stats?.medRiskCount}</Badge>
      )}
      {(stats?.lowRiskCount ?? 0) > 0 && (
        <Badge variant="low">LOW: {stats?.lowRiskCount}</Badge>
      )}

      <div className="flex-1" />

      {children}

      <Button variant="secondary" size="sm" onClick={onCompliance}>
        Compliance Report
      </Button>
      <Button variant="secondary" size="sm" onClick={onChat}>
        AI Chat
      </Button>
    </div>
  );
}
