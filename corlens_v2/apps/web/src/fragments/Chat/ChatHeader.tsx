import { Button } from "../../components/ui/button";

interface ChatHeaderProps {
  analysisId: string;
  onBackToGraph: () => void;
}

export function ChatHeader({
  analysisId,
  onBackToGraph,
}: ChatHeaderProps) {
  return (
    <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 border-b border-app-border-subtle bg-app-bg-primary px-4 py-2.5">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-xrp-500">
          AI Chat
        </span>
        <div className="mt-px font-mono text-xs text-slate-600">
          {analysisId}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="ghost" size="sm" onClick={onBackToGraph}>
          Back to Graph
        </Button>
      </div>
    </div>
  );
}
