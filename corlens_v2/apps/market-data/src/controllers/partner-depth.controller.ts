import { marketData as md } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { PartnerDepthService } from "../services/partner-depth.service.js";

export async function registerPartnerDepthRoutes(
  app: FastifyInstance,
  svc: PartnerDepthService,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get(
    "/partner-depth/:actor/:book",
    {
      schema: {
        params: md.PartnerDepthParams,
        response: { 200: md.PartnerDepthSnapshot },
        tags: ["partner-depth"],
      },
    },
    async (req) => svc.fetch(req.params.actor, req.params.book),
  );
}
