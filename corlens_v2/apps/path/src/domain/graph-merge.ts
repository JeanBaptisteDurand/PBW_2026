// Pure graph merge helpers for BFS expansion. No I/O, no logging.

import type { GraphData, GraphEdge, GraphNode } from "./types.js";

export function reparentSubGraph(
  sub: GraphData,
  hubAddress: string,
  merged: Map<string, GraphNode>,
  mergedEdges: Map<string, GraphEdge>,
  isRealIssuer: boolean,
): { anchorId: string } {
  const subIssuerId = `issuer:${hubAddress}`;
  const ammId = `ammPool:${hubAddress}`;
  const acctId = `account:${hubAddress}`;
  let anchorId: string;
  if (merged.has(ammId)) {
    anchorId = ammId;
  } else if (isRealIssuer) {
    anchorId = subIssuerId;
  } else if (merged.has(acctId)) {
    anchorId = acctId;
  } else {
    anchorId = acctId;
    merged.set(acctId, {
      id: acctId,
      kind: "account",
      label: hubAddress.slice(0, 8),
      data: { address: hubAddress },
      riskFlags: [],
      isHub: true,
    });
  }

  const subNodes = isRealIssuer ? sub.nodes : sub.nodes.filter((n) => n.id !== subIssuerId);

  for (const n of subNodes) {
    const existing = merged.get(n.id);
    if (!existing) {
      merged.set(n.id, n);
    } else if (n.riskFlags?.length) {
      const seen = new Set(existing.riskFlags.map((f) => f.flag));
      for (const f of n.riskFlags) {
        if (!seen.has(f.flag)) existing.riskFlags.push(f);
      }
    }
  }

  for (const e of sub.edges) {
    const src = e.source === subIssuerId && !isRealIssuer ? anchorId : e.source;
    const tgt = e.target === subIssuerId && !isRealIssuer ? anchorId : e.target;
    if (src === tgt) continue;
    if (!merged.has(src) || !merged.has(tgt)) continue;
    const id = src === e.source && tgt === e.target ? e.id : `${src}--${e.kind}--${tgt}`;
    if (!mergedEdges.has(id)) {
      mergedEdges.set(id, { ...e, id, source: src, target: tgt });
    }
  }

  const anchor = merged.get(anchorId);
  if (anchor) anchor.isHub = true;

  return { anchorId };
}

export function enforceMaxNodes(
  merged: Map<string, GraphNode>,
  mergedEdges: Map<string, GraphEdge>,
  seedAnchorId: string,
  maxNodes: number,
): { dropped: number } {
  if (merged.size <= maxNodes) return { dropped: 0 };

  const adj = new Map<string, Set<string>>();
  for (const e of mergedEdges.values()) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }
  const dist = new Map<string, number>();
  const queue: string[] = [seedAnchorId];
  dist.set(seedAnchorId, 0);
  while (queue.length) {
    const cur = queue.shift();
    if (cur === undefined) break;
    const d = dist.get(cur) ?? 0;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }

  const droppable = Array.from(merged.values())
    .filter((n) => n.importance === "secondary")
    .sort(
      (a, b) =>
        (dist.get(b.id) ?? Number.POSITIVE_INFINITY) - (dist.get(a.id) ?? Number.POSITIVE_INFINITY),
    );

  let dropped = 0;
  for (const n of droppable) {
    if (merged.size <= maxNodes) break;
    merged.delete(n.id);
    dropped++;
  }
  for (const [id, e] of mergedEdges) {
    if (!merged.has(e.source) || !merged.has(e.target)) {
      mergedEdges.delete(id);
    }
  }
  return { dropped };
}
