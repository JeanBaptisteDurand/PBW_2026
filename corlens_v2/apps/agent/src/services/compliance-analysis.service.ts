import { createHash } from "node:crypto";
import type { path as pp } from "@corlens/contracts";

export interface ComplianceAnalysisResult {
  analysisId: string;
  markdown: string;
  auditHash: string;
  data: { summary: pp.AnalysisSummary; flags: pp.RiskFlag[] };
}

export interface ComplianceAnalysisService {
  build(analysisId: string): Promise<ComplianceAnalysisResult>;
}

type GraphLike = { nodes?: Array<{ riskFlags?: pp.RiskFlag[] }> };

export function createComplianceAnalysisService(deps: {
  path: {
    getAnalysis(id: string): Promise<unknown | null>;
    getGraph(id: string): Promise<unknown | null>;
  };
}): ComplianceAnalysisService {
  function flattenFlags(graph: unknown): pp.RiskFlag[] {
    const g = graph as GraphLike | null;
    if (!g?.nodes) return [];
    return g.nodes.flatMap((n) => (n.riskFlags ?? []) as pp.RiskFlag[]);
  }

  function renderMarkdown(summary: pp.AnalysisSummary, flags: pp.RiskFlag[]): string {
    const lines: string[] = [];
    lines.push("# Entity Audit Compliance Report");
    lines.push("");
    lines.push(`**Analysis ID:** ${summary.id}`);
    lines.push(`**Seed:** ${summary.seedAddress} (${summary.seedLabel ?? "unlabelled"})`);
    lines.push(`**Depth:** ${summary.depth}`);
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push("");
    lines.push("## Risk flags");
    if (flags.length === 0) {
      lines.push("None.");
    } else {
      for (const f of flags) {
        lines.push(`- [${f.severity}] **${f.flag}** — ${f.detail ?? ""}`);
      }
    }
    lines.push("");
    lines.push("## Disclaimer");
    lines.push(
      "Generated programmatically from XRPL on-chain data. Informational only; not financial or legal advice.",
    );
    return lines.join("\n");
  }

  function computeAuditHash(summary: pp.AnalysisSummary, flags: pp.RiskFlag[]): string {
    // Deterministic: excludes timestamps and generated-at from the hash inputs.
    const canonical = JSON.stringify({
      id: summary.id,
      seedAddress: summary.seedAddress,
      depth: summary.depth,
      stats: summary.stats,
      flags: flags.map((f) => ({ flag: f.flag, severity: f.severity, detail: f.detail })),
    });
    return createHash("sha256").update(canonical).digest("hex");
  }

  return {
    async build(analysisId) {
      const rawSummary = await deps.path.getAnalysis(analysisId);
      if (!rawSummary) throw new Error("not_found");
      const summary = rawSummary as pp.AnalysisSummary;
      const graph = await deps.path.getGraph(analysisId);
      const flags = flattenFlags(graph);
      return {
        analysisId,
        markdown: renderMarkdown(summary, flags),
        auditHash: computeAuditHash(summary, flags),
        data: { summary, flags },
      };
    },
  };
}
