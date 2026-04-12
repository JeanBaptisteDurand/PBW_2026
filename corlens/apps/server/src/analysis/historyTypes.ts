import type { XRPLAsset } from "@corlens/core";

export type HeavyKind =
  | "amm"
  | "issuer"
  | "multisig_member"
  | "escrow_dest"
  | "check_dest"
  | "channel_dest";

export type NodeKind = "seed" | "account_light" | HeavyKind;
export type CrawlStatus = "pending" | "crawled" | "skipped" | "error";

export interface HistoryNode {
  id: string;
  kind: NodeKind;
  address: string;
  label?: string;
  depth: number;
  txCount: number;
  riskFlags?: string[];
  crawlStatus: CrawlStatus;
  crawledAt?: string;
  // When set, this node is an expansion child of another crawled heavy (e.g.
  // a trustline holder of an issuer) and should be laid out as a satellite
  // around that parent rather than in the main depth column.
  parentId?: string;
}

export interface HistoryEdge {
  id: string;
  from: string;
  to: string;
  txType: string;
  count: number;
  lastLedger?: number;
  lastDate?: string;
}

export interface TxTypeSummary {
  type: string;
  count: number;
  lastLedger?: number;
}

export interface PendingAmmPair {
  asset1: XRPLAsset;
  asset2: XRPLAsset;
  txCount: number;
}

export type HistoryEvent =
  | {
      type: "seed_ready";
      seed: HistoryNode;
      lightNodes: HistoryNode[];
      heavyQueue: HistoryNode[];
      edges: HistoryEdge[];
      txTypeSummary: TxTypeSummary[];
    }
  | { type: "node_added"; node: HistoryNode; edges: HistoryEdge[] }
  | { type: "edges_added"; edges: HistoryEdge[] }
  | { type: "crawl_error"; address: string; error: string }
  | { type: "fatal_error"; error: string }
  | {
      type: "done";
      stats: {
        nodes: number;
        edges: number;
        crawlsRun: number;
        durationMs: number;
        truncated: boolean;
      };
    };
