import crypto from "node:crypto";
import PDFDocument from "pdfkit";
import type {
  ComplianceReportData,
  RiskFlagData,
  RiskSeverity,
} from "../types/compliance-report.js";

const COLORS = {
  text: "#0f172a",
  muted: "#475569",
  border: "#cbd5e1",
  bg: "#f8fafc",
  rule: "#e2e8f0",
  accent: "#0ea5e9",
  high: "#dc2626",
  med: "#d97706",
  low: "#64748b",
  high_bg: "#fee2e2",
  med_bg: "#fef3c7",
  low_bg: "#f1f5f9",
} as const;

const SEVERITY_LABEL: Record<RiskSeverity, string> = {
  HIGH: "HIGH",
  MED: "MED ",
  LOW: "LOW ",
};

function severityColor(s: RiskSeverity): string {
  return s === "HIGH" ? COLORS.high : s === "MED" ? COLORS.med : COLORS.low;
}

function severityBg(s: RiskSeverity): string {
  return s === "HIGH" ? COLORS.high_bg : s === "MED" ? COLORS.med_bg : COLORS.low_bg;
}

export type TravelRuleFields = {
  originatorName?: string;
  originatorAccount?: string;
  originatorVaspId?: string;
  beneficiaryName?: string;
  beneficiaryAccount?: string;
  beneficiaryVaspId?: string;
  amount?: string;
  currency?: string;
  jurisdictionSource?: string;
  jurisdictionDest?: string;
};

export type PdfRenderOptions = {
  travelRule?: TravelRuleFields;
  safePathJustification?: string;
};

function defaultTravelRule(report: ComplianceReportData): TravelRuleFields {
  return {
    originatorName: "[Originator VASP — to be completed by reviewer]",
    originatorAccount: "[Originator XRPL address]",
    originatorVaspId: "[LEI / GLEIF]",
    beneficiaryName: report.seedLabel ?? "[Beneficiary]",
    beneficiaryAccount: report.seedAddress,
    beneficiaryVaspId: "[LEI / GLEIF]",
    amount: "[Amount]",
    currency: "[CCY]",
    jurisdictionSource: "[ISO-3166]",
    jurisdictionDest: "[ISO-3166]",
  };
}

function screenSanctions(_address: string): {
  status: "no_match" | "potential_match" | "match";
  source: string;
  checkedAt: string;
} {
  return {
    status: "no_match",
    source: "OFAC SDN, EU consolidated list, UN 1267 (stub)",
    checkedAt: new Date().toISOString(),
  };
}

export type EntityRiskFlag = {
  flag: string;
  severity: RiskSeverity;
  detail: string;
  data?: unknown;
};

export type EntityAuditData = {
  summary: {
    id: string;
    seedAddress: string;
    seedLabel?: string | null;
    depth: number;
    stats?: {
      nodeCount: number;
      edgeCount: number;
      riskCounts: { HIGH: number; MED: number; LOW: number };
    } | null;
  };
  flags: EntityRiskFlag[];
};

export type PdfRendererService = ReturnType<typeof createPdfRendererService>;

