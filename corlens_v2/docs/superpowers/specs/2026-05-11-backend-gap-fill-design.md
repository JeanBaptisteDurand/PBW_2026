# CORLens v2 — Backend Gap-Fill Design

> Sub-spec #1 in the v2 finalization sequence. Closes the v1↔v2 parity gaps that the Web SPA (Phase F) will depend on, while staying inside the architectural envelope of [2026-05-08-corlens-v2-architecture-design.md](2026-05-08-corlens-v2-architecture-design.md) and respecting the dev rules from Phase A (Biome strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, TDD).

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`
**Branch:** `refacto`
**Volume:** ~2 kLOC across 9 commits, single-session-able.

---

## 1. Context

The v1↔v2 parity audit identifies the following gaps after Phases A–E shipped:

- **Risk classification per hop** is missing in the agent. v2 currently emits a synthetic `riskScore` derived from hop-count + corridor status. The `account-crawled` SafePath event kind exists in the contract but has no producer.
- **Currency catalog** is stubbed. `apps/agent/src/data/currency-meta.ts` holds 10 currencies and ~9 with actors. v1 ships ~50 currencies with full actor metadata in `corlens/apps/server/src/corridors/catalog.ts`.
- **5 endpoints** that exist in v1 are not in v2: 3 entity-compliance routes + 2 chat retrieval routes (analysis + corridor).
- **MCP server** ships 6 of v1's 7 tools — `get_partner_depth` is missing.

`POST /api/corridor` (legacy single-corridor analyzer) and `POST /api/permissioned-domain/seed` (pitch-time hardcoded seeder) are intentionally **not** ported. They are redundant or non-product.

Sub-specs #2+ (web SPA Phase F, Playwright Phase G) depend on this gap-fill — a frozen v2 API surface is a precondition for porting the frontend.

## 2. Goals

1. **Risk-engine reachable from the agent over HTTP.** Per-hop classification on every path-find result, producing `account-crawled` SSE events.
2. **Currency catalog owned by the corridor service**, served via a stable read endpoint, consumed by both the agent and (eventually) the SPA.
3. **5 missing endpoints** wired with the same Fastify + Zod conventions as the rest of v2, no schema migrations beyond a single `CurrencyMeta` table.
4. **MCP feature parity** with v1.
5. **Zero shared domain code** between services. All cross-service flow stays HTTP-first, HMAC-signed (Phase E middleware).

## 3. Non-goals

- Refactoring `apps/mcp-server/src/index.ts` into a `tools/` directory.
- Verify endpoint for entity compliance (`/api/compliance/verify` stays SafePath-only).
- Persisting entity compliance reports (recomputed on every request).
- Migrating SafePath compliance routes to `/api/compliance/safe-path/:id` for symmetry.
- Replacing HTTP risk-engine with BullMQ push or events (future work).
- Phase F (Web SPA) and Phase G (Playwright).

## 4. Architectural decisions

### 4.1 Risk-engine: HTTP endpoint, not shared package

The risk-engine is a pure function in `apps/path/src/domain/risk-engine.ts:25` (`computeRiskFlags(crawl, seed)`) but takes a full `CrawlResult`. The agent does not own crawl data, so a "shared pure function" doesn't help — the call site needs the crawl anyway.

Path service exposes `POST /api/risk-engine/quick-eval` that does both (lite crawl + risk-eval) behind one call. The agent calls it per hop. This:

- Honors §10 of the architecture spec (HTTP today, BullMQ tomorrow, events later).
- Keeps the rule definitions (XLS-73, XLS-77, freeze masks) single-source-of-truth in path service.
- Makes the eventual event-driven migration a connector swap (HTTP → queue producer) without touching the agent's logic.

A shared `@corlens/risk` package was rejected because it forces lockstep version bumps across services on every rule change and contradicts §3 ("not a real microservice mesh, but services are independently deployable").

### 4.2 Currency catalog: corridor service + endpoint

Same pattern as the 2 436-corridor catalog (Phase B). The catalog is corridor-domain reference data, owned by the corridor service, served via HTTP. Agent calls via `CorridorClient`, no shared package, no second source of truth.

Endpoint is **public** (no HMAC) — the future SPA atlas/corridor-detail pages will consume the same data; rounding it behind HMAC would force a thin proxy in the gateway.

### 4.3 Entity compliance: agent service, new namespace

The `pdf-renderer.service.ts` + `compliance.service.ts` from Phase D.3 already live in the agent. Reusing them in-place keeps the rendering pipeline single-implementation.

New routes are namespaced under `/api/compliance/analysis/:id` to avoid colliding with the Phase D safe-path routes at `/api/compliance/:safePathRunId`. No refactor of the existing safe-path routes.

### 4.4 Chat retrieval: extend existing controllers

`RagChat` / `RagMessage` (path schema) and `CorridorRagChat` / `CorridorRagMessage` (corridor schema) already exist. The POST chat controllers already exist and persist via the rag repos. Adding GET is one route per service + one repo method.

## 5. Scope (4 work items, 9 commits)

| WI | Title | Services touched | Commits |
|---|---|---|---|
| WI-1 | Full currency catalog | corridor (data + endpoint), agent (consumer) | 1, 2, 3 |
| WI-2 | Risk-engine endpoint + agent per-hop | path (endpoint), agent (Phase 4 + Phase 5 producers) | 4, 5 |
| WI-3 | 5 endpoints | agent (3), path (1), corridor (1) | 6, 7, 8 |
| WI-4 | MCP `get_partner_depth` | mcp-server | 9 |

## 6. Work item details

### 6.1 WI-1 — Full currency catalog

**Source.** v1 [corlens/apps/server/src/corridors/catalog.ts](../../../../corlens/apps/server/src/corridors/catalog.ts) exposes:

- `ISSUERS_BY_CURRENCY: Record<string, IssuerEntry[]>` — XRPL r-addresses that issue an IOU for a given fiat (~12 currencies).
- `ACTORS_BY_CURRENCY: Record<string, CorridorActor[]>` — off-chain entities supporting a given fiat (~50 currencies).
- `GLOBAL_HUB_ACTORS: CorridorActor[]` — 4 pan-regional hubs applicable to all corridors.

**Schema (1 migration).**

```prisma
// packages/db/prisma/schema.prisma — corridor schema
model CurrencyMeta {
  code      String   @id              // "USD", "EUR", "MXN"...
  issuers   Json                      // IssuerEntry[]
  actors    Json                      // ActorEntry[]
  updatedAt DateTime @updatedAt
  @@schema("corridor")
}
```

`GLOBAL_HUB_ACTORS` stays out of the DB — kept as a static JSON in the seed file and loaded into memory at boot.

**Export tooling.**

- `corlens_v2/tools/export-currency-meta.mjs` — tsx script that imports v1 `catalog.ts`, transforms `ISSUERS_BY_CURRENCY` + `ACTORS_BY_CURRENCY` into `{ currencies: [{ code, issuers, actors }], globalHubs: ActorEntry[] }`, writes `apps/corridor/seed/currency-meta.json`. Mirrors Phase B's `export-corridor-catalog.mjs`.
- `apps/corridor/seed/currency-meta.json` — output committed to the repo.

**Seed.**

- Extend `apps/corridor/src/services/seed.service.ts:seedIfEmpty()` to also seed `CurrencyMeta` rows from the JSON when the table is empty. Idempotent.

**Endpoints (corridor service, public).**

- `GET /api/corridors/currency-meta` → `{ currencies: CurrencyMeta[], globalHubs: ActorEntry[] }`
- `GET /api/corridors/currency-meta/:code` → `CurrencyMeta` or 404
- `Cache-Control: public, max-age=300` on both (quasi-static data).

**Contracts.**

- `packages/contracts/src/corridor.ts`: `IssuerEntry`, `ActorEntry`, `CurrencyMeta`, `CurrencyMetaResponse`, `CurrencyMetaListResponse` (Zod).

**Client.**

- `packages/clients/src/corridor.client.ts`: `getCurrencyMeta(code)`, `listCurrencyMeta()`.

**Agent migration.**

- Phase 1 (`apps/agent/src/services/phases/01-corridor-resolution.ts`) fetches `corridorClient.getCurrencyMeta(src)` + `getCurrencyMeta(dst)` in parallel. Result stored in `PhaseContext.state.currencyMeta = { src, dst, globalHubs }`.
- Other phases (`06`, `07`, `09`) read `ctx.state.currencyMeta` — no further fetch.
- `apps/agent/src/data/currency-meta.ts` deleted once all callsites migrated.

**Tests (TDD).**

- `apps/corridor/tests/currency-meta.service.test.ts` — `seedIfEmpty()` populates from JSON; `getByCode` returns expected shape; unknown code → null.
- `apps/corridor/tests/currency-meta.controller.test.ts` — `app.inject` GET list (200 + N entries), GET by code (200 + 404).
- `apps/agent/tests/phases/01-corridor-resolution.test.ts` — extend: assert `corridorClient.getCurrencyMeta` called for both currencies; actors traverse to Phase 3 ctx.

### 6.2 WI-2 — Risk-engine endpoint + agent per-hop

**Endpoint (path service, internal/HMAC).**

- `POST /api/risk-engine/quick-eval`
- Request: `{ address: string }` (Zod: XRPL r-address regex)
- Response: `{ address, score: number, flags: RiskFlagData[], summary: { isIssuer, trustLineCount, hasAmmPool } }`
- `internal: true` — HMAC verification middleware from Phase E.

**Service.**

- `apps/path/src/services/quick-eval.service.ts`:
  - Calls `historyCrawler.crawlFromSeedLight(address)` (5 parallel RPCs — `accountInfo`, `accountLines`, `accountObjects`, `bookOffers ×2`). Already implemented for Phase C.3 history SSE.
  - Calls `riskEngine.computeRiskFlags(crawl, address)`.
  - Computes weighted score: `HIGH=30, MED=15, LOW=5`, capped at 100.
  - Returns `{ address, score, flags, summary }`.
- LRU cache (30s TTL, max 256 entries) keyed by address — prevents flooding when the same issuer appears in multiple paths during one safe-path run.

**Controller.**

- `apps/path/src/controllers/risk-engine.controller.ts` — registers the route with the HMAC preHandler.

**Contracts.**

- `packages/contracts/src/path.ts`: `RiskQuickEvalRequest`, `RiskQuickEvalResponse`. Reuses the existing `RiskFlag` Zod schema.

**Client.**

- `packages/clients/src/path.client.ts`: `quickEvalRisk(address)`. HMAC signing inherited from base client (Phase E).

**Agent — Phase 5 producer (path-find).**

`apps/agent/src/services/phases/06-on-chain-path-find.ts`:

1. After `marketData.pathFind()` returns paths, for each path:
   - `Promise.all(hops.map(h => pathClient.quickEvalRisk(h.address)))` with concurrency pool of 4.
   - For each hop: `emit({ kind: "account-crawled", address, score, flags })`.
2. Aggregate `pathRiskScore = max(scores)` per path.
3. Reject the path if `pathRiskScore > tolerance` (configurable; default 60 = HIGH cap).
4. Replace synthetic `riskScore` on `SafePathRun` with `max(pathRiskScore)` across accepted paths.

**Agent — Phase 4 producer (deep entity analysis).**

`apps/agent/src/services/phases/05-deep-entity-analysis.ts`:

- When path analysis completes, summaryJson contains `riskFlags` grouped by address.
- Emit `account-crawled` once per distinct address with `{ address, score, flags }` derived from summaryJson — no extra HTTP call.

**Schema.** No change. `SafePathRun.riskScore` is already nullable from Phase D.5.

**Tests (TDD).**

- `apps/path/tests/quick-eval.service.test.ts` — 3 fixtures (clean, frozen, AMM clawback-enabled). Assert flags + score for each.
- `apps/path/tests/risk-engine.controller.test.ts` — `app.inject` POST without HMAC → 401; with HMAC → 200 with response shape.
- `apps/agent/tests/phases/06-on-chain-path-find.test.ts` — mock pathClient: N-hop path → `account-crawled` emitted N times + max-score aggregation correct.
- `apps/agent/tests/phases/05-deep-entity-analysis.test.ts` — extend: assert `account-crawled` emitted per address in summaryJson riskFlags.

### 6.3 WI-3 — 5 endpoints

#### A. Entity compliance (agent service, 3 routes)

**Controller.** `apps/agent/src/controllers/compliance-analysis.controller.ts` (new file, separate from the SafePath `compliance.controller.ts`):

| Method | Path | Auth | Response |
|---|---|---|---|
| `POST` | `/api/compliance/analysis/:id` | JWT | `{ markdown, auditHash }` — body optional `{ travelRule?, sanctionsCheck? }` |
| `GET` | `/api/compliance/analysis/:id` | JWT | `{ markdown, auditHash }` (idempotent recompute) |
| `GET` | `/api/compliance/analysis/:id/pdf` | JWT + `require-premium` | PDF bytes, `Content-Disposition: attachment; filename="compliance-analysis-<id>.pdf"` |

**Service.** `apps/agent/src/services/compliance-analysis.service.ts`:

- `build(analysisId): Promise<{ markdown, auditHash, data }>`
- Calls `pathClient.getAnalysis(id)` (already exposed via `analysis.controller.ts`) and `pathClient.getAnalysisRiskFlags(id)` (**new** PathClient method, extracts riskFlags from summaryJson).
- Transforms into `ComplianceReportData` (the Phase D.3 shape — reused as-is).
- Audit hash = SHA256 of canonical JSON of the report data.
- Renders markdown via `pdf-renderer.service.ts:renderMarkdown`, PDF via `renderPdf`.

**Persistence.** None. Recomputed on every call. If caching is needed later, add Redis — explicitly out of scope here.

**Caddy.** Add `handle /api/compliance/analysis/*` rule routing to agent service with JWT `forward_auth`.

#### B. Chat retrieval (2 routes)

**Path service** — extend `apps/path/src/controllers/chat.controller.ts`:

```ts
typed.get(
  "/api/analysis/:id/chat",
  {
    schema: {
      params: z.object({ id: z.string().uuid() }),
      response: { 200: pp.ChatHistoryResponse, 404: pp.ErrorResponse },
    },
  },
  async (req) => chat.getLatestForAnalysis(req.params.id),
);
```

- `ragRepo.findLatestChatByAnalysisId(analysisId)` → 404 if none.
- Returns `{ chatId, analysisId, messages: [{ role, content, sources, createdAt }] }`.

**Corridor service** — extend `apps/corridor/src/controllers/chat.controller.ts`:

```ts
typed.get(
  "/api/corridors/chat/:chatId",
  {
    schema: {
      params: z.object({ chatId: z.string().uuid() }),
      response: { 200: cc.ChatHistoryResponse, 404: cc.ErrorResponse },
    },
  },
  async (req) => chat.getById(req.params.chatId),
);
```

- `corridorRagRepo.findChatById(chatId)` → 404 if none.
- Auth: public (matches the POST corridor chat route).

**Repos (new methods).**

- `apps/path/src/repositories/rag.repo.ts`: `findLatestChatByAnalysisId(analysisId): Promise<{ chat, messages } | null>`.
- `apps/corridor/src/repositories/rag.repo.ts`: `findChatById(chatId): Promise<{ chat, messages } | null>`.

**Contracts.**

- `packages/contracts/src/path.ts`: `ChatHistoryResponse = { chatId, analysisId, messages: ChatMessage[] }`.
- `packages/contracts/src/corridor.ts`: `ChatHistoryResponse = { chatId, corridorId, messages: ChatMessage[] }`.

**Tests (TDD).**

- `apps/agent/tests/compliance-analysis.service.test.ts` — mocked PathClient → markdown contains expected sections; audit hash stable across calls with same input.
- `apps/agent/tests/compliance-analysis.controller.test.ts` — `app.inject` POST 200 / 404 / PDF 402 if not premium.
- `apps/path/tests/chat-retrieval.controller.test.ts` — seed `RagChat` + 3 messages → GET returns in `createdAt` ASC order.
- `apps/corridor/tests/chat-retrieval.controller.test.ts` — same pattern, corridor schema.

### 6.4 WI-4 — MCP `get_partner_depth`

- `apps/mcp-server/src/index.ts` — append a 7th `server.tool("get_partner_depth", ...)` registration.
- Args (Zod): `{ base: string, quote: string }`.
- Body: instantiate `MarketDataClient`, call `getPartnerDepth(base, quote)`, return `{ venues: [{ venue, depthAsk, depthBid, spreadBps, asOf }] }`.
- ~30 LOC. Single-file structure preserved.

**Tests (TDD).**

- `apps/mcp-server/tests/get-partner-depth.test.ts` — mock fetch on the market-data endpoint, assert tool returns expected shape.

## 7. File map

### Created

- `corlens_v2/tools/export-currency-meta.mjs`
- `apps/corridor/seed/currency-meta.json`
- `apps/corridor/src/services/currency-meta.service.ts`
- `apps/corridor/src/repositories/currency-meta.repo.ts`
- `apps/corridor/src/controllers/currency-meta.controller.ts`
- `apps/corridor/tests/currency-meta.service.test.ts`
- `apps/corridor/tests/currency-meta.controller.test.ts`
- `apps/corridor/tests/chat-retrieval.controller.test.ts`
- `apps/path/src/services/quick-eval.service.ts`
- `apps/path/src/controllers/risk-engine.controller.ts`
- `apps/path/tests/quick-eval.service.test.ts`
- `apps/path/tests/risk-engine.controller.test.ts`
- `apps/path/tests/chat-retrieval.controller.test.ts`
- `apps/agent/src/services/compliance-analysis.service.ts`
- `apps/agent/src/controllers/compliance-analysis.controller.ts`
- `apps/agent/tests/compliance-analysis.service.test.ts`
- `apps/agent/tests/compliance-analysis.controller.test.ts`
- `apps/agent/tests/phases/06-on-chain-path-find.test.ts` (or extended)
- `apps/mcp-server/tests/get-partner-depth.test.ts`

### Modified

- `packages/db/prisma/schema.prisma` — add `CurrencyMeta`
- `packages/contracts/src/corridor.ts` — `IssuerEntry`, `ActorEntry`, `CurrencyMeta`, `CurrencyMetaResponse`, `CurrencyMetaListResponse`, `ChatHistoryResponse`
- `packages/contracts/src/path.ts` — `RiskQuickEvalRequest`, `RiskQuickEvalResponse`, `ChatHistoryResponse`
- `packages/contracts/src/agent.ts` — confirm `SafePathEvent` discriminated union includes `account-crawled` shape `{ kind, address, score, flags }`
- `packages/clients/src/corridor.client.ts` — `getCurrencyMeta`, `listCurrencyMeta`
- `packages/clients/src/path.client.ts` — `quickEvalRisk`, `getAnalysisRiskFlags`
- `apps/corridor/src/services/seed.service.ts` — seed `CurrencyMeta`
- `apps/corridor/src/app.ts` — register `currency-meta.controller`
- `apps/corridor/src/controllers/chat.controller.ts` — add GET
- `apps/corridor/src/repositories/rag.repo.ts` — `findChatById`
- `apps/path/src/app.ts` — register `risk-engine.controller`
- `apps/path/src/controllers/chat.controller.ts` — add GET
- `apps/path/src/repositories/rag.repo.ts` — `findLatestChatByAnalysisId`
- `apps/agent/src/app.ts` — register `compliance-analysis.controller`
- `apps/agent/src/services/phases/01-corridor-resolution.ts` — call `CorridorClient.getCurrencyMeta`
- `apps/agent/src/services/phases/05-deep-entity-analysis.ts` — emit `account-crawled` per address
- `apps/agent/src/services/phases/06-on-chain-path-find.ts` — per-hop quick-eval + `account-crawled` + max-score aggregation
- `apps/agent/src/services/phases/07-off-chain-bridge.ts`, `09-report.ts` — migrate remaining `currency-meta.ts` references to `ctx.state.currencyMeta`
- `apps/mcp-server/src/index.ts` — add `get_partner_depth` tool
- `Caddyfile` — `handle /api/compliance/analysis/*` with JWT `forward_auth`
- `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md` — milestone marks on §12 build-order checklist

### Deleted

- `apps/agent/src/data/currency-meta.ts` (after Phase 1 migration is verified)

## 8. Commits

| # | Message | Files (high level) |
|---|---|---|
| 1 | `feat(v2,db): add corridor.CurrencyMeta table` | `packages/db/prisma/schema.prisma`, generated client |
| 2 | `feat(v2,corridor): currency-meta seed (50 currencies) + GET /api/corridors/currency-meta endpoints` | corridor seed + service + repo + controller + tests + contracts + client |
| 3 | `refactor(v2,agent): replace local currency-meta.ts with CorridorClient.getCurrencyMeta()` | agent phases 01/07/09 + delete `data/currency-meta.ts` + tests |
| 4 | `feat(v2,path): expose risk-engine via POST /api/risk-engine/quick-eval (HMAC-protected)` | path quick-eval service + controller + tests + contracts + client |
| 5 | `feat(v2,agent): per-hop risk classification in Phase 5 + account-crawled events in Phase 4 & 5` | agent phases 05/06 + tests + SafePathEvent contract |
| 6 | `feat(v2,agent): entity-compliance endpoints (POST + GET md + GET pdf) on /api/compliance/analysis/:id` | agent compliance-analysis service + controller + tests + Caddyfile |
| 7 | `feat(v2,path): GET /api/analysis/:id/chat retrieval` | path chat controller + rag repo + tests + contracts |
| 8 | `feat(v2,corridor): GET /api/corridors/chat/:chatId retrieval` | corridor chat controller + rag repo + tests + contracts |
| 9 | `feat(v2,mcp): get_partner_depth tool (7th MCP tool)` | mcp-server index + tests |

## 9. Per-commit discipline

Every commit MUST:

- Pass `pnpm biome check` clean (strict Phase A rules: `useImportType: error`, `noUnusedImports: error`, 100-col, double-quote, semicolons-always).
- Pass `pnpm -r typecheck` clean (`noUncheckedIndexedAccess`, `noImplicitOverride`, `verbatimModuleSyntax`).
- Have its Vitest scope green (TDD: red → implement → green, not implement-then-test).
- No `--no-verify`, no skipped hooks, no commented-out tests.
- Spec milestone mark added in §12 of the architecture spec when the relevant build-order bullet is closed.

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| `historyCrawler.crawlFromSeedLight` shape doesn't carry enough fields for the risk-engine | Verify during WI-2 implementation. If gaps, either extend `crawlFromSeedLight` (preferred) or temporarily widen the quick-eval to call `crawler.service.ts:crawlFromSeed` (heavier). Decision happens in the plan, not the spec. |
| LRU cache hides recent on-chain changes (e.g. a freeze landed 10s ago) | 30s TTL is the floor of acceptable staleness for compliance reporting. Document, do not increase. |
| `pathClient.getAnalysisRiskFlags` requires a new path endpoint vs reading existing `getAnalysis` summaryJson | Prefer reading from `getAnalysis().summaryJson.riskFlags` — no new path endpoint. Only add a dedicated endpoint if the shape is ambiguous. |
| Currency-meta endpoint cache (5min) hides a hot-fix to an issuer address | Acceptable. Operator can `docker compose restart corridor` to invalidate. |
| `account-crawled` event volume swamps the SSE channel on wide path-finds | Concurrency pool 4 + dedup by address per run (Set in PhaseContext.state.crawledAddresses). Skip emit if already seen in this run. |

## 11. Out-of-scope follow-ups (separate sub-specs)

- Refactor `mcp-server` into `tools/` directory.
- Verify endpoint for entity compliance (mirror the SafePath verify).
- Persistence + cache for compliance reports.
- Migrate SafePath compliance routes to `/api/compliance/safe-path/:id` for naming symmetry.
- Replace HTTP risk-engine call with BullMQ producer (event-driven Phase X).
- Phase F — Web SPA.
- Phase G — Playwright E2E.

## 12. References

- [Architecture spec](2026-05-08-corlens-v2-architecture-design.md) — §10 (inter-service comm), §3 (non-goals), §12 (build order).
- [Completion roadmap](../plans/2026-05-09-completion-roadmap.md) — Phases A–E (done), F–G (deferred).
- v1 catalog source: `corlens/apps/server/src/corridors/catalog.ts` (1264 LOC).
- v1 risk-engine source: `corlens/apps/server/src/analysis/riskEngine.ts`.
- v2 risk-engine: `corlens_v2/apps/path/src/domain/risk-engine.ts`.

---

*End of design.*
