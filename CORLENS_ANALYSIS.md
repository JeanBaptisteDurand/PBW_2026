# CORLens — Complete Technical & XRPL Analysis

> Generated from a full codebase review of `JeanBaptisteDurand/PBW_2026`.  
> Reference branch: `copilot/research-xrpl-concepts` · Date: 2026-05-04

---

## 1. What the product is

**CORLens** (`corlens/`) is an AI-powered risk-intelligence and compliance platform for XRPL cross-border payments. Its primary audience is institutions entering XRPL DeFi who need to audit corridor health, entity risk, and routing safety before moving money at scale (ODL, remittances, etc.).

---

## 2. XRPL Lexicon

### 2a. Core XRPL Objects

| Term | Definition | Code reference |
|---|---|---|
| **XRP / Drops** | Native currency. 1 XRP = 1 000 000 drops. All native amounts are integers in drops. | `paymentService.ts:8`, `graphBuilder.ts:57` |
| **r-address** | Base58-encoded XRPL account address starting with "r". Universal entity identifier. | `crawler.ts:60`, `catalog.ts:17` |
| **Trust Line (RippleState)** | On-ledger credit line between two accounts for a non-XRP token. Stores balance, limit, freeze status, deep-freeze bits. | `fetchers.ts:44`, `riskEngine.ts:172` |
| **IOU** | "I Owe You" — any token on XRPL other than XRP. IOUs require a trust line and an issuer. | `catalog.ts:101`, `README.md:35` |
| **Gateway / Issuer** | Account that issues IOUs into circulation, tracked via `gateway_balances` (obligations). | `crawler.ts:93-106`, `riskEngine.ts:52` |
| **AMM Pool** | Automated Market Maker pool (XLS-30 amendment). On-chain pool account holds two reserves and issues LP tokens. | `fetchers.ts:30`, `crawler.ts:118-140` |
| **LP Token** | Liquidity Provider token minted by an AMM pool. Holders are proportional owners of the pool's reserves. | `graphBuilder.ts:110-134`, `riskEngine.ts:27` |
| **DEX Orderbook** | XRPL's native decentralised exchange. Offers are posted on-ledger; `book_offers` returns bids/asks. | `fetchers.ts:84-96`, `partnerDepth.ts:184` |
| **Payment Path** | Multi-hop route through XRPL for exchanging one asset for another in a single atomic payment. Discovered via `ripple_path_find`. | `fetchers.ts:100-112`, `client.ts:176` |
| **Escrow** | Time-locked or condition-locked XRP holding on-ledger. | `graphBuilder.ts` imports, `core/index.ts:7` |
| **Signer List** | Multi-sig configuration object. A `SignerList` ledger entry means the account requires M-of-N signatures. | `fetchers.ts:22`, `riskEngine.ts:221-237` |
| **NFT / NFToken** | Non-fungible token on XRPL (XLS-20). Stored in `account_nfts`; NFT offers tracked separately. | `fetchers.ts:179-280`, `crawler.ts:213-222` |
| **Payment Channel** | Channel for streaming micro-payments off-ledger, settled on-chain. | `fetchers.ts:211-229`, `core/index.ts:17` |
| **Check** | XRPL "cheque" object representing a conditional claim on funds. Outstanding checks are a financial liability. | `riskEngine.ts:239-257` |
| **DID** | Decentralised Identifier ledger object (XLS-40). | `core/index.ts:14` |
| **MPToken** | Multi-Purpose Token (XLS-33). | `core/index.ts:15` |
| **Oracle** | On-chain price oracle object (XLS-47). | `core/index.ts:16` |
| **DepositPreauth** | Allows specific sender accounts past a `DepositAuth` restriction. | `core/index.ts:17` |
| **Permissioned Domain** | On-chain domain object for KYC/compliance gating (XLS-80). | `core/index.ts:20` |
| **Bridge** | Cross-chain bridge ledger object (XRPL sidechain feature). | `core/index.ts:21` |
| **Vault** | MPT vault object (XLS-65). | `core/index.ts:22` |

### 2b. Key Account Flags (bit fields on `account_info.Flags`)

| Flag Constant | Hex value | Meaning |
|---|---|---|
| `GlobalFreeze` | `0x00400000` | Issuer has frozen **all** trust lines globally. |
| `AllowTrustLineClawback` | `0x80000000` | Issuer can forcibly reclaim issued tokens (XLS-73). |
| `DepositAuth` | `0x01000000` | Only pre-authorised senders can deposit. |
| `DisableMasterKey` | `0x00100000` | Master key disabled (safe only if RegularKey or SignerList exists). |