export function createPdfRendererService() {
  return {
    computeAuditHash(report: ComplianceReportData): string {
      const canonical = JSON.stringify({
        seed: report.seedAddress,
        generatedAt: report.generatedAt,
        overall: report.riskAssessment.overall,
        flagCount: report.riskAssessment.flags.length,
        flags: report.riskAssessment.flags.map((f) => `${f.flag}:${f.severity}`).sort(),
      });
      return crypto.createHash("sha256").update(canonical).digest("hex");
    },

    async render(report: ComplianceReportData, options: PdfRenderOptions = {}): Promise<Buffer> {
      const doc = new PDFDocument({
        size: "A4",
        margin: 50,
        bufferPages: true,
        info: {
          Title: report.title,
          Author: "CorLens",
          Subject: "XRPL Risk & Compliance Report",
          CreationDate: new Date(report.generatedAt),
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      const done = new Promise<Buffer>((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
      });

      const travelRule = options.travelRule ?? defaultTravelRule(report);
      const auditHash = this.computeAuditHash(report);
      const sanctions = screenSanctions(report.seedAddress);

      // Header
      doc
        .fillColor(COLORS.accent)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("CORLENS · COMPLIANCE REPORT", { characterSpacing: 1.5 });

      doc
        .fillColor(COLORS.text)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(report.seedLabel ?? report.seedAddress, { lineGap: 2 });

      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text(report.seedAddress);
      doc.text(`Generated: ${new Date(report.generatedAt).toUTCString()}`);

      hrule(doc);
      doc.moveDown(0.5);

      // Overall risk banner
      const overall = report.riskAssessment.overall;
      const bannerY = doc.y;
      doc.rect(50, bannerY, doc.page.width - 100, 36).fill(severityBg(overall));
      doc
        .fillColor(severityColor(overall))
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(`OVERALL RISK: ${overall}`, 60, bannerY + 8, { characterSpacing: 1 });
      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(9)
        .text(
          `${report.riskAssessment.flags.length} risk flag(s) detected across ${
            report.entityBreakdown.tokens +
            report.entityBreakdown.issuers +
            report.entityBreakdown.pools +
            report.entityBreakdown.accounts
          } graph entities.`,
          60,
          bannerY + 22,
        );
      doc.y = bannerY + 46;

      // Executive summary
      sectionHeader(doc, "EXECUTIVE SUMMARY");
      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(10)
        .text(report.summary, { align: "justify", lineGap: 2 });
      doc.moveDown(0.8);

      // Travel Rule fields
      sectionHeader(doc, "TRAVEL RULE FIELDS (FATF R.16)");
      twoColumnRows(doc, [
        ["Originator name", travelRule.originatorName ?? "—"],
        ["Originator account", travelRule.originatorAccount ?? "—"],
        ["Originator VASP ID", travelRule.originatorVaspId ?? "—"],
        ["Beneficiary name", travelRule.beneficiaryName ?? "—"],
        ["Beneficiary account", travelRule.beneficiaryAccount ?? "—"],
        ["Beneficiary VASP ID", travelRule.beneficiaryVaspId ?? "—"],
        ["Amount / Currency", `${travelRule.amount ?? "—"} ${travelRule.currency ?? ""}`.trim()],
        ["Source jurisdiction", travelRule.jurisdictionSource ?? "—"],
        ["Destination jurisdiction", travelRule.jurisdictionDest ?? "—"],
      ]);
      doc.moveDown(0.8);

      // Sanctions screening
      sectionHeader(doc, "SANCTIONS SCREENING");
      doc
        .fillColor(COLORS.text)
        .font("Helvetica")
        .fontSize(9)
        .text(`Status: ${sanctions.status.toUpperCase().replace("_", " ")}`);
      doc.fillColor(COLORS.muted).text(`Source: ${sanctions.source}`);
      doc.text(`Checked at: ${sanctions.checkedAt}`);
      doc.moveDown(0.8);

      // Risk flags table
      if (report.riskAssessment.flags.length > 0) {
        sectionHeader(doc, `RISK FLAGS (${report.riskAssessment.flags.length})`);
        for (const flag of report.riskAssessment.flags) {
          renderFlagRow(doc, flag);
        }
        doc.moveDown(0.5);
      }

      // Entity breakdown
      sectionHeader(doc, "ENTITY BREAKDOWN");
      const eb = report.entityBreakdown;
      const entityRows: Array<[string, string]> = (
        [
          ["Tokens", String(eb.tokens)],
          ["Issuers", String(eb.issuers)],
          ["AMM pools", String(eb.pools)],
          ["Accounts", String(eb.accounts)],
          ["Order books", String(eb.orderBooks)],
          ["Escrows", String(eb.escrows)],
          ["Payment paths", String(eb.paymentPaths)],
          ["Checks", String(eb.checks)],
          ["Pay channels", String(eb.payChannels)],
          ["NFTs", String(eb.nfts)],
          ["Signer lists", String(eb.signerLists)],
          ["Oracles", String(eb.oracles)],
          ["DIDs / Credentials", `${eb.dids} / ${eb.credentials}`],
          ["Permissioned domains", String(eb.permissionedDomains)],
        ] as Array<[string, string]>
      ).filter(([, v]) => v !== "0");
      twoColumnRows(doc, entityRows);
      doc.moveDown(0.8);

      // Optional Safe Path agent justification
      if (options.safePathJustification) {
        sectionHeader(doc, "SAFE PATH AGENT JUSTIFICATION");
        doc
          .fillColor(COLORS.text)
          .font("Helvetica-Oblique")
          .fontSize(9)
          .text(options.safePathJustification, { align: "justify", lineGap: 2 });
        doc.moveDown(0.8);
      }

      // Recommendations
      if (report.recommendations.length > 0) {
        sectionHeader(doc, "RECOMMENDATIONS");
        doc.font("Helvetica").fontSize(10).fillColor(COLORS.text);
        for (const [i, rec] of report.recommendations.entries()) {
          doc.text(`${i + 1}. ${rec}`, { lineGap: 2 });
          doc.moveDown(0.25);
        }
        doc.moveDown(0.5);
      }

      // Reviewer signature block
      if (doc.y > doc.page.height - 180) doc.addPage();
      sectionHeader(doc, "REVIEWER SIGNATURE");

      const sigY = doc.y + 10;
      const leftX = 50;
      const rightX = doc.page.width / 2 + 10;
      const lineWidth = (doc.page.width - 100) / 2 - 10;

      doc
        .moveTo(leftX, sigY + 40)
        .lineTo(leftX + lineWidth, sigY + 40)
        .strokeColor(COLORS.border)
        .lineWidth(0.75)
        .stroke();
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Reviewer signature", leftX, sigY + 44);

      doc
        .moveTo(rightX, sigY + 40)
        .lineTo(rightX + lineWidth, sigY + 40)
        .strokeColor(COLORS.border)
        .lineWidth(0.75)
        .stroke();
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Printed name", rightX, sigY + 44);

      const dateY = sigY + 72;
      doc
        .moveTo(leftX, dateY + 20)
        .lineTo(leftX + lineWidth, dateY + 20)
        .strokeColor(COLORS.border)
        .lineWidth(0.75)
        .stroke();
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Date", leftX, dateY + 24);

      doc
        .moveTo(rightX, dateY + 20)
        .lineTo(rightX + lineWidth, dateY + 20)
        .strokeColor(COLORS.border)
        .lineWidth(0.75)
        .stroke();
      doc
        .fillColor(COLORS.muted)
        .font("Helvetica")
        .fontSize(8)
        .text("Role / Title", rightX, dateY + 24);

      // Footer with audit hash on every page
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        const footerY = doc.page.height - 32;
        doc
          .fillColor(COLORS.muted)
          .font("Helvetica")
          .fontSize(7)
          .text(
            `CorLens · audit hash ${auditHash.slice(0, 16)}…${auditHash.slice(-8)} · page ${i + 1}/${pageCount}`,
            50,
            footerY,
            { width: doc.page.width - 100, align: "center" },
          );
      }

      doc.end();
      return done;
    },

    /**
     * Thin adapter for entity-audit compliance PDFs.
     * Maps an { summary, flags } shape to ComplianceReportData and delegates to render().
     */
    async renderEntity(entity: EntityAuditData, options: PdfRenderOptions = {}): Promise<Buffer> {
      const overallSeverity: RiskSeverity = entity.flags.some((f) => f.severity === "HIGH")
        ? "HIGH"
        : entity.flags.some((f) => f.severity === "MED")
          ? "MED"
          : "LOW";

      const stats = entity.summary.stats;
      const data: ComplianceReportData = {
        title: `Entity Audit Compliance Report: ${entity.summary.seedLabel ?? entity.summary.seedAddress}`,
        generatedAt: new Date().toISOString(),
        seedAddress: entity.summary.seedAddress,
        seedLabel: entity.summary.seedLabel ?? undefined,
        summary:
          `Entity audit for ${entity.summary.seedAddress} at depth ${entity.summary.depth}. ${
            stats
              ? `Graph: ${stats.nodeCount} nodes, ${stats.edgeCount} edges. Risk counts — HIGH: ${stats.riskCounts.HIGH}, MED: ${stats.riskCounts.MED}, LOW: ${stats.riskCounts.LOW}.`
              : ""
          }`.trim(),
        riskAssessment: {
          overall: overallSeverity,
          flags: entity.flags.map((f) => ({
            flag: f.flag,
            severity: f.severity,
            detail: f.detail,
            data: f.data as Record<string, unknown> | undefined,
          })),
        },
        entityBreakdown: {
          tokens: 0,
          issuers: 0,
          pools: 0,
          accounts: stats?.nodeCount ?? 0,
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
        recommendations: [
          "Review all HIGH-severity flags before any settlement.",
          "Archive the audit-hashed PDF alongside the settlement record.",
          "Re-run the entity audit if significant time has elapsed since this report.",
        ],
      };
      return this.render(data, options);
    },
  };
}

function hrule(doc: PDFKit.PDFDocument): void {
  doc
    .moveTo(50, doc.y + 4)
    .lineTo(doc.page.width - 50, doc.y + 4)
    .strokeColor(COLORS.rule)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.5);
}

function sectionHeader(doc: PDFKit.PDFDocument, text: string): void {
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc
    .fillColor(COLORS.accent)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(text, { characterSpacing: 1 });
  doc
    .moveTo(50, doc.y + 2)
    .lineTo(doc.page.width - 50, doc.y + 2)
    .strokeColor(COLORS.rule)
    .lineWidth(0.5)
    .stroke();
  doc.moveDown(0.4);
}

function twoColumnRows(doc: PDFKit.PDFDocument, rows: Array<[string, string]>): void {
  const labelW = 140;
  const valueW = doc.page.width - 100 - labelW - 8;
  for (const [label, value] of rows) {
    if (doc.y > doc.page.height - 60) doc.addPage();
    const rowY = doc.y;
    doc
      .fillColor(COLORS.muted)
      .font("Helvetica")
      .fontSize(9)
      .text(label, 50, rowY, { width: labelW });
    const labelH = doc.heightOfString(label, { width: labelW });
    doc
      .fillColor(COLORS.text)
      .font("Helvetica")
      .fontSize(9)
      .text(value, 50 + labelW + 8, rowY, { width: valueW });
    const valueH = doc.heightOfString(value, { width: valueW });
    doc.y = rowY + Math.max(labelH, valueH) + 2;
  }
}

function renderFlagRow(doc: PDFKit.PDFDocument, flag: RiskFlagData): void {
  if (doc.y > doc.page.height - 80) doc.addPage();
  const startY = doc.y;
  const color = severityColor(flag.severity);
  const bg = severityBg(flag.severity);
  const rowHeight = Math.max(
    30,
    doc.heightOfString(flag.detail, { width: doc.page.width - 180 }) + 22,
  );
  doc.rect(50, startY, doc.page.width - 100, rowHeight).fill(bg);
  doc
    .fillColor(color)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(`[${SEVERITY_LABEL[flag.severity]}]`, 58, startY + 8);
  doc
    .fillColor(COLORS.text)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(flag.flag, 100, startY + 7);
  doc
    .fillColor(COLORS.text)
    .font("Helvetica")
    .fontSize(8)
    .text(flag.detail, 58, startY + 20, { width: doc.page.width - 120 });
  doc.y = startY + rowHeight + 4;
}
