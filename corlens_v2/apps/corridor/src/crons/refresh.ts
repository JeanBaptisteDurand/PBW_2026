import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { CorridorRepo } from "../repositories/corridor.repo.js";
import type { StatusEventRepo } from "../repositories/status-event.repo.js";
import type { ScannerService } from "../services/scanner.service.js";

const QUEUE = "corridor-refresh";

export type RefreshOptions = {
  redisUrl: string;
  cron: string;
  enabled: boolean;
  concurrency: number;
  corridors: CorridorRepo;
  events: StatusEventRepo;
  scanner: ScannerService;
};

export type RefreshHandle = { stop(): Promise<void> };

export async function startRefreshCron(opts: RefreshOptions): Promise<RefreshHandle> {
  if (!opts.enabled) return { stop: async () => {} };
  const conn = new IORedis(opts.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(QUEUE, { connection: conn });
  await queue.upsertJobScheduler("refresh-all", { pattern: opts.cron }, { name: "run", data: {} });
  const worker = new Worker<{ ids?: string[] }>(QUEUE, async (_job: Job) => {
    const all = await opts.corridors.list({ limit: 5000, offset: 0 });
    let scanned = 0;
    for (const c of all) {
      try {
        const result = await opts.scanner.scan({
          id: c.id, source: c.sourceJson as never, dest: c.destJson as never, amount: c.amount,
        });
        await opts.corridors.updateScan(c.id, {
          status: result.status, pathCount: result.pathCount,
          recRiskScore: result.recRiskScore, recCost: result.recCost,
          flagsJson: result.flagsJson, routesJson: result.routesJson, liquidityJson: result.liquidityJson,
        });
        await opts.events.append({
          corridorId: c.id, status: result.status, pathCount: result.pathCount, recCost: result.recCost, source: "scan",
        });
        scanned += 1;
      } catch {}
    }
    return { scanned };
  }, { connection: conn, concurrency: opts.concurrency });
  return { async stop() { await worker.close(); await queue.close(); conn.disconnect(); } };
}
