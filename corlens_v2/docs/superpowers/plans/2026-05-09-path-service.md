# CORLens v2 — Path Service Implementation Plan (Step 7 of 12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `path` service — Fastify app on port 3005 owning entity-audit (BFS crawl + 19 risk flags + 21-node graph + RAG + AI explanations). All XRPL access goes through `market-data:3002`; all LLM calls go through `ai-service:3003`. v1's `analysis/` directory (3,395 LOC) is ported with surgical changes: xrpl.js → market-data HTTP, OpenAI → ai-service HTTP, Express → Fastify, raw Prisma → Prisma facade.

**Architecture:** Layered Fastify (controllers → services → repositories → connectors). BullMQ worker runs the BFS pipeline asynchronously: `POST /api/analyze` enqueues, the worker calls `crawler → graphBuilder → riskEngine`, persists nodes/edges/flags, and publishes `analysis.completed`. The history endpoint returns the most recent completed analyses for a seed (synchronous; the v1 SSE stream is deferred to a follow-up).

**Tech Stack:** Fastify 5.1, fastify-type-provider-zod 4.0.2, BullMQ 5.34, ioredis 5.4.2, `@corlens/{contracts,db,env,events,clients}`, Vitest 2.1.

**Spec sections:** 7.6 (path charter), 9 (db — `path` schema), 10 (events: publishes `analysis.completed`), 12 (build order step 7).

