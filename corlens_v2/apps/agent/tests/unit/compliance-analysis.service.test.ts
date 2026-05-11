import { describe, expect, it, vi } from "vitest";
import { createComplianceAnalysisService } from "../../src/services/compliance-analysis.service.js";

describe("compliance-analysis.service", () => {
  it("builds markdown + stable auditHash from path graph + analysis summary", async () => {
    const path = {
      getAnalysis: vi.fn(async () => ({
        id: "00000000-0000-0000-0000-000000000001",
        seedAddress: "rSeedrSeedrSeedrSeedrSeedrSeedrSe",
        seedLabel: "Test Seed",
        depth: 1,
        status: "done",
        error: null,
        stats: { nodeCount: 5, edgeCount: 8, riskCounts: { HIGH: 1, MED: 0, LOW: 2 } },
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:01:00.000Z",
      })),
      getGraph: vi.fn(async () => ({
        nodes: [
          {
            riskFlags: [
              {
                flag: "GLOBAL_FREEZE",
                severity: "HIGH",
                detail: "frozen",
                data: { address: "rSeedrSeedrSeedrSeedrSeedrSeedrSe" },
              },
              {
                flag: "UNVERIFIED_ISSUER",
                severity: "LOW",
                detail: "no domain",
                data: { address: "rSeedrSeedrSeedrSeedrSeedrSeedrSe" },
              },
            ],
          },
          { riskFlags: [] },
        ],
      })),
    };
    const svc = createComplianceAnalysisService({ path });
    const r = await svc.build("00000000-0000-0000-0000-000000000001");
    expect(r.markdown).toContain("Entity Audit Compliance Report");
    expect(r.markdown).toContain("rSeed");
    expect(r.markdown).toContain("GLOBAL_FREEZE");
    expect(r.auditHash).toMatch(/^[0-9a-f]{64}$/);
    const r2 = await svc.build("00000000-0000-0000-0000-000000000001");
    expect(r2.auditHash).toBe(r.auditHash); // stable for same input
  });

  it("throws 'not_found' if analysis missing", async () => {
    const path = {
      getAnalysis: vi.fn(async () => null),
      getGraph: vi.fn(),
    };
    const svc = createComplianceAnalysisService({ path });
    await expect(svc.build("00000000-0000-0000-0000-000000000099")).rejects.toThrow("not_found");
  });
});
