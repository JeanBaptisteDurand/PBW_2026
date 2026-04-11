// ─── Node Kinds ─────────────────────────────────────────────
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

// ─── Edge Kinds ─────────────────────────────────────────────
export type EdgeKind =
  | "ISSUED_BY"
  | "TRUSTS"
  | "PROVIDES_LIQUIDITY"
  | "TRADES_ON"
  | "ROUTES_THROUGH"
  | "ESCROWS_TO"
  | "GOVERNS"
  | "POOLS_WITH"
  | "CHECKS_TO"
  | "CHANNELS_TO"
  | "OWNS_NFT"
  | "NFT_OFFER_FOR"
  | "SIGNED_BY"
  | "HAS_DID"
  | "HAS_CREDENTIAL"
  | "ISSUED_MPT"
  | "PROVIDES_ORACLE"
  | "PREAUTHORIZES"
  | "HAS_OFFER"
  | "HAS_DOMAIN"
  | "HAS_TICKET"
  | "HAS_BRIDGE"
  | "HAS_VAULT";

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
  | "HIGH_TRANSFER_FEE"
  | "CLAWBACK_ENABLED"
  | "NO_MULTISIG"
  | "ACTIVE_CHECKS"
  | "HIGH_TX_VELOCITY"
  | "DEPOSIT_RESTRICTED"
  | "BLACKHOLED_ACCOUNT"
  | "NO_REGULAR_KEY"
  | "NORIPPLE_MISCONFIGURED"
  | "DEEP_FROZEN_TRUST_LINE"
  | "AMM_CLAWBACK_EXPOSURE"
  | "PERMISSIONED_DOMAIN_DEPENDENCY";

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

export interface EscrowNodeData {
  account: string;
  destination: string;
  amount: string;
  condition?: string;
  cancelAfter?: number;
  finishAfter?: number;
  destinationTag?: number;
  sourceTag?: number;
}

export interface CheckNodeData {
  account: string;
  destination: string;
  sendMax: string;
  currency?: string;
  expiration?: number;
  invoiceID?: string;
  destinationTag?: number;
  sourceTag?: number;
  sequence?: number;
}

export interface PayChannelNodeData {
  account: string;
  destination: string;
  amount: string;
  balance: string;
  settleDelay: number;
  expiration?: number;
  cancelAfter?: number;
  publicKey?: string;
}

export interface NFTNodeData {
  nftId: string;
  issuer: string;
  taxon: number;
  serial?: number;
  uri?: string;
  flags?: number;
  transferFee?: number;
}

export interface SignerListNodeData {
  signerQuorum: number;
  signers: Array<{ account: string; weight: number }>;
}

export interface DIDNodeData {
  account: string;
  didDocument?: string;
  uri?: string;
  data?: string;
}

export interface CredentialNodeData {
  subject: string;
  issuer: string;
  credentialType: string;
  expiration?: number;
  uri?: string;
}

export interface MPTokenNodeData {
  mptIssuanceID: string;
  issuer: string;
  maxSupply?: string;
  outstandingAmount?: string;
  transferFee?: number;
  metadata?: string;
}

export interface OracleNodeData {
  account: string;
  oracleDocumentID: number;
  provider?: string;
  assetClass?: string;
  lastUpdateTime?: number;
  priceDataSeries?: Array<{
    baseAsset: string;
    quoteAsset: string;
    assetPrice?: string;
    scale?: number;
  }>;
}

export interface DepositPreauthNodeData {
  account: string;
  authorize: string;
}

export interface OfferNodeData {
  account: string;
  takerGets: unknown;
  takerPays: unknown;
  sequence?: number;
  expiration?: number;
  flags?: number;
}

export interface PermissionedDomainNodeData {
  account: string;
  domainID: string;
  acceptedCredentials: Array<{ issuer: string; credentialType: string }>;
}

export interface NFTOfferNodeData {
  offerId: string;
  owner: string;
  nftId: string;
  amount: string;
  destination?: string;
  expiration?: number;
  flags?: number;
  isSellOffer: boolean;
}

export interface TicketNodeData {
  account: string;
  ticketSequence: number;
}

export interface BridgeNodeData {
  account: string;
  bridgeAccount?: string;
  bridgeAsset: unknown;
  signatureReward?: string;
  minAccountCreateAmount?: string;
}

export interface VaultNodeData {
  account: string;
  asset: unknown;
  owner?: string;
  data?: string;
}

