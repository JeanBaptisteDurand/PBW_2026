import type { ComplianceReportData } from "@corlens/core";
import { RISK_COLORS } from "@corlens/core";
import { shortenAddress, formatNumber } from "../../lib/utils";
import { Badge } from "../ui/badge";

interface ComplianceReportProps {
  report: ComplianceReportData;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        textTransform: "uppercase",
        color: "#475569",
        marginBottom: 12,
        paddingBottom: 6,
        borderBottom: "1px solid #1e293b",
      }}
    >
      {children}
    </h3>
  );
}

export function ComplianceReport({ report }: ComplianceReportProps) {
  const overallColor =
    report.riskAssessment.overall === "HIGH"
      ? "#ef4444"
      : report.riskAssessment.overall === "MED"
      ? "#f59e0b"
      : "#6b7280";

  const overallVariant =
    report.riskAssessment.overall === "HIGH"
      ? "high"
      : report.riskAssessment.overall === "MED"
      ? "med"
      : "low";

  return (
    <div
      id="compliance-report"
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "#e2e8f0",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 10,
          padding: "24px 32px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: 2,
                color: "#0ea5e9",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              CorLens AML Compliance Report
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#f8fafc", margin: 0 }}>
              {report.title}
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4 }}>
              Generated
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>
              {new Date(report.generatedAt).toLocaleString()}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>
              Seed Address
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#94a3b8" }}>
              {report.seedAddress}
            </div>
          </div>
          {report.seedLabel && (
            <div>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 2 }}>
                Label
              </div>
              <div style={{ fontSize: 12, color: "#e2e8f0" }}>{report.seedLabel}</div>
            </div>
          )}
        </div>

        {report.summary && (
          <div
            style={{
              marginTop: 16,
              padding: "12px 16px",
              background: "#020617",
              borderRadius: 6,
              borderLeft: `3px solid ${overallColor}`,
              fontSize: 13,
              color: "#94a3b8",
              lineHeight: 1.6,
            }}
          >
            {report.summary}
          </div>
        )}
      </div>

      {/* Risk Assessment */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 10,
          padding: "20px 32px",
          marginBottom: 20,
        }}
      >
        <SectionTitle>Risk Assessment</SectionTitle>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: "#94a3b8" }}>Overall Rating:</span>
          <Badge variant={overallVariant} className="text-sm px-3 py-1">
            {report.riskAssessment.overall}
          </Badge>
        </div>

        {report.riskAssessment.flags.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {report.riskAssessment.flags.map((flag, i) => {
              const fc = RISK_COLORS[flag.severity];
              return (
                <div
                  key={i}
                  style={{
                    padding: "10px 14px",
                    background: "#020617",
                    borderRadius: 6,
                    border: `1px solid ${fc}30`,
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                  }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: fc,
                      marginTop: 4,
                      flexShrink: 0,
                    }}
                  />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: fc }}>
                      {flag.flag}{" "}
                      <span style={{ fontSize: 10, fontWeight: 400, color: "#64748b" }}>
                        [{flag.severity}]
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {flag.detail}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: "#64748b" }}>No risk flags detected.</p>
        )}
      </div>

      {/* Entity Breakdown */}
      <div
        style={{
          background: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: 10,
          padding: "20px 32px",
          marginBottom: 20,
        }}
      >
        <SectionTitle>Entity Breakdown</SectionTitle>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
            gap: 12,
          }}
        >
          {Object.entries(report.entityBreakdown).map(([key, val]) => (
            <div
              key={key}
              style={{
                background: "#020617",
                borderRadius: 8,
                padding: "12px 14px",
                border: "1px solid #1e293b",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: "#0ea5e9" }}>
                {formatNumber(val)}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#64748b",
                  textTransform: "capitalize",
                  marginTop: 2,
                }}
              >
                {key}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Concentration Analysis */}
      {report.concentrationAnalysis && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 10,
            padding: "20px 32px",
            marginBottom: 20,
          }}
        >
          <SectionTitle>Concentration Analysis</SectionTitle>

          {typeof report.concentrationAnalysis.herfindahlIndex === "number" && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#94a3b8" }}>
              Herfindahl Index:{" "}
              <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
                {report.concentrationAnalysis.herfindahlIndex.toFixed(4)}
              </span>
            </div>
          )}

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    color: "#475569",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    borderBottom: "1px solid #1e293b",
                  }}
                >
                  Address
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "8px 12px",
                    color: "#475569",
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    borderBottom: "1px solid #1e293b",
                  }}
                >
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {report.concentrationAnalysis.topHolders.map((holder, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid #0f172a" }}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontFamily: "monospace",
                      color: "#94a3b8",
                      fontSize: 11,
                    }}
                  >
                    {shortenAddress(holder.address, 10)}
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      textAlign: "right",
                      color: holder.percentage > 25 ? "#ef4444" : "#e2e8f0",
                      fontWeight: 600,
                    }}
                  >
                    {holder.percentage.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gateway Obligations */}
      {report.gatewayAnalysis && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 10,
            padding: "20px 32px",
            marginBottom: 20,
          }}
        >
          <SectionTitle>Gateway Obligations</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Object.entries(report.gatewayAnalysis.totalObligations).map(
              ([currency, amount]) => (
                <div
                  key={currency}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "#020617",
                    borderRadius: 6,
                    border: "1px solid #1e293b",
                    fontSize: 12,
                  }}
                >
                  <span style={{ color: "#f59e0b", fontWeight: 600 }}>
                    {currency}
                  </span>
                  <span style={{ color: "#e2e8f0", fontFamily: "monospace" }}>
                    {formatNumber(amount)}
                  </span>
                </div>
              ),
            )}
          </div>

          {report.gatewayAnalysis.gateways.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 10, color: "#64748b", marginBottom: 6 }}>
                Gateway Accounts
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {report.gatewayAnalysis.gateways.map((gw) => (
                  <span
                    key={gw}
                    style={{
                      fontFamily: "monospace",
                      fontSize: 10,
                      color: "#64748b",
                      background: "#0f172a",
                      border: "1px solid #1e293b",
                      borderRadius: 4,
                      padding: "2px 6px",
                    }}
                  >
                    {shortenAddress(gw)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 10,
            padding: "20px 32px",
            marginBottom: 20,
          }}
        >
          <SectionTitle>Recommendations</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
            {report.recommendations.map((rec, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "8px 0",
                  borderBottom:
                    i < report.recommendations.length - 1
                      ? "1px solid #1e293b"
                      : "none",
                  fontSize: 13,
                  color: "#94a3b8",
                  lineHeight: 1.6,
                }}
              >
                <span style={{ color: "#0ea5e9", marginTop: 2, flexShrink: 0 }}>
                  →
                </span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
