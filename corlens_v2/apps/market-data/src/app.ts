import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type MarketDataEnv } from "./env.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { xrplPlugin } from "./plugins/xrpl.js";

const FALLBACK_ENDPOINTS = [
  "wss://xrplcluster.com",
  "wss://s2.ripple.com",
  "wss://xrpl.ws",
];

export async function buildApp(env: MarketDataEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  await app.register(redisPlugin, { url: env.REDIS_URL });
  await app.register(xrplPlugin, {
    primaryEndpoints: [env.XRPL_PRIMARY_RPC, ...FALLBACK_ENDPOINTS],
    pathfindEndpoints: [env.XRPL_PATHFIND_RPC, ...FALLBACK_ENDPOINTS],
    rateLimitIntervalMs: env.XRPL_RATE_LIMIT_INTERVAL_MS,
  });
  await registerSwagger(app);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "market-data",
    xrplConnected: app.xrpl.isConnected(),
  }));

  return app;
}
