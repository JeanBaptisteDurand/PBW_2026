// corlens/apps/web/src/lib/historyTypes.ts
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
