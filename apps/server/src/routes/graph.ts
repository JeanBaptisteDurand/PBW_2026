import { Router, type IRouter } from "express";
import { prisma } from "../db/client.js";
import { logger } from "../logger.js";
import type { GraphData, GraphNode, GraphEdge, GraphStats, NodeKind } from "@xrplens/core";

export const graphRouter: IRouter = Router();

// GET /:id/graph — Fetch full graph for an analysis
graphRouter.get("/:id/graph", async (req, res) => {
  try {
    const { id } = req.params;

    // Verify analysis exists
    const analysis = await prisma.analysis.findUnique({ where: { id } });
    if (!analysis) {
      res.status(404).json({ error: "Analysis not found" });
      return;
    }

    // Fetch nodes, edges, riskFlags in parallel
    const [dbNodes, dbEdges, dbRiskFlags] = await Promise.all([
      prisma.node.findMany({ where: { analysisId: id } }),
      prisma.edge.findMany({ where: { analysisId: id } }),
      prisma.riskFlag.findMany({ where: { analysisId: id } }),
    ]);

    // Group risk flags by nodeId (db primary key)
    const flagsByDbNodeId = new Map<string, any[]>();
    for (const flag of dbRiskFlags) {
      const existing = flagsByDbNodeId.get(flag.nodeId) ?? [];
      existing.push({
        flag: flag.flag,
        severity: flag.severity,
        detail: flag.detail,
        data: flag.data ?? undefined,
      });
      flagsByDbNodeId.set(flag.nodeId, existing);
    }

    // Reconstruct GraphNode array. BFS metadata is stored under `data._meta`
    // (see worker.ts persistence block); strip it off and surface as
    // top-level GraphNode fields.
    const nodes: GraphNode[] = dbNodes.map((n) => {
      const rawData = (n.data ?? {}) as Record<string, unknown>;
      const meta = (rawData._meta as { importance?: "primary" | "secondary"; isHub?: boolean } | undefined) ?? undefined;
      // Don't mutate the DB record; clone minus _meta.
      const cleanData = { ...rawData };
      delete (cleanData as Record<string, unknown>)._meta;
      return {
        id: n.nodeId,
        kind: n.kind as NodeKind,
        label: n.label,
        data: cleanData as unknown as GraphNode["data"],
        riskFlags: flagsByDbNodeId.get(n.id) ?? [],
        aiExplanation: n.aiExplanation ?? undefined,
        importance: meta?.importance ?? "primary",
        isHub: !!meta?.isHub,
      };
    });

    // Reconstruct GraphEdge array
    const edges: GraphEdge[] = dbEdges.map((e) => ({
      id: e.edgeId,
      source: e.source,
      target: e.target,
      kind: e.kind as GraphEdge["kind"],
      label: e.label ?? undefined,
      data: (e.data as Record<string, unknown>) ?? undefined,
    }));

    // Build stats (single pass)
    const nodesByKind: Record<NodeKind, number> = {
      token: 0, issuer: 0, ammPool: 0, orderBook: 0,
      account: 0, paymentPath: 0, escrow: 0,
      check: 0, payChannel: 0, nft: 0, nftOffer: 0, signerList: 0,
      did: 0, credential: 0, mpToken: 0, oracle: 0,
      depositPreauth: 0, offer: 0, permissionedDomain: 0,
      ticket: 0, bridge: 0, vault: 0,
    };
    let totalRiskFlags = 0, highRiskCount = 0, medRiskCount = 0, lowRiskCount = 0;
    for (const node of nodes) {
      nodesByKind[node.kind]++;
      for (const f of node.riskFlags) {
        totalRiskFlags++;
        if (f.severity === "HIGH") highRiskCount++;
        else if (f.severity === "MED") medRiskCount++;
        else lowRiskCount++;
      }
    }

    const stats: GraphStats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      totalRiskFlags,
      highRiskCount,
      medRiskCount,
      lowRiskCount,
      nodesByKind,
    };

    const graphData: GraphData = { nodes, edges, stats };
    res.json(graphData);
  } catch (err: any) {
    logger.error("[route] Failed to get graph", { error: err?.message });
    res.status(500).json({ error: "Internal server error" });
  }
});
