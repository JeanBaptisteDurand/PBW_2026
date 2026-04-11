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
import { startWorker, stopWorker } from "./queue/worker.js";
import { closeQueue } from "./queue/index.js";
import {
  startCorridorRefreshWorker,
  stopCorridorRefreshWorker,
  ensureHourlyCorridorRefresh,
  enqueueImmediateRefresh,
} from "./queue/corridorRefreshQueue.js";
import { seedCorridorCatalog } from "./corridors/refreshService.js";

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
app.use("/api/corridor", corridorRouter);
app.use("/api/corridors", corridorsRouter);

startWorker();
startCorridorRefreshWorker();

const server = app.listen(config.PORT, () => {
  logger.info(`XRPLens server running on port ${config.PORT}`);

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
