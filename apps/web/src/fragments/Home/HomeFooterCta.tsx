import { Badge } from "../../components/ui/badge";

export function HomeFooterCta() {
  return (
    <div className="mt-20 flex flex-col items-center gap-3 text-center">
      <p className="text-sm text-slate-500">
        Browse corridors. Route money through them. Prove the tools are real.
      </p>
      <p className="text-xs text-slate-600">
        Open source. Built for Hack the Block — Paris Blockchain Week 2026.
      </p>
      <div className="flex gap-2">
        <Badge variant="default">RLUSD</Badge>
        <Badge variant="default">ODL Corridors</Badge>
        <Badge variant="default">AI Agent</Badge>
        <Badge variant="default">Compliance</Badge>
      </div>
    </div>
  );
}
