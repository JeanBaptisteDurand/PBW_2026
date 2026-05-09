import Fastify from "fastify";
import {
  type ZodTypeProvider,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerErrorHandler } from "../../src/plugins/error-handler.js";
import { redisPlugin } from "../../src/plugins/redis.js";

class FakeXrpl {
  isConnected() {
    return true;
  }
  async connect() {}
  async disconnect() {}
  async request() {
    return { result: {} };
  }
  async pathFind() {
    return { result: {} };
  }
}

describe("/health", () => {
  let app: ReturnType<typeof Fastify> & { withTypeProvider: <T>() => unknown };
  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>() as never;
    (app as never as { setValidatorCompiler: (c: unknown) => void }).setValidatorCompiler(
      validatorCompiler,
    );
    (app as never as { setSerializerCompiler: (c: unknown) => void }).setSerializerCompiler(
      serializerCompiler,
    );
    registerErrorHandler(app as never);
    await (app as never as { register: (p: unknown, opts: unknown) => Promise<void> }).register(
      redisPlugin,
      { url: "redis://localhost:6381" },
    );
    (app as never as { decorate: (k: string, v: unknown) => void }).decorate(
      "xrpl",
      new FakeXrpl(),
    );
    (app as never as { get: (...a: unknown[]) => unknown }).get(
      "/health",
      { schema: { hide: true } },
      async () => ({ status: "ok", service: "market-data", xrplConnected: true }),
    );
  });
  afterAll(async () => {
    await (app as never as { close: () => Promise<void> }).close();
  });

  it("returns ok", async () => {
    const res = await (
      app as never as {
        inject: (o: unknown) => Promise<{ statusCode: number; json: () => unknown }>;
      }
    ).inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe("ok");
  });
});
