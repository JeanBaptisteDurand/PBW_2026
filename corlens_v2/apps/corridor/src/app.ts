import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify, { type FastifyInstance } from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { createAIServiceClient } from "./connectors/ai-service.js";
import { createMarketDataClient } from "./connectors/market-data.js";
import { registerAdminRoutes } from "./controllers/admin.controller.js";
import { registerChatRoutes } from "./controllers/chat.controller.js";
import { registerCorridorRoutes } from "./controllers/corridor.controller.js";
import { registerCurrencyMetaRoutes } from "./controllers/currency-meta.controller.js";
import { registerPartnerDepthRoutes } from "./controllers/partner-depth.controller.js";
import { startRefreshCron } from "./crons/refresh.js";
import type { CorridorEnv } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createCorridorRepo } from "./repositories/corridor.repo.js";
import { createCurrencyMetaRepo } from "./repositories/currency-meta.repo.js";
import { createRagRepo } from "./repositories/rag.repo.js";
import { createStatusEventRepo } from "./repositories/status-event.repo.js";
import { createAiNoteService } from "./services/ai-note.service.js";
import { createCatalogSeeder } from "./services/catalog-seeder.service.js";
import { createChatService } from "./services/chat.service.js";
import { createCurrencyMetaSeeder } from "./services/currency-meta-seeder.service.js";
import { createCurrencyMetaService } from "./services/currency-meta.service.js";
import { createRagIndexService } from "./services/rag-index.service.js";
import { createScannerService } from "./services/scanner.service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp(env: CorridorEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  const marketData = createMarketDataClient({
    baseUrl: env.MARKET_DATA_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });
  const ai = createAIServiceClient({
    baseUrl: env.AI_SERVICE_BASE_URL,
    hmacSecret: env.INTERNAL_HMAC_SECRET,
  });

  const corridors = createCorridorRepo(app.prisma);
  const events = createStatusEventRepo(app.prisma);
  const ragRepo = createRagRepo(app.prisma);

  const seeder = createCatalogSeeder({
    repo: corridors,
    seedPath: path.join(__dirname, "..", "seed", "corridors.json"),
  });
  const seedResult = await seeder.seedIfEmpty();
  app.log.info({ seedResult }, "corridor seed check");

  const currencyMetaRepo = createCurrencyMetaRepo(app.prisma);
  const currencyMetaSeeder = createCurrencyMetaSeeder({
    repo: currencyMetaRepo,
    seedPath: path.join(__dirname, "..", "seed", "currency-meta.json"),
  });
  const currencyMetaSeedResult = await currencyMetaSeeder.seedIfEmpty();
  app.log.info({ currencyMetaSeedResult }, "currency-meta seed check");
  const currencyMetaService = createCurrencyMetaService({
    repo: currencyMetaRepo,
    globalHubs: currencyMetaSeeder.globalHubs(),
  });

  const scanner = createScannerService({ marketData, timeoutMs: env.SCAN_TIMEOUT_MS });
  const aiNote = createAiNoteService({ ai });
  const ragIndex = createRagIndexService({ ai, repo: ragRepo });
  const chat = createChatService({ ai, repo: ragRepo, topK: 3 });

  await registerCorridorRoutes(app, corridors, events);
  await registerChatRoutes(app, chat);
  await registerPartnerDepthRoutes(app, marketData);
  await registerCurrencyMetaRoutes(app, currencyMetaService);
  await registerAdminRoutes(app, corridors, events, scanner);

  const refresh = await startRefreshCron({
    redisUrl: env.REDIS_URL,
    cron: env.REFRESH_CRON,
    enabled: env.REFRESH_ENABLED,
    concurrency: env.SCAN_CONCURRENCY,
    corridors,
    events,
    scanner,
  });
  app.addHook("onClose", async () => {
    await refresh.stop();
  });

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "corridor",
  }));

  // Avoid unused-variable typecheck errors — these are wired here for future use by the cron + admin route handlers
  void aiNote;
  void ragIndex;

  return app;
}
