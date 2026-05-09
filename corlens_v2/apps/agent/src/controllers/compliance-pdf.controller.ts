import type { FastifyInstance, FastifyRequest, preHandlerAsyncHookHandler } from "fastify";
import { z } from "zod";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";
import type { ComplianceDataService } from "../services/compliance-data.service.js";
import type { PdfRendererService } from "../services/pdf-renderer.service.js";

const Params = z.object({ id: z.string().uuid() });

export type CompliancePdfDeps = {
  runs: SafePathRunRepo;
  complianceData: ComplianceDataService;
  pdfRenderer: PdfRendererService;
  requirePremium: preHandlerAsyncHookHandler;
};

export async function registerCompliancePdfRoutes(
  app: FastifyInstance,
  deps: CompliancePdfDeps,
): Promise<void> {
  app.get(
    "/api/compliance/:id/pdf",
    {
      preHandler: deps.requirePremium,
      schema: { tags: ["compliance"] },
    },
    async (req: FastifyRequest<{ Params: { id: string } }>, reply) => {
      const parsed = Params.safeParse(req.params);
      if (!parsed.success) {
        reply.code(400).send({ error: "invalid_id" });
        return reply;
      }
      const r = await deps.runs.findById(parsed.data.id);
      if (!r) {
        reply.code(404).send({ error: "not_found" });
        return reply;
      }
      const data = deps.complianceData.buildComplianceData(r);
      const pdf = await deps.pdfRenderer.render(data);
      reply
        .header("Content-Type", "application/pdf")
        .header("Content-Disposition", `attachment; filename="compliance-${r.id}.pdf"`)
        .send(pdf);
      return reply;
    },
  );
}
