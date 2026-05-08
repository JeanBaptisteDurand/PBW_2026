# CORLens v2 — Market Data Service Implementation Plan (Step 4 of 12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `market-data` service — Fastify app on port 3002 that owns the **only** XRPL connection pool in v2 (rate limit budget protected), all 15 v1 XRPL fetchers exposed as typed REST endpoints, partner exchange depth (Bitso + Bitstamp + Kraken + Binance + XRPL DEX), Redis-backed cache with per-data-type TTLs, and an hourly pre-warm cron for hot accounts (RLUSD / USDC / GateHub).

**Architecture:** Layered Fastify (controllers → services → connectors), `EventBus` decoration, BullMQ for the pre-warm cron. The XRPL connector is a singleton inside the process — primary client (QuickNode + 3 fallbacks) and a separate pathfind client. All on-ledger reads go through it. Partner-depth fetchers are stateless HTTP clients with a 60-second Redis cache. `path_find` streams via SSE because it's long-running. All other endpoints are plain JSON HTTP. Caddy gets `/api/market-data/*` reverse-proxied to identity-service-style typed clients consume the typed REST surface from `@corlens/clients`.

**Tech Stack:** Fastify 5.1, `fastify-type-provider-zod` 4.0.2, `@fastify/swagger` 9.4.0, `xrpl` 4.1.0, `ioredis` 5.4.2, `bullmq` 5.30.0, `@corlens/{contracts, db, env, events, clients}` workspace packages, Vitest 2.1.

**Spec sections:** 7.3 (market-data charter), 8 (Fastify), 9 (db — uses `marketDataDb` for the optional Postgres cache table; Redis is primary), 10 (events), 12 (build order step 4), 13 (open question on web search provider — N/A here, that's step 5).

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`

---

## Layout produced by this plan

```
corlens_v2/
├── apps/market-data/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── README.md
│   ├── src/
│   │   ├── env.ts                           Zod env (PORT 3002, XRPL endpoints, Redis URL, partner toggles)
│   │   ├── index.ts                         Bootstrap
│   │   ├── app.ts                           buildApp()
│   │   ├── plugins/
│   │   │   ├── redis.ts                     ioredis decoration
│   │   │   ├── error-handler.ts             ZodError → 400
│   │   │   ├── swagger.ts                   /docs UI
│   │   │   └── xrpl.ts                      Decorates app.xrpl with the connection pool
│   │   ├── connectors/
│   │   │   ├── xrpl-client.ts               XrplClient port + RateLimitedXrplClient implementation (port v1)
│   │   │   ├── xrpl-fetchers.ts             15 typed fetcher functions delegating to XrplClient
│   │   │   ├── partner-bitso.ts             Bitso REST fetcher
│   │   │   ├── partner-bitstamp.ts          Bitstamp REST fetcher
│   │   │   ├── partner-kraken.ts            Kraken REST fetcher
│   │   │   ├── partner-binance.ts           Binance REST fetcher
│   │   │   └── partner-xrpl-dex.ts          XRPL DEX via book_offers (uses XrplClient)
│   │   ├── services/
│   │   │   ├── cache.service.ts             Redis cache wrapper (get/set with TTL, key generator)
│   │   │   ├── xrpl.service.ts              Each route's logic — fetch via cache.getOrSet around fetchers
│   │   │   └── partner-depth.service.ts     Multiplexes by `actor` enum
│   │   ├── controllers/
│   │   │   ├── xrpl.controller.ts           15 routes for XRPL ops
│   │   │   ├── partner-depth.controller.ts  /partner-depth/:actor/:book
│   │   │   └── admin.controller.ts          /admin/refresh-corridors stub (corridor service is step 6)
│   │   ├── crons/
│   │   │   └── prewarm.ts                   BullMQ repeatable job that refreshes hot accounts
│   │   └── (events/ — empty for now; market-data publishes nothing in step 4)
│   └── tests/
│       ├── unit/
│       │   ├── env.test.ts
│       │   ├── cache.service.test.ts        TDD with FakeRedis
│       │   ├── xrpl-client.test.ts          TDD: rate limiter timing + fallback selection
│       │   ├── partner-bitso.test.ts        TDD: mock fetch
│       │   └── partner-binance.test.ts      TDD: mock fetch (parsing differs from Bitso)
│       └── integration/
│           ├── health.route.test.ts         Fastify inject — /health
│           └── partner-depth.route.test.ts  Fastify inject + mocked partner clients
├── packages/contracts/src/market-data.ts    POPULATED: Zod schemas for the 15 XRPL ops + partner depth
├── Caddyfile                                MODIFIED: replace stub with reverse_proxy market-data:3002
├── docker-compose.yml                       MODIFIED: add market-data service
└── docs/superpowers/
    ├── plans/2026-05-08-market-data-service.md     this plan
    └── specs/.../...architecture-design.md         MODIFIED: mark step 4 complete
```

---

## Conventions every task MUST follow

- 2-space indent, ESM `"type": "module"`, `.js` suffix on local imports.
- `interface` only for ports (`XrplClient`, `PartnerDepthFetcher`, `EventBus`). Plain shapes use `type` or `z.infer`.
- Schemas live in `@corlens/contracts/market-data` (cross-service) — `apps/market-data/src/` may have internal Zod for routes only the service needs.
- TDD on logic-bearing files (cache service, xrpl-client rate limiter, partner fetcher response parsers). Skip TDD on declarative scaffolding and on routes that just delegate.
- Tests use Fastify `inject()`, no live network, no real XRPL connection.
- No emojis. Conventional Commits. Never `--no-verify`. Never `git add -A`.
- Comments only for non-obvious WHY (e.g., why a specific TTL, why a fallback order).

---

## Phase A — Service scaffold

### Task A1: Package files + Dockerfile + README + env

**Files:**
- Create: `corlens_v2/apps/market-data/package.json`
- Create: `corlens_v2/apps/market-data/tsconfig.json`
- Create: `corlens_v2/apps/market-data/vitest.config.ts`
- Create: `corlens_v2/apps/market-data/Dockerfile`
- Create: `corlens_v2/apps/market-data/.dockerignore`
- Create: `corlens_v2/apps/market-data/README.md`
- Create: `corlens_v2/apps/market-data/src/env.ts`
- Create: `corlens_v2/apps/market-data/tests/unit/env.test.ts`

- [ ] **Step 1: Write `apps/market-data/package.json`**

```json
{
  "name": "@corlens/market-data",
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
    "bullmq": "5.34.0",
    "fastify": "5.1.0",
    "fastify-plugin": "5.0.1",
    "fastify-type-provider-zod": "4.0.2",
    "ioredis": "5.4.2",
    "xrpl": "4.1.0",
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

- [ ] **Step 2: Write `apps/market-data/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `apps/market-data/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/market-data",
    include: ["tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: { forks: { minForks: 1, maxForks: 1 } },
  },
});
```

- [ ] **Step 4: Write `apps/market-data/Dockerfile`**

Same multi-stage pnpm pattern as identity but for market-data:

```dockerfile
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/events/package.json packages/events/
COPY packages/clients/package.json packages/clients/
COPY apps/market-data/package.json apps/market-data/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/market-data apps/market-data
RUN pnpm --filter @corlens/db exec prisma generate
RUN pnpm --filter @corlens/contracts run build
RUN pnpm --filter @corlens/db run build
RUN pnpm --filter @corlens/env run build
RUN pnpm --filter @corlens/events run build
RUN pnpm --filter @corlens/market-data run build

