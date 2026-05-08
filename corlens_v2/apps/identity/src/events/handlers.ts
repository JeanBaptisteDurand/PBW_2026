import type { FastifyInstance } from "fastify";

export function registerEventHandlers(app: FastifyInstance): void {
  app.events.subscribe("payment.confirmed", async (payload) => {
    app.log.info({ paymentId: payload.paymentId, userId: payload.userId }, "payment.confirmed");
  });
  app.events.subscribe("user.role_upgraded", async (payload) => {
    app.log.info({ userId: payload.userId }, "user.role_upgraded");
  });
}
