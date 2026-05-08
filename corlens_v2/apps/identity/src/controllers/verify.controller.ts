import type { FastifyInstance } from "fastify";

export async function registerVerifyRoutes(app: FastifyInstance): Promise<void> {
  app.get("/verify", { schema: { hide: true } }, async (req, reply) => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      reply.status(401).send({ error: "missing_token" });
      return;
    }
    try {
      const payload = app.jwtService.verify(token);
      reply.header("x-user-id", payload.userId);
      reply.header("x-user-wallet", payload.walletAddress);
      reply.header("x-user-role", payload.role);
      reply.status(200).send({ ok: true });
    } catch {
      reply.status(401).send({ error: "invalid_token" });
    }
  });
}
