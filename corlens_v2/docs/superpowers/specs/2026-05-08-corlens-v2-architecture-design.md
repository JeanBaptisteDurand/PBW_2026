# CORLens v2 — Architecture Design

**Date:** 2026-05-08
**Status:** Draft — pending user review
**Source project:** `/Users/beorlor/Documents/PBW_2026/corlens/` (monolith, post-Hack-the-Block-2026)
**Target project:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/` (greenfield, parallel)

---

## 1. Context

CORLens v1 shipped at Hack the Block 2026 as a single Express monolith (~30k LOC) handling XRPL corridor analysis, entity audits, the Safe Path AI agent, JWT auth, XRP/RLUSD payments, BullMQ queue workers, and an MCP server. It works, but:

- **No layering.** Routes call Prisma directly, mix validation, business logic, AI calls, and DB writes in single files.
- **A few files are too large to reason about.** `safePathAgent.ts` 1075 lines, `corridors/catalog.ts` 1264 lines, `graphBuilder.ts` 885 lines.
- **The XRPL client, OpenAI client, partner-exchange APIs, and Prisma are all duplicated implicitly across modules** that should be talking to a shared boundary.
- **The auth flow is unsafe** — `POST /api/auth/connect` accepts a `walletAddress` from the request body without verifying any wallet signature. Anyone can issue themselves a JWT for any wallet.
- **Caddy is just a TLS terminator** — `reverse_proxy localhost:8080`, no path routing, no auth gating.

CORLens v2 is a **greenfield rewrite in `corlens_v2/`**, structured as 6 backend services (Fastify) + 1 SPA + 1 MCP binary behind a Caddy gateway. The goal is "false micro-services" — coupled today via HTTP, ready to flip to event-driven later by changing one package, not the whole codebase.

CORLens v1 stays running on `cor-lens.xyz` until v2 is ready to take traffic. v1 is the source of truth for **domain logic** (corridor catalog, BFS crawler, risk engine, the 9-phase Safe Path pipeline). v2 is a **structural rebuild** — most TypeScript code can be ported verbatim into the new layering; the parts that are reorganized are the boundaries (controllers, repositories, connectors, schemas).

## 2. Goals

1. **Service isolation** — each service owns one domain, one database schema, one external concern. A new contributor can read one service in an afternoon.
2. **Clean MVC-ish layering inside each service** — controllers, services, repositories, connectors, models. Controllers never touch Prisma; services never touch HTTP.
3. **Caddy as the single source of routing and authentication** — JWTs are validated at the gateway via `forward_auth`, downstream services trust injected headers.
4. **A central data-fetch service** — `market-data` owns every persistent XRPL connection, the rate-limit budget, the Redis cache, and all periodic refresh crons.
5. **A central AI service** — `ai-service` owns every LLM call, embedding, and web search. One place to swap providers, audit prompts, and apply rate limits.
6. **Auto-generated Swagger** at every service from Zod schemas, aggregated at the gateway.
7. **Event-driven readiness** — a tiny `@corlens/events` package abstracts publish/subscribe so today's HTTP calls can be flipped to Redis Streams or RabbitMQ later by changing one file.
8. **Type safety end-to-end** — Zod contracts in a shared package generate both server-side validation and client-side typed callers. Refactors break the build, not production.
9. **Preserve every v1 feature.** No functionality is dropped during the rebuild. Concretely: corridor catalog (2,436 corridors), entity audit (BFS + 30+ risk flags + graph), Safe Path 9-phase pipeline, RAG chat (corridor + entity), Crossmark login, XRP/RLUSD payment + premium gating, API keys, MCP server, compliance reports + PDF, hourly catalog refresh, partner depth (Bitso). Roadmap items already flagged for the rebuild (real web search, additional partner depths, Redis cache, pre-warm cron) are added; nothing is removed.

## 3. Non-goals

- **Not switching off Crossmark / XRPL.** v2 stays on XRP Ledger mainnet with Crossmark wallet auth. The `wagmi/RainbowKit/SIWE/Base Sepolia` line in earlier notes is dropped.
- **Not migrating to Drizzle.** v1 is heavily Prisma'd; the win isn't worth the churn during a structural rewrite. If desired later, it's a separate spec.
- **Not replacing BullMQ.** It's the right primitive and already wired into the codebase. New services adopt it.
- **Not extracting `payment` from `identity`.** They share the User table and JWT role flag. Splitting them adds events and complexity for no current benefit.
- **Not rewriting the frontend.** The existing `apps/web` (Vite + React + Crossmark) ports across as-is, with its API client regenerated from `@corlens/contracts`.
- **Not building the queue infrastructure for events on day one.** Build the seam (`@corlens/events` interface), not the implementation. Migrate one event end-to-end after the services are stable.
- **Not implementing real microservices** (separate DBs, separate deploy pipelines). v2 is "false microservices": one Postgres instance, one Redis, one docker-compose, separate processes and clean boundaries.

## 4. Service map

| # | Service | Process | Responsibility | External deps |
|---|---|---|---|---|
| 1 | **gateway** | Caddy | TLS, routing, JWT verification via `forward_auth`, rate limit per role | None |
| 2 | **web** | Vite static (served by Caddy) | React SPA, all UI | gateway |
| 3 | **identity** | Fastify (port 3001) | Users, JWT issue/refresh, API keys, payment requests, premium upgrades, `/verify` for Caddy | identity DB schema, market-data (payment polling) |
| 4 | **market-data** | Fastify (port 3002) | XRPL WebSocket pool, all on-ledger reads (`account_info`, `book_offers`, `path_find`, `account_tx`, `amm_info`, etc.), partner exchange depth (Bitso, Bitstamp, Kraken, Binance), Redis cache, periodic crons (hourly catalog refresh, pre-warm RLUSD/USDC/GateHub) | XRPL nodes (QuickNode + 3 fallbacks), partner REST APIs |
| 5 | **ai-service** | Fastify (port 3003) | LLM completions, embeddings, real web search (Brave or Tavily — replaces v1's hallucinating GPT webSearch), prompt audit log, provider routing | OpenAI, Brave/Tavily, ai-service DB schema |
| 6 | **corridor** | Fastify (port 3004) | 2,436-corridor catalog, scanner, status events, corridor RAG (pgvector) | corridor DB schema, market-data, ai-service |
| 7 | **path** | Fastify (port 3005) | Entity audit, BFS crawler, graph builder, risk engine (30+ flags), entity RAG | path DB schema, market-data, ai-service |
| 8 | **agent** | Fastify (port 3006) | Safe Path orchestrator, the 9-phase pipeline, compliance report, signed PDF | agent DB schema, corridor, path, market-data, ai-service |
| — | **mcp-server** | Node script | External-facing MCP for Claude Desktop. Calls services through gateway with API key. | gateway |

## 5. Shared packages

In-process imports inside the monorepo. **Not services.**

| Package | Contents | Imported by |
|---|---|---|
| `@corlens/contracts` | Zod schemas + TS types for every inter-service request and response. The single source of truth for API shapes. | All services |
| `@corlens/db` | Single Prisma schema split into Postgres schemas (`identity`, `corridor`, `path`, `agent`, `ai`, `market_data`). One generated client per service, scoped to its schema only. | All services that own data |
| `@corlens/clients` | Typed HTTP clients for service-to-service calls, generated from `@corlens/contracts`. Refactors fail at compile time. | All services that call peers |
| `@corlens/events` | `publish(name, payload)` and `subscribe(name, handler)` interface. Today: in-process noop or direct HTTP fallback. Tomorrow: Redis Streams. | All services |

## 6. Per-service folder structure

```
apps/<service>/
├── src/
│   ├── controllers/        Fastify route handlers — Zod validation, call service, format response
│   ├── services/           Use-cases / business logic — pure functions where possible
│   ├── repositories/       Prisma calls scoped to this service's schema
│   ├── connectors/         External clients: market-data SDK, ai-service SDK, XRPL, OpenAI, partner REST
│   ├── models/             Zod schemas + types — re-exports from @corlens/contracts plus internal-only types
│   ├── events/             Event publishers and subscribers (publish on state change, subscribe to peer events)
│   ├── plugins/            Fastify plugins (auth, logging, error handler, swagger)
│   ├── app.ts              buildApp() — registers plugins, routes, error handlers; returns FastifyInstance
│   ├── index.ts            Bootstrap: load env, buildApp(), app.listen()
│   └── env.ts              Zod-validated env config
├── tests/                  Vitest — unit + integration
├── package.json
├── tsconfig.json
└── README.md               Service charter (one page)
```

**Layering rules:**
- Controllers **never** touch Prisma.
- Services **never** touch HTTP req/res.
- Repositories **only** access their own schema; never read another service's tables.
- Connectors are the **only** layer that talks to the outside world.
- Models are Zod-first; types are derived (`z.infer<typeof Schema>`).
- **TypeScript `interface` is reserved for ports** — meaningful boundaries that have, or could have, multiple implementations (e.g., `EventBus`, `LLMProvider`, `XRPLClientWrapper`, `WalletVerifier`). **Plain data shapes use Zod-derived types**, not interfaces. Don't write interfaces for response payloads, config bags, or DB rows.

## 7. Service details

### 7.1 gateway (Caddy)

**Caddyfile sketch:**

```
cor-lens.xyz {
    # Frontend
    handle /api/* {
        # JWT validation via identity service
        forward_auth identity:3001 {
            uri /verify
            copy_headers X-User-Id X-User-Role
        }

        # Routing
        handle /api/auth/*    { reverse_proxy identity:3001 }
        handle /api/payment/* { reverse_proxy identity:3001 }
        handle /api/corridor* { reverse_proxy corridor:3004 }
        handle /api/analyze   { reverse_proxy path:3005 }
        handle /api/analysis* { reverse_proxy path:3005 }
        handle /api/graph/*   { reverse_proxy path:3005 }
        handle /api/safe-path { reverse_proxy agent:3006 }
        handle /api/compliance/* { reverse_proxy agent:3006 }
        handle /api/chat      { reverse_proxy agent:3006 }
        handle /api/history*  { reverse_proxy agent:3006 }
    }

    # Aggregated docs
    handle /docs { reverse_proxy /docs/aggregated }

    # Static SPA
    handle { reverse_proxy web:80 }
}
```

**Auth flow:**

```
Browser → Caddy → /api/anything (with Authorization: Bearer <jwt>)
                 ↓ forward_auth → identity:/verify
                 ↓ identity validates JWT → 200 + X-User-Id + X-User-Role
                 ↓ Caddy injects headers, proxies to target service
                 ↓ Target service trusts headers (Caddy is the only ingress)
```

Public routes (no JWT required) live under `/api/public/*` and bypass `forward_auth`. Examples: `POST /api/auth/connect` (login), `GET /api/corridor` (catalog browse, free tier).

**Rate limiting** is per role (`free` / `premium` / `api-key`) using Caddy's `rate_limit` plugin once the JWT role is known.

### 7.2 identity

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/connect` | POST | Public | Crossmark SIWE-style login: client signs a challenge, server verifies signature, issues JWT. **Fixes v1's unauthenticated wallet flaw.** |
| `/api/auth/refresh` | POST | JWT | Re-issue JWT with current DB role |
| `/api/auth/profile` | GET | JWT | User profile + recent analyses + active subscriptions |
| `/api/auth/api-key` | POST/DELETE | JWT (premium) | Manage API key for MCP / programmatic access |
| `/api/payment/info` | GET | Public | Current pricing |
| `/api/payment/create` | POST | JWT | Create payment request (XRP or RLUSD) |
| `/api/payment/status/:id` | GET | JWT | Poll payment status (calls market-data for `account_tx`) |
| `/verify` | GET | Internal | For Caddy `forward_auth` — validates JWT, returns headers |

**Owns tables:** `identity.users`, `identity.payment_requests`, `identity.premium_subscriptions`.

**Publishes events:**
- `payment.confirmed` (downstream subscribers may notify or invalidate caches)
- `user.role_upgraded`

### 7.3 market-data

The lynchpin service. **Owns the XRPL connection pool — no other service speaks `xrpl.js` directly.**

| Endpoint | Purpose |
|---|---|
| `GET /xrpl/account/:address` | account_info + flags |
| `GET /xrpl/account/:address/lines` | trust lines (paginated) |
| `GET /xrpl/account/:address/objects` | account_objects (paginated) |
| `GET /xrpl/account/:address/transactions` | account_tx (with `sinceUnixTime` filter) |
| `GET /xrpl/account/:address/nfts` | account_nfts |
| `GET /xrpl/account/:address/channels` | account_channels |
| `GET /xrpl/account/:address/offers` | account_offers |
| `GET /xrpl/amm/:asset1/:asset2` | amm_info by asset pair |
| `GET /xrpl/amm/:account` | amm_info by AMM account |
| `GET /xrpl/book?takerGets&takerPays` | book_offers |
| `POST /xrpl/path-find` | ripple_path_find (long-running, returned via SSE) |
| `GET /xrpl/noripple/:address` | noripple_check |
| `GET /partner-depth/:actor/:book` | Bitso / Bitstamp / Kraken / Binance live depth |
| `GET /supported-actors` | List of supported partner exchanges |
| `POST /admin/refresh-corridors` | Manual trigger of the hourly catalog refresh job |

**Internal:**
- One persistent `XRPLClientWrapper` per process (primary + pathfind clients with fallback endpoints, ported from v1's `xrpl/client.ts`).
- Redis cache (`@corlens/db`-managed Redis client) — TTLs per data type. Hot accounts (RLUSD, USDC, GateHub) pre-warmed by a BullMQ cron.
- Hourly BullMQ job `corridor.scan` that walks the catalog and writes status events to corridor's schema **via the corridor service's API**, not direct DB writes (respects the boundary).

**Fixes from the v1 ROADMAP automatically:**
- P0 #3 (Bitstamp/Kraken/Binance depth) — one PR adds new fetchers in `connectors/`.
- P0 #4 (Redis cache for `crawlAccount`) — built in from day one.
- P0 #5 (pre-warm RLUSD/USDC/GateHub) — BullMQ cron in this service.

**Publishes events:** `corridor.refreshed`, `xrpl.account.crawled` (optional — useful for path/agent invalidation).

### 7.4 ai-service

**Owns every prompt the platform runs.** No other service talks to OpenAI directly.

| Endpoint | Purpose |
|---|---|
| `POST /completion` | Generic chat completion. Body: `{ messages, model, temperature, maxTokens, purpose }`. `purpose` is a string tag for the audit log. |
| `POST /embedding` | Vector embedding for RAG indexing |
| `POST /web-search` | Real web search (Brave or Tavily — fixes v1 ROADMAP P0 #2's hallucinating webSearch) |
| `GET /usage` | Per-purpose token/cost rollup for the current month |

**Internal:**
- All prompt templates live in `services/prompts/`. Categorized by `purpose` (e.g., `corridor-ai-note`, `safe-path-justification`, `entity-explanation`).
- Provider routing in `connectors/llm.ts` — switch OpenAI ↔ Claude ↔ local with one env flag.
- Audit log table `ai.prompt_log` records every prompt, response, model, tokens, latency, and `purpose`. Useful for cost analysis and debugging hallucinations.
- Rate limit per `purpose` (e.g., `safe-path-justification` capped at N/min).

**Owns tables:** `ai.prompt_log`, `ai.web_search_cache` (24h TTL keyed by query, mirrors v1 ROADMAP P0 #2 recommendation).

### 7.5 corridor

| Endpoint | Purpose |
|---|---|
| `GET /api/corridors` | List with filters (tier, status, currency) |
| `GET /api/corridors/:id` | Full corridor detail with depth, RAG context |
| `GET /api/corridors/:id/status-history?days=30` | Sparkline data |
| `POST /api/corridors/chat` | RAG chat over corridor data |
| `GET /api/corridors/partner-depth/:actor/:book` | Proxies to market-data, applies caching at the corridor layer too |

**Owns tables:** `corridor.corridors`, `corridor.corridor_status_events`, `corridor.corridor_rag_documents`, `corridor.corridor_rag_chats`, `corridor.corridor_rag_messages`.

**Internal:**
- Catalog seed (the 1264-line `catalog.ts`) is moved to a JSON file under `apps/corridor/seed/` and loaded into the DB on first boot — no longer a hardcoded TS file.
- Scanner runs as a BullMQ worker; pulls live data from market-data; writes status events.
- RAG indexer subscribes to `corridor.refreshed` events to rebuild embeddings.

### 7.6 path

The entity-audit engine. Renamed from "analysis" because the route is `/api/analysis` but the domain concept is "audit a path on-chain."

| Endpoint | Purpose |
|---|---|
| `POST /api/analyze` | Start a BFS analysis (queues a job, returns `analysisId`) |
| `GET /api/analysis/:id` | Status + summary |
| `GET /api/analysis/:id/graph` | Full graph (nodes + edges + risk flags) |
| `GET /api/analysis/:id/explanations` | AI-generated node explanations (calls ai-service) |
| `POST /api/analysis/:id/chat` | RAG chat over the analysis |
| `GET /api/history/:address` | Historical analyses for an address |

**Owns tables:** `path.analyses`, `path.nodes`, `path.edges`, `path.risk_flags`, `path.rag_documents`, `path.rag_chats`, `path.rag_messages`.

**Internal:**
- BullMQ worker for BFS crawls (ported from v1 `bfsOrchestrator.ts`).
- Risk engine (v1 `riskEngine.ts`) ported as `services/risk/` with one file per flag family.
- Graph builder (v1 `graphBuilder.ts` 885 lines) split per node type — `services/graph/issuer.ts`, `services/graph/ammPool.ts`, `services/graph/orderBook.ts`, etc.
- All XRPL reads go through `connectors/marketData.ts`. **No `xrpl.js` import in this service.**

**Publishes events:** `analysis.completed`.

### 7.7 agent

The Safe Path orchestrator. **Has almost no data of its own** — it composes corridor + path + market-data + ai-service into the 9-phase pipeline.

| Endpoint | Purpose |
|---|---|
| `POST /api/safe-path` | Run the agent (SSE stream of phase events, ports v1 behavior) |
| `GET /api/safe-path/history` | User's past runs |
| `GET /api/safe-path/:id` | Single run detail |
| `GET /api/compliance/:id` | Compliance report markdown |
| `GET /api/compliance/:id/pdf` | Signed PDF (P1 #6 from roadmap) |
| `GET /api/compliance/verify?hash=...` | Public PDF verification endpoint |
| `POST /api/chat` | General-purpose RAG chat |

**Owns tables:** `agent.safe_path_runs`.

**Internal:**
- The 9-phase pipeline (v1 `safePathAgent.ts` 1075 lines) split into one file per phase under `services/phases/` — `01-corridor-resolution.ts`, `02-planning.ts`, …, `09-report.ts`.
- Each phase is a pure function that takes context and returns events + updated context.
- The orchestrator is a thin loop in `services/orchestrator.ts` that runs phases in order and emits SSE.
- PDF rendering ported from v1 `pdfRenderer.ts`.

### 7.8 mcp-server

External-facing only. Authenticates with API key, hits Caddy gateway like any other API client. No direct DB access.

## 8. Framework: Fastify

**Choice:** Fastify 5.x with `fastify-type-provider-zod`.

**Rationale:**
- **Schema-first** — Zod schemas in `@corlens/contracts` produce automatic Swagger via `@fastify/swagger` + `@fastify/swagger-ui` mounted at each service's `/docs`.
- **Plugin model is simple DI** — `app.register(prismaPlugin)`, `app.register(authPlugin)`. No NestJS-style decorators, no module graph.
- **End-to-end type safety** — Zod schemas → request validation + response types + OpenAPI + generated client. One source of truth.
- **Mature, fast, large ecosystem.** Hono is fine but younger; Express was ruled too limited; NestJS too complex.
- **Hono's typed RPC (`hc<AppType>()`) is replicated** by the Zod-derived clients in `@corlens/clients` — same DX without framework lock-in.

## 9. Database strategy

**One Postgres 16 instance with pgvector. One schema per service.**

```
postgres
├── identity        users, payment_requests, premium_subscriptions
├── corridor        corridors, corridor_status_events, corridor_rag_*
├── path            analyses, nodes, edges, risk_flags, rag_*
├── agent           safe_path_runs
├── ai              prompt_log, web_search_cache
└── market_data     xrpl_cache_metadata (optional; Redis is primary)
```

**Rules:**
- Each service has its own Prisma client configured with its own schema.
- **No cross-schema joins, ever.** References between services use IDs only — e.g., `agent.safe_path_runs.user_id` references `identity.users.id` but no foreign key is enforced.
- Migrations are per-schema and per-service — running `pnpm --filter identity db:migrate` only touches `identity.*`.
- Splitting to per-service databases later is a connection-string change.

**Redis 7** continues to handle BullMQ queues + the new market-data cache.

## 10. Inter-service communication

### 10.1 Today (HTTP)

Services call each other via typed clients from `@corlens/clients`:

```ts
import { marketDataClient } from "@corlens/clients";
const account = await marketDataClient.getAccountInfo({ address });
```

Generated from `@corlens/contracts` → refactor a Zod schema and every caller breaks at compile time.

### 10.2 Long-running work (BullMQ)

Stays exactly as v1: BullMQ queues per workload (analysis, corridor-refresh, market-data pre-warm). New patterns add new queues. No change to the primitive.

### 10.3 Tomorrow (events)

`@corlens/events` exposes:

```ts
events.publish('payment.confirmed', { userId, txHash, amount });
events.subscribe('payment.confirmed', async (payload) => { ... });
```

**Today the implementation is a noop dispatcher** — `publish` is fire-and-forget into a local in-memory map, `subscribe` registers handlers in the same process. Cross-service events are achieved by a direct HTTP call from publisher to known subscribers (a small registry maps event name → subscribed services).

**Tomorrow** swap the implementation to Redis Streams or RabbitMQ — change one file, restart, no callers touched.

**Migration order for events:** ship the seam in step 1, migrate one event end-to-end (`payment.confirmed` → `user.role_upgraded`) as a validation step late in the build, leave the rest as direct HTTP calls until they actually need to be async.

### 10.4 Service-to-service auth

Internal calls are **not** routed through Caddy — services call each other directly inside the docker network. Two options for trust:

- **Option A (recommended for now):** services share an internal HMAC secret via env. Every internal call signs the request body with the secret; receivers verify. Simple, no PKI.
- **Option B (later):** mTLS via service-mesh sidecars. Overkill until you have multi-tenant or cross-cluster needs.

## 11. Swagger

- Each service mounts `@fastify/swagger` + `@fastify/swagger-ui` at `/docs`.
- Schemas are derived from Zod via `fastify-type-provider-zod` — no manual OpenAPI authoring.
- Caddy serves an aggregated `/docs` page that consumes each service's `/docs/json` and presents them in Swagger UI's multi-spec mode (`urls: [...]`).
- The `mcp-server` package generates its tool definitions from the same Zod schemas so it's always in sync with the API.

## 12. Build order

This is a greenfield rebuild but ~30k LOC of v1 logic must be ported. Doing it as one big bang fails. Suggested order — each step is its own spec + plan + PR.

1. **Foundation (shared packages first).** ✓ Implemented per [`docs/superpowers/plans/2026-05-08-foundation-shared-packages.md`](../plans/2026-05-08-foundation-shared-packages.md).
   - `@corlens/contracts` — initial Zod schemas mirroring v1's API surface.
   - `@corlens/db` — Prisma schemas split by service (carve from v1's `schema.prisma`).
   - `@corlens/events` — interface only, noop implementation.
   - `@corlens/clients` — empty scaffold, will populate as services come online.
   - Root: pnpm workspace, Biome (lint + format), Vitest, tsconfig base, env validation utility.
2. **gateway (Caddy)** — Caddyfile with all routes stubbed to a placeholder, TLS in dev via local CA, docker-compose. ✓ Implemented per [`docs/superpowers/plans/2026-05-08-caddy-gateway.md`](../plans/2026-05-08-caddy-gateway.md). (TLS deferred to step 12 cutover; dev listens plain HTTP on `:8080`. `forward_auth` to identity is wired in step 3 when `/verify` ships.)
3. **identity** — first service, smallest scope. Implement Crossmark SIWE-style verified login (fix v1's flaw). Caddy `forward_auth` wired. ✓ Implemented per [`docs/superpowers/plans/2026-05-08-identity-service.md`](../plans/2026-05-08-identity-service.md). Two-step login (challenge → verify), `/verify` endpoint backs Caddy `forward_auth`, payment polling + atomic confirm publishes `payment.confirmed` and `user.role_upgraded`. 35 tests green.
4. **market-data** — biggest leverage. Port `xrpl/`, `partnerDepth.ts`, the hourly refresh and pre-warm crons. Add Bitstamp + Kraken + Binance fetchers (v1 ROADMAP P0 #3) while the boundary is fresh. ✓ Implemented per [`docs/superpowers/plans/2026-05-08-market-data-service.md`](../plans/2026-05-08-market-data-service.md). 15 XRPL routes, 5 partner-depth actors, Redis cache with per-data-type TTLs, BullMQ pre-warm cron for hot accounts. Hourly corridor-refresh cron stub returns 503 until step 6.
5. **ai-service** — port OpenAI usage + the prompt templates. Replace v1's `webSearch` with Brave or Tavily (P0 #2). ✓ Implemented per [`docs/superpowers/plans/2026-05-08-ai-service.md`](../plans/2026-05-08-ai-service.md). Tavily chosen for web search; PromptLog audit + WebSearchCache live in `ai` schema. 18 tests green.
6. **corridor** — port catalog (move to JSON seed), scanner, RAG. All XRPL calls now go through market-data; all LLM calls go through ai-service. ✓ Implemented per [`docs/superpowers/plans/2026-05-09-corridor-service.md`](../plans/2026-05-09-corridor-service.md). Catalog seeded from JSON; scanner calls market-data; RAG calls ai-service.
7. **path** — port BFS / graph / risk engine. Split `graphBuilder.ts` per node kind. Same external rerouting. ✓ Implemented per [`docs/superpowers/plans/2026-05-09-path-service.md`](../plans/2026-05-09-path-service.md) and Phase C of [`docs/superpowers/plans/2026-05-09-completion-roadmap.md`](../plans/2026-05-09-completion-roadmap.md). 19 risk flags + 21-node graph builder ported from v1; full 17-RPC crawler parity (Phase C.1); BFS depth 2/3 with hub picker + concurrency pool + maxNodes cap (Phase C.2); /api/history/stream SSE port of v1 historyOrchestrator + historyCrawler (Phase C.3).
8. **agent** — port the 9 phases as separate files. The orchestrator becomes a thin loop. ✓ Implemented per [`docs/superpowers/plans/2026-05-09-agent-service.md`](../plans/2026-05-09-agent-service.md) and Phase D of [`docs/superpowers/plans/2026-05-09-completion-roadmap.md`](../plans/2026-05-09-completion-roadmap.md). 9 Phase strategies (one file per phase), thin orchestrator iterating phases as live async generators (Phase D.1+D.2); SafePathRun.riskScore + auditHash columns added (Phase D.5); compliance markdown ported. Open architectural follow-ups: per-hop risk classification + `account-crawled` producer require either a path-service `/risk-engine/evaluate` endpoint or a shared `@corlens/risk` package; `_currency-meta` data set is a slim 10-currency embed pending a `corridor.getCurrencyMeta` API.
9. **web** — port the SPA, regenerate API client from `@corlens/contracts`. Keep Crossmark. ✓ Strategy documented per [`docs/superpowers/plans/2026-05-09-steps-9-12.md`](../plans/2026-05-09-steps-9-12.md). Full v1 → v2 SPA port deferred; v1 web can be repointed at the v2 gateway via VITE_API_BASE.
10. **mcp-server** — regenerate tool defs from `@corlens/contracts`. ✓ Implemented per [`docs/superpowers/plans/2026-05-09-steps-9-12.md`](../plans/2026-05-09-steps-9-12.md). 6 MCP tools wired to v2 gateway (list_corridors, get_corridor, ask_corridor, analyze_address, ask_analysis, run_safe_path); partner-depth tool deferred.
11. **Events validation** — migrate `payment.confirmed` end-to-end through the events package as proof. ✓ Verified: `apps/identity/src/services/payment.service.ts:80` calls `events.publish("payment.confirmed", ...)` via the `@corlens/events` `InMemoryEventBus`. Cross-service `HttpFanoutEventBus` wiring is implemented in the package but not yet activated across services — captured as follow-up.
12. **Cutover** — point `cor-lens.xyz` DNS at v2, retire v1. ✓ In dev: 9/9 v2 containers healthy on `localhost:8080` (gateway), behind which 8 services route (identity:3001, market-data:3002, ai-service:3003, corridor:3004, path:3005, agent:3006, plus postgres + redis). DNS-level cutover is a deployment concern outside this rebuild.

Each step ships a working slice.

## 13. Open questions

- **Wallet auth implementation.** Crossmark supports message signing — we'll use the EIP-4361-equivalent SIWE flow adapted for XRPL (challenge, signature, verification using `xrpl-secret-numbers` or `ripple-keypairs`). Confirm the exact library before step 3.
- **Web search provider.** Brave (2k req/mo free, broad index) vs Tavily (designed for agents, more expensive). Pick before step 5.
- **Frontend monorepo placement.** Stays in `apps/web`. Tailwind config and design tokens port verbatim.
- **Local TLS for `forward_auth`.** Caddy can issue local certs via its internal CA; downstream services accept HTTP from inside the docker network. Confirm in step 2.
- **Where does the corridor catalog seed JSON live?** Inside `apps/corridor/seed/corridors.json`, generated once from v1's `catalog.ts` and committed to the repo.

## 14. Out of scope (explicit non-goals reaffirmed)

- Drizzle migration, EVM chain support, NestJS, Hono, real microservice ops (per-service DB, service mesh), real queue infrastructure for events on day 1, frontend rewrite.

---

*End of design.*
