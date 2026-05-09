import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { agent as ag } from "@corlens/contracts";
import { renderComplianceMarkdown } from "../services/compliance.service.js";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerComplianceRoutes(app: FastifyInstance, runs: SafePathRunRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get("/api/compliance/:id", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: ag.ComplianceResponse, 404: ErrorResp }, tags: ["compliance"] },
  }, async (req, reply) => {
    const r = await runs.findById(req.params.id);
    if (!r) { reply.status(404).send({ error: "not_found" }); return reply; }
    return { runId: r.id, markdown: renderComplianceMarkdown(r) };
  });
}
