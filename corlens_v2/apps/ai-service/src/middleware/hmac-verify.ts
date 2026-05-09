import { hmacVerifier } from "@corlens/clients";
import type { FastifyReply, FastifyRequest } from "fastify";

export type HmacVerifyHookOptions = {
  secret: string;
  maxAgeSeconds?: number;
};

export function createHmacVerifyHook(opts: HmacVerifyHookOptions) {
  const verify = hmacVerifier({
    secret: opts.secret,
    maxAgeSeconds: opts.maxAgeSeconds ?? 60,
  });
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const ts = req.headers["x-corlens-ts"];
    const sig = req.headers["x-corlens-sig"];
    const headers: Record<string, string> = {};
    if (typeof ts === "string") headers["x-corlens-ts"] = ts;
    if (typeof sig === "string") headers["x-corlens-sig"] = sig;
    const body = typeof req.body === "string" ? req.body : req.body ? JSON.stringify(req.body) : "";
    if (!verify(body, headers)) {
      reply.code(401).send({ error: "invalid signature" });
    }
  };
}
