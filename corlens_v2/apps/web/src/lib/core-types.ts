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
  paths: Array<Array<{ currency?: string; issuer?: string; account?: string }>>;
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

// ─── Expanded corridor catalog types ────────────────────────
// These power the Corridor atlas page: a large static catalog
// (seeded into the DB) of institutional lanes scanned hourly
// against mainnet and enriched with AI commentary.

export type CorridorRegion =
  | "global"
  | "europe"
  | "asia"
  | "latam"
  | "africa"
  | "middle_east"
  | "oceania"
  | "cross";

// Categories mark how a corridor should be presented:
//  - fiat-fiat:        canonical FX lane (USD→EUR) with on-chain XRPL issuers
//  - stable-onramp:    USD/EUR → RLUSD/USDC (mint into stablecoin)
//  - stable-offramp:   RLUSD/USDC → USD/EUR (back to fiat)
//  - xrp-offramp:      XRP → fiat (validator payouts, ODL destination)
//  - crypto-spot:      USD → BTC/SOLO
//  - special:          deep direct stablecoin↔fiat books (RLUSD↔CNY)
//  - off-chain-bridge: fiat↔fiat lane with no on-chain IOU issuers; the XRPL
//                      hop is RLUSD (or XRP) held by off-chain CEX/remittance
//                      partners. No XRPL pathfind is performed; the corridor
//                      is populated from the off-chain actor registry.
export type CorridorCategory =
  | "fiat-fiat"
  | "stable-onramp"
  | "stable-offramp"
  | "xrp-offramp"
  | "crypto-spot"
  | "special"
  | "off-chain-bridge";

export type CorridorStatus = "GREEN" | "AMBER" | "RED" | "UNKNOWN";

export type CorridorAssetType = "fiat" | "stable" | "xrp" | "crypto";

export interface CorridorAsset {
  symbol: string;
  type: CorridorAssetType;
  flag: string; // emoji
  label?: string; // optional pretty name
}

export interface CorridorLiquiditySnapshot {
  xrpLeg?: { toIouOffers: number; toXrpOffers: number };
  directBook?: { fwdOffers: number; revOffers: number };
  amm?: { xrpReserve?: string; iouReserve?: string; tvlUsd?: number | null };
  issuerObligation?: string;
  notes?: string[];
}

// One candidate route inside a corridor (a specific issuer pair)
export interface CorridorRouteCandidate {
  routeId: string; // unique within the parent corridor (e.g. "bs-fox")
  label: string; // "USD.Bitstamp → CNY.RippleFox"
  sourceIssuerKey?: string; // "bs" — null when source is XRP
  sourceIssuerName?: string; // "Bitstamp"
  destIssuerKey: string;
  destIssuerName: string;
  request: CorridorRequest;
  rationale?: string; // why this route is in the candidate set
}

// Live result of scanning one route
export interface CorridorRouteResult extends CorridorRouteCandidate {
  status: CorridorStatus;
  pathCount: number;
  recommendedRiskScore: number | null;
  recommendedHops: number | null;
  recommendedCost: string | null;
  flags: RiskFlagData[];
  liquidity: CorridorLiquiditySnapshot | null;
  analysis: CorridorAnalysis | null;
  isWinner: boolean;
  rejectedReason?: string;
  // Score is internal, exposed mainly for debugging/UI
  score?: number;
  scannedAt: string;
}

// An off-chain ramp actor: a CEX, remittance operator, Ripple ODL partner,
// mobile-money bridge, or bank that converts local fiat to/from an XRPL
// asset (XRP, RLUSD, USDC, or a native stablecoin). Populated from the
// research atlas in `corlens/docs/xrpl-fiat-actors.md`. Used to annotate
// corridors whose XRPL leg is bridged via RLUSD/USDC held by the actor's
// XRPL account, as well as to enrich the tier-A on-chain fiat corridors
// with their real-world counterparties.
export type CorridorActorType =
  | "cex" // licensed exchange (Bitso, Rain, Kraken, Upbit, …)
  | "odl" // Ripple ODL / Ripple Payments partner
  | "bank" // regulated bank (Travelex Bank, Zand, SABB, …)
  | "remittance" // remittance operator (SBI Remit, iRemit, Tranglo, …)
  | "fintech" // e-money / BaaS / card fintech
  | "mobile-money" // M-Pesa bridges, BarkaChange, Kotani Pay
  | "otc" // OTC desk / market-maker (B2C2, Keyrock, Flowdesk, …)
  | "custodian" // qualified custodian (BNY Mellon, Standard Custody, Metaco)
  | "hub" // cross-country ODL super-hub (Tranglo, Onafriq, Yellow Card)
  | "p2p"; // licensed P2P venue where fiat-crypto flows happen peer-to-peer

export type CorridorActorDirection = "onramp" | "offramp" | "both";

