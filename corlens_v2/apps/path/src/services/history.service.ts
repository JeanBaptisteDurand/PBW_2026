// Async generator for /history SSE: BFS pool with per-crawl timeout, expansion, abort honor.

import type { path as pp } from "@corlens/contracts";
import type { MarketDataClient } from "../connectors/market-data.js";
import { classifyCounterparties } from "../domain/classifier.js";
import { expandCrawlResult } from "../domain/history-expansion.js";
import type { CrawlResult } from "../domain/types.js";
import type { HistoryCrawlerService } from "./history-crawler.service.js";

type HeavyKind = pp.HeavyKind;
type HistoryEdgeData = pp.HistoryEdgeData;
type HistoryEvent = pp.HistoryEvent;
type HistoryNode = pp.HistoryNode;

// Per-crawl hard timeout so a single slow XRPL RPC call cannot block the
// entire BFS pool forever. Exceeded crawls become crawl_errors and the pool
// moves on.
const DEFAULT_CRAWL_TIMEOUT_MS = 20_000;
const DEFAULT_MAX_CRAWLS = 60;
const DEFAULT_CONCURRENCY = 4;

export type HistoryStreamOptions = {
  depth: number;
  maxTx: number;
  maxCrawls?: number;
  concurrency?: number;
  crawlTimeoutMs?: number;
  signal?: AbortSignal;
};

export type HistoryServiceOptions = {
  marketData: MarketDataClient;
  historyCrawler: HistoryCrawlerService;
};

export type HistoryService = ReturnType<typeof createHistoryService>;

type QueuedCrawl = {
  address: string;
  kind: HeavyKind;
  depth: number;
  txCount: number;
};

