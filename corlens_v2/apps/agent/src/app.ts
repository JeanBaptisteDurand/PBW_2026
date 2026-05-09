import Fastify, { type FastifyInstance } from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { createAIServiceClient } from "./connectors/ai-service.js";
import { createCorridorClient } from "./connectors/corridor.js";
import { createMarketDataClient } from "./connectors/market-data.js";
import { createPathClient } from "./connectors/path.js";
import { registerChatRoutes } from "./controllers/chat.controller.js";
import { registerCompliancePdfRoutes } from "./controllers/compliance-pdf.controller.js";
import { registerComplianceVerifyRoutes } from "./controllers/compliance-verify.controller.js";
import { registerComplianceRoutes } from "./controllers/compliance.controller.js";
import { registerEventRoutes } from "./controllers/events.controller.js";
import { registerSafePathRoutes } from "./controllers/safe-path.controller.js";
import type { AgentEnv } from "./env.js";
import { createRequirePremiumPreHandler } from "./middleware/require-premium.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createSafePathRunRepo } from "./repositories/safe-path-run.repo.js";
import { createComplianceDataService } from "./services/compliance-data.service.js";
import { createOrchestrator } from "./services/orchestrator.service.js";
import { createPdfRendererService } from "./services/pdf-renderer.service.js";

export type BuildAppOptions = {
  fetch?: typeof fetch;
};

export async function buildApp(
  env: AgentEnv,
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await registerSwagger(app);

  const corridor = createCorridorClient({
    baseUrl: env.CORRIDOR_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });
  const path = createPathClient({
    baseUrl: env.PATH_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });
  const ai = createAIServiceClient({
    baseUrl: env.AI_SERVICE_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });
  const marketData = createMarketDataClient({
    baseUrl: env.MARKET_DATA_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });

  const runs = createSafePathRunRepo(app.prisma);
  const complianceData = createComplianceDataService();
  const pdfRenderer = createPdfRendererService();
  const orchestrator = createOrchestrator({
    corridor,
    path,
    ai,
    marketData,
    timeoutMs: env.MAX_PHASE_TIMEOUT_MS,
  });

  const requirePremium = createRequirePremiumPreHandler({
    identityBaseUrl: env.IDENTITY_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
    fetch: options.fetch,
  });

  await registerSafePathRoutes(app, { orchestrator, runs, complianceData, pdfRenderer });
  await registerComplianceRoutes(app, runs);
  await registerComplianceVerifyRoutes(app, runs);
  await registerCompliancePdfRoutes(app, { runs, complianceData, pdfRenderer, requirePremium });
  await registerChatRoutes(app, path, corridor);
  await registerEventRoutes(app, env);

  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "agent" }));

  return app;
}