export interface CorridorActor {
  key: string; // stable slug
  name: string; // display name
  type: CorridorActorType;
  country?: string; // ISO-2 or short region label
  supportsXrp?: boolean;
  supportsRlusd?: boolean;
  direction: CorridorActorDirection;
  odl?: boolean; // true if listed as Ripple ODL / Ripple Payments partner
  note?: string; // short qualifier: "first HK RLUSD listing", etc.
  url?: string; // one evidence URL
}

// Legacy 1..5 numeric importance tier. Persisted as Int in the DB. The
// human-readable A/B/C/D/E compliance taxonomy lives only in the research
// atlas (xrpl-fiat-actors.md) and in corridor `highlights`, not the schema.
export type CorridorTier = 1 | 2 | 3 | 4 | 5;

export interface CorridorPairDef {
  id: string; // pair slug, e.g. "usd-cny"
  label: string; // "USD → CNY"
  shortLabel: string; // "USD → CNY (3 issuers)"
  flag: string;
  tier: CorridorTier;
  importance: number;
  region: CorridorRegion;
  category: CorridorCategory;
  description: string;
  useCase: string;
  highlights: string[];
  relatedCorridorIds?: string[];
  source: CorridorAsset;
  dest: CorridorAsset;
  amount: string;
  routes: CorridorRouteCandidate[]; // candidate routes to evaluate
  // Off-chain actor registry. For on-chain fiat corridors (USD, EUR, …) these
  // annotate who handles the retail fiat legs in the real world. For
  // off-chain-bridge corridors they are the only routing information — the
  // XRPL hop is RLUSD held by one of these actors.
  sourceActors?: CorridorActor[];
  destActors?: CorridorActor[];
  // For off-chain-bridge corridors: which XRPL asset the lane settles on.
  bridgeAsset?: "RLUSD" | "USDC" | "XRP" | "EUROP" | "XSGD" | "USDB";
}

// Backwards compatibility alias used by older code paths.
export type CorridorCatalogEntry = CorridorPairDef;

export interface CorridorListItem extends CorridorPairDef {
  status: CorridorStatus; // status of the winning route
  bestRouteId: string | null;
  routeResults: CorridorRouteResult[];
  lastRefreshedAt: string | null;
  pathCount: number; // winner's
  recommendedRiskScore: number | null;
  recommendedHops: number | null;
  recommendedCost: string | null;
  flags: RiskFlagData[]; // winner's
  aiNote: string | null;
  liquidity: CorridorLiquiditySnapshot | null; // winner's
}

export interface CorridorDetailResponse extends CorridorListItem {
  analysis: CorridorAnalysis | null; // winner's full analysis
}

export interface CorridorChatRequest {
  message: string;
  corridorId?: string | null;
  chatId?: string | null;
}

export interface CorridorChatSource {
  corridorId: string;
  label: string;
  snippet: string;
  score: number;
}

export interface CorridorChatResponse {
  chatId: string;
  message: { role: "assistant"; content: string };
  sources: CorridorChatSource[];
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
export function isPaymentPathNode(
  node: GraphNode,
): node is GraphNode & { data: PaymentPathNodeData } {
  return node.kind === "paymentPath";
}
export function isEscrowNode(node: GraphNode): node is GraphNode & { data: EscrowNodeData } {
  return node.kind === "escrow";
}
export function isCheckNode(node: GraphNode): node is GraphNode & { data: CheckNodeData } {
  return node.kind === "check";
}
export function isPayChannelNode(
  node: GraphNode,
): node is GraphNode & { data: PayChannelNodeData } {
  return node.kind === "payChannel";
}
export function isNFTNode(node: GraphNode): node is GraphNode & { data: NFTNodeData } {
  return node.kind === "nft";
}
export function isSignerListNode(
  node: GraphNode,
): node is GraphNode & { data: SignerListNodeData } {
  return node.kind === "signerList";
}
export function isDIDNode(node: GraphNode): node is GraphNode & { data: DIDNodeData } {
  return node.kind === "did";
}
export function isCredentialNode(
  node: GraphNode,
): node is GraphNode & { data: CredentialNodeData } {
  return node.kind === "credential";
}
export function isMPTokenNode(node: GraphNode): node is GraphNode & { data: MPTokenNodeData } {
  return node.kind === "mpToken";
}
export function isOracleNode(node: GraphNode): node is GraphNode & { data: OracleNodeData } {
  return node.kind === "oracle";
}
export function isDepositPreauthNode(
  node: GraphNode,
): node is GraphNode & { data: DepositPreauthNodeData } {
  return node.kind === "depositPreauth";
}
export function isOfferNode(node: GraphNode): node is GraphNode & { data: OfferNodeData } {
  return node.kind === "offer";
}
export function isPermissionedDomainNode(
  node: GraphNode,
): node is GraphNode & { data: PermissionedDomainNodeData } {
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
