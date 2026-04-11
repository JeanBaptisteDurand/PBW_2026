import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import type { ComplianceReportData } from "@xrplens/core";
import { ComplianceReport } from "../components/compliance/ComplianceReport";
import { useComplianceReport } from "../hooks/useGraph";
import { ComplianceHeader } from "../fragments/ComplianceView/ComplianceHeader";
import {
  ComplianceEmptyState,
  ComplianceErrorState,
  ComplianceLoadingState,
} from "../fragments/ComplianceView/ComplianceStates";
import { PremiumGate } from "../components/ui/PremiumGate";

export default function ComplianceView() {
  const { analysisId } = useParams<{ analysisId: string }>();
  const navigate = useNavigate();

  const [reportData, setReportData] = useState<ComplianceReportData | null>(
    null,
  );

  const mutation = useComplianceReport(analysisId);

  const handleGenerate = async () => {
    try {
      const result = await mutation.mutateAsync();
      setReportData(result.report);
    } catch {
      // error shown via mutation.isError
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    if (!analysisId) return;
    const authRaw = localStorage.getItem("xrplens_auth");
    const token = authRaw ? JSON.parse(authRaw)?.token : null;
    const url = token
      ? `/api/compliance/${analysisId}/pdf?token=${encodeURIComponent(token)}`
      : `/api/compliance/${analysisId}/pdf`;
    window.open(url, "_blank", "noopener");
  };

  return (
    <PremiumGate>
    <div className="mx-auto max-w-4xl px-6 py-8">
      <ComplianceHeader
        analysisId={analysisId}
        hasReport={Boolean(reportData)}
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
      {!reportData && !mutation.isPending && (
        <ComplianceEmptyState
          onGenerate={handleGenerate}
          isGenerating={mutation.isPending}
        />
      )}

      {/* Loading */}
      {mutation.isPending && <ComplianceLoadingState />}

      {/* Report */}
      {reportData && !mutation.isPending && (
        <ComplianceReport report={reportData} />
      )}
    </div>
    </PremiumGate>
  );
}
