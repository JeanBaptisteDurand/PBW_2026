// Local type definitions — replaces @corlens/core imports for the v2 domain layer.
// All I/O-free; used only by classifier.ts, risk-engine.ts, graph-builder.ts.

// ─── Risk ────────────────────────────────────────────────────────────────────

export type RiskSeverity = "HIGH" | "MED" | "LOW";

export type RiskFlagData = {
  flag: string;
  severity: RiskSeverity;
  detail: string;
  data?: Record<string, unknown>;
};

// ─── Graph ───────────────────────────────────────────────────────────────────

export type NodeKind =
  | "token"
  | "issuer"
  | "ammPool"
  | "orderBook"
  | "account"
  | "paymentPath"
  | "escrow"
  | "check"
  | "payChannel"
  | "nft"
  | "nftOffer"
  | "signerList"
  | "did"
  | "credential"
  | "mpToken"
  | "oracle"
  | "depositPreauth"
  | "offer"
  | "permissionedDomain"
  | "ticket"
  | "bridge"
  | "vault";

// Optional BFS metadata; depth-1 callers may leave them unset.
export type GraphNode = {
  id: string;
  kind: NodeKind;
  label: string;
  data: Record<string, unknown>;
  riskFlags: RiskFlagData[];
  importance?: "primary" | "secondary";
  isHub?: boolean;
};

// GraphEdge matches v1 GraphEdge exactly
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
  data?: Record<string, unknown>;
};

// GraphStats matches v1 GraphStats exactly (totalNodes/totalEdges, nodesByKind, riskCounts)
export type GraphStats = {
  totalNodes: number;
  totalEdges: number;
  totalRiskFlags: number;
  highRiskCount: number;
  medRiskCount: number;
  lowRiskCount: number;
  nodesByKind: Record<NodeKind, number>;
};

export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
};

// ─── XRPL ────────────────────────────────────────────────────────────────────

export type XRPLAsset = {
  currency: string;
  issuer?: string;
};

// ─── CrawlResult ─────────────────────────────────────────────────────────────
// topAccounts is Map<string, any> matching v1's crawler.ts exactly.

export type CrawlResult = {
  seedAddress?: string;
  seedLabel?: string | null;
  primaryCurrency?: string | null;
  isIssuer?: boolean;
  issuerInfo: any;
  trustLines: any[];
  gatewayBalances: any;
  ammPool: any | null;
  lpHolders: any[];
  asks: any[];
  bids: any[];
  paths: any[];
  accountObjects: any[];
  currencies: any;
  topAccounts: Map<string, any> | any[];
  accountTransactions: any[];
  nfts: any[];
  channels: any[];
  txTypeSummary: any;
  accountOffers: any[];
  noripppleProblems: any[];
  nftOffers: any[];
};

// ─── Permissive node-data type aliases ───────────────────────────────────────
// The graph-builder stores these as `data: Record<string, unknown>` payloads,
// so strict structural typing is not required by consumers.

export type IssuerNodeData = Record<string, unknown>;
export type TokenNodeData = Record<string, unknown>;
export type AMMPoolNodeData = Record<string, unknown>;
export type OrderBookNodeData = Record<string, unknown>;
export type AccountNodeData = Record<string, unknown>;
export type EscrowNodeData = Record<string, unknown>;
export type CheckNodeData = Record<string, unknown>;
export type PayChannelNodeData = Record<string, unknown>;
export type NFTNodeData = Record<string, unknown>;
export type SignerListNodeData = Record<string, unknown>;
export type DIDNodeData = Record<string, unknown>;
export type CredentialNodeData = Record<string, unknown>;
export type MPTokenNodeData = Record<string, unknown>;
export type OracleNodeData = Record<string, unknown>;
export type DepositPreauthNodeData = Record<string, unknown>;
export type OfferNodeData = Record<string, unknown>;
export type PermissionedDomainNodeData = Record<string, unknown>;
export type NFTOfferNodeData = Record<string, unknown>;
export type TicketNodeData = Record<string, unknown>;
export type BridgeNodeData = Record<string, unknown>;
export type VaultNodeData = Record<string, unknown>;
