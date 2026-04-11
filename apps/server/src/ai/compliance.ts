import { logger } from "../logger.js";
import { chatCompletion } from "./openai.js";
import type { ComplianceReportData, RiskSeverity } from "@xrplens/core";

// ─── Generate Compliance Report ───────────────────────────────────────────────

export async function generateComplianceReport(
  analysis: {
    id: string;
    seedAddress: string;
    seedLabel?: string | null;
    summaryJson?: any;
  },
  nodes: Array<{ id: string; kind: string; label: string; data: any }>,
  edges: Array<{ id: string; kind: string; source: string; target: string }>,
  riskFlags: Array<{
    id: string;
    flag: string;
    severity: string;
    detail: string;
    data?: any;
  }>,
): Promise<ComplianceReportData> {
  // Entity breakdown from nodes
  const entityBreakdown = {
    tokens: nodes.filter((n) => n.kind === "token").length,
    issuers: nodes.filter((n) => n.kind === "issuer").length,
    pools: nodes.filter((n) => n.kind === "ammPool").length,
    accounts: nodes.filter((n) => n.kind === "account").length,
    orderBooks: nodes.filter((n) => n.kind === "orderBook").length,
    escrows: nodes.filter((n) => n.kind === "escrow").length,
    paymentPaths: nodes.filter((n) => n.kind === "paymentPath").length,
    checks: nodes.filter((n) => n.kind === "check").length,
    payChannels: nodes.filter((n) => n.kind === "payChannel").length,
    nfts: nodes.filter((n) => n.kind === "nft").length,
    signerLists: nodes.filter((n) => n.kind === "signerList").length,
    dids: nodes.filter((n) => n.kind === "did").length,
    credentials: nodes.filter((n) => n.kind === "credential").length,
    mpTokens: nodes.filter((n) => n.kind === "mpToken").length,
    oracles: nodes.filter((n) => n.kind === "oracle").length,
    depositPreauths: nodes.filter((n) => n.kind === "depositPreauth").length,
    offers: nodes.filter((n) => n.kind === "offer").length,
    permissionedDomains: nodes.filter((n) => n.kind === "permissionedDomain").length,
    nftOffers: nodes.filter((n) => n.kind === "nftOffer").length,
    tickets: nodes.filter((n) => n.kind === "ticket").length,
    bridges: nodes.filter((n) => n.kind === "bridge").length,
    vaults: nodes.filter((n) => n.kind === "vault").length,
  };

  // Overall risk level
  const hasHigh = riskFlags.some((f) => f.severity === "HIGH");
  const hasMed = riskFlags.some((f) => f.severity === "MED");
  const overallRisk: RiskSeverity = hasHigh ? "HIGH" : hasMed ? "MED" : "LOW";

  // Concentration analysis from CONCENTRATED_LIQUIDITY flag
  let concentrationAnalysis: ComplianceReportData["concentrationAnalysis"] | undefined;
  const concLiqFlag = riskFlags.find((f) => f.flag === "CONCENTRATED_LIQUIDITY");
  if (concLiqFlag?.data) {
    const flagData = concLiqFlag.data as any;
    const top3Pct: number = flagData.top3Percentage ?? 0;
    // Build Herfindahl-Hirschman Index approximation
    const herfindahlIndex = top3Pct * top3Pct;
    concentrationAnalysis = {
      topHolders: [
        { address: "top-3-combined", percentage: Math.round(top3Pct * 10000) / 100 },
      ],
      herfindahlIndex: Math.round(herfindahlIndex * 10000) / 10000,
    };
  }

  // Gateway analysis from issuer node
  let gatewayAnalysis: ComplianceReportData["gatewayAnalysis"] | undefined;
  const issuerNode = nodes.find((n) => n.kind === "issuer");
  if (issuerNode?.data) {
    const issuerData = issuerNode.data as any;
    gatewayAnalysis = {
      totalObligations: issuerData.totalObligations ?? {},
      gateways: issuerData.tokens ?? [],
    };
  }

  // Build context for AI
  const flagSummaryLines = riskFlags.map(
    (f) => `- [${f.severity}] ${f.flag}: ${f.detail}`,
  );

  const prompt = `
You are generating a compliance report for an XRPL token issuer analysis.

**Issuer Details:**
- Address: ${analysis.seedAddress}
- Label: ${analysis.seedLabel ?? "N/A"}

**Entity Breakdown:**
${JSON.stringify(entityBreakdown, null, 2)}

**Risk Flags (${riskFlags.length} total, Overall: ${overallRisk}):**
${flagSummaryLines.join("\n") || "No risk flags detected."}

**Gateway/Token Info:**
${gatewayAnalysis ? JSON.stringify(gatewayAnalysis, null, 2) : "N/A"}

Please provide:
1. A concise executive summary (2-3 sentences) assessing the overall risk posture
2. 3-5 specific, actionable recommendations

Format your response as JSON with this exact structure:
{
  "summary": "...",
  "recommendations": ["...", "...", "..."]
}
`;

  let summary = `Analysis of ${analysis.seedLabel ?? analysis.seedAddress} reveals an overall ${overallRisk} risk profile with ${riskFlags.length} risk flag(s) detected across ${nodes.length} graph nodes.`;
  let recommendations: string[] = [
    "Review all HIGH severity risk flags immediately and take corrective action.",
    "Ensure the issuer account has a verified domain set for transparency.",
    "Monitor liquidity concentration in AMM pools to reduce withdrawal risk.",
    "Maintain diverse payment paths to avoid single gateway dependency.",
    "Review order book depth regularly to ensure adequate market liquidity.",
  ];

  try {
    const aiResponse = await chatCompletion(
      [{ role: "user", content: prompt }],
      { model: "gpt-4o-mini", maxTokens: 1000, temperature: 0.3 },
    );

    // Try to parse AI response as JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.summary) summary = parsed.summary;
      if (Array.isArray(parsed.recommendations) && parsed.recommendations.length > 0) {
        recommendations = parsed.recommendations;
      }
    }
  } catch (err: any) {
    logger.warn("[compliance] AI generation failed, using fallback", { error: err?.message });
  }

  const title = `Compliance Report: ${analysis.seedLabel ?? analysis.seedAddress} — ${new Date().toISOString().split("T")[0]}`;

  const report: ComplianceReportData = {
    title,
    generatedAt: new Date().toISOString(),
    seedAddress: analysis.seedAddress,
    seedLabel: analysis.seedLabel ?? undefined,
    summary,
    riskAssessment: {
      overall: overallRisk,
      flags: riskFlags.map((f) => ({
        flag: f.flag as any,
        severity: f.severity as RiskSeverity,
        detail: f.detail,
        data: f.data ?? undefined,
      })),
    },
    entityBreakdown,
    concentrationAnalysis,
    gatewayAnalysis,
    recommendations,
  };

  logger.info("[compliance] Report generated", {
    analysisId: analysis.id,
    overallRisk,
    flagCount: riskFlags.length,
  });

  return report;
}
