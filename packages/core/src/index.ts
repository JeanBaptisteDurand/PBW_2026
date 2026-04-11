// ─── Node Kinds ─────────────────────────────────────────────
export type NodeKind =
  | "token"
  | "issuer"
  | "ammPool"
  | "orderBook"
  | "account"
  | "paymentPath";

// ─── Edge Kinds ─────────────────────────────────────────────
export type EdgeKind =
  | "ISSUED_BY"
  | "TRUSTS"
  | "PROVIDES_LIQUIDITY"
  | "TRADES_ON"
  | "ROUTES_THROUGH"
  | "GOVERNS"
  | "POOLS_WITH";

// ─── Risk Flags ─────────────────────────────────────────────
export type RiskFlagType =
  | "CONCENTRATED_LIQUIDITY"
  | "SINGLE_GATEWAY_DEPENDENCY"
  | "LOW_DEPTH_ORDERBOOK"
  | "THIN_AMM_POOL"
  | "STALE_OFFER"
  | "UNVERIFIED_ISSUER"
  | "RLUSD_IMPERSONATOR"
  | "FROZEN_TRUST_LINE"
  | "GLOBAL_FREEZE"
  | "HIGH_TRANSFER_FEE";

export type RiskSeverity = "HIGH" | "MED" | "LOW";

// ─── XRPL Asset ─────────────────────────────────────────────
export interface XRPLAsset {
  currency: string;
  issuer?: string;
}

// ─── Node Data Types ────────────────────────────────────────
export interface TokenNodeData {
  currency: string;
  currencyHex?: string;
  issuer: string;
  totalSupply?: string;
  trustLineCount?: number;
  domain?: string;
}

export interface IssuerNodeData {
  address: string;
  domain?: string;
  emailHash?: string;
  messageKey?: string;
  flags?: number;
  tokens: string[];
  totalObligations?: Record<string, string>;
  balance?: string;
  transferRate?: number;
  regularKey?: string;
  ownerCount?: number;
  sequence?: number;
  isBlackholed?: boolean;
}

export interface AMMPoolNodeData {
  account: string;
  asset1: XRPLAsset;
  asset2: XRPLAsset;
  reserve1: string;
  reserve2: string;
  lpTokenBalance: string;
  tradingFee: number;
  tvlUsd?: number;
  lpHolderCount?: number;
  asset2Frozen?: boolean;
  auctionSlot?: {
    account: string;
    discountedFee: number;
    expiration?: number;
    price?: string;
    timeInterval?: number;
    authAccounts?: string[];
  };
  voteSlots?: Array<{
    account: string;
    tradingFee: number;
    voteWeight: number;
  }>;
}

export interface OrderBookNodeData {
  takerGets: XRPLAsset;
  takerPays: XRPLAsset;
  spread?: number;
  bidDepth?: string;
  askDepth?: string;
  offerCount?: number;
}

export interface AccountNodeData {
  address: string;
  balance?: string;
  domain?: string;
  messageKey?: string;
  flags?: number;
  ownerCount?: number;
  sequence?: number;
  regularKey?: string;
  tag?: string;
}

export interface PaymentPathNodeData {
  sourceAccount: string;
  destinationAccount: string;
  sourceCurrency: XRPLAsset;
  destinationCurrency: XRPLAsset;
  paths: Array<
    Array<{ currency?: string; issuer?: string; account?: string }>
  >;
}

export type NodeData =
  | TokenNodeData
  | IssuerNodeData
  | AMMPoolNodeData
  | OrderBookNodeData
  | AccountNodeData
  | PaymentPathNodeData;

// ─── Graph Types ────────────────────────────────────────────
export interface RiskFlagData {
  flag: RiskFlagType;
  severity: RiskSeverity;
  detail: string;
  data?: Record<string, unknown>;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  data: NodeData;
  riskFlags: RiskFlagData[];
  aiExplanation?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  data?: Record<string, unknown>;
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  totalRiskFlags: number;
  highRiskCount: number;
  medRiskCount: number;
  lowRiskCount: number;
  nodesByKind: Record<NodeKind, number>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
}

// ─── Analysis Types ─────────────────────────────────────────
export interface AnalysisRequest {
  seedAddress: string;
  seedLabel?: string;
}

export interface AnalysisStatus {
  id: string;
  status: "queued" | "running" | "done" | "error";
  seedAddress: string;
  seedLabel?: string;
  error?: string;
  progress?: { step: string; detail?: string };
  createdAt: string;
}

// ─── Color Maps ─────────────────────────────────────────────
export const NODE_COLORS: Record<NodeKind, string> = {
  token: "#f59e0b",
  issuer: "#ef4444",
  ammPool: "#3b82f6",
  orderBook: "#8b5cf6",
  account: "#6b7280",
  paymentPath: "#10b981",
};

export const EDGE_COLORS: Record<EdgeKind, string> = {
  ISSUED_BY: "#ef4444",
  TRUSTS: "#6b7280",
  PROVIDES_LIQUIDITY: "#3b82f6",
  TRADES_ON: "#8b5cf6",
  ROUTES_THROUGH: "#10b981",
  GOVERNS: "#f59e0b",
  POOLS_WITH: "#06b6d4",
};

export const RISK_COLORS: Record<RiskSeverity, string> = {
  HIGH: "#ef4444",
  MED: "#f59e0b",
  LOW: "#6b7280",
};

// ─── XRPL Constants ─────────────────────────────────────────
export const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
export const RLUSD_HEX = "524C555344000000000000000000000000000000";
export const XRP_RLUSD_POOL = "rhWTXC2m2gGGA9WozUaoMm6kLAVPb1tcS3";
