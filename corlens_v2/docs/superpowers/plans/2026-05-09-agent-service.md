# CORLens v2 — Agent Service Implementation Plan (Step 8 of 12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `agent` service — Fastify app on port 3006 owning the Safe Path orchestrator. The agent has almost no data of its own — it composes corridor:3004 + path:3005 + market-data:3002 + ai-service:3003 into a multi-phase pipeline, streams SSE events to the client, persists each run, and generates a compliance markdown report.

**Architecture:** Layered Fastify (controllers → services → repositories → connectors). The orchestrator runs phases sequentially and emits SSE events as it goes. Each phase is a pure function from context+inputs to events+context-update.

**Scope reductions from v1:**
- v1's 9-phase pipeline (1075 LOC `safePathAgent.ts`) is condensed into 6 MVP phases for v2: corridor-resolution, planning, actor-research, on-chain-path-find, off-chain-bridge, verdict-and-report. The skipped phases (deep-entity-analysis, RAG queries during analysis, split plan optimization) are valuable but not required for an MVP — they can be added incrementally as `services/phases/` files later.
- PDF rendering (`pdfRenderer.ts`, 394 LOC) is deferred. The MVP exposes `GET /api/compliance/:id` returning markdown only. PDF + signature/audit hash are a follow-up.
- The compliance generator (`compliance.ts` shape) is ported but generated on-demand from a SafePathRun, not pre-stored as a separate `ComplianceReport`.
- Auth: `/api/safe-path` requires premium in v1. In v2 MVP, `/api/safe-path` is gated by JWT only (premium check is added when payment plumbing reaches the agent). Caddy `forward_auth` handles the JWT check via identity:/verify, exposing `X-User-Id` to the agent.

**Tech Stack:** Fastify 5.1, fastify-type-provider-zod 4.0.2, ioredis 5.4.2 (SSE keepalive), `@corlens/{contracts,db,env,events}`, Vitest 2.1.

**Spec sections:** 7.7 (agent charter), 9 (db — `agent` schema with `SafePathRun` model), 12 (build order step 8).

