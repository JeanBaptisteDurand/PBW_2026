import { Router, type IRouter } from "express";
import crypto from "crypto";
import { prisma } from "../db/client.js";
import { signJwt, verifyJwt, requirePremium } from "../middleware/auth.js";
import { logger } from "../logger.js";

export const authRouter: IRouter = Router();

// POST /api/auth/connect — wallet-as-identity login
authRouter.post("/connect", async (req, res) => {
  try {
    const { walletAddress } = req.body ?? {};
    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ error: "walletAddress is required" });
      return;
    }

    let user = await prisma.user.findUnique({ where: { walletAddress } });
    if (!user) {
      user = await prisma.user.create({ data: { walletAddress } });
      logger.info("[auth] New user created", { walletAddress });
    }

    const token = signJwt({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role as "free" | "premium",
    });

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress, role: user.role } });
  } catch (err: any) {
    logger.error("[auth] Connect failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/refresh — get fresh JWT with current DB role
authRouter.post("/refresh", verifyJwt, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const token = signJwt({
      userId: user.id,
      walletAddress: user.walletAddress,
      role: user.role as "free" | "premium",
    });

    res.json({ token, user: { id: user.id, walletAddress: user.walletAddress, role: user.role } });
  } catch (err: any) {
    logger.error("[auth] Refresh failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/profile — full account data (profile + subscriptions + analyses)
authRouter.get("/profile", verifyJwt, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        subscriptions: { orderBy: { paidAt: "desc" } },
        analyses: {
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            status: true,
            seedAddress: true,
            seedLabel: true,
            depth: true,
            error: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      walletAddress: user.walletAddress,
      role: user.role,
      apiKey: user.apiKey ?? null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      subscriptions: user.subscriptions.map((s) => ({
        id: s.id,
        txHash: s.txHash,
        amount: s.amount,
        currency: s.currency,
        paidAt: s.paidAt,
      })),
      analyses: user.analyses,
    });
  } catch (err: any) {
    logger.error("[auth] Profile fetch failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/api-key — generate or regenerate API key (premium only)
authRouter.post("/api-key", verifyJwt, requirePremium, async (req, res) => {
  try {
    // Return existing key if one already exists (unless ?force=true)
    if (req.query.force !== "true") {
      const existing = await prisma.user.findUnique({ where: { id: req.user!.userId }, select: { apiKey: true } });
      if (existing?.apiKey) {
        res.json({ apiKey: existing.apiKey });
        return;
      }
    }
    const apiKey = `xlens_${crypto.randomBytes(24).toString("hex")}`;
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { apiKey },
    });
    logger.info("[auth] API key generated", { userId: req.user!.userId });
    res.json({ apiKey });
  } catch (err: any) {
    logger.error("[auth] API key generation failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/auth/api-key — revoke API key
authRouter.delete("/api-key", verifyJwt, async (req, res) => {
  try {
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { apiKey: null },
    });
    logger.info("[auth] API key revoked", { userId: req.user!.userId });
    res.json({ ok: true });
  } catch (err: any) {
    logger.error("[auth] API key revocation failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
