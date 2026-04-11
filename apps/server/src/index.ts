import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { logger } from "./logger.js";
import { prisma } from "./db/client.js";

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

const server = app.listen(config.PORT, () => {
  logger.info(`XRPLens server running on port ${config.PORT}`);
});

const shutdown = async () => {
  logger.info("Shutting down...");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
