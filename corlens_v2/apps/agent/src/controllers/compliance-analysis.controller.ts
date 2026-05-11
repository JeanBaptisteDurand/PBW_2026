import { agent as ag } from "@corlens/contracts";
import type { FastifyInstance, preHandlerAsyncHookHandler } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { ComplianceAnalysisService } from "../services/compliance-analysis.service.js";
import {
  type PdfRendererService,
  createPdfRendererService,
} from "../services/pdf-renderer.service.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerComplianceAnalysisRoutes(
  app: FastifyInstance,
  svc: ComplianceAnalysisService,
  requirePremium: preHandlerAsyncHookHandler,
  pdfRenderer?: PdfRendererService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const pdf = pdfRenderer ?? createPdfRendererService();

  async function safeBuild(id: string) {
    try {
      return await svc.build(id);
    } catch (err) {
      if (err instanceof Error && err.message === "not_found") return null;
      throw err;
    }
  }

  typed.post(
    "/api/compliance/analysis/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        body: ag.AnalysisComplianceRequest,
        response: { 200: ag.AnalysisComplianceResponse, 404: ErrorResp },
        tags: ["compliance"],
      },
    },
    async (req, reply) => {
      const result = await safeBuild(req.params.id);
      if (!result) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return {
        analysisId: result.analysisId,
        markdown: result.markdown,
        auditHash: result.auditHash,
      };
    },
  );

  typed.get(
    "/api/compliance/analysis/:id",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: ag.AnalysisComplianceResponse, 404: ErrorResp },
        tags: ["compliance"],
      },
    },
    async (req, reply) => {
      const result = await safeBuild(req.params.id);
      if (!result) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return {
        analysisId: result.analysisId,
        markdown: result.markdown,
        auditHash: result.auditHash,
      };
    },
  );

  typed.get(
    "/api/compliance/analysis/:id/pdf",
    {
      preHandler: requirePremium,
      schema: {
        params: z.object({ id: z.string().uuid() }),
        tags: ["compliance"],
      },
    },
    async (req, reply) => {
      const result = await safeBuild(req.params.id);
      if (!result) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      const bytes = await pdf.renderEntity(result.data);
      reply
        .header("content-type", "application/pdf")
        .header(
          "content-disposition",
          `attachment; filename="compliance-analysis-${result.analysisId}.pdf"`,
        )
        .send(bytes);
      return reply;
    },
  );
}