Source: `riskEngine.ts:6-10`

### 2c. XLS-77 Deep Freeze Trust Line Flags

| Flag | Hex | Meaning |
|---|---|---|
| `lsfLowDeepFreeze` | `0x02000000` | Low-side party is deep-frozen. |
| `lsfHighDeepFreeze` | `0x04000000` | High-side party is deep-frozen. |

Deep freeze (XLS-77) blocks **both sending AND receiving** on the trust line — a sanctions-grade restriction, stricter than normal freeze (which only blocks the holder from sending). Source: `riskEngine.ts:12-19`.

### 2d. XRPL RPC Commands Used

| Command | What it returns |
|---|---|
| `account_info` | Balance, flags, `RegularKey`, `signer_lists` |
| `account_lines` | All trust lines (paginated) |
| `gateway_balances` | Issued token totals (obligations) |
| `amm_info` | AMM pool state (reserves, LP tokens, trading fee, vote slots) |
| `book_offers` | Orderbook offers (bids/asks) |
| `ripple_path_find` | Multi-hop payment route candidates |
| `account_tx` | Recent transaction history |
| `account_objects` | All on-ledger objects (SignerList, Escrow, Check, Channel…) |
| `account_nfts` | NFTs held |
| `account_channels` | Payment channels |
| `account_currencies` | Sendable/receivable currency codes |
| `noripple_check` | Detects misconfigured `NoRipple` flags on a gateway |
| `nft_buy_offers` / `nft_sell_offers` | NFT marketplace offers |
| `server_info` | Node health |

Source: `fetchers.ts` (15 functions, lines 17–319)

### 2e. Key XRPL Concepts & Standards

| Term | Meaning | Code reference |
|---|---|---|
| **RLUSD** | Ripple's USD stablecoin. Canonical issuer: `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`. Platform detects impersonators. | `riskEngine.ts:153` |
| **ODL** | On-Demand Liquidity. Ripple's product for instant cross-border payments using XRP as a bridge asset. Bitso is the flagship ODL partner for USD→MXN. | `README.md:95` |
| **XLS-73 AMM Clawback** | Amendment allowing issuers with `AllowTrustLineClawback` to claw back tokens already deposited in an AMM pool as LP. Every LP in such a pool is exposed. | `riskEngine.ts:403-449` |
| **XLS-77 Deep Freeze** | Amendment adding per-trust-line deep freeze bits; blocks both sending and receiving (sanctions-grade). | `riskEngine.ts:352-400` |
| **TransferRate** | Fee charged every time a token transfers between non-issuer accounts. Stored as `1_000_000_000 + fee_rate × 1_000_000_000`. >1% is flagged. | `riskEngine.ts:197-205` |
| **Blackholed Account** | Account with master key disabled, no `RegularKey`, no `SignerList` → permanently inaccessible. | `riskEngine.ts:304-320` |
| **NoRipple** | Trust line flag preventing rippling (chaining) through an account. Misconfigured NoRipple on a gateway breaks multi-hop payments. | `riskEngine.ts:338-350` |
| **Rippling** | Mechanism allowing XRPL to chain trust lines to route a payment through multiple gateways in a single transaction. | — |
| **Validated Ledger** | Finalised, immutable ledger version. All RPC calls use `ledger_index: "validated"` for canonical results. | `fetchers.ts` (every call) |
| **Marker (pagination)** | Opaque cursor returned when ledger results exceed the page limit. The code loops on it: `do { fetch; marker = resp.marker } while (marker)`. | `fetchers.ts:51-66` |
| **Auction Slot** | AMM feature where traders bid to get discounted fees for 24 hours. | `core/index.ts:121-133` |
| **Vote Slots** | AMM mechanism for LPs to vote on the trading fee. | `core/index.ts:128-134` |

---

## 3. User-Facing Features — High-Level Implementation Map

### Feature 1: Corridor Atlas (`/corridors`)

**What the user sees:** A searchable table of 2,436 live fiat corridors (USD→MXN, EUR→GBP, etc.) with GREEN/AMBER/RED health status, partner breakdown, and AI notes.

**Implementation:**