export type NodeData =
  | TokenNodeData
  | IssuerNodeData
  | AMMPoolNodeData
  | OrderBookNodeData
  | AccountNodeData
  | PaymentPathNodeData
  | EscrowNodeData
  | CheckNodeData
  | PayChannelNodeData
  | NFTNodeData
  | SignerListNodeData
  | DIDNodeData
  | CredentialNodeData
  | MPTokenNodeData
  | OracleNodeData
  | DepositPreauthNodeData
  | OfferNodeData
  | PermissionedDomainNodeData
  | NFTOfferNodeData
  | TicketNodeData
  | BridgeNodeData
  | VaultNodeData;

// ─── Graph Types ────────────────────────────────────────────
// `importance` splits a merged (BFS) graph into the handful of core entities
// the user came to see ("primary") and the long tail of fan-out accounts
// around each crawled hub ("secondary"). The frontend hides secondary by
// default so deep crawls stay readable. `isHub` marks a node that was itself
// the target of a BFS sub-crawl (the seed is always a hub).
export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  data: NodeData;
  riskFlags: RiskFlagData[];
  aiExplanation?: string;
  importance?: "primary" | "secondary";
  isHub?: boolean;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  label?: string;
  data?: Record<string, unknown>;
}

export interface RiskFlagData {
  flag: RiskFlagType;
  severity: RiskSeverity;
  detail: string;
  data?: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
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

// ─── Compliance Report ──────────────────────────────────────
export interface ComplianceReportData {
  title: string;
  generatedAt: string;
  seedAddress: string;
  seedLabel?: string;
  summary: string;
  riskAssessment: {
    overall: RiskSeverity;
    flags: RiskFlagData[];
  };
  entityBreakdown: {
    tokens: number;
    issuers: number;
    pools: number;
    accounts: number;
    orderBooks: number;
    escrows: number;
    paymentPaths: number;
    checks: number;
    payChannels: number;
    nfts: number;
    signerLists: number;
    dids: number;
    credentials: number;
    mpTokens: number;
    oracles: number;
    depositPreauths: number;
    offers: number;
    permissionedDomains: number;
    nftOffers: number;
    tickets: number;
    bridges: number;
    vaults: number;
  };
  concentrationAnalysis?: {
    topHolders: Array<{ address: string; percentage: number }>;
    herfindahlIndex: number;
  };
  gatewayAnalysis?: {
    totalObligations: Record<string, string>;
    gateways: string[];
  };
  recommendations: string[];
}

// ─── RAG / Chat Types ───────────────────────────────────────
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ nodeId: string; kind: string; relevance: number }>;
}

export interface ChatRequest {
  analysisId: string;
  chatId?: string;
  message: string;
}

export interface ChatResponse {
  chatId: string;
  message: ChatMessage;
}

// ─── Corridor Analysis Types ────────────────────────────────
export interface CorridorRequest {
  sourceCurrency: string;
  sourceIssuer?: string;
  destCurrency: string;
  destIssuer: string;
  amount: string;
  sourceAccount?: string;
}

export interface CorridorPathHop {
  account?: string;
  currency?: string;
  issuer?: string;
  type: "gateway" | "orderbook" | "amm" | "xrp_bridge";
  riskFlags: RiskFlagData[];
  riskScore: number;
}

export interface CorridorPath {
  index: number;
  hops: CorridorPathHop[];
  sourceAmount: string;
  cost: number;
  riskScore: number;
  isXrplDefault: boolean;
  isRecommended: boolean;
  reasoning: string;
}

export interface CorridorAnalysis {
  request: CorridorRequest;
  paths: CorridorPath[];
  defaultPathIndex: number;
  recommendedPathIndex: number;
}

// ─── Color Maps ─────────────────────────────────────────────
export const NODE_COLORS: Record<NodeKind, string> = {
  token: "#f59e0b",
  issuer: "#ef4444",
  ammPool: "#3b82f6",
  orderBook: "#8b5cf6",
  account: "#6b7280",
  paymentPath: "#10b981",
  escrow: "#f97316",
  check: "#ec4899",
  payChannel: "#14b8a6",
  nft: "#a855f7",
  signerList: "#64748b",
  did: "#0ea5e9",
  credential: "#22c55e",
  mpToken: "#e11d48",
  oracle: "#eab308",
  depositPreauth: "#06b6d4",
  offer: "#7c3aed",
  permissionedDomain: "#059669",
  nftOffer: "#d946ef",
  ticket: "#78716c",
  bridge: "#0284c7",
  vault: "#b45309",
};