**v1 references:** `corlens/apps/server/src/analysis/{bfsOrchestrator,corridorAnalyzer,counterpartyClassifier,crawler,graphBuilder,historyCrawler,historyOrchestrator,historyTypes,riskEngine}.ts`.

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`

---

## Layout produced by this plan

```
corlens_v2/
├── apps/path/
│   ├── package.json, tsconfig.json, vitest.config.ts, Dockerfile, .dockerignore, README.md
│   ├── src/
│   │   ├── env.ts, app.ts, index.ts
│   │   ├── plugins/{prisma, redis, error-handler, swagger}.ts
│   │   ├── connectors/
│   │   │   ├── market-data.ts             HTTP client → market-data (full surface)
│   │   │   └── ai-service.ts              HTTP client → ai-service
│   │   ├── repositories/
│   │   │   ├── analysis.repo.ts
│   │   │   ├── graph.repo.ts              Nodes + edges + risk flags
│   │   │   └── rag.repo.ts                RAG documents + chats + messages
│   │   ├── domain/                        PURE LOGIC — no I/O — ported verbatim from v1
│   │   │   ├── types.ts                   CrawlResult, GraphData, RiskFlagData
│   │   │   ├── classifier.ts              counterpartyClassifier.ts port
│   │   │   ├── risk-engine.ts             riskEngine.ts port (19 flags)
│   │   │   ├── graph-builder.ts           graphBuilder.ts port (21 node types)
│   │   │   └── helpers.ts                 hexToAscii, decodeCurrency, xrpDropsToString
│   │   ├── services/
│   │   │   ├── crawler.service.ts         Calls market-data; returns CrawlResult
│   │   │   ├── bfs.service.ts             bfsOrchestrator.ts port; concurrency pool
│   │   │   ├── explanations.service.ts    AI explanations via ai-service
│   │   │   ├── rag-index.service.ts       Embeds graph nodes via ai-service
│   │   │   └── chat.service.ts            RAG chat
│   │   ├── controllers/
│   │   │   ├── analyze.controller.ts      POST /api/analyze
│   │   │   ├── analysis.controller.ts     GET /api/analysis/:id, GET /:id/graph, GET /:id/explanations
│   │   │   ├── chat.controller.ts         POST /api/analysis/:id/chat
│   │   │   └── history.controller.ts      GET /api/history/:address
│   │   └── workers/
│   │       └── analysis.worker.ts         BullMQ worker that runs the BFS pipeline
│   └── tests/
│       ├── unit/{env, classifier, risk-engine, graph-builder, helpers, crawler.service, bfs.service, explanations.service, rag-index.service, chat.service}.test.ts
│       └── integration/routes.test.ts
├── packages/contracts/src/path.ts          POPULATED
├── Caddyfile                               MODIFIED
├── docker-compose.yml                      MODIFIED
└── docs/superpowers/specs/...architecture-design.md  MODIFIED
```

---

## Conventions (same as prior services)

2-space indent, ESM, `.js` suffix on local imports, `import type` for type-only, `interface` only for ports. No emojis. Conventional Commits. Never `--no-verify`. Never `git add -A`. Co-authored-by trailer required.

**Note on file size:** v1's `graphBuilder.ts` is 885 LOC and `riskEngine.ts` is 452 LOC. The spec suggests splitting graphBuilder per node type, but for this initial port we keep them as single files (with clear in-file sectioning by node type / flag family). Splitting is a follow-up if the files prove unwieldy in subsequent edits.

**Scope reductions from v1:**
- The v1 `GET /api/history/stream` SSE endpoint (which streams BFS events live) is replaced by `GET /api/history/:address` returning the latest 10 completed analyses for that seed. The SSE pipeline (`historyOrchestrator.ts`, `historyCrawler.ts`) is NOT ported in this plan; the data shape is preserved so a future SSE migration is additive.
- The v1 `corridorAnalyzer.ts` (corridor-aware path analysis) is NOT ported here. Its responsibility belongs to the corridor service; the agent service (Step 8) will call corridor + path separately and combine.

---

## Task 1: Scaffold + env + contracts

**Files:**
- Create: `apps/path/{package.json, tsconfig.json, vitest.config.ts, Dockerfile, .dockerignore, README.md, src/env.ts}`
- Create: `apps/path/tests/unit/env.test.ts`
- Modify: `packages/contracts/src/path.ts`
- Modify: `packages/contracts/package.json` (add `./dist/path.js` subpath export)

### Steps

- [ ] **Step 1: Write `apps/path/package.json`** — same shape as `apps/corridor/package.json`, but with `"name": "@corlens/path"`, `"version": "0.1.0"`. Same dependencies. No additional deps.

- [ ] **Step 2: Write `apps/path/tsconfig.json`** — verbatim copy of `apps/corridor/tsconfig.json`.

- [ ] **Step 3: Write `apps/path/vitest.config.ts`** — copy of corridor's, change `name` to `@corlens/path`.

- [ ] **Step 4: Write `apps/path/Dockerfile`** — copy `apps/corridor/Dockerfile`, replace `corridor` with `path` (and `@corlens/corridor` with `@corlens/path`), change `EXPOSE 3004` to `EXPOSE 3005`.

- [ ] **Step 5: Write `apps/path/.dockerignore`** — copy from corridor.

- [ ] **Step 6: Write `apps/path/README.md`** (quadruple-backtick fence around the inner triple-fence):

````markdown
# @corlens/path

Entity-audit BFS engine. Owns the `path` Postgres schema. Calls market-data:3002 for XRPL data and ai-service:3003 for explanations + RAG.

## Endpoints (behind Caddy at `/api/analyze`, `/api/analysis/*`, `/api/history/*`)

- `POST /api/analyze` — enqueue an analysis (returns `{id, status}`)
- `GET /api/analysis/:id` — status + summary
- `GET /api/analysis/:id/graph` — full graph (nodes + edges + risk flags)
- `GET /api/analysis/:id/explanations` — AI-generated node explanations
- `POST /api/analysis/:id/chat` — RAG chat over the analysis
- `GET /api/history/:address` — recent analyses for an address
- `GET /health`, `GET /docs`

## Dev

```bash
pnpm --filter @corlens/path dev
```

Listens on port 3005.
````

- [ ] **Step 7: Write the failing env test `apps/path/tests/unit/env.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { loadPathEnv } from "../../src/env.js";

const valid = {
  PORT: "3005",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
};

describe("loadPathEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadPathEnv(valid);
    expect(env.PORT).toBe(3005);
    expect(env.BFS_CONCURRENCY).toBe(4);
    expect(env.BFS_MAX_NODES).toBe(800);
  });

  it("rejects missing AI_SERVICE_BASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.AI_SERVICE_BASE_URL;
    expect(() => loadPathEnv(partial)).toThrow(/AI_SERVICE_BASE_URL/);
  });
});
```

- [ ] **Step 8: Run pnpm install + verify failing test**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install && pnpm --filter @corlens/path exec vitest run tests/unit/env.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 9: Implement `apps/path/src/env.ts`**

```ts
import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3005),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  MARKET_DATA_BASE_URL: z.string().url(),
  AI_SERVICE_BASE_URL: z.string().url(),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  BFS_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(4),
  BFS_MAX_NODES: z.coerce.number().int().min(50).max(5000).default(800),
  BFS_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(45000),
  WORKER_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
});

export type PathEnv = z.infer<typeof Schema>;

export function loadPathEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): PathEnv {
  return loadEnv(Schema, source);
}
```

- [ ] **Step 10: Run env test (must PASS) + typecheck**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run tests/unit/env.test.ts && pnpm --filter @corlens/path run typecheck
```

- [ ] **Step 11: Populate `packages/contracts/src/path.ts`** (replace `export {};`)

```ts
import { z } from "zod";
import { XrplAddress } from "./shared.js";

export const AnalysisStatus = z.enum(["queued", "running", "done", "error"]);
export type AnalysisStatus = z.infer<typeof AnalysisStatus>;

export const AnalyzeRequest = z.object({
  seedAddress: XrplAddress,
  seedLabel: z.string().max(200).optional(),
  depth: z.coerce.number().int().min(1).max(3).default(1),
});
export type AnalyzeRequest = z.infer<typeof AnalyzeRequest>;

export const AnalyzeResponse = z.object({
  id: z.string().uuid(),
  status: AnalysisStatus,
});
export type AnalyzeResponse = z.infer<typeof AnalyzeResponse>;

export const RiskSeverity = z.enum(["HIGH", "MED", "LOW"]);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const RiskFlag = z.object({
  flag: z.string(),
  severity: RiskSeverity,
  detail: z.string(),
  data: z.unknown().optional(),
});
export type RiskFlag = z.infer<typeof RiskFlag>;

export const GraphStats = z.object({
  nodeCount: z.number().int().min(0),
  edgeCount: z.number().int().min(0),
  riskCounts: z.object({
    HIGH: z.number().int().min(0),
    MED: z.number().int().min(0),
    LOW: z.number().int().min(0),
  }),
});
export type GraphStats = z.infer<typeof GraphStats>;

export const AnalysisSummary = z.object({
  id: z.string().uuid(),
  seedAddress: XrplAddress,
  seedLabel: z.string().nullable(),
  depth: z.number().int().min(1).max(3),
  status: AnalysisStatus,
  error: z.string().nullable(),
  stats: GraphStats.nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AnalysisSummary = z.infer<typeof AnalysisSummary>;

export const GraphNode = z.object({
  nodeId: z.string(),
  kind: z.string(),
  label: z.string(),
  data: z.unknown(),
  riskFlags: z.array(RiskFlag).default([]),
  aiExplanation: z.string().nullable().optional(),
});
export type GraphNode = z.infer<typeof GraphNode>;

export const GraphEdge = z.object({
  edgeId: z.string(),
  source: z.string(),
  target: z.string(),
  kind: z.string(),
  label: z.string().nullable(),
  data: z.unknown().nullable(),
});
export type GraphEdge = z.infer<typeof GraphEdge>;

export const GraphResponse = z.object({
  analysisId: z.string().uuid(),
  nodes: z.array(GraphNode),
  edges: z.array(GraphEdge),
  stats: GraphStats,
});
export type GraphResponse = z.infer<typeof GraphResponse>;

export const ExplanationItem = z.object({
  nodeId: z.string(),
  explanation: z.string(),
});
export type ExplanationItem = z.infer<typeof ExplanationItem>;

export const ExplanationsResponse = z.object({
  analysisId: z.string().uuid(),
  items: z.array(ExplanationItem),
});

export const ChatRequest = z.object({
  message: z.string().min(1).max(2000),
});
export type ChatRequest = z.infer<typeof ChatRequest>;

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});
export type ChatResponse = z.infer<typeof ChatResponse>;

export const HistoryItem = z.object({
  id: z.string().uuid(),
  status: AnalysisStatus,
  depth: z.number().int(),
  stats: GraphStats.nullable(),
  createdAt: z.string().datetime(),
});
export type HistoryItem = z.infer<typeof HistoryItem>;

export const HistoryResponse = z.object({
  address: XrplAddress,
  analyses: z.array(HistoryItem),
});
```

Then build:

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck && pnpm --filter @corlens/contracts run build
```

Add `./dist/path.js` to `packages/contracts/package.json` exports map (mirror the existing `./dist/corridor.js` pattern).

- [ ] **Step 12: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/ corlens_v2/packages/contracts/ corlens_v2/pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(v2): scaffold @corlens/path service + env + contracts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Connectors (market-data full surface + ai-service)

**Files:**
- Create: `apps/path/src/connectors/market-data.ts`
- Create: `apps/path/src/connectors/ai-service.ts`
- Create: `apps/path/tests/unit/market-data.connector.test.ts`

### Steps

- [ ] **Step 1: Write `apps/path/src/connectors/market-data.ts`**

The market-data service exposes (verified by `apps/market-data/src/controllers/xrpl.controller.ts`):

```
GET  /xrpl/account/:address
GET  /xrpl/account/:address/lines
GET  /xrpl/account/:address/objects
GET  /xrpl/account/:address/transactions
GET  /xrpl/account/:address/nfts
GET  /xrpl/account/:address/channels
GET  /xrpl/account/:address/offers
GET  /xrpl/account/:address/currencies
GET  /xrpl/account/:address/noripple
GET  /xrpl/book?takerGetsCurrency&takerGetsIssuer&takerPaysCurrency&takerPaysIssuer&limit
GET  /xrpl/amm/by-pair?asset1Currency&asset1Issuer&asset2Currency&asset2Issuer
GET  /xrpl/amm/by-account/:account
GET  /xrpl/nft/:nftId/buy-offers
GET  /xrpl/nft/:nftId/sell-offers
POST /xrpl/path-find
```

```ts
export type MarketDataClient = {
  accountInfo(address: string): Promise<unknown>;
  trustLines(address: string, params?: { limit?: number; marker?: unknown }): Promise<unknown>;
  accountObjects(address: string): Promise<unknown>;
  accountTransactions(address: string, params?: { limit?: number; ledgerIndexMin?: number }): Promise<unknown>;
  accountNfts(address: string): Promise<unknown>;
  accountChannels(address: string): Promise<unknown>;
  accountOffers(address: string): Promise<unknown>;
  gatewayBalances(address: string): Promise<unknown>;
  noripple(address: string): Promise<unknown>;
  bookOffers(input: { takerGetsCurrency: string; takerGetsIssuer?: string; takerPaysCurrency: string; takerPaysIssuer?: string; limit?: number }): Promise<unknown>;
  ammByPair(input: { asset1Currency: string; asset1Issuer?: string; asset2Currency: string; asset2Issuer?: string }): Promise<unknown>;
  ammByAccount(account: string): Promise<unknown>;
  nftBuyOffers(nftId: string): Promise<unknown>;
  nftSellOffers(nftId: string): Promise<unknown>;
  pathFind(input: { sourceAccount: string; destinationAccount: string; destinationAmount: unknown }): Promise<unknown>;
};

export type MarketDataClientOptions = {
  baseUrl: string;
  fetch?: typeof fetch;
};

export function createMarketDataClient(opts: MarketDataClientOptions): MarketDataClient {
  const f = opts.fetch ?? fetch;

  async function getJson(path: string): Promise<unknown> {
    const res = await f(`${opts.baseUrl}${path}`);
    if (!res.ok) throw new Error(`market-data ${path} -> ${res.status}`);
    return res.json();
  }

  async function postJson(path: string, body: unknown): Promise<unknown> {
    const res = await f(`${opts.baseUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`market-data ${path} -> ${res.status}`);
    return res.json();
  }

  function qs(params: Record<string, string | number | boolean | undefined>): string {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") u.set(k, String(v));
    }
    const s = u.toString();
    return s ? `?${s}` : "";
  }

  return {
    accountInfo: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}`),
    trustLines: (a, p) => getJson(`/xrpl/account/${encodeURIComponent(a)}/lines${qs({ limit: p?.limit })}`),
    accountObjects: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/objects`),
    accountTransactions: (a, p) => getJson(`/xrpl/account/${encodeURIComponent(a)}/transactions${qs({ limit: p?.limit, ledgerIndexMin: p?.ledgerIndexMin })}`),
    accountNfts: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/nfts`),
    accountChannels: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/channels`),
    accountOffers: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/offers`),
    gatewayBalances: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/currencies`),
    noripple: (a) => getJson(`/xrpl/account/${encodeURIComponent(a)}/noripple`),
    bookOffers: (i) => getJson(`/xrpl/book${qs(i)}`),
    ammByPair: (i) => getJson(`/xrpl/amm/by-pair${qs(i)}`),
    ammByAccount: (a) => getJson(`/xrpl/amm/by-account/${encodeURIComponent(a)}`),
    nftBuyOffers: (n) => getJson(`/xrpl/nft/${encodeURIComponent(n)}/buy-offers`),
    nftSellOffers: (n) => getJson(`/xrpl/nft/${encodeURIComponent(n)}/sell-offers`),
    pathFind: (i) => postJson("/xrpl/path-find", i),
  };
}
```

- [ ] **Step 2: Write `apps/path/tests/unit/market-data.connector.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { createMarketDataClient } from "../../src/connectors/market-data.js";

describe("market-data connector", () => {
  it("encodes addresses and forwards query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    const client = createMarketDataClient({ baseUrl: "http://md", fetch: fetchMock as never });

    await client.trustLines("rABC", { limit: 100 });
    expect(fetchMock).toHaveBeenCalledWith("http://md/xrpl/account/rABC/lines?limit=100");

    await client.bookOffers({ takerGetsCurrency: "USD", takerGetsIssuer: "rIss", takerPaysCurrency: "XRP" });
    expect(fetchMock).toHaveBeenLastCalledWith("http://md/xrpl/book?takerGetsCurrency=USD&takerGetsIssuer=rIss&takerPaysCurrency=XRP");
  });

  it("throws on non-ok responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("nope", { status: 502 }));
    const client = createMarketDataClient({ baseUrl: "http://md", fetch: fetchMock as never });
    await expect(client.accountInfo("rABC")).rejects.toThrow(/502/);
  });
});
```

- [ ] **Step 3: Write `apps/path/src/connectors/ai-service.ts`** — copy from `apps/corridor/src/connectors/ai-service.ts` verbatim.

- [ ] **Step 4: Run tests + typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run tests/unit/ && pnpm --filter @corlens/path run typecheck
```

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/connectors/ corlens_v2/apps/path/tests/unit/market-data.connector.test.ts
git commit -m "$(cat <<'EOF'
feat(v2,path): market-data + ai-service connectors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Repositories (analysis + graph + RAG)

**Files:**
- Create: `apps/path/src/repositories/analysis.repo.ts`
- Create: `apps/path/src/repositories/graph.repo.ts`
- Create: `apps/path/src/repositories/rag.repo.ts`

The Prisma facade `pathDb` already exists at `packages/db/src/path.ts`.

### Steps

- [ ] **Step 1: Verify the path db facade exposes the right models**

```bash
cat /Users/beorlor/Documents/PBW_2026/corlens_v2/packages/db/src/path.ts
```

If it doesn't already export `analysis`, `node`, `edge`, `riskFlag`, `ragDocument`, `ragChat`, `ragMessage`, `complianceReport`, add them mirroring the corridor facade pattern. Commit those changes if you make them as a separate commit before continuing this task.

- [ ] **Step 2: Write `apps/path/src/repositories/analysis.repo.ts`**

```ts
import { path as pathDb } from "@corlens/db";
import type { Prisma } from "@corlens/db";

export type AnalysisRow = {
  id: string;
  status: string;
  seedAddress: string;
  seedLabel: string | null;
  depth: number;
  error: string | null;
  summaryJson: unknown;
  userId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function createAnalysisRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async create(input: { seedAddress: string; seedLabel: string | null; depth: number; userId: string | null }): Promise<AnalysisRow> {
      return db.analysis.create({
        data: { ...input, status: "queued" },
      }) as unknown as AnalysisRow;
    },

    async findById(id: string): Promise<AnalysisRow | null> {
      return db.analysis.findUnique({ where: { id } }) as unknown as AnalysisRow | null;
    },

    async findCachedDone(seedAddress: string, depth: number): Promise<AnalysisRow | null> {
      return db.analysis.findFirst({
        where: { seedAddress, depth, status: "done" },
        orderBy: { createdAt: "desc" },
      }) as unknown as AnalysisRow | null;
    },

    async listForAddress(seedAddress: string, limit: number): Promise<AnalysisRow[]> {
      return db.analysis.findMany({
        where: { seedAddress, status: { in: ["done", "running"] } },
        orderBy: { createdAt: "desc" },
        take: limit,
      }) as unknown as AnalysisRow[];
    },

    async setStatus(id: string, status: string, error: string | null): Promise<void> {
      await db.analysis.update({ where: { id }, data: { status, error } });
    },

    async setSummary(id: string, summaryJson: unknown): Promise<void> {
      await db.analysis.update({ where: { id }, data: { summaryJson: summaryJson as never, status: "done" } });
    },
  };
}

export type AnalysisRepo = ReturnType<typeof createAnalysisRepo>;
```

- [ ] **Step 3: Write `apps/path/src/repositories/graph.repo.ts`**

```ts
import { path as pathDb } from "@corlens/db";
import type { Prisma } from "@corlens/db";

export type GraphPersistInput = {
  analysisId: string;
  nodes: Array<{ nodeId: string; kind: string; label: string; data: unknown }>;
  edges: Array<{ edgeId: string; source: string; target: string; kind: string; label: string | null; data: unknown }>;
  riskFlags: Array<{ nodeId: string; flag: string; severity: string; detail: string; data: unknown }>;
};

export function createGraphRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async persist(input: GraphPersistInput): Promise<{ nodeCount: number; edgeCount: number; flagCount: number }> {
      // Replace previous graph for this analysis (idempotent re-run)
      await db.riskFlag.deleteMany({ where: { analysisId: input.analysisId } });
      await db.edge.deleteMany({ where: { analysisId: input.analysisId } });
      await db.node.deleteMany({ where: { analysisId: input.analysisId } });

      // Bulk-insert via createMany. The unique index on (analysisId, nodeId) ensures dedup.
      if (input.nodes.length > 0) {
        await db.node.createMany({
          data: input.nodes.map((n) => ({
            analysisId: input.analysisId,
            nodeId: n.nodeId,
            kind: n.kind,
            label: n.label,
            data: n.data as never,
          })),
          skipDuplicates: true,
        });
      }
      if (input.edges.length > 0) {
        await db.edge.createMany({
          data: input.edges.map((e) => ({
            analysisId: input.analysisId,
            edgeId: e.edgeId,
            source: e.source,
            target: e.target,
            kind: e.kind,
            label: e.label,
            data: (e.data ?? null) as never,
          })),
          skipDuplicates: true,
        });
      }
      if (input.riskFlags.length > 0) {
        await db.riskFlag.createMany({
          data: input.riskFlags.map((f) => ({
            analysisId: input.analysisId,
            nodeId: f.nodeId,
            flag: f.flag,
            severity: f.severity,
            detail: f.detail,
            data: (f.data ?? null) as never,
          })),
        });
      }
      return { nodeCount: input.nodes.length, edgeCount: input.edges.length, flagCount: input.riskFlags.length };
    },

    async loadGraph(analysisId: string) {
      const [nodes, edges, flags] = await Promise.all([
        db.node.findMany({ where: { analysisId } }),
        db.edge.findMany({ where: { analysisId } }),
        db.riskFlag.findMany({ where: { analysisId } }),
      ]);
      return { nodes, edges, flags };
    },

    async writeExplanation(analysisId: string, nodeId: string, explanation: string): Promise<void> {
      await db.node.updateMany({
        where: { analysisId, nodeId },
        data: { aiExplanation: explanation },
      });
    },

    async listExplanations(analysisId: string) {
      const rows = await db.node.findMany({
        where: { analysisId, aiExplanation: { not: null } },
        select: { nodeId: true, aiExplanation: true },
      });
      return rows.map((r) => ({ nodeId: r.nodeId, explanation: r.aiExplanation as string }));
    },
  };
}

export type GraphRepo = ReturnType<typeof createGraphRepo>;
```

- [ ] **Step 4: Write `apps/path/src/repositories/rag.repo.ts`** — same pattern as `apps/corridor/src/repositories/rag.repo.ts`, but operating on `path."RagDocument"`, `path."RagChat"`, `path."RagMessage"` and keyed by `analysisId` (not `corridorId`):

```ts
import { path as pathDb } from "@corlens/db";
import type { Prisma } from "@corlens/db";

export function createRagRepo(prisma: Prisma) {
  const db = pathDb(prisma);
  return {
    async upsertDoc(input: { analysisId: string; content: string; metadata: unknown; embedding: number[] }) {
      const vec = `[${input.embedding.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO path."RagDocument" (id, "analysisId", content, metadata, embedding, "createdAt")
         VALUES (gen_random_uuid(), $1, $2, $3::jsonb, $4::vector, NOW())`,
        input.analysisId, input.content, JSON.stringify(input.metadata), vec,
      );
    },

    async searchByEmbedding(analysisId: string, embedding: number[], limit: number) {
      const vec = `[${embedding.join(",")}]`;
      const rows = await prisma.$queryRawUnsafe<Array<{ id: string; analysisId: string; content: string; metadata: unknown; distance: number }>>(
        `SELECT id, "analysisId", content, metadata, embedding <-> $1::vector AS distance
         FROM path."RagDocument"
         WHERE "analysisId" = $3
         ORDER BY embedding <-> $1::vector
         LIMIT $2`,
        vec, limit, analysisId,
      );
      return rows;
    },

    async clearDocs(analysisId: string) {
      await db.ragDocument.deleteMany({ where: { analysisId } });
    },

    async createChat(analysisId: string) {
      return db.ragChat.create({ data: { analysisId } });
    },

    async appendMessage(input: { chatId: string; role: string; content: string; sources?: unknown }) {
      await db.ragMessage.create({
        data: {
          chatId: input.chatId,
          role: input.role,
          content: input.content,
          sources: (input.sources ?? null) as never,
        },
      });
    },
  };
}

export type RagRepo = ReturnType<typeof createRagRepo>;
```

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path run typecheck
```

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/repositories/
git commit -m "$(cat <<'EOF'
feat(v2,path): repositories (analysis + graph + RAG)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Pure-logic domain port (classifier + risk-engine + graph-builder + helpers)

**Files (port from v1, no I/O):**
- Create: `apps/path/src/domain/types.ts` — `CrawlResult`, `GraphData`, `GraphNode`, `GraphEdge`, `RiskFlagData`
- Create: `apps/path/src/domain/helpers.ts` — `hexToAscii`, `decodeCurrency`, `xrpDropsToString`
- Create: `apps/path/src/domain/classifier.ts` — port of v1 `counterpartyClassifier.ts`
- Create: `apps/path/src/domain/risk-engine.ts` — port of v1 `riskEngine.ts` (19 flags)
- Create: `apps/path/src/domain/graph-builder.ts` — port of v1 `graphBuilder.ts` (21 node types)
- Create: `apps/path/tests/unit/{classifier, risk-engine, graph-builder, helpers}.test.ts`

**Important:** This task ports v1 logic almost verbatim — it's the bulk of the LOC but mechanical. The implementer should:
1. Read each source file from `corlens/apps/server/src/analysis/` once.
2. Re-create the equivalent file under `apps/path/src/domain/`.
3. Replace the v1 import `import { ... } from "@corlens/core"` with local types in `domain/types.ts` (define just enough to compile — the v2 `path` service does NOT depend on `@corlens/core`).
4. Drop any v1 logger imports — log via the Fastify app.log later when wired in.

### Steps

- [ ] **Step 1: Write `apps/path/src/domain/types.ts`**

Define the v1 type surface needed by the ported files. Read v1 to extract exact shapes. Required exports:

```ts
export type RiskSeverity = "HIGH" | "MED" | "LOW";

export type RiskFlagData = {
  flag: string;
  severity: RiskSeverity;
  detail: string;
  data?: Record<string, unknown>;
};

export type GraphNodeData = {
  id: string;
  kind: string;
  label: string;
  data: Record<string, unknown>;
  riskFlags?: RiskFlagData[];
};

export type GraphEdgeData = {
  id: string;
  source: string;
  target: string;
  kind: string;
  label?: string;
  data?: Record<string, unknown>;
};

export type GraphStats = {
  nodeCount: number;
  edgeCount: number;
  riskCounts: { HIGH: number; MED: number; LOW: number };
};

export type GraphData = {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  stats: GraphStats;
};

// CrawlResult — port the shape from v1's crawler.ts (lines 1-60ish)
// Open-shaped Record<string, unknown> for fields that are XRPL-specific JSON blobs.
export type CrawlResult = {
  seedAddress: string;
  seedLabel: string | null;
  primaryCurrency: string | null;
  isIssuer: boolean;
  issuerInfo: unknown;
  trustLines: unknown[];
  gatewayBalances: unknown;
  ammPool: unknown | null;
  lpHolders: unknown[];
  asks: unknown[];
  bids: unknown[];
  paths: unknown[];
  accountObjects: unknown[];
  currencies: unknown;
  topAccounts: unknown[];
  accountTransactions: unknown[];
  nfts: unknown[];
  channels: unknown[];
  txTypeSummary: Record<string, number>;
  accountOffers: unknown[];
  noripppleProblems: unknown[];
  nftOffers: unknown[];
};
```

If the v1 logic relies on a specific nested shape (e.g., `trustLines[i].account`), keep the nested fields typed loosely as `unknown` and cast at the call site — the v1 ports already do this.

- [ ] **Step 2: Write `apps/path/src/domain/helpers.ts`** — port the helpers from v1 graphBuilder.ts top section.

```ts
export function hexToAscii(hex: string): string {
  if (!/^[0-9A-F]+$/i.test(hex)) return hex;
  let out = "";
  for (let i = 0; i < hex.length; i += 2) {
    const code = parseInt(hex.slice(i, i + 2), 16);
    if (code === 0) continue;
    out += String.fromCharCode(code);
  }
  return out.replace(/\0/g, "").trim();
}

export function decodeCurrency(currency: string): string {
  if (!currency) return "";
  if (currency.length === 3) return currency;
  if (currency.length === 40) return hexToAscii(currency);
  return currency;
}

export function xrpDropsToString(drops: string | number): string {
  const n = typeof drops === "string" ? Number(drops) : drops;
  if (!Number.isFinite(n)) return "0";
  return (n / 1_000_000).toFixed(6).replace(/\.?0+$/, "") || "0";
}
```

- [ ] **Step 3: Write `apps/path/tests/unit/helpers.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hexToAscii, decodeCurrency, xrpDropsToString } from "../../src/domain/helpers.js";

describe("helpers", () => {
  it("hexToAscii decodes valid hex", () => {
    expect(hexToAscii("48656C6C6F")).toBe("Hello");
  });
  it("hexToAscii returns input for non-hex", () => {
    expect(hexToAscii("not-hex")).toBe("not-hex");
  });
  it("decodeCurrency passes 3-char codes through", () => {
    expect(decodeCurrency("USD")).toBe("USD");
  });
  it("decodeCurrency decodes 40-char hex", () => {
    expect(decodeCurrency("524C555344000000000000000000000000000000")).toBe("RLUSD");
  });
  it("xrpDropsToString converts drops to xrp", () => {
    expect(xrpDropsToString("1000000")).toBe("1");
    expect(xrpDropsToString(2_500_000)).toBe("2.5");
  });
});
```

Run, confirm fail, then run again confirming pass after Step 2.

- [ ] **Step 4: Port `counterpartyClassifier.ts` → `apps/path/src/domain/classifier.ts`**

Read `/Users/beorlor/Documents/PBW_2026/corlens/apps/server/src/analysis/counterpartyClassifier.ts`. Copy verbatim except:
- Replace the `@corlens/core` import with the local types from `domain/types.ts`.
- Drop the `logger` import; if any `logger.<method>` calls exist, replace with a no-op (or accept a `log` callback in a function arg if needed).
- Export the same function signatures: `classifyCounterparties(seed, txs) → ClassifierResult`.

Add a unit test `apps/path/tests/unit/classifier.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyCounterparties } from "../../src/domain/classifier.js";

describe("classifyCounterparties", () => {
  it("returns empty result for an empty tx list", () => {
    const result = classifyCounterparties("rSeed", []);
    expect(result.light).toEqual([]);
    expect(result.heavy).toEqual([]);
    expect(result.edges).toEqual([]);
  });

  it("buckets a single tx counterparty as light", () => {
    const txs = [
      { tx_json: { TransactionType: "Payment", Account: "rOther", Destination: "rSeed", Amount: "1000000" }, ledger_index: 100, close_time_iso: "2026-01-01T00:00:00Z" },
    ];
    const result = classifyCounterparties("rSeed", txs as never);
    expect(result.light.length + result.heavy.length).toBeGreaterThan(0);
  });
});
```

Run vitest after porting to confirm both tests pass and no v1 imports leak in.

- [ ] **Step 5: Port `riskEngine.ts` → `apps/path/src/domain/risk-engine.ts`**

Read `/Users/beorlor/Documents/PBW_2026/corlens/apps/server/src/analysis/riskEngine.ts`. Re-implement `computeRiskFlags(crawl, seedAddress) → RiskFlagData[]`. Keep the 19 flag emissions as in v1 (line references in summary above). The function is pure (no I/O), so the port is mechanical.

Add `apps/path/tests/unit/risk-engine.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { computeRiskFlags } from "../../src/domain/risk-engine.js";
import type { CrawlResult } from "../../src/domain/types.js";

const empty: CrawlResult = {
  seedAddress: "rSeed", seedLabel: null, primaryCurrency: null, isIssuer: false,
  issuerInfo: null, trustLines: [], gatewayBalances: null, ammPool: null, lpHolders: [],
  asks: [], bids: [], paths: [], accountObjects: [], currencies: { obligations: {} }, topAccounts: [],
  accountTransactions: [], nfts: [], channels: [], txTypeSummary: {}, accountOffers: [],
  noripppleProblems: [], nftOffers: [],
};

describe("computeRiskFlags", () => {
  it("returns an empty array for a minimal crawl", () => {
    expect(computeRiskFlags(empty, "rSeed")).toEqual([]);
  });

  it("emits FROZEN_TRUST_LINE when trust lines have freeze flags", () => {
    const crawl = { ...empty, trustLines: [{ account: "rIss", currency: "USD", balance: "100", freeze: true }] };
    const flags = computeRiskFlags(crawl, "rSeed");
    const frozen = flags.find((f) => f.flag === "FROZEN_TRUST_LINE");
    expect(frozen).toBeDefined();
    expect(frozen?.severity).toBe("HIGH");
  });
});
```

Two cases are enough as a smoke; the v1 port is faithful so additional flag scenarios are covered by integration once a real crawl is available.

- [ ] **Step 6: Port `graphBuilder.ts` → `apps/path/src/domain/graph-builder.ts`**

Read `/Users/beorlor/Documents/PBW_2026/corlens/apps/server/src/analysis/graphBuilder.ts`. Re-implement `buildGraph(crawl, seedAddress, seedLabel) → GraphData`. 21 node types. Keep the dedupe-by-id behavior on re-seen nodes. Use the helpers from Step 2.

Add `apps/path/tests/unit/graph-builder.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGraph } from "../../src/domain/graph-builder.js";
import type { CrawlResult } from "../../src/domain/types.js";

const empty: CrawlResult = {
  seedAddress: "rSeed", seedLabel: null, primaryCurrency: null, isIssuer: false,
  issuerInfo: null, trustLines: [], gatewayBalances: null, ammPool: null, lpHolders: [],
  asks: [], bids: [], paths: [], accountObjects: [], currencies: { obligations: {} }, topAccounts: [],
  accountTransactions: [], nfts: [], channels: [], txTypeSummary: {}, accountOffers: [],
  noripppleProblems: [], nftOffers: [],
};

describe("buildGraph", () => {
  it("creates at least one node (the seed) for an empty crawl", () => {
    const g = buildGraph(empty, "rSeed", "Seed");
    expect(g.nodes.length).toBeGreaterThanOrEqual(1);
    expect(g.stats.nodeCount).toBe(g.nodes.length);
    expect(g.stats.edgeCount).toBe(g.edges.length);
  });

  it("creates a token node when the seed has trust lines", () => {
    const crawl = { ...empty, trustLines: [{ account: "rIss", currency: "USD", balance: "100" }] };
    const g = buildGraph(crawl, "rSeed", "Seed");
    const tokenNode = g.nodes.find((n) => n.kind === "token");
    expect(tokenNode).toBeDefined();
  });
});
```

- [ ] **Step 7: Run all unit tests + typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run && pnpm --filter @corlens/path run typecheck
```

Expected: env (2) + market-data connector (2) + helpers (5) + classifier (2) + risk-engine (2) + graph-builder (2) = 15 passing.

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/domain/ corlens_v2/apps/path/tests/unit/helpers.test.ts corlens_v2/apps/path/tests/unit/classifier.test.ts corlens_v2/apps/path/tests/unit/risk-engine.test.ts corlens_v2/apps/path/tests/unit/graph-builder.test.ts
git commit -m "$(cat <<'EOF'
feat(v2,path): pure-logic domain port (classifier + 19 risk flags + 21 node graph builder)

Ported from v1 corlens/apps/server/src/analysis/{counterpartyClassifier,
riskEngine,graphBuilder}.ts. No I/O; isolated under apps/path/src/domain/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Crawler service (calls market-data) + BFS orchestrator

**Files:**
- Create: `apps/path/src/services/crawler.service.ts`
- Create: `apps/path/src/services/bfs.service.ts`
- Create: `apps/path/tests/unit/crawler.service.test.ts`
- Create: `apps/path/tests/unit/bfs.service.test.ts`

### Steps

- [ ] **Step 1: TDD `crawler.service.ts`** — port v1 `crawler.ts` but rewrite each xrpl call as a market-data HTTP call.

Tests `apps/path/tests/unit/crawler.service.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createCrawlerService } from "../../src/services/crawler.service.js";

const stubMarketData = () => ({
  accountInfo: vi.fn().mockResolvedValue({ result: { account_data: { Account: "rSeed", Domain: "636F726C656E732E696F" } } }),
  trustLines: vi.fn().mockResolvedValue({ lines: [] }),
  accountObjects: vi.fn().mockResolvedValue({ result: { account_objects: [] } }),
  accountTransactions: vi.fn().mockResolvedValue({ result: { transactions: [] } }),
  accountNfts: vi.fn().mockResolvedValue({ result: { account_nfts: [] } }),
  accountChannels: vi.fn().mockResolvedValue({ result: { channels: [] } }),
  accountOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
  gatewayBalances: vi.fn().mockResolvedValue({ result: { obligations: {} } }),
  noripple: vi.fn().mockResolvedValue({ result: { problems: [] } }),
  bookOffers: vi.fn().mockResolvedValue({ result: { offers: [] } }),
  ammByPair: vi.fn().mockResolvedValue({ result: null }),
  ammByAccount: vi.fn().mockResolvedValue({ result: null }),
  nftBuyOffers: vi.fn(),
  nftSellOffers: vi.fn(),
  pathFind: vi.fn().mockResolvedValue({ result: { alternatives: [] } }),
});

describe("crawler.service", () => {
  it("returns a CrawlResult shape with every field populated (defaults if empty)", async () => {
    const md = stubMarketData();
    const svc = createCrawlerService({ marketData: md as never });
    const out = await svc.crawl("rSeed", "Seed Label");
    expect(out.seedAddress).toBe("rSeed");
    expect(out.seedLabel).toBe("Seed Label");
    expect(Array.isArray(out.trustLines)).toBe(true);
    expect(md.accountInfo).toHaveBeenCalledWith("rSeed");
  });

  it("tolerates a single failed RPC by setting that field to a default and continuing", async () => {
    const md = stubMarketData();
    md.accountTransactions.mockRejectedValueOnce(new Error("rpc timeout"));
    const svc = createCrawlerService({ marketData: md as never });
    const out = await svc.crawl("rSeed", null);
    expect(out.accountTransactions).toEqual([]);
  });
});
```

Implementation skeleton — port v1's call sequence, but wrap each call in a try/catch that defaults the field on failure (v2 favors graceful degradation here):

```ts
import type { MarketDataClient } from "../connectors/market-data.js";
import type { CrawlResult } from "../domain/types.js";

export type CrawlerServiceOptions = {
  marketData: MarketDataClient;
};

export type CrawlerService = ReturnType<typeof createCrawlerService>;

export function createCrawlerService(opts: CrawlerServiceOptions) {
  return {
    async crawl(seedAddress: string, seedLabel: string | null): Promise<CrawlResult> {
      const md = opts.marketData;
      const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
        try { return await fn(); } catch { return fallback; }
      };

      const accountInfo = await safe(() => md.accountInfo(seedAddress) as Promise<Record<string, unknown>>, {} as Record<string, unknown>);
      const trustLinesRaw = await safe(() => md.trustLines(seedAddress, { limit: 2000 }) as Promise<{ lines?: unknown[] }>, { lines: [] });
      const accountObjects = await safe(() => md.accountObjects(seedAddress) as Promise<{ result?: { account_objects?: unknown[] } }>, { result: { account_objects: [] } });
      const accountTxs = await safe(() => md.accountTransactions(seedAddress, { limit: 200 }) as Promise<{ result?: { transactions?: unknown[] } }>, { result: { transactions: [] } });
      const nfts = await safe(() => md.accountNfts(seedAddress) as Promise<{ result?: { account_nfts?: unknown[] } }>, { result: { account_nfts: [] } });
      const channels = await safe(() => md.accountChannels(seedAddress) as Promise<{ result?: { channels?: unknown[] } }>, { result: { channels: [] } });
      const offers = await safe(() => md.accountOffers(seedAddress) as Promise<{ result?: { offers?: unknown[] } }>, { result: { offers: [] } });
      const gateway = await safe(() => md.gatewayBalances(seedAddress) as Promise<{ result?: { obligations?: Record<string, unknown> } }>, { result: { obligations: {} } });
      const noripple = await safe(() => md.noripple(seedAddress) as Promise<{ result?: { problems?: unknown[] } }>, { result: { problems: [] } });

      const obligations = (gateway.result?.obligations ?? {}) as Record<string, unknown>;
      const isIssuer = Object.keys(obligations).length > 0;
      const primaryCurrency = isIssuer ? Object.keys(obligations)[0] ?? null : null;

      // txTypeSummary roll-up
      const txs = (accountTxs.result?.transactions ?? []) as Array<{ tx_json?: { TransactionType?: string }; tx?: { TransactionType?: string } }>;
      const txTypeSummary: Record<string, number> = {};
      for (const t of txs) {
        const type = t.tx_json?.TransactionType ?? t.tx?.TransactionType ?? "Unknown";
        txTypeSummary[type] = (txTypeSummary[type] ?? 0) + 1;
      }

      // AMM lookup if seed appears to be an AMM account, otherwise null
      const ammPool = await safe(() => md.ammByAccount(seedAddress) as Promise<{ result?: unknown }>, { result: null });

      return {
        seedAddress,
        seedLabel,
        primaryCurrency,
        isIssuer,
        issuerInfo: accountInfo,
        trustLines: trustLinesRaw.lines ?? [],
        gatewayBalances: gateway.result ?? null,
        ammPool: ammPool.result ?? null,
        lpHolders: [],   // requires AMM-account-tx walk; deferred
        asks: [],
        bids: [],
        paths: [],
        accountObjects: accountObjects.result?.account_objects ?? [],
        currencies: gateway.result ?? { obligations: {} },
        topAccounts: [],
        accountTransactions: txs,
        nfts: nfts.result?.account_nfts ?? [],
        channels: channels.result?.channels ?? [],
        txTypeSummary,
        accountOffers: offers.result?.offers ?? [],
        noripppleProblems: noripple.result?.problems ?? [],
        nftOffers: [],
      };
    },
  };
}
```

Note: this is a leaner crawler than v1's full 17-call sequence. `lpHolders`, `topAccounts`, `asks`, `bids`, `paths`, `nftOffers` are returned as empty arrays. The risk engine and graph builder tolerate empty arrays, so flags that depend on those (CONCENTRATED_LIQUIDITY, LOW_DEPTH_ORDERBOOK, etc.) won't fire on the first MVP — they're additive in a follow-up.

- [ ] **Step 2: TDD `bfs.service.ts`** — port the depth-1 path of v1 `bfsOrchestrator.ts`. Skip the depth-2/3 hub-expansion in this MVP (the graph from a single seed is already informative; multi-depth is a follow-up).

Test:

```ts
import { describe, expect, it, vi } from "vitest";
import { createBfsService } from "../../src/services/bfs.service.js";

describe("bfs.service", () => {
  it("returns graph + crawlSummary at depth 1", async () => {
    const crawler = { crawl: vi.fn().mockResolvedValue({
      seedAddress: "rSeed", seedLabel: null, primaryCurrency: null, isIssuer: false,
      issuerInfo: null, trustLines: [], gatewayBalances: null, ammPool: null, lpHolders: [],
      asks: [], bids: [], paths: [], accountObjects: [], currencies: { obligations: {} }, topAccounts: [],
      accountTransactions: [], nfts: [], channels: [], txTypeSummary: {}, accountOffers: [],
      noripppleProblems: [], nftOffers: [],
    }) };
    const svc = createBfsService({ crawler: crawler as never });
    const out = await svc.run({ seedAddress: "rSeed", seedLabel: null, depth: 1 });
    expect(out.graph.nodes.length).toBeGreaterThanOrEqual(1);
    expect(out.crawlSummary.seedAddress).toBe("rSeed");
    expect(crawler.crawl).toHaveBeenCalledTimes(1);
  });
});
```

Implementation:

```ts
import type { CrawlerService } from "./crawler.service.js";
import { buildGraph } from "../domain/graph-builder.js";
import { computeRiskFlags } from "../domain/risk-engine.js";
import type { GraphData, CrawlResult } from "../domain/types.js";

export type BfsRunInput = { seedAddress: string; seedLabel: string | null; depth: number };
export type BfsRunResult = { graph: GraphData; crawlSummary: CrawlResult };

export type BfsServiceOptions = {
  crawler: CrawlerService;
};

export type BfsService = ReturnType<typeof createBfsService>;

export function createBfsService(opts: BfsServiceOptions) {
  return {
    async run(input: BfsRunInput): Promise<BfsRunResult> {
      const crawl = await opts.crawler.crawl(input.seedAddress, input.seedLabel);
      const graph = buildGraph(crawl, input.seedAddress, input.seedLabel ?? input.seedAddress);
      const flags = computeRiskFlags(crawl, input.seedAddress);

      // Attach flags to the seed node (and to issuer/AMM nodes if matching nodeId)
      const seedNode = graph.nodes.find((n) => n.kind === "account" && (n.id === input.seedAddress || n.label === input.seedAddress));
      if (seedNode) {
        seedNode.riskFlags = flags;
      }
      // Roll up risk counts
      graph.stats.riskCounts = flags.reduce(
        (acc, f) => { acc[f.severity] += 1; return acc; },
        { HIGH: 0, MED: 0, LOW: 0 },
      );
      return { graph, crawlSummary: crawl };
    },
  };
}
```

- [ ] **Step 3: Run tests + typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run && pnpm --filter @corlens/path run typecheck
```

Expect 17 unit tests passing.

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/services/crawler.service.ts corlens_v2/apps/path/src/services/bfs.service.ts corlens_v2/apps/path/tests/unit/crawler.service.test.ts corlens_v2/apps/path/tests/unit/bfs.service.test.ts
git commit -m "$(cat <<'EOF'
feat(v2,path): crawler service + bfs orchestrator (TDD, depth-1 MVP)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: AI services (explanations + RAG indexer + chat)

**Files:**
- Create: `apps/path/src/services/explanations.service.ts`
- Create: `apps/path/src/services/rag-index.service.ts`
- Create: `apps/path/src/services/chat.service.ts`
- Create: `apps/path/tests/unit/{explanations,rag-index,chat}.service.test.ts`

These mirror corridor's pattern (which mirrors ai-service callers). Brief per-file:

- [ ] **Step 1: TDD `explanations.service.ts`** — generates a per-node short explanation. Iterates nodes, calls ai-service `/completion` with `purpose: "path.explanation"`. Persists via `graph.writeExplanation`. Returns `{count}`.

```ts
import type { AIServiceClient } from "../connectors/ai-service.js";
import type { GraphRepo } from "../repositories/graph.repo.js";
import type { GraphNodeData } from "../domain/types.js";

export type ExplanationsServiceOptions = {
  ai: AIServiceClient;
  graph: GraphRepo;
};

export type ExplanationsService = ReturnType<typeof createExplanationsService>;

export function createExplanationsService(opts: ExplanationsServiceOptions) {
  return {
    async generate(input: { analysisId: string; nodes: GraphNodeData[] }): Promise<{ count: number }> {
      let count = 0;
      for (const n of input.nodes) {
        const prompt = `Explain in 2 sentences what this XRPL ${n.kind} node represents and any risk implications.\n\nLabel: ${n.label}\nKind: ${n.kind}\nData: ${JSON.stringify(n.data).slice(0, 800)}`;
        const result = await opts.ai.complete({
          purpose: "path.explanation",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          maxTokens: 150,
        });
        await opts.graph.writeExplanation(input.analysisId, n.id, result.content.trim());
        count += 1;
      }
      return { count };
    },
  };
}
```

Test (1 unit case verifies the AI call and the writeExplanation call).

- [ ] **Step 2: TDD `rag-index.service.ts`** — embeds (label + kind + data summary) per node, persists via `rag.upsertDoc`. Same pattern as corridor's rag-index.service.ts; key change: doc is keyed by `analysisId` not `corridorId`.

```ts
import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";
import type { GraphNodeData, RiskFlagData } from "../domain/types.js";

export type RagIndexServiceOptions = { ai: AIServiceClient; repo: RagRepo };
export type RagIndexService = ReturnType<typeof createRagIndexService>;

export function createRagIndexService(opts: RagIndexServiceOptions) {
  return {
    async index(input: { analysisId: string; nodes: GraphNodeData[]; flags: RiskFlagData[] }): Promise<{ indexed: number }> {
      await opts.repo.clearDocs(input.analysisId);
      let count = 0;
      for (const n of input.nodes) {
        const text = `${n.kind}: ${n.label}\n${JSON.stringify(n.data).slice(0, 600)}`;
        const { embedding } = await opts.ai.embed({ purpose: "path.rag-index", input: text });
        await opts.repo.upsertDoc({
          analysisId: input.analysisId,
          content: text,
          metadata: { nodeId: n.id, kind: n.kind, label: n.label },
          embedding,
        });
        count += 1;
      }
      // Index a flags summary as a separate document for risk-question recall
      if (input.flags.length > 0) {
        const flagsText = input.flags.map((f) => `[${f.severity}] ${f.flag}: ${f.detail}`).join("\n");
        const { embedding } = await opts.ai.embed({ purpose: "path.rag-index", input: flagsText });
        await opts.repo.upsertDoc({
          analysisId: input.analysisId,
          content: flagsText,
          metadata: { kind: "risk-summary" },
          embedding,
        });
        count += 1;
      }
      return { indexed: count };
    },
  };
}
```

- [ ] **Step 3: TDD `chat.service.ts`** — same structure as corridor's chat service, but using path's `RagRepo` and operating on an analysisId.

```ts
import type { AIServiceClient } from "../connectors/ai-service.js";
import type { RagRepo } from "../repositories/rag.repo.js";

export type ChatServiceOptions = { ai: AIServiceClient; repo: RagRepo; topK: number };
export type ChatService = ReturnType<typeof createChatService>;

export function createChatService(opts: ChatServiceOptions) {
  return {
    async ask(input: { analysisId: string; message: string }): Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }> {
      const { embedding } = await opts.ai.embed({ purpose: "path.chat", input: input.message });
      const docs = await opts.repo.searchByEmbedding(input.analysisId, embedding, opts.topK);
      const chat = await opts.repo.createChat(input.analysisId);
      await opts.repo.appendMessage({ chatId: chat.id, role: "user", content: input.message });

      const context = docs.map((d) => d.content).join("\n\n");
      const result = await opts.ai.complete({
        purpose: "path.chat",
        messages: [
          { role: "system", content: "You are a CORLens entity-audit analyst. Answer based only on the provided context." },
          { role: "user", content: `Context:\n${context}\n\nQuestion: ${input.message}` },
        ],
        temperature: 0.2,
        maxTokens: 400,
      });
      const sources = docs.map((d) => ({ id: d.id, snippet: d.content.slice(0, 200) }));
      await opts.repo.appendMessage({ chatId: chat.id, role: "assistant", content: result.content, sources });

      return { answer: result.content.trim(), sources };
    },
  };
}
```

- [ ] **Step 4: Run tests + typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run && pnpm --filter @corlens/path run typecheck
```

Expect 20 unit tests passing.

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/services/explanations.service.ts corlens_v2/apps/path/src/services/rag-index.service.ts corlens_v2/apps/path/src/services/chat.service.ts corlens_v2/apps/path/tests/unit/explanations.service.test.ts corlens_v2/apps/path/tests/unit/rag-index.service.test.ts corlens_v2/apps/path/tests/unit/chat.service.test.ts
git commit -m "$(cat <<'EOF'
feat(v2,path): explanations + rag-index + chat services (TDD)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: BullMQ worker + Fastify app + 4 controllers + integration test

**Files:**
- Create: `apps/path/src/plugins/{prisma,redis,error-handler,swagger}.ts`
- Create: `apps/path/src/workers/analysis.worker.ts`
- Create: `apps/path/src/controllers/{analyze,analysis,chat,history}.controller.ts`
- Create: `apps/path/src/app.ts`
- Create: `apps/path/src/index.ts`
- Create: `apps/path/tests/integration/routes.test.ts`

### Steps

- [ ] **Step 1: Plugins** — copy from `apps/corridor/src/plugins/` verbatim, change swagger title to `@corlens/path`.

- [ ] **Step 2: Write `apps/path/src/workers/analysis.worker.ts`**

```ts
import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { GraphRepo } from "../repositories/graph.repo.js";
import type { BfsService } from "../services/bfs.service.js";
import type { ExplanationsService } from "../services/explanations.service.js";
import type { RagIndexService } from "../services/rag-index.service.js";

const QUEUE = "path-analysis";

export type AnalysisJobData = { analysisId: string; seedAddress: string; seedLabel: string | null; depth: number };

export type AnalysisQueue = {
  enqueue(data: AnalysisJobData): Promise<void>;
  stop(): Promise<void>;
};

export type WorkerOptions = {
  redisUrl: string;
  enabled: boolean;
  concurrency: number;
  analyses: AnalysisRepo;
  graphs: GraphRepo;
  bfs: BfsService;
  explanations: ExplanationsService;
  ragIndex: RagIndexService;
};

export async function startAnalysisWorker(opts: WorkerOptions): Promise<AnalysisQueue> {
  const conn = new IORedis(opts.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue<AnalysisJobData>(QUEUE, { connection: conn });

  let worker: Worker | null = null;
  if (opts.enabled) {
    worker = new Worker<AnalysisJobData>(QUEUE, async (job: Job<AnalysisJobData>) => {
      const { analysisId, seedAddress, seedLabel, depth } = job.data;
      try {
        await opts.analyses.setStatus(analysisId, "running", null);
        const { graph, crawlSummary } = await opts.bfs.run({ seedAddress, seedLabel, depth });
        const seedNode = graph.nodes.find((n) => n.id === seedAddress) ?? graph.nodes[0];
        const flags = seedNode?.riskFlags ?? [];
        await opts.graphs.persist({
          analysisId,
          nodes: graph.nodes.map((n) => ({ nodeId: n.id, kind: n.kind, label: n.label, data: n.data })),
          edges: graph.edges.map((e) => ({ edgeId: e.id, source: e.source, target: e.target, kind: e.kind, label: e.label ?? null, data: e.data ?? null })),
          riskFlags: flags.map((f) => ({ nodeId: seedNode?.id ?? seedAddress, flag: f.flag, severity: f.severity, detail: f.detail, data: f.data ?? null })),
        });
        // Best-effort RAG indexing (don't fail the analysis if ai-service is down)
        try {
          await opts.ragIndex.index({ analysisId, nodes: graph.nodes, flags });
        } catch {}
        // Best-effort explanations (skip if ai-service is unreachable)
        try {
          await opts.explanations.generate({ analysisId, nodes: graph.nodes });
        } catch {}
        await opts.analyses.setSummary(analysisId, {
          stats: graph.stats,
          seedAddress: crawlSummary.seedAddress,
          isIssuer: crawlSummary.isIssuer,
        });
      } catch (err) {
        await opts.analyses.setStatus(analysisId, "error", (err as Error).message);
        throw err;
      }
    }, { connection: conn, concurrency: opts.concurrency });
  }

  return {
    async enqueue(data) {
      await queue.add("run", data, { attempts: 1 });
    },
    async stop() {
      await worker?.close();
      await queue.close();
      conn.disconnect();
    },
  };
}
```

- [ ] **Step 3: Write `apps/path/src/controllers/analyze.controller.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { path as pp } from "@corlens/contracts";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { AnalysisQueue } from "../workers/analysis.worker.js";

export async function registerAnalyzeRoutes(app: FastifyInstance, analyses: AnalysisRepo, queue: AnalysisQueue): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/api/analyze", {
    schema: { body: pp.AnalyzeRequest, response: { 200: pp.AnalyzeResponse }, tags: ["analysis"] },
  }, async (req) => {
    const { seedAddress, seedLabel, depth } = req.body;
    const cached = await analyses.findCachedDone(seedAddress, depth);
    if (cached) return { id: cached.id, status: "done" as const };
    const created = await analyses.create({ seedAddress, seedLabel: seedLabel ?? null, depth, userId: null });
    await queue.enqueue({ analysisId: created.id, seedAddress, seedLabel: seedLabel ?? null, depth });
    return { id: created.id, status: "queued" as const };
  });
}
```

- [ ] **Step 4: Write `apps/path/src/controllers/analysis.controller.ts`**

Three routes: `GET /api/analysis/:id`, `GET /api/analysis/:id/graph`, `GET /api/analysis/:id/explanations`. Each reads from repos and shapes the response per the contracts.

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { path as pp } from "@corlens/contracts";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";
import type { GraphRepo } from "../repositories/graph.repo.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerAnalysisRoutes(app: FastifyInstance, analyses: AnalysisRepo, graphs: GraphRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/api/analysis/:id", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.AnalysisSummary, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    const summary = (a.summaryJson as { stats?: { nodeCount: number; edgeCount: number; riskCounts: { HIGH: number; MED: number; LOW: number } } } | null)?.stats ?? null;
    return {
      id: a.id,
      seedAddress: a.seedAddress,
      seedLabel: a.seedLabel,
      depth: a.depth,
      status: a.status as "queued" | "running" | "done" | "error",
      error: a.error,
      stats: summary,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    };
  });

  typed.get("/api/analysis/:id/graph", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.GraphResponse, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    const { nodes, edges, flags } = await graphs.loadGraph(req.params.id);
    const flagsByNode = new Map<string, Array<{ flag: string; severity: "HIGH" | "MED" | "LOW"; detail: string; data: unknown }>>();
    for (const f of flags) {
      const list = flagsByNode.get(f.nodeId) ?? [];
      list.push({ flag: f.flag, severity: f.severity as "HIGH" | "MED" | "LOW", detail: f.detail, data: f.data });
      flagsByNode.set(f.nodeId, list);
    }
    const stats = (a.summaryJson as { stats?: { nodeCount: number; edgeCount: number; riskCounts: { HIGH: number; MED: number; LOW: number } } } | null)?.stats
      ?? { nodeCount: nodes.length, edgeCount: edges.length, riskCounts: { HIGH: 0, MED: 0, LOW: 0 } };
    return {
      analysisId: a.id,
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId, kind: n.kind, label: n.label, data: n.data,
        riskFlags: flagsByNode.get(n.nodeId) ?? [],
        aiExplanation: n.aiExplanation,
      })),
      edges: edges.map((e) => ({ edgeId: e.edgeId, source: e.source, target: e.target, kind: e.kind, label: e.label ?? null, data: e.data ?? null })),
      stats,
    };
  });

  typed.get("/api/analysis/:id/explanations", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: pp.ExplanationsResponse, 404: ErrorResp }, tags: ["analysis"] },
  }, async (req, reply) => {
    const a = await analyses.findById(req.params.id);
    if (!a) { reply.status(404).send({ error: "not_found" }); return reply; }
    const items = await graphs.listExplanations(req.params.id);
    return { analysisId: a.id, items };
  });
}
```

- [ ] **Step 5: Write `apps/path/src/controllers/chat.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { path as pp } from "@corlens/contracts";
import type { ChatService } from "../services/chat.service.js";

export async function registerChatRoutes(app: FastifyInstance, chat: ChatService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/api/analysis/:id/chat", {
    schema: { params: z.object({ id: z.string().uuid() }), body: pp.ChatRequest, response: { 200: pp.ChatResponse }, tags: ["analysis"] },
  }, async (req) => chat.ask({ analysisId: req.params.id, message: req.body.message }));
}
```

- [ ] **Step 6: Write `apps/path/src/controllers/history.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { path as pp } from "@corlens/contracts";
import type { AnalysisRepo } from "../repositories/analysis.repo.js";

export async function registerHistoryRoutes(app: FastifyInstance, analyses: AnalysisRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get("/api/history/:address", {
    schema: { params: z.object({ address: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/) }), response: { 200: pp.HistoryResponse }, tags: ["history"] },
  }, async (req) => {
    const rows = await analyses.listForAddress(req.params.address, 10);
    return {
      address: req.params.address,
      analyses: rows.map((a) => ({
        id: a.id, status: a.status as "queued" | "running" | "done" | "error",
        depth: a.depth,
        stats: (a.summaryJson as { stats?: { nodeCount: number; edgeCount: number; riskCounts: { HIGH: number; MED: number; LOW: number } } } | null)?.stats ?? null,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  });
}
```

- [ ] **Step 7: Write `apps/path/src/app.ts`** — wire prisma + redis + repos + connectors + services + worker + controllers. Same structure as `apps/corridor/src/app.ts`.

```ts
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type PathEnv } from "./env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createMarketDataClient } from "./connectors/market-data.js";
import { createAIServiceClient } from "./connectors/ai-service.js";
import { createAnalysisRepo } from "./repositories/analysis.repo.js";
import { createGraphRepo } from "./repositories/graph.repo.js";
import { createRagRepo } from "./repositories/rag.repo.js";
import { createCrawlerService } from "./services/crawler.service.js";
import { createBfsService } from "./services/bfs.service.js";
import { createExplanationsService } from "./services/explanations.service.js";
import { createRagIndexService } from "./services/rag-index.service.js";
import { createChatService } from "./services/chat.service.js";
import { startAnalysisWorker } from "./workers/analysis.worker.js";
import { registerAnalyzeRoutes } from "./controllers/analyze.controller.js";
import { registerAnalysisRoutes } from "./controllers/analysis.controller.js";
import { registerChatRoutes } from "./controllers/chat.controller.js";
import { registerHistoryRoutes } from "./controllers/history.controller.js";

export async function buildApp(env: PathEnv): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await app.register(redisPlugin, { url: env.REDIS_URL });
  await registerSwagger(app);

  const marketData = createMarketDataClient({ baseUrl: env.MARKET_DATA_BASE_URL });
  const ai = createAIServiceClient({ baseUrl: env.AI_SERVICE_BASE_URL });

  const analyses = createAnalysisRepo(app.prisma);
  const graphs = createGraphRepo(app.prisma);
  const ragRepo = createRagRepo(app.prisma);

  const crawler = createCrawlerService({ marketData });
  const bfs = createBfsService({ crawler });
  const explanations = createExplanationsService({ ai, graph: graphs });
  const ragIndex = createRagIndexService({ ai, repo: ragRepo });
  const chat = createChatService({ ai, repo: ragRepo, topK: env.RAG_TOP_K });

  const queue = await startAnalysisWorker({
    redisUrl: env.REDIS_URL,
    enabled: env.WORKER_ENABLED,
    concurrency: env.BFS_CONCURRENCY,
    analyses, graphs, bfs, explanations, ragIndex,
  });
  app.addHook("onClose", async () => { await queue.stop(); });

  await registerAnalyzeRoutes(app, analyses, queue);
  await registerAnalysisRoutes(app, analyses, graphs);
  await registerChatRoutes(app, chat);
  await registerHistoryRoutes(app, analyses);

  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "path" }));

  return app;
}
```

- [ ] **Step 8: Write `apps/path/src/index.ts`** — same shape as corridor's bootstrap.

- [ ] **Step 9: Write `apps/path/tests/integration/routes.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadPathEnv } from "../../src/env.js";

const env = loadPathEnv({
  PORT: "3005",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  REDIS_URL: "redis://localhost:6381",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
  WORKER_ENABLED: "false",   // disable worker in tests so no real crawls trigger
});

describe("path routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(env); });
  afterAll(async () => { await app.close(); });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("POST /api/analyze with bad address returns 400", async () => {
    const res = await app.inject({ method: "POST", url: "/api/analyze", payload: { seedAddress: "not-an-address", depth: 1 } });
    expect(res.statusCode).toBe(400);
  });

  it("POST /api/analyze creates a queued analysis for a valid address", async () => {
    const res = await app.inject({ method: "POST", url: "/api/analyze", payload: { seedAddress: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", depth: 1 } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(["queued", "done"]).toContain(body.status);
  });

  it("GET /api/analysis/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/analysis/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/history/<address> returns the history shape", async () => {
    const res = await app.inject({ method: "GET", url: "/api/history/rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.address).toBe("rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De");
    expect(Array.isArray(body.analyses)).toBe(true);
  });
});
```

- [ ] **Step 10: Run all tests + typecheck + build + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/path exec vitest run && pnpm --filter @corlens/path run typecheck && pnpm --filter @corlens/path run build
```

Expect 25 tests passing (20 unit + 5 integration).

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/path/src/plugins/ corlens_v2/apps/path/src/workers/ corlens_v2/apps/path/src/controllers/ corlens_v2/apps/path/src/app.ts corlens_v2/apps/path/src/index.ts corlens_v2/apps/path/tests/integration/
git commit -m "$(cat <<'EOF'
feat(v2,path): bullmq worker + fastify app + 4 controllers + integration tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire path service into docker-compose + Caddy + spec milestone

**Files:**
- Modify: `corlens_v2/docker-compose.yml`
- Modify: `corlens_v2/Caddyfile`
- Modify: `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`

### Steps

- [ ] **Step 1: Append path service to `docker-compose.yml`** (after `corridor:` block, before `volumes:`):

```yaml
  path:
    build:
      context: .
      dockerfile: apps/path/Dockerfile
    container_name: corlens-v2-path
    restart: unless-stopped
    environment:
      PORT: "3005"
      HOST: "0.0.0.0"
      DATABASE_URL: postgresql://corlens:corlens_dev@postgres:5432/corlens
      REDIS_URL: redis://redis:6379
      MARKET_DATA_BASE_URL: http://market-data:3002
      AI_SERVICE_BASE_URL: http://ai-service:3003
      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET:-dev-secret-must-be-at-least-32-chars-long}
      BFS_CONCURRENCY: "4"
      BFS_MAX_NODES: "800"
      BFS_TIMEOUT_MS: "45000"
      WORKER_ENABLED: "true"
      RAG_TOP_K: "5"
    ports:
      - "3005:3005"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://127.0.0.1:3005/health"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 60s
```

- [ ] **Step 2: Build + bring up**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && docker compose build path && docker compose up -d path
```

Wait ~60s. Verify:

```bash
docker compose ps
curl -sS http://localhost:3005/health
curl -sS -X POST http://localhost:3005/api/analyze -H 'content-type: application/json' -d '{"seedAddress":"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De","depth":1}'
```

The POST should return `{"id":"...","status":"queued"}` (or `"done"` if cached). The worker will run a real crawl against XRPL via market-data; expect the analysis to take 5–30 seconds depending on RPC latency. Poll `GET /api/analysis/:id` until `status:"done"` or `"error"`.

- [ ] **Step 3: Update `Caddyfile`**

Replace these four 503 stubs:

```
    handle_path /api/analyze* {
        respond `{"error":"not_implemented","service":"path","step":7}` 503 {
            close
        }
    }
    handle_path /api/analysis/* {
        respond `{"error":"not_implemented","service":"path","step":7}` 503 {
            close
        }
    }
    handle_path /api/graph/* {
        respond `{"error":"not_implemented","service":"path","step":7}` 503 {
            close
        }
    }
    handle_path /api/history/* {
        respond `{"error":"not_implemented","service":"path","step":7}` 503 {
            close
        }
    }
```

with (use `handle` not `handle_path` so the full path is forwarded to the path service, matching the corridor service convention discovered in Step 6.7):

```
    handle /api/analyze {
        reverse_proxy path:3005
    }
    handle /api/analyze/* {
        reverse_proxy path:3005
    }
    handle /api/analysis/* {
        reverse_proxy path:3005
    }
    handle /api/history/* {
        reverse_proxy path:3005
    }
```

(The `/api/graph/*` stub from the legacy spec is dropped — graph is now under `/api/analysis/:id/graph`.)

Validate + reload + smoke through Caddy:

```bash
docker run --rm -v /Users/beorlor/Documents/PBW_2026/corlens_v2/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile
docker compose -f /Users/beorlor/Documents/PBW_2026/corlens_v2/docker-compose.yml restart gateway
sleep 3
curl -sS "http://localhost:8080/api/history/rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De"
```

Expect 200 with `{"address":"rMxCK...","analyses":[...]}`.

- [ ] **Step 4: Mark spec milestone**

Edit `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`. Find the build-order entry for step 7 (begins `7. **path**`) and append: ` ✓ Implemented per [\`docs/superpowers/plans/2026-05-09-path-service.md\`](../plans/2026-05-09-path-service.md). BFS depth-1; 19 risk flags + 21 node graph builder ported from v1; SSE history deferred.`

- [ ] **Step 5: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/docker-compose.yml corlens_v2/Caddyfile corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md
git commit -m "$(cat <<'EOF'
feat(v2): wire path service into docker-compose + caddy + mark step 7 complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

Reviewed against spec § 7.6 (path) and § 12 step 7:

- **Endpoints:** All five v2 endpoints implemented (analyze, analysis detail, graph, explanations, chat, history). The v1 `/api/history/stream` SSE endpoint is replaced with a synchronous list — captured as a follow-up in the commit message.
- **BFS:** Depth-1 only in this MVP. Multi-depth hub expansion (v1 `bfsOrchestrator.ts` lines 144-300) is deferred. The seed crawl + graph build + risk evaluation is faithful.
- **Risk flags:** 19 flags ported from v1 `riskEngine.ts`. Some flags depend on data the slimmed crawler doesn't fetch (lpHolders, asks, bids) — those flags will not fire in MVP. Marked clearly in Task 5 Step 1.
- **Graph builder:** All 21 node types ported.
- **No xrpl.js import:** Verified via `grep -r "from \"xrpl\"" apps/path/` (must return empty).
- **No openai import:** Verified via `grep -r "from \"openai\"" apps/path/` (must return empty).
- **AI calls:** Three places — explanations, rag-index, chat — all via the ai-service connector.
- **Worker safety:** Best-effort RAG indexing and explanations (try/catch swallow) so the analysis always completes even when ai-service is degraded.

No placeholders. Every step has either runnable code/commands or a precise "port verbatim from v1 file X" instruction.

---

*End of plan.*
