// HMAC convention: preHandler: createHmacVerifyHook(...) on each protected route.
// Confirmed by identity/src/controllers/internal.controller.ts and
// ai-service/src/controllers/events.controller.ts.

import { path as pp } from "@corlens/contracts";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { createHmacVerifyHook } from "../middleware/hmac-verify.js";
import type { QuickEvalService } from "../services/quick-eval.service.js";

export function registerRiskEngineRoutes(
  app: FastifyInstance,
  svc: QuickEvalService,
  hmacSecret: string,
): void {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const hmacGuard = createHmacVerifyHook({ secret: hmacSecret });

  typed.post(
    "/api/risk-engine/quick-eval",
    {
      preHandler: hmacGuard,
      schema: {
        hide: true,
        body: pp.RiskQuickEvalRequest,
        response: { 200: pp.RiskQuickEvalResponse },
        tags: ["risk-engine"],
      },
    },
    async (req) => svc.evaluate(req.body.address),
  );
}
