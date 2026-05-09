// Pure hub-picker — selects expansion candidates from a CrawlResult.
// No I/O. No logger. Ported from v1 bfsOrchestrator.pickHubsFromCrawl.

import { type HeavyKind, classifyCounterparties } from "../domain/classifier.js";
import type { CrawlResult } from "../domain/types.js";

export type QueuedHub = {
  address: string;
  kind: HeavyKind | "structural";
  depth: number;
  reason: string;
  rank: number;
};

export function pickHubsFromCrawl(
  crawl: CrawlResult,
  seedAddress: string,
  visited: Set<string>,
  depth: number,
  topK: number,
): QueuedHub[] {
  const candidates = new Map<string, QueuedHub>();

  const push = (
    address: string | undefined,
    kind: HeavyKind | "structural",
    reason: string,
    rank: number,
  ): void => {
    if (!address) return;
    if (address === seedAddress) return;
    if (visited.has(address)) return;
    const prev = candidates.get(address);
    if (!prev || rank < prev.rank) {
      candidates.set(address, { address, kind, depth, reason, rank });
    }
  };

  if (crawl.ammPool?.account) {
    push(crawl.ammPool.account, "amm", "amm_pool", 0);
  }
  const a2 = crawl.ammPool?.amount2;
  if (a2 && typeof a2 === "object" && a2.issuer && a2.issuer !== seedAddress) {
    push(a2.issuer, "issuer", "amm_counter_issuer", 1);
  }
  const a1 = crawl.ammPool?.amount;
  if (a1 && typeof a1 === "object" && a1.issuer && a1.issuer !== seedAddress) {
    push(a1.issuer, "issuer", "amm_counter_issuer", 1);
  }

  try {
    const cls = classifyCounterparties(seedAddress, crawl.accountTransactions ?? []);
    for (const [addr, entry] of cls.heavy) {
      const kindRank = entry.kind === "issuer" ? 2 : entry.kind === "amm" ? 3 : 5;
      const txPenalty = -Math.min(entry.txCount, 50) * 0.01;
      push(addr, entry.kind, `tx_heavy:${entry.kind}`, kindRank + txPenalty);
    }
  } catch {
    // Classifier failures are non-fatal — leave the candidate set unchanged.
  }

  const topTrust = [...(crawl.trustLines ?? [])]
    .sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)))
    .slice(0, 3);
  for (const t of topTrust) {
    push(t.account, "issuer", "top_trustline_holder", 6);
  }

  return Array.from(candidates.values())
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.address < b.address ? -1 : a.address > b.address ? 1 : 0;
    })
    .slice(0, topK);
}
