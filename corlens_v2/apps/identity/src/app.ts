import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type IdentityEnv } from "./env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createJwtService, type JwtService } from "./services/jwt.service.js";
import { registerVerifyRoutes } from "./controllers/verify.controller.js";
import { registerAuthRoutes } from "./controllers/auth.controller.js";

declare module "fastify" {
  interface FastifyInstance {
    jwtService: JwtService;
  }
}

export async function buildApp(env: IdentityEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  app.decorate("jwtService", createJwtService({ secret: env.JWT_SECRET, ttlSeconds: 86400 }));

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  await registerVerifyRoutes(app);
  await registerAuthRoutes(app, env);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "identity",
  }));

  return app;
}
