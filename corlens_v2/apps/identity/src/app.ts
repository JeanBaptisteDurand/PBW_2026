import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type IdentityEnv } from "./env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";

export async function buildApp(env: IdentityEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "identity",
  }));

  return app;
}
