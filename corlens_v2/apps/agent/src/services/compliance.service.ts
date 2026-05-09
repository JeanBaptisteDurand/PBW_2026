import type { SafePathRunRow } from "../repositories/safe-path-run.repo.js";
import { createComplianceDataService } from "./compliance-data.service.js";
import { createPdfRendererService } from "./pdf-renderer.service.js";

export function renderComplianceMarkdown(run: SafePathRunRow): string {
  if (run.reportMarkdown && run.reportMarkdown.length > 50) {
    return run.reportMarkdown;
  }
  const riskScore = (run.resultJson as { riskScore?: number } | null)?.riskScore;
  const auditHash = run.auditHash ?? deriveAuditHash(run);
  const lines: string[] = [];
  lines.push("# Safe Path Compliance Report");
  lines.push("");
  lines.push(`**Run ID:** ${run.id}`);
  lines.push(`**Generated:** ${run.createdAt.toISOString()}`);
  lines.push(`**Audit hash:** \`${auditHash}\``);
  lines.push("");
  lines.push("## Request");
  lines.push("");
  lines.push(`- Amount: ${run.amount}`);
  lines.push(`- Route: ${run.srcCcy} → ${run.dstCcy}`);
  lines.push(`- Risk tolerance: ${run.maxRiskTolerance}`);
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(`Verdict: **${run.verdict}**`);
  if (typeof riskScore === "number") lines.push(`Risk score: ${riskScore.toFixed(2)}`);
  lines.push("");
  lines.push("## Reasoning");
  lines.push("");
  lines.push(run.reasoning ?? "(no reasoning recorded)");
  lines.push("");
  lines.push("## Disclaimer");
  lines.push("");
  lines.push(
    "This report is generated programmatically from on-chain XRPL data and corridor intelligence. It is informational only and does not constitute financial or legal advice.",
  );
  return lines.join("\n");
}

function deriveAuditHash(run: SafePathRunRow): string {
  const data = createComplianceDataService().buildComplianceData(run);
  return createPdfRendererService().computeAuditHash(data);
}
