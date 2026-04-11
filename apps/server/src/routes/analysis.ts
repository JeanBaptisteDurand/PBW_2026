import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { enqueueAnalysis } from "../queue/index.js";
import { logger } from "../logger.js";

export const analysisRouter: IRouter = Router();

const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

// Preset example addresses — results for these are cached in the DB so
// repeated clicks load instantly instead of re-crawling XRPL.
const PRESET_ADDRESSES = new Set([
  "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", // RLUSD Issuer
  "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B",  // Bitstamp
  "rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz",  // Sologenic
  "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3",  // XRP/RLUSD AMM Pool
  "rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh",  // Binance Hot Wallet
  "rP24Lp7bcUHvEW7T7c8xkxtQKKd9fZyra7",  // DIA Oracle
]);

// POST / — Create analysis and enqueue job
analysisRouter.post("/", async (req, res) => {
  try {
    const { seedAddress, seedLabel, depth: depthRaw } = req.body ?? {};

    if (!seedAddress || typeof seedAddress !== "string") {
      res.status(400).json({ error: "seedAddress is required" });
      return;
    }

    if (!XRPL_ADDRESS_REGEX.test(seedAddress)) {
      res.status(400).json({ error: "Invalid XRPL address format" });
      return;
    }

    // depth is optional; clamp to [1,3]. Anything else falls back to 1 (the
    // legacy single-seed crawl).
    let depth = 1;
    if (depthRaw !== undefined) {
      const parsed = Number(depthRaw);
      if (Number.isFinite(parsed)) {
        depth = Math.max(1, Math.min(3, Math.round(parsed)));
      }
    }

    // For preset example addresses, return an existing completed analysis
    // instead of re-crawling. The first run saves the result; subsequent
    // clicks load it instantly.
    if (PRESET_ADDRESSES.has(seedAddress)) {
      const cached = await prisma.analysis.findFirst({
        where: { seedAddress, depth, status: "done" },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      });
      if (cached) {
        logger.info("[route] Returning cached preset analysis", {
          id: cached.id,
          seedAddress,
          depth,
        });
        res.status(200).json({ id: cached.id, status: cached.status });
        return;
      }
    }

    const analysis = await prisma.analysis.create({
      data: {
        seedAddress,
        seedLabel: seedLabel ?? null,
        depth,
        status: "queued",
      },
    });

    await enqueueAnalysis({
      analysisId: analysis.id,
      seedAddress,
      seedLabel,
      depth,
    });

    logger.info("[route] Analysis created and queued", {
      id: analysis.id,
      seedAddress,
      depth,
    });

    res.status(201).json({ id: analysis.id, status: "queued" });
  } catch (err: any) {
    logger.error("[route] Failed to create analysis", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /:id/status — Get analysis status
analysisRouter.get("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const analysis = await prisma.analysis.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        seedAddress: true,
        seedLabel: true,
        error: true,
        summaryJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    res.json(analysis);
  } catch (err: any) {
    logger.error("[route] Failed to get analysis status", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET / — Get last 20 analyses
analysisRouter.get("/", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 200);
    const analyses = await prisma.analysis.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        status: true,
        seedAddress: true,
        seedLabel: true,
        error: true,
        summaryJson: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(analyses);
  } catch (err: any) {
    logger.error("[route] Failed to list analyses", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
