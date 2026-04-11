import { Button } from "../../components/ui/button";

interface ComplianceHeaderProps {
  analysisId?: string;
  hasReport: boolean;
  isGenerating: boolean;
  onBack: () => void;
  onGenerate: () => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
}

export function ComplianceHeader({
  analysisId,
  hasReport,
  isGenerating,
  onBack,
  onGenerate,
  onPrint,
  onDownloadPdf,
}: ComplianceHeaderProps) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-white">Compliance Report</h1>
        {analysisId && (
          <p className="mt-1 font-mono text-xs text-slate-500">{analysisId}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back to Graph
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating…" : "Generate Report"}
        </Button>

        {hasReport && (
          <>
            <Button variant="ghost" size="sm" onClick={onPrint}>
              Print view
            </Button>
            <Button variant="primary" size="sm" onClick={onDownloadPdf}>
              Download signed PDF
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
