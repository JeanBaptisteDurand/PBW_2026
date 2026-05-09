import { describe, expect, it } from "vitest";
import { enforceMaxNodes, reparentSubGraph } from "../../src/domain/graph-merge.js";
import type { GraphData, GraphEdge, GraphNode } from "../../src/domain/types.js";

function node(
  id: string,
  kind: GraphNode["kind"],
  importance?: GraphNode["importance"],
): GraphNode {
  return {
    id,
    kind,
    label: id,
    data: {},
    riskFlags: [],
    ...(importance ? { importance } : {}),
  };
}

function edge(source: string, target: string, kind = "TRUSTS"): GraphEdge {
  return { id: `${source}--${kind}--${target}`, source, target, kind };
}

describe("enforceMaxNodes", () => {
  it("preserves primaries, drops farthest secondaries first, prunes dangling edges", () => {
    const merged = new Map<string, GraphNode>();
    const mergedEdges = new Map<string, GraphEdge>();

    // Anchor + 3 primaries + 6 secondaries — 10 total. anchor at depth 0.
    merged.set("issuer:rSeed", node("issuer:rSeed", "issuer", "primary"));
    merged.set("token:USD:rSeed", node("token:USD:rSeed", "token", "primary"));
    merged.set("ammPool:rPool", node("ammPool:rPool", "ammPool", "primary"));
    merged.set("orderBook:XRP/USD", node("orderBook:XRP/USD", "orderBook", "primary"));

    // Secondaries at varying graph distances from the seed anchor.
    merged.set("account:rNear1", node("account:rNear1", "account", "secondary"));
    merged.set("account:rNear2", node("account:rNear2", "account", "secondary"));
    merged.set("account:rMid", node("account:rMid", "account", "secondary"));
    merged.set("account:rFar1", node("account:rFar1", "account", "secondary"));
    merged.set("account:rFar2", node("account:rFar2", "account", "secondary"));
    merged.set("account:rOrphan", node("account:rOrphan", "account", "secondary")); // no edges → infinite distance

    for (const e of [
      edge("issuer:rSeed", "token:USD:rSeed", "ISSUED_BY"),
      edge("ammPool:rPool", "token:USD:rSeed", "POOLS_WITH"),
      edge("orderBook:XRP/USD", "token:USD:rSeed", "TRADES_ON"),
      edge("account:rNear1", "token:USD:rSeed", "TRUSTS"),
      edge("account:rNear2", "token:USD:rSeed", "TRUSTS"),
      edge("account:rMid", "account:rNear1", "FOLLOWS"),
      edge("account:rFar1", "account:rMid", "FOLLOWS"),
      edge("account:rFar2", "account:rFar1", "FOLLOWS"),
    ]) {
      mergedEdges.set(e.id, e);
    }

    const primaryIds = new Set(
      Array.from(merged.values())
        .filter((n) => n.importance === "primary")
        .map((n) => n.id),
    );

    const { dropped } = enforceMaxNodes(merged, mergedEdges, "issuer:rSeed", 5);

    expect(merged.size).toBeLessThanOrEqual(5);
    expect(dropped).toBe(5);
    // Every primary survives the trim.
    for (const id of primaryIds) expect(merged.has(id)).toBe(true);
    // The orphan (unreachable, distance = +Infinity) goes first.
    expect(merged.has("account:rOrphan")).toBe(false);
    // The two farthest reachable secondaries also dropped before the nearer ones.
    expect(merged.has("account:rFar2")).toBe(false);
    expect(merged.has("account:rFar1")).toBe(false);
    // Edges referencing dropped endpoints are pruned.
    for (const e of mergedEdges.values()) {
      expect(merged.has(e.source)).toBe(true);
      expect(merged.has(e.target)).toBe(true);
    }
  });

  it("is a no-op when the graph is already under the cap", () => {
    const merged = new Map<string, GraphNode>([
      ["issuer:rSeed", node("issuer:rSeed", "issuer", "primary")],
      ["account:rA", node("account:rA", "account", "secondary")],
    ]);
    const mergedEdges = new Map<string, GraphEdge>();
    const { dropped } = enforceMaxNodes(merged, mergedEdges, "issuer:rSeed", 100);
    expect(dropped).toBe(0);
    expect(merged.size).toBe(2);
  });
});

