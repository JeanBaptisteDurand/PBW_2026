import Fastify, { type FastifyInstance } from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { createAIServiceClient } from "./connectors/ai-service.js";
import { createMarketDataClient } from "./connectors/market-data.js";
import { registerAnalysisRoutes } from "./controllers/analysis.controller.js";
import { registerAnalyzeRoutes } from "./controllers/analyze.controller.js";
import { registerChatRoutes } from "./controllers/chat.controller.js";
import { registerHistoryStreamRoutes } from "./controllers/history-stream.controller.js";
import { registerHistoryRoutes } from "./controllers/history.controller.js";
import type { PathEnv } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createAnalysisRepo } from "./repositories/analysis.repo.js";
import { createGraphRepo } from "./repositories/graph.repo.js";
import { createRagRepo } from "./repositories/rag.repo.js";
import { createBfsService } from "./services/bfs.service.js";
import { createChatService } from "./services/chat.service.js";
import { createCrawlerService } from "./services/crawler.service.js";
import { createExplanationsService } from "./services/explanations.service.js";
import { createHistoryCrawlerService } from "./services/history-crawler.service.js";
import { createHistoryService } from "./services/history.service.js";
import { createRagIndexService } from "./services/rag-index.service.js";
import { startAnalysisWorker } from "./workers/analysis.worker.js";

export async function buildApp(env: PathEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  const marketData = createMarketDataClient({ baseUrl: env.MARKET_DATA_BASE_URL });
  const ai = createAIServiceClient({ baseUrl: env.AI_SERVICE_BASE_URL });

  const analyses = createAnalysisRepo(app.prisma);
  const graphs = createGraphRepo(app.prisma);
  const ragRepo = createRagRepo(app.prisma);

  const crawler = createCrawlerService({ marketData });
  const bfs = createBfsService({ crawler });
  const historyCrawler = createHistoryCrawlerService({ marketData });
  const history = createHistoryService({ marketData, historyCrawler });
  const explanations = createExplanationsService({ ai, graph: graphs });
  const ragIndex = createRagIndexService({ ai, repo: ragRepo });
  const chat = createChatService({ ai, repo: ragRepo, topK: env.RAG_TOP_K });

  const queue = await startAnalysisWorker({
    redisUrl: env.REDIS_URL,
    enabled: env.WORKER_ENABLED,
    concurrency: env.BFS_CONCURRENCY,
    analyses,
    graphs,
    bfs,
    explanations,
    ragIndex,
  });
  app.addHook("onClose", async () => {
    await queue.stop();
  });

  await registerAnalyzeRoutes(app, analyses, queue);
  await registerAnalysisRoutes(app, analyses, graphs);
  await registerChatRoutes(app, chat);
  // Register the SSE stream route BEFORE the param route. Fastify's router
  // would normally prefer the static path, but registering stream first
  // makes the precedence intent unambiguous in the event of future churn.
  await registerHistoryStreamRoutes(app, history);
  await registerHistoryRoutes(app, analyses);

  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "path" }));

  return app;
}
