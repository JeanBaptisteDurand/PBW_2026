import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";

interface HeroSectionProps {
  onAnalyzeRLUSD: () => void;
  onSafePath: () => void;
  onCorridorHealth: () => void;
}

export function HeroSection({
  onAnalyzeRLUSD,
  onSafePath,
  onCorridorHealth,
}: HeroSectionProps) {
  return (
    <div className="mb-16 flex flex-col items-center gap-6 text-center">
      <Badge variant="info" className="px-3 py-1 text-xs">
        Corridor Intelligence + AI Agent
      </Badge>

      <h1 className="max-w-3xl text-5xl font-bold leading-tight tracking-tight text-white">
        The missing map for{" "}
        <span className="text-xrp-400">XRPL cross-border payments</span>
      </h1>

      <p className="max-w-2xl text-lg leading-relaxed text-slate-400">
        2,436 fiat corridors classified by how they settle on XRPL. An AI
        agent that routes capital through them safely — with live risk
        analysis, split routing, and downloadable compliance reports.
      </p>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        <Button size="lg" onClick={onCorridorHealth}>
          Browse Corridor Atlas
        </Button>
        <Button variant="secondary" size="lg" onClick={onSafePath}>
          Route with Safe Path Agent
        </Button>
        <Button variant="secondary" size="lg" onClick={onAnalyzeRLUSD}>
          Audit an Entity
        </Button>
      </div>
    </div>
  );
}
