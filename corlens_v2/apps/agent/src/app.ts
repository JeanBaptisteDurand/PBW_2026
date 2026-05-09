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
import { registerComplianceRoutes } from "./controllers/compliance.controller.js";
import { registerSafePathRoutes } from "./controllers/safe-path.controller.js";
import type { AgentEnv } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createSafePathRunRepo } from "./repositories/safe-path-run.repo.js";
import { createOrchestrator } from "./services/orchestrator.service.js";

export async function buildApp(env: AgentEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await registerSwagger(app);

  const corridor = createCorridorClient({ baseUrl: env.CORRIDOR_BASE_URL });
  const path = createPathClient({ baseUrl: env.PATH_BASE_URL });
  const ai = createAIServiceClient({ baseUrl: env.AI_SERVICE_BASE_URL });
  const marketData = createMarketDataClient({ baseUrl: env.MARKET_DATA_BASE_URL });

  const runs = createSafePathRunRepo(app.prisma);
  const orchestrator = createOrchestrator({
    corridor,
    path,
    ai,
    marketData,
    timeoutMs: env.MAX_PHASE_TIMEOUT_MS,
  });

  await registerSafePathRoutes(app, orchestrator, runs);
  await registerComplianceRoutes(app, runs);
  await registerChatRoutes(app, path, corridor);

  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "agent" }));

  return app;
}
