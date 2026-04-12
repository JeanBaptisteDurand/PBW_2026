import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./db/client.js";
import { analysisRouter } from "./routes/analysis.js";
import { graphRouter } from "./routes/graph.js";
import { complianceRouter } from "./routes/compliance.js";
import { chatRouter } from "./routes/chat.js";
import { corridorRouter } from "./routes/corridor.js";
import { corridorsRouter } from "./routes/corridors.js";
import { safePathRouter } from "./routes/safe-path.js";
import { permissionedDomainSeedRouter } from "./routes/permissioned-domain-seed.js";
import { historyRouter } from "./routes/history.js";
import { authRouter } from "./routes/auth.js";
import { paymentRouter } from "./routes/payment.js";
import { startWorker, stopWorker } from "./queue/worker.js";
import { closeQueue, enqueueAnalysis } from "./queue/index.js";
import {
  startCorridorRefreshWorker,
  stopCorridorRefreshWorker,
  ensureHourlyCorridorRefresh,
  enqueueImmediateRefresh,
} from "./queue/corridorRefreshQueue.js";
import { seedCorridorCatalog } from "./corridors/refreshService.js";

const RLUSD_SEED_ADDRESS = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const RLUSD_SEED_LABEL = "RLUSD";

async function seedRLUSDIfMissing(): Promise<void> {
  try {
    const existing = await prisma.analysis.findFirst({
      where: { seedAddress: RLUSD_SEED_ADDRESS, status: "done" },
    });

    if (existing) {
      logger.info("[seed] RLUSD analysis already exists", { id: existing.id });
      return;
    }

    const inProgress = await prisma.analysis.findFirst({
      where: {
        seedAddress: RLUSD_SEED_ADDRESS,
        status: { in: ["queued", "running"] },
      },
    });

    if (inProgress) {
      logger.info("[seed] RLUSD analysis already in progress", { id: inProgress.id });
      return;
    }

    const analysis = await prisma.analysis.create({
      data: {
        seedAddress: RLUSD_SEED_ADDRESS,
        seedLabel: RLUSD_SEED_LABEL,
        status: "queued",
      },
    });

    await enqueueAnalysis({
      analysisId: analysis.id,
      seedAddress: RLUSD_SEED_ADDRESS,
      seedLabel: RLUSD_SEED_LABEL,
    });

    logger.info("[seed] RLUSD analysis auto-seeded", { id: analysis.id });
  } catch (err: any) {
    logger.warn("[seed] Failed to auto-seed RLUSD analysis", { error: err?.message });
  }
}

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: "error", error: "Database connection failed" });
  }
});

app.use("/api/analyze", analysisRouter);
app.use("/api/analysis", graphRouter);
app.use("/api/compliance", complianceRouter);
app.use("/api/chat", chatRouter);
app.use("/api/corridor", corridorRouter); // legacy single-analysis endpoint (kept for safe-path compat)
app.use("/api/corridors", corridorsRouter); // catalog + cache + chat
app.use("/api/safe-path", safePathRouter);
app.use("/api/permissioned-domain", permissionedDomainSeedRouter);
app.use("/api/history", historyRouter);
app.use("/api/auth", authRouter);
app.use("/api/payment", paymentRouter);

startWorker();
startCorridorRefreshWorker();

const server = app.listen(config.PORT, () => {
  logger.info(`CorLens server running on port ${config.PORT}`);
  setTimeout(() => {
    seedRLUSDIfMissing().catch(() => {});
  }, 3000);

  // Corridor catalog + hourly scheduling. Seed the catalog rows first so
  // the API can serve static metadata immediately even before the first
  // refresh completes. Then register the hourly repeatable job and kick
  // off an immediate refresh so the cache is populated on boot.
  (async () => {
    try {
      await seedCorridorCatalog();
      await ensureHourlyCorridorRefresh();
      await enqueueImmediateRefresh();
      logger.info("[corridors] bootstrap complete");
    } catch (err: any) {
      logger.warn("[corridors] bootstrap failed", { error: err?.message });
    }
  })();
});

const shutdown = async () => {
  logger.info("Shutting down...");
  server.close();
  await stopWorker();
  await stopCorridorRefreshWorker();
  await closeQueue();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
