import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { XrplService } from "../services/xrpl.service.js";

const HOT_ACCOUNTS = [
  "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", // RLUSD
  "rcEGREd8NmkKRE8GE424sksyt1tJVFZwu", // USDC
  "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", // GateHub
  "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", // Bitstamp issuer
  "rNDoUODjMCRWokWisgnoqs5SEnDP3fkjvY", // Sologenic gateway
];

const QUEUE_NAME = "market-data:prewarm";

export type PrewarmOptions = {
  redis: Redis;
  xrplService: XrplService;
  cron: string;
  enabled: boolean;
};

export type PrewarmHandle = {
  stop(): Promise<void>;
};

export async function startPrewarm(opts: PrewarmOptions): Promise<PrewarmHandle> {
  if (!opts.enabled) {
    return { stop: async () => {} };
  }

  const queue = new Queue(QUEUE_NAME, { connection: opts.redis });
  await queue.upsertJobScheduler(
    "prewarm-hot-accounts",
    { pattern: opts.cron },
    { name: "run", data: {} },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      for (const account of HOT_ACCOUNTS) {
        try {
          await opts.xrplService.accountInfo(account);
          await opts.xrplService.accountLines(account);
        } catch {}
      }
      return { count: HOT_ACCOUNTS.length };
    },
    { connection: opts.redis },
  );

  return {
    async stop() {
      await worker.close();
      await queue.close();
    },
  };
}