1. **Static catalog** (`catalog.ts`): The full 2,436-corridor dataset is defined at compile time as `CORRIDOR_CATALOG`. Each `CorridorPairDef` entry includes: corridor ID (e.g. `"usd-mxn"`), source/dest `CorridorAsset`, actors, routes, region, tier, and category (`on-chain`, `hybrid`, `off-chain-bridge`). The `ISSUERS_BY_CURRENCY` map lists canonical on-chain XRPL issuer addresses per currency. Source: `catalog.ts:17-89`.

2. **Background refresh** (`refreshService.ts`, `corridorRefreshQueue.ts`): A BullMQ repeatable job scans corridors hourly. For each corridor the scanner runs `ripple_path_find` against live XRPL mainnet, computes GREEN/AMBER/RED status from path count and risk score, and writes the result to the `Corridor` table. An AI note is generated via GPT-4o-mini and cached by `liquidityHash`.

3. **API** (`GET /api/corridors`): Joins the in-memory catalog with cached DB rows and returns `CorridorListItem[]`. Falls back to `UNKNOWN` for corridors not yet scanned. Source: `routes/corridors.ts:103-120`.

4. **Orderbook depth** (`GET /api/corridors/:id/partner-depth`): Fetches real-time bid/ask depth from Bitso (for USD→MXN) or the XRPL DEX via `book_offers` (for GateHub IOU pairs). Spread is returned in basis points, cached 60 seconds. Source: `partnerDepth.ts:1-290`.

---

### Feature 2: Entity Audit Graph (`/analyze` → `/graph/:id`)

**What the user sees:** Enter any XRPL r-address → the system crawls it and renders an interactive knowledge graph with 18+ node types, 19+ edge types, and coloured risk flags.

**Implementation:**

1. **Trigger** (`POST /api/analyze`): Creates an `Analysis` row (`status: "queued"`), enqueues a BullMQ job.

2. **Crawl** (`crawler.ts:60-395`): `crawlFromSeed()` fires 15+ sequential XRPL RPC calls: account_info → trust lines (up to 2,000, paginated) → gateway_balances → AMM pool → LP holders → orderbook (asks + bids) → payment paths → account_objects → NFTs → payment channels → transactions (200) → DEX offers → currencies → top-20 account enrichment → noripple_check.

3. **BFS expansion** (`bfsOrchestrator.ts`): At depth ≥ 2, the orchestrator picks "heavy" neighbours (AMM pool account, counter-asset issuer, top trust-line holders, tx-frequency-heavy counterparties) and crawls each with `concurrency=4`, capped at 60 crawls total and 800 nodes after trimming. Source: `bfsOrchestrator.ts:325-494`.

4. **Graph build** (`graphBuilder.ts`): Translates `CrawlResult` into `GraphData` (nodes + edges). 18 node kinds and 19 edge kinds are supported. Each AMM pool becomes an `ammPool` node connected to two token nodes via `POOLS_WITH` edges; trust line holders become `account` nodes via `TRUSTS` edges.

5. **Risk engine** (`riskEngine.ts`): `computeRiskFlags()` inspects the `CrawlResult` and emits up to 20 flag types with `HIGH/MED/LOW` severity. Notable: `CLAWBACK_ENABLED` (XLS-73), `DEEP_FROZEN_TRUST_LINE` (XLS-77), `RLUSD_IMPERSONATOR`, `BLACKHOLED_ACCOUNT`, `GLOBAL_FREEZE`, `CONCENTRATED_LIQUIDITY`.

6. **RAG indexing** (`ai/rag.ts`): Node and edge text summaries are embedded via `text-embedding-3-small` (1536-dim) and stored as `vector(1536)` columns in the `RagDocument` table (pgvector). Source: `prisma/schema.prisma:81-90`.

7. **Frontend graph** (`GraphView.tsx`): ReactFlow renders nodes in concentric rings by kind (issuer at centre; tokens at radius 260; AMM pools at 380; orderbooks at 480; account holders at 560+). A legend filters by node/edge kind persisted to localStorage. Clicking a node opens a `NodeDetailPanel`; a floating button opens a RAG chat drawer. Source: `GraphView.tsx:96-119`.

---

### Feature 3: Safe Path AI Agent (`/safe-path`)

**What the user sees:** Enter source currency, destination currency, and amount → an AI agent streams its thought process in real time, proposes routes, flags risks, and generates a downloadable compliance PDF.

**9-Phase Pipeline** (`safePathAgent.ts`):

