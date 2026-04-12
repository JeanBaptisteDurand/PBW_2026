import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

interface ErrorStateProps {
  message: string;
}

export function ComplianceErrorState({ message }: ErrorStateProps) {
  return (
    <Card className="mb-6 border-red-500/40">
      <CardContent className="py-4">
        <p className="text-sm text-red-400">{message}</p>
      </CardContent>
    </Card>
  );
}

interface EmptyStateProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export function ComplianceEmptyState({
  onGenerate,
  isGenerating,
}: EmptyStateProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate AML Compliance Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm leading-relaxed text-slate-400">
          Click "Generate Report" to run AML analysis on this entity&apos;s
          knowledge graph. The report includes risk assessment, entity
          breakdown, concentration analysis, and actionable recommendations.
        </p>
        <Button onClick={onGenerate} disabled={isGenerating}>
          {isGenerating ? "Generating…" : "Generate Report"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ComplianceLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16">
      <span className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-xrp-500/30 border-t-xrp-500" />
      <p className="text-sm text-slate-400">Generating compliance report…</p>
    </div>
  );
}
