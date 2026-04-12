import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { config } from "../config.js";
import { prisma } from "../db/client.js";

export interface JwtPayload {
  userId: string;
  walletAddress: string;
  role: "free" | "premium";
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice(7);
  if (typeof req.query.token === "string") return req.query.token;
  return null;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: "24h" });
}

export function verifyJwt(req: Request, res: Response, next: NextFunction): void {
  const raw = extractBearerToken(req);
  if (!raw) { res.status(401).json({ error: "Missing token" }); return; }
  try {
    req.user = jwt.verify(raw, config.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

/** Like verifyJwt but does not reject — just attaches user if token is valid */
export function optionalJwt(req: Request, _res: Response, next: NextFunction): void {
  const raw = extractBearerToken(req);
  if (raw) {
    try { req.user = jwt.verify(raw, config.JWT_SECRET) as JwtPayload; } catch {}
  }
  next();
}

export function requirePremium(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) { res.status(401).json({ error: "Missing token" }); return; }
  if (req.user.role !== "premium") { res.status(403).json({ error: "premium_required" }); return; }
  next();
}

/**
 * Authenticate via API key (x-api-key header) OR JWT Bearer token.
 * Does NOT check premium — chain requirePremium separately for that.
 */
export async function verifyApiKeyOrJwt(req: Request, res: Response, next: NextFunction): Promise<void> {
  const apiKey = req.headers["x-api-key"];
  if (apiKey && typeof apiKey === "string") {
    try {
      const user = await prisma.user.findUnique({ where: { apiKey } });
      if (!user) { res.status(401).json({ error: "Invalid API key" }); return; }
      req.user = {
        userId: user.id,
        walletAddress: user.walletAddress,
        role: user.role as "free" | "premium",
      };
      next();
    } catch {
      res.status(500).json({ error: "API key lookup failed" });
    }
    return;
  }
  verifyJwt(req, res, next);
}