| Phase | What happens | Code reference |
|---|---|---|
| 1 – Corridor Resolution | Looks up currency pair in 2,436-corridor catalog; returns category, actors, issuers. | `safePathAgent.ts:96-103` |
| 1.5 – Corridor RAG | Cosine-similarity search over `CorridorRagDocument` table for corridor-specific intelligence. | `corridors/chatService.ts` |
| 2 – AI Planning | GPT-4o-mini generates a 4–5 sentence investigation plan. | `safePathAgent.ts` |
| 3 – Parallel Actor Research | GPT-4o-mini web-search + live Bitso XRP/MXN spread fetch — all in parallel. | `partnerDepth.ts` |
| 4 – Deep Entity Analysis | Enqueues BFS depth-2 crawls of every issuer and AMM pool; waits ≤ 45 s; indexes to RAG; queries for risk insights. | `safePathAgent.ts:165-256` |
| 4.5 – Actor Address Discovery | Resolves r-addresses of named off-chain actors (Bitstamp, Kraken, Binance…) from a registry or GPT fallback; deep-analyses them. | `safePathAgent.ts` |
| 5 – On-Chain Pathfinding | Calls `ripple_path_find`; per-path crawl + `computeRiskFlags()`; rejects paths exceeding `maxRiskTolerance`. | `safePathAgent.ts` |
| 6 – Off-Chain Bridge Reasoning | For fiat→fiat with no IOU trust lines: evaluates ramp quality, RLUSD issuer health, XRP/RLUSD AMM pool state. | `safePathAgent.ts` |
| 7 – Split Plan | If amount > $50 K and depth insufficient: computes an optimal split (e.g. 60/40) to keep slippage < 20 bps. | `safePathAgent.ts` |
| 8 – Verdict | GPT-4o-mini writes 4–6 sentence compliance justification. Verdict: `SAFE`, `REJECTED`, `NO_PATHS`, or `OFF_CHAIN_ROUTED`. | `safePathAgent.ts` |
| 9 – Report | 12-section Markdown compliance report; downloadable PDF via `ai/pdfRenderer.ts`. | `ai/pdfRenderer.ts` |

**Streaming:** Every phase emits typed `SafePathEvent` objects over SSE (`text/event-stream`). The frontend opens an `EventSource`, parses each event, and updates a real-time discovery graph and event log. Source: `routes/safe-path.ts:35-50`.

**Persistence:** The final `SafePathResult` is written to `SafePathRun` in Postgres (full JSON result, Markdown report, verdict, linked `analysisIds`).

---

### Feature 4: RAG Chat (`/chat`, floating drawer in graph view)

**What the user sees:** A chat interface that answers natural-language questions grounded in actual crawled XRPL data.

**Implementation:**

1. **Indexing** (`ai/rag.ts`): After a graph build, each node's label, kind, risk flags, and structured data are serialised to a text chunk and embedded via `text-embedding-3-small`. Stored as `RagDocument` rows with `vector(1536)`.

2. **Retrieval** (`chatWithAnalysis()`): On each user message an embedding of the query is computed; a cosine-similarity search (`<=>` in pgvector) fetches top-K relevant chunks injected into the GPT system prompt.

3. **Chat history:** Last 10 messages from `RagMessage` are prepended for conversation coherence.

4. **Corridor RAG** (`corridors/chatService.ts`, `corridors/ragIndex.ts`): A separate vector store for corridor intelligence, scoped by `corridorId` or searched across the whole atlas.

---

### Feature 5: Wallet Auth & Premium Gate

**What the user sees:** Connect with Crossmark wallet → receive a JWT → optionally pay 10 XRP or 5 RLUSD to unlock premium features.

**Implementation:**

1. **Wallet connection** (`routes/auth.ts:10-35`): `POST /api/auth/connect` with `{ walletAddress }`. Upserts a `User` row (wallet address as unique identifier — no password, no email). Returns a signed 24 h JWT with `userId`, `walletAddress`, `role`.

2. **JWT middleware** (`middleware/auth.ts`): `verifyJwt` checks `Authorization: Bearer` header or `?token=` query param. `requirePremium` enforces `role === "premium"`. `verifyApiKeyOrJwt` also accepts `x-api-key` header for MCP/programmatic access.

3. **Payment flow** (`services/paymentService.ts`): `createPaymentRequest()` generates a UUID memo and stores a `PaymentRequest` row. `checkPayment()` polls `account_tx` on the destination wallet, looking for a `Payment` transaction whose decoded `MemoData` matches the UUID. On match: atomically confirms payment, creates `PremiumSubscription`, upgrades user role to "premium". Source: `paymentService.ts:59-120`.