export const EDGE_COLORS: Record<EdgeKind, string> = {
  ISSUED_BY: "#ef4444",
  TRUSTS: "#6b7280",
  PROVIDES_LIQUIDITY: "#3b82f6",
  TRADES_ON: "#8b5cf6",
  ROUTES_THROUGH: "#10b981",
  ESCROWS_TO: "#f97316",
  GOVERNS: "#f59e0b",
  POOLS_WITH: "#06b6d4",
  CHECKS_TO: "#ec4899",
  CHANNELS_TO: "#14b8a6",
  OWNS_NFT: "#a855f7",
  SIGNED_BY: "#64748b",
  HAS_DID: "#0ea5e9",
  HAS_CREDENTIAL: "#22c55e",
  ISSUED_MPT: "#e11d48",
  PROVIDES_ORACLE: "#eab308",
  PREAUTHORIZES: "#06b6d4",
  HAS_OFFER: "#7c3aed",
  HAS_DOMAIN: "#059669",
  NFT_OFFER_FOR: "#d946ef",
  HAS_TICKET: "#78716c",
  HAS_BRIDGE: "#0284c7",
  HAS_VAULT: "#b45309",
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

// ─── Type Guards ────────────────────────────────────────────
export function isTokenNode(node: GraphNode): node is GraphNode & { data: TokenNodeData } {
  return node.kind === "token";
}
export function isIssuerNode(node: GraphNode): node is GraphNode & { data: IssuerNodeData } {
  return node.kind === "issuer";
}
export function isAMMPoolNode(node: GraphNode): node is GraphNode & { data: AMMPoolNodeData } {
  return node.kind === "ammPool";
}
export function isOrderBookNode(node: GraphNode): node is GraphNode & { data: OrderBookNodeData } {
  return node.kind === "orderBook";
}
export function isAccountNode(node: GraphNode): node is GraphNode & { data: AccountNodeData } {
  return node.kind === "account";
}
export function isPaymentPathNode(node: GraphNode): node is GraphNode & { data: PaymentPathNodeData } {
  return node.kind === "paymentPath";
}
export function isEscrowNode(node: GraphNode): node is GraphNode & { data: EscrowNodeData } {
  return node.kind === "escrow";
}
export function isCheckNode(node: GraphNode): node is GraphNode & { data: CheckNodeData } {
  return node.kind === "check";
}
export function isPayChannelNode(node: GraphNode): node is GraphNode & { data: PayChannelNodeData } {
  return node.kind === "payChannel";
}
export function isNFTNode(node: GraphNode): node is GraphNode & { data: NFTNodeData } {
  return node.kind === "nft";
}
export function isSignerListNode(node: GraphNode): node is GraphNode & { data: SignerListNodeData } {
  return node.kind === "signerList";
}
export function isDIDNode(node: GraphNode): node is GraphNode & { data: DIDNodeData } {
  return node.kind === "did";
}
export function isCredentialNode(node: GraphNode): node is GraphNode & { data: CredentialNodeData } {
  return node.kind === "credential";
}
export function isMPTokenNode(node: GraphNode): node is GraphNode & { data: MPTokenNodeData } {
  return node.kind === "mpToken";
}
export function isOracleNode(node: GraphNode): node is GraphNode & { data: OracleNodeData } {
  return node.kind === "oracle";
}
export function isDepositPreauthNode(node: GraphNode): node is GraphNode & { data: DepositPreauthNodeData } {
  return node.kind === "depositPreauth";
}
export function isOfferNode(node: GraphNode): node is GraphNode & { data: OfferNodeData } {
  return node.kind === "offer";
}
export function isPermissionedDomainNode(node: GraphNode): node is GraphNode & { data: PermissionedDomainNodeData } {
  return node.kind === "permissionedDomain";
}
export function isNFTOfferNode(node: GraphNode): node is GraphNode & { data: NFTOfferNodeData } {
  return node.kind === "nftOffer";
}
export function isTicketNode(node: GraphNode): node is GraphNode & { data: TicketNodeData } {
  return node.kind === "ticket";
}
export function isBridgeNode(node: GraphNode): node is GraphNode & { data: BridgeNodeData } {
  return node.kind === "bridge";
}
export function isVaultNode(node: GraphNode): node is GraphNode & { data: VaultNodeData } {
  return node.kind === "vault";
}
