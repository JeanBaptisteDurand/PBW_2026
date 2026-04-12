import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "../config.js";
import { logger } from "../logger.js";

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AnalysisJobData {
  analysisId: string;
  seedAddress: string;
  seedLabel?: string;
  // BFS depth: 1 = single-seed crawl (default, legacy behaviour),
  // 2 = seed + its direct heavies, 3 = two hops. Capped at 3.
  depth?: number;
}

export interface AnalysisJobResult {
  analysisId: string;
  success: boolean;
  error?: string;
}

// ─── Singletons ───────────────────────────────────────────────────────────────

let redisConnection: IORedis | null = null;
let analysisQueue: Queue<AnalysisJobData, AnalysisJobResult> | null = null;

export function getRedisConnection(): IORedis {
  if (!redisConnection) {
    redisConnection = new IORedis(config.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
    redisConnection.on("error", (err) => {
      logger.error("[redis] Connection error", { error: err.message });
    });
    redisConnection.on("connect", () => {
      logger.info("[redis] Connected");
    });
  }
  return redisConnection;
}

export function getAnalysisQueue(): Queue<AnalysisJobData, AnalysisJobResult> {
  if (!analysisQueue) {
    analysisQueue = new Queue<AnalysisJobData, AnalysisJobResult>("analysis", {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          age: 24 * 60 * 60, // 24 hours in seconds
          count: 100,
        },
        removeOnFail: {
          age: 7 * 24 * 60 * 60, // 7 days in seconds
        },
      },
    });
    logger.info("[queue] Analysis queue initialized");
  }
  return analysisQueue;
}

export async function enqueueAnalysis(data: AnalysisJobData): Promise<void> {
  const queue = getAnalysisQueue();
  await queue.add("analysis", data, { jobId: data.analysisId });
  logger.info("[queue] Enqueued analysis job", { analysisId: data.analysisId });
}

export async function closeQueue(): Promise<void> {
  if (analysisQueue) {
    await analysisQueue.close();
    analysisQueue = null;
    logger.info("[queue] Analysis queue closed");
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
    logger.info("[redis] Connection closed");
  }
}
