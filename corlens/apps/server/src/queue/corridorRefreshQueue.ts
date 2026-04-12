import { Queue, Worker, type Job } from "bullmq";
import { getRedisConnection } from "./index.js";
import { logger } from "../logger.js";
import { refreshAllCorridors } from "../corridors/refreshService.js";

// ─── Hourly corridor refresh queue ─────────────────────────────────────────
// We run this in the same process as the HTTP server — corridor refresh
// takes ~2-3 minutes but happens at most once an hour, and the existing
// analysis worker already shares the process.

const QUEUE_NAME = "corridor-refresh";
const REPEATABLE_JOB_ID = "corridor-refresh-hourly";
const REPEATABLE_KEY = "corridor-refresh-every-hour";

let queue: Queue | null = null;
let worker: Worker | null = null;

export function getCorridorRefreshQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 24 * 60 * 60, count: 48 },
        removeOnFail: { age: 7 * 24 * 60 * 60 },
      },
    });
    logger.info("[corridor-refresh-queue] initialized");
  }
  return queue;
}

export function startCorridorRefreshWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      logger.info("[corridor-refresh-worker] job start", { id: job.id });
      const force = job.data?.forceAiNote === true;
      const result = await refreshAllCorridors({ forceAiNote: force });
      logger.info("[corridor-refresh-worker] job done", { id: job.id, result });
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error("[corridor-refresh-worker] job failed", {
      id: job?.id,
      error: err.message,
    });
  });

  logger.info("[corridor-refresh-worker] started");
  return worker;
}

export async function stopCorridorRefreshWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (queue) {
    await queue.close();
    queue = null;
  }
}

// ─── Scheduling ────────────────────────────────────────────────────────────

/** Ensure the hourly repeatable job is registered (idempotent). */
export async function ensureHourlyCorridorRefresh(): Promise<void> {
  const q = getCorridorRefreshQueue();
  const existing = await q.getRepeatableJobs();
  if (existing.some((j) => j.key?.includes("corridor-refresh"))) {
    logger.debug("[corridor-refresh-queue] repeatable already scheduled");
    return;
  }
  await q.add(
    REPEATABLE_JOB_ID,
    {},
    {
      repeat: { pattern: "0 * * * *" }, // top of every hour
      jobId: REPEATABLE_KEY,
    },
  );
  logger.info("[corridor-refresh-queue] hourly repeatable registered");
}

/** Enqueue a one-off refresh (used at startup so the cache never starts empty). */
export async function enqueueImmediateRefresh(
  opts: { forceAiNote?: boolean } = {},
): Promise<void> {
  const q = getCorridorRefreshQueue();
  await q.add("corridor-refresh-now", opts, {
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 3600 },
  });
}
