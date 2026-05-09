import Fastify, { type FastifyInstance } from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import OpenAI from "openai";
import { createOpenAIClient } from "./connectors/openai.js";
import { createTavilyClient } from "./connectors/tavily.js";
import { registerCompletionRoutes } from "./controllers/completion.controller.js";
import { registerEmbeddingRoutes } from "./controllers/embedding.controller.js";
import { registerEventRoutes } from "./controllers/events.controller.js";
import { registerUsageRoutes } from "./controllers/usage.controller.js";
import { registerWebSearchRoutes } from "./controllers/web-search.controller.js";
import type { AiServiceEnv } from "./env.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createPromptLogRepo } from "./repositories/prompt-log.repo.js";
import { createWebSearchCacheRepo } from "./repositories/web-search-cache.repo.js";
import { createCompletionService } from "./services/completion.service.js";
import { createEmbeddingService } from "./services/embedding.service.js";
import { createUsageService } from "./services/usage.service.js";
import { createWebSearchService } from "./services/web-search.service.js";

export async function buildApp(env: AiServiceEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await registerSwagger(app);

  const openai = createOpenAIClient({ openai: new OpenAI({ apiKey: env.OPENAI_API_KEY }) });
  const tavily = env.TAVILY_API_KEY ? createTavilyClient({ apiKey: env.TAVILY_API_KEY }) : null;
  const promptLog = createPromptLogRepo(app.prisma);
  const cache = createWebSearchCacheRepo(app.prisma);

  const completion = createCompletionService({
    openai,
    promptLog,
    defaultModel: env.DEFAULT_CHAT_MODEL,
  });
  const embedding = createEmbeddingService({
    openai,
    promptLog,
    defaultModel: env.DEFAULT_EMBEDDING_MODEL,
  });
  const webSearch = createWebSearchService({
    tavily,
    cache,
    promptLog,
    ttlHours: env.WEB_SEARCH_CACHE_HOURS,
  });
  const usage = createUsageService({ promptLog });

  await registerCompletionRoutes(app, completion);
  await registerEmbeddingRoutes(app, embedding);
  await registerWebSearchRoutes(app, webSearch);
  await registerUsageRoutes(app, usage);
  await registerEventRoutes(app, env);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "ai-service",
    openaiConfigured: !!env.OPENAI_API_KEY,
    webSearchEnabled: !!env.TAVILY_API_KEY,
  }));
  return app;
}