describe("reparentSubGraph", () => {
  function emptyStats(): GraphData["stats"] {
    return {
      totalNodes: 0,
      totalEdges: 0,
      totalRiskFlags: 0,
      highRiskCount: 0,
      medRiskCount: 0,
      lowRiskCount: 0,
      nodesByKind: {
        token: 0,
        issuer: 0,
        ammPool: 0,
        orderBook: 0,
        account: 0,
        paymentPath: 0,
        escrow: 0,
        check: 0,
        payChannel: 0,
        nft: 0,
        nftOffer: 0,
        signerList: 0,
        did: 0,
        credential: 0,
        mpToken: 0,
        oracle: 0,
        depositPreauth: 0,
        offer: 0,
        permissionedDomain: 0,
        ticket: 0,
        bridge: 0,
        vault: 0,
      },
    };
  }

  it("anchors on ammPool when both ammPool and account exist for the hub", () => {
    const hub = "rHubX";
    const merged = new Map<string, GraphNode>([
      [`ammPool:${hub}`, node(`ammPool:${hub}`, "ammPool", "primary")],
      [`account:${hub}`, node(`account:${hub}`, "account", "secondary")],
    ]);
    const mergedEdges = new Map<string, GraphEdge>();
    const sub: GraphData = {
      nodes: [
        node(`issuer:${hub}`, "issuer", "primary"),
        node("token:USD:rHubX", "token", "primary"),
      ],
      edges: [edge("token:USD:rHubX", `issuer:${hub}`, "ISSUED_BY")],
      stats: emptyStats(),
    };

    const { anchorId } = reparentSubGraph(sub, hub, merged, mergedEdges, false);

    expect(anchorId).toBe(`ammPool:${hub}`);
    expect(merged.get(`ammPool:${hub}`)?.isHub).toBe(true);
  });

  it("preserves issuer:<hub> as anchor when the hub is a real issuer", () => {
    const hub = "rRealIssuer";
    const merged = new Map<string, GraphNode>();
    const mergedEdges = new Map<string, GraphEdge>();
    const issuerNode = node(`issuer:${hub}`, "issuer", "primary");
    const tokenNode = node("token:USD:rRealIssuer", "token", "primary");
    const sub: GraphData = {
      nodes: [issuerNode, tokenNode],
      edges: [edge(tokenNode.id, issuerNode.id, "ISSUED_BY")],
      stats: emptyStats(),
    };

    const { anchorId } = reparentSubGraph(sub, hub, merged, mergedEdges, true);

    expect(anchorId).toBe(`issuer:${hub}`);
    expect(merged.has(`issuer:${hub}`)).toBe(true);
    expect(merged.get(`issuer:${hub}`)?.isHub).toBe(true);
    // Edges keep their original ids when no rewrite happened.
    expect(mergedEdges.has(`token:USD:rRealIssuer--ISSUED_BY--issuer:${hub}`)).toBe(true);
  });

  it("drops fake issuer root and rewrites edges to the synthesized account anchor", () => {
    const hub = "rFakeIssuer";
    const merged = new Map<string, GraphNode>();
    const mergedEdges = new Map<string, GraphEdge>();
    const sub: GraphData = {
      nodes: [
        node(`issuer:${hub}`, "issuer", "primary"),
        node("token:USD:rFakeIssuer", "token", "primary"),
      ],
      edges: [edge("token:USD:rFakeIssuer", `issuer:${hub}`, "ISSUED_BY")],
      stats: emptyStats(),
    };

    const { anchorId } = reparentSubGraph(sub, hub, merged, mergedEdges, false);

    expect(anchorId).toBe(`account:${hub}`);
    expect(merged.has(`issuer:${hub}`)).toBe(false);
    expect(merged.has(`account:${hub}`)).toBe(true);
    expect(merged.get(`account:${hub}`)?.isHub).toBe(true);
    // The token→issuer edge was rewritten to point at account:<hub>.
    const rewrittenId = `token:USD:rFakeIssuer--ISSUED_BY--account:${hub}`;
    expect(mergedEdges.has(rewrittenId)).toBe(true);
  });

  it("drops self-loops introduced by edge rewrites", () => {
    const hub = "rLoop";
    const merged = new Map<string, GraphNode>();
    const mergedEdges = new Map<string, GraphEdge>();
    const sub: GraphData = {
      nodes: [node(`issuer:${hub}`, "issuer", "primary")],
      // Edge issuer→issuer would self-loop on rewrite to anchor.
      edges: [edge(`issuer:${hub}`, `issuer:${hub}`, "SELF")],
      stats: emptyStats(),
    };

    reparentSubGraph(sub, hub, merged, mergedEdges, false);

    for (const e of mergedEdges.values()) {
      expect(e.source).not.toBe(e.target);
    }
  });

  it("merges new risk flags into an existing node without duplicating by flag id", () => {
    const hub = "rRisk";
    const existing = node("token:USD:rRisk", "token", "primary");
    existing.riskFlags = [{ flag: "F1", severity: "MED", detail: "old" }];
    const merged = new Map<string, GraphNode>([[existing.id, existing]]);
    const mergedEdges = new Map<string, GraphEdge>();

    const incoming = node("token:USD:rRisk", "token", "primary");
    incoming.riskFlags = [
      { flag: "F1", severity: "HIGH", detail: "duplicate flag id — should be skipped" },
      { flag: "F2", severity: "LOW", detail: "new" },
    ];
    const sub: GraphData = {
      nodes: [node(`issuer:${hub}`, "issuer", "primary"), incoming],
      edges: [],
      stats: emptyStats(),
    };

    reparentSubGraph(sub, hub, merged, mergedEdges, false);

    const flags = merged.get("token:USD:rRisk")?.riskFlags ?? [];
    const flagIds = flags.map((f) => f.flag).sort();
    expect(flagIds).toEqual(["F1", "F2"]);
    // Original F1 entry stays — duplicate not overwritten.
    expect(flags.find((f) => f.flag === "F1")?.detail).toBe("old");
  });
});
