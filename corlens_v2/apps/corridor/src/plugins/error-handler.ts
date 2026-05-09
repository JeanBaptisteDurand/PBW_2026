import type { FastifyInstance, FastifyError } from "fastify";
import { ZodError } from "zod";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof ZodError) {
      reply.status(400).send({ error: "validation_failed", details: err.issues });
      return;
    }
    const status = err.statusCode ?? 500;
    const code = (err as { code?: string }).code ?? "internal_error";
    if (status >= 500) app.log.error({ err }, "request failed");
    reply.status(status).send({ error: code, message: err.message });
  });
}
