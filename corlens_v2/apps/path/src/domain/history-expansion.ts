// Pure helpers for /history graph expansion: turn a CrawlResult into terminal
// child nodes + type-labelled edges so each crawled hub mirrors the density
// of the analyze page. I/O-free.

import type { path as pp } from "@corlens/contracts";
import type { CrawlResult } from "./types.js";

type HistoryEdgeData = pp.HistoryEdgeData;
type HistoryNode = pp.HistoryNode;

const CAP = 10;
const ORDER_BOOK_CAP = 5;

export function expandCrawlResult(
  crawledAddress: string,
  result: CrawlResult,
  parentDepth: number,
): { nodes: HistoryNode[]; edges: HistoryEdgeData[] } {
  const nodes: HistoryNode[] = [];
  const edges: HistoryEdgeData[] = [];
  const seenNodes = new Set<string>([crawledAddress]);
  const seenEdges = new Set<string>();

  const pushChild = (peer: string, txType: string, count = 1): void => {
    if (!peer || peer === crawledAddress) return;
    if (!seenNodes.has(peer)) {
      seenNodes.add(peer);
      nodes.push({
        id: peer,
        kind: "account_light",
        address: peer,
        depth: parentDepth,
        txCount: count,
        crawlStatus: "skipped",
        parentId: crawledAddress,
      });
    }
    const edgeId = `${crawledAddress}->${peer}:${txType}`;
    if (!seenEdges.has(edgeId)) {
      seenEdges.add(edgeId);
      edges.push({
        id: edgeId,
        from: crawledAddress,
        to: peer,
        txType,
        count,
      });
    }
  };

  const trustLines = Array.isArray(result.trustLines) ? result.trustLines : [];
  const topTrust = [...trustLines]
    .sort(
      (a, b) =>
        Math.abs(Number((b as { balance?: unknown }).balance ?? 0)) -
        Math.abs(Number((a as { balance?: unknown }).balance ?? 0)),
    )
    .slice(0, CAP);
  for (const line of topTrust) {
    const l = line as { account?: string; currency?: unknown };
    if (!l.account) continue;
    const ccy = decodeCurrencyLike(l.currency);
    pushChild(l.account, `Trusts ${ccy}`);
  }

  const lpHolders = Array.isArray(result.lpHolders) ? result.lpHolders : [];
  const topLp = [...lpHolders]
    .sort(
      (a, b) =>
        Math.abs(Number((b as { balance?: unknown }).balance ?? 0)) -
        Math.abs(Number((a as { balance?: unknown }).balance ?? 0)),
    )
    .slice(0, CAP);
  for (const holder of topLp) {
    const h = holder as { account?: string };
    if (h.account) pushChild(h.account, "LP holder");
  }

  const asks = Array.isArray(result.asks) ? result.asks : [];
  const bids = Array.isArray(result.bids) ? result.bids : [];
  for (const offer of asks.slice(0, ORDER_BOOK_CAP)) {
    const o = offer as { Account?: string };
    if (o.Account) pushChild(o.Account, "Offer (ask)");
  }
  for (const offer of bids.slice(0, ORDER_BOOK_CAP)) {
    const o = offer as { Account?: string };
    if (o.Account) pushChild(o.Account, "Offer (bid)");
  }

  return { nodes, edges };
}

// Best-effort decode of an XRPL currency code. 20-byte hex codes get ASCII-
// decoded if printable; otherwise we keep the 3-letter ISO code or fall back
// to a truncated hex label so the edge stays readable.
export function decodeCurrencyLike(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "?";
  if (raw.length <= 3) return raw;
  let out = "";
  for (let i = 0; i < raw.length; i += 2) {
    const code = Number.parseInt(raw.slice(i, i + 2), 16);
    if (code > 0 && code < 128) out += String.fromCharCode(code);
  }
  out = out.replace(/\0+$/, "").trim();
  return out || raw.slice(0, 6);
}
