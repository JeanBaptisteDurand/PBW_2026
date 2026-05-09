import { describe, expect, it } from "vitest";
import { createPdfRendererService } from "../../src/services/pdf-renderer.service.js";
import type { ComplianceReportData } from "../../src/types/compliance-report.js";

function baseReport(): ComplianceReportData {
  return {
    title: "Safe Path Compliance Report: USD → MXN",
    generatedAt: "2026-05-09T12:00:00.000Z",
    seedAddress: "safepath:11111111-1111-1111-1111-111111111111",
    seedLabel: "USD → MXN",
    summary: "Healthy corridor with strong liquidity.",
    riskAssessment: { overall: "LOW", flags: [] },
    entityBreakdown: {
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
    },
    recommendations: ["Proceed with standard monitoring."],
  };
}

describe("pdf-renderer.service", () => {
  it("render returns a non-empty Buffer with a %PDF- magic header", async () => {
    const svc = createPdfRendererService();
    const buf = await svc.render(baseReport());
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(1024);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("render emits a substantially larger PDF with HIGH-severity flags", async () => {
    const svc = createPdfRendererService();
    const small = await svc.render(baseReport());
    const heavy: ComplianceReportData = {
      ...baseReport(),
      riskAssessment: {
        overall: "HIGH",
        flags: [
          {
            flag: "GLOBAL_FREEZE",
            severity: "HIGH",
            detail: "Issuer has GlobalFreeze enabled across all trust lines.",
          },
          {
            flag: "CONCENTRATED_LIQUIDITY",
            severity: "HIGH",
            detail: "Top 3 holders control more than 80% of circulating supply.",
          },
          {
            flag: "HIGH_TRANSFER_FEE",
            severity: "MED",
            detail: "Issuer transfer fee exceeds 1%.",
          },
        ],
      },
    };
    const big = await svc.render(heavy);
    expect(big.byteLength).toBeGreaterThan(small.byteLength);
    expect(big.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("computeAuditHash is deterministic and field-sensitive", () => {
    const svc = createPdfRendererService();
    const r1 = baseReport();
    const r2 = baseReport();
    expect(svc.computeAuditHash(r1)).toBe(svc.computeAuditHash(r2));

    const mutated: ComplianceReportData = {
      ...r1,
      riskAssessment: {
        overall: "HIGH",
        flags: [...r1.riskAssessment.flags],
      },
    };
    expect(svc.computeAuditHash(mutated)).not.toBe(svc.computeAuditHash(r1));

    const renamedSeed: ComplianceReportData = { ...r1, seedAddress: "safepath:other" };
    expect(svc.computeAuditHash(renamedSeed)).not.toBe(svc.computeAuditHash(r1));
  });
});
