import ReactMarkdown from "react-markdown";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { ComplianceHeader } from "../fragments/ComplianceView/ComplianceHeader.js";
import {
  ComplianceEmptyState,
  ComplianceErrorState,
  ComplianceLoadingState,
} from "../fragments/ComplianceView/ComplianceStates.js";
import { PremiumGate } from "../components/ui/PremiumGate.js";
import { useComplianceReport } from "../hooks/useGraph.js";

export default function ComplianceView() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  // v2 returns a markdown-string report (no structured ComplianceReportData
  // payload). Render the markdown directly — the v1 structured renderer
  // lives on now only for SafePath where the contract is unchanged.
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);

  const mutation = useComplianceReport(analysisId);

  const handleGenerate = async () => {
    try {
      const result = await mutation.mutateAsync();
      setReportMarkdown(result.markdown);
    } catch {
      // error shown via mutation.isError
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!analysisId) return;
    const authRaw = localStorage.getItem("corlens_auth");
    const token = authRaw ? (JSON.parse(authRaw) as { token?: string }).token : null;
    const url = token
      ? `/api/compliance/analysis/${analysisId}/pdf?token=${encodeURIComponent(token)}`
      : `/api/compliance/analysis/${analysisId}/pdf`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <PremiumGate>
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ComplianceHeader
        analysisId={analysisId}
        hasReport={Boolean(reportMarkdown)}
        isGenerating={mutation.isPending}
        onBack={() => navigate(`/graph/${analysisId}`)}
        onGenerate={handleGenerate}
        onPrint={handlePrint}
        onDownloadPdf={handleDownloadPdf}
      />

      {/* Error state */}
      {mutation.isError && (
        <ComplianceErrorState
          message={
            mutation.error instanceof Error
              ? mutation.error.message
              : "Failed to generate report."
          }
        />
      )}

      {/* Empty state */}
      {!reportMarkdown && !mutation.isPending && (
        <ComplianceEmptyState onGenerate={handleGenerate} isGenerating={mutation.isPending} />
      )}

      {/* Loading */}
      {mutation.isPending && <ComplianceLoadingState />}

      {/* Report — v2 markdown payload */}
      {reportMarkdown && !mutation.isPending && (
        <div className="prose prose-invert mt-6 max-w-none rounded-xl border border-[color:var(--app-glass-panel-border)] bg-slate-950/60 p-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportMarkdown}</ReactMarkdown>
        </div>
      )}
    </div>
    </PremiumGate>
  );
}
