import { hmacSigner } from "@corlens/clients";
import {
  CompositeEventBus,
  type EventBus,
  HttpFanoutEventBus,
  InMemoryEventBus,
} from "@corlens/events";
import Fastify, { type FastifyInstance } from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { type XrplPaymentClient, createXrplPaymentClient } from "./connectors/xrpl.js";
import { registerAuthRoutes } from "./controllers/auth.controller.js";
import { registerInternalRoutes } from "./controllers/internal.controller.js";
import { registerPaymentRoutes } from "./controllers/payment.controller.js";
import { registerVerifyRoutes } from "./controllers/verify.controller.js";
import type { IdentityEnv } from "./env.js";
import { registerEventHandlers } from "./events/handlers.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createPaymentRepo } from "./repositories/payment.repo.js";
import { type JwtService, createJwtService } from "./services/jwt.service.js";
import { createPaymentService } from "./services/payment.service.js";

declare module "fastify" {
  interface FastifyInstance {
    jwtService: JwtService;
    events: EventBus;
    xrpl: XrplPaymentClient;
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

  const inMemBus = new InMemoryEventBus();
  const fanoutBus = new HttpFanoutEventBus({
    subscribers: {
      "payment.confirmed": [
        `${env.AI_SERVICE_BASE_URL}/events/payment.confirmed`,
        `${env.AGENT_BASE_URL}/events/payment.confirmed`,
      ],
    },
    signal: hmacSigner({ secret: env.INTERNAL_HMAC_SECRET }),
  });
  app.decorate("events", new CompositeEventBus([inMemBus, fanoutBus]));
  app.decorate("xrpl", createXrplPaymentClient({ rpcUrl: env.XRPL_TESTNET_RPC }));

  app.addHook("onClose", async () => {
    await app.events.close();
    await app.xrpl.close();
  });

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  const paymentRepo = createPaymentRepo(app.db);
  const paymentService = createPaymentService({
    payments: paymentRepo,
    xrpl: app.xrpl,
    events: app.events,
    env,
  });

  await registerVerifyRoutes(app);
  await registerAuthRoutes(app, env);
  await registerPaymentRoutes(app, paymentService, env);
  await registerInternalRoutes(app, env);

  registerEventHandlers(app);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "identity",
  }));

  return app;
}