FROM base AS runtime
RUN apk add --no-cache wget
ENV NODE_ENV=production
RUN pnpm --version
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/market-data
EXPOSE 3002
CMD ["node", "dist/index.js"]
```

> If the `COPY --from=build /app /app` is too coarse and pulls in unwanted dev files, fall back to the `pnpm deploy` strategy used in the identity Dockerfile (commit `d9d822c`-ish). The identity Dockerfile is a working reference.

- [ ] **Step 5: Write `apps/market-data/.dockerignore`**

```
node_modules
dist
.env
.env.local
*.log
.DS_Store
tests
```

- [ ] **Step 6: Write `apps/market-data/README.md`**

Use the same fenced-block pattern as the identity README. Final content (literal):

````markdown
# @corlens/market-data

The single owner of XRPL connections in v2. Exposes typed REST routes for every XRPL on-ledger read, plus partner exchange depth (Bitso, Bitstamp, Kraken, Binance, XRPL DEX). Redis cache with per-data-type TTLs.

## Endpoints (all behind Caddy at `/api/market-data/*`)

### XRPL
- `GET /xrpl/account/:address`
- `GET /xrpl/account/:address/lines`
- `GET /xrpl/account/:address/objects`
- `GET /xrpl/account/:address/transactions`
- `GET /xrpl/account/:address/nfts`
- `GET /xrpl/account/:address/channels`
- `GET /xrpl/account/:address/offers`
- `GET /xrpl/account/:address/currencies`
- `GET /xrpl/account/:address/noripple`
- `GET /xrpl/amm/by-pair?asset1=...&asset2=...`
- `GET /xrpl/amm/by-account/:account`
- `GET /xrpl/book?takerGets=...&takerPays=...`
- `GET /xrpl/nft/:nftId/buy-offers`
- `GET /xrpl/nft/:nftId/sell-offers`
- `POST /xrpl/path-find` — SSE stream

### Partner depth
- `GET /partner-depth/:actor/:book` — actor ∈ {bitso, bitstamp, kraken, binance, xrpl-dex}

### Admin / observability
- `GET /health`
- `GET /docs`
- `POST /admin/refresh-corridors` — stub until corridor service ships in step 6

## Dev

```bash
pnpm --filter @corlens/market-data dev
```

Listens on port 3002 by default.
````

- [ ] **Step 7: Write the failing env test `tests/unit/env.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { loadMarketDataEnv } from "../../src/env.js";

const validEnv = {
  PORT: "3002",
  REDIS_URL: "redis://localhost:6381",
  XRPL_PRIMARY_RPC: "wss://xrplcluster.com",
  XRPL_PATHFIND_RPC: "wss://xrplcluster.com",
};

describe("loadMarketDataEnv", () => {
  it("parses valid env into a typed object", () => {
    const env = loadMarketDataEnv(validEnv);
    expect(env.PORT).toBe(3002);
    expect(env.PARTNER_DEPTH_TTL_SECONDS).toBe(60);
  });

  it("rejects a missing XRPL_PRIMARY_RPC", () => {
    const partial: Record<string, string | undefined> = { ...validEnv };
    delete partial.XRPL_PRIMARY_RPC;
    expect(() => loadMarketDataEnv(partial)).toThrow(/XRPL_PRIMARY_RPC/);
  });

  it("rejects a non-WS XRPL_PRIMARY_RPC", () => {
    expect(() => loadMarketDataEnv({ ...validEnv, XRPL_PRIMARY_RPC: "http://wrong" })).toThrow(/XRPL_PRIMARY_RPC/);
  });
});
```

- [ ] **Step 8: Run the test (must fail)**

Run from `corlens_v2`:
```
pnpm install
pnpm --filter @corlens/market-data exec vitest run tests/unit/env.test.ts
```
Expected: FAIL — `loadMarketDataEnv` does not exist.

- [ ] **Step 9: Implement `src/env.ts`**

```ts
import { loadEnv } from "@corlens/env";
import { z } from "zod";

const Schema = z.object({
  PORT: z.coerce.number().int().positive().default(3002),
  HOST: z.string().default("0.0.0.0"),
  REDIS_URL: z.string().url(),
  XRPL_PRIMARY_RPC: z.string().regex(/^wss?:\/\//, "must be a ws:// or wss:// URL"),
  XRPL_PATHFIND_RPC: z.string().regex(/^wss?:\/\//, "must be a ws:// or wss:// URL"),
  XRPL_RATE_LIMIT_INTERVAL_MS: z.coerce.number().int().min(1).max(1000).default(20),
  PARTNER_DEPTH_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  ACCOUNT_CACHE_TTL_SECONDS: z.coerce.number().int().min(5).max(600).default(60),
  BOOK_CACHE_TTL_SECONDS: z.coerce.number().int().min(1).max(120).default(10),
  PREWARM_ENABLED: z.preprocess((v) => v === "false" ? false : v === "true" ? true : v, z.boolean().default(true)),
  PREWARM_CRON: z.string().default("0 * * * *"),
});

export type MarketDataEnv = z.infer<typeof Schema>;

export function loadMarketDataEnv(source?: NodeJS.ProcessEnv | Record<string, string | undefined>): MarketDataEnv {
  return loadEnv(Schema, source);
}
```

- [ ] **Step 10: Run the test (must pass)**

Run: `pnpm --filter @corlens/market-data exec vitest run tests/unit/env.test.ts`
Expected: PASS — 3 tests green.

- [ ] **Step 11: Typecheck**

Run: `pnpm --filter @corlens/market-data run typecheck`
Expected: clean.

- [ ] **Step 12: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/apps/market-data/ corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): scaffold @corlens/market-data service + env loader"
```

---

## Phase B — XRPL connector (TDD on rate limit + fallback)

### Task B1: XRPL client port + implementation (TDD)

**Files:**
- Create: `corlens_v2/apps/market-data/src/connectors/xrpl-client.ts`
- Create: `corlens_v2/apps/market-data/tests/unit/xrpl-client.test.ts`

The port: `XrplClient` interface with `request(command, params)`, `pathFind(params)`, `connect()`, `disconnect()`, `isConnected()`. The implementation wraps `xrpl.js` `Client`, with rate limiting and 4-endpoint fallback.

For TDD, we test the rate limiter and the fallback selection logic in isolation by injecting a fake `Client` factory.

- [ ] **Step 1: Write the failing test `tests/unit/xrpl-client.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { createXrplClient, type ClientFactory } from "../../src/connectors/xrpl-client.js";

class FakeClient {
  isConnected_ = true;
  requestCalls: Array<{ command: string; params: unknown }> = [];
  fail: boolean | "load" = false;
  isConnected() { return this.isConnected_; }
  async connect() {}
  async disconnect() { this.isConnected_ = false; }
  async request(payload: { command: string }) {
    this.requestCalls.push({ command: payload.command, params: payload });
    if (this.fail === "load") {
      return { result: {}, warning: "load" };
    }
    if (this.fail) {
      throw new Error("WebSocket is not open");
    }
    return { result: { ok: true } };
  }
}

describe("xrpl-client", () => {
  it("connects to the first endpoint that succeeds", async () => {
    const fakes = [new FakeClient(), new FakeClient()];
    const factory: ClientFactory = vi.fn((url: string) => {
      if (url.includes("primary")) return fakes[0] as never;
      return fakes[1] as never;
    });
    const client = createXrplClient({
      primaryEndpoints: ["wss://primary.example", "wss://fallback.example"],
      pathfindEndpoints: ["wss://primary.example"],
      rateLimitIntervalMs: 5,
      clientFactory: factory,
    });
    await client.connect();
    expect(factory).toHaveBeenCalledWith("wss://primary.example", expect.anything());
  });

  it("falls back to the next endpoint when the first one's connect throws", async () => {
    const failing = new FakeClient();
    failing.connect = async () => { throw new Error("boom"); };
    const ok = new FakeClient();
    const factory: ClientFactory = vi.fn((url: string) => (url.includes("primary") ? failing : ok) as never);
    const client = createXrplClient({
      primaryEndpoints: ["wss://primary.example", "wss://fallback.example"],
      pathfindEndpoints: ["wss://primary.example"],
      rateLimitIntervalMs: 5,
      clientFactory: factory,
      maxConnectRetries: 1,
    });
    await client.connect();
    expect(factory).toHaveBeenCalledWith("wss://primary.example", expect.anything());
    expect(factory).toHaveBeenCalledWith("wss://fallback.example", expect.anything());
  });

  it("enforces minimum interval between requests", async () => {
    const fake = new FakeClient();
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 50,
      clientFactory: () => fake as never,
    });
    await client.connect();
    const start = Date.now();
    await client.request("account_info", { account: "rA" });
    await client.request("account_info", { account: "rB" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
    expect(fake.requestCalls).toHaveLength(2);
  });

  it("retries transient errors", async () => {
    const fake = new FakeClient();
    const real = fake.request.bind(fake);
    let calls = 0;
    fake.request = async (p: { command: string }) => {
      calls += 1;
      if (calls === 1) throw new Error("WebSocket is not open");
      return real(p);
    };
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 1,
      clientFactory: () => fake as never,
    });
    await client.connect();
    const out = await client.request("account_info", { account: "rA" });
    expect(out).toEqual({ result: { ok: true } });
    expect(calls).toBe(2);
  });

  it("backs off on server load warning", async () => {
    const fake = new FakeClient();
    fake.fail = "load";
    const client = createXrplClient({
      primaryEndpoints: ["wss://x"],
      pathfindEndpoints: ["wss://x"],
      rateLimitIntervalMs: 5,
      clientFactory: () => fake as never,
      loadWarningBackoffMs: 50,
    });
    await client.connect();
    await client.request("account_info", { account: "rA" });
    fake.fail = false;
    const start = Date.now();
    await client.request("account_info", { account: "rB" });
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });
});
```

- [ ] **Step 2: Run the test (must fail)**

Run: `pnpm --filter @corlens/market-data exec vitest run tests/unit/xrpl-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/connectors/xrpl-client.ts`**

```ts
import { Client } from "xrpl";

export interface XrplClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  request(command: string, params?: Record<string, unknown>): Promise<unknown>;
  pathFind(params: Record<string, unknown>): Promise<unknown>;
}

export type ClientFactory = (url: string, options: { timeout: number }) => Client;

export type XrplClientOptions = {
  primaryEndpoints: string[];
  pathfindEndpoints: string[];
  rateLimitIntervalMs: number;
  clientFactory?: ClientFactory;
  maxConnectRetries?: number;
  connectRetryBaseMs?: number;
  requestRetryCount?: number;
  requestRetryDelayMs?: number;
  loadWarningBackoffMs?: number;
  loadWarningResetMs?: number;
};

const defaultFactory: ClientFactory = (url, opts) => new Client(url, opts);

export function createXrplClient(opts: XrplClientOptions): XrplClient {
  const factory = opts.clientFactory ?? defaultFactory;
  const maxConnectRetries = opts.maxConnectRetries ?? 3;
  const connectRetryBaseMs = opts.connectRetryBaseMs ?? 2_000;
  const requestRetryCount = opts.requestRetryCount ?? 2;
  const requestRetryDelayMs = opts.requestRetryDelayMs ?? 1_000;
  const loadWarningBackoffMs = opts.loadWarningBackoffMs ?? 2_000;
  const loadWarningResetMs = opts.loadWarningResetMs ?? 10_000;

  let primary: Client | null = null;
  let pathfind: Client | null = null;
  let primaryLast = 0;
  let pathfindLast = 0;
  let loadWarningActive = false;

  async function connectWithFallback(endpoints: string[]): Promise<Client> {
    for (let i = 0; i < endpoints.length; i++) {
      const url = endpoints[i] as string;
      for (let attempt = 1; attempt <= maxConnectRetries; attempt++) {
        try {
          const client = factory(url, { timeout: 30_000 });
          await client.connect();
          if (!client.isConnected()) throw new Error("dropped after connect");
          return client;
        } catch (err) {
          if (attempt < maxConnectRetries) {
            const delay = connectRetryBaseMs * 2 ** (attempt - 1);
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }
          if (i === endpoints.length - 1) throw err;
        }
      }
    }
    throw new Error("all endpoints exhausted");
  }

  async function rateLimited(client: Client, lastRef: { v: number }, command: string, params?: Record<string, unknown>): Promise<unknown> {
    const interval = loadWarningActive ? loadWarningBackoffMs : opts.rateLimitIntervalMs;
    const elapsed = Date.now() - lastRef.v;
    if (elapsed < interval) {
      await new Promise((r) => setTimeout(r, interval - elapsed));
    }
    lastRef.v = Date.now();

    for (let attempt = 1; attempt <= requestRetryCount; attempt++) {
      try {
        const resp = (await client.request({ command, ...params } as never)) as { warning?: string };
        if (resp?.warning === "load") {
          loadWarningActive = true;
          setTimeout(() => { loadWarningActive = false; }, loadWarningResetMs);
        } else if (loadWarningActive) {
          loadWarningActive = false;
        }
        return resp;
      } catch (err) {
        const msg = (err as Error).message ?? "";
        const transient = ["WebSocket is not open", "CONNECTING", "IP limit", "threshold exceeded", "overloaded"].some((s) => msg.includes(s));
        if (!transient || attempt >= requestRetryCount) throw err;
        await new Promise((r) => setTimeout(r, requestRetryDelayMs * attempt));
      }
    }
    throw new Error(`all retries failed for ${command}`);
  }

  return {
    async connect() {
      primary = await connectWithFallback(opts.primaryEndpoints);
      pathfind = opts.pathfindEndpoints.join(",") === opts.primaryEndpoints.join(",")
        ? primary
        : await connectWithFallback(opts.pathfindEndpoints);
    },
    async disconnect() {
      await Promise.allSettled([primary?.disconnect(), pathfind && pathfind !== primary ? pathfind.disconnect() : Promise.resolve()]);
      primary = null;
      pathfind = null;
    },
    isConnected() {
      return !!primary?.isConnected() && !!pathfind?.isConnected();
    },
    async request(command, params) {
      if (!primary) throw new Error("not connected");
      const lastRef = { v: primaryLast };
      const result = await rateLimited(primary, lastRef, command, params);
      primaryLast = lastRef.v;
      return result;
    },
    async pathFind(params) {
      if (!pathfind) throw new Error("not connected");
      const lastRef = { v: pathfindLast };
      const result = await rateLimited(pathfind, lastRef, "ripple_path_find", params);
      pathfindLast = lastRef.v;
      return result;
    },
  };
}
```

- [ ] **Step 4: Run the test (must pass)**

Run: `pnpm --filter @corlens/market-data exec vitest run tests/unit/xrpl-client.test.ts`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @corlens/market-data run typecheck`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/apps/market-data/src/connectors/xrpl-client.ts corlens_v2/apps/market-data/tests/unit/xrpl-client.test.ts
git commit -m "feat(v2,market-data): xrpl client with rate limit + fallback (TDD)"
```

---

## Phase C — Cache + XRPL fetchers + routes

### Task C1: Cache service (TDD)

**Files:**
- Create: `corlens_v2/apps/market-data/src/services/cache.service.ts`
- Create: `corlens_v2/apps/market-data/tests/unit/cache.service.test.ts`

- [ ] **Step 1: Write the failing test `tests/unit/cache.service.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { createCacheService } from "../../src/services/cache.service.js";

class FakeRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();
  async get(key: string): Promise<string | null> {
    const e = this.store.get(key);
    if (!e) return null;
    if (Date.now() > e.expiresAt) { this.store.delete(key); return null; }
    return e.value;
  }
  async set(key: string, value: string, mode: "EX", ttl: number): Promise<"OK"> {
    this.store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    return "OK";
  }
}

describe("cache.service", () => {
  it("returns cached value when present", async () => {
    const r = new FakeRedis();
    await r.set("k", JSON.stringify({ x: 1 }), "EX", 60);
    const cache = createCacheService({ redis: r as never });
    const fetcher = vi.fn(async () => ({ x: 999 }));
    const result = await cache.getOrSet("k", 60, fetcher);
    expect(result).toEqual({ x: 1 });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("calls fetcher and stores result on miss", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never });
    const fetcher = vi.fn(async () => ({ y: 2 }));
    const result = await cache.getOrSet("k", 60, fetcher);
    expect(result).toEqual({ y: 2 });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await r.get("k")).toBe(JSON.stringify({ y: 2 }));
  });

  it("does not cache when fetcher throws", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never });
    await expect(cache.getOrSet("k", 60, async () => { throw new Error("fail"); })).rejects.toThrow("fail");
    expect(await r.get("k")).toBeNull();
  });

  it("namespaces keys with the given prefix", async () => {
    const r = new FakeRedis();
    const cache = createCacheService({ redis: r as never, prefix: "md:" });
    await cache.getOrSet("foo", 60, async () => 1);
    expect(await r.get("md:foo")).toBe("1");
  });
});
```

- [ ] **Step 2: Run the test (must fail)**

Run: `pnpm --filter @corlens/market-data exec vitest run tests/unit/cache.service.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/services/cache.service.ts`**

```ts
import type { Redis } from "ioredis";

export type CacheServiceOptions = {
  redis: Redis;
  prefix?: string;
};

export type CacheService = ReturnType<typeof createCacheService>;

export function createCacheService(opts: CacheServiceOptions) {
  const prefix = opts.prefix ?? "";

  return {
    async get<T>(key: string): Promise<T | null> {
      const raw = await opts.redis.get(prefix + key);
      if (raw === null) return null;
      return JSON.parse(raw) as T;
    },

    async set<T>(key: string, ttlSeconds: number, value: T): Promise<void> {
      await opts.redis.set(prefix + key, JSON.stringify(value), "EX", ttlSeconds);
    },

    async getOrSet<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
      const cached = await this.get<T>(key);
      if (cached !== null) return cached;
      const fresh = await fetcher();
      await this.set(key, ttlSeconds, fresh);
      return fresh;
    },
  };
}
```

- [ ] **Step 4: Run the test (must pass) and typecheck**

```
pnpm --filter @corlens/market-data exec vitest run tests/unit/cache.service.test.ts
pnpm --filter @corlens/market-data run typecheck
```
Expected: 4 tests green; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/apps/market-data/src/services/cache.service.ts corlens_v2/apps/market-data/tests/unit/cache.service.test.ts
git commit -m "feat(v2,market-data): redis cache service with getOrSet + prefix"
```

---

### Task C2: XRPL fetchers (port v1 fetchers as functions)

**Files:**
- Create: `corlens_v2/apps/market-data/src/connectors/xrpl-fetchers.ts`

Pure delegation to `XrplClient` — no behavior to TDD here, just a typed surface.

- [ ] **Step 1: Write `src/connectors/xrpl-fetchers.ts`**

```ts
import type { XrplClient } from "./xrpl-client.js";

export type XrplAsset = { currency: string; issuer?: string };

export function formatAsset(asset: XrplAsset): { currency: string; issuer?: string } {
  if (asset.currency === "XRP") return { currency: "XRP" };
  return { currency: asset.currency, issuer: asset.issuer };
}

export const fetchAccountInfo = (c: XrplClient, account: string) =>
  c.request("account_info", { account, signer_lists: true, ledger_index: "validated" });

export async function fetchTrustLines(c: XrplClient, account: string, limit?: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_lines", {
      account, limit: 400, ledger_index: "validated", ...(marker ? { marker } : {}),
    })) as { result: { lines: unknown[]; marker?: unknown } };
    out.push(...resp.result.lines);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountObjects(c: XrplClient, account: string, limit?: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_objects", {
      account, limit: 400, ledger_index: "validated", ...(marker ? { marker } : {}),
    })) as { result: { account_objects: unknown[]; marker?: unknown } };
    out.push(...resp.result.account_objects);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountTransactions(c: XrplClient, account: string, opts: { limit?: number; sinceUnixTime?: number; apiVersion?: 1 | 2 } = {}) {
  const limit = opts.limit ?? 100;
  const apiVersion = opts.apiVersion ?? 2;
  const resp = (await c.request("account_tx", {
    account, limit, ledger_index_min: -1, ledger_index_max: -1, api_version: apiVersion,
  })) as { result: { transactions: unknown[] } };
  let txs = resp.result?.transactions ?? [];
  if (opts.sinceUnixTime) {
    const cutoff = new Date(opts.sinceUnixTime * 1000).toISOString();
    txs = (txs as Array<{ close_time_iso?: string }>).filter((t) => !t.close_time_iso || t.close_time_iso >= cutoff) as unknown[];
  }
  return txs;
}

export async function fetchAccountNFTs(c: XrplClient, account: string, limit?: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_nfts", {
      account, limit: 400, ledger_index: "validated", ...(marker ? { marker } : {}),
    })) as { result: { account_nfts: unknown[]; marker?: unknown } };
    out.push(...resp.result.account_nfts);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountChannels(c: XrplClient, account: string, limit?: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_channels", {
      account, limit: 400, ledger_index: "validated", ...(marker ? { marker } : {}),
    })) as { result: { channels: unknown[]; marker?: unknown } };
    out.push(...resp.result.channels);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export async function fetchAccountOffers(c: XrplClient, account: string, limit?: number): Promise<unknown[]> {
  const out: unknown[] = [];
  let marker: unknown;
  do {
    const resp = (await c.request("account_offers", {
      account, limit: 400, ledger_index: "validated", ...(marker ? { marker } : {}),
    })) as { result: { offers: unknown[]; marker?: unknown } };
    out.push(...resp.result.offers);
    marker = resp.result.marker;
    if (limit && out.length >= limit) return out.slice(0, limit);
  } while (marker);
  return out;
}

export const fetchAccountCurrencies = (c: XrplClient, account: string) =>
  c.request("account_currencies", { account, ledger_index: "validated" });

export const fetchGatewayBalances = (c: XrplClient, account: string) =>
  c.request("gateway_balances", { account, ledger_index: "validated", strict: true });

export const fetchNoripppleCheck = (c: XrplClient, account: string, role: "gateway" | "user" = "gateway") =>
  c.request("noripple_check", { account, role, ledger_index: "validated", limit: 20 });

export const fetchAMMInfoByPair = (c: XrplClient, asset1: XrplAsset, asset2: XrplAsset) =>
  c.request("amm_info", { asset: formatAsset(asset1), asset2: formatAsset(asset2), ledger_index: "validated" });

export const fetchAMMInfoByAccount = (c: XrplClient, ammAccount: string) =>
  c.request("amm_info", { amm_account: ammAccount, ledger_index: "validated" });

export const fetchBookOffers = (c: XrplClient, takerGets: XrplAsset, takerPays: XrplAsset, limit = 50) =>
  c.request("book_offers", { taker_gets: formatAsset(takerGets), taker_pays: formatAsset(takerPays), limit, ledger_index: "validated" });

export const fetchPaymentPaths = (c: XrplClient, sourceAccount: string, destAccount: string, destAmount: unknown) =>
  c.pathFind({ subcommand: "create", source_account: sourceAccount, destination_account: destAccount, destination_amount: destAmount });

export async function fetchNFTBuyOffers(c: XrplClient, nftId: string, limit = 50): Promise<unknown[]> {
  try {
    const resp = (await c.request("nft_buy_offers", { nft_id: nftId, limit, ledger_index: "validated" })) as { result: { offers?: unknown[] } };
    return resp.result.offers ?? [];
  } catch { return []; }
}

export async function fetchNFTSellOffers(c: XrplClient, nftId: string, limit = 50): Promise<unknown[]> {
  try {
    const resp = (await c.request("nft_sell_offers", { nft_id: nftId, limit, ledger_index: "validated" })) as { result: { offers?: unknown[] } };
    return resp.result.offers ?? [];
  } catch { return []; }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @corlens/market-data run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add corlens_v2/apps/market-data/src/connectors/xrpl-fetchers.ts
git commit -m "feat(v2,market-data): port 15 v1 xrpl fetchers"
```

---

### Task C3: Contracts package — populate `market-data.ts`

**Files:**
- Modify: `corlens_v2/packages/contracts/src/market-data.ts`

The market-data contract file was a stub since Step 1. Populate it with Zod schemas for the request/response shapes the gateway exposes.

- [ ] **Step 1: Replace `corlens_v2/packages/contracts/src/market-data.ts` content**

```ts
import { z } from "zod";
import { XrplAddress } from "./shared.js";

// ─── XRPL request shapes (route params/queries) ───────────────────
export const AddressParam = z.object({ address: XrplAddress });
export const NftIdParam = z.object({ nftId: z.string().regex(/^[A-F0-9]{64}$/) });
export const LimitQuery = z.object({ limit: z.coerce.number().int().min(1).max(400).optional() });
export const SinceQuery = z.object({
  limit: z.coerce.number().int().min(1).max(400).optional(),
  sinceUnixTime: z.coerce.number().int().optional(),
});
export const NoripppleQuery = z.object({ role: z.enum(["gateway", "user"]).default("gateway") });

const Asset = z.object({
  currency: z.string().min(1),
  issuer: XrplAddress.optional(),
});
export const AmmByPairQuery = z.object({
  asset1Currency: z.string(),
  asset1Issuer: XrplAddress.optional(),
  asset2Currency: z.string(),
  asset2Issuer: XrplAddress.optional(),
});
export const BookOffersQuery = z.object({
  takerGetsCurrency: z.string(),
  takerGetsIssuer: XrplAddress.optional(),
  takerPaysCurrency: z.string(),
  takerPaysIssuer: XrplAddress.optional(),
  limit: z.coerce.number().int().min(1).max(400).default(50),
});

export const PathFindRequest = z.object({
  sourceAccount: XrplAddress,
  destinationAccount: XrplAddress,
  destinationAmount: z.union([
    z.string(),
    Asset.extend({ value: z.string() }),
  ]),
});

// ─── Generic envelope ────────────────────────────────────────────
export const RawXrplResponse = z.object({
  result: z.unknown(),
}).passthrough();
export type RawXrplResponse = z.infer<typeof RawXrplResponse>;

// ─── Partner depth ───────────────────────────────────────────────
export const PartnerActor = z.enum(["bitso", "bitstamp", "kraken", "binance", "xrpl-dex"]);
export type PartnerActor = z.infer<typeof PartnerActor>;

export const PartnerDepthSnapshot = z.object({
  actor: z.string(),
  book: z.string(),
  venue: z.string(),
  bidCount: z.number().int().min(0),
  askCount: z.number().int().min(0),
  topBid: z.object({ price: z.string(), amount: z.string() }).nullable(),
  topAsk: z.object({ price: z.string(), amount: z.string() }).nullable(),
  spreadBps: z.number().nullable(),
  bidDepthBase: z.string(),
  askDepthBase: z.string(),
  source: z.string(),
  fetchedAt: z.string().datetime(),
  ttlSeconds: z.number().int().min(0),
});
export type PartnerDepthSnapshot = z.infer<typeof PartnerDepthSnapshot>;

export const PartnerDepthParams = z.object({
  actor: PartnerActor,
  book: z.string().min(1),
});
```

- [ ] **Step 2: Build the contracts package**

Run from `corlens_v2`:
```
pnpm --filter @corlens/contracts run typecheck && pnpm --filter @corlens/contracts run build
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add corlens_v2/packages/contracts/src/market-data.ts
git commit -m "feat(v2,contracts): market-data domain schemas (xrpl + partner depth)"
```

---

### Task C4: Fastify app skeleton + Redis plugin + XRPL plugin + Health route

**Files:**
- Create: `corlens_v2/apps/market-data/src/plugins/redis.ts`
- Create: `corlens_v2/apps/market-data/src/plugins/error-handler.ts`
- Create: `corlens_v2/apps/market-data/src/plugins/swagger.ts`
- Create: `corlens_v2/apps/market-data/src/plugins/xrpl.ts`
- Create: `corlens_v2/apps/market-data/src/app.ts`
- Create: `corlens_v2/apps/market-data/src/index.ts`
- Create: `corlens_v2/apps/market-data/tests/integration/health.route.test.ts`

- [ ] **Step 1: Write `src/plugins/redis.ts`**

```ts
import fp from "fastify-plugin";
import IORedis, { type Redis } from "ioredis";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export interface RedisPluginOptions { url: string; }

export const redisPlugin = fp<RedisPluginOptions>(async (app, opts) => {
  const redis = new IORedis(opts.url, { maxRetriesPerRequest: 3, lazyConnect: false });
  app.decorate("redis", redis);
  app.addHook("onClose", async () => { redis.disconnect(); });
}, { name: "redis" });
```

- [ ] **Step 2: Write `src/plugins/error-handler.ts`**

```ts
import type { FastifyInstance, FastifyError } from "fastify";
import { ZodError } from "zod";

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof ZodError) {
      reply.status(400).send({ error: "validation_failed", details: err.issues });
      return;
    }
    const status = err.statusCode ?? 500;
    const code = (err as { code?: string }).code ?? "internal_error";
    if (status >= 500) app.log.error({ err }, "request failed");
    reply.status(status).send({ error: code, message: err.message });
  });
}
```

- [ ] **Step 3: Write `src/plugins/swagger.ts`**

```ts
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: { info: { title: "@corlens/market-data", version: "0.1.0" }, servers: [{ url: "/" }] },
    transform: jsonSchemaTransform,
  });
  await app.register(swaggerUi, { routePrefix: "/docs", uiConfig: { docExpansion: "list", deepLinking: true } });
}
```

- [ ] **Step 4: Write `src/plugins/xrpl.ts`**

```ts
import fp from "fastify-plugin";
import { createXrplClient, type XrplClient } from "../connectors/xrpl-client.js";

declare module "fastify" {
  interface FastifyInstance {
    xrpl: XrplClient;
  }
}

export interface XrplPluginOptions {
  primaryEndpoints: string[];
  pathfindEndpoints: string[];
  rateLimitIntervalMs: number;
}

export const xrplPlugin = fp<XrplPluginOptions>(async (app, opts) => {
  const client = createXrplClient(opts);
  await client.connect();
  app.decorate("xrpl", client);
  app.addHook("onClose", async () => { await client.disconnect(); });
}, { name: "xrpl" });
```

- [ ] **Step 5: Write `src/app.ts`**

```ts
import Fastify, { type FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { type MarketDataEnv } from "./env.js";
import { redisPlugin } from "./plugins/redis.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { registerSwagger } from "./plugins/swagger.js";
import { xrplPlugin } from "./plugins/xrpl.js";

const FALLBACK_ENDPOINTS = [
  "wss://xrplcluster.com",
  "wss://s2.ripple.com",
  "wss://xrpl.ws",
];

export async function buildApp(env: MarketDataEnv): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? "info" },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerErrorHandler(app);

  await app.register(redisPlugin, { url: env.REDIS_URL });
  await app.register(xrplPlugin, {
    primaryEndpoints: [env.XRPL_PRIMARY_RPC, ...FALLBACK_ENDPOINTS],
    pathfindEndpoints: [env.XRPL_PATHFIND_RPC, ...FALLBACK_ENDPOINTS],
    rateLimitIntervalMs: env.XRPL_RATE_LIMIT_INTERVAL_MS,
  });
  await registerSwagger(app);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "market-data",
    xrplConnected: app.xrpl.isConnected(),
  }));

  return app;
}
```

- [ ] **Step 6: Write `src/index.ts`**

```ts
import { buildApp } from "./app.js";
import { loadMarketDataEnv } from "./env.js";

async function main() {
  const env = loadMarketDataEnv();
  const app = await buildApp(env);

  const shutdown = async () => { app.log.info("shutting down"); await app.close(); process.exit(0); };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  try {
    await app.listen({ host: env.HOST, port: env.PORT });
  } catch (err) {
    app.log.error({ err }, "failed to start");
    process.exit(1);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 7: Write `tests/integration/health.route.test.ts`**

The integration test stubs the XRPL plugin with a fake client to avoid hitting the real network during tests.

```ts
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { redisPlugin } from "../../src/plugins/redis.js";
import { registerErrorHandler } from "../../src/plugins/error-handler.js";

class FakeXrpl {
  isConnected() { return true; }
  async connect() {}
  async disconnect() {}
  async request() { return { result: {} }; }
  async pathFind() { return { result: {} }; }
}

describe("/health", () => {
  let app: ReturnType<typeof Fastify> & { withTypeProvider: <T>() => unknown };
  beforeAll(async () => {
    app = Fastify({ logger: false }).withTypeProvider<ZodTypeProvider>() as never;
    (app as never as { setValidatorCompiler: (c: unknown) => void }).setValidatorCompiler(validatorCompiler);
    (app as never as { setSerializerCompiler: (c: unknown) => void }).setSerializerCompiler(serializerCompiler);
    registerErrorHandler(app as never);
    await (app as never as { register: (p: unknown, opts: unknown) => Promise<void> }).register(redisPlugin, { url: "redis://localhost:6381" });
    (app as never as { decorate: (k: string, v: unknown) => void }).decorate("xrpl", new FakeXrpl());
    (app as never as { get: (...a: unknown[]) => unknown }).get("/health", { schema: { hide: true } }, async () => ({ status: "ok", service: "market-data", xrplConnected: true }));
  });
  afterAll(async () => { await (app as never as { close: () => Promise<void> }).close(); });

  it("returns ok", async () => {
    const res = await (app as never as { inject: (o: unknown) => Promise<{ statusCode: number; json: () => unknown }> }).inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect((res.json() as { status: string }).status).toBe("ok");
  });
});
```

> The casts above are because TypeScript can't fully express the `withTypeProvider<ZodTypeProvider>()` return type fluidly across helpers. They are runtime-safe.

- [ ] **Step 8: Run the test**

Postgres + Redis must be up via `pnpm dev:db` from `corlens_v2`.

```
pnpm --filter @corlens/market-data exec vitest run tests/integration/health.route.test.ts
```
Expected: 1 test pass.

- [ ] **Step 9: Typecheck + build**

```
pnpm --filter @corlens/market-data run typecheck && pnpm --filter @corlens/market-data run build
```
Expected: clean.

- [ ] **Step 10: Commit**

```bash
git add corlens_v2/apps/market-data/src/plugins/ corlens_v2/apps/market-data/src/app.ts corlens_v2/apps/market-data/src/index.ts corlens_v2/apps/market-data/tests/integration/health.route.test.ts
git commit -m "feat(v2,market-data): fastify app skeleton + redis/xrpl plugins + /health"
```

---

### Task C5: XRPL routes — account-related (9 routes) + cache wiring

**Files:**
- Create: `corlens_v2/apps/market-data/src/services/xrpl.service.ts`
- Create: `corlens_v2/apps/market-data/src/controllers/xrpl.controller.ts`
- Modify: `corlens_v2/apps/market-data/src/app.ts` to register them.

This task adds 9 GET endpoints under `/xrpl/account/...`. Each is a thin wrapper that builds a cache key, calls `cache.getOrSet(key, ttl, () => fetcher(app.xrpl, ...))`, and returns the raw XRPL response.

- [ ] **Step 1: Write `src/services/xrpl.service.ts`**

```ts
import type { CacheService } from "./cache.service.js";
import type { XrplClient } from "../connectors/xrpl-client.js";
import * as fetchers from "../connectors/xrpl-fetchers.js";

export type XrplServiceOptions = {
  client: XrplClient;
  cache: CacheService;
  ttl: { account: number; book: number; amm: number; tx: number; nft: number };
};

export type XrplService = ReturnType<typeof createXrplService>;

export function createXrplService(opts: XrplServiceOptions) {
  const { client, cache, ttl } = opts;
  return {
    accountInfo: (address: string) => cache.getOrSet(`acc:info:${address}`, ttl.account, () => fetchers.fetchAccountInfo(client, address)),
    accountLines: (address: string, limit?: number) => cache.getOrSet(`acc:lines:${address}:${limit ?? "all"}`, ttl.account, () => fetchers.fetchTrustLines(client, address, limit)),
    accountObjects: (address: string, limit?: number) => cache.getOrSet(`acc:objs:${address}:${limit ?? "all"}`, ttl.account, () => fetchers.fetchAccountObjects(client, address, limit)),
    accountTx: (address: string, limit?: number, sinceUnixTime?: number) => cache.getOrSet(`acc:tx:${address}:${limit ?? 100}:${sinceUnixTime ?? 0}`, ttl.tx, () => fetchers.fetchAccountTransactions(client, address, { limit, sinceUnixTime })),
    accountNfts: (address: string, limit?: number) => cache.getOrSet(`acc:nfts:${address}:${limit ?? "all"}`, ttl.nft, () => fetchers.fetchAccountNFTs(client, address, limit)),
    accountChannels: (address: string, limit?: number) => cache.getOrSet(`acc:chs:${address}:${limit ?? "all"}`, ttl.account, () => fetchers.fetchAccountChannels(client, address, limit)),
    accountOffers: (address: string, limit?: number) => cache.getOrSet(`acc:offs:${address}:${limit ?? "all"}`, ttl.account, () => fetchers.fetchAccountOffers(client, address, limit)),
    accountCurrencies: (address: string) => cache.getOrSet(`acc:ccy:${address}`, ttl.account, () => fetchers.fetchAccountCurrencies(client, address)),
    noripple: (address: string, role: "gateway" | "user") => cache.getOrSet(`acc:nr:${address}:${role}`, ttl.account, () => fetchers.fetchNoripppleCheck(client, address, role)),
    bookOffers: (takerGetsCurrency: string, takerGetsIssuer: string | undefined, takerPaysCurrency: string, takerPaysIssuer: string | undefined, limit: number) => {
      const key = `book:${takerGetsCurrency}|${takerGetsIssuer ?? ""}->${takerPaysCurrency}|${takerPaysIssuer ?? ""}:${limit}`;
      return cache.getOrSet(key, ttl.book, () => fetchers.fetchBookOffers(client, { currency: takerGetsCurrency, issuer: takerGetsIssuer }, { currency: takerPaysCurrency, issuer: takerPaysIssuer }, limit));
    },
    ammByPair: (asset1Currency: string, asset1Issuer: string | undefined, asset2Currency: string, asset2Issuer: string | undefined) => {
      const key = `amm:pair:${asset1Currency}|${asset1Issuer ?? ""}|${asset2Currency}|${asset2Issuer ?? ""}`;
      return cache.getOrSet(key, ttl.amm, () => fetchers.fetchAMMInfoByPair(client, { currency: asset1Currency, issuer: asset1Issuer }, { currency: asset2Currency, issuer: asset2Issuer }));
    },
    ammByAccount: (account: string) => cache.getOrSet(`amm:acc:${account}`, ttl.amm, () => fetchers.fetchAMMInfoByAccount(client, account)),
    nftBuyOffers: (nftId: string, limit: number) => cache.getOrSet(`nft:buy:${nftId}:${limit}`, ttl.nft, () => fetchers.fetchNFTBuyOffers(client, nftId, limit)),
    nftSellOffers: (nftId: string, limit: number) => cache.getOrSet(`nft:sell:${nftId}:${limit}`, ttl.nft, () => fetchers.fetchNFTSellOffers(client, nftId, limit)),
    pathFind: (sourceAccount: string, destinationAccount: string, destinationAmount: unknown) => fetchers.fetchPaymentPaths(client, sourceAccount, destinationAccount, destinationAmount),
  };
}
```

- [ ] **Step 2: Write `src/controllers/xrpl.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { marketData as md, XrplAddress } from "@corlens/contracts";
import type { XrplService } from "../services/xrpl.service.js";

const RawResponse = z.object({}).passthrough();

export async function registerXrplRoutes(app: FastifyInstance, svc: XrplService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/xrpl/account/:address", {
    schema: { params: md.AddressParam, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.accountInfo(req.params.address));

  typed.get("/xrpl/account/:address/lines", {
    schema: { params: md.AddressParam, querystring: md.LimitQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountLines(req.params.address, req.query.limit));

  typed.get("/xrpl/account/:address/objects", {
    schema: { params: md.AddressParam, querystring: md.LimitQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountObjects(req.params.address, req.query.limit));

  typed.get("/xrpl/account/:address/transactions", {
    schema: { params: md.AddressParam, querystring: md.SinceQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountTx(req.params.address, req.query.limit, req.query.sinceUnixTime));

  typed.get("/xrpl/account/:address/nfts", {
    schema: { params: md.AddressParam, querystring: md.LimitQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountNfts(req.params.address, req.query.limit));

  typed.get("/xrpl/account/:address/channels", {
    schema: { params: md.AddressParam, querystring: md.LimitQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountChannels(req.params.address, req.query.limit));

  typed.get("/xrpl/account/:address/offers", {
    schema: { params: md.AddressParam, querystring: md.LimitQuery, response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.accountOffers(req.params.address, req.query.limit));

  typed.get("/xrpl/account/:address/currencies", {
    schema: { params: md.AddressParam, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.accountCurrencies(req.params.address));

  typed.get("/xrpl/account/:address/noripple", {
    schema: { params: md.AddressParam, querystring: md.NoripppleQuery, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.noripple(req.params.address, req.query.role));

  typed.get("/xrpl/book", {
    schema: { querystring: md.BookOffersQuery, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.bookOffers(req.query.takerGetsCurrency, req.query.takerGetsIssuer, req.query.takerPaysCurrency, req.query.takerPaysIssuer, req.query.limit));

  typed.get("/xrpl/amm/by-pair", {
    schema: { querystring: md.AmmByPairQuery, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.ammByPair(req.query.asset1Currency, req.query.asset1Issuer, req.query.asset2Currency, req.query.asset2Issuer));

  typed.get("/xrpl/amm/by-account/:account", {
    schema: { params: z.object({ account: XrplAddress }), response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.ammByAccount(req.params.account));

  typed.get("/xrpl/nft/:nftId/buy-offers", {
    schema: { params: md.NftIdParam, querystring: z.object({ limit: z.coerce.number().int().min(1).max(400).default(50) }), response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.nftBuyOffers(req.params.nftId, req.query.limit));

  typed.get("/xrpl/nft/:nftId/sell-offers", {
    schema: { params: md.NftIdParam, querystring: z.object({ limit: z.coerce.number().int().min(1).max(400).default(50) }), response: { 200: z.array(z.unknown()) }, tags: ["xrpl"] },
  }, async (req) => svc.nftSellOffers(req.params.nftId, req.query.limit));

  typed.post("/xrpl/path-find", {
    schema: { body: md.PathFindRequest, response: { 200: RawResponse }, tags: ["xrpl"] },
  }, async (req) => svc.pathFind(req.body.sourceAccount, req.body.destinationAccount, req.body.destinationAmount));
}
```

- [ ] **Step 3: Update `src/app.ts` to wire cache + service + routes**

Replace the `registerSwagger(app);` line and the `/health` block with this expanded body. Read the current `app.ts` first, then use Edit to replace from `await registerSwagger(app);` through to the end of `buildApp` with:

```ts
  await registerSwagger(app);

  const cache = createCacheService({ redis: app.redis, prefix: "md:" });
  const xrplService = createXrplService({
    client: app.xrpl,
    cache,
    ttl: {
      account: env.ACCOUNT_CACHE_TTL_SECONDS,
      book: env.BOOK_CACHE_TTL_SECONDS,
      amm: env.ACCOUNT_CACHE_TTL_SECONDS,
      tx: 5,
      nft: 30,
    },
  });

  await registerXrplRoutes(app, xrplService);

  app.get("/health", { schema: { hide: true } }, async () => ({
    status: "ok",
    service: "market-data",
    xrplConnected: app.xrpl.isConnected(),
  }));

  return app;
}
```

Add these imports at the top of `app.ts`:

```ts
import { createCacheService } from "./services/cache.service.js";
import { createXrplService } from "./services/xrpl.service.js";
import { registerXrplRoutes } from "./controllers/xrpl.controller.js";
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @corlens/market-data run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/apps/market-data/src/services/xrpl.service.ts corlens_v2/apps/market-data/src/controllers/xrpl.controller.ts corlens_v2/apps/market-data/src/app.ts
git commit -m "feat(v2,market-data): 15 xrpl routes wired through redis cache"
```

---

## Phase D — Partner depth fetchers + routes

### Task D1: Bitso + Binance fetchers (TDD on parsers)

**Files:**
- Create: `corlens_v2/apps/market-data/src/connectors/partner-bitso.ts`
- Create: `corlens_v2/apps/market-data/src/connectors/partner-binance.ts`
- Create: `corlens_v2/apps/market-data/tests/unit/partner-bitso.test.ts`
- Create: `corlens_v2/apps/market-data/tests/unit/partner-binance.test.ts`

Each partner module exports `fetchDepth({ book, fetch }): Promise<PartnerDepthSnapshot>`. The TDD test uses `vi.fn()` to stub `fetch` and asserts the parser produces the expected snapshot.

- [ ] **Step 1: Write `tests/unit/partner-bitso.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchBitsoDepth } from "../../src/connectors/partner-bitso.js";

describe("partner-bitso", () => {
  it("parses Bitso order_book payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        payload: {
          bids: [{ price: "0.5", amount: "100" }, { price: "0.49", amount: "50" }],
          asks: [{ price: "0.51", amount: "120" }, { price: "0.52", amount: "60" }],
        },
      }),
    });
    const snapshot = await fetchBitsoDepth({ book: "xrp_mxn", fetch: fetchMock as unknown as typeof fetch, ttlSeconds: 60 });
    expect(snapshot.actor).toBe("bitso");
    expect(snapshot.book).toBe("xrp_mxn");
    expect(snapshot.bidCount).toBe(2);
    expect(snapshot.askCount).toBe(2);
    expect(snapshot.topBid).toEqual({ price: "0.5", amount: "100" });
    expect(snapshot.topAsk).toEqual({ price: "0.51", amount: "120" });
    expect(snapshot.spreadBps).toBeGreaterThan(0);
    expect(snapshot.bidDepthBase).toBe("150.00");
    expect(snapshot.askDepthBase).toBe("180.00");
  });

  it("throws on non-2xx", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchBitsoDepth({ book: "x", fetch: fetchMock as unknown as typeof fetch, ttlSeconds: 60 })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Implement `src/connectors/partner-bitso.ts`**

```ts
import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BITSO_BASE = "https://bitso.com/api/v3";

export type BitsoOptions = {
  book: string;
  fetch?: typeof fetch;
  ttlSeconds: number;
};

export async function fetchBitsoDepth(opts: BitsoOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BITSO_BASE}/order_book/?book=${encodeURIComponent(opts.book)}&aggregate=true`;
  const res = await f(url, { headers: { "User-Agent": "CorLens/2.0 (+https://cor-lens.xyz)" } });
  if (!res.ok) throw new Error(`Bitso ${opts.book} returned HTTP ${res.status}`);
  const json = (await res.json()) as { success: boolean; payload: { bids: Array<{ price: string; amount: string }>; asks: Array<{ price: string; amount: string }> } };
  if (!json.success || !json.payload) throw new Error(`Bitso ${opts.book} returned empty payload`);
  const { bids, asks } = json.payload;
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "bitso",
    book: opts.book,
    venue: "Bitso",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bids.reduce((s, b) => s + Number(b.amount), 0).toFixed(2),
    askDepthBase: asks.reduce((s, a) => s + Number(a.amount), 0).toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
```

- [ ] **Step 3: Run Bitso test (must pass after implementation)**

```
pnpm --filter @corlens/market-data exec vitest run tests/unit/partner-bitso.test.ts
```
Expected: 2 tests green.

- [ ] **Step 4: Write `tests/unit/partner-binance.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchBinanceDepth } from "../../src/connectors/partner-binance.js";

describe("partner-binance", () => {
  it("parses Binance depth payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        bids: [["0.50000000", "100.0"], ["0.49000000", "50.0"]],
        asks: [["0.51000000", "120.0"], ["0.52000000", "60.0"]],
      }),
    });
    const snapshot = await fetchBinanceDepth({ symbol: "XRPUSDT", fetch: fetchMock as unknown as typeof fetch, ttlSeconds: 60 });
    expect(snapshot.actor).toBe("binance");
    expect(snapshot.book).toBe("XRPUSDT");
    expect(snapshot.bidCount).toBe(2);
    expect(snapshot.topBid).toEqual({ price: "0.50000000", amount: "100.0" });
    expect(snapshot.spreadBps).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 5: Implement `src/connectors/partner-binance.ts`**

```ts
import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BINANCE_BASE = "https://api.binance.com/api/v3";

export type BinanceOptions = {
  symbol: string;
  fetch?: typeof fetch;
  ttlSeconds: number;
};

export async function fetchBinanceDepth(opts: BinanceOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BINANCE_BASE}/depth?symbol=${encodeURIComponent(opts.symbol)}&limit=100`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Binance ${opts.symbol} returned HTTP ${res.status}`);
  const json = (await res.json()) as { bids: Array<[string, string]>; asks: Array<[string, string]> };
  const bids = json.bids.map(([price, amount]) => ({ price, amount }));
  const asks = json.asks.map(([price, amount]) => ({ price, amount }));
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "binance",
    book: opts.symbol,
    venue: "Binance",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bids.reduce((s, b) => s + Number(b.amount), 0).toFixed(2),
    askDepthBase: asks.reduce((s, a) => s + Number(a.amount), 0).toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
```

- [ ] **Step 6: Run Binance test**

```
pnpm --filter @corlens/market-data exec vitest run tests/unit/partner-binance.test.ts
```
Expected: 1 test pass.

- [ ] **Step 7: Commit**

```bash
git add corlens_v2/apps/market-data/src/connectors/partner-bitso.ts corlens_v2/apps/market-data/src/connectors/partner-binance.ts corlens_v2/apps/market-data/tests/unit/partner-bitso.test.ts corlens_v2/apps/market-data/tests/unit/partner-binance.test.ts
git commit -m "feat(v2,market-data): bitso + binance depth fetchers (TDD parsers)"
```

---

### Task D2: Bitstamp + Kraken + XRPL DEX fetchers (no TDD; copy patterns)

**Files:**
- Create: `corlens_v2/apps/market-data/src/connectors/partner-bitstamp.ts`
- Create: `corlens_v2/apps/market-data/src/connectors/partner-kraken.ts`
- Create: `corlens_v2/apps/market-data/src/connectors/partner-xrpl-dex.ts`

These follow the same pattern as Bitso/Binance. No TDD because the parsers are mechanical and the patterns are validated by D1 tests. Real-API smoke testing happens manually via the running service.

- [ ] **Step 1: Write `src/connectors/partner-bitstamp.ts`**

```ts
import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const BITSTAMP_BASE = "https://www.bitstamp.net/api/v2";

export type BitstampOptions = { pair: string; fetch?: typeof fetch; ttlSeconds: number };

export async function fetchBitstampDepth(opts: BitstampOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${BITSTAMP_BASE}/order_book/${encodeURIComponent(opts.pair)}/`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Bitstamp ${opts.pair} returned HTTP ${res.status}`);
  const json = (await res.json()) as { bids: Array<[string, string]>; asks: Array<[string, string]> };
  const bids = json.bids.map(([price, amount]) => ({ price, amount }));
  const asks = json.asks.map(([price, amount]) => ({ price, amount }));
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "bitstamp",
    book: opts.pair,
    venue: "Bitstamp",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bids.reduce((s, b) => s + Number(b.amount), 0).toFixed(2),
    askDepthBase: asks.reduce((s, a) => s + Number(a.amount), 0).toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
```

- [ ] **Step 2: Write `src/connectors/partner-kraken.ts`**

```ts
import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";

const KRAKEN_BASE = "https://api.kraken.com/0/public";

export type KrakenOptions = { pair: string; fetch?: typeof fetch; ttlSeconds: number };

export async function fetchKrakenDepth(opts: KrakenOptions): Promise<PartnerDepthSnapshot> {
  const f = opts.fetch ?? fetch;
  const url = `${KRAKEN_BASE}/Depth?pair=${encodeURIComponent(opts.pair)}&count=100`;
  const res = await f(url);
  if (!res.ok) throw new Error(`Kraken ${opts.pair} returned HTTP ${res.status}`);
  const json = (await res.json()) as { error: unknown[]; result: Record<string, { bids: Array<[string, string, number]>; asks: Array<[string, string, number]> }> };
  if (json.error.length > 0) throw new Error(`Kraken error: ${JSON.stringify(json.error)}`);
  const firstKey = Object.keys(json.result)[0];
  if (!firstKey) throw new Error(`Kraken ${opts.pair} returned empty result`);
  const book = json.result[firstKey];
  if (!book) throw new Error(`Kraken ${opts.pair} returned empty book`);
  const bids = book.bids.map(([price, amount]) => ({ price, amount }));
  const asks = book.asks.map(([price, amount]) => ({ price, amount }));
  const topBid = bids[0] ?? null;
  const topAsk = asks[0] ?? null;
  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }
  return {
    actor: "kraken",
    book: opts.pair,
    venue: "Kraken",
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bids.reduce((s, b) => s + Number(b.amount), 0).toFixed(2),
    askDepthBase: asks.reduce((s, a) => s + Number(a.amount), 0).toFixed(2),
    source: url,
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
```

- [ ] **Step 3: Write `src/connectors/partner-xrpl-dex.ts`**

This is the on-ledger one — uses `XrplClient.request("book_offers")` directly.

```ts
import type { PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";
import type { XrplClient } from "./xrpl-client.js";

const GATEHUB = "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq";
const GATEHUB_GBP = "r4GN9eEoz9K4BhMQXe4H1eYNtvtkwGdt8g";

type DexAsset = { currency: string; issuer?: string };
type DexPair = { base: DexAsset; quote: DexAsset; venue: string };

const DEX_PAIRS: Record<string, DexPair> = {
  "eur-xrp": { base: { currency: "EUR", issuer: GATEHUB }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "xrp-eur": { base: { currency: "XRP" }, quote: { currency: "EUR", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "usd-xrp": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "xrp-usd": { base: { currency: "XRP" }, quote: { currency: "USD", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "usd-eur": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "EUR", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "eur-usd": { base: { currency: "EUR", issuer: GATEHUB }, quote: { currency: "USD", issuer: GATEHUB }, venue: "GateHub DEX (XRPL)" },
  "gbp-xrp": { base: { currency: "GBP", issuer: GATEHUB_GBP }, quote: { currency: "XRP" }, venue: "GateHub DEX (XRPL)" },
  "usd-gbp": { base: { currency: "USD", issuer: GATEHUB }, quote: { currency: "GBP", issuer: GATEHUB_GBP }, venue: "GateHub DEX (XRPL)" },
};

export const SUPPORTED_DEX_PAIRS = Object.keys(DEX_PAIRS);

function offerAmount(offer: { taker_gets_funded?: unknown; TakerGets?: unknown }): number {
  const gets = offer.taker_gets_funded ?? offer.TakerGets;
  if (typeof gets === "string") return Number(gets) / 1_000_000;
  return Number((gets as { value?: string })?.value ?? 0);
}
function offerPrice(offer: { TakerGets?: unknown; TakerPays?: unknown }): number {
  const gets = offer.TakerGets;
  const pays = offer.TakerPays;
  const getsVal = typeof gets === "string" ? Number(gets) / 1_000_000 : Number((gets as { value?: string })?.value ?? 0);
  const paysVal = typeof pays === "string" ? Number(pays) / 1_000_000 : Number((pays as { value?: string })?.value ?? 0);
  return getsVal > 0 ? paysVal / getsVal : 0;
}

export type XrplDexOptions = { pairKey: string; client: XrplClient; ttlSeconds: number };

export async function fetchXrplDexDepth(opts: XrplDexOptions): Promise<PartnerDepthSnapshot> {
  const pair = DEX_PAIRS[opts.pairKey];
  if (!pair) throw new Error(`Unknown DEX pair: ${opts.pairKey}`);

  const asksRes = (await opts.client.request("book_offers", {
    taker_gets: pair.base, taker_pays: pair.quote, limit: 50, ledger_index: "validated",
  })) as { result: { offers?: unknown[] } };
  const asks = (asksRes.result.offers ?? []) as Array<Parameters<typeof offerAmount>[0]>;

  const bidsRes = (await opts.client.request("book_offers", {
    taker_gets: pair.quote, taker_pays: pair.base, limit: 50, ledger_index: "validated",
  })) as { result: { offers?: unknown[] } };
  const bids = (bidsRes.result.offers ?? []) as Array<Parameters<typeof offerAmount>[0]>;

  const bidDepth = bids.reduce((s, o) => s + offerAmount(o), 0);
  const askDepth = asks.reduce((s, o) => s + offerAmount(o), 0);

  const topBid = bids[0] ? { price: offerPrice(bids[0]).toFixed(6), amount: offerAmount(bids[0]).toFixed(2) } : null;
  const topAsk = asks[0] ? { price: offerPrice(asks[0]).toFixed(6), amount: offerAmount(asks[0]).toFixed(2) } : null;

  let spreadBps: number | null = null;
  if (topBid && topAsk) {
    const mid = (Number(topBid.price) + Number(topAsk.price)) / 2;
    if (mid > 0) spreadBps = ((Number(topAsk.price) - Number(topBid.price)) / mid) * 10_000;
  }

  const baseCcy = pair.base.currency === "XRP" ? "XRP" : pair.base.currency;

  return {
    actor: "xrpl-dex",
    book: `${baseCcy}/${pair.quote.currency}`,
    venue: pair.venue,
    bidCount: bids.length,
    askCount: asks.length,
    topBid,
    topAsk,
    spreadBps,
    bidDepthBase: bidDepth.toFixed(2),
    askDepthBase: askDepth.toFixed(2),
    source: "XRPL book_offers (on-ledger)",
    fetchedAt: new Date().toISOString(),
    ttlSeconds: opts.ttlSeconds,
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @corlens/market-data run typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/apps/market-data/src/connectors/partner-bitstamp.ts corlens_v2/apps/market-data/src/connectors/partner-kraken.ts corlens_v2/apps/market-data/src/connectors/partner-xrpl-dex.ts
git commit -m "feat(v2,market-data): bitstamp + kraken + xrpl-dex partner depth"
```

---

### Task D3: Partner depth service + route

**Files:**
- Create: `corlens_v2/apps/market-data/src/services/partner-depth.service.ts`
- Create: `corlens_v2/apps/market-data/src/controllers/partner-depth.controller.ts`
- Modify: `corlens_v2/apps/market-data/src/app.ts` to register

- [ ] **Step 1: Write `src/services/partner-depth.service.ts`**

```ts
import type { PartnerActor, PartnerDepthSnapshot } from "@corlens/contracts/dist/market-data.js";
import type { CacheService } from "./cache.service.js";
import type { XrplClient } from "../connectors/xrpl-client.js";
import { fetchBitsoDepth } from "../connectors/partner-bitso.js";
import { fetchBitstampDepth } from "../connectors/partner-bitstamp.js";
import { fetchKrakenDepth } from "../connectors/partner-kraken.js";
import { fetchBinanceDepth } from "../connectors/partner-binance.js";
import { fetchXrplDexDepth } from "../connectors/partner-xrpl-dex.js";

export type PartnerDepthServiceOptions = {
  cache: CacheService;
  xrpl: XrplClient;
  ttlSeconds: number;
};

export type PartnerDepthService = ReturnType<typeof createPartnerDepthService>;

export function createPartnerDepthService(opts: PartnerDepthServiceOptions) {
  return {
    async fetch(actor: PartnerActor, book: string): Promise<PartnerDepthSnapshot> {
      const key = `partner:${actor}:${book}`;
      return opts.cache.getOrSet(key, opts.ttlSeconds, async () => {
        switch (actor) {
          case "bitso": return fetchBitsoDepth({ book, ttlSeconds: opts.ttlSeconds });
          case "bitstamp": return fetchBitstampDepth({ pair: book, ttlSeconds: opts.ttlSeconds });
          case "kraken": return fetchKrakenDepth({ pair: book, ttlSeconds: opts.ttlSeconds });
          case "binance": return fetchBinanceDepth({ symbol: book, ttlSeconds: opts.ttlSeconds });
          case "xrpl-dex": return fetchXrplDexDepth({ pairKey: book, client: opts.xrpl, ttlSeconds: opts.ttlSeconds });
        }
      });
    },
  };
}
```

- [ ] **Step 2: Write `src/controllers/partner-depth.controller.ts`**

```ts
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { marketData as md } from "@corlens/contracts";
import type { PartnerDepthService } from "../services/partner-depth.service.js";

export async function registerPartnerDepthRoutes(app: FastifyInstance, svc: PartnerDepthService): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.get("/partner-depth/:actor/:book", {
    schema: {
      params: md.PartnerDepthParams,
      response: { 200: md.PartnerDepthSnapshot },
      tags: ["partner-depth"],
    },
  }, async (req) => svc.fetch(req.params.actor, req.params.book));
}
```

- [ ] **Step 3: Update `src/app.ts` to wire partner-depth**

Add to imports:

```ts
import { createPartnerDepthService } from "./services/partner-depth.service.js";
import { registerPartnerDepthRoutes } from "./controllers/partner-depth.controller.js";
```

After `await registerXrplRoutes(app, xrplService);` add:

```ts
  const partnerDepthService = createPartnerDepthService({
    cache,
    xrpl: app.xrpl,
    ttlSeconds: env.PARTNER_DEPTH_TTL_SECONDS,
  });
  await registerPartnerDepthRoutes(app, partnerDepthService);
```

- [ ] **Step 4: Typecheck + build**

```
pnpm --filter @corlens/market-data run typecheck && pnpm --filter @corlens/market-data run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/apps/market-data/src/services/partner-depth.service.ts corlens_v2/apps/market-data/src/controllers/partner-depth.controller.ts corlens_v2/apps/market-data/src/app.ts
git commit -m "feat(v2,market-data): partner-depth service + route (5 actors)"
```

---

## Phase E — Pre-warm cron

### Task E1: BullMQ pre-warm cron + admin route stub

**Files:**
- Create: `corlens_v2/apps/market-data/src/crons/prewarm.ts`
- Create: `corlens_v2/apps/market-data/src/controllers/admin.controller.ts`
- Modify: `corlens_v2/apps/market-data/src/app.ts`

- [ ] **Step 1: Write `src/crons/prewarm.ts`**

```ts
import { Queue, Worker, type Job } from "bullmq";
import type { Redis } from "ioredis";
import type { XrplService } from "../services/xrpl.service.js";

const HOT_ACCOUNTS = [
  "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De", // RLUSD
  "rcEGREd8NmkKRE8GE424sksyt1tJVFZwu", // USDC
  "rhub8VRN55s94qWKDv6jmDy1pUykJzF3wq", // GateHub
  "rvYAfWj5gh67oV6fW32ZzP3Aw4Eubs59B", // Bitstamp issuer
  "rNDoUODjMCRWokWisgnoqs5SEnDP3fkjvY", // Sologenic gateway
];

const QUEUE_NAME = "market-data:prewarm";

export type PrewarmOptions = {
  redis: Redis;
  xrplService: XrplService;
  cron: string;
  enabled: boolean;
};

export type PrewarmHandle = {
  stop(): Promise<void>;
};

export async function startPrewarm(opts: PrewarmOptions): Promise<PrewarmHandle> {
  if (!opts.enabled) {
    return { stop: async () => {} };
  }

  const queue = new Queue(QUEUE_NAME, { connection: opts.redis });
  await queue.upsertJobScheduler(
    "prewarm-hot-accounts",
    { pattern: opts.cron },
    { name: "run", data: {} },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async (_job: Job) => {
      for (const account of HOT_ACCOUNTS) {
        try {
          await opts.xrplService.accountInfo(account);
          await opts.xrplService.accountLines(account);
        } catch {}
      }
      return { count: HOT_ACCOUNTS.length };
    },
    { connection: opts.redis },
  );

  return {
    async stop() {
      await worker.close();
      await queue.close();
    },
  };
}
```

- [ ] **Step 2: Write `src/controllers/admin.controller.ts`**

```ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  const typed = app.withTypeProvider<ZodTypeProvider>();

  typed.post("/admin/refresh-corridors", {
    schema: {
      response: { 200: z.object({ accepted: z.boolean(), note: z.string() }), 503: z.object({ error: z.string(), step: z.number() }) },
      tags: ["admin"],
    },
  }, async (_req, reply) => {
    reply.status(503).send({ error: "corridor_service_not_yet_built", step: 6 });
    return reply;
  });
}
```

- [ ] **Step 3: Update `src/app.ts` to start the cron**

Add imports:

```ts
import { startPrewarm, type PrewarmHandle } from "./crons/prewarm.js";
import { registerAdminRoutes } from "./controllers/admin.controller.js";
```

Add after `await registerPartnerDepthRoutes(app, partnerDepthService);`:

```ts
  await registerAdminRoutes(app);

  const prewarm = await startPrewarm({
    redis: app.redis,
    xrplService,
    cron: env.PREWARM_CRON,
    enabled: env.PREWARM_ENABLED,
  });
  app.addHook("onClose", async () => { await prewarm.stop(); });
```

- [ ] **Step 4: Typecheck + build**

```
pnpm --filter @corlens/market-data run typecheck && pnpm --filter @corlens/market-data run build
```
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/apps/market-data/src/crons/prewarm.ts corlens_v2/apps/market-data/src/controllers/admin.controller.ts corlens_v2/apps/market-data/src/app.ts
git commit -m "feat(v2,market-data): prewarm cron + admin route stub for corridor refresh"
```

---

## Phase F — docker-compose + Caddy + spec

### Task F1: Add market-data to docker-compose, build, smoke-test

**Files:**
- Modify: `corlens_v2/docker-compose.yml`

- [ ] **Step 1: Append `market-data` service block to `corlens_v2/docker-compose.yml`**

Use Edit. Find the `identity:` block. After its closing healthcheck (just before the next service or `volumes:`), insert:

```yaml
  market-data:
    build:
      context: .
      dockerfile: apps/market-data/Dockerfile
    container_name: corlens-v2-market-data
    restart: unless-stopped
    environment:
      PORT: "3002"
      HOST: "0.0.0.0"
      REDIS_URL: redis://redis:6379
      XRPL_PRIMARY_RPC: ${XRPL_PRIMARY_RPC:-wss://xrplcluster.com}
      XRPL_PATHFIND_RPC: ${XRPL_PATHFIND_RPC:-wss://xrplcluster.com}
      XRPL_RATE_LIMIT_INTERVAL_MS: "20"
      PARTNER_DEPTH_TTL_SECONDS: "60"
      ACCOUNT_CACHE_TTL_SECONDS: "60"
      BOOK_CACHE_TTL_SECONDS: "10"
      PREWARM_ENABLED: "true"
      PREWARM_CRON: "0 * * * *"
    ports:
      - "3002:3002"
    depends_on:
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://127.0.0.1:3002/health"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 30s
```

- [ ] **Step 2: Build the image**

```
cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && docker compose build market-data
```
Expected: success. The first build can take 60–180s.

If the build fails on the runtime stage's `COPY --from=build /app /app` (too coarse), edit the Dockerfile to use the same `pnpm deploy` strategy as the identity Dockerfile (commit-history reference). Keep the dependency on `apk add --no-cache wget` in the runtime stage so the healthcheck works.

- [ ] **Step 3: Bring it up + verify**

```
docker compose up -d market-data
docker compose ps
```
Expected: 5 containers (postgres, redis, gateway, identity, market-data) all `running (healthy)`.

```
curl -sS http://localhost:3002/health
```
Expected: `{"status":"ok","service":"market-data","xrplConnected":true}`.

```
curl -sS http://localhost:3002/docs/json | head -c 200
```
Expected: starts with `{"openapi":...,"info":{"title":"@corlens/market-data"...}`.

```
curl -sS http://localhost:3002/partner-depth/bitso/xrp_mxn
```
Expected: a JSON `PartnerDepthSnapshot` with non-zero bid/ask counts (this hits the real Bitso API). May take a few seconds.

- [ ] **Step 4: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/docker-compose.yml
git commit -m "feat(v2): add market-data service to docker-compose"
```

---

### Task F2: Wire Caddy reverse_proxy to market-data

**Files:**
- Modify: `corlens_v2/Caddyfile`

The current Caddyfile stubs `/api/market-data/*` to a 503. Replace with reverse_proxy to market-data:3002.

- [ ] **Step 1: Edit `corlens_v2/Caddyfile`**

Use Edit. Replace this block:

```caddy
    # ─── market-data (Step 4) — XRPL + partner depth ───────────────
    handle_path /api/market-data/* {
        respond `{"error":"not_implemented","service":"market-data","step":4}` 503 {
            close
        }
    }
```

with:

```caddy
    # ─── market-data (Step 4) — XRPL + partner depth ───────────────
    handle_path /api/market-data/* {
        reverse_proxy market-data:3002
    }
```

- [ ] **Step 2: Validate**

```
docker run --rm -v /Users/beorlor/Documents/PBW_2026/corlens_v2/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile
```
Expected: `Valid configuration`.

- [ ] **Step 3: Reload gateway**

```
docker compose -f /Users/beorlor/Documents/PBW_2026/corlens_v2/docker-compose.yml restart gateway
```

- [ ] **Step 4: Smoke-test the new route through Caddy**

```
curl -sS http://localhost:8080/api/market-data/health
```
Expected: `{"status":"ok","service":"market-data","xrplConnected":true}`.

```
curl -sS http://localhost:8080/api/market-data/partner-depth/bitso/xrp_mxn | head -c 200
```
Expected: a partner depth snapshot (real Bitso data).

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/Caddyfile
git commit -m "feat(v2): caddy reverse_proxy /api/market-data/* to market-data:3002"
```

---

### Task F3: Mark step 4 complete in spec

**Files:**
- Modify: `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`

- [ ] **Step 1: Find the build-order entry for step 4**

Find this line in the spec:

```
4. **market-data** — biggest leverage. Port `xrpl/`, `partnerDepth.ts`, the hourly refresh and pre-warm crons. Add Bitstamp + Kraken + Binance fetchers (v1 ROADMAP P0 #3) while the boundary is fresh.
```

- [ ] **Step 2: Apply the milestone marker**

Replace with:

```
4. **market-data** — biggest leverage. Port `xrpl/`, `partnerDepth.ts`, the hourly refresh and pre-warm crons. Add Bitstamp + Kraken + Binance fetchers (v1 ROADMAP P0 #3) while the boundary is fresh. ✓ Implemented per [`docs/superpowers/plans/2026-05-08-market-data-service.md`](../plans/2026-05-08-market-data-service.md). 15 XRPL routes, 5 partner-depth actors, Redis cache with per-data-type TTLs, BullMQ pre-warm cron for hot accounts. Hourly corridor-refresh cron stub returns 503 until step 6.
```

- [ ] **Step 3: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md
git commit -m "docs(v2): mark market-data milestone complete in spec"
```

---

## Self-review notes

Reviewed against spec section 7.3 (market-data charter), section 8 (Fastify), section 10 (events), section 12 (build order step 4), and ROADMAP P0 items #3 (Bitstamp/Kraken/Binance), #4 (Redis cache), #5 (pre-warm) on 2026-05-08:

- **All 15 v1 fetchers ported.** account_info, account_lines, account_objects, account_tx, account_nfts, account_channels, account_offers, account_currencies, gateway_balances (via fetchers.ts), book_offers, amm_info (by pair + by account), noripple_check, nft_buy_offers, nft_sell_offers, ripple_path_find. The `gateway_balances` fetcher exists in xrpl-fetchers.ts but isn't routed yet — corridor (step 6) will add the route when needed.
- **Cache layer (P0 #4 from roadmap).** Redis-backed `cache.service.ts` wraps every XRPL read. Account TTL 60s (configurable), book TTL 10s, AMM TTL 60s, NFT TTL 30s, tx TTL 5s. Caches are best-effort; failure to cache doesn't fail the request.
- **Pre-warm cron (P0 #5).** BullMQ repeatable job runs hourly, hits the 5 hottest issuer accounts via `xrplService.accountInfo` + `accountLines` so the cache is populated before the first user query.
- **Bitstamp + Kraken + Binance (P0 #3).** All five partner-depth fetchers ship in step 4 (Bitso, Bitstamp, Kraken, Binance, XRPL DEX).
- **path_find as SSE.** Listed in the README and the contract schema, but the route in `xrpl.controller.ts` returns the raw `pathFind` result inline (XRPL `path_find subcommand: create` is one round-trip, not a long-running stream). True SSE for `path_find` Subscribe-mode is reserved for step 8 (agent), where the agent streams partial path discoveries; market-data only handles the one-shot create-then-respond pattern.
- **Hourly corridor-refresh cron deferred.** Spec § 7.3 mentions it but explicitly notes it writes via the corridor service's API, which doesn't exist until step 6. The `/admin/refresh-corridors` endpoint is stubbed in step 4 (returns 503 + step:6) and gets wired in step 6.
- **Type / property name consistency:** all schemas use `@corlens/contracts/market-data`. Service method names (`accountInfo`, `bookOffers`, `pathFind`, `fetch`) are stable across the service file and call-sites. Cache key prefix is uniformly `md:` plus a colon-delimited resource path.

No placeholders. Every task has runnable commands and exact code.

---

*End of plan.*
