import { describe, expect, it } from "vitest";
import type { SafePathRunRow } from "../../src/repositories/safe-path-run.repo.js";
import { createComplianceDataService } from "../../src/services/compliance-data.service.js";

function baseRun(overrides: Partial<SafePathRunRow> = {}): SafePathRunRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    userId: null,
    srcCcy: "USD",
    dstCcy: "MXN",
    amount: "100",
    maxRiskTolerance: "MED",
    verdict: "SAFE",
    reasoning: "Healthy corridor with strong liquidity across primary gateways.",
    resultJson: { riskScore: 0.2 },
    reportMarkdown: null,
    corridorId: null,
    analysisIds: [],
    riskScore: 0.2,
    auditHash: null,
    createdAt: new Date("2026-05-09T12:00:00.000Z"),
    ...overrides,
  };
}

describe("compliance-data.service", () => {
  it("builds the expected ComplianceReportData shape from a minimal SAFE run", () => {
    const svc = createComplianceDataService();
    const data = svc.buildComplianceData(baseRun());
    expect(data.title).toBe("Safe Path Compliance Report: USD → MXN");
    expect(data.generatedAt).toBe("2026-05-09T12:00:00.000Z");
    expect(data.seedAddress).toBe("safepath:11111111-1111-1111-1111-111111111111");
    expect(data.seedLabel).toBe("USD → MXN");
    expect(data.summary).toContain("Healthy corridor");
    expect(data.riskAssessment.overall).toBe("LOW");
    expect(data.riskAssessment.flags).toEqual([]);
    expect(data.recommendations.length).toBeGreaterThanOrEqual(3);
  });

  it("derives HIGH severity for verdict=REJECTED regardless of riskScore", () => {
    const svc = createComplianceDataService();
    const data = svc.buildComplianceData(baseRun({ verdict: "REJECTED", riskScore: 0.1 }));
    expect(data.riskAssessment.overall).toBe("HIGH");
    expect(data.recommendations[0]).toMatch(/rejected paths/i);
  });

  it("derives MED severity for riskScore=0.5 with non-rejected verdict", () => {
    const svc = createComplianceDataService();
    const data = svc.buildComplianceData(baseRun({ verdict: "SAFE", riskScore: 0.5 }));
    expect(data.riskAssessment.overall).toBe("MED");
  });

  it("falls back to a verdict-only summary when reasoning is empty", () => {
    const svc = createComplianceDataService();
    const data = svc.buildComplianceData(baseRun({ reasoning: "" }));
    expect(data.summary).toBe("Safe Path verdict: SAFE");
  });

  it("truncates very long reasoning to ~500 chars", () => {
    const long = "x".repeat(1200);
    const svc = createComplianceDataService();
    const data = svc.buildComplianceData(baseRun({ reasoning: long }));
    expect(data.summary.length).toBeLessThanOrEqual(500);
    expect(data.summary.endsWith("…")).toBe(true);
  });
});
