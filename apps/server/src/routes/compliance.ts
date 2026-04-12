import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { generateComplianceReport } from "../ai/compliance.js";
import { renderCompliancePdf } from "../ai/pdfRenderer.js";
import type { ComplianceReportData } from "@xrplens/core";
import { verifyApiKeyOrJwt, requirePremium } from "../middleware/auth.js";

export const complianceRouter: IRouter = Router();

// POST /:analysisId — Generate compliance report
complianceRouter.post("/:analysisId", verifyApiKeyOrJwt, requirePremium, async (req, res) => {
  try {
    const analysisId = String(req.params.analysisId);

    const analysis = await prisma.analysis.findUnique({
      where: { id: analysisId },
    });

    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    // Allow report generation if data exists, even during AI explanation step
    const nodeCount = await prisma.node.count({ where: { analysisId } });
    if (nodeCount === 0 && analysis.status !== "done") {
      res.status(400).json({ error: "Analysis is not complete yet" });
      return;
    }

    // Fetch graph data
    const [dbNodes, dbEdges, dbRiskFlags] = await Promise.all([
      prisma.node.findMany({ where: { analysisId } }),
      prisma.edge.findMany({ where: { analysisId } }),
      prisma.riskFlag.findMany({ where: { analysisId } }),
    ]);

    const report = await generateComplianceReport(analysis, dbNodes, dbEdges, dbRiskFlags);

    const saved = await prisma.complianceReport.create({
      data: {
        analysisId,
        title: report.title,
        content: report as any,
      },
    });

    logger.info("[route] Compliance report generated", { analysisId, reportId: saved.id });
    res.status(201).json({ id: saved.id, report });
  } catch (err: any) {
    logger.error("[route] Failed to generate compliance report", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:analysisId/pdf — Render a compliance report as a signable PDF.
// Generates (or re-uses the latest) report for the analysis, then pipes a
// pdfkit-rendered A4 document back to the client. The Safe Path Agent
// justification is accepted as an optional query param so the same route
// serves both the raw compliance artifact and the post-agent signed version.
complianceRouter.get("/:analysisId/pdf", verifyApiKeyOrJwt, requirePremium, async (req, res) => {
  try {
    const analysisId = String(req.params.analysisId);
    const justification = typeof req.query.justification === "string"
      ? req.query.justification
      : undefined;

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    const nodeCount = await prisma.node.count({ where: { analysisId } });
    if (nodeCount === 0 && analysis.status !== "done") {
      res.status(400).json({ error: "Analysis is not complete yet" });
      return;
    }

    // Prefer the most recent saved report so repeated PDF downloads are
    // consistent with the one already shown in the UI.
    let report: ComplianceReportData | null = null;
    const existing = await prisma.complianceReport.findFirst({
      where: { analysisId },
      orderBy: { createdAt: "desc" },
    });
    if (existing) {
      report = existing.content as unknown as ComplianceReportData;
    } else {
      const [dbNodes, dbEdges, dbRiskFlags] = await Promise.all([
        prisma.node.findMany({ where: { analysisId } }),
        prisma.edge.findMany({ where: { analysisId } }),
        prisma.riskFlag.findMany({ where: { analysisId } }),
      ]);
      report = await generateComplianceReport(analysis, dbNodes, dbEdges, dbRiskFlags);
      await prisma.complianceReport.create({
        data: { analysisId, title: report.title, content: report as any },
      });
    }

    const pdf = await renderCompliancePdf(report, {
      safePathJustification: justification,
    });

    const filename = `xrplens-compliance-${analysis.seedAddress.slice(0, 8)}-${Date.now()}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", pdf.length);
    res.send(pdf);
  } catch (err: any) {
    logger.error("[route] Failed to render compliance PDF", {
      error: err?.message,
      stack: err?.stack,
    });
    res.status(500).json({ error: "Failed to render PDF" });
  }
});

// GET /:analysisId — Get existing compliance reports
complianceRouter.get("/:analysisId", async (req, res) => {
  try {
    const { analysisId } = req.params;

    const analysis = await prisma.analysis.findUnique({ where: { id: analysisId } });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    const reports = await prisma.complianceReport.findMany({
      where: { analysisId },
      orderBy: { createdAt: "desc" },
    });

    res.json(reports.map((r) => ({ id: r.id, report: r.content })));
  } catch (err: any) {
    logger.error("[route] Failed to get compliance reports", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
