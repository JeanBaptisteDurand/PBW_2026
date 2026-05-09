import type { SafePathRunRow } from "../repositories/safe-path-run.repo.js";
import type { ComplianceReportData, RiskSeverity } from "../types/compliance-report.js";

const SUMMARY_MAX_CHARS = 500;

const EMPTY_ENTITY_BREAKDOWN: ComplianceReportData["entityBreakdown"] = {
  tokens: 0,
  issuers: 0,
  pools: 0,
  accounts: 0,
  orderBooks: 0,
  escrows: 0,
  paymentPaths: 0,
  checks: 0,
  payChannels: 0,
  nfts: 0,
  signerLists: 0,
  dids: 0,
  credentials: 0,
  mpTokens: 0,
  oracles: 0,
  depositPreauths: 0,
  offers: 0,
  permissionedDomains: 0,
  nftOffers: 0,
  tickets: 0,
  bridges: 0,
  vaults: 0,
};

function deriveOverallSeverity(verdict: string, riskScore: number | null): RiskSeverity {
  if (verdict === "REJECTED") return "HIGH";
  if (typeof riskScore === "number") {
    if (riskScore >= 0.7) return "HIGH";
    if (riskScore >= 0.4) return "MED";
  }
  return "LOW";
}

function deriveSummary(run: SafePathRunRow): string {
  const reasoning = run.reasoning?.trim() ?? "";
  if (reasoning.length > 0) {
    if (reasoning.length <= SUMMARY_MAX_CHARS) return reasoning;
    return `${reasoning.slice(0, SUMMARY_MAX_CHARS - 1).trimEnd()}…`;
  }
  return `Safe Path verdict: ${run.verdict}`;
}

function deriveRecommendations(verdict: string, riskScore: number | null): string[] {
  if (verdict === "REJECTED") {
    return [
      "Investigate the rejected paths' specific risk flags before retrying.",
      "Consider adjusting maxRiskTolerance up only after legal review.",
      "Re-screen the destination corridor against an updated sanctions feed.",
      "Document the rejection rationale in the case file before any override.",
    ];
  }
  if (verdict === "REVIEW") {
    return [
      "Escalate to a compliance reviewer before settlement.",
      "Capture the reviewer's sign-off alongside the audit hash on file.",
      "Re-run the corridor analysis after any market-moving events.",
      "Consider splitting the amount across alternative routes to reduce exposure.",
    ];
  }
  if (typeof riskScore === "number" && riskScore >= 0.4) {
    return [
      "Proceed with enhanced monitoring throughout settlement.",
      "Cross-check the winning path's gateways against your VASP allow-list.",
      "Re-run the analysis if the trade is held longer than 15 minutes.",
      "Archive the corridor catalog snapshot used for this decision.",
    ];
  }
  return [
    "Proceed with standard monitoring and Travel Rule attribution.",
    "Confirm the winning path's gateways are on your VASP allow-list.",
    "Archive the audit-hashed PDF alongside the settlement record.",
  ];
}

export type ComplianceDataService = ReturnType<typeof createComplianceDataService>;

export function createComplianceDataService() {
  return {
    buildComplianceData(run: SafePathRunRow): ComplianceReportData {
      const seedAddress = `safepath:${run.id}`;
      const seedLabel = `${run.srcCcy} → ${run.dstCcy}`;
      return {
        title: `Safe Path Compliance Report: ${run.srcCcy} → ${run.dstCcy}`,
        generatedAt: run.createdAt.toISOString(),
        seedAddress,
        seedLabel,
        summary: deriveSummary(run),
        riskAssessment: {
          overall: deriveOverallSeverity(run.verdict, run.riskScore),
          flags: [],
        },
        entityBreakdown: { ...EMPTY_ENTITY_BREAKDOWN },
        recommendations: deriveRecommendations(run.verdict, run.riskScore),
      };
    },
  };
}
