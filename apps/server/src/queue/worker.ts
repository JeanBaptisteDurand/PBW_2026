import { Worker, type Job } from "bullmq";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import { createXRPLClient } from "../xrpl/client.js";
import { runBfsAnalysis } from "../analysis/bfsOrchestrator.js";
import { computeRiskFlags } from "../analysis/riskEngine.js";
import { getRedisConnection } from "./index.js";
import type { AnalysisJobData, AnalysisJobResult } from "./index.js";

// ─── Job Processor ────────────────────────────────────────────────────────────

export async function processAnalysisJob(
  jobData: AnalysisJobData,
  updateProgress: (step: string, detail?: string) => void,
): Promise<void> {
  const { analysisId, seedAddress, seedLabel, depth } = jobData;
  const effectiveDepth = Math.max(1, Math.min(3, depth ?? 1));

  // Step 1: Update analysis status to "running"
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { status: "running" },
  });
  logger.info("[worker] Analysis started", { analysisId, seedAddress, depth: effectiveDepth });

  const client = createXRPLClient();

  try {
    // Step 2: Connect XRPL client
    await client.connect();
    logger.info("[worker] XRPL client connected", { analysisId });

    // Step 3 + 4: Run BFS orchestrator
    updateProgress("crawling", `Starting depth-${effectiveDepth} analysis for ${seedAddress}`);
    const bfsResult = await runBfsAnalysis(client, seedAddress, seedLabel, {
      depth: effectiveDepth,
      onProgress: updateProgress,
    });
    const graphData = bfsResult.graph;
    const crawlResult = bfsResult.crawlSummary.seedCrawl;
    logger.info("[worker] BFS analysis complete", {
      analysisId,
      depth: effectiveDepth,
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      hubs: bfsResult.crawlSummary.hubCount,
      truncated: bfsResult.crawlSummary.truncated,
    });

    // Step 5: Compute risk flags
    updateProgress("computing_risks", "Computing risk flags");
    const riskFlags = computeRiskFlags(crawlResult, seedAddress);
    logger.info("[worker] Risk flags computed", { analysisId, count: riskFlags.length });

    // Step 6: Attach risk flags to graph nodes
    const ammPoolNode = graphData.nodes.find((n) => n.kind === "ammPool");
    const orderBookNode = graphData.nodes.find((n) => n.kind === "orderBook");
    const issuerNode = graphData.nodes.find((n) => n.kind === "issuer");

    const ammPoolFlags = ["CONCENTRATED_LIQUIDITY", "THIN_AMM_POOL", "AMM_CLAWBACK_EXPOSURE"];
    const orderBookFlags = ["LOW_DEPTH_ORDERBOOK"];

    for (const flag of riskFlags) {
      if (ammPoolFlags.includes(flag.flag) && ammPoolNode) {
        ammPoolNode.riskFlags.push(flag);
      } else if (orderBookFlags.includes(flag.flag) && orderBookNode) {
        orderBookNode.riskFlags.push(flag);
      } else if (issuerNode) {
        issuerNode.riskFlags.push(flag);
      }
    }

    // Step 7: Persist to DB
    updateProgress("persisting", "Saving results to database");

    await prisma.riskFlag.deleteMany({ where: { analysisId } });
    await prisma.edge.deleteMany({ where: { analysisId } });
    await prisma.node.deleteMany({ where: { analysisId } });

    if (graphData.nodes.length > 0) {
      await prisma.node.createMany({
        data: graphData.nodes.map((node) => {
          const dataWithMeta = {
            ...(node.data as unknown as Record<string, unknown>),
            _meta: {
              importance: node.importance ?? "primary",
              isHub: !!node.isHub,
            },
          };
          return {
            analysisId,
            nodeId: node.id,
            kind: node.kind,
            label: node.label,
            data: dataWithMeta as any,
          };
        }),
        skipDuplicates: true,
      });
    }

    if (graphData.edges.length > 0) {
      await prisma.edge.createMany({
        data: graphData.edges.map((edge) => ({
          analysisId,
          edgeId: edge.id,
          source: edge.source,
          target: edge.target,
          kind: edge.kind,
          label: edge.label,
          data: (edge.data as any) ?? null,
        })),
        skipDuplicates: true,
      });
    }

    if (riskFlags.length > 0) {
      const nodeRows = await prisma.node.findMany({
        where: { analysisId },
        select: { id: true, nodeId: true, kind: true },
      });
      const nodeByKind = new Map<string, string>();
      for (const row of nodeRows) {
        nodeByKind.set(row.kind, row.id);
      }

      const riskFlagRows = riskFlags.map((flag) => {
        let targetNodeId: string;
        if (ammPoolFlags.includes(flag.flag) && nodeByKind.has("ammPool")) {
          targetNodeId = nodeByKind.get("ammPool")!;
        } else if (orderBookFlags.includes(flag.flag) && nodeByKind.has("orderBook")) {
          targetNodeId = nodeByKind.get("orderBook")!;
        } else {
          targetNodeId = nodeByKind.get("issuer") ?? nodeRows[0]?.id ?? analysisId;
        }

        return {
          analysisId,
          nodeId: targetNodeId,
          flag: flag.flag,
          severity: flag.severity,
          detail: flag.detail,
          data: (flag.data as any) ?? null,
        };
      });

      await prisma.riskFlag.createMany({ data: riskFlagRows });
    }

    logger.info("[worker] Data persisted", { analysisId });

    // Step 8: Build summary and update status to "done"
    const highCount = riskFlags.filter((f) => f.severity === "HIGH").length;
    const medCount = riskFlags.filter((f) => f.severity === "MED").length;
    const lowCount = riskFlags.filter((f) => f.severity === "LOW").length;

    const summaryJson = {
      stats: graphData.stats,
      riskSummary: {
        total: riskFlags.length,
        high: highCount,
        medium: medCount,
        low: lowCount,
        flags: riskFlags.map((f) => ({ flag: f.flag, severity: f.severity })),
      },
      crawlSummary: {
        depth: effectiveDepth,
        hubCount: bfsResult.crawlSummary.hubCount,
        hubs: bfsResult.crawlSummary.hubs,
        crawlsRun: bfsResult.crawlSummary.crawlsRun,
        truncated: bfsResult.crawlSummary.truncated,
        trustLineCount: crawlResult.trustLines.length,
        lpHolderCount: crawlResult.lpHolders.length,
        hasAmmPool: !!crawlResult.ammPool,
        askCount: crawlResult.asks.length,
        bidCount: crawlResult.bids.length,
        paymentPathCount: crawlResult.paths.length,
        txTypeCount: crawlResult.txTypeSummary.length,
        accountObjectCount: crawlResult.accountObjects.length,
      },
    };

    await prisma.analysis.update({
      where: { id: analysisId },
      data: { status: "done", summaryJson: summaryJson as any },
    });

    logger.info("[worker] Analysis complete", { analysisId, riskFlags: riskFlags.length });
    updateProgress("done", "Analysis complete");
  } catch (err: any) {
    logger.error("[worker] Analysis failed", { analysisId, error: err?.message });
    const existingNodes = await prisma.node.count({ where: { analysisId } });
    if (existingNodes === 0) {
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: "error", error: err?.message ?? "Unknown error" },
      });
    } else {
      logger.warn("[worker] Retry failed but prior successful data exists — keeping status=done", { analysisId, existingNodes });
    }
    throw err;
  } finally {
    try {
      await client.disconnect();
    } catch (disconnectErr: any) {
      logger.warn("[worker] Failed to disconnect XRPL client", {
        error: disconnectErr?.message,
      });
    }
  }
}

// ─── BullMQ Worker ────────────────────────────────────────────────────────────

let worker: Worker<AnalysisJobData, AnalysisJobResult> | null = null;

export function startWorker(): void {
  if (worker) {
    logger.warn("[worker] Worker already started");
    return;
  }

  worker = new Worker<AnalysisJobData, AnalysisJobResult>(
    "analysis",
    async (job: Job<AnalysisJobData, AnalysisJobResult>) => {
      const updateProgress = (step: string, detail?: string) => {
        job.updateProgress({ step, detail }).catch(() => {});
      };

      await processAnalysisJob(job.data, updateProgress);

      return { analysisId: job.data.analysisId, success: true };
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job) => {
    logger.info("[worker] Job completed", { jobId: job.id, analysisId: job.data.analysisId });
  });

  worker.on("failed", (job, err) => {
    logger.error("[worker] Job failed", {
      jobId: job?.id,
      analysisId: job?.data?.analysisId,
      error: err.message,
    });
  });

  worker.on("error", (err) => {
    logger.error("[worker] Worker error", { error: err.message });
  });

  logger.info("[worker] BullMQ worker started (concurrency: 1)");
}

export async function stopWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("[worker] Worker stopped");
  }
}