4. **Frontend** (`hooks/useAuth.ts`): A singleton external store synced to `localStorage` via `useSyncExternalStore`. Exposes `connect()`, `refresh()`, `logout()`, `isPremium`.

---

### Feature 6: MCP Server (Claude integration)

**What the user sees:** Developers add CORLens to their Claude Desktop config and Claude can call 7 CORLens tools directly.

**Implementation:** A standalone Node.js process (`apps/mcp-server`) communicating over stdio using `@modelcontextprotocol/sdk`. It wraps the CORLens REST API with 7 typed tools:

| MCP Tool | REST Endpoint | Purpose |
|---|---|---|
| `list_corridors` | `GET /api/corridors` | Browse corridor atlas with filters |
| `get_corridor` | `GET /api/corridors/:id` | Full corridor detail |
| `ask_corridor` | `POST /api/corridors/chat` | RAG question over corridor data |
| `analyze_address` | `POST /api/analyze` (+ polling) | Launch entity audit, wait, return graph stats |
| `ask_analysis` | `POST /api/analysis/:id/chat` | RAG question over entity graph |
| `safe_path` | `POST /api/safe-path` | Run the full Safe Path AI agent |
| `get_graph` | `GET /api/analysis/:id/graph` | Raw graph JSON |

Authentication: `x-api-key` (if key starts with `xlens_`) or `Authorization: Bearer` on every call. Source: `mcp-server/src/index.ts`.

---

### Feature 7: Corridor Detail + Route Liquidity Panel

**What the user sees:** Click a corridor → see candidate routes, health status, measured partner orderbook depth (spread in bps), risk flags, and a 30-day status sparkline.

**Implementation:**

- `GET /api/corridors/:id` — full `CorridorDetailResponse` with `routeResults[]`, last scan time, and AI note. Source: `routes/corridors.ts:124-144`.
- `GET /api/corridors/:id/history` — up to 90 days of `CorridorStatusEvent` rows for the sparkline. Source: `routes/corridors.ts:184-228`.
- `GET /api/corridors/:id/partner-depth?actor=bitso` — live `PartnerDepthSnapshot` (bid/ask counts, prices, spread in bps, depth in base currency). Source: `partnerDepth.ts:244-287`.
- Frontend: `CorridorDetail.tsx` → `RouteLiquidityPanel.tsx`, `RouteRow.tsx`, `StatusBadge.tsx`.

---

## 4. Architecture Summary

```
Browser (React 18 + Vite + ReactFlow + TailwindCSS)
  │
  │ REST / SSE
  ▼
Express API (apps/server/)
  ├─ /api/auth          — Crossmark wallet auth + JWT + on-chain payment verification
  ├─ /api/corridors     — Corridor atlas (cached from Postgres + live depth)
  ├─ /api/analyze       — Entity audit launch → BullMQ → BFS crawl → graph build
  ├─ /api/safe-path     — Safe Path AI agent (SSE streaming, 9-phase pipeline)
  ├─ /api/analysis/:id  — Graph retrieval + RAG chat
  └─ /api/corridors/chat — Corridor RAG chat
  │
  ├─ PostgreSQL (Prisma ORM)
  │   + pgvector extension      — Analysis, Node, Edge, RiskFlag,
  │                               RagDocument, Corridor, User, Payment
  ├─ Redis + BullMQ             — Job queue for entity crawl + corridor refresh
  ├─ XRPL Mainnet               — QuickNode (primary, 50 rps) + public fallbacks
  │   (WebSocket, xrpl.js)        (xrplcluster.com, s1/s2.ripple.com)
  ├─ OpenAI API                 — GPT-4o-mini (planning, compliance text, web search),
  │                               text-embedding-3-small (RAG vectors, 1536-dim)
  └─ Bitso REST API             — Live XRP/MXN orderbook depth (60 s TTL cache)

MCP Server (apps/mcp-server/)  — stdio transport → wraps REST API for Claude Desktop
```

---

## 5. Risk Flag Reference (all 20 flags)

