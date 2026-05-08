import fp from "fastify-plugin";
import IORedis, { type Redis } from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export interface RedisPluginOptions { url: string; }

export const redisPlugin = fp<RedisPluginOptions>(async (app, opts) => {
  const redis = new IORedis(opts.url, { maxRetriesPerRequest: 3, lazyConnect: false });
  app.decorate("redis", redis);
  app.addHook("onClose", async () => { redis.disconnect(); });
}, { name: "redis" });
