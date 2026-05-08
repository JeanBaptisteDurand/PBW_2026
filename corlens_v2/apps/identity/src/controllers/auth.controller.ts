import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { identity } from "@corlens/contracts";
import { createUserRepo } from "../repositories/user.repo.js";
import { createAuthService } from "../services/auth.service.js";
import { RippleKeypairsWalletVerifier } from "../connectors/wallet-verifier.js";
import type { IdentityEnv } from "../env.js";

const ErrorResponse = z.object({ error: z.string() });

export async function registerAuthRoutes(app: FastifyInstance, env: IdentityEnv): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const users = createUserRepo(app.db);
  const verifier = new RippleKeypairsWalletVerifier();
  const auth = createAuthService({
    users,
    verifier,
    jwt: app.jwtService,
    redis: app.redis,
    challengeTtlSeconds: env.CHALLENGE_TTL_SECONDS,
  });

  typed.post("/api/auth/login/challenge", {
    schema: {
      body: identity.LoginChallengeRequest,
      response: { 200: identity.LoginChallengeResponse },
      tags: ["auth"],
    },
  }, async (req) => {
    const result = await auth.issueChallenge(req.body);
    return result;
  });

  typed.post("/api/auth/login/verify", {
    schema: {
      body: identity.LoginVerifyRequest,
      response: { 200: identity.LoginVerifyResponse, 401: ErrorResponse },
      tags: ["auth"],
    },
  }, async (req, reply) => {
    try {
      return await auth.verifyAndLogin(req.body);
    } catch (err) {
      const code = (err as Error).message;
      reply.status(401).send({ error: code });
      return reply;
    }
  });

  typed.post("/api/auth/refresh", {
    schema: {
      response: { 200: identity.LoginVerifyResponse, 401: ErrorResponse, 404: ErrorResponse },
      tags: ["auth"],
    },
  }, async (req, reply) => {
    const a = req.headers.authorization;
    const token = a?.startsWith("Bearer ") ? a.slice(7) : undefined;
    if (!token) {
      reply.status(401).send({ error: "missing_token" });
      return reply;
    }
    let payload;
    try {
      payload = app.jwtService.verify(token);
    } catch {
      reply.status(401).send({ error: "invalid_token" });
      return reply;
    }
    const user = await users.findById(payload.userId);
    if (!user) {
      reply.status(404).send({ error: "user_not_found" });
      return reply;
    }
    const fresh = app.jwtService.sign({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
    });
    return {
      token: fresh,
      user: { id: user.id, walletAddress: user.walletAddress, role: user.role },
    };
  });

  const ProfileResponse = z.object({
    id: z.string().uuid(),
    walletAddress: z.string(),
    role: z.enum(["free", "premium"]),
    apiKey: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    subscriptions: z.array(z.object({
      id: z.string(),
      txHash: z.string(),
      amount: z.string(),
      currency: z.string(),
      paidAt: z.string(),
    })),
  });

  typed.get("/api/auth/profile", {
    schema: { response: { 200: ProfileResponse, 401: ErrorResponse, 404: ErrorResponse }, tags: ["auth"] },
  }, async (req, reply) => {
    const a = req.headers.authorization;
    const token = a?.startsWith("Bearer ") ? a.slice(7) : undefined;
    if (!token) {
      reply.status(401).send({ error: "missing_token" });
      return reply;
    }
    let payload;
    try {
      payload = app.jwtService.verify(token);
    } catch {
      reply.status(401).send({ error: "invalid_token" });
      return reply;
    }
    const profile = await users.listProfile(payload.userId);
    if (!profile) {
      reply.status(404).send({ error: "user_not_found" });
      return reply;
    }
    return {
      id: profile.id,
      walletAddress: profile.walletAddress,
      role: profile.role as "free" | "premium",
      apiKey: profile.apiKey,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
      subscriptions: profile.subscriptions.map((s) => ({
        id: s.id,
        txHash: s.txHash,
        amount: s.amount,
        currency: s.currency,
        paidAt: s.paidAt.toISOString(),
      })),
    };
  });

  typed.post("/api/auth/api-key", {
    schema: {
      response: { 200: z.object({ apiKey: z.string() }), 401: ErrorResponse, 403: ErrorResponse },
      tags: ["auth"],
    },
  }, async (req, reply) => {
    const a = req.headers.authorization;
    const token = a?.startsWith("Bearer ") ? a.slice(7) : undefined;
    if (!token) {
      reply.status(401).send({ error: "missing_token" });
      return reply;
    }
    let payload;
    try {
      payload = app.jwtService.verify(token);
    } catch {
      reply.status(401).send({ error: "invalid_token" });
      return reply;
    }
    if (payload.role !== "premium") {
      reply.status(403).send({ error: "premium_required" });
      return reply;
    }
    const force = (req.query as { force?: string })?.force === "true";
    const existing = await users.findById(payload.userId);
    if (existing?.apiKey && !force) {
      return { apiKey: existing.apiKey };
    }
    const apiKey = `xlens_${randomBytes(24).toString("hex")}`;
    await users.setApiKey(payload.userId, apiKey);
    return { apiKey };
  });

  typed.delete("/api/auth/api-key", {
    schema: {
      response: { 200: z.object({ ok: z.boolean() }), 401: ErrorResponse },
      tags: ["auth"],
    },
  }, async (req, reply) => {
    const a = req.headers.authorization;
    const token = a?.startsWith("Bearer ") ? a.slice(7) : undefined;
    if (!token) {
      reply.status(401).send({ error: "missing_token" });
      return reply;
    }
    let payload;
    try {
      payload = app.jwtService.verify(token);
    } catch {
      reply.status(401).send({ error: "invalid_token" });
      return reply;
    }
    await users.setApiKey(payload.userId, null);
    return { ok: true };
  });
}