| Flag | Severity | Trigger |
|---|---|---|
| `CONCENTRATED_LIQUIDITY` | HIGH | Top 3 LPs hold > 80% of pool |
| `SINGLE_GATEWAY_DEPENDENCY` | HIGH | No alternative payment paths; single issuer with > 50 trust lines |
| `LOW_DEPTH_ORDERBOOK` | MED | No offers or spread > 5% |
| `THIN_AMM_POOL` | MED | Estimated TVL < $100 K |
| `STALE_OFFER` | LOW | (Reserved — not yet emitted without reliable timestamps) |
| `UNVERIFIED_ISSUER` | LOW | Issuer has no `Domain` field set |
| `RLUSD_IMPERSONATOR` | HIGH | Account issues RLUSD but is not the canonical issuer |
| `FROZEN_TRUST_LINE` | HIGH | One or more trust lines are frozen |
| `GLOBAL_FREEZE` | HIGH | `GlobalFreeze` flag set on issuer |
| `HIGH_TRANSFER_FEE` | MED | `TransferRate` > 1% |
| `CLAWBACK_ENABLED` | HIGH | `AllowTrustLineClawback` flag set (XLS-73) |
| `NO_MULTISIG` | LOW | Token issuer has no `SignerList` |
| `ACTIVE_CHECKS` | MED | Outstanding XRPL checks (potential liabilities) |
| `HIGH_TX_VELOCITY` | MED | ≥ 200 recent transactions with one type > 90% (bot pattern) |
| `DEPOSIT_RESTRICTED` | LOW | `DepositAuth` flag set |
| `BLACKHOLED_ACCOUNT` | HIGH | Master disabled + no RegularKey + no SignerList |
| `NO_REGULAR_KEY` | LOW | Token issuer relying on master key only |
| `NORIPPLE_MISCONFIGURED` | MED | `noripple_check` returned problems for this gateway |
| `DEEP_FROZEN_TRUST_LINE` | HIGH | XLS-77 deep freeze bits set on a `RippleState` object |
| `AMM_CLAWBACK_EXPOSURE` | HIGH | AMM pool contains a clawback-enabled asset (XLS-73) |

Source: `riskEngine.ts`, `core/index.ts:52-74`

---

## 6. Key Interview Talking Points for a Front-End Developer

1. **XRPL is not EVM.** There are no smart contracts. Logic like AMM pools, trust lines, escrows, and DEX offers are native protocol-level objects — queried via WebSocket RPC, not contract ABIs.

2. **Trust lines = credit lines.** Any non-XRP token transfer requires both parties to have a trust line, and the issuer can freeze or clawback (XLS-73) at any time — this is why risk scanning matters.

3. **`ripple_path_find` is the XRPL equivalent of a DEX quote.** It finds multi-hop routes through gateways and AMM pools for a given currency pair. CORLens uses it both to determine corridor health and to propose safe routes.

4. **Corridor classification:** CORLens uses three categories — *on-chain* (live IOU orderbooks), *hybrid* (on-chain infrastructure exists but off-chain partners settle), *off-chain bridge* (no live XRPL IOU; settlement via RLUSD/XRP bridge through named real-world partners).

5. **RLUSD is Ripple's dollar stablecoin**, live on mainnet since Dec 2024, canonical issuer `rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De`. The risk engine detects impersonators by checking any account that issues `RLUSD` or its hex equivalent against this address.

6. **XLS-73 and XLS-77 are live XRPL amendments** that no competing tool flags. XLS-73 lets issuers claw back tokens already in an AMM pool. XLS-77 adds deep freeze — blocking **both** send and receive on a trust line (sanctions-grade restriction).

7. **The front-end receives SSE, not WebSocket, for the Safe Path agent.** Each `SafePathEvent` is a typed discriminated union (`type: "tool_call" | "path_rejected" | "report" | ...`). The React component renders each event into a live timeline and real-time ReactFlow discovery graph.

8. **Authentication is wallet-first, no password.** Crossmark signs a wallet-connect flow; the server creates/upserts a user by `walletAddress` and issues a 24 h JWT. Premium is gated by an on-chain XRP/RLUSD payment verified by scanning `account_tx` for a UUID memo.

9. **The graph uses concentric-ring layout** (not force-directed). Issuers are at centre; tokens at radius 260; AMM pools at 380; orderbooks at 480; account holders at 560+. Each ring radius is a constant in `GraphView.tsx:96-119`.

10. **All XRPL queries target `ledger_index: "validated"`** — the finalised ledger, never pending. Two separate WebSocket connections are maintained (primary + pathfind), each with rate-limiting at 50 req/sec for QuickNode and automatic fallback to public nodes.
