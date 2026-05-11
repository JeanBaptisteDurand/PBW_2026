// Quick risk evaluation service: crawls an address with the light crawler
// and runs the pure computeRiskFlags domain function over the result.

import { path as pp } from "@corlens/contracts";

type RiskQuickEvalResponse = pp.RiskQuickEvalResponse;
import { computeRiskFlags } from "../domain/risk-engine.js";
import type { CrawlResult } from "../domain/types.js";

export interface QuickEvalService {
  evaluate(address: string): Promise<RiskQuickEvalResponse>;
}

const SEVERITY_WEIGHT = { HIGH: 30, MED: 15, LOW: 5 } as const;
const MAX_CACHE = 256;

// Dep interface uses `crawlLight` — the actual method name on HistoryCrawlerService.
export function createQuickEvalService(deps: {
  crawler: { crawlLight(address: string): Promise<CrawlResult> };
  cacheTtlMs?: number;
}): QuickEvalService {
  const ttl = deps.cacheTtlMs ?? 30_000;
  const cache = new Map<string, { expiresAt: number; value: RiskQuickEvalResponse }>();

  function fromCache(address: string): RiskQuickEvalResponse | null {
    const hit = cache.get(address);
    if (!hit) return null;
    if (hit.expiresAt < Date.now()) {
      cache.delete(address);
      return null;
    }
    return hit.value;
  }

  function intoCache(address: string, value: RiskQuickEvalResponse): void {
    if (ttl <= 0) return;
    if (cache.size >= MAX_CACHE) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    cache.set(address, { expiresAt: Date.now() + ttl, value });
  }

  return {
    async evaluate(address) {
      const cached = fromCache(address);
      if (cached) return cached;

      const crawl = await deps.crawler.crawlLight(address);
      const flags = computeRiskFlags(crawl, address);
      const score = Math.min(
        100,
        flags.reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0),
      );

      const obligations = crawl.gatewayBalances?.obligations ?? {};
      const value: RiskQuickEvalResponse = {
        address,
        score,
        flags,
        summary: {
          isIssuer: Object.keys(obligations).length > 0,
          trustLineCount: crawl.trustLines.length,
          hasAmmPool: crawl.ammPool != null,
        },
      };

      intoCache(address, value);
      return value;
    },
  };
}
