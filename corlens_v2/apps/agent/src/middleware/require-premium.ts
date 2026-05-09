import { hmacSigner } from "@corlens/clients";
import type { FastifyReply, FastifyRequest } from "fastify";

export type RequirePremiumOptions = {
  identityBaseUrl: string;
  hmacSecret: string;
  fetch?: typeof fetch;
};

export function createRequirePremiumPreHandler(opts: RequirePremiumOptions) {
  const f = opts.fetch ?? fetch;
  const sign = hmacSigner({ secret: opts.hmacSecret });
  const baseUrl = opts.identityBaseUrl.replace(/\/$/, "");
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || userId.length === 0) {
      reply.code(401).send({ error: "missing_user" });
      return reply;
    }
    const url = `${baseUrl}/internal/premium-status?userId=${encodeURIComponent(userId)}`;
    const headers = sign("");
    let res: Response;
    try {
      res = await f(url, { headers });
    } catch {
      reply.code(502).send({ error: "premium_check_failed" });
      return reply;
    }
    if (res.status === 404) {
      reply.code(401).send({ error: "user_not_found" });
      return reply;
    }
    if (!res.ok) {
      reply.code(502).send({ error: "premium_check_failed" });
      return reply;
    }
    const body = (await res.json()) as { isPremium: boolean };
    if (!body.isPremium) {
      reply.code(402).send({ error: "premium_required" });
      return reply;
    }
  };
}
