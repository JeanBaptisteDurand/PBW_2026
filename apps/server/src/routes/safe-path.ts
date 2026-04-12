import { Router, type IRouter } from "express";
import { logger } from "../logger.js";
import { prisma } from "../db/client.js";
import { createXRPLClient } from "../xrpl/client.js";
import { runSafePathAgent, type SafePathIntent, type SafePathEvent } from "../ai/safePathAgent.js";
import { verifyJwt, requirePremium } from "../middleware/auth.js";

export const safePathRouter: IRouter = Router();

// POST /api/safe-path — Run the Safe Path Agent end-to-end.
// Accepts simplified input: just srcCcy, dstCcy, amount, maxRiskTolerance.
// The agent resolves issuers, actors, and corridor context internally from
// the catalog. Returns Server-Sent Events so the frontend can stream the
// agent's tool calls, corridor context, partner depth, and reasoning in
// real time. The final `result` event carries the full SafePathResult.
safePathRouter.post("/", verifyJwt, requirePremium, async (req, res) => {
  const body = req.body ?? {};
  const { srcCcy, dstCcy, amount, maxRiskTolerance } = body;

  if (!srcCcy || !dstCcy || !amount) {
    res.status(400).json({
      error: "srcCcy, dstCcy, and amount are required",
    });
    return;
  }

  const intent: SafePathIntent = {
    srcCcy: String(srcCcy).toUpperCase(),
    dstCcy: String(dstCcy).toUpperCase(),
    amount: String(amount),
    maxRiskTolerance,
  };

  // Set up SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (res.socket && typeof (res.socket as any).setNoDelay === "function") {
    (res.socket as any).setNoDelay(true);
  }
  res.flushHeaders();
  res.write(":" + " ".repeat(2048) + "\n\n");

  const sendEvent = (event: SafePathEvent) => {
    try {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      if (typeof (res as any).flush === "function") {
        (res as any).flush();
      }
    } catch (err: any) {
      logger.warn("[safe-path] SSE write failed", { error: err?.message });
    }
  };

  const client = createXRPLClient();
  let disconnected = false;
  let capturedResult: any = null;
  let capturedReport: string | null = null;

  res.on("close", () => {
    disconnected = true;
    logger.info("[safe-path] Client disconnected mid-stream");
  });

  try {
    await client.connect();
    sendEvent({ type: "step", step: "connected", detail: "Connected to XRPL mainnet." });

    await runSafePathAgent(client, intent, (event) => {
      if (!disconnected) sendEvent(event);
      // Capture result and report for DB persistence
      if (event.type === "result") capturedResult = (event as any).result ?? event;
      if (event.type === "report") capturedReport = (event as any).report ?? null;
    });

    // Persist the SafePathRun to DB
    if (capturedResult) {
      try {
        const run = await prisma.safePathRun.create({
          data: {
            userId: req.user?.userId ?? null,
            srcCcy: intent.srcCcy,
            dstCcy: intent.dstCcy,
            amount: intent.amount,
            maxRiskTolerance: intent.maxRiskTolerance ?? "MED",
            verdict: capturedResult.verdict ?? "UNKNOWN",
            reasoning: capturedResult.reasoning ?? "",
            resultJson: capturedResult as any,
            reportMarkdown: capturedReport,
            corridorId: capturedResult.corridor?.id ?? null,
            analysisIds: capturedResult.analysisIds ?? [],
          },
        });
        sendEvent({ type: "step", step: "saved", detail: run.id } as any);
        logger.info("[safe-path] Run saved", { id: run.id });
      } catch (err: any) {
        logger.warn("[safe-path] Failed to save run", { error: err?.message });
      }
    }
  } catch (err: any) {
    logger.error("[safe-path] Agent run failed", { error: err?.message, stack: err?.stack });
    sendEvent({ type: "error", error: err?.message ?? "Agent run failed" });
  } finally {
    try {
      await client.disconnect();
    } catch {
      // ignore
    }
    if (!disconnected) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
});

// GET /api/safe-path/history — list user's SafePath runs
safePathRouter.get("/history", verifyJwt, async (req, res) => {
  try {
    const runs = await prisma.safePathRun.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        srcCcy: true,
        dstCcy: true,
        amount: true,
        verdict: true,
        reasoning: true,
        corridorId: true,
        createdAt: true,
      },
    });
    res.json(runs);
  } catch (err: any) {
    logger.error("[safe-path] History fetch failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/safe-path/:id — get a single SafePath run
safePathRouter.get("/:id", verifyJwt, async (req, res) => {
  try {
    const id = String(req.params.id);
    const run = await prisma.safePathRun.findUnique({
      where: { id },
    });
    if (!run) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(run);
  } catch (err: any) {
    logger.error("[safe-path] Run fetch failed", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