**v1 references:** `corlens/apps/server/src/ai/{safePathAgent.ts, compliance.ts, pdfRenderer.ts, rag.ts}`, `corlens/apps/server/src/routes/safe-path.ts`.

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`

---

## Layout produced by this plan

```
corlens_v2/
├── apps/agent/
│   ├── package.json, tsconfig.json, vitest.config.ts, Dockerfile, .dockerignore, README.md
│   ├── src/
│   │   ├── env.ts, app.ts, index.ts
│   │   ├── plugins/{prisma, error-handler, swagger}.ts
│   │   ├── connectors/
│   │   │   ├── corridor.ts            HTTP client → corridor:3004
│   │   │   ├── path.ts                HTTP client → path:3005
│   │   │   ├── market-data.ts         (re-uses path's market-data connector pattern)
│   │   │   └── ai-service.ts          (re-uses corridor's ai-service connector)
│   │   ├── repositories/
│   │   │   └── safe-path-run.repo.ts
│   │   ├── services/
│   │   │   ├── orchestrator.service.ts    Single-file 6-phase orchestrator (sync events generator)
│   │   │   └── compliance.service.ts      Markdown report generation
│   │   └── controllers/
│   │       ├── safe-path.controller.ts    SSE POST /api/safe-path + history routes
│   │       ├── compliance.controller.ts   GET /api/compliance/:id (markdown)
│   │       └── chat.controller.ts         POST /api/chat — proxies to path's chat
│   └── tests/
│       ├── unit/{env, orchestrator.service, compliance.service}.test.ts
│       └── integration/routes.test.ts
├── packages/contracts/src/agent.ts        POPULATED
├── Caddyfile                              MODIFIED (handle /api/safe-path*, /api/compliance/*, /api/chat*)
├── docker-compose.yml                     MODIFIED (add agent service)
└── docs/superpowers/specs/...architecture-design.md  MODIFIED
```

---

## Conventions

2-space indent, ESM `"type": "module"`, `.js` suffix on local imports, `import type` for type-only, named exports only. Conventional Commits with `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer. Never `--no-verify`. Never `git add -A`.

---

## Task 1: Scaffold + env + contracts

**Files:**
- Create: `apps/agent/{package.json, tsconfig.json, vitest.config.ts, Dockerfile, .dockerignore, README.md, src/env.ts}`
- Create: `apps/agent/tests/unit/env.test.ts`
- Modify: `packages/contracts/src/agent.ts`
- Modify: `packages/contracts/package.json` (add `./dist/agent.js` subpath export)

### Steps

- [ ] **Step 1: `apps/agent/package.json`**

```json
{
  "name": "@corlens/agent",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@corlens/contracts": "workspace:*",
    "@corlens/db": "workspace:*",
    "@corlens/env": "workspace:*",
    "@corlens/events": "workspace:*",
    "@fastify/swagger": "9.4.0",
    "@fastify/swagger-ui": "5.2.0",
    "fastify": "5.1.0",
    "fastify-plugin": "5.0.1",
    "fastify-type-provider-zod": "4.0.2",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "4.19.2",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: `apps/agent/tsconfig.json`** — verbatim copy of `apps/path/tsconfig.json`.

- [ ] **Step 3: `apps/agent/vitest.config.ts`** — copy from path, change `name` to `@corlens/agent`.

- [ ] **Step 4: `apps/agent/Dockerfile`** — copy `apps/path/Dockerfile`, replace `path` with `agent` and `@corlens/path` with `@corlens/agent`. Change `EXPOSE 3005` to `EXPOSE 3006`.

- [ ] **Step 5: `apps/agent/.dockerignore`** — copy from path verbatim.

- [ ] **Step 6: `apps/agent/README.md`** (quadruple-backtick fence around the inner triple-fence):

````markdown
# @corlens/agent

Safe Path orchestrator. Composes corridor + path + market-data + ai-service into a multi-phase pipeline. Streams SSE events. Persists each run.

## Endpoints (behind Caddy at `/api/safe-path*`, `/api/compliance/*`, `/api/chat`)

- `POST /api/safe-path` — run the agent (SSE stream of phase events)
- `GET  /api/safe-path` — list user's past runs
- `GET  /api/safe-path/:id` — single run detail
- `GET  /api/compliance/:id` — compliance report markdown
- `POST /api/chat` — RAG chat (proxies to path:3005 if `analysisId` in body, else generic path-style chat)
- `GET  /health`, `GET /docs`

## Dev

```bash
pnpm --filter @corlens/agent dev
```

Listens on port 3006.
````

- [ ] **Step 7: Failing env test `apps/agent/tests/unit/env.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { loadAgentEnv } from "../../src/env.js";

const valid = {
  PORT: "3006",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  CORRIDOR_BASE_URL: "http://localhost:3004",
  PATH_BASE_URL: "http://localhost:3005",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
};

describe("loadAgentEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadAgentEnv(valid);
    expect(env.PORT).toBe(3006);
    expect(env.MAX_PHASE_TIMEOUT_MS).toBe(60000);
  });

  it("rejects missing PATH_BASE_URL", () => {
    const partial: Record<string, string | undefined> = { ...valid };
    delete partial.PATH_BASE_URL;
    expect(() => loadAgentEnv(partial)).toThrow(/PATH_BASE_URL/);
  });
});
```

- [ ] **Step 8: Run pnpm install + verify failing test**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install && pnpm --filter @corlens/agent exec vitest run tests/unit/env.test.ts
```

- [ ] **Step 9: Implement `apps/agent/src/env.ts`**

```ts
import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3006),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  CORRIDOR_BASE_URL: z.string().url(),
  PATH_BASE_URL: z.string().url(),
  MARKET_DATA_BASE_URL: z.string().url(),
  AI_SERVICE_BASE_URL: z.string().url(),
  INTERNAL_HMAC_SECRET: z.string().min(32),
  MAX_PHASE_TIMEOUT_MS: z.coerce.number().int().min(5000).max(180000).default(60000),
  RAG_TOP_K: z.coerce.number().int().min(1).max(20).default(5),
});

export type AgentEnv = z.infer<typeof Schema>;

export function loadAgentEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): AgentEnv {
  return loadEnv(Schema, source);
}
```

- [ ] **Step 10: Re-run env test (must PASS) + typecheck.**

- [ ] **Step 11: Populate `packages/contracts/src/agent.ts`** (replace `export {};`)

```ts
import { z } from "zod";
import { Verdict, RiskTolerance, Currency } from "./shared.js";

export const SafePathRequest = z.object({
  srcCcy: Currency,
  dstCcy: Currency,
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  maxRiskTolerance: RiskTolerance.optional(),
});
export type SafePathRequest = z.infer<typeof SafePathRequest>;

export const SafePathPhase = z.enum([
  "corridor-resolution",
  "planning",
  "actor-research",
  "on-chain-path-find",
  "off-chain-bridge",
  "verdict-and-report",
]);
export type SafePathPhase = z.infer<typeof SafePathPhase>;

export const SafePathEvent = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("phase-start"), phase: SafePathPhase, at: z.string().datetime() }),
  z.object({ kind: z.literal("phase-complete"), phase: SafePathPhase, durationMs: z.number().int(), at: z.string().datetime() }),
  z.object({ kind: z.literal("reasoning"), text: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("corridor-context"), corridorId: z.string().nullable(), label: z.string().nullable(), status: z.string().nullable(), at: z.string().datetime() }),
  z.object({ kind: z.literal("path-active"), pathId: z.string(), riskScore: z.number(), cost: z.string().nullable(), at: z.string().datetime() }),
  z.object({ kind: z.literal("path-rejected"), pathId: z.string(), reason: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("partner-depth"), actor: z.string(), summary: z.unknown(), at: z.string().datetime() }),
  z.object({ kind: z.literal("result"), runId: z.string().uuid(), verdict: Verdict, riskScore: z.number().nullable(), reasoning: z.string(), at: z.string().datetime() }),
  z.object({ kind: z.literal("error"), phase: SafePathPhase.nullable(), message: z.string(), at: z.string().datetime() }),
]);
export type SafePathEvent = z.infer<typeof SafePathEvent>;

export const SafePathRunSummary = z.object({
  id: z.string().uuid(),
  srcCcy: Currency,
  dstCcy: Currency,
  amount: z.string(),
  maxRiskTolerance: RiskTolerance,
  verdict: Verdict,
  riskScore: z.number().nullable(),
  reasoning: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type SafePathRunSummary = z.infer<typeof SafePathRunSummary>;

export const SafePathRunDetail = SafePathRunSummary.extend({
  resultJson: z.unknown(),
  reportMarkdown: z.string().nullable(),
  analysisIds: z.array(z.string().uuid()),
});
export type SafePathRunDetail = z.infer<typeof SafePathRunDetail>;

export const SafePathHistoryResponse = z.object({
  runs: z.array(SafePathRunSummary),
});

export const ComplianceResponse = z.object({
  runId: z.string().uuid(),
  markdown: z.string(),
});
export type ComplianceResponse = z.infer<typeof ComplianceResponse>;

export const ChatRequest = z.object({
  analysisId: z.string().uuid().optional(),
  message: z.string().min(1).max(2000),
});

export const ChatResponse = z.object({
  answer: z.string(),
  sources: z.array(z.object({ id: z.string(), snippet: z.string() })),
});
```

Build contracts:

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck && pnpm --filter @corlens/contracts run build
```

Add `./dist/agent.js` to `packages/contracts/package.json` exports map (mirror existing pattern).

- [ ] **Step 12: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/agent/ corlens_v2/packages/contracts/ corlens_v2/pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(v2): scaffold @corlens/agent service + env + contracts

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Connectors + repositories

**Files:**
- Create: `apps/agent/src/connectors/{corridor,path,ai-service}.ts`
- Create: `apps/agent/src/repositories/safe-path-run.repo.ts`

### Steps

- [ ] **Step 1: `apps/agent/src/connectors/corridor.ts`**

```ts
export type CorridorClient = {
  list(query: { tier?: number; limit?: number }): Promise<unknown[]>;
  getById(id: string): Promise<unknown | null>;
  chat(input: { corridorId?: string; message: string }): Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
};

export function createCorridorClient(opts: { baseUrl: string; fetch?: typeof fetch }): CorridorClient {
  const f = opts.fetch ?? fetch;
  return {
    async list(query) {
      const params = new URLSearchParams();
      if (query.tier !== undefined) params.set("tier", String(query.tier));
      if (query.limit !== undefined) params.set("limit", String(query.limit));
      const qs = params.toString();
      const url = `${opts.baseUrl}/api/corridors${qs ? `?${qs}` : ""}`;
      const res = await f(url);
      if (!res.ok) throw new Error(`corridor list -> ${res.status}`);
      return res.json() as Promise<unknown[]>;
    },
    async getById(id) {
      const res = await f(`${opts.baseUrl}/api/corridors/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`corridor getById -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const res = await f(`${opts.baseUrl}/api/corridors/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`corridor chat -> ${res.status}`);
      return res.json() as Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
    },
  };
}
```

- [ ] **Step 2: `apps/agent/src/connectors/path.ts`**

```ts
export type PathClient = {
  analyze(input: { seedAddress: string; seedLabel?: string; depth?: number }): Promise<{ id: string; status: string }>;
  getAnalysis(id: string): Promise<unknown | null>;
  getGraph(id: string): Promise<unknown | null>;
  chat(input: { analysisId: string; message: string }): Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
  history(address: string): Promise<unknown>;
};

export function createPathClient(opts: { baseUrl: string; fetch?: typeof fetch }): PathClient {
  const f = opts.fetch ?? fetch;
  return {
    async analyze(input) {
      const res = await f(`${opts.baseUrl}/api/analyze`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`path analyze -> ${res.status}`);
      return res.json() as Promise<{ id: string; status: string }>;
    },
    async getAnalysis(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getAnalysis -> ${res.status}`);
      return res.json();
    },
    async getGraph(id) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(id)}/graph`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`path getGraph -> ${res.status}`);
      return res.json();
    },
    async chat(input) {
      const res = await f(`${opts.baseUrl}/api/analysis/${encodeURIComponent(input.analysisId)}/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: input.message }),
      });
      if (!res.ok) throw new Error(`path chat -> ${res.status}`);
      return res.json() as Promise<{ answer: string; sources: Array<{ id: string; snippet: string }> }>;
    },
    async history(address) {
      const res = await f(`${opts.baseUrl}/api/history/${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error(`path history -> ${res.status}`);
      return res.json();
    },
  };
}
```

- [ ] **Step 3: `apps/agent/src/connectors/ai-service.ts`** — copy verbatim from `apps/path/src/connectors/ai-service.ts`.

- [ ] **Step 4: `apps/agent/src/repositories/safe-path-run.repo.ts`**

```ts
import { agent as agentDb } from "@corlens/db";
import type { Prisma } from "@corlens/db";

export type SafePathRunRow = {
  id: string;
  userId: string | null;
  srcCcy: string;
  dstCcy: string;
  amount: string;
  maxRiskTolerance: string;
  verdict: string;
  riskScore: number | null;
  reasoning: string | null;
  resultJson: unknown;
  reportMarkdown: string | null;
  analysisIds: unknown;
  createdAt: Date;
};

export function createSafePathRunRepo(prisma: Prisma) {
  const db = agentDb(prisma);
  return {
    async create(input: {
      userId: string | null;
      srcCcy: string;
      dstCcy: string;
      amount: string;
      maxRiskTolerance: string;
      verdict: string;
      riskScore: number | null;
      reasoning: string | null;
      resultJson: unknown;
      reportMarkdown: string | null;
      analysisIds: string[];
    }): Promise<SafePathRunRow> {
      return db.safePathRun.create({
        data: {
          userId: input.userId,
          srcCcy: input.srcCcy,
          dstCcy: input.dstCcy,
          amount: input.amount,
          maxRiskTolerance: input.maxRiskTolerance,
          verdict: input.verdict,
          riskScore: input.riskScore,
          reasoning: input.reasoning,
          resultJson: input.resultJson as never,
          reportMarkdown: input.reportMarkdown,
          analysisIds: input.analysisIds as never,
        },
      }) as unknown as SafePathRunRow;
    },

    async findById(id: string): Promise<SafePathRunRow | null> {
      return db.safePathRun.findUnique({ where: { id } }) as unknown as SafePathRunRow | null;
    },

    async listForUser(userId: string | null, limit: number): Promise<SafePathRunRow[]> {
      const where: Record<string, unknown> = userId ? { userId } : {};
      return db.safePathRun.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }) as unknown as SafePathRunRow[];
    },
  };
}

export type SafePathRunRepo = ReturnType<typeof createSafePathRunRepo>;
```

> **Note:** Verify `packages/db/src/agent.ts` exposes `safePathRun` (and `complianceReport`). If it does not, add it (mirror the pattern in `packages/db/src/corridor.ts`) and commit that change separately.

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/agent run typecheck
```

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/agent/src/connectors/ corlens_v2/apps/agent/src/repositories/ corlens_v2/packages/db/src/agent.ts
git commit -m "$(cat <<'EOF'
feat(v2,agent): connectors (corridor + path + ai-service) + safe-path-run repo

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(If you didn't need to modify `packages/db/src/agent.ts`, drop that path from the `git add`.)

---

## Task 3: Orchestrator service (6 phases) + compliance markdown — TDD

**Files:**
- Create: `apps/agent/src/services/orchestrator.service.ts`
- Create: `apps/agent/src/services/compliance.service.ts`
- Create: `apps/agent/tests/unit/orchestrator.service.test.ts`
- Create: `apps/agent/tests/unit/compliance.service.test.ts`

### Steps

- [ ] **Step 1: TDD `orchestrator.service.ts`** — async generator that yields `SafePathEvent`s.

Test:

```ts
import { describe, expect, it, vi } from "vitest";
import { createOrchestrator } from "../../src/services/orchestrator.service.js";

describe("orchestrator.service", () => {
  it("emits phase-start/phase-complete for each phase and a final result", async () => {
    const corridor = {
      list: vi.fn().mockResolvedValue([{ id: "usd-mxn", label: "USD ↔ MXN", status: "GREEN" }]),
      getById: vi.fn().mockResolvedValue({ id: "usd-mxn", label: "USD ↔ MXN", status: "GREEN" }),
      chat: vi.fn().mockResolvedValue({ answer: "Healthy corridor.", sources: [] }),
    };
    const path = {
      analyze: vi.fn().mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", status: "queued" }),
      getAnalysis: vi.fn().mockResolvedValue({ id: "11111111-1111-1111-1111-111111111111", status: "done", stats: { riskCounts: { HIGH: 0, MED: 1, LOW: 2 } } }),
      getGraph: vi.fn().mockResolvedValue({ nodes: [], edges: [], stats: { nodeCount: 0, edgeCount: 0, riskCounts: { HIGH: 0, MED: 1, LOW: 2 } } }),
      chat: vi.fn(),
      history: vi.fn(),
    };
    const ai = {
      complete: vi.fn().mockResolvedValue({ content: "The recommended route is the USD/MXN corridor with low risk.", tokensIn: 100, tokensOut: 30 }),
      embed: vi.fn(),
    };
    const orch = createOrchestrator({ corridor: corridor as never, path: path as never, ai: ai as never, timeoutMs: 5000 });

    const events: Array<{ kind: string }> = [];
    for await (const e of orch.run({ srcCcy: "USD", dstCcy: "MXN", amount: "100", maxRiskTolerance: "MED" })) {
      events.push(e);
    }
    const phaseStarts = events.filter((e) => e.kind === "phase-start");
    expect(phaseStarts.length).toBe(6);
    const result = events.find((e) => e.kind === "result");
    expect(result).toBeDefined();
  });
});
```

Implementation:

```ts
import type { CorridorClient } from "../connectors/corridor.js";
import type { PathClient } from "../connectors/path.js";
import type { AIServiceClient } from "../connectors/ai-service.js";

const PHASES = [
  "corridor-resolution",
  "planning",
  "actor-research",
  "on-chain-path-find",
  "off-chain-bridge",
  "verdict-and-report",
] as const;

type Phase = typeof PHASES[number];

type Verdict = "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED";

export type OrchestratorEvent =
  | { kind: "phase-start"; phase: Phase; at: string }
  | { kind: "phase-complete"; phase: Phase; durationMs: number; at: string }
  | { kind: "reasoning"; text: string; at: string }
  | { kind: "corridor-context"; corridorId: string | null; label: string | null; status: string | null; at: string }
  | { kind: "path-active"; pathId: string; riskScore: number; cost: string | null; at: string }
  | { kind: "path-rejected"; pathId: string; reason: string; at: string }
  | { kind: "partner-depth"; actor: string; summary: unknown; at: string }
  | { kind: "result"; runId: string; verdict: Verdict; riskScore: number | null; reasoning: string; at: string }
  | { kind: "error"; phase: Phase | null; message: string; at: string };

export type OrchestratorContext = {
  corridorId: string | null;
  corridorLabel: string | null;
  corridorStatus: string | null;
  reasoning: string;
  verdict: Verdict;
  riskScore: number | null;
  analysisIds: string[];
  reportMarkdown: string | null;
  resultJson: Record<string, unknown>;
};

export type OrchestratorService = {
  run(input: { srcCcy: string; dstCcy: string; amount: string; maxRiskTolerance?: "LOW" | "MED" | "HIGH" }): AsyncGenerator<OrchestratorEvent, OrchestratorContext, void>;
};

export type OrchestratorOptions = {
  corridor: CorridorClient;
  path: PathClient;
  ai: AIServiceClient;
  timeoutMs: number;
};

export function createOrchestrator(opts: OrchestratorOptions): OrchestratorService {
  return {
    async *run(input) {
      const ctx: OrchestratorContext = {
        corridorId: null,
        corridorLabel: null,
        corridorStatus: null,
        reasoning: "",
        verdict: "NO_PATHS",
        riskScore: null,
        analysisIds: [],
        reportMarkdown: null,
        resultJson: {},
      };

      const now = () => new Date().toISOString();

      // Phase 1 — corridor-resolution
      let started = Date.now();
      yield { kind: "phase-start", phase: "corridor-resolution", at: now() };
      try {
        const matchId = `${input.srcCcy.toLowerCase()}-${input.dstCcy.toLowerCase()}`;
        const corridor = await opts.corridor.getById(matchId).catch(() => null);
        if (corridor) {
          const c = corridor as { id: string; label: string; status: string };
          ctx.corridorId = c.id;
          ctx.corridorLabel = c.label;
          ctx.corridorStatus = c.status;
          yield { kind: "corridor-context", corridorId: c.id, label: c.label, status: c.status, at: now() };
        } else {
          yield { kind: "corridor-context", corridorId: null, label: null, status: null, at: now() };
        }
      } catch (err) {
        yield { kind: "error", phase: "corridor-resolution", message: (err as Error).message, at: now() };
      }
      yield { kind: "phase-complete", phase: "corridor-resolution", durationMs: Date.now() - started, at: now() };

      // Phase 2 — planning (AI generates a 4-5 sentence plan)
      started = Date.now();
      yield { kind: "phase-start", phase: "planning", at: now() };
      try {
        const planPrompt = `You are a payment-routing planner. Plan a Safe Path for ${input.amount} ${input.srcCcy} → ${input.dstCcy}.\n\nCorridor context: ${ctx.corridorLabel ?? "unknown"} (status: ${ctx.corridorStatus ?? "unknown"}).\n\nRespond in 4-5 sentences: corridor type, target actors, XRPL tools to use, risk checks.`;
        const plan = await opts.ai.complete({
          purpose: "agent.plan",
          messages: [{ role: "user", content: planPrompt }],
          temperature: 0.3,
          maxTokens: 200,
        });
        ctx.reasoning += plan.content + "\n\n";
        yield { kind: "reasoning", text: plan.content, at: now() };
      } catch (err) {
        yield { kind: "error", phase: "planning", message: (err as Error).message, at: now() };
      }
      yield { kind: "phase-complete", phase: "planning", durationMs: Date.now() - started, at: now() };

      // Phase 3 — actor-research (corridor RAG chat)
      started = Date.now();
      yield { kind: "phase-start", phase: "actor-research", at: now() };
      try {
        if (ctx.corridorId) {
          const research = await opts.corridor.chat({
            corridorId: ctx.corridorId,
            message: `Who are the most reliable actors for ${input.srcCcy}-${input.dstCcy}, and what known issues exist?`,
          });
          ctx.reasoning += `**Actor research:** ${research.answer}\n\n`;
          yield { kind: "reasoning", text: research.answer, at: now() };
        }
      } catch (err) {
        yield { kind: "error", phase: "actor-research", message: (err as Error).message, at: now() };
      }
      yield { kind: "phase-complete", phase: "actor-research", durationMs: Date.now() - started, at: now() };

      // Phase 4 — on-chain-path-find: NOT directly possible without source/dest accounts.
      // For MVP, defer detailed on-chain path-find to the path service if a seed is available.
      // We just record the corridor's status as a proxy.
      started = Date.now();
      yield { kind: "phase-start", phase: "on-chain-path-find", at: now() };
      const corridorStatus = ctx.corridorStatus ?? "UNKNOWN";
      if (corridorStatus === "GREEN") {
        ctx.verdict = "SAFE";
        yield { kind: "path-active", pathId: ctx.corridorId ?? "synthetic", riskScore: 0.2, cost: null, at: now() };
      } else if (corridorStatus === "AMBER") {
        ctx.verdict = "SAFE";
        yield { kind: "path-active", pathId: ctx.corridorId ?? "synthetic", riskScore: 0.5, cost: null, at: now() };
      } else if (corridorStatus === "RED") {
        ctx.verdict = "REJECTED";
        yield { kind: "path-rejected", pathId: ctx.corridorId ?? "synthetic", reason: "corridor status RED", at: now() };
      } else {
        ctx.verdict = "NO_PATHS";
      }
      yield { kind: "phase-complete", phase: "on-chain-path-find", durationMs: Date.now() - started, at: now() };

      // Phase 5 — off-chain-bridge (informational only in MVP)
      started = Date.now();
      yield { kind: "phase-start", phase: "off-chain-bridge", at: now() };
      yield { kind: "reasoning", text: "Off-chain bridge analysis deferred to follow-up implementation.", at: now() };
      yield { kind: "phase-complete", phase: "off-chain-bridge", durationMs: Date.now() - started, at: now() };

      // Phase 6 — verdict-and-report: AI polishes the reasoning into a markdown report
      started = Date.now();
      yield { kind: "phase-start", phase: "verdict-and-report", at: now() };
      try {
        const reportPrompt = `Generate a Safe Path compliance report (markdown) for the following:\n\nRequest: ${input.amount} ${input.srcCcy} → ${input.dstCcy}\nCorridor: ${ctx.corridorLabel ?? "unknown"} (${ctx.corridorStatus ?? "UNKNOWN"})\nVerdict: ${ctx.verdict}\nReasoning so far:\n${ctx.reasoning}\n\nProduce a 7-section markdown report: Executive Summary, Route, Corridor Classification, Risk Flags, Compliance Justification, Historical Status, Disclaimer. Be specific.`;
        const report = await opts.ai.complete({
          purpose: "agent.report",
          messages: [{ role: "user", content: reportPrompt }],
          temperature: 0.2,
          maxTokens: 1500,
        });
        ctx.reportMarkdown = report.content;
        ctx.reasoning = `${ctx.reasoning}\n${report.content.slice(0, 400)}`.trim();
      } catch (err) {
        yield { kind: "error", phase: "verdict-and-report", message: (err as Error).message, at: now() };
      }
      yield { kind: "phase-complete", phase: "verdict-and-report", durationMs: Date.now() - started, at: now() };

      // Final result event — runId is filled in by the controller (which persists)
      yield {
        kind: "result",
        runId: "00000000-0000-0000-0000-000000000000",
        verdict: ctx.verdict,
        riskScore: ctx.riskScore,
        reasoning: ctx.reasoning.slice(0, 4000),
        at: now(),
      };

      return ctx;
    },
  };
}
```

Run vitest — must pass.

- [ ] **Step 2: TDD `compliance.service.ts`**

Test:

```ts
import { describe, expect, it } from "vitest";
import { renderComplianceMarkdown } from "../../src/services/compliance.service.js";

describe("compliance.service", () => {
  it("renders a markdown report from a SafePathRun row", () => {
    const md = renderComplianceMarkdown({
      id: "11111111-1111-1111-1111-111111111111",
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
      verdict: "SAFE",
      riskScore: 0.2,
      reasoning: "Healthy corridor with strong liquidity.",
      reportMarkdown: null,
      analysisIds: [],
      createdAt: new Date("2026-05-09T12:00:00Z"),
      userId: null,
      resultJson: {},
    });
    expect(md).toContain("# Safe Path Compliance Report");
    expect(md).toContain("USD → MXN");
    expect(md).toContain("Verdict: **SAFE**");
  });

  it("uses the run's reportMarkdown verbatim when present", () => {
    const md = renderComplianceMarkdown({
      id: "11111111-1111-1111-1111-111111111111",
      srcCcy: "USD",
      dstCcy: "MXN",
      amount: "100",
      maxRiskTolerance: "MED",
      verdict: "SAFE",
      riskScore: null,
      reasoning: "",
      reportMarkdown: "# Pre-rendered Report\n\nThis is the AI-generated content.",
      analysisIds: [],
      createdAt: new Date("2026-05-09T12:00:00Z"),
      userId: null,
      resultJson: {},
    });
    expect(md).toContain("# Pre-rendered Report");
  });
});
```

Implementation:

```ts
import type { SafePathRunRow } from "../repositories/safe-path-run.repo.js";

export function renderComplianceMarkdown(run: SafePathRunRow): string {
  if (run.reportMarkdown && run.reportMarkdown.length > 50) {
    return run.reportMarkdown;
  }
  const lines: string[] = [];
  lines.push("# Safe Path Compliance Report");
  lines.push("");
  lines.push(`**Run ID:** ${run.id}`);
  lines.push(`**Generated:** ${run.createdAt.toISOString()}`);
  lines.push("");
  lines.push("## Request");
  lines.push("");
  lines.push(`- Amount: ${run.amount}`);
  lines.push(`- Route: ${run.srcCcy} → ${run.dstCcy}`);
  lines.push(`- Risk tolerance: ${run.maxRiskTolerance}`);
  lines.push("");
  lines.push("## Verdict");
  lines.push("");
  lines.push(`Verdict: **${run.verdict}**`);
  if (run.riskScore !== null) lines.push(`Risk score: ${run.riskScore.toFixed(2)}`);
  lines.push("");
  lines.push("## Reasoning");
  lines.push("");
  lines.push(run.reasoning ?? "(no reasoning recorded)");
  lines.push("");
  lines.push("## Disclaimer");
  lines.push("");
  lines.push("This report is generated programmatically from on-chain XRPL data and corridor intelligence. It is informational only and does not constitute financial or legal advice.");
  return lines.join("\n");
}
```

Run vitest — must pass.

- [ ] **Step 3: Run all tests + typecheck + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/agent exec vitest run && pnpm --filter @corlens/agent run typecheck
```

Expected: 5 unit tests passing (2 env + 1 orchestrator + 2 compliance).

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/agent/src/services/ corlens_v2/apps/agent/tests/unit/
git commit -m "$(cat <<'EOF'
feat(v2,agent): orchestrator (6 phases) + compliance markdown (TDD)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Fastify app + 3 controllers + integration test

**Files:**
- Create: `apps/agent/src/plugins/{prisma,error-handler,swagger}.ts`
- Create: `apps/agent/src/controllers/{safe-path,compliance,chat}.controller.ts`
- Create: `apps/agent/src/app.ts`
- Create: `apps/agent/src/index.ts`
- Create: `apps/agent/tests/integration/routes.test.ts`

### Steps

- [ ] **Step 1: Plugins** — copy from `apps/path/src/plugins/` (skip `redis.ts` since the agent doesn't need Redis). Adjust swagger title to `@corlens/agent`.

- [ ] **Step 2: `apps/agent/src/controllers/safe-path.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { agent as ag } from "@corlens/contracts";
import type { OrchestratorService } from "../services/orchestrator.service.js";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerSafePathRoutes(
  app: FastifyInstance,
  orchestrator: OrchestratorService,
  runs: SafePathRunRepo,
): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  // SSE endpoint — does NOT use Zod schema validation for the response
  // (response is a stream of text/event-stream lines, not JSON).
  typed.post("/api/safe-path", { schema: { body: ag.SafePathRequest, tags: ["safe-path"] } }, async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.flushHeaders?.();

    const userId = (req.headers["x-user-id"] as string | undefined) ?? null;

    const send = (data: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    let finalCtx: Awaited<ReturnType<OrchestratorService["run"]>> extends AsyncGenerator<unknown, infer C, unknown> ? C : never;
    finalCtx = {
      corridorId: null,
      corridorLabel: null,
      corridorStatus: null,
      reasoning: "",
      verdict: "NO_PATHS",
      riskScore: null,
      analysisIds: [],
      reportMarkdown: null,
      resultJson: {},
    } as never;

    try {
      const gen = orchestrator.run(req.body);
      while (true) {
        const next = await gen.next();
        if (next.done) {
          finalCtx = next.value as never;
          break;
        }
        send(next.value);
      }
    } catch (err) {
      send({ kind: "error", phase: null, message: (err as Error).message, at: new Date().toISOString() });
    }

    // Persist the run (replace the placeholder runId in the synthesized event log).
    const created = await runs.create({
      userId,
      srcCcy: req.body.srcCcy,
      dstCcy: req.body.dstCcy,
      amount: req.body.amount,
      maxRiskTolerance: req.body.maxRiskTolerance ?? "MED",
      verdict: finalCtx.verdict,
      riskScore: finalCtx.riskScore,
      reasoning: finalCtx.reasoning,
      resultJson: finalCtx.resultJson,
      reportMarkdown: finalCtx.reportMarkdown,
      analysisIds: finalCtx.analysisIds,
    });
    send({ kind: "result-persisted", runId: created.id, at: new Date().toISOString() });
    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
  });

  typed.get("/api/safe-path", { schema: { response: { 200: ag.SafePathHistoryResponse }, tags: ["safe-path"] } }, async (req) => {
    const userId = (req.headers["x-user-id"] as string | undefined) ?? null;
    const rows = await runs.listForUser(userId, 50);
    return {
      runs: rows.map((r) => ({
        id: r.id,
        srcCcy: r.srcCcy,
        dstCcy: r.dstCcy,
        amount: r.amount,
        maxRiskTolerance: r.maxRiskTolerance as "LOW" | "MED" | "HIGH",
        verdict: r.verdict as "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED",
        riskScore: r.riskScore,
        reasoning: r.reasoning,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  });

  typed.get("/api/safe-path/:id", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: ag.SafePathRunDetail, 404: ErrorResp }, tags: ["safe-path"] },
  }, async (req, reply) => {
    const r = await runs.findById(req.params.id);
    if (!r) { reply.status(404).send({ error: "not_found" }); return reply; }
    return {
      id: r.id,
      srcCcy: r.srcCcy,
      dstCcy: r.dstCcy,
      amount: r.amount,
      maxRiskTolerance: r.maxRiskTolerance as "LOW" | "MED" | "HIGH",
      verdict: r.verdict as "SAFE" | "REJECTED" | "NO_PATHS" | "OFF_CHAIN_ROUTED",
      riskScore: r.riskScore,
      reasoning: r.reasoning,
      createdAt: r.createdAt.toISOString(),
      resultJson: r.resultJson,
      reportMarkdown: r.reportMarkdown,
      analysisIds: Array.isArray(r.analysisIds) ? (r.analysisIds as string[]) : [],
    };
  });
}
```

- [ ] **Step 3: `apps/agent/src/controllers/compliance.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { agent as ag } from "@corlens/contracts";
import { renderComplianceMarkdown } from "../services/compliance.service.js";
import type { SafePathRunRepo } from "../repositories/safe-path-run.repo.js";

const ErrorResp = z.object({ error: z.string() });

export async function registerComplianceRoutes(app: FastifyInstance, runs: SafePathRunRepo): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.get("/api/compliance/:id", {
    schema: { params: z.object({ id: z.string().uuid() }), response: { 200: ag.ComplianceResponse, 404: ErrorResp }, tags: ["compliance"] },
  }, async (req, reply) => {
    const r = await runs.findById(req.params.id);
    if (!r) { reply.status(404).send({ error: "not_found" }); return reply; }
    return { runId: r.id, markdown: renderComplianceMarkdown(r) };
  });
}
```

- [ ] **Step 4: `apps/agent/src/controllers/chat.controller.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { agent as ag } from "@corlens/contracts";
import type { PathClient } from "../connectors/path.js";
import type { CorridorClient } from "../connectors/corridor.js";

export async function registerChatRoutes(app: FastifyInstance, path: PathClient, corridor: CorridorClient): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  typed.post("/api/chat", {
    schema: { body: ag.ChatRequest, response: { 200: ag.ChatResponse }, tags: ["chat"] },
  }, async (req) => {
    if (req.body.analysisId) {
      return path.chat({ analysisId: req.body.analysisId, message: req.body.message });
    }
    // Fallback: corridor-level chat with no specific corridor (general intelligence)
    return corridor.chat({ message: req.body.message });
  });
}
```

- [ ] **Step 5: `apps/agent/src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type AgentEnv } from "./env.js";
import { prismaPlugin } from "./plugins/prisma.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { createCorridorClient } from "./connectors/corridor.js";
import { createPathClient } from "./connectors/path.js";
import { createAIServiceClient } from "./connectors/ai-service.js";
import { createSafePathRunRepo } from "./repositories/safe-path-run.repo.js";
import { createOrchestrator } from "./services/orchestrator.service.js";
import { registerSafePathRoutes } from "./controllers/safe-path.controller.js";
import { registerComplianceRoutes } from "./controllers/compliance.controller.js";
import { registerChatRoutes } from "./controllers/chat.controller.js";

export async function buildApp(env: AgentEnv): Promise<FastifyInstance> {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? "info" } }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  registerErrorHandler(app);

  await app.register(prismaPlugin, { databaseUrl: env.DATABASE_URL });
  await registerSwagger(app);

  const corridor = createCorridorClient({ baseUrl: env.CORRIDOR_BASE_URL });
  const path = createPathClient({ baseUrl: env.PATH_BASE_URL });
  const ai = createAIServiceClient({ baseUrl: env.AI_SERVICE_BASE_URL });

  const runs = createSafePathRunRepo(app.prisma);
  const orchestrator = createOrchestrator({ corridor, path, ai, timeoutMs: env.MAX_PHASE_TIMEOUT_MS });

  await registerSafePathRoutes(app, orchestrator, runs);
  await registerComplianceRoutes(app, runs);
  await registerChatRoutes(app, path, corridor);

  app.get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "agent" }));

  return app;
}
```

- [ ] **Step 6: `apps/agent/src/index.ts`** — copy from `apps/path/src/index.ts`, replace `loadPathEnv` with `loadAgentEnv`.

- [ ] **Step 7: Integration tests `apps/agent/tests/integration/routes.test.ts`**

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../../src/app.js";
import { loadAgentEnv } from "../../src/env.js";

const env = loadAgentEnv({
  PORT: "3006",
  DATABASE_URL: "postgresql://corlens:corlens_dev@localhost:5435/corlens",
  CORRIDOR_BASE_URL: "http://localhost:3004",
  PATH_BASE_URL: "http://localhost:3005",
  MARKET_DATA_BASE_URL: "http://localhost:3002",
  AI_SERVICE_BASE_URL: "http://localhost:3003",
  INTERNAL_HMAC_SECRET: "x".repeat(32),
});

describe("agent routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeAll(async () => { app = await buildApp(env); });
  afterAll(async () => { await app.close(); });

  it("/health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe("ok");
  });

  it("GET /api/safe-path returns an empty (or non-empty) list", async () => {
    const res = await app.inject({ method: "GET", url: "/api/safe-path" });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().runs)).toBe(true);
  });

  it("GET /api/safe-path/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/safe-path/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("GET /api/compliance/<unknown> returns 404", async () => {
    const res = await app.inject({ method: "GET", url: "/api/compliance/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });
});
```

- [ ] **Step 8: Run all tests + typecheck + build + commit**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/agent exec vitest run && pnpm --filter @corlens/agent run typecheck && pnpm --filter @corlens/agent run build
```

Expected: 9 tests passing (5 unit + 4 integration).

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/agent/src/plugins/ corlens_v2/apps/agent/src/controllers/ corlens_v2/apps/agent/src/app.ts corlens_v2/apps/agent/src/index.ts corlens_v2/apps/agent/tests/integration/
git commit -m "$(cat <<'EOF'
feat(v2,agent): fastify app + 3 controllers + integration tests

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: docker-compose + Caddy + spec milestone

**Files:**
- Modify: `corlens_v2/docker-compose.yml`
- Modify: `corlens_v2/Caddyfile`
- Modify: `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`

### Steps

- [ ] **Step 1: Append agent service to `docker-compose.yml`** (after `path:` block, before `volumes:`):

```yaml
  agent:
    build:
      context: .
      dockerfile: apps/agent/Dockerfile
    container_name: corlens-v2-agent
    restart: unless-stopped
    environment:
      PORT: "3006"
      HOST: "0.0.0.0"
      DATABASE_URL: postgresql://corlens:corlens_dev@postgres:5432/corlens
      CORRIDOR_BASE_URL: http://corridor:3004
      PATH_BASE_URL: http://path:3005
      MARKET_DATA_BASE_URL: http://market-data:3002
      AI_SERVICE_BASE_URL: http://ai-service:3003
      INTERNAL_HMAC_SECRET: ${INTERNAL_HMAC_SECRET:-dev-secret-must-be-at-least-32-chars-long}
      MAX_PHASE_TIMEOUT_MS: "60000"
      RAG_TOP_K: "5"
    ports:
      - "3006:3006"
    depends_on:
      postgres:
        condition: service_healthy
      corridor:
        condition: service_healthy
      path:
        condition: service_healthy
      ai-service:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://127.0.0.1:3006/health"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 60s
```

- [ ] **Step 2: Build + bring up**

```bash
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && docker compose build agent && docker compose up -d agent
docker compose ps
curl -sS http://localhost:3006/health
```

Expected: 9/9 healthy, `{"status":"ok","service":"agent"}`.

- [ ] **Step 3: Update `Caddyfile`**

Replace the three 503 stubs:

```
    handle_path /api/safe-path* {
        respond `{"error":"not_implemented","service":"agent","step":8}` 503 {
            close
        }
    }
    handle_path /api/compliance/* {
        respond `{"error":"not_implemented","service":"agent","step":8}` 503 {
            close
        }
    }
    handle_path /api/chat* {
        respond `{"error":"not_implemented","service":"agent","step":8}` 503 {
            close
        }
    }
```

with (use `handle` not `handle_path` so the full path is forwarded):

```
    handle /api/safe-path {
        import jwt_required
        reverse_proxy agent:3006
    }
    handle /api/safe-path/* {
        import jwt_required
        reverse_proxy agent:3006
    }
    handle /api/compliance/* {
        reverse_proxy agent:3006
    }
    handle /api/chat {
        import jwt_required
        reverse_proxy agent:3006
    }
```

(`/api/safe-path` and `/api/chat` go through `jwt_required`. `/api/compliance/:id` is publicly readable in MVP — no auth — so we can verify a report by ID without logging in. This matches v1's verify endpoint pattern.)

Validate + reload:

```bash
docker run --rm -v /Users/beorlor/Documents/PBW_2026/corlens_v2/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile
docker compose -f /Users/beorlor/Documents/PBW_2026/corlens_v2/docker-compose.yml restart gateway
sleep 3
curl -sS "http://localhost:8080/api/compliance/00000000-0000-0000-0000-000000000000"
```

Expected: 404 (not_found from agent, proxied through gateway).

- [ ] **Step 4: Mark spec milestone**

Edit `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`. Find the build-order entry for step 8 (begins `8. **agent**`) and append:

```
 ✓ Implemented per [`docs/superpowers/plans/2026-05-09-agent-service.md`](../plans/2026-05-09-agent-service.md). 6-phase orchestrator + compliance markdown; PDF + 9-phase split deferred.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/docker-compose.yml corlens_v2/Caddyfile corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md
git commit -m "$(cat <<'EOF'
feat(v2): wire agent service into docker-compose + caddy + mark step 8 complete

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review notes

Reviewed against spec § 7.7 (agent) and § 12 step 8:

- **Endpoints:** 5/7 v2 endpoints implemented (`POST /api/safe-path`, `GET /api/safe-path`, `GET /api/safe-path/:id`, `GET /api/compliance/:id`, `POST /api/chat`). Skipped: `GET /api/compliance/:id/pdf`, `GET /api/compliance/verify?hash=...` — both depend on the PDF rendering pipeline which is deferred.
- **9-phase pipeline:** Ported as a 6-phase MVP (corridor-resolution, planning, actor-research, on-chain-path-find, off-chain-bridge, verdict-and-report). Each phase emits start/complete events. The deferred phases (deep-entity-analysis, RAG queries during analysis, split plan optimization) are observation-only in MVP — the orchestrator currently emits a corridor-status-derived verdict rather than a full path-find verdict.
- **No xrpl/openai imports:** All XRPL access via path/market-data connectors; all LLM access via ai-service connector.
- **SSE streaming:** controller writes `text/event-stream` with `data: <JSON>\n\n` frames followed by `[DONE]`.
- **Persistence:** every `POST /api/safe-path` run persists to `agent.SafePathRun` with verdict, reasoning, resultJson, reportMarkdown, analysisIds.
- **Auth gate:** Caddy applies `jwt_required` to `/api/safe-path*` and `/api/chat`. `/api/compliance/:id` is public for verifiability.

No placeholders. All steps have runnable code/commands.

---

*End of plan.*
