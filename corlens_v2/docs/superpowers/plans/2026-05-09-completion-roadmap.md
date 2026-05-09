# CORLens v2 — Completion Roadmap (Phases A–G)

> Closes the gap between the current v2 (steps 1–12 shipped at MVP scope) and full v1 feature parity, while applying the strict dev rules captured in the session preamble.

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`

**Total scope:** ~18–20 kLOC. Multiple sessions expected. Phases A–E = backend completion; F–G = frontend SPA + E2E.

---

## Phase A — Strict tooling (Biome + tsconfig + pinning)

### Files
- Create: `biome.json` (root)
- Modify: `tsconfig.base.json`
- Modify: each `apps/*/package.json` (add `lint` + `format` scripts)
- Modify: root `package.json` (add Biome devDep + workspace scripts)
- Modify: `apps/mcp-server/package.json` (pin `@modelcontextprotocol/sdk` to exact version)

### Steps
- [ ] **A1.** Add Biome 1.9.4 to root `package.json` devDependencies. `pnpm install`.
- [ ] **A2.** Write `biome.json` at repo root with: 2-space indent, double quotes, semicolons always, trailing commas all, line width 100, LF endings, `useImportType: error`, `noUnusedImports: error`. Glob ignore `**/dist/**`, `**/node_modules/**`, `**/*.test.ts.snap`.
- [ ] **A3.** Run `pnpm biome check .` → fix every reported issue. Most likely: missing `import type` on type-only imports, unused imports, formatting drift.
- [ ] **A4.** Modify `tsconfig.base.json` to add `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `verbatimModuleSyntax: true`. Run `pnpm -r typecheck`. Fix breakages (typically: `arr[0]` becomes `arr[0] | undefined`, need `?.` or guards).
- [ ] **A5.** Pin `@modelcontextprotocol/sdk` from `^1.12.1` → `1.29.0` (current resolved). Pin any other carets in apps/* (audit grep).
- [ ] **A6.** Add per-app scripts: `"lint": "biome check src tests"`, `"format": "biome format --write src tests"`.
- [ ] **A7.** Commit:
  ```
  chore(v2): biome 1.9 + strict tsconfig (noUncheckedIndexedAccess, noImplicitOverride, verbatimModuleSyntax) + version pinning
  ```

---

## Phase B — Full catalog (2 436 corridors)

### Files
- Create: `corlens_v2/tools/export-corridor-catalog.mjs`
- Modify: `corlens_v2/apps/corridor/seed/corridors.json`

### Steps
- [ ] **B1.** Write `tools/export-corridor-catalog.mjs` that runs against the v1 monolith (it has v1's `assembleCatalog()` accessible via tsx). The script imports `CORRIDOR_CATALOG` from `corlens/apps/server/src/corridors/catalog.ts` (using a tsx loader path) and writes `apps/corridor/seed/corridors.json` with the full 2 436-entry array.
- [ ] **B2.** Run the export. Verify line count + JSON valid + the 5 existing entries (USD-MXN, USD-EUR, EUR-USD, USD-XRP, XRP-USD) still present.
- [ ] **B3.** Re-seed: `docker compose exec postgres psql -U corlens -d corlens -c 'TRUNCATE corridor."Corridor" CASCADE;'` then restart corridor service so `seedIfEmpty()` re-runs.
- [ ] **B4.** Smoke test: `curl -sS http://localhost:8080/api/corridors?limit=10` returns ≥10 entries; total count via `curl http://localhost:3004/api/corridors?limit=500 | jq length` ≈ 2 436.
- [ ] **B5.** Commit:
  ```
  feat(v2,corridor): export full 2436-corridor catalog from v1 assembleCatalog()
  ```

---

## Phase C — Path completion (full crawler + BFS multi-depth + history SSE)

### Files
- Modify: `corlens_v2/apps/path/src/services/crawler.service.ts`
- Modify: `corlens_v2/apps/path/src/services/bfs.service.ts`
- Create: `corlens_v2/apps/path/src/services/hub-picker.service.ts` (extract from v1 `bfsOrchestrator.ts:83-143`)
- Create: `corlens_v2/apps/path/src/services/history.service.ts` (port v1 `historyOrchestrator.ts`)
- Create: `corlens_v2/apps/path/src/services/history-crawler.service.ts` (port v1 `historyCrawler.ts`)
- Create: `corlens_v2/apps/path/src/controllers/history-stream.controller.ts`
- Modify: `corlens_v2/apps/path/src/controllers/history.controller.ts` (already exists for sync)
- Update tests: `crawler.service.test.ts`, `bfs.service.test.ts`, new `hub-picker.test.ts`, `history.service.test.ts`

### Sub-phase C.1 — Crawler 17 RPC parity
- [ ] **C1.1.** TDD: extend `crawler.service.test.ts` with assertions on `lpHolders`, `asks`, `bids`, `paths`, `topAccounts`, `nftOffers` populated from the 17 calls. Use stubbed marketData with realistic shape.
- [ ] **C1.2.** Implement the missing calls in `crawler.service.ts`:
  - `topAccounts`: enrich top 20 trustline holders via parallel `accountInfo` calls (Map keyed by account)
  - `lpHolders`: from AMM pool's `LPTokenBalance` field if `ammPool` present
  - `asks` / `bids` order books: derived from `bookOffers` for primary currency vs XRP
  - `paths`: `pathFind` from seed to seed (sanity probe, returns alternatives)
  - `nftOffers`: `nftBuyOffers` + `nftSellOffers` for top NFTs
- [ ] **C1.3.** Re-run vitest, all 19 risk flags now firing on real crawl.

### Sub-phase C.2 — BFS multi-depth
- [ ] **C2.1.** Extract `pickHubsFromCrawl` into `hub-picker.service.ts` as pure function: takes `CrawlResult`, returns `QueuedHub[]` ranked by reason (heavy, lp_holder, amm_pool).
- [ ] **C2.2.** TDD `hub-picker.test.ts`: empty crawl → empty list; crawl with 3 heavy + 2 LP holders → 5 hubs; ranking is deterministic.
- [ ] **C2.3.** Refactor `bfs.service.ts`: when `depth >= 2`, after the seed crawl, pick top-K hubs (default 8 for depth 2, 20 for depth 3), run a concurrency pool (4 workers, 45s timeout) that crawls each, builds subgraphs, merges with dedup by `node.id`. Enforce `maxNodes: 800` cap. Honor `AbortSignal`.
- [ ] **C2.4.** Update `bfs.service.test.ts`: new test for depth-2 multi-hub flow with mocked crawler.
- [ ] **C2.5.** Update worker (`apps/path/src/workers/analysis.worker.ts`) to honor the depth from the job payload and report `pickedHubs` count via `analyses.setStatus` log.

### Sub-phase C.3 — History SSE stream
- [ ] **C3.1.** Port `historyCrawler.ts` to `history-crawler.service.ts`: light variant (5 parallel RPCs), `crawlFromSeedLight(seed) → CrawlResult` with defaults for unused fields.
- [ ] **C3.2.** Port `historyOrchestrator.ts` to `history.service.ts`: async generator yielding `HistoryEvent` union (seed_ready, node_added, edges_added, crawl_error, done). Concurrency pool (4, 20s timeout).
- [ ] **C3.3.** Add Zod contracts in `packages/contracts/src/path.ts`: `HistoryEvent` discriminated union mirroring the generator's events.
- [ ] **C3.4.** Implement `controllers/history-stream.controller.ts`: `GET /api/history/stream?address=&depth=&maxTx=&sinceDays=` → SSE response. Same shutdown handling as v1 (`res.on("close")`).
- [ ] **C3.5.** Tests: at least one integration test using `app.inject` that verifies the SSE response starts with `data: ` and includes a `seed_ready` line.

### Commits
- [ ] **C-final.** Three commits, one per sub-phase:
  ```
  feat(v2,path): full 17-RPC crawler — populate lpHolders, asks, bids, paths, topAccounts, nftOffers
  feat(v2,path): BFS depth 2/3 with hub picker + concurrency pool + maxNodes cap
  feat(v2,path): history SSE stream (port v1 historyOrchestrator + historyCrawler)
  ```

---

## Phase D — Agent completion (9 phases + PDF + verify + premium)

### Files
- Create: `apps/agent/src/services/phases/01-corridor-resolution.ts`
- Create: `apps/agent/src/services/phases/02-corridor-rag.ts`
- Create: `apps/agent/src/services/phases/03-planning.ts`
- Create: `apps/agent/src/services/phases/04-actor-research.ts`
- Create: `apps/agent/src/services/phases/05-deep-entity-analysis.ts`
- Create: `apps/agent/src/services/phases/06-on-chain-path-find.ts`
- Create: `apps/agent/src/services/phases/07-off-chain-bridge.ts`
- Create: `apps/agent/src/services/phases/08-split-plan.ts`
- Create: `apps/agent/src/services/phases/09-report.ts`
- Create: `apps/agent/src/services/phases/types.ts` (`Phase` interface, `PhaseContext`, `PhaseEvent`)
- Replace: `apps/agent/src/services/orchestrator.service.ts` (thin loop running phases)
- Modify: `packages/contracts/src/agent.ts` (extend `SafePathEvent` discriminated union to ~20 types)
- Create: `apps/agent/src/services/pdf-renderer.service.ts` (port v1 `pdfRenderer.ts`)
- Create: `apps/agent/src/controllers/compliance-pdf.controller.ts` (`GET /api/compliance/:id/pdf`)
- Create: `apps/agent/src/controllers/compliance-verify.controller.ts` (`GET /api/compliance/verify?hash=...`)
- Create: `apps/agent/src/middleware/require-premium.ts` (Fastify preHandler that calls identity)
- Modify: `apps/agent/src/app.ts` (wire all phases + middlewares + new routes)
- Modify: `apps/agent/package.json` (add `pdfkit` 0.15.x)
- Modify: `packages/db/prisma/schema.prisma` (add `riskScore Float?` to `SafePathRun`)

### Sub-phase D.1 — Phases as Strategy pattern
- [ ] **D1.1.** Define `phases/types.ts`:
  ```ts
  export interface Phase {
    readonly name: SafePathPhase;
    run(ctx: PhaseContext, emit: (e: PhaseEvent) => void): Promise<void>;
  }
  export type PhaseContext = {
    input: SafePathRequest;
    state: SharedState;
    deps: { corridor: CorridorClient; path: PathClient; ai: AIServiceClient; marketData: MarketDataClient };
    signal: AbortSignal;
  };
  export type SharedState = {
    corridor: { id: string | null; label: string | null; status: string | null };
    plan: string | null;
    actorResearch: ResearchSnapshot[];
    analyses: { id: string; status: string; stats?: GraphStats }[];
    paths: PathCandidate[];
    rejected: RejectedPath[];
    splitPlan: SplitLeg[] | null;
    verdict: Verdict;
    riskScore: number | null;
    reportMarkdown: string | null;
  };
  ```
- [ ] **D1.2.** Implement each phase as a class implementing `Phase`. One file per phase. Each phase TDD'd with mocked deps.
- [ ] **D1.3.** Replace `orchestrator.service.ts` with a thin loop: `for (const phase of phases) { emit({ kind: "phase-start", phase: phase.name }); try { await phase.run(ctx, emit); } catch (err) { emit({ kind: "error", phase: phase.name, message: ... }); break; } emit({ kind: "phase-complete", phase: phase.name, durationMs }); }`. Final `emit({ kind: "result", verdict: ctx.state.verdict, ... })`.

### Sub-phase D.2 — SSE events parity
- [ ] **D2.1.** Extend `packages/contracts/src/agent.ts` `SafePathEvent` to add: `corridor-rag` (with answer + sources), `analysis-started` (with analysisId), `analysis-complete` (with stats), `analyses-summary` (counts), `web-search` (query + first 3 results), `account-crawled` (address + score), `partner-depth` already exists, `split-plan` already implicitly via `result`, `report` (markdown chunk), `tool-call` / `tool-result` (debugging visibility).
- [ ] **D2.2.** Each phase emits the appropriate events per v1's `safePathAgent.ts` event roster.

### Sub-phase D.3 — PDF rendering
- [ ] **D3.1.** Add `pdfkit` 0.15.0 + `@types/pdfkit` 0.13.0 to `apps/agent/package.json`. `pnpm install`.
- [ ] **D3.2.** Port `pdfRenderer.ts` to `apps/agent/src/services/pdf-renderer.service.ts`. Same input shape (`ComplianceReportData`), same output (`Promise<Buffer>`). Header, risk banner colored by severity, exec summary, Travel Rule fields, sanctions stub, risk flags table, entity breakdown, signature block, audit hash SHA256 footer per page.
- [ ] **D3.3.** Add `apps/agent/src/services/compliance.service.ts` builder: `buildComplianceData(run: SafePathRunRow): ComplianceReportData` — pulls riskFlags from run.resultJson + analysisIds, summarizes for the renderer.
- [ ] **D3.4.** TDD `pdf-renderer.service.test.ts`: assert returned `Buffer.byteLength > 0`, content-type-ish PDF header bytes (`%PDF-`).

### Sub-phase D.4 — Routes & middleware
- [ ] **D4.1.** `compliance-pdf.controller.ts`: `GET /api/compliance/:id/pdf` returns PDF bytes with `content-type: application/pdf` + `content-disposition: attachment; filename="compliance-<id>.pdf"`.
- [ ] **D4.2.** `compliance-verify.controller.ts`: `GET /api/compliance/verify?hash=...` looks up by audit hash (stash hash on `SafePathRun` or recompute from resultJson). Returns `{ valid: true, runId, generatedAt, verdict, srcCcy, dstCcy }` if found, else 404.
- [ ] **D4.3.** `middleware/require-premium.ts`: preHandler that reads `X-User-Id` from forward_auth, fetches `identity:/internal/premium-status?userId=<id>` (HMAC-signed), 402 if not premium. **This requires Phase E HMAC and a new identity endpoint.**
- [ ] **D4.4.** Wire middleware on `POST /api/safe-path` route only.
- [ ] **D4.5.** Caddy update: `handle /api/compliance/verify` stays public; `handle /api/compliance/*/pdf` JWT-required.

### Sub-phase D.5 — Schema migration
- [ ] **D5.1.** Add `riskScore Float?` to `SafePathRun` in `packages/db/prisma/schema.prisma`. Add `auditHash String?` field too (for the verify endpoint).
- [ ] **D5.2.** Run `pnpm --filter @corlens/db prisma db push`.
- [ ] **D5.3.** Update `apps/agent/src/repositories/safe-path-run.repo.ts` to use the new columns directly (drop the resultJson hack).

### Commits
- [ ] **D-final.** Five commits:
  ```
  feat(v2,db): add SafePathRun.riskScore + auditHash columns
  feat(v2,agent): split orchestrator into 9 Phase strategies (one file per phase)
  feat(v2,agent): full SSE event roster (corridor-rag, web-search, account-crawled, ...)
  feat(v2,agent): PDF compliance rendering via pdfkit + audit hash footer
  feat(v2,agent): compliance verify endpoint + require-premium middleware
  ```

---

## Phase E — Inter-service security & events

### Files
- Modify: every connector (`apps/*/src/connectors/*.ts`)
- Modify: `apps/identity/src/app.ts` (replace `InMemoryEventBus` with `HttpFanoutEventBus`)
- Modify: `apps/ai-service/src/app.ts` and `apps/agent/src/app.ts` (subscribe to `payment.confirmed`)
- Create: `apps/identity/src/controllers/internal.controller.ts` (`GET /internal/premium-status?userId=...` HMAC-protected)
- Modify: `Caddyfile` (block `/internal/*` from public access)

### Steps
- [ ] **E1.** Activate HMAC headers in every cross-service connector. Wrap each connector's HTTP call in a `Decorator` that signs requests using `@corlens/clients/hmac`:
  - Header `x-corlens-ts` = current ISO timestamp
  - Header `x-corlens-sig` = HMAC-SHA256(`${ts}|${method}|${path}|${bodyHash}`, INTERNAL_HMAC_SECRET)
- [ ] **E2.** Add HMAC verification middleware to every service (Fastify preHandler that runs on routes flagged `internal: true` in the schema). 401 on missing/invalid signature. `timingSafeEqual` for the comparison.
- [ ] **E3.** Replace `InMemoryEventBus` in identity with `HttpFanoutEventBus({ subscribers: [{ url: "http://ai-service:3003/events/payment.confirmed", secret }, { url: "http://agent:3006/events/payment.confirmed", secret }] })`.
- [ ] **E4.** Add `/events/<event-name>` HMAC-protected endpoint in ai-service + agent that records the event (subscribers for now just log).
- [ ] **E5.** Create `apps/identity/src/controllers/internal.controller.ts` with `GET /internal/premium-status` returning `{ isPremium: boolean, expiresAt?: ISO }` from the user's `PremiumSubscription` row.
- [ ] **E6.** Add Caddy rule blocking `/internal/*` from `:8080` (return 404). Internal traffic uses container hostnames directly.

### Commits
- [ ] **E-final.** Three commits:
  ```
  feat(v2): activate HMAC headers + verification on all inter-service connectors
  feat(v2,identity): /internal/premium-status endpoint (HMAC-protected)
  feat(v2): switch identity to HttpFanoutEventBus + ai-service/agent subscribers
  ```

---

## Phase F — Web SPA

(Out of scope for current session — separate roadmap.)

Stack to install : Vite 5 + React 18 + React Router v7 + Tailwind 3 + Radix UI + ReactFlow 11 + cobe + Crossmark SDK + TanStack Query 5 + Playwright.

Pages : Home (cobe globe), Atlas (corridor list + filters + status badges), Corridor detail (AI note, partner depth, status sparkline, RAG chat), Analyze (form + polling + ReactFlow graph viz with risk badge per node + AI explanations + RAG chat), History (per-address list + SSE stream watcher), Safe Path (form + SSE event stream UI + verdict + report markdown viewer + PDF download), Compliance public verify, Profile (Crossmark wallet + API key gen), Login.

Volume estimated 12 kLOC. Tests via Playwright covering all happy paths.

---

## Phase G — Playwright E2E + final cutover

(Out of scope for current session — depends on Phase F.)

---

## Self-review at end of each phase

- All Biome checks clean.
- All typechecks clean.
- All vitest suites pass.
- New endpoints documented in OpenAPI (auto via Zod schemas).
- Spec milestone updated for the relevant build-order bullet.

---

*End of roadmap.*
