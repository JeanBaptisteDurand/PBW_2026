import { describe, expect, it } from "vitest";
import { renderComplianceMarkdown } from "../../src/services/compliance.service.js";

describe("compliance.service", () => {
  it("renders a markdown report from a SafePathRun row", () => {
    const md = renderComplianceMarkdown({
      id: "11111111-1111-1111-1111-111111111111",
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
      verdict: "SAFE",
      reasoning: "Healthy corridor with strong liquidity.",
      reportMarkdown: null,
      analysisIds: [],
      createdAt: new Date("2026-05-09T12:00:00Z"),
      userId: null,
      corridorId: null,
      resultJson: { riskScore: 0.2 },
    });
    expect(md).toContain("# Safe Path Compliance Report");
    expect(md).toContain("USD → MXN");
    expect(md).toContain("Verdict: **SAFE**");
    expect(md).toContain("Risk score: 0.20");
  });

  it("uses the run's reportMarkdown verbatim when present", () => {
    const md = renderComplianceMarkdown({
      id: "11111111-1111-1111-1111-111111111111",
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
      verdict: "SAFE",
      reasoning: "",
      reportMarkdown: "# Pre-rendered Report\n\nThis is the AI-generated content.",
      analysisIds: [],
      createdAt: new Date("2026-05-09T12:00:00Z"),
      userId: null,
      corridorId: null,
      resultJson: {},
    });
    expect(md).toContain("# Pre-rendered Report");
  });
});
