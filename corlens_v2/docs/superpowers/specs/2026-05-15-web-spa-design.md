# CORLens v2 — Web SPA Design

> Sub-spec #2 in the v2 finalization sequence. Closes Phase F of [completion roadmap](../plans/2026-05-09-completion-roadmap.md) — port the v1 React SPA onto the v2 backend so the dev stack is end-to-end functional. Sits inside the architectural envelope of [2026-05-08-corlens-v2-architecture-design.md](2026-05-08-corlens-v2-architecture-design.md) and respects the dev rules from Phase A (Biome strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, TDD for any non-trivial logic).

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`
**Branch:** `refacto`
**Volume:** ~14 kLOC ported + ~1.5 kLOC of v2-only glue across ~24 commits, multi-session.

---

## 1. Context

After the backend gap-fill (sub-spec #1) closed on 2026-05-12, the v2 backend has full v1 feature parity. The remaining piece for a usable v2 product is the React SPA.

The v1 SPA at [corlens/apps/web/](../../../../corlens/apps/web/) ships ~18 kLOC across 15 routes, 8 fragments, and 20 components on Vite 6 + React 18 + React Router v7 + Tailwind 3 + TanStack Query 5 + ReactFlow 11 + cobe + Three.js. Auth via `@crossmarkio/sdk`. Markdown via react-markdown + remark-gfm. PDF via the agent service. No backend-rendered pages.

The v2 backend introduces three breaking contract changes (versus v1):

1. **Auth is now two-step SIWE** (`POST /api/auth/login/challenge` → `POST /api/auth/login/verify`) replacing v1's unauthenticated `POST /api/auth/connect`.
2. **Some routes renamed for layering hygiene** — `GET /api/analyze/:id/status` → `GET /api/analysis/:id`, `GET /api/corridors/:id/history` → `GET /api/corridors/:id/status-history`, partner-depth query shape, compliance under `/api/compliance/analysis/:id[/pdf]`.
3. **Two endpoints that the v1 SPA's History page consumes are not yet in v2** — `GET /api/safe-path/history` (list runs for the current user) and `GET /api/analyze` (list analyses for the current user).

Sub-specs #3+ (Playwright Phase G, follow-ups like events fan-out activation and `/internal/*` HMAC tightening) depend on this SPA being live so they have a UI surface to exercise.

## 2. Goals

1. **Bring up `apps/web` inside the v2 monorepo** wired to `@corlens/contracts` for end-to-end typed API calls — refactoring a Zod schema breaks the SPA at compile time, as designed in §10 of the architecture spec.
2. **Port every v1 SPA route and feature** verbatim where v2 contracts match, with surgical rewrites where they don't (auth flow, renamed paths).
3. **Single dev entry point** at `http://localhost:8080` (Caddy gateway) — no SPA-only API base URL, no direct service ports in the browser.
4. **Zero cross-service domain code in the SPA** — all logic that touches XRPL / risk / corridor catalog stays in services. The SPA composes only.
5. **Close the two list-endpoint gaps in v2** (`GET /api/safe-path/history`, `GET /api/analyze`) before the SPA needs them.

## 3. Non-goals

- **Redesigning the UI.** v1 visual language (Tailwind tokens, dark XRP-blue palette, Inter font) is ported as-is. A v3 redesign is a separate spec.
- **Rewriting Three.js Landing scenes.** [src/fragments/Landing/scene/](../../../../corlens/apps/web/src/fragments/Landing/scene/) is ported file-by-file with no refactor.
- **Server-side rendering / Next.js.** Stays a Vite static SPA served by Caddy.
- **Removing localStorage JWT.** v1 keeps the JWT in `localStorage["corlens_auth"]`. Same in v2 — moving to httpOnly cookies is a separate hardening spec.
- **Playwright tests.** Phase G; a thin smoke test per page lives here but full E2E is deferred.
- **API key UI changes beyond v1 parity.** v1's Account page already supports generate/revoke/rotate.
- **Migrating the v1 SPA's `@corlens/core` shared package shape into v2.** v2 uses `@corlens/contracts` instead — types are remapped at the API client layer, not by reusing v1's package.

## 4. Architectural decisions

### 4.1 SPA layering inside `apps/web`

```
apps/web/
├── src/
│   ├── api/              Generated/typed HTTP clients per service (consume @corlens/contracts)
│   ├── auth/             Crossmark SIWE flow, JWT storage, useAuth hook
│   ├── routes/           One file per top-level route (lazy-loaded in App.tsx)
│   ├── fragments/        Per-route building blocks (folders mirror v1 layout)
│   ├── components/       Shared UI primitives + feature components
│   ├── hooks/            Cross-route hooks (useSSE, useCorridorAtlas, ...)
│   ├── stores/           Zustand-style stores (just safePathStore for now)
│   ├── lib/              Pure helpers (formatters, color scales)
│   ├── styles/           tailwind.css entry + tokens
│   ├── App.tsx           Route tree
│   ├── main.tsx          Vite entry — mounts QueryClient + Router
│   └── env.ts            Zod-validated import.meta.env reader
├── tests/                Vitest unit + a single Playwright smoke (full E2E in Phase G)
├── public/               Static assets + favicon
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── README.md
```

The folder structure mirrors v1 [corlens/apps/web/src/](../../../../corlens/apps/web/src/) — same `routes/`, `fragments/`, `components/` split — so the per-file port maps one-to-one and code review can compare side-by-side. Only `api/` and `auth/` are restructured.

### 4.2 API client: hand-written typed wrappers, not codegen

v1 hand-rolls a single [client.ts](../../../../corlens/apps/web/src/api/client.ts) (~360 LOC). v2 keeps the hand-written approach but splits per service and consumes Zod types from `@corlens/contracts` directly:

```
apps/web/src/api/
├── identity.ts        login(), verifyLogin(), getProfile(), apiKey(), payment*()
├── corridor.ts        listCorridors(), getCorridor(), getStatusHistory(), getPartnerDepth(), chat()
├── path.ts            startAnalysis(), getAnalysis(), getGraph(), getHistory(), getHistoryStream() (SSE), chat()
├── agent.ts           safePathStream() (SSE), getSafePathRun(), generateCompliance(), getCompliancePdfUrl()
├── ai.ts              (none used by SPA today — placeholder export)
├── client.ts          shared fetchJSON + ApiError + getAuthHeaders
└── index.ts           re-export typed `api` namespace consumed by routes
```

Each module imports Zod types from `@corlens/contracts/<service>` and casts the response in one place (the typed fetch helper). No runtime decoding for happy-path performance — Zod validation lives server-side at the controller boundary. Bad inputs hitting the client are a developer error, not a user-facing risk.

**Why not openapi-typescript / orval / etc.?** v2's services already emit OpenAPI from Zod via `fastify-type-provider-zod`. Codegen would work but adds a build step, a generator config, and a watcher. With ~30 endpoints total, a flat hand-written wrapper is shorter and easier to review. The Zod types are already in `@corlens/contracts` — they're the source of truth either way.

### 4.3 Auth flow: Crossmark challenge/verify

v1 sends `POST /api/auth/connect` with the wallet address alone. v2 requires:

1. `POST /api/auth/login/challenge` with `{ walletAddress }` → `{ challenge, expiresAt }`.
2. Crossmark signs the challenge string client-side via `sdk.signMessage(challenge)`.
3. `POST /api/auth/login/verify` with `{ walletAddress, challenge, signature, publicKey }` → `{ token, user }`.
4. Token stored in `localStorage["corlens_auth"]` (same key as v1) so the `getAuthHeaders` helper from v1 ports verbatim.

The Crossmark UX (popup + user approval) is wrapped in `auth/crossmark.ts` and exposed as one async `connect()` function that does the 3 steps. The `Login` view shows a single button and a status string — no flow visible to the user. Same DX as v1.

### 4.4 SSE handling

v1 uses native `EventSource` for the SafePath stream and for the History stream. v2 keeps this — no third-party SSE lib. A single `useSSE` hook in `hooks/useSSE.ts` wraps the connection with TanStack Query–style status (`idle | connecting | open | error | done`) and a typed event handler taking a Zod-discriminated union from `@corlens/contracts`. The hook handles cleanup on unmount and reconnection on transient error.

### 4.5 State: TanStack Query + Zustand only

Keep v1's pattern: TanStack Query 5 for every server-state read, Zustand (`safePathStore`) for the in-flight SafePath SSE event log. No Redux, no Context-as-store, no Apollo. v1 already had this and it works.

### 4.6 Static asset serving via Caddy

Add a new `web` container (nginx-alpine) to docker-compose that serves the Vite build output. Caddy's catch-all `handle { reverse_proxy web:80 }` already exists at the bottom of the Caddyfile — wire the new container and the routing falls into place.

In dev, Vite dev server runs on the host at `:5173` and proxies `/api/*` to `localhost:8080` (Caddy). One `pnpm --filter @corlens/web dev` command and the SPA hot-reloads against the live backend.

### 4.7 Two-line backend gap close-out (precondition for History/Account pages)

Before SPA work begins, add to v2:

- `GET /api/safe-path` (path: agent service) — paginated list for the current user. Reads X-User-Id from forward_auth.
- `GET /api/analyses` (path: path service) — paginated list for the current user. Already partially served via `/api/auth/profile.analyses`, but a dedicated endpoint with pagination is cleaner and isolates the read.

Both are 1-controller-1-repo-1-test additions, identical pattern to backend gap-fill WI-3 chat retrieval routes.

## 5. Scope (7 work items, ~24 commits)

| WI | Title | Owner | Commits |
|---|---|---|---|
| WI-0 | Backend list-endpoint gap-close (precondition) | agent + path | 1, 2 |
| WI-1 | Workspace scaffold + tooling + Caddy + docker-compose `web` container | web + infra | 3, 4 |
| WI-2 | Typed API client layer + auth/Crossmark + Layout + Navbar | web | 5, 6, 7 |
| WI-3 | Landing route + Three.js scene + scroll views | web | 8, 9 |
| WI-4 | Home + Analyze + GraphView + History routes | web | 10–13 |
| WI-5 | CorridorHealth + CorridorDetail routes + cobe globe + chat bubble + sparkline | web | 14–16 |
| WI-6 | SafePath route + SSE event UI + verdict + ReactFlow path graph + report viewer + PDF download | web | 17–19 |
| WI-7 | Premium + Account + ApiDocs + Chat routes + compliance public verify page | web | 20–22 |
| WI-8 | Caddy cutover + Dockerfile + smoke Playwright + spec milestones | infra | 23, 24 |

## 6. Work item details

### 6.1 WI-0 — Backend list-endpoint gap-close

**Routes.**
- `GET /api/safe-path` — agent service. Auth: JWT. Pagination: `?limit=20&before=<ISO>` cursor. Response: `{ runs: SafePathRunSummary[], nextCursor: string | null }`.
- `GET /api/analyses` — path service. Auth: JWT. Same pagination shape.

**Contracts.** New `SafePathRunSummary` (id, srcCcy, dstCcy, amount, verdict, corridorId?, createdAt) in `packages/contracts/src/agent.ts`. New `AnalysisSummary` in `packages/contracts/src/path.ts`.

**Repos.** Add `listForUser({ userId, limit, before })` to `safe-path-run.repo.ts` and `analysis.repo.ts`.

**Caddy.** Both `/api/safe-path` and `/api/analyses` already match the existing `handle /api/safe-path*` and `handle /api/analyses*` routes; no Caddyfile change.

**Tests (TDD).** One repo test + one controller test per route (cursor pagination, JWT required).

### 6.2 WI-1 — Workspace scaffold

**Files created.**
- `apps/web/package.json` — Vite 6, React 18, RR v7, Tailwind 3, TanStack Query 5, ReactFlow 11, cobe, three, react-markdown, remark-gfm, `@crossmarkio/sdk`, `@corlens/contracts` workspace dep.
- `apps/web/vite.config.ts` — React plugin, `@corlens/contracts` resolved, `/api` proxied to `localhost:8080` in dev, build output to `dist/`.
- `apps/web/tailwind.config.ts` — port v1 tokens verbatim from [corlens/apps/web/tailwind.config.ts](../../../../corlens/apps/web/tailwind.config.ts).
- `apps/web/postcss.config.js`, `apps/web/index.html`, `apps/web/tsconfig.json`, `apps/web/src/styles/tailwind.css`, `apps/web/src/env.ts`, `apps/web/Dockerfile` (nginx-alpine multi-stage).
- `apps/web/biome.json` — extends root config, adds `noConsoleLog: warn`, `useExhaustiveDependencies: error` for hook deps.

**Files modified.**
- `pnpm-workspace.yaml` — already includes `apps/*`.
- Root `tsconfig.base.json` — no change; the web app extends it.
- `biome.json` — already at root; verify the new `apps/web/src` glob is covered.
- `docker-compose.yml` — new `web` service (nginx serving Vite build, exposes 80 internal), plus dependency from `gateway` for healthcheck ordering.
- `Caddyfile` — last `handle { reverse_proxy web:80 }` for SPA fallback.

**Tests.** One vitest smoke that `buildApp()` equivalent doesn't apply here; we add a single `tests/smoke.test.tsx` that renders `<App />` inside a memory router and asserts `<Layout />` mounts.

### 6.3 WI-2 — API client + auth + layout

**Files.**
- `src/api/client.ts` — shared `fetchJSON` + `ApiError` + JWT injection.
- `src/api/{identity,corridor,path,agent,ai}.ts` — typed wrappers, one method per endpoint.
- `src/api/index.ts` — `export const api = { identity, corridor, path, agent }`.
- `src/auth/crossmark.ts` — Crossmark SDK adapter: `signMessage(challenge): Promise<{ signature, publicKey }>`.
- `src/auth/useAuth.ts` — context-less hook reading `localStorage["corlens_auth"]`, exposing `{ user, token, isAuthed, connect, logout }`.
- `src/components/layout/Layout.tsx`, `Navbar.tsx`, `GlobalStarfield.tsx` — ported from v1, ~270 LOC combined.

**Tests.**
- `tests/api/identity.test.ts` — mocked fetch: `connect()` does 3 calls in order, stores token, returns user.
- `tests/auth/useAuth.test.tsx` — render hook in RTL, simulate login then logout, assert localStorage state.

### 6.4 WI-3 — Landing route

The largest single piece by LOC. Three.js scene with 4 scroll views, ~1.8 kLOC across `routes/Landing/`, `fragments/Landing/{scene,content,components}`.

**Port strategy.** File-by-file. The scene rendering code (`scene/createScene.ts`, `scene/cameraTransition.ts`, `scene/sceneConfig.ts`, `scene/sceneTypes.ts`, `scene/scrollViews.ts`) ports verbatim. Content (the static text/feature config files) ports verbatim. Components (`ContentOverlay.tsx`, `ScrollSections.tsx`) port verbatim.

**No tests.** This is presentational. Smoke covered by the Playwright in WI-8.

### 6.5 WI-4 — Home / Analyze / GraphView / History

- **Home.** Stats + features grid + hero — pulls live corridor stats from `corridor.listCorridors()` + analysis count from `auth.getProfile()`.
- **Analyze.** Form (seedAddress, seedLabel, depth) → `path.startAnalysis()` → polls `path.getAnalysis(id)` until done → navigates to `/graph/:id`. Status card mirrors v1.
- **GraphView.** ReactFlow canvas with risk-badged nodes and edge legends. Reads `path.getGraph(id)` + `path.getAnalysis(id).explanations`. AI explanations sidebar fetches `path.getAnalysisExplanations(id)`. Chat drawer via `path.chat(id, msg, chatId?)`.
- **History.** Lists `path.listAnalyses()` + an address-input row that opens a live SSE crawl via `path.openHistoryStream(address, depth)`. Uses `useSSE`.

**Tests.**
- `tests/routes/Analyze.test.tsx` — mocked api, fill form, submit, status polls progress to `done`, expect navigation.
- `tests/hooks/useSSE.test.tsx` — mock EventSource, assert state transitions on `open` / `message` / `error`.

### 6.6 WI-5 — Corridors

- **CorridorHealth.** Atlas grid + filters. cobe globe in the background. Status badges per row.
- **CorridorDetail.** Header + partner-depth panel + status sparkline (`corridor.getStatusHistory(id, 30)`) + RAG chat bubble + routes table.

**Tests.** Render snapshot + filter interaction test.

### 6.7 WI-6 — SafePath

The most complex route — 2046 LOC in v1. UI mirrors the 9-phase SSE event stream.

- Form (srcCcy, dstCcy, amount, maxRiskTolerance) → `agent.safePathStream(...)` → events stream into Zustand `safePathStore`.
- Per-event renderers (`EventRow`, `VerdictBadge`).
- Final verdict card with `path-found | risky | none` + report markdown viewer.
- PDF download button hits `agent.getCompliancePdfUrl(analysisId)`.

**Tests.**
- `tests/stores/safePathStore.test.ts` — dispatch each event kind, assert state.
- `tests/routes/SafePath.test.tsx` — mocked stream of 5 events, assert UI renders verdict.

### 6.8 WI-7 — Premium / Account / ApiDocs / Chat / Compliance verify

- **Premium.** Pricing tiers, `payment.createPaymentRequest()` flow, demo-pay button, status poll.
- **Account.** Profile, subscriptions, analyses list, API key panel (generate / rotate / revoke).
- **ApiDocs.** Static MDX-like page (1.2 kLOC of doc strings in v1) — ports verbatim as a single `.tsx`.
- **Chat.** Lightweight wrapper around `<ChatInterface />` rendered for a given `analysisId`.
- **Compliance verify.** New public route `/verify?hash=…` that hits `agent.verifyCompliance(hash)` and renders a green/red card. Backend already exists.

**Tests.** Account API-key flow happy path.

### 6.9 WI-8 — Cutover + smoke Playwright

- `Dockerfile` for the SPA (Node alpine build stage → nginx alpine runtime stage).
- `Caddyfile` last `handle` block confirms SPA fallback.
- `docker-compose.yml` includes `web`.
- One Playwright test `tests/e2e/smoke.spec.ts` that:
  1. Hits `http://localhost:8080/` → expects Landing visible.
  2. Hits `/corridors` → expects the corridor table to populate from the API.
  3. Hits `/login` → expects "Connect Crossmark" button.
- Spec milestone marks added to architecture spec §12 step 9.

## 7. File map summary

**Created (high level).**
- `apps/web/` — entire new SPA.
- Two backend repo methods + two backend controllers + four backend tests (WI-0).
- One Dockerfile, one nginx config (`apps/web/nginx.conf` if needed).

**Modified.**
- `packages/contracts/src/agent.ts` — add `SafePathRunSummary`, `SafePathRunListResponse`.
- `packages/contracts/src/path.ts` — add `AnalysisSummary`, `AnalysisListResponse`.
- `apps/agent/src/app.ts` — register list controller.
- `apps/path/src/app.ts` — register list controller.
- `packages/clients/src/{agent,path}.client.ts` — list methods.
- `docker-compose.yml` — `web` service.
- `Caddyfile` — last SPA `handle`.
- `pnpm-workspace.yaml` — already covers `apps/*`; no change expected.
- `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md` — milestone mark on §12 step 9.

**Deleted.** None.

## 8. Commits

| # | Message | Files (high level) |
|---|---|---|
| 1 | `feat(v2,agent): GET /api/safe-path list endpoint (paginated, JWT)` | agent controller + repo + contract + test |
| 2 | `feat(v2,path): GET /api/analyses list endpoint (paginated, JWT)` | path controller + repo + contract + test |
| 3 | `feat(v2,web): scaffold @corlens/web (Vite 6 + React 18 + Tailwind 3 + RR v7 + TanStack Query 5)` | apps/web/{package.json, vite.config, tsconfig, index.html, src/main.tsx, src/App.tsx skeleton} |
| 4 | `feat(v2,web): docker-compose + nginx Dockerfile + Caddy SPA fallback` | docker-compose.yml, Caddyfile, apps/web/Dockerfile, apps/web/nginx.conf |
| 5 | `feat(v2,web): typed API client per service (identity/corridor/path/agent)` | src/api/* |
| 6 | `feat(v2,web): Crossmark SIWE flow (challenge/verify) + useAuth` | src/auth/* + tests |
| 7 | `feat(v2,web): Layout + Navbar + GlobalStarfield (v1 port)` | src/components/layout/* |
| 8 | `feat(v2,web): Landing route — Three.js scene + scroll views (v1 port)` | src/routes/Landing/ + src/fragments/Landing/* |
| 9 | `feat(v2,web): Landing content + scene config (v1 port)` | src/fragments/Landing/content/* + scene/sceneConfig.ts |
| 10 | `feat(v2,web): Home route + hero + features grid + stats` | src/routes/Home.tsx + src/fragments/Home/* |
| 11 | `feat(v2,web): Analyze route + status card + presets` | src/routes/Analyze.tsx + src/fragments/Analyze/* + test |
| 12 | `feat(v2,web): GraphView route + ReactFlow + risk legend + chat drawer` | src/routes/GraphView.tsx + src/components/graph/* + src/fragments/GraphView/* |
| 13 | `feat(v2,web): History route + address SSE stream watcher` | src/routes/History.tsx + src/hooks/useSSE.ts + test |
| 14 | `feat(v2,web): CorridorHealth route + filters + cobe globe + corridor card` | src/routes/CorridorHealth.tsx + src/fragments/CorridorHealth/* + src/components/corridors/CorridorGlobe.tsx |
| 15 | `feat(v2,web): CorridorDetail route + partner-depth + sparkline + routes panel` | src/routes/CorridorDetail.tsx + src/fragments/CorridorDetail/* + src/components/corridors/{CorridorStatusSparkline,PartnerDepthBadge}.tsx |
| 16 | `feat(v2,web): corridor RAG chat bubble + CorridorRoutesGraph` | src/components/corridors/CorridorChatBubble.tsx + src/components/graph/CorridorRoutesGraph.tsx |
| 17 | `feat(v2,web): SafePath route — form + SSE event stream UI + safePathStore` | src/routes/SafePath.tsx + src/stores/safePathStore.ts + src/fragments/SafePath/* + test |
| 18 | `feat(v2,web): SafePath verdict + report markdown viewer + PDF download` | src/routes/SafePath.tsx (verdict block) + src/components/compliance/ComplianceReport.tsx |
| 19 | `feat(v2,web): SafePath PathGraph (ReactFlow) + per-node risk badge` | src/components/graph/PathGraph.tsx |
| 20 | `feat(v2,web): Premium route + payment flow + demo-pay` | src/routes/Premium.tsx |
| 21 | `feat(v2,web): Account route + API key panel + subscriptions` | src/routes/Account.tsx |
| 22 | `feat(v2,web): ApiDocs route + Chat route + compliance public verify` | src/routes/{ApiDocs,Chat,ComplianceView}.tsx |
| 23 | `chore(v2,web): nginx config + production build assert + biome sweep` | apps/web/nginx.conf, apps/web/Dockerfile production assertions |
| 24 | `test(v2,web): Playwright smoke + spec milestone marks` | tests/e2e/smoke.spec.ts + architecture spec §12 |

## 9. Per-commit discipline

Every commit MUST:

- Pass `pnpm biome check` clean (root rules + the SPA-specific `useExhaustiveDependencies`).
- Pass `pnpm -r typecheck` clean — strict tsconfig applies to `apps/web` too (`noUncheckedIndexedAccess` makes ReactFlow / cobe code slightly more verbose in spots; that's OK).
- Pass any vitest suite the commit introduces or touches.
- Build clean — `pnpm --filter @corlens/web build` succeeds.
- Spec milestone mark added in §12 of the architecture spec when the relevant build-order bullet closes (step 9).
- No `--no-verify`, no commented-out tests, no `// @ts-ignore` (use `// @ts-expect-error <reason>` if absolutely needed).

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Three.js Landing scene depends on v1-only assets in `corlens/apps/web/public/` | Copy assets to `apps/web/public/` during WI-3 commit. Audit at the start of WI-3. |
| ReactFlow 11 + React 18 + strict mode double-mounts effects in dev — graph view flickers | Already handled in v1 (`useMemo` for nodes/edges keyed by analysis id). Port the memoization. |
| Crossmark SDK in `noUncheckedIndexedAccess` mode forces a lot of optional chaining on the response shape | Wrap the SDK in `auth/crossmark.ts` once with internal asserts; downstream code sees a clean typed surface. |
| The 2 046-line v1 `SafePath.tsx` is too big to port in one commit | Split across commits 17 / 18 / 19 (stream UI, verdict + report, path graph). |
| cobe globe + ReactFlow + Three.js together push the bundle past 1 MB | Vite's per-route lazy() (already in v1 `App.tsx`) keeps initial Landing chunk small. Verify with `vite build --report` in WI-8. |
| Caddy serves cached v1 SPA via the existing v1 deploy — confusing in dev | Dev compose stack runs on `localhost:8080`; v1 stays on `cor-lens.xyz`. Different DNS roots, no overlap. |
| 24 commits in one branch is too long to keep clean — risk of rebase pain | Each WI is independently mergeable; cut sub-PRs (or local merge commits) at WI boundaries if the branch lives more than a few days. |

## 11. Out-of-scope follow-ups (separate sub-specs)

- Phase G — full Playwright E2E coverage (per-page happy paths + error states).
- Move JWT to httpOnly cookie + add CSRF token (security hardening).
- Replace hand-written API clients with codegen from OpenAPI (if cardinality grows past ~60 endpoints).
- Migrate the inter-service event bus past `payment.confirmed` to `HttpFanoutEventBus` for all events (follow-up flagged in architecture §12 step 11).
- Tighten Caddy to block `/internal/*` from public ingress (follow-up flagged in architecture §12 step 8).
- DNS cutover `cor-lens.xyz` → v2.

## 12. References

- [Architecture spec](2026-05-08-corlens-v2-architecture-design.md) — §4 service map, §6 per-service folder structure, §10 inter-service comm, §12 build order step 9.
- [Completion roadmap](../plans/2026-05-09-completion-roadmap.md) — Phase F stack list (the source of the dep set in §6.2).
- [Backend gap-fill sub-spec](2026-05-11-backend-gap-fill-design.md) + [plan](../plans/2026-05-11-backend-gap-fill.md) — pattern used here.
- v1 SPA: [corlens/apps/web/](../../../../corlens/apps/web/) (~18 kLOC).
- v1 API client: [corlens/apps/web/src/api/client.ts](../../../../corlens/apps/web/src/api/client.ts) (canonical endpoint list).

---

*End of design.*