export function createHistoryService(deps: HistoryServiceOptions) {
  return {
    async *stream(seed: string, opts: HistoryStreamOptions): AsyncGenerator<HistoryEvent> {
      const startedAt = Date.now();
      const maxCrawls = opts.maxCrawls ?? DEFAULT_MAX_CRAWLS;
      const concurrency = opts.concurrency ?? DEFAULT_CONCURRENCY;
      const crawlTimeoutMs = opts.crawlTimeoutMs ?? DEFAULT_CRAWL_TIMEOUT_MS;
      const signal = opts.signal;

      const nodes = new Map<string, HistoryNode>();
      const edges = new Map<string, HistoryEdgeData>();
      const visited = new Set<string>();
      let crawlsRun = 0;
      let truncated = false;

      const putNode = (n: HistoryNode): void => {
        const prev = nodes.get(n.id);
        if (!prev) nodes.set(n.id, n);
        else nodes.set(n.id, { ...prev, ...n });
      };
      const putEdge = (e: HistoryEdgeData): void => {
        const prev = edges.get(e.id);
        if (!prev) edges.set(e.id, e);
        else edges.set(e.id, { ...prev, count: prev.count + e.count });
      };
      const aborted = (): boolean => signal?.aborted === true;

      // v1 used `sinceUnixTime` to clip txs by close-time. The v2 marketData
      // connector does not expose a unix-time cutoff, so we honor the seed
      // limit (`maxTx`) and let BFS bound the depth instead.
      let seedTxs: unknown[] = [];
      try {
        const txResp = (await deps.marketData.accountTransactions(seed, {
          limit: opts.maxTx,
        })) as { result?: { transactions?: unknown[] } };
        seedTxs = txResp.result?.transactions ?? [];
      } catch (err) {
        yield { type: "fatal_error", error: errMessage(err) || "account_tx failed" };
        return;
      }
      if (aborted()) return;

      const classification = classifyCounterparties(seed, seedTxs);

      const seedNode: HistoryNode = {
        id: seed,
        kind: "seed",
        address: seed,
        depth: 0,
        txCount: seedTxs.length,
        crawlStatus: "skipped",
      };
      putNode(seedNode);
      visited.add(seed);

      const lightNodes: HistoryNode[] = [];
      for (const [addr, entry] of classification.light) {
        const n: HistoryNode = {
          id: addr,
          kind: "account_light",
          address: addr,
          depth: 1,
          txCount: entry.txCount,
          crawlStatus: "skipped",
        };
        putNode(n);
        lightNodes.push(n);
      }

      const queue: QueuedCrawl[] = [];
      for (const [addr, entry] of classification.heavy) {
        queue.push({ address: addr, kind: entry.kind, depth: 1, txCount: entry.txCount });
      }

      const ammResults = await Promise.allSettled(
        classification.pendingAmmPairs.map((pair) =>
          deps.marketData.ammByPair({
            asset1Currency: pair.asset1.currency,
            ...(pair.asset1.currency !== "XRP" && pair.asset1.issuer
              ? { asset1Issuer: pair.asset1.issuer }
              : {}),
            asset2Currency: pair.asset2.currency,
            ...(pair.asset2.currency !== "XRP" && pair.asset2.issuer
              ? { asset2Issuer: pair.asset2.issuer }
              : {}),
          }),
        ),
      );
      for (const [i, r] of ammResults.entries()) {
        if (r.status !== "fulfilled") continue;
        const ammAcct = (r.value as { result?: { amm?: { account?: string } } }).result?.amm
          ?.account;
        const pair = classification.pendingAmmPairs[i];
        if (ammAcct && pair) {
          queue.push({ address: ammAcct, kind: "amm", depth: 1, txCount: pair.txCount });
        }
      }

      if (aborted()) return;

      const heavyPlaceholders: HistoryNode[] = [];
      for (const q of queue) {
        const n: HistoryNode = {
          id: q.address,
          kind: q.kind,
          address: q.address,
          depth: q.depth,
          txCount: q.txCount,
          crawlStatus: "pending",
        };
        putNode(n);
        heavyPlaceholders.push(n);
      }

      for (const e of classification.edges) putEdge(e);

      yield {
        type: "seed_ready",
        seed: seedNode,
        lightNodes,
        heavyQueue: heavyPlaceholders,
        edges: classification.edges,
        txTypeSummary: classification.txTypeSummary,
      };

      for (const q of queue) visited.add(q.address);

      const pending: Array<{ task: QueuedCrawl; promise: Promise<HistoryEvent[]> }> = [];
      let dispatched = 0;

      const runCrawl = async (task: QueuedCrawl): Promise<HistoryEvent[]> => {
        const out: HistoryEvent[] = [];
        try {
          // Race the crawl against a timeout so a slow XRPL node cannot stall
          // the orchestrator. The in-flight RPC continues to completion in
          // the background; we just stop awaiting it.
          let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error(`crawl timeout after ${crawlTimeoutMs}ms`)),
              crawlTimeoutMs,
            );
          });
          const result = (await Promise.race([
            deps.historyCrawler.crawlLight(task.address),
            timeoutPromise,
          ]).finally(() => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          })) as CrawlResult;

          const node: HistoryNode = {
            id: task.address,
            kind: task.kind,
            address: task.address,
            depth: task.depth,
            txCount: task.txCount,
            crawlStatus: "crawled",
            crawledAt: new Date().toISOString(),
          };
          putNode(node);
          // Emit the parent FIRST so incremental SSE consumers see the
          // crawlStatus flip from "pending" to "crawled" before any child
          // node references it via parentId.
          out.push({ type: "node_added", node, edges: [] });

          const expansion = expandCrawlResult(task.address, result, task.depth);
          const expansionNodes: HistoryNode[] = [];
          for (const child of expansion.nodes) {
            if (!nodes.has(child.id)) {
              putNode(child);
              expansionNodes.push(child);
            }
          }
          for (const e of expansion.edges) putEdge(e);
          for (const child of expansionNodes) {
            out.push({ type: "node_added", node: child, edges: [] });
          }
          if (expansion.edges.length) {
            out.push({ type: "edges_added", edges: expansion.edges });
          }

          if (task.depth < opts.depth) {
            const sub = classifyCounterparties(task.address, result.accountTransactions ?? []);
            for (const [addr, entry] of sub.heavy) {
              if (!visited.has(addr)) {
                visited.add(addr);
                const placeholder: HistoryNode = {
                  id: addr,
                  kind: entry.kind,
                  address: addr,
                  depth: task.depth + 1,
                  txCount: entry.txCount,
                  crawlStatus: "pending",
                };
                putNode(placeholder);
                queue.push({
                  address: addr,
                  kind: entry.kind,
                  depth: task.depth + 1,
                  txCount: entry.txCount,
                });
                out.push({ type: "node_added", node: placeholder, edges: [] });
              }
            }
            const subEdges: HistoryEdgeData[] = sub.edges.map((e) => ({
              ...e,
              from: task.address,
              id: `${task.address}->${e.to}:${e.txType}`,
            }));
            for (const e of subEdges) putEdge(e);
            if (subEdges.length) out.push({ type: "edges_added", edges: subEdges });
          }
        } catch (err) {
          const errNode: HistoryNode = {
            id: task.address,
            kind: task.kind,
            address: task.address,
            depth: task.depth,
            txCount: task.txCount,
            crawlStatus: "error",
          };
          putNode(errNode);
          out.push({
            type: "crawl_error",
            address: task.address,
            error: errMessage(err) || "crawl failed",
          });
          out.push({ type: "node_added", node: errNode, edges: [] });
        } finally {
          crawlsRun++;
        }
        return out;
      };

      while ((queue.length > 0 || pending.length > 0) && !aborted()) {
        while (pending.length < concurrency && queue.length > 0 && dispatched < maxCrawls) {
          const task = queue.shift();
          if (!task) break;
          dispatched++;
          pending.push({ task, promise: runCrawl(task) });
        }
        if (pending.length === 0) break;

        if (dispatched >= maxCrawls && queue.length > 0) {
          truncated = true;
          queue.length = 0;
        }

        const finishedIdx = await Promise.race(pending.map((p, i) => p.promise.then(() => i)));
        const removed = pending.splice(finishedIdx, 1);
        const finished = removed[0];
        if (!finished) continue;
        const emitted = await finished.promise;
        for (const ev of emitted) yield ev;
      }

      while (pending.length > 0) {
        const p = pending.shift();
        if (!p) break;
        try {
          const emitted = await p.promise;
          for (const ev of emitted) yield ev;
        } catch {
          // already handled inside runCrawl
        }
      }

      yield {
        type: "done",
        stats: {
          nodes: nodes.size,
          edges: edges.size,
          crawlsRun,
          durationMs: Date.now() - startedAt,
          truncated,
        },
      };
    },
  };
}

function errMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "";
}
