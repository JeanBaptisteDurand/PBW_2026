import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { GraphRepo } from "../repositories/graph.repo.js";
import type { BfsService } from "../services/bfs.service.js";
import type { ExplanationsService } from "../services/explanations.service.js";
import type { RagIndexService } from "../services/rag-index.service.js";

const QUEUE = "path-analysis";

export type AnalysisJobData = { analysisId: string; seedAddress: string; seedLabel: string | null; depth: number };

export type AnalysisQueue = {
  enqueue(data: AnalysisJobData): Promise<void>;
  stop(): Promise<void>;
};

export type WorkerOptions = {
  redisUrl: string;
  enabled: boolean;
  concurrency: number;
  analyses: AnalysisRepo;
  graphs: GraphRepo;
  bfs: BfsService;
  explanations: ExplanationsService;
  ragIndex: RagIndexService;
};

export async function startAnalysisWorker(opts: WorkerOptions): Promise<AnalysisQueue> {
  const conn = new IORedis(opts.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<AnalysisJobData>(QUEUE, { connection: conn });

  let worker: Worker | null = null;
  if (opts.enabled) {
    worker = new Worker<AnalysisJobData>(QUEUE, async (job: Job<AnalysisJobData>) => {
      const { analysisId, seedAddress, seedLabel, depth } = job.data;
      try {
        await opts.analyses.setStatus(analysisId, "running", null);
        const { graph, flags, contractStats, crawlSummary } = await opts.bfs.run({ seedAddress, seedLabel, depth });
        const seedNode = graph.nodes.find((n) => n.id === seedAddress) ?? graph.nodes[0];
        await opts.graphs.persist({
          analysisId,
          nodes: graph.nodes.map((n) => ({ nodeId: n.id, kind: n.kind, label: n.label, data: n.data })),
          edges: graph.edges.map((e) => ({ edgeId: e.id, source: e.source, target: e.target, kind: e.kind, label: e.label ?? null, data: e.data ?? null })),
          riskFlags: flags.map((f) => ({ nodeId: seedNode?.id ?? seedAddress, flag: f.flag, severity: f.severity, detail: f.detail, data: f.data ?? null })),
        });
        try {
          await opts.ragIndex.index({ analysisId, nodes: graph.nodes, flags });
        } catch {}
        try {
          await opts.explanations.generate({ analysisId, nodes: graph.nodes });
        } catch {}
        await opts.analyses.setSummary(analysisId, {
          stats: contractStats,
          seedAddress: crawlSummary.seedAddress,
          isIssuer: crawlSummary.isIssuer,
        });
      } catch (err) {
        await opts.analyses.setStatus(analysisId, "error", (err as Error).message);
        throw err;
      }
    }, { connection: conn, concurrency: opts.concurrency });
  }

  return {
    async enqueue(data) {
      await queue.add("run", data, { attempts: 1 });
    },
    async stop() {
      await worker?.close();
      await queue.close();
      conn.disconnect();
    },
  };
}
