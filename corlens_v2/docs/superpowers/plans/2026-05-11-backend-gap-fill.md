# CORLens v2 — Backend Gap-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [2026-05-11-backend-gap-fill-design.md](../specs/2026-05-11-backend-gap-fill-design.md) (commit `ae65988`).

**Goal:** Close the 4 v1↔v2 parity gaps blocking the Web SPA (Phase F): full currency catalog owned by corridor, risk-engine reachable over HTTP from the agent, 5 missing endpoints, and the 7th MCP tool.

**Architecture:** HTTP-first (§10 of the architecture spec). Corridor owns currency-meta; path owns risk-engine quick-eval; agent reuses Phase D.3 pdf-renderer for entity compliance; chat retrieval extends existing controllers. No shared domain packages. HMAC on internal routes, public on read-only catalog endpoints.

**Tech stack:** Node 20 + pnpm 9, Fastify + Zod + fastify-type-provider-zod, Prisma (Postgres multiSchema), Vitest (suites under `apps/*/tests/unit/`), Biome 1.9 (strict per Phase A), `noUncheckedIndexedAccess` + `verbatimModuleSyntax`.

**Branch:** `refacto`. **Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`.

**Volume:** 9 commits, ~2 kLOC.

---

## Convention notes (re-read before each phase)

- **Tests live under `apps/<svc>/tests/unit/`** — there is no top-level `tests/` directory.
- **Connectors, not clients.** Each app holds its own connector at `apps/<svc>/src/connectors/<target>.ts`. There is no shared `CorridorClient` / `PathClient` package. Modify the consuming service's connector — do NOT create a new file in `packages/clients/`.
- **`packages/clients/`** only holds `hmac.ts` + `http.ts` (the signing + signed-fetch helpers). Connectors import from there.
- **Contracts** are namespaced: `import { corridor as cc } from "@corlens/contracts"` then `cc.CurrencyMeta`. New Zod schemas go in `packages/contracts/src/<service>.ts` and are auto re-exported via `index.ts`.
- **Seeders** follow `apps/corridor/src/services/catalog-seeder.service.ts:createCatalogSeeder({ repo, seedPath })`. Add a sibling `currency-meta-seeder.service.ts`, do not extend the existing one.
- **App registration order matters** — controllers are registered in `apps/<svc>/src/app.ts` after repos are built.
- **HMAC middleware** is already wired by Phase E. New `internal: true` routes need only the route option; the verification preHandler is mounted globally on the app.
- **Per-commit discipline:** `pnpm biome check` clean, `pnpm -r typecheck` clean, all touched Vitest suites green. No `--no-verify`.

---

## File map (full plan)

### Created

```
corlens_v2/tools/export-currency-meta.mjs
corlens_v2/apps/corridor/seed/currency-meta.json
corlens_v2/apps/corridor/src/services/currency-meta-seeder.service.ts
corlens_v2/apps/corridor/src/services/currency-meta.service.ts
corlens_v2/apps/corridor/src/repositories/currency-meta.repo.ts
corlens_v2/apps/corridor/src/controllers/currency-meta.controller.ts
corlens_v2/apps/corridor/tests/unit/currency-meta.service.test.ts
corlens_v2/apps/corridor/tests/unit/currency-meta.controller.test.ts
corlens_v2/apps/corridor/tests/unit/chat-retrieval.controller.test.ts
corlens_v2/apps/path/src/services/quick-eval.service.ts
corlens_v2/apps/path/src/controllers/risk-engine.controller.ts
corlens_v2/apps/path/tests/unit/quick-eval.service.test.ts
corlens_v2/apps/path/tests/unit/risk-engine.controller.test.ts
corlens_v2/apps/path/tests/unit/chat-retrieval.controller.test.ts
corlens_v2/apps/agent/src/services/compliance-analysis.service.ts
corlens_v2/apps/agent/src/controllers/compliance-analysis.controller.ts
corlens_v2/apps/agent/tests/unit/compliance-analysis.service.test.ts
corlens_v2/apps/agent/tests/unit/compliance-analysis.controller.test.ts
corlens_v2/apps/agent/tests/unit/phase-on-chain-path-find.test.ts
corlens_v2/apps/mcp-server/tests/unit/get-partner-depth.test.ts
```

### Modified

```
corlens_v2/packages/db/prisma/schema.prisma                  (+CurrencyMeta)
corlens_v2/packages/contracts/src/corridor.ts                (+IssuerEntry,ActorEntry,CurrencyMeta,ChatHistoryResponse)
corlens_v2/packages/contracts/src/path.ts                    (+RiskQuickEvalRequest/Response,+ChatHistoryResponse)
corlens_v2/packages/contracts/src/agent.ts                   (confirm SafePathEvent has account-crawled producer shape)
corlens_v2/apps/corridor/src/connectors/(if any)             — no central client
corlens_v2/apps/corridor/src/app.ts                          (+ register currency-meta routes, seed)
corlens_v2/apps/corridor/src/controllers/chat.controller.ts  (+ GET /api/corridors/chat/:chatId)
corlens_v2/apps/corridor/src/repositories/rag.repo.ts        (+ findChatById)
corlens_v2/apps/path/src/app.ts                              (+ register risk-engine routes)
corlens_v2/apps/path/src/controllers/chat.controller.ts      (+ GET /api/analysis/:id/chat)
corlens_v2/apps/path/src/repositories/rag.repo.ts            (+ findLatestChatByAnalysisId)
corlens_v2/apps/agent/src/app.ts                             (+ register compliance-analysis routes)
corlens_v2/apps/agent/src/connectors/corridor.ts             (+ getCurrencyMeta, listCurrencyMeta)
corlens_v2/apps/agent/src/connectors/path.ts                 (+ quickEvalRisk, getAnalysis (if missing))
corlens_v2/apps/agent/src/services/phases/01-corridor-resolution.ts   (fetch currency-meta via connector)
corlens_v2/apps/agent/src/services/phases/05-deep-entity-analysis.ts  (emit account-crawled per address)
corlens_v2/apps/agent/src/services/phases/06-on-chain-path-find.ts    (per-hop quick-eval + max-score)
corlens_v2/apps/agent/src/services/phases/07-off-chain-bridge.ts      (use ctx.state.currencyMeta)
corlens_v2/apps/agent/src/services/phases/09-report.ts                (use ctx.state.currencyMeta)
corlens_v2/apps/mcp-server/src/index.ts                      (+ get_partner_depth)
corlens_v2/Caddyfile                                         (+ /api/compliance/analysis/* rules)
corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md  (milestone ticks)
```

### Deleted

```
corlens_v2/apps/agent/src/data/currency-meta.ts              (after Phase 3 migration is green)
```

---

## Phase 1 — `corridor.CurrencyMeta` table (commit 1)

### Files

- Modify: `packages/db/prisma/schema.prisma`

### Steps

- [ ] **1.1.** Open `packages/db/prisma/schema.prisma`. Locate the `corridor` schema block (after `model Corridor`, before the path schema). Add:

  ```prisma
  model CurrencyMeta {
    code      String   @id              // ISO-4217 or stable token symbol
    issuers   Json                      // IssuerEntry[]
    actors    Json                      // ActorEntry[]
    updatedAt DateTime @updatedAt

    @@schema("corridor")
  }
  ```

- [ ] **1.2.** Run `pnpm --filter @corlens/db prisma generate` from repo root. Confirm `node_modules/@prisma/client` regenerated and `CurrencyMeta` shows up in `prisma.corridor.CurrencyMeta`.
- [ ] **1.3.** Apply to running Postgres (assumes `pnpm dev:db` is up): `pnpm --filter @corlens/db prisma db push`. Verify : `docker compose exec postgres psql -U corlens -d corlens -c '\dt corridor.*'` — `CurrencyMeta` listed.
- [ ] **1.4.** Run `pnpm -r typecheck` clean.
- [ ] **1.5.** Run `pnpm biome check .` clean.
- [ ] **1.6.** Commit:
  ```
  feat(v2,db): add corridor.CurrencyMeta table
  ```
  Single-file commit. No tests yet — the table is exercised by Phase 2.

---

## Phase 2 — Currency-meta seed + endpoints (commit 2)

### Files

- Create: `corlens_v2/tools/export-currency-meta.mjs`
- Create: `apps/corridor/seed/currency-meta.json` *(generated)*
- Create: `apps/corridor/src/repositories/currency-meta.repo.ts`
- Create: `apps/corridor/src/services/currency-meta-seeder.service.ts`
- Create: `apps/corridor/src/services/currency-meta.service.ts`
- Create: `apps/corridor/src/controllers/currency-meta.controller.ts`
- Create: `apps/corridor/tests/unit/currency-meta.service.test.ts`
- Create: `apps/corridor/tests/unit/currency-meta.controller.test.ts`
- Modify: `packages/contracts/src/corridor.ts`
- Modify: `apps/corridor/src/app.ts`

### Sub-phase 2.A — Contracts

- [ ] **2A.1.** Edit `packages/contracts/src/corridor.ts`. Below the existing `CorridorActor` (do **not** rename it — keep the existing shape used by the catalog list), add:

  ```ts
  export const IssuerEntry = z.object({
    key: z.string(),
    name: z.string(),
    address: XrplAddress,
  });
  export type IssuerEntry = z.infer<typeof IssuerEntry>;

  export const ActorEntry = z.object({
    key: z.string(),
    name: z.string(),
    type: z.string(),
    country: z.string().optional(),
    supportsXrp: z.boolean().optional(),
    supportsRlusd: z.boolean().optional(),
    odl: z.boolean().optional(),
    direction: z.enum(["in", "out", "both"]).optional(),
    note: z.string().optional(),
  });
  export type ActorEntry = z.infer<typeof ActorEntry>;

  export const CurrencyMeta = z.object({
    code: z.string().min(3).max(8),
    issuers: z.array(IssuerEntry),
    actors: z.array(ActorEntry),
    updatedAt: z.string().datetime(),
  });
  export type CurrencyMeta = z.infer<typeof CurrencyMeta>;

  export const CurrencyMetaListResponse = z.object({
    currencies: z.array(CurrencyMeta),
    globalHubs: z.array(ActorEntry),
  });
  export type CurrencyMetaListResponse = z.infer<typeof CurrencyMetaListResponse>;
  ```

  (Import `XrplAddress` from `./shared.js` — already used at the top of `path.ts`. Add the import in `corridor.ts` if missing.)

- [ ] **2A.2.** `pnpm --filter @corlens/contracts typecheck` clean.

### Sub-phase 2.B — Export tooling + seed data

- [ ] **2B.1.** Write `corlens_v2/tools/export-currency-meta.mjs`:

  ```js
  #!/usr/bin/env node
  // Exports v1's ISSUERS_BY_CURRENCY + ACTORS_BY_CURRENCY + GLOBAL_HUB_ACTORS to JSON.
  // Run from repo root: pnpm tsx corlens_v2/tools/export-currency-meta.mjs
  import { writeFileSync, mkdirSync } from "node:fs";
  import { dirname, resolve } from "node:path";
  import { fileURLToPath } from "node:url";
  import {
    ISSUERS_BY_CURRENCY,
    ACTORS_BY_CURRENCY,
    GLOBAL_HUB_ACTORS,
  } from "../../corlens/apps/server/src/corridors/catalog.ts";

  const here = dirname(fileURLToPath(import.meta.url));
  const out = resolve(here, "../apps/corridor/seed/currency-meta.json");

  const codes = new Set([
    ...Object.keys(ISSUERS_BY_CURRENCY),
    ...Object.keys(ACTORS_BY_CURRENCY),
  ]);
  const now = new Date().toISOString();
  const currencies = [...codes].sort().map((code) => ({
    code,
    issuers: ISSUERS_BY_CURRENCY[code] ?? [],
    actors: ACTORS_BY_CURRENCY[code] ?? [],
    updatedAt: now,
  }));
  const payload = { currencies, globalHubs: GLOBAL_HUB_ACTORS };

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${currencies.length} currencies + ${GLOBAL_HUB_ACTORS.length} hubs to ${out}`);
  ```

- [ ] **2B.2.** Run it: `pnpm tsx corlens_v2/tools/export-currency-meta.mjs`. Verify the output : `jq '.currencies | length' corlens_v2/apps/corridor/seed/currency-meta.json` should be ≥ 40. Spot-check : `jq '.currencies[] | select(.code == "USD")' corlens_v2/apps/corridor/seed/currency-meta.json` contains 4 issuers.

### Sub-phase 2.C — Repo + service + seeder (TDD)

- [ ] **2C.1.** Write the failing service test `apps/corridor/tests/unit/currency-meta.service.test.ts`:

  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { createCurrencyMetaService } from "../../src/services/currency-meta.service.js";

  describe("currency-meta.service", () => {
    it("returns one CurrencyMeta by code, normalized to ISO datetime", async () => {
      const repo = {
        findByCode: vi.fn(async (code: string) =>
          code === "USD"
            ? {
                code: "USD",
                issuers: [{ key: "rlusd", name: "Ripple (RLUSD)", address: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De" }],
                actors: [{ key: "coinbase", name: "Coinbase", type: "cex" }],
                updatedAt: new Date("2026-05-11T00:00:00Z"),
              }
            : null,
        ),
        list: vi.fn(async () => []),
      };
      const svc = createCurrencyMetaService({ repo, globalHubs: [] });
      const usd = await svc.getByCode("USD");
      expect(usd?.code).toBe("USD");
      expect(usd?.issuers).toHaveLength(1);
      expect(usd?.updatedAt).toBe("2026-05-11T00:00:00.000Z");
      expect(await svc.getByCode("ZZZ")).toBeNull();
    });

    it("list returns currencies + globalHubs", async () => {
      const repo = {
        findByCode: vi.fn(),
        list: vi.fn(async () => [
          { code: "EUR", issuers: [], actors: [], updatedAt: new Date("2026-05-11T00:00:00Z") },
        ]),
      };
      const hubs = [{ key: "tranglo", name: "Tranglo", type: "hub" }];
      const svc = createCurrencyMetaService({ repo, globalHubs: hubs });
      const result = await svc.list();
      expect(result.currencies).toHaveLength(1);
      expect(result.globalHubs).toEqual(hubs);
    });
  });
  ```

- [ ] **2C.2.** Run : `pnpm --filter @corlens/corridor test currency-meta.service`. Expect failure (`createCurrencyMetaService` not exported).
- [ ] **2C.3.** Write `apps/corridor/src/repositories/currency-meta.repo.ts`:

  ```ts
  import type { PrismaClient } from "@prisma/client";

  export type CurrencyMetaRow = {
    code: string;
    issuers: unknown;
    actors: unknown;
    updatedAt: Date;
  };

  export interface CurrencyMetaRepo {
    findByCode(code: string): Promise<CurrencyMetaRow | null>;
    list(): Promise<CurrencyMetaRow[]>;
    upsertMany(rows: { code: string; issuers: unknown; actors: unknown }[]): Promise<number>;
    count(): Promise<number>;
  }

  export function createCurrencyMetaRepo(prisma: PrismaClient): CurrencyMetaRepo {
    return {
      async findByCode(code) {
        return prisma.corridor.currencyMeta.findUnique({ where: { code } });
      },
      async list() {
        return prisma.corridor.currencyMeta.findMany({ orderBy: { code: "asc" } });
      },
      async upsertMany(rows) {
        let n = 0;
        for (const r of rows) {
          await prisma.corridor.currencyMeta.upsert({
            where: { code: r.code },
            update: { issuers: r.issuers as object, actors: r.actors as object },
            create: { code: r.code, issuers: r.issuers as object, actors: r.actors as object },
          });
          n++;
        }
        return n;
      },
      async count() {
        return prisma.corridor.currencyMeta.count();
      },
    };
  }
  ```

  *(Note: Prisma's multiSchema places models under `prisma.corridor.currencyMeta`. If the generated client lacks this namespacing, fall back to `prisma.currencyMeta` — verify with `console.log(Object.keys(prisma))` in a one-shot script.)*

- [ ] **2C.4.** Write `apps/corridor/src/services/currency-meta.service.ts`:

  ```ts
  import type { ActorEntry, CurrencyMeta, IssuerEntry } from "@corlens/contracts";
  import type { CurrencyMetaRepo, CurrencyMetaRow } from "../repositories/currency-meta.repo.js";

  export interface CurrencyMetaService {
    getByCode(code: string): Promise<CurrencyMeta | null>;
    list(): Promise<{ currencies: CurrencyMeta[]; globalHubs: ActorEntry[] }>;
  }

  function toCurrencyMeta(row: CurrencyMetaRow): CurrencyMeta {
    return {
      code: row.code,
      issuers: (row.issuers as IssuerEntry[]) ?? [],
      actors: (row.actors as ActorEntry[]) ?? [],
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  export function createCurrencyMetaService(deps: {
    repo: CurrencyMetaRepo;
    globalHubs: ActorEntry[];
  }): CurrencyMetaService {
    return {
      async getByCode(code) {
        const row = await deps.repo.findByCode(code.toUpperCase());
        return row ? toCurrencyMeta(row) : null;
      },
      async list() {
        const rows = await deps.repo.list();
        return { currencies: rows.map(toCurrencyMeta), globalHubs: deps.globalHubs };
      },
    };
  }
  ```

- [ ] **2C.5.** Re-run the test. Expect green.
- [ ] **2C.6.** Write the seeder `apps/corridor/src/services/currency-meta-seeder.service.ts`:

  ```ts
  import { readFileSync } from "node:fs";
  import type { ActorEntry } from "@corlens/contracts";
  import type { CurrencyMetaRepo } from "../repositories/currency-meta.repo.js";

  export type SeedResult = { seeded: number; alreadyPresent: number };

  export function createCurrencyMetaSeeder(deps: {
    repo: CurrencyMetaRepo;
    seedPath: string;
  }): {
    seedIfEmpty(): Promise<SeedResult>;
    globalHubs(): ActorEntry[];
  } {
    let cachedHubs: ActorEntry[] | null = null;
    function load() {
      const raw = readFileSync(deps.seedPath, "utf-8");
      const parsed = JSON.parse(raw) as {
        currencies: { code: string; issuers: unknown; actors: unknown }[];
        globalHubs: ActorEntry[];
      };
      cachedHubs = parsed.globalHubs;
      return parsed;
    }
    return {
      async seedIfEmpty() {
        const existing = await deps.repo.count();
        if (existing > 0) {
          if (cachedHubs === null) load();
          return { seeded: 0, alreadyPresent: existing };
        }
        const parsed = load();
        const seeded = await deps.repo.upsertMany(parsed.currencies);
        return { seeded, alreadyPresent: 0 };
      },
      globalHubs() {
        if (cachedHubs === null) load();
        return cachedHubs ?? [];
      },
    };
  }
  ```

- [ ] **2C.7.** `pnpm --filter @corlens/corridor typecheck` clean.

### Sub-phase 2.D — Controller (TDD)

- [ ] **2D.1.** Write the failing controller test `apps/corridor/tests/unit/currency-meta.controller.test.ts`:

  ```ts
  import Fastify from "fastify";
  import {
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
  } from "fastify-type-provider-zod";
  import { describe, expect, it } from "vitest";
  import { registerCurrencyMetaRoutes } from "../../src/controllers/currency-meta.controller.js";

  function makeApp(svc: any) {
    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerCurrencyMetaRoutes(app, svc);
    return app;
  }

  describe("currency-meta.controller", () => {
    it("GET /api/corridors/currency-meta returns list + globalHubs with cache header", async () => {
      const svc = {
        async list() {
          return {
            currencies: [
              {
                code: "USD",
                issuers: [],
                actors: [],
                updatedAt: "2026-05-11T00:00:00.000Z",
              },
            ],
            globalHubs: [{ key: "tranglo", name: "Tranglo", type: "hub" }],
          };
        },
        async getByCode() {
          return null;
        },
      };
      const app = makeApp(svc);
      const res = await app.inject({ method: "GET", url: "/api/corridors/currency-meta" });
      expect(res.statusCode).toBe(200);
      expect(res.headers["cache-control"]).toContain("max-age=300");
      const body = res.json();
      expect(body.currencies).toHaveLength(1);
      expect(body.globalHubs[0].key).toBe("tranglo");
      await app.close();
    });

    it("GET /api/corridors/currency-meta/:code returns 200 or 404", async () => {
      const svc = {
        async list() {
          return { currencies: [], globalHubs: [] };
        },
        async getByCode(code: string) {
          return code === "USD"
            ? { code: "USD", issuers: [], actors: [], updatedAt: "2026-05-11T00:00:00.000Z" }
            : null;
        },
      };
      const app = makeApp(svc);
      const ok = await app.inject({ method: "GET", url: "/api/corridors/currency-meta/USD" });
      expect(ok.statusCode).toBe(200);
      expect(ok.json().code).toBe("USD");
      const miss = await app.inject({ method: "GET", url: "/api/corridors/currency-meta/ZZZ" });
      expect(miss.statusCode).toBe(404);
      await app.close();
    });
  });
  ```

- [ ] **2D.2.** Run : red.
- [ ] **2D.3.** Write `apps/corridor/src/controllers/currency-meta.controller.ts`:

  ```ts
  import { corridor as cc } from "@corlens/contracts";
  import type { FastifyInstance } from "fastify";
  import type { ZodTypeProvider } from "fastify-type-provider-zod";
  import { z } from "zod";
  import type { CurrencyMetaService } from "../services/currency-meta.service.js";

  const ErrorResp = z.object({ error: z.string() });

  export async function registerCurrencyMetaRoutes(
    app: FastifyInstance,
    svc: CurrencyMetaService,
  ): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();
    typed.get(
      "/api/corridors/currency-meta",
      {
        schema: {
          response: { 200: cc.CurrencyMetaListResponse },
          tags: ["corridor"],
        },
      },
      async (_req, reply) => {
        reply.header("Cache-Control", "public, max-age=300");
        return svc.list();
      },
    );

    typed.get(
      "/api/corridors/currency-meta/:code",
      {
        schema: {
          params: z.object({ code: z.string().min(3).max(8) }),
          response: { 200: cc.CurrencyMeta, 404: ErrorResp },
          tags: ["corridor"],
        },
      },
      async (req, reply) => {
        const row = await svc.getByCode(req.params.code);
        if (!row) {
          reply.status(404).send({ error: "not_found" });
          return reply;
        }
        reply.header("Cache-Control", "public, max-age=300");
        return row;
      },
    );
  }
  ```

- [ ] **2D.4.** Re-run the test. Expect green.

### Sub-phase 2.E — Wire into app

- [ ] **2E.1.** Edit `apps/corridor/src/app.ts`:
  - Add imports:
    ```ts
    import { createCurrencyMetaRepo } from "./repositories/currency-meta.repo.js";
    import { createCurrencyMetaSeeder } from "./services/currency-meta-seeder.service.js";
    import { createCurrencyMetaService } from "./services/currency-meta.service.js";
    import { registerCurrencyMetaRoutes } from "./controllers/currency-meta.controller.js";
    ```
  - After `const ragRepo = createRagRepo(...)`, add:
    ```ts
    const currencyMetaRepo = createCurrencyMetaRepo(app.prisma);
    const currencyMetaSeeder = createCurrencyMetaSeeder({
      repo: currencyMetaRepo,
      seedPath: path.join(__dirname, "..", "seed", "currency-meta.json"),
    });
    const currencyMetaSeedResult = await currencyMetaSeeder.seedIfEmpty();
    app.log.info({ currencyMetaSeedResult }, "currency-meta seed check");
    const currencyMetaService = createCurrencyMetaService({
      repo: currencyMetaRepo,
      globalHubs: currencyMetaSeeder.globalHubs(),
    });
    ```
  - After the existing `await registerPartnerDepthRoutes(...)` call, add:
    ```ts
    await registerCurrencyMetaRoutes(app, currencyMetaService);
    ```

- [ ] **2E.2.** Run all corridor service tests: `pnpm --filter @corlens/corridor test`. All green (existing + 2 new files).
- [ ] **2E.3.** Integration smoke (optional, only if dev DB up): `pnpm --filter @corlens/corridor dev` in one terminal, then `curl -sS http://localhost:3004/api/corridors/currency-meta | jq '.currencies | length'` should be ≥ 40.
- [ ] **2E.4.** `pnpm biome check .` clean. `pnpm -r typecheck` clean.
- [ ] **2E.5.** Commit:
  ```
  feat(v2,corridor): currency-meta seed (50 currencies) + GET /api/corridors/currency-meta endpoints
  ```

---

## Phase 3 — Agent migration to corridor connector (commit 3)

### Files

- Modify: `apps/agent/src/connectors/corridor.ts`
- Modify: `apps/agent/src/services/phases/01-corridor-resolution.ts`
- Modify: `apps/agent/src/services/phases/07-off-chain-bridge.ts`
- Modify: `apps/agent/src/services/phases/09-report.ts`
- Modify: `apps/agent/src/services/phases/types.ts` (PhaseContext.state)
- Modify: `apps/agent/tests/unit/phases/01-corridor-resolution.test.ts` (extend)
- Delete: `apps/agent/src/data/currency-meta.ts`

### Steps

- [ ] **3.1.** Open `apps/agent/src/connectors/corridor.ts`. Read top exports. Add two methods (signature `getCurrencyMeta(code): Promise<CurrencyMeta | null>` and `listCurrencyMeta(): Promise<CurrencyMetaListResponse>`):

  ```ts
  // append near existing methods
  async getCurrencyMeta(code: string): Promise<CurrencyMeta | null> {
    const res = await fetch(`${baseUrl}/api/corridors/currency-meta/${code}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`corridor.getCurrencyMeta ${res.status}`);
    return CurrencyMeta.parse(await res.json());
  }

  async listCurrencyMeta(): Promise<CurrencyMetaListResponse> {
    const res = await fetch(`${baseUrl}/api/corridors/currency-meta`);
    if (!res.ok) throw new Error(`corridor.listCurrencyMeta ${res.status}`);
    return CurrencyMetaListResponse.parse(await res.json());
  }
  ```

  Add imports `import { corridor as cc } from "@corlens/contracts"` and reference `cc.CurrencyMeta`, `cc.CurrencyMetaListResponse` (whichever style the existing connector uses — match it).

- [ ] **3.2.** Edit `apps/agent/src/services/phases/types.ts`. Extend `SharedState`:
  ```ts
  currencyMeta: {
    src: CurrencyMeta | null;
    dst: CurrencyMeta | null;
    globalHubs: ActorEntry[];
  };
  ```
  Import `CurrencyMeta`, `ActorEntry` from `@corlens/contracts`. Update the initial state factory (if any) to set `currencyMeta: { src: null, dst: null, globalHubs: [] }`.

- [ ] **3.3.** Write the failing test extension in `apps/agent/tests/unit/phases/01-corridor-resolution.test.ts` (locate the existing test file). Add:

  ```ts
  it("populates ctx.state.currencyMeta from corridorConnector", async () => {
    const corridor = {
      getCurrencyMeta: vi.fn(async (code: string) =>
        code === "USD"
          ? { code: "USD", issuers: [], actors: [{ key: "k", name: "n", type: "cex" }], updatedAt: "2026-05-11T00:00:00.000Z" }
          : { code, issuers: [], actors: [], updatedAt: "2026-05-11T00:00:00.000Z" },
      ),
      listCurrencyMeta: vi.fn(async () => ({ currencies: [], globalHubs: [{ key: "tranglo", name: "Tranglo", type: "hub" }] })),
      // ...keep the rest of the existing corridor mock
    };
    const ctx = makeCtx({ input: { srcCcy: "USD", dstCcy: "EUR", amount: "1000" }, deps: { corridor } });
    const phase = new CorridorResolutionPhase();
    await phase.run(ctx, vi.fn());
    expect(corridor.getCurrencyMeta).toHaveBeenCalledWith("USD");
    expect(corridor.getCurrencyMeta).toHaveBeenCalledWith("EUR");
    expect(ctx.state.currencyMeta.src?.code).toBe("USD");
    expect(ctx.state.currencyMeta.globalHubs).toHaveLength(1);
  });
  ```

  (Adjust to the existing test file's helpers — `makeCtx`, `CorridorResolutionPhase` import.)

- [ ] **3.4.** Run : red.
- [ ] **3.5.** Edit `apps/agent/src/services/phases/01-corridor-resolution.ts`. In `run(ctx, emit)`, add — right after the existing corridor lookup — a parallel fetch:

  ```ts
  const [srcMeta, dstMeta, hubList] = await Promise.all([
    ctx.deps.corridor.getCurrencyMeta(ctx.input.srcCcy),
    ctx.deps.corridor.getCurrencyMeta(ctx.input.dstCcy),
    ctx.deps.corridor.listCurrencyMeta(),
  ]);
  ctx.state.currencyMeta = {
    src: srcMeta,
    dst: dstMeta,
    globalHubs: hubList.globalHubs,
  };
  ```

- [ ] **3.6.** Re-run : green.
- [ ] **3.7.** Locate all callsites of `currency-meta.ts` :

  ```bash
  grep -rn "data/currency-meta" corlens_v2/apps/agent/src --include="*.ts"
  ```

  Replace each `ISSUERS_BY_CURRENCY[ccy]` / `ACTORS_BY_CURRENCY[ccy]` / `GLOBAL_HUB_ACTORS` reference with `ctx.state.currencyMeta.src.issuers` / `.actors` (or `.dst.*`) / `.globalHubs`. Touch points expected: `07-off-chain-bridge.ts`, `09-report.ts`. If a phase doesn't have ctx access, thread it through.

- [ ] **3.8.** Run all agent tests: `pnpm --filter @corlens/agent test`. Green.
- [ ] **3.9.** Delete `apps/agent/src/data/currency-meta.ts`:
  ```
  git rm corlens_v2/apps/agent/src/data/currency-meta.ts
  ```
  Re-run typecheck: `pnpm --filter @corlens/agent typecheck`. Green (all references migrated). If red, fix the missed references and rerun.

- [ ] **3.10.** `pnpm biome check .` clean.
- [ ] **3.11.** Commit:
  ```
  refactor(v2,agent): replace local currency-meta.ts with corridor.getCurrencyMeta() connector
  ```

---

## Phase 4 — Risk-engine `quick-eval` endpoint (commit 4)

### Files

- Modify: `packages/contracts/src/path.ts`
- Create: `apps/path/src/services/quick-eval.service.ts`
- Create: `apps/path/src/controllers/risk-engine.controller.ts`
- Create: `apps/path/tests/unit/quick-eval.service.test.ts`
- Create: `apps/path/tests/unit/risk-engine.controller.test.ts`
- Modify: `apps/path/src/app.ts`

### Sub-phase 4.A — Contract

- [ ] **4A.1.** Edit `packages/contracts/src/path.ts`. After `RiskFlag` definition, add:

  ```ts
  export const RiskQuickEvalRequest = z.object({
    address: XrplAddress,
  });
  export type RiskQuickEvalRequest = z.infer<typeof RiskQuickEvalRequest>;

  export const RiskQuickEvalResponse = z.object({
    address: XrplAddress,
    score: z.number().min(0).max(100),
    flags: z.array(RiskFlag),
    summary: z.object({
      isIssuer: z.boolean(),
      trustLineCount: z.number().int().min(0),
      hasAmmPool: z.boolean(),
    }),
  });
  export type RiskQuickEvalResponse = z.infer<typeof RiskQuickEvalResponse>;
  ```

- [ ] **4A.2.** `pnpm --filter @corlens/contracts typecheck` clean.

### Sub-phase 4.B — Service (TDD)

- [ ] **4B.1.** Write the failing test `apps/path/tests/unit/quick-eval.service.test.ts`:

  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { createQuickEvalService } from "../../src/services/quick-eval.service.js";

  const baseCrawl = {
    accountInfo: { account_data: { Account: "rTest", Flags: 0 } },
    trustLines: [],
    lpHolders: [],
    asks: [],
    bids: [],
    paths: [],
    gatewayBalances: { obligations: {} },
    ammPool: null,
  };

  describe("quick-eval.service", () => {
    it("returns score 0 + no flags for a clean account", async () => {
      const crawler = { crawlFromSeedLight: vi.fn(async () => baseCrawl) };
      const svc = createQuickEvalService({ crawler, cacheTtlMs: 0 });
      const r = await svc.evaluate("rTest");
      expect(r.score).toBe(0);
      expect(r.flags).toEqual([]);
      expect(r.summary.isIssuer).toBe(false);
    });

    it("flags GLOBAL_FREEZE and scores HIGH", async () => {
      const crawler = {
        crawlFromSeedLight: vi.fn(async () => ({
          ...baseCrawl,
          accountInfo: { account_data: { Account: "rFrozen", Flags: 0x00400000 } },
        })),
      };
      const svc = createQuickEvalService({ crawler, cacheTtlMs: 0 });
      const r = await svc.evaluate("rFrozen");
      expect(r.flags.some((f) => f.flag === "GLOBAL_FREEZE")).toBe(true);
      expect(r.score).toBeGreaterThanOrEqual(30);
    });

    it("caches results within ttl", async () => {
      const crawler = { crawlFromSeedLight: vi.fn(async () => baseCrawl) };
      const svc = createQuickEvalService({ crawler, cacheTtlMs: 30_000 });
      await svc.evaluate("rTest");
      await svc.evaluate("rTest");
      expect(crawler.crawlFromSeedLight).toHaveBeenCalledTimes(1);
    });
  });
  ```

- [ ] **4B.2.** Run : red (`createQuickEvalService` not exported).
- [ ] **4B.3.** Write `apps/path/src/services/quick-eval.service.ts`:

  ```ts
  import type { RiskQuickEvalResponse } from "@corlens/contracts";
  import { computeRiskFlags } from "../domain/risk-engine.js";

  type CrawlResult = Parameters<typeof computeRiskFlags>[0];

  export interface QuickEvalService {
    evaluate(address: string): Promise<RiskQuickEvalResponse>;
  }

  const SEVERITY_WEIGHT = { HIGH: 30, MED: 15, LOW: 5 } as const;
  const MAX_CACHE = 256;

  export function createQuickEvalService(deps: {
    crawler: { crawlFromSeedLight(address: string): Promise<CrawlResult> };
    cacheTtlMs?: number;
  }): QuickEvalService {
    const ttl = deps.cacheTtlMs ?? 30_000;
    const cache = new Map<string, { expiresAt: number; value: RiskQuickEvalResponse }>();

    function fromCache(address: string): RiskQuickEvalResponse | null {
      const hit = cache.get(address);
      if (!hit) return null;
      if (hit.expiresAt < Date.now()) {
        cache.delete(address);
        return null;
      }
      return hit.value;
    }

    function intoCache(address: string, value: RiskQuickEvalResponse): void {
      if (ttl <= 0) return;
      if (cache.size >= MAX_CACHE) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }
      cache.set(address, { expiresAt: Date.now() + ttl, value });
    }

    return {
      async evaluate(address) {
        const cached = fromCache(address);
        if (cached) return cached;
        const crawl = await deps.crawler.crawlFromSeedLight(address);
        const flags = computeRiskFlags(crawl, address);
        const score = Math.min(
          100,
          flags.reduce((acc, f) => acc + SEVERITY_WEIGHT[f.severity], 0),
        );
        const obligations = crawl.gatewayBalances?.obligations ?? {};
        const value: RiskQuickEvalResponse = {
          address,
          score,
          flags,
          summary: {
            isIssuer: Object.keys(obligations).length > 0,
            trustLineCount: crawl.trustLines.length,
            hasAmmPool: crawl.ammPool != null,
          },
        };
        intoCache(address, value);
        return value;
      },
    };
  }
  ```

  *(Re-verify the field names of `CrawlResult` by reading `apps/path/src/domain/types.ts`. If `ammPool` is named differently, fix accordingly.)*

- [ ] **4B.4.** Re-run : green.

### Sub-phase 4.C — Controller (TDD, with HMAC)

- [ ] **4C.1.** Write the failing controller test `apps/path/tests/unit/risk-engine.controller.test.ts`:

  ```ts
  import { createSignedHeaders } from "@corlens/clients/hmac";
  import Fastify from "fastify";
  import {
    serializerCompiler,
    validatorCompiler,
    type ZodTypeProvider,
  } from "fastify-type-provider-zod";
  import { describe, expect, it, vi } from "vitest";
  import { registerRiskEngineRoutes } from "../../src/controllers/risk-engine.controller.js";
  // import the HMAC verify plugin used by the path app to mirror prod behaviour.
  import { registerHmacPlugin } from "../../src/plugins/hmac.js";

  const SECRET = "test-secret";

  function makeApp(svc: any) {
    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerHmacPlugin(app, { secret: SECRET });
    registerRiskEngineRoutes(app, svc);
    return app;
  }

  describe("risk-engine.controller", () => {
    it("401s without HMAC", async () => {
      const app = makeApp({ evaluate: vi.fn() });
      const res = await app.inject({
        method: "POST",
        url: "/api/risk-engine/quick-eval",
        payload: { address: "rTest" },
      });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it("200 with valid HMAC + body", async () => {
      const svc = {
        evaluate: vi.fn(async (a: string) => ({
          address: a,
          score: 0,
          flags: [],
          summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
        })),
      };
      const app = makeApp(svc);
      const body = { address: "rTestrTestrTestrTestrTestrTestrTest" };
      const headers = createSignedHeaders({
        method: "POST",
        path: "/api/risk-engine/quick-eval",
        body: JSON.stringify(body),
        secret: SECRET,
      });
      const res = await app.inject({
        method: "POST",
        url: "/api/risk-engine/quick-eval",
        headers: { ...headers, "content-type": "application/json" },
        payload: body,
      });
      expect(res.statusCode).toBe(200);
      expect(svc.evaluate).toHaveBeenCalledWith(body.address);
      await app.close();
    });
  });
  ```

  *(Adjust the HMAC helper import path to whatever Phase E shipped — typically `@corlens/clients/hmac` exposes `createSignedHeaders` or similar. If the helper name differs, mirror it.)*

- [ ] **4C.2.** Run : red.
- [ ] **4C.3.** Write `apps/path/src/controllers/risk-engine.controller.ts`:

  ```ts
  import { path as pp } from "@corlens/contracts";
  import type { FastifyInstance } from "fastify";
  import type { ZodTypeProvider } from "fastify-type-provider-zod";
  import type { QuickEvalService } from "../services/quick-eval.service.js";

  export async function registerRiskEngineRoutes(
    app: FastifyInstance,
    svc: QuickEvalService,
  ): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();
    typed.post(
      "/api/risk-engine/quick-eval",
      {
        schema: {
          body: pp.RiskQuickEvalRequest,
          response: { 200: pp.RiskQuickEvalResponse },
          tags: ["risk-engine"],
        },
        config: { internal: true },
      },
      async (req) => svc.evaluate(req.body.address),
    );
  }
  ```

  *(The `config: { internal: true }` flag is what the HMAC preHandler from Phase E checks. Verify the flag key matches Phase E's convention — if Phase E uses `routeOptions.config.hmac = true` or a tag, mirror that.)*

- [ ] **4C.4.** Re-run : green.

### Sub-phase 4.D — Wire into app

- [ ] **4D.1.** Edit `apps/path/src/app.ts`:
  - Import:
    ```ts
    import { createQuickEvalService } from "./services/quick-eval.service.js";
    import { registerRiskEngineRoutes } from "./controllers/risk-engine.controller.js";
    ```
  - After the existing crawler/marketData wiring, build the service. Reuse the existing `historyCrawler` (or whichever service holds `crawlFromSeedLight` from Phase C.3) :
    ```ts
    const quickEval = createQuickEvalService({ crawler: historyCrawler });
    ```
  - Register the route:
    ```ts
    await registerRiskEngineRoutes(app, quickEval);
    ```

- [ ] **4D.2.** `pnpm --filter @corlens/path test` — all green (existing + 2 new).
- [ ] **4D.3.** `pnpm biome check .` clean. `pnpm -r typecheck` clean.
- [ ] **4D.4.** Commit:
  ```
  feat(v2,path): expose risk-engine via POST /api/risk-engine/quick-eval (HMAC-protected)
  ```

---

## Phase 5 — Agent per-hop risk + `account-crawled` events (commit 5)

### Files

- Modify: `packages/contracts/src/agent.ts` (confirm `SafePathEvent` `account-crawled` shape)
- Modify: `apps/agent/src/connectors/path.ts` (+ `quickEvalRisk`)
- Modify: `apps/agent/src/services/phases/05-deep-entity-analysis.ts`
- Modify: `apps/agent/src/services/phases/06-on-chain-path-find.ts`
- Modify: `apps/agent/src/services/phases/types.ts` (`crawledAddresses: Set<string>` on SharedState)
- Create: `apps/agent/tests/unit/phase-on-chain-path-find.test.ts`
- Modify: existing `apps/agent/tests/unit/phases/05-deep-entity-analysis.test.ts` (extend)

### Steps

- [ ] **5.1.** Open `packages/contracts/src/agent.ts`. Verify `SafePathEvent` union has a member shaped:
  ```ts
  z.object({
    kind: z.literal("account-crawled"),
    address: z.string(),
    score: z.number(),
    flags: z.array(RiskFlag),
  })
  ```
  If not, add it. Re-run contracts typecheck.

- [ ] **5.2.** Edit `apps/agent/src/connectors/path.ts`. Add HMAC-signed POST helper (mirror an existing internal method in the same file). Append:

  ```ts
  async quickEvalRisk(address: string): Promise<RiskQuickEvalResponse> {
    const res = await signedFetch(`${baseUrl}/api/risk-engine/quick-eval`, {
      method: "POST",
      body: { address },
      secret: hmacSecret,
    });
    if (!res.ok) throw new Error(`path.quickEvalRisk ${res.status}`);
    return RiskQuickEvalResponse.parse(await res.json());
  }
  ```

  Match the existing connector's signing pattern (`signedFetch` or the local helper used elsewhere in `path.ts`).

- [ ] **5.3.** Edit `apps/agent/src/services/phases/types.ts`. Add to `SharedState`:
  ```ts
  crawledAddresses: Set<string>;
  ```
  Initialize as `new Set()` in the state factory.

- [ ] **5.4.** Write the failing Phase 5 (path-find) test `apps/agent/tests/unit/phase-on-chain-path-find.test.ts`:

  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { OnChainPathFindPhase } from "../../src/services/phases/06-on-chain-path-find.js";

  describe("06-on-chain-path-find", () => {
    it("emits account-crawled per hop, computes max score, rejects path > tolerance", async () => {
      const pathConn = {
        quickEvalRisk: vi.fn(async (address: string) => ({
          address,
          score: address === "rRisky" ? 80 : 10,
          flags: [],
          summary: { isIssuer: false, trustLineCount: 0, hasAmmPool: false },
        })),
      };
      const marketData = {
        pathFind: vi.fn(async () => ({
          paths: [
            { hops: [{ address: "rA" }, { address: "rB" }] },
            { hops: [{ address: "rA" }, { address: "rRisky" }] },
          ],
        })),
      };
      const events: any[] = [];
      const ctx = {
        input: { srcCcy: "USD", dstCcy: "MXN", amount: "1000", maxRiskTolerance: 60 },
        state: {
          paths: [],
          rejected: [],
          riskScore: null,
          crawledAddresses: new Set<string>(),
          /* other state fields zeroed */
        },
        deps: { path: pathConn, marketData },
        signal: new AbortController().signal,
      } as any;
      const phase = new OnChainPathFindPhase();
      await phase.run(ctx, (e) => events.push(e));

      const crawled = events.filter((e) => e.kind === "account-crawled");
      expect(crawled).toHaveLength(3); // rA, rB, rRisky — rA dedup
      expect(ctx.state.paths).toHaveLength(1); // path 2 rejected
      expect(ctx.state.rejected).toHaveLength(1);
      expect(ctx.state.riskScore).toBe(10); // max of accepted paths
    });
  });
  ```

- [ ] **5.5.** Run : red.
- [ ] **5.6.** Edit `apps/agent/src/services/phases/06-on-chain-path-find.ts`. Replace the synthetic-score block with :

  ```ts
  const pathfind = await ctx.deps.marketData.pathFind(/* existing args */);

  async function evalHop(address: string) {
    if (ctx.state.crawledAddresses.has(address)) return null;
    ctx.state.crawledAddresses.add(address);
    const r = await ctx.deps.path.quickEvalRisk(address);
    emit({ kind: "account-crawled", address: r.address, score: r.score, flags: r.flags });
    return r;
  }

  // simple concurrency pool of 4
  const tolerance = ctx.input.maxRiskTolerance ?? 60;
  for (const path of pathfind.paths) {
    const hopAddrs = path.hops.map((h) => h.address);
    const evaluated = await Promise.all(hopAddrs.map(evalHop));
    const hopScores = evaluated
      .map((r, i) => r?.score ?? /* fetched earlier */ NaN)
      .filter((s) => !Number.isNaN(s));
    const pathScore = hopScores.length === 0 ? 0 : Math.max(...hopScores);
    if (pathScore > tolerance) {
      ctx.state.rejected.push({ /* same shape as before */ path, score: pathScore, reason: "risk_above_tolerance" });
    } else {
      ctx.state.paths.push({ /* same shape as before */ path, score: pathScore });
    }
  }
  ctx.state.riskScore =
    ctx.state.paths.length === 0 ? null : Math.max(...ctx.state.paths.map((p) => p.score));
  ```

  *(Match the existing PathCandidate / RejectedPath shapes. The dedup-by-set guard is critical — without it, re-evaluating the same address across multiple paths floods the SSE stream and the LRU cache.)*

  Replace the concurrency-4 pool: if a real pool helper exists in the repo (look in `apps/path/src/services/bfs.service.ts` — Phase C.2 added one), reuse it. Otherwise the per-path `Promise.all` is fine for N < 10 hops.

- [ ] **5.7.** Re-run : green.
- [ ] **5.8.** Edit `apps/agent/src/services/phases/05-deep-entity-analysis.ts`. After the analysis-complete polling resolves, before `emit({ kind: "analyses-summary", ... })`, add:

  ```ts
  const flagsByAddress = new Map<string, { score: number; flags: RiskFlag[] }>();
  for (const rf of analysisSummary.riskFlags ?? []) {
    const addr = (rf.data as { address?: string } | undefined)?.address;
    if (!addr) continue;
    const acc = flagsByAddress.get(addr) ?? { score: 0, flags: [] };
    acc.flags.push(rf);
    acc.score += rf.severity === "HIGH" ? 30 : rf.severity === "MED" ? 15 : 5;
    flagsByAddress.set(addr, acc);
  }
  for (const [address, agg] of flagsByAddress) {
    if (ctx.state.crawledAddresses.has(address)) continue;
    ctx.state.crawledAddresses.add(address);
    emit({
      kind: "account-crawled",
      address,
      score: Math.min(100, agg.score),
      flags: agg.flags,
    });
  }
  ```

  *(The shape of `summaryJson.riskFlags` may store address either inside `data` or as a top-level field. Read the existing test fixtures or `apps/path/src/services/bfs.service.ts` to confirm. Adjust accordingly. Aim: one `account-crawled` event per distinct address seen by the analysis.)*

- [ ] **5.9.** Extend `apps/agent/tests/unit/phases/05-deep-entity-analysis.test.ts` with:

  ```ts
  it("emits one account-crawled per distinct address from analysisSummary.riskFlags", async () => {
    /* mock path connector returning an analysis whose summaryJson.riskFlags include
       3 entries across 2 addresses; assert 2 account-crawled events emitted. */
  });
  ```

- [ ] **5.10.** Run all agent tests : `pnpm --filter @corlens/agent test`. Green.
- [ ] **5.11.** `pnpm biome check .` clean. `pnpm -r typecheck` clean.
- [ ] **5.12.** Commit:
  ```
  feat(v2,agent): per-hop risk classification in Phase 5 + account-crawled events in Phase 4 & 5
  ```

---

## Phase 6 — Entity compliance endpoints (commit 6)

### Files

- Modify: `packages/contracts/src/agent.ts` (`AnalysisComplianceRequest`, `AnalysisComplianceResponse`)
- Modify: `apps/agent/src/connectors/path.ts` (`getAnalysis`, `getAnalysisRiskFlags` if not present)
- Create: `apps/agent/src/services/compliance-analysis.service.ts`
- Create: `apps/agent/src/controllers/compliance-analysis.controller.ts`
- Create: `apps/agent/tests/unit/compliance-analysis.service.test.ts`
- Create: `apps/agent/tests/unit/compliance-analysis.controller.test.ts`
- Modify: `apps/agent/src/app.ts`
- Modify: `corlens_v2/Caddyfile`

### Sub-phase 6.A — Contracts

- [ ] **6A.1.** Edit `packages/contracts/src/agent.ts`. Add:

  ```ts
  export const AnalysisComplianceRequest = z.object({
    travelRule: z
      .object({
        originatorName: z.string().optional(),
        beneficiaryName: z.string().optional(),
      })
      .optional(),
    sanctionsCheck: z.boolean().optional(),
  });
  export type AnalysisComplianceRequest = z.infer<typeof AnalysisComplianceRequest>;

  export const AnalysisComplianceResponse = z.object({
    analysisId: z.string().uuid(),
    markdown: z.string(),
    auditHash: z.string().length(64),
  });
  export type AnalysisComplianceResponse = z.infer<typeof AnalysisComplianceResponse>;
  ```

### Sub-phase 6.B — Path connector helpers

- [ ] **6B.1.** Edit `apps/agent/src/connectors/path.ts`. If `getAnalysis(id)` is not already exposed, add (mirror the existing GET pattern):

  ```ts
  async getAnalysis(id: string): Promise<AnalysisSummary | null> {
    const res = await fetch(`${baseUrl}/api/analysis/${id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`path.getAnalysis ${res.status}`);
    return AnalysisSummary.parse(await res.json());
  }

  async getAnalysisRiskFlags(id: string): Promise<RiskFlag[]> {
    const summary = await this.getAnalysis(id);
    // riskFlags travel inside Analysis.summaryJson, exposed by GET /api/analysis/:id as part of stats or via a dedicated field.
    // If the path service does not surface riskFlags in the summary endpoint, add it there
    // (apps/path/src/controllers/analysis.controller.ts response shape) before relying on it here.
    return ((summary as unknown as { riskFlags?: RiskFlag[] })?.riskFlags) ?? [];
  }
  ```

  *(Realistic precondition: confirm `GET /api/analysis/:id` returns `riskFlags`. If not, before continuing, extend `apps/path/src/controllers/analysis.controller.ts` to include them in the response and update `AnalysisSummary` Zod accordingly. This is a tiny additive change — do it in the same commit if needed.)*

### Sub-phase 6.C — Service (TDD)

- [ ] **6C.1.** Write the failing test `apps/agent/tests/unit/compliance-analysis.service.test.ts`:

  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { createComplianceAnalysisService } from "../../src/services/compliance-analysis.service.js";

  describe("compliance-analysis.service", () => {
    it("builds markdown + stable auditHash from path summary", async () => {
      const pathConn = {
        getAnalysis: vi.fn(async () => ({
          id: "00000000-0000-0000-0000-000000000001",
          seedAddress: "rSeed",
          seedLabel: "Test",
          depth: 1,
          status: "done",
          error: null,
          stats: { nodeCount: 5, edgeCount: 8, riskCounts: { HIGH: 1, MED: 0, LOW: 2 } },
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:01:00.000Z",
        })),
        getAnalysisRiskFlags: vi.fn(async () => [
          { flag: "GLOBAL_FREEZE", severity: "HIGH" as const, detail: "frozen", data: { address: "rSeed" } },
        ]),
      };
      const svc = createComplianceAnalysisService({ path: pathConn });
      const r = await svc.build("00000000-0000-0000-0000-000000000001");
      expect(r.markdown).toContain("# Entity Audit Compliance Report");
      expect(r.markdown).toContain("rSeed");
      expect(r.auditHash).toMatch(/^[0-9a-f]{64}$/);
      const r2 = await svc.build("00000000-0000-0000-0000-000000000001");
      expect(r2.auditHash).toBe(r.auditHash); // stable
    });

    it("throws if analysis not found", async () => {
      const svc = createComplianceAnalysisService({
        path: {
          getAnalysis: vi.fn(async () => null),
          getAnalysisRiskFlags: vi.fn(async () => []),
        },
      });
      await expect(svc.build("00000000-0000-0000-0000-000000000999")).rejects.toThrow("not_found");
    });
  });
  ```

- [ ] **6C.2.** Run : red.
- [ ] **6C.3.** Write `apps/agent/src/services/compliance-analysis.service.ts`:

  ```ts
  import { createHash } from "node:crypto";
  import type { AnalysisSummary, RiskFlag } from "@corlens/contracts";

  export interface ComplianceAnalysisService {
    build(analysisId: string): Promise<{
      analysisId: string;
      markdown: string;
      auditHash: string;
      data: { summary: AnalysisSummary; flags: RiskFlag[] };
    }>;
    renderPdf(analysisId: string): Promise<Buffer>;
  }

  export function createComplianceAnalysisService(deps: {
    path: {
      getAnalysis(id: string): Promise<AnalysisSummary | null>;
      getAnalysisRiskFlags(id: string): Promise<RiskFlag[]>;
    };
  }): ComplianceAnalysisService {
    function renderMarkdown(summary: AnalysisSummary, flags: RiskFlag[]): string {
      const lines: string[] = [];
      lines.push("# Entity Audit Compliance Report");
      lines.push("");
      lines.push(`**Analysis ID:** ${summary.id}`);
      lines.push(`**Seed:** ${summary.seedAddress} (${summary.seedLabel ?? "unlabelled"})`);
      lines.push(`**Depth:** ${summary.depth}`);
      lines.push(`**Generated:** ${new Date().toISOString()}`);
      lines.push("");
      lines.push("## Risk flags");
      if (flags.length === 0) {
        lines.push("None.");
      } else {
        for (const f of flags) {
          lines.push(`- [${f.severity}] **${f.flag}** — ${f.detail}`);
        }
      }
      lines.push("");
      lines.push("## Disclaimer");
      lines.push(
        "Generated programmatically from XRPL on-chain data. Informational only; not financial or legal advice.",
      );
      return lines.join("\n");
    }

    function computeAuditHash(summary: AnalysisSummary, flags: RiskFlag[]): string {
      const canonical = JSON.stringify({
        id: summary.id,
        seedAddress: summary.seedAddress,
        depth: summary.depth,
        stats: summary.stats,
        flags: flags.map((f) => ({ flag: f.flag, severity: f.severity, detail: f.detail })),
      });
      return createHash("sha256").update(canonical).digest("hex");
    }

    return {
      async build(analysisId) {
        const summary = await deps.path.getAnalysis(analysisId);
        if (!summary) throw new Error("not_found");
        const flags = await deps.path.getAnalysisRiskFlags(analysisId);
        return {
          analysisId,
          markdown: renderMarkdown(summary, flags),
          auditHash: computeAuditHash(summary, flags),
          data: { summary, flags },
        };
      },
      async renderPdf(analysisId) {
        // For the PDF, delegate to the existing pdf-renderer.service via a compatible
        // ComplianceReportData shape. Defer wiring to the controller — pass `data`.
        throw new Error("renderPdf called directly; controller wires pdf-renderer");
      },
    };
  }
  ```

- [ ] **6C.4.** Re-run : green.

### Sub-phase 6.D — Controller (TDD)

- [ ] **6D.1.** Write the failing test `apps/agent/tests/unit/compliance-analysis.controller.test.ts`:

  ```ts
  import Fastify from "fastify";
  import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
  import { describe, expect, it, vi } from "vitest";
  import { registerComplianceAnalysisRoutes } from "../../src/controllers/compliance-analysis.controller.js";

  function makeApp(svc: any, identity: any) {
    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    // simulate forward_auth: inject x-user-id header on incoming requests via decoration if needed.
    registerComplianceAnalysisRoutes(app, svc, identity);
    return app;
  }

  describe("compliance-analysis.controller", () => {
    it("POST returns 200 + markdown + auditHash", async () => {
      const svc = {
        build: vi.fn(async () => ({ analysisId: "id", markdown: "# x", auditHash: "h", data: {} })),
      };
      const app = makeApp(svc, { isPremium: vi.fn(async () => true) });
      const res = await app.inject({
        method: "POST",
        url: "/api/compliance/analysis/00000000-0000-0000-0000-000000000001",
        headers: { "x-user-id": "u1" },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().markdown).toBe("# x");
    });

    it("PDF 402 when user is not premium", async () => {
      const svc = {
        build: vi.fn(async () => ({ analysisId: "id", markdown: "# x", auditHash: "h", data: {} })),
      };
      const app = makeApp(svc, { isPremium: vi.fn(async () => false) });
      const res = await app.inject({
        method: "GET",
        url: "/api/compliance/analysis/00000000-0000-0000-0000-000000000001/pdf",
        headers: { "x-user-id": "u1" },
      });
      expect(res.statusCode).toBe(402);
    });

    it("404 when analysis missing", async () => {
      const svc = {
        build: vi.fn(async () => {
          throw new Error("not_found");
        }),
      };
      const app = makeApp(svc, { isPremium: vi.fn(async () => true) });
      const res = await app.inject({
        method: "GET",
        url: "/api/compliance/analysis/00000000-0000-0000-0000-000000000099",
        headers: { "x-user-id": "u1" },
      });
      expect(res.statusCode).toBe(404);
    });
  });
  ```

- [ ] **6D.2.** Run : red.
- [ ] **6D.3.** Write `apps/agent/src/controllers/compliance-analysis.controller.ts`:

  ```ts
  import { agent as ag } from "@corlens/contracts";
  import type { FastifyInstance } from "fastify";
  import type { ZodTypeProvider } from "fastify-type-provider-zod";
  import { z } from "zod";
  import type { ComplianceAnalysisService } from "../services/compliance-analysis.service.js";
  import { createPdfRendererService } from "../services/pdf-renderer.service.js";

  const ErrorResp = z.object({ error: z.string() });

  export interface IdentityChecker {
    isPremium(userId: string): Promise<boolean>;
  }

  export async function registerComplianceAnalysisRoutes(
    app: FastifyInstance,
    svc: ComplianceAnalysisService,
    identity: IdentityChecker,
  ): Promise<void> {
    const typed = app.withTypeProvider<ZodTypeProvider>();
    const pdf = createPdfRendererService();

    async function run(id: string) {
      try {
        return await svc.build(id);
      } catch (e) {
        if ((e as Error).message === "not_found") return null;
        throw e;
      }
    }

    typed.post(
      "/api/compliance/analysis/:id",
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          body: ag.AnalysisComplianceRequest.optional(),
          response: { 200: ag.AnalysisComplianceResponse, 404: ErrorResp },
          tags: ["compliance"],
        },
      },
      async (req, reply) => {
        const result = await run(req.params.id);
        if (!result) {
          reply.status(404).send({ error: "not_found" });
          return reply;
        }
        return {
          analysisId: result.analysisId,
          markdown: result.markdown,
          auditHash: result.auditHash,
        };
      },
    );

    typed.get(
      "/api/compliance/analysis/:id",
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          response: { 200: ag.AnalysisComplianceResponse, 404: ErrorResp },
          tags: ["compliance"],
        },
      },
      async (req, reply) => {
        const result = await run(req.params.id);
        if (!result) {
          reply.status(404).send({ error: "not_found" });
          return reply;
        }
        return {
          analysisId: result.analysisId,
          markdown: result.markdown,
          auditHash: result.auditHash,
        };
      },
    );

    typed.get(
      "/api/compliance/analysis/:id/pdf",
      {
        schema: {
          params: z.object({ id: z.string().uuid() }),
          tags: ["compliance"],
        },
      },
      async (req, reply) => {
        const userId = req.headers["x-user-id"];
        if (typeof userId !== "string" || !(await identity.isPremium(userId))) {
          reply.status(402).send({ error: "premium_required" });
          return reply;
        }
        const result = await run(req.params.id);
        if (!result) {
          reply.status(404).send({ error: "not_found" });
          return reply;
        }
        const bytes = await pdf.renderEntity(result.data);
        reply
          .header("content-type", "application/pdf")
          .header(
            "content-disposition",
            `attachment; filename="compliance-analysis-${result.analysisId}.pdf"`,
          )
          .send(bytes);
        return reply;
      },
    );
  }
  ```

  *(If `pdf-renderer.service.ts` does not expose a `renderEntity(data)` method yet, add a thin wrapper in that file that maps `{ summary, flags }` to the existing `ComplianceReportData` shape. Keep the body of the new wrapper minimal — it's the only change to the renderer file. Cover it with a 5-line test in `pdf-renderer.service.test.ts` asserting `Buffer.byteLength > 0` for an entity payload.)*

- [ ] **6D.4.** Re-run : green.

### Sub-phase 6.E — Wire app + Caddyfile

- [ ] **6E.1.** Edit `apps/agent/src/app.ts` — instantiate the new service + controller (using the existing IdentityClient as the premium checker):
  ```ts
  import { createComplianceAnalysisService } from "./services/compliance-analysis.service.js";
  import { registerComplianceAnalysisRoutes } from "./controllers/compliance-analysis.controller.js";
  // …
  const complianceAnalysis = createComplianceAnalysisService({ path: pathConnector });
  await registerComplianceAnalysisRoutes(app, complianceAnalysis, {
    isPremium: (userId) => identityConnector.isPremium(userId),
  });
  ```

- [ ] **6E.2.** Edit `corlens_v2/Caddyfile`. Add **before** the existing `handle /api/compliance/*/pdf` and `handle /api/compliance/*` blocks:

  ```
  handle /api/compliance/analysis/*/pdf {
      import jwt_required
      reverse_proxy agent:3006
  }
  handle /api/compliance/analysis/* {
      import jwt_required
      reverse_proxy agent:3006
  }
  ```

  Reload Caddy : `docker compose restart caddy`.

- [ ] **6E.3.** Run all agent tests : `pnpm --filter @corlens/agent test`. Green.
- [ ] **6E.4.** `pnpm biome check .` clean. `pnpm -r typecheck` clean.
- [ ] **6E.5.** Commit:
  ```
  feat(v2,agent): entity-compliance endpoints (POST + GET md + GET pdf) on /api/compliance/analysis/:id
  ```

---

## Phase 7 — Chat retrieval (path service) (commit 7)

### Files

- Modify: `packages/contracts/src/path.ts`
- Modify: `apps/path/src/repositories/rag.repo.ts`
- Modify: `apps/path/src/controllers/chat.controller.ts`
- Create: `apps/path/tests/unit/chat-retrieval.controller.test.ts`

### Steps

- [ ] **7.1.** Edit `packages/contracts/src/path.ts`. After the existing `ChatResponse` definition, add:

  ```ts
  export const ChatMessageItem = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    sources: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  });
  export type ChatMessageItem = z.infer<typeof ChatMessageItem>;

  export const ChatHistoryResponse = z.object({
    chatId: z.string().uuid(),
    analysisId: z.string().uuid(),
    messages: z.array(ChatMessageItem),
  });
  export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponse>;
  ```

- [ ] **7.2.** Open `apps/path/src/repositories/rag.repo.ts`. Append:

  ```ts
  async findLatestChatByAnalysisId(analysisId: string) {
    const chat = await prisma.path.ragChat.findFirst({
      where: { analysisId },
      orderBy: { createdAt: "desc" },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    return chat ?? null;
  },
  ```

  *(Verify the namespacing — `prisma.path.ragChat` vs `prisma.ragChat`. Mirror what the existing methods in this file do.)*

- [ ] **7.3.** Write the failing test `apps/path/tests/unit/chat-retrieval.controller.test.ts`:

  ```ts
  import Fastify from "fastify";
  import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
  import { describe, expect, it, vi } from "vitest";
  import { registerChatRoutes } from "../../src/controllers/chat.controller.js";

  function makeApp(chat: any) {
    const app = Fastify().withTypeProvider<ZodTypeProvider>();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    registerChatRoutes(app, chat);
    return app;
  }

  describe("path chat-retrieval", () => {
    it("GET /api/analysis/:id/chat returns chat history in createdAt asc", async () => {
      const chat = {
        ask: vi.fn(),
        getLatestForAnalysis: vi.fn(async () => ({
          chatId: "00000000-0000-0000-0000-000000000010",
          analysisId: "00000000-0000-0000-0000-000000000001",
          messages: [
            { role: "user", content: "hi", sources: null, createdAt: "2026-05-11T00:00:00.000Z" },
            { role: "assistant", content: "hello", sources: null, createdAt: "2026-05-11T00:00:01.000Z" },
          ],
        })),
      };
      const app = makeApp(chat);
      const res = await app.inject({
        method: "GET",
        url: "/api/analysis/00000000-0000-0000-0000-000000000001/chat",
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.messages).toHaveLength(2);
      expect(body.messages[0].role).toBe("user");
      await app.close();
    });

    it("404 when no chat exists", async () => {
      const chat = {
        ask: vi.fn(),
        getLatestForAnalysis: vi.fn(async () => null),
      };
      const app = makeApp(chat);
      const res = await app.inject({
        method: "GET",
        url: "/api/analysis/00000000-0000-0000-0000-000000000099/chat",
      });
      expect(res.statusCode).toBe(404);
      await app.close();
    });
  });
  ```

- [ ] **7.4.** Run : red.
- [ ] **7.5.** Edit `apps/path/src/controllers/chat.controller.ts`. Add (after the existing POST route):

  ```ts
  typed.get(
    "/api/analysis/:id/chat",
    {
      schema: {
        params: z.object({ id: z.string().uuid() }),
        response: { 200: pp.ChatHistoryResponse, 404: z.object({ error: z.string() }) },
        tags: ["analysis"],
      },
    },
    async (req, reply) => {
      const result = await chat.getLatestForAnalysis(req.params.id);
      if (!result) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return result;
    },
  );
  ```

- [ ] **7.6.** Edit `apps/path/src/services/chat.service.ts`. Add `getLatestForAnalysis(analysisId)` that delegates to `ragRepo.findLatestChatByAnalysisId(analysisId)` and shapes the response to `ChatHistoryResponse`. Return `null` if no chat.
- [ ] **7.7.** Re-run : green.
- [ ] **7.8.** Run all path tests. Green. Biome + typecheck clean.
- [ ] **7.9.** Commit:
  ```
  feat(v2,path): GET /api/analysis/:id/chat retrieval
  ```

---

## Phase 8 — Chat retrieval (corridor service) (commit 8)

### Files

- Modify: `packages/contracts/src/corridor.ts`
- Modify: `apps/corridor/src/repositories/rag.repo.ts`
- Modify: `apps/corridor/src/services/chat.service.ts`
- Modify: `apps/corridor/src/controllers/chat.controller.ts`
- Create: `apps/corridor/tests/unit/chat-retrieval.controller.test.ts`

### Steps

- [ ] **8.1.** Edit `packages/contracts/src/corridor.ts`. Add (mirror Phase 7's contract for path, swap `analysisId` for `corridorId: nullable`):

  ```ts
  export const ChatMessageItem = z.object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
    sources: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  });
  export type ChatMessageItem = z.infer<typeof ChatMessageItem>;

  export const ChatHistoryResponse = z.object({
    chatId: z.string().uuid(),
    corridorId: z.string().nullable(),
    messages: z.array(ChatMessageItem),
  });
  export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponse>;
  ```

- [ ] **8.2.** Append to `apps/corridor/src/repositories/rag.repo.ts`:

  ```ts
  async findChatById(chatId: string) {
    return prisma.corridor.corridorRagChat.findUnique({
      where: { id: chatId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
  },
  ```

- [ ] **8.3.** Write the failing test `apps/corridor/tests/unit/chat-retrieval.controller.test.ts` mirroring Phase 7 — route `GET /api/corridors/chat/:chatId`.

- [ ] **8.4.** Edit `apps/corridor/src/services/chat.service.ts` — add `getById(chatId)` returning `ChatHistoryResponse | null`.
- [ ] **8.5.** Edit `apps/corridor/src/controllers/chat.controller.ts`. Add after the existing POST:

  ```ts
  typed.get(
    "/api/corridors/chat/:chatId",
    {
      schema: {
        params: z.object({ chatId: z.string().uuid() }),
        response: { 200: cc.ChatHistoryResponse, 404: z.object({ error: z.string() }) },
        tags: ["corridor"],
      },
    },
    async (req, reply) => {
      const r = await chat.getById(req.params.chatId);
      if (!r) {
        reply.status(404).send({ error: "not_found" });
        return reply;
      }
      return r;
    },
  );
  ```

- [ ] **8.6.** Re-run : green.
- [ ] **8.7.** All corridor tests green. Biome + typecheck clean.
- [ ] **8.8.** Commit:
  ```
  feat(v2,corridor): GET /api/corridors/chat/:chatId retrieval
  ```

---

## Phase 9 — MCP `get_partner_depth` tool (commit 9)

### Files

- Modify: `apps/mcp-server/src/index.ts`
- Create: `apps/mcp-server/tests/unit/get-partner-depth.test.ts`

### Steps

- [ ] **9.1.** Write the failing test `apps/mcp-server/tests/unit/get-partner-depth.test.ts`. The current MCP `index.ts` is not factored for direct invocation; isolate the tool body by extracting a `runGetPartnerDepth(base, quote, fetchImpl)` helper in `index.ts` and import it from the test.

  ```ts
  import { describe, expect, it, vi } from "vitest";
  import { runGetPartnerDepth } from "../../src/index.js";

  describe("get_partner_depth tool", () => {
    it("returns formatted venues list", async () => {
      const fakeFetch = vi.fn(async () =>
        new Response(
          JSON.stringify({
            venues: [
              { venue: "Bitso", depthAsk: "1000", depthBid: "1200", spreadBps: 8, asOf: "2026-05-11T00:00:00Z" },
            ],
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;
      const result = await runGetPartnerDepth("XRP", "MXN", { fetchImpl: fakeFetch, baseUrl: "http://api" });
      expect(result.content[0].text).toContain("Bitso");
      expect(result.content[0].text).toContain("8");
    });
  });
  ```

- [ ] **9.2.** Run : red.
- [ ] **9.3.** Edit `apps/mcp-server/src/index.ts`:
  - Extract a `runGetPartnerDepth(base, quote, deps?)` helper above `server.tool(...)` calls — `deps.baseUrl` defaults to `API_BASE`, `deps.fetchImpl` defaults to global `fetch`. Export it (`export async function runGetPartnerDepth(...)`).
  - Add the tool registration alongside the other six:

    ```ts
    server.tool(
      "get_partner_depth",
      "Live orderbook depth at off-chain partner venues (e.g. Bitso XRP/MXN). Returns ask/bid depth and spread in bps.",
      {
        base: z.string().min(2).max(8).describe('Base currency, e.g. "XRP"'),
        quote: z.string().min(2).max(8).describe('Quote currency, e.g. "MXN"'),
      },
      async ({ base, quote }) => runGetPartnerDepth(base, quote),
    );
    ```

  - Body of `runGetPartnerDepth`:

    ```ts
    export async function runGetPartnerDepth(
      base: string,
      quote: string,
      deps: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
    ) {
      const baseUrl = deps.baseUrl ?? API_BASE;
      const fetcher = deps.fetchImpl ?? fetch;
      const res = await fetcher(`${baseUrl}/corridors/partner-depth/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`);
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CorLens API ${res.status}: ${text}`);
      }
      const body = (await res.json()) as { venues?: Array<{ venue: string; depthAsk: string; depthBid: string; spreadBps: number; asOf: string }> };
      const venues = body.venues ?? [];
      if (venues.length === 0) {
        return { content: [{ type: "text" as const, text: `No partner-depth data for ${base}/${quote}.` }] };
      }
      const lines = venues.map(
        (v) => `${v.venue}: ask=${v.depthAsk}, bid=${v.depthBid}, spread=${v.spreadBps}bps @ ${v.asOf}`,
      );
      return {
        content: [{ type: "text" as const, text: `Partner depth ${base}/${quote}:\n\n${lines.join("\n")}` }],
      };
    }
    ```

    *(The URL path mirrors the existing corridor partner-depth controller: `/api/corridors/partner-depth/:actor/:book`. Confirm the actual call shape — if v2 uses different param names, mirror them.)*

- [ ] **9.4.** Re-run : green.
- [ ] **9.5.** Manual smoke (optional, requires gateway up): run the MCP server in a Claude Desktop config + ask "what's partner depth XRP/MXN?". Response should list Bitso.
- [ ] **9.6.** `pnpm biome check .` clean. `pnpm -r typecheck` clean.
- [ ] **9.7.** Commit:
  ```
  feat(v2,mcp): get_partner_depth tool (7th MCP tool)
  ```

---

## Final — Mark milestones

- [ ] **F.1.** Edit `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`. Locate §12 (build order). Tick the bullet(s) corresponding to "currency catalog", "risk-engine endpoint", "entity-compliance endpoints", "chat retrieval", and "MCP get_partner_depth" — exact bullet text depends on the spec's current state.
- [ ] **F.2.** Edit `corlens_v2/docs/superpowers/plans/2026-05-09-completion-roadmap.md` if any Phase A–E bullet was actually unblocked or completed by this work (likely none — but verify).
- [ ] **F.3.** Optional doc commit:
  ```
  docs(v2): mark backend gap-fill milestones (sub-spec 2026-05-11)
  ```

---

## Self-review

| Spec requirement | Plan coverage |
|---|---|
| WI-1 full currency catalog | Phases 1–3 |
| WI-2 risk-engine endpoint + agent producers | Phases 4–5 |
| WI-3 5 endpoints | Phases 6 (3 compliance) + 7 (path chat) + 8 (corridor chat) |
| WI-4 MCP get_partner_depth | Phase 9 |
| TDD per commit | Each phase: failing test first, run red, implement, run green |
| Biome + typecheck per commit | Last bullet of each phase |
| HMAC on internal routes | Phase 4 (`internal: true` config + verify in test) |
| Caddyfile new rules | Phase 6E.2 |
| `account-crawled` dedup | Phase 5: `ctx.state.crawledAddresses: Set<string>` |
| Spec milestone marks | Final F.1 |

**Open assumptions to confirm during implementation (each may shift a step but not the structure):**

1. Prisma multiSchema namespacing — `prisma.corridor.currencyMeta` vs `prisma.currencyMeta`. Resolve in Phase 2C.3.
2. The HMAC verify plugin file path + route-marking convention (`config: { internal: true }` vs schema-level tag). Resolve in Phase 4C.3.
3. Whether `GET /api/analysis/:id` surfaces `riskFlags`. Resolve in Phase 6B.1 (add to the response if missing).
4. Existing PDF renderer's input shape vs what entity compliance needs. Resolve in Phase 6D.3 (`renderEntity` wrapper).
5. v2 partner-depth route path (`/api/corridors/partner-depth/:actor/:book` vs `/:base/:quote`). Resolve in Phase 9.3.

Each of these is a 2-minute file read at the time it matters — not a blocker for plan structure.

---

*End of plan.*
