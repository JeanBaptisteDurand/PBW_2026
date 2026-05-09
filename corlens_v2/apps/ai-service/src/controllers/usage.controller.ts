import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ai } from "@corlens/contracts";
import type { UsageService } from "../services/usage.service.js";

export async function registerUsageRoutes(app: FastifyInstance, svc: UsageService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get("/usage", {
    schema: { response: { 200: ai.UsageRollup }, tags: ["ai"] },
  }, async () => svc.rollupSinceMonthStart());
}
