import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import type { CorridorRepo } from "../repositories/corridor.repo.js";
import type { StatusEventRepo } from "../repositories/status-event.repo.js";
import type { ScannerService } from "../services/scanner.service.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerAdminRoutes(
  app: FastifyInstance,
  corridors: CorridorRepo,
  events: StatusEventRepo,
  scanner: ScannerService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post(
    "/admin/scan/:id",
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({ ok: z.boolean(), status: z.string(), pathCount: z.number() }),
          404: ErrorResp,
        },
        tags: ["admin"],
      },
    },
    async (req, reply) => {
      const c = await corridors.findById(req.params.id);
      if (!c) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      const result = await scanner.scan({
        id: c.id,
        source: c.sourceJson as never,
        dest: c.destJson as never,
        amount: c.amount,
      });
      await corridors.updateScan(c.id, {
        status: result.status,
        pathCount: result.pathCount,
        recRiskScore: result.recRiskScore,
        recCost: result.recCost,
        flagsJson: result.flagsJson,
        routesJson: result.routesJson,
        liquidityJson: result.liquidityJson,
      });
      await events.append({
        corridorId: c.id,
        status: result.status,
        pathCount: result.pathCount,
        recCost: result.recCost,
        source: "manual",
      });
      return { ok: true, status: result.status, pathCount: result.pathCount };
    },
  );
}
