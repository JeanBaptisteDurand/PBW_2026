# CORLens v2 — Foundation (Shared Packages + Workspace) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared foundation that every CORLens v2 service depends on: pnpm workspace, tooling (Biome, Vitest, TypeScript), Docker dev infra (Postgres 16 + pgvector + Redis 7), and four shared packages — `@corlens/env`, `@corlens/contracts`, `@corlens/db`, `@corlens/events`, `@corlens/clients`.

**Architecture:** Single pnpm monorepo at `corlens_v2/`. One Postgres instance with `multiSchema` Prisma split into six schemas (`identity`, `corridor`, `path`, `agent`, `ai`, `market_data`). Cross-schema references use ID strings only — no Prisma `@relation` across schemas. Per-service scoped DB facades expose only the models that service owns. Events package ships a noop `InMemoryEventBus` plus an `HttpFanoutEventBus` for cross-process delivery; the same interface will accept a Redis Streams adapter later. Clients package provides an HMAC-signed HTTP base for service-to-service calls.

**Tech Stack:** Node 20 LTS, pnpm 9.15, TypeScript 5.7 (strict + `noUncheckedIndexedAccess`), Zod 3.23, Prisma 6.1 (`multiSchema` preview), Biome 1.9, Vitest 2.1, Postgres 16 + pgvector, Redis 7.

**Spec:** [`/Users/beorlor/Documents/PBW_2026/corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`](../specs/2026-05-08-corlens-v2-architecture-design.md)

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/` (this directory exists; the spec already lives inside it).

---

## Layout produced by this plan

```
corlens_v2/
├── .gitignore
├── .nvmrc
├── README.md
├── biome.json
├── docker-compose.yml
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.workspace.ts
├── docs/                              (already exists with spec + this plan)
└── packages/
    ├── env/                           Zod-validated env config builder
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   └── index.ts
    │   └── tests/
    │       └── index.test.ts
    ├── contracts/                     Cross-service Zod schemas
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts
    │       ├── shared.ts              UUID, Address, Currency, RiskTolerance, Pagination
    │       ├── identity.ts            JwtPayload, LoginChallenge, payment shapes
    │       ├── events.ts              Event names + payload schemas
    │       ├── corridor.ts            placeholder (filled in step 6)
    │       ├── path.ts                placeholder (filled in step 7)
    │       ├── agent.ts               placeholder (filled in step 8)
    │       ├── market-data.ts         placeholder (filled in step 4)
    │       └── ai.ts                  placeholder (filled in step 5)
    ├── db/                            Single Prisma schema, six Postgres schemas
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── prisma/
    │   │   └── schema.prisma
    │   └── src/
    │       ├── index.ts               makePrisma() + per-service facades
    │       ├── identity.ts            facade exposing identity-owned models
    │       ├── corridor.ts            facade exposing corridor-owned models
    │       ├── path.ts                facade exposing path-owned models
    │       ├── agent.ts               facade exposing agent-owned models
    │       ├── ai.ts                  facade exposing ai-owned models
    │       └── market-data.ts         facade exposing market-data-owned models
    ├── events/                        Domain event bus (HTTP today, Redis Streams later)
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── src/
    │   │   ├── index.ts               EventBus interface + factory
    │   │   ├── in-memory.ts           InMemoryEventBus
    │   │   └── http-fanout.ts         HttpFanoutEventBus
    │   └── tests/
    │       ├── in-memory.test.ts
    │       └── http-fanout.test.ts
    └── clients/                       HMAC-signed HTTP base for service-to-service calls
        ├── package.json
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts
        │   ├── http.ts
        │   └── hmac.ts
        └── tests/
            └── hmac.test.ts
```

---

## Conventions every task MUST follow

- **Indent:** 2 spaces. Match v1's existing style.
- **Module type:** ESM (`"type": "module"`).
- **Exports:** named only — no default exports.
- **Interfaces vs types:** `interface` is reserved for ports (multi-implementation seams: `EventBus`, future `LLMProvider`, future `WalletVerifier`). All other shapes use `z.infer<typeof Schema>` or plain `type`.
- **Imports:** local files use `.js` extensions in import specifiers (ESM + TypeScript convention).
- **Commits:** at the end of every task, exactly one commit. Conventional Commits format. **Never run `git commit --no-verify`.** **Never run `git add -A`** — list files explicitly.
- **Comments:** none unless the WHY is non-obvious. Don't restate WHAT the code does.

---

## Phase A — Workspace skeleton

### Task A1: Root workspace files

**Files:**
- Create: `corlens_v2/package.json`
- Create: `corlens_v2/pnpm-workspace.yaml`
- Create: `corlens_v2/.nvmrc`
- Create: `corlens_v2/.gitignore`
- Create: `corlens_v2/README.md`

- [ ] **Step 1: Write `corlens_v2/package.json`**

```json
{
  "name": "corlens-v2",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write .",
    "typecheck": "pnpm -r run typecheck",
    "test": "vitest run",
    "test:watch": "vitest",
    "build": "pnpm -r run build",
    "dev:db": "docker compose up -d postgres redis",
    "dev:db:down": "docker compose down",
    "dev:db:reset": "docker compose down -v && docker compose up -d postgres redis"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.15.0"
  },
  "packageManager": "pnpm@9.15.0",
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/pnpm-workspace.yaml`**

```yaml
packages:
  - "packages/*"
  - "apps/*"
```

- [ ] **Step 3: Write `corlens_v2/.nvmrc`**

```
20
```

- [ ] **Step 4: Write `corlens_v2/.gitignore`**

```
node_modules/
dist/
.env
.env.local
**/.env
**/.env.local
*.log
.DS_Store
.vite/
.cache/
.turbo/
.superpowers/
coverage/
```

- [ ] **Step 5: Write `corlens_v2/README.md`**

```markdown
# CORLens v2

Greenfield rebuild of CORLens as a coupled-but-separable set of services behind a Caddy gateway.

See [docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md](docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md) for the design.

## Quick start

```bash
nvm use
pnpm install
pnpm dev:db        # Postgres 16 + Redis 7 in docker
pnpm typecheck
pnpm test
```

## Layout

- `packages/` — shared libraries (contracts, db, events, clients, env)
- `apps/` — services (added incrementally per the spec build order)
- `docs/superpowers/` — specs and implementation plans
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install`
Expected: success, `node_modules/` created, no lockfile errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/package.json corlens_v2/pnpm-workspace.yaml corlens_v2/.nvmrc corlens_v2/.gitignore corlens_v2/README.md corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): bootstrap pnpm workspace"
```

---

### Task A2: Shared TypeScript config

**Files:**
- Create: `corlens_v2/tsconfig.base.json`

- [ ] **Step 1: Write `corlens_v2/tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "useUnknownInCatchVariables": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add corlens_v2/tsconfig.base.json
git commit -m "feat(v2): shared tsconfig base with strict + noUncheckedIndexedAccess"
```

---

### Task A3: Biome config

**Files:**
- Create: `corlens_v2/biome.json`

- [ ] **Step 1: Write `corlens_v2/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": {
    "enabled": true,
    "clientKind": "git",
    "useIgnoreFile": true
  },
  "files": {
    "ignoreUnknown": true,
    "ignore": [
      "**/dist",
      "**/node_modules",
      "**/.turbo",
      "**/coverage",
      "**/prisma/migrations",
      "**/*.generated.ts"
    ]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "style": {
        "noNonNullAssertion": "warn",
        "useImportType": "error"
      },
      "suspicious": {
        "noExplicitAny": "warn"
      },
      "correctness": {
        "noUnusedImports": "error"
      }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all",
      "arrowParentheses": "always"
    }
  }
}
```

- [ ] **Step 2: Verify Biome runs**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm lint`
Expected: success — no files to lint yet, exits 0.

- [ ] **Step 3: Commit**

```bash
git add corlens_v2/biome.json
git commit -m "feat(v2): biome lint+format config"
```

---

### Task A4: Vitest workspace config

**Files:**
- Create: `corlens_v2/vitest.workspace.ts`

- [ ] **Step 1: Write `corlens_v2/vitest.workspace.ts`**

```ts
import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "apps/*/vitest.config.ts",
]);
```

- [ ] **Step 2: Verify**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm test`
Expected: vitest reports "No test files found" (no packages exist yet) — exits 0.

- [ ] **Step 3: Commit**

```bash
git add corlens_v2/vitest.workspace.ts
git commit -m "feat(v2): vitest workspace config"
```

---

## Phase B — Docker dev infrastructure

### Task B1: Postgres + Redis docker-compose

**Files:**
- Create: `corlens_v2/docker-compose.yml`
- Create: `corlens_v2/docker/init-pgvector.sql`

- [ ] **Step 1: Write `corlens_v2/docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: corlens-v2-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: corlens
      POSTGRES_PASSWORD: corlens_dev
      POSTGRES_DB: corlens
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/init-pgvector.sql:/docker-entrypoint-initdb.d/01-init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U corlens"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: corlens-v2-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Write `corlens_v2/docker/init-pgvector.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

- [ ] **Step 3: Bring up the stack**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm dev:db`
Expected: both containers start, `docker ps` shows them healthy after ~10s.

- [ ] **Step 4: Verify Postgres connection**

Run: `docker exec corlens-v2-postgres psql -U corlens -d corlens -c "SELECT extname FROM pg_extension WHERE extname = 'vector';"`
Expected: one row returned with `extname = vector`.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/docker-compose.yml corlens_v2/docker/init-pgvector.sql
git commit -m "feat(v2): docker-compose with postgres+pgvector and redis"
```

---

## Phase C — `@corlens/env` package

### Task C1: env package scaffold

**Files:**
- Create: `corlens_v2/packages/env/package.json`
- Create: `corlens_v2/packages/env/tsconfig.json`
- Create: `corlens_v2/packages/env/vitest.config.ts`
- Create: `corlens_v2/packages/env/src/index.ts` (placeholder)

- [ ] **Step 1: Write `corlens_v2/packages/env/package.json`**

```json
{
  "name": "@corlens/env",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/packages/env/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `corlens_v2/packages/env/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/env",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write placeholder `corlens_v2/packages/env/src/index.ts`**

```ts
export {};
```

- [ ] **Step 5: Install at root**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install`
Expected: success, `packages/env/node_modules` populated.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/packages/env/
git add corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): scaffold @corlens/env package"
```

---

### Task C2: TDD env validator

**Files:**
- Create: `corlens_v2/packages/env/tests/index.test.ts`
- Modify: `corlens_v2/packages/env/src/index.ts`

- [ ] **Step 1: Write the failing test `corlens_v2/packages/env/tests/index.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadEnv } from "../src/index.js";

describe("loadEnv", () => {
  it("returns parsed values when input matches the schema", () => {
    const schema = z.object({
      PORT: z.coerce.number().int().positive(),
      NAME: z.string(),
    });
    const env = loadEnv(schema, { PORT: "3001", NAME: "identity" });
    expect(env.PORT).toBe(3001);
    expect(env.NAME).toBe("identity");
  });

  it("throws a readable error listing every missing field", () => {
    const schema = z.object({
      PORT: z.coerce.number(),
      DATABASE_URL: z.string().url(),
    });
    expect(() => loadEnv(schema, {})).toThrow(/PORT/);
    expect(() => loadEnv(schema, {})).toThrow(/DATABASE_URL/);
  });

  it("defaults source to process.env when no source is given", () => {
    const schema = z.object({ HOME: z.string().min(1) });
    const env = loadEnv(schema);
    expect(typeof env.HOME).toBe("string");
  });
});
```

- [ ] **Step 2: Run the test (fails)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/env exec vitest run`
Expected: FAIL — `loadEnv` does not exist.

- [ ] **Step 3: Implement `corlens_v2/packages/env/src/index.ts`**

```ts
import type { ZodTypeAny, z } from "zod";

export function loadEnv<T extends ZodTypeAny>(
  schema: T,
  source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
```

- [ ] **Step 4: Run the test (passes)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/env exec vitest run`
Expected: PASS — 3 tests green.

- [ ] **Step 5: Typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/env run typecheck`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/packages/env/src/index.ts corlens_v2/packages/env/tests/index.test.ts
git commit -m "feat(v2): @corlens/env loadEnv with zod-validated config"
```

---

## Phase D — `@corlens/contracts` package

### Task D1: contracts package scaffold

**Files:**
- Create: `corlens_v2/packages/contracts/package.json`
- Create: `corlens_v2/packages/contracts/tsconfig.json`
- Create: `corlens_v2/packages/contracts/src/index.ts` (placeholder)

- [ ] **Step 1: Write `corlens_v2/packages/contracts/package.json`**

```json
{
  "name": "@corlens/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.7.2"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/packages/contracts/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write placeholder `corlens_v2/packages/contracts/src/index.ts`**

```ts
export {};
```

- [ ] **Step 4: Install + typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install && pnpm --filter @corlens/contracts run typecheck`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/packages/contracts/ corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): scaffold @corlens/contracts package"
```

---

### Task D2: Shared primitives

**Files:**
- Create: `corlens_v2/packages/contracts/src/shared.ts`
- Modify: `corlens_v2/packages/contracts/src/index.ts`

- [ ] **Step 1: Write `corlens_v2/packages/contracts/src/shared.ts`**

```ts
import { z } from "zod";

export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const XrplAddress = z
  .string()
  .regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, "Invalid XRPL r-address");
export type XrplAddress = z.infer<typeof XrplAddress>;

export const TxHash = z.string().regex(/^[A-F0-9]{64}$/, "Invalid XRPL tx hash");
export type TxHash = z.infer<typeof TxHash>;

export const Currency = z.string().min(3).max(20);
export type Currency = z.infer<typeof Currency>;

export const RiskTolerance = z.enum(["LOW", "MED", "HIGH"]);
export type RiskTolerance = z.infer<typeof RiskTolerance>;

export const Verdict = z.enum(["SAFE", "REJECTED", "NO_PATHS", "OFF_CHAIN_ROUTED"]);
export type Verdict = z.infer<typeof Verdict>;

export const Status = z.enum(["GREEN", "AMBER", "RED", "UNKNOWN"]);
export type Status = z.infer<typeof Status>;

export const PaymentCurrency = z.enum(["XRP", "RLUSD"]);
export type PaymentCurrency = z.infer<typeof PaymentCurrency>;

export const UserRole = z.enum(["free", "premium"]);
export type UserRole = z.infer<typeof UserRole>;

export const Pagination = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type Pagination = z.infer<typeof Pagination>;

export const ErrorResponse = z.object({
  error: z.string(),
  details: z.unknown().optional(),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
```

- [ ] **Step 2: Update `corlens_v2/packages/contracts/src/index.ts`**

```ts
export * from "./shared.js";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add corlens_v2/packages/contracts/src/
git commit -m "feat(v2): shared primitives in @corlens/contracts (UUID, XrplAddress, RiskTolerance, etc.)"
```

---

### Task D3: Identity contracts (JWT, login challenge, payment)

**Files:**
- Create: `corlens_v2/packages/contracts/src/identity.ts`
- Modify: `corlens_v2/packages/contracts/src/index.ts`

- [ ] **Step 1: Write `corlens_v2/packages/contracts/src/identity.ts`**

```ts
import { z } from "zod";
import { PaymentCurrency, TxHash, UserRole, Uuid, XrplAddress } from "./shared.js";

export const JwtPayload = z.object({
  userId: Uuid,
  walletAddress: XrplAddress,
  role: UserRole,
});
export type JwtPayload = z.infer<typeof JwtPayload>;

export const LoginChallengeRequest = z.object({
  walletAddress: XrplAddress,
});
export type LoginChallengeRequest = z.infer<typeof LoginChallengeRequest>;

export const LoginChallengeResponse = z.object({
  challenge: z.string().min(32),
  expiresAt: z.string().datetime(),
});
export type LoginChallengeResponse = z.infer<typeof LoginChallengeResponse>;

export const LoginVerifyRequest = z.object({
  walletAddress: XrplAddress,
  challenge: z.string().min(32),
  signature: z.string().min(1),
  publicKey: z.string().min(1),
});
export type LoginVerifyRequest = z.infer<typeof LoginVerifyRequest>;

export const LoginVerifyResponse = z.object({
  token: z.string().min(1),
  user: z.object({
    id: Uuid,
    walletAddress: XrplAddress,
    role: UserRole,
  }),
});
export type LoginVerifyResponse = z.infer<typeof LoginVerifyResponse>;

export const PaymentInfoResponse = z.object({
  options: z.array(
    z.object({
      currency: PaymentCurrency,
      amount: z.string(),
      label: z.string(),
    }),
  ),
  demoWalletAddress: z.string(),
});
export type PaymentInfoResponse = z.infer<typeof PaymentInfoResponse>;

export const CreatePaymentRequest = z.object({
  currency: PaymentCurrency.default("XRP"),
});
export type CreatePaymentRequest = z.infer<typeof CreatePaymentRequest>;

export const CreatePaymentResponse = z.object({
  paymentId: Uuid,
  destination: z.string(),
  amount: z.string(),
  currency: PaymentCurrency,
  memo: z.string(),
});
export type CreatePaymentResponse = z.infer<typeof CreatePaymentResponse>;

export const PaymentStatusResponse = z.discriminatedUnion("status", [
  z.object({ status: z.literal("pending") }),
  z.object({ status: z.literal("confirmed"), txHash: TxHash }),
  z.object({ status: z.literal("expired") }),
  z.object({ status: z.literal("not_found") }),
]);
export type PaymentStatusResponse = z.infer<typeof PaymentStatusResponse>;
```

- [ ] **Step 2: Update `corlens_v2/packages/contracts/src/index.ts`**

```ts
export * from "./shared.js";
export * as identity from "./identity.js";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add corlens_v2/packages/contracts/src/
git commit -m "feat(v2): identity contracts (JWT, SIWE-style login challenge, payment)"
```

---

### Task D4: Event payloads

**Files:**
- Create: `corlens_v2/packages/contracts/src/events.ts`
- Modify: `corlens_v2/packages/contracts/src/index.ts`

- [ ] **Step 1: Write `corlens_v2/packages/contracts/src/events.ts`**

```ts
import { z } from "zod";
import { PaymentCurrency, Status, TxHash, Uuid, XrplAddress } from "./shared.js";

export const PaymentConfirmed = z.object({
  userId: Uuid,
  paymentId: Uuid,
  txHash: TxHash,
  amount: z.string(),
  currency: PaymentCurrency,
  confirmedAt: z.string().datetime(),
});
export type PaymentConfirmed = z.infer<typeof PaymentConfirmed>;

export const UserRoleUpgraded = z.object({
  userId: Uuid,
  newRole: z.literal("premium"),
  upgradedAt: z.string().datetime(),
});
export type UserRoleUpgraded = z.infer<typeof UserRoleUpgraded>;

export const CorridorRefreshed = z.object({
  corridorId: z.string(),
  status: Status,
  refreshedAt: z.string().datetime(),
});
export type CorridorRefreshed = z.infer<typeof CorridorRefreshed>;

export const AnalysisCompleted = z.object({
  analysisId: Uuid,
  seedAddress: XrplAddress,
  completedAt: z.string().datetime(),
  riskFlagCount: z.number().int().min(0),
});
export type AnalysisCompleted = z.infer<typeof AnalysisCompleted>;

export const EventRegistry = {
  "payment.confirmed": PaymentConfirmed,
  "user.role_upgraded": UserRoleUpgraded,
  "corridor.refreshed": CorridorRefreshed,
  "analysis.completed": AnalysisCompleted,
} as const;

export type EventName = keyof typeof EventRegistry;
export type EventPayload<E extends EventName> = z.infer<(typeof EventRegistry)[E]>;
```

- [ ] **Step 2: Update `corlens_v2/packages/contracts/src/index.ts`**

```ts
export * from "./shared.js";
export * as identity from "./identity.js";
export * as events from "./events.js";
```

- [ ] **Step 3: Typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add corlens_v2/packages/contracts/src/
git commit -m "feat(v2): event payload schemas + EventRegistry"
```

---

### Task D5: Per-service stub files

**Files:**
- Create: `corlens_v2/packages/contracts/src/corridor.ts`
- Create: `corlens_v2/packages/contracts/src/path.ts`
- Create: `corlens_v2/packages/contracts/src/agent.ts`
- Create: `corlens_v2/packages/contracts/src/market-data.ts`
- Create: `corlens_v2/packages/contracts/src/ai.ts`
- Modify: `corlens_v2/packages/contracts/src/index.ts`

These are intentionally minimal — each service will populate its own contract file when the service is built (build steps 4-8 in the spec).

- [ ] **Step 1: Write `corlens_v2/packages/contracts/src/corridor.ts`**

```ts
export {};
```

- [ ] **Step 2: Write `corlens_v2/packages/contracts/src/path.ts`**

```ts
export {};
```

- [ ] **Step 3: Write `corlens_v2/packages/contracts/src/agent.ts`**

```ts
export {};
```

- [ ] **Step 4: Write `corlens_v2/packages/contracts/src/market-data.ts`**

```ts
export {};
```

- [ ] **Step 5: Write `corlens_v2/packages/contracts/src/ai.ts`**

```ts
export {};
```

- [ ] **Step 6: Update `corlens_v2/packages/contracts/src/index.ts`**

```ts
export * from "./shared.js";
export * as identity from "./identity.js";
export * as events from "./events.js";
export * as corridor from "./corridor.js";
export * as path from "./path.js";
export * as agent from "./agent.js";
export * as marketData from "./market-data.js";
export * as ai from "./ai.js";
```

- [ ] **Step 7: Typecheck + build**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/contracts run typecheck && pnpm --filter @corlens/contracts run build`
Expected: both succeed; `packages/contracts/dist/` populated.

- [ ] **Step 8: Commit**

```bash
git add corlens_v2/packages/contracts/src/
git commit -m "feat(v2): per-service contract stubs (filled in service build steps)"
```

---

## Phase E — `@corlens/db` package

### Task E1: db package scaffold

**Files:**
- Create: `corlens_v2/packages/db/package.json`
- Create: `corlens_v2/packages/db/tsconfig.json`
- Create: `corlens_v2/packages/db/.gitignore`

- [ ] **Step 1: Write `corlens_v2/packages/db/package.json`**

```json
{
  "name": "@corlens/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    },
    "./identity": {
      "types": "./src/identity.ts",
      "default": "./dist/identity.js"
    },
    "./corridor": {
      "types": "./src/corridor.ts",
      "default": "./dist/corridor.js"
    },
    "./path": {
      "types": "./src/path.ts",
      "default": "./dist/path.js"
    },
    "./agent": {
      "types": "./src/agent.ts",
      "default": "./dist/agent.js"
    },
    "./ai": {
      "types": "./src/ai.ts",
      "default": "./dist/ai.js"
    },
    "./market-data": {
      "types": "./src/market-data.ts",
      "default": "./dist/market-data.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch",
    "prisma:generate": "prisma generate --schema=prisma/schema.prisma",
    "prisma:push": "prisma db push --schema=prisma/schema.prisma",
    "prisma:migrate": "prisma migrate dev --schema=prisma/schema.prisma",
    "prisma:studio": "prisma studio --schema=prisma/schema.prisma"
  },
  "dependencies": {
    "@prisma/client": "6.1.0"
  },
  "devDependencies": {
    "prisma": "6.1.0",
    "typescript": "5.7.2"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/packages/db/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `corlens_v2/packages/db/.gitignore`**

```
prisma/migrations/
```

> Note: migrations are committed once we settle on the v1 → v2 migration path. For step 1 we use `prisma db push` against an empty dev DB; we'll start a migration history once the schema is finalized after services are built.

- [ ] **Step 4: Install**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/packages/db/package.json corlens_v2/packages/db/tsconfig.json corlens_v2/packages/db/.gitignore corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): scaffold @corlens/db package"
```

---

### Task E2: Prisma schema with multiSchema, six Postgres schemas

**Files:**
- Create: `corlens_v2/packages/db/prisma/schema.prisma`

This ports every v1 model into the appropriate Postgres schema. Cross-schema relations (`User <-> Analysis`, `User <-> SafePathRun`) are dropped — replaced with plain `userId` strings, no `@relation`. This enforces the "no cross-schema joins" rule from the spec at the schema level.

- [ ] **Step 1: Write `corlens_v2/packages/db/prisma/schema.prisma`**

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema", "postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  schemas    = ["identity", "corridor", "path", "agent", "ai", "market_data"]
  extensions = [pgvector(map: "vector")]
}

// ─── identity ────────────────────────────────────────────────
model User {
  id            String   @id @default(uuid())
  walletAddress String   @unique
  role          String   @default("free")
  apiKey        String?  @unique
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  subscriptions PremiumSubscription[]
  paymentRequests PaymentRequest[]

  @@schema("identity")
}

model PremiumSubscription {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  txHash        String   @unique
  amount        String
  currency      String
  walletAddress String
  memo          String   @unique
  paidAt        DateTime @default(now())

  @@index([userId])
  @@index([walletAddress])
  @@schema("identity")
}

model PaymentRequest {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  amount      String
  currency    String
  destination String
  memo        String   @unique
  status      String   @default("pending")
  txHash      String?
  createdAt   DateTime @default(now())
  expiresAt   DateTime

  @@index([memo])
  @@index([status])
  @@schema("identity")
}

// ─── corridor ────────────────────────────────────────────────
model Corridor {
  id              String    @id
  label           String
  shortLabel      String
  flag            String
  tier            Int
  importance      Int
  region          String
  category        String
  description     String
  useCase         String
  highlights      Json
  relatedIds      Json?
  amount          String?
  sourceJson      Json?
  destJson        Json?
  requestJson     Json?
  status          String    @default("UNKNOWN")
  bestRouteId     String?
  pathCount       Int       @default(0)
  recRiskScore    Int?
  recHops         Int?
  recCost         String?
  flagsJson       Json?
  analysisJson    Json?
  liquidityJson   Json?
  routesJson      Json?
  aiNote          String?
  liquidityHash   String?
  aiNoteHash      String?
  lastRefreshedAt DateTime?
  lastError       String?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  ragDocuments CorridorRagDocument[]
  ragChats     CorridorRagChat[]
  statusEvents CorridorStatusEvent[]

  @@index([tier])
  @@index([importance])
  @@schema("corridor")
}

model CorridorStatusEvent {
  id         String   @id @default(uuid())
  corridorId String
  corridor   Corridor @relation(fields: [corridorId], references: [id], onDelete: Cascade)
  status     String
  pathCount  Int      @default(0)
  recCost    String?
  source     String   @default("scan")
  at         DateTime @default(now())

  @@index([corridorId, at])
  @@index([at])
  @@schema("corridor")
}

model CorridorRagDocument {
  id         String                       @id @default(uuid())
  corridorId String
  corridor   Corridor                     @relation(fields: [corridorId], references: [id], onDelete: Cascade)
  content    String
  metadata   Json?
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime                     @default(now())

  @@index([corridorId])
  @@schema("corridor")
}

model CorridorRagChat {
  id         String    @id @default(uuid())
  corridorId String?
  corridor   Corridor? @relation(fields: [corridorId], references: [id], onDelete: SetNull)
  createdAt  DateTime  @default(now())

  messages CorridorRagMessage[]

  @@schema("corridor")
}

model CorridorRagMessage {
  id        String          @id @default(uuid())
  chatId    String
  chat      CorridorRagChat @relation(fields: [chatId], references: [id], onDelete: Cascade)
  role      String
  content   String
  sources   Json?
  createdAt DateTime        @default(now())

  @@index([chatId])
  @@schema("corridor")
}

// ─── path (entity audit) ─────────────────────────────────────
model Analysis {
  id          String   @id @default(uuid())
  status      String   @default("queued")
  seedAddress String
  seedLabel   String?
  depth       Int      @default(1)
  error       String?
  summaryJson Json?
  userId      String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  nodes             Node[]
  edges             Edge[]
  riskFlags         RiskFlag[]
  ragDocuments      RagDocument[]
  ragChats          RagChat[]
  complianceReports ComplianceReport[]

  @@index([seedAddress, depth, status])
  @@index([userId])
  @@schema("path")
}

model Node {
  id            String   @id @default(uuid())
  analysisId    String
  analysis      Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  nodeId        String
  kind          String
  label         String
  data          Json
  aiExplanation String?
  createdAt     DateTime @default(now())

  @@unique([analysisId, nodeId])
  @@index([analysisId])
  @@schema("path")
}

model Edge {
  id         String   @id @default(uuid())
  analysisId String
  analysis   Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  edgeId     String
  source     String
  target     String
  kind       String
  label      String?
  data       Json?
  createdAt  DateTime @default(now())

  @@unique([analysisId, edgeId])
  @@index([analysisId])
  @@schema("path")
}

model RiskFlag {
  id         String   @id @default(uuid())
  analysisId String
  analysis   Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  nodeId     String
  flag       String
  severity   String
  detail     String
  data       Json?
  createdAt  DateTime @default(now())

  @@index([analysisId])
  @@schema("path")
}

model RagDocument {
  id         String                       @id @default(uuid())
  analysisId String
  analysis   Analysis                     @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  content    String
  metadata   Json?
  embedding  Unsupported("vector(1536)")?
  createdAt  DateTime                     @default(now())

  @@index([analysisId])
  @@schema("path")
}

model RagChat {
  id         String   @id @default(uuid())
  analysisId String
  analysis   Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  messages RagMessage[]

  @@schema("path")
}

model RagMessage {
  id        String   @id @default(uuid())
  chatId    String
  chat      RagChat  @relation(fields: [chatId], references: [id], onDelete: Cascade)
  role      String
  content   String
  sources   Json?
  createdAt DateTime @default(now())

  @@schema("path")
}

model ComplianceReport {
  id         String   @id @default(uuid())
  analysisId String
  analysis   Analysis @relation(fields: [analysisId], references: [id], onDelete: Cascade)
  title      String
  content    Json
  createdAt  DateTime @default(now())

  @@schema("path")
}

// ─── agent ───────────────────────────────────────────────────
model SafePathRun {
  id               String   @id @default(uuid())
  userId           String?
  srcCcy           String
  dstCcy           String
  amount           String
  maxRiskTolerance String   @default("MED")
  verdict          String
  reasoning        String
  resultJson       Json
  reportMarkdown   String?
  corridorId       String?
  analysisIds      Json?
  createdAt        DateTime @default(now())

  @@index([userId])
  @@index([createdAt])
  @@schema("agent")
}

// ─── ai ──────────────────────────────────────────────────────
model PromptLog {
  id         String   @id @default(uuid())
  purpose    String
  model      String
  promptHash String
  prompt     Json
  response   Json?
  tokensIn   Int?
  tokensOut  Int?
  latencyMs  Int?
  error      String?
  createdAt  DateTime @default(now())

  @@index([purpose, createdAt])
  @@index([promptHash])
  @@schema("ai")
}

model WebSearchCache {
  id        String   @id @default(uuid())
  query     String   @unique
  provider  String
  results   Json
  createdAt DateTime @default(now())
  expiresAt DateTime

  @@index([expiresAt])
  @@schema("ai")
}

// ─── market_data ─────────────────────────────────────────────
model XrplCacheMetadata {
  id        String   @id @default(uuid())
  cacheKey  String   @unique
  source    String
  fetchedAt DateTime @default(now())
  expiresAt DateTime

  @@index([expiresAt])
  @@schema("market_data")
}
```

- [ ] **Step 2: Create `.env` for prisma**

Run:
```bash
cat > /Users/beorlor/Documents/PBW_2026/corlens_v2/packages/db/.env <<'EOF'
DATABASE_URL=postgresql://corlens:corlens_dev@localhost:5432/corlens
EOF
```

- [ ] **Step 3: Verify Postgres is up**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && docker compose ps postgres`
Expected: postgres status `running (healthy)`. If not, `pnpm dev:db`.

- [ ] **Step 4: Generate Prisma client**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/db run prisma:generate`
Expected: success — `node_modules/.prisma/client` populated.

- [ ] **Step 5: Push schema to dev DB**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/db run prisma:push`
Expected: success — six schemas created in Postgres.

- [ ] **Step 6: Verify schemas exist in DB**

Run: `docker exec corlens-v2-postgres psql -U corlens -d corlens -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name IN ('identity','corridor','path','agent','ai','market_data') ORDER BY schema_name;"`
Expected: 6 rows: agent, ai, corridor, identity, market_data, path.

- [ ] **Step 7: Commit**

```bash
git add corlens_v2/packages/db/prisma/schema.prisma
git commit -m "feat(v2): prisma schema with multiSchema across 6 postgres schemas"
```

---

### Task E3: Per-service scoped DB facades

Each service receives a facade that exposes only the models it owns. Boundary enforcement at the type level — the path service literally cannot see `prisma.user` because the facade omits it.

**Files:**
- Create: `corlens_v2/packages/db/src/index.ts`
- Create: `corlens_v2/packages/db/src/identity.ts`
- Create: `corlens_v2/packages/db/src/corridor.ts`
- Create: `corlens_v2/packages/db/src/path.ts`
- Create: `corlens_v2/packages/db/src/agent.ts`
- Create: `corlens_v2/packages/db/src/ai.ts`
- Create: `corlens_v2/packages/db/src/market-data.ts`

- [ ] **Step 1: Write `corlens_v2/packages/db/src/index.ts`**

```ts
import { PrismaClient } from "@prisma/client";

export type Prisma = PrismaClient;

export function makePrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ["warn", "error"],
  });
}
```

- [ ] **Step 2: Write `corlens_v2/packages/db/src/identity.ts`**

```ts
import type { Prisma } from "./index.js";

export function identityDb(prisma: Prisma) {
  return {
    user: prisma.user,
    premiumSubscription: prisma.premiumSubscription,
    paymentRequest: prisma.paymentRequest,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type IdentityDb = ReturnType<typeof identityDb>;
```

- [ ] **Step 3: Write `corlens_v2/packages/db/src/corridor.ts`**

```ts
import type { Prisma } from "./index.js";

export function corridorDb(prisma: Prisma) {
  return {
    corridor: prisma.corridor,
    corridorStatusEvent: prisma.corridorStatusEvent,
    corridorRagDocument: prisma.corridorRagDocument,
    corridorRagChat: prisma.corridorRagChat,
    corridorRagMessage: prisma.corridorRagMessage,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type CorridorDb = ReturnType<typeof corridorDb>;
```

- [ ] **Step 4: Write `corlens_v2/packages/db/src/path.ts`**

```ts
import type { Prisma } from "./index.js";

export function pathDb(prisma: Prisma) {
  return {
    analysis: prisma.analysis,
    node: prisma.node,
    edge: prisma.edge,
    riskFlag: prisma.riskFlag,
    ragDocument: prisma.ragDocument,
    ragChat: prisma.ragChat,
    ragMessage: prisma.ragMessage,
    complianceReport: prisma.complianceReport,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type PathDb = ReturnType<typeof pathDb>;
```

- [ ] **Step 5: Write `corlens_v2/packages/db/src/agent.ts`**

```ts
import type { Prisma } from "./index.js";

export function agentDb(prisma: Prisma) {
  return {
    safePathRun: prisma.safePathRun,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type AgentDb = ReturnType<typeof agentDb>;
```

- [ ] **Step 6: Write `corlens_v2/packages/db/src/ai.ts`**

```ts
import type { Prisma } from "./index.js";

export function aiDb(prisma: Prisma) {
  return {
    promptLog: prisma.promptLog,
    webSearchCache: prisma.webSearchCache,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type AiDb = ReturnType<typeof aiDb>;
```

- [ ] **Step 7: Write `corlens_v2/packages/db/src/market-data.ts`**

```ts
import type { Prisma } from "./index.js";

export function marketDataDb(prisma: Prisma) {
  return {
    xrplCacheMetadata: prisma.xrplCacheMetadata,
    $transaction: prisma.$transaction.bind(prisma),
  };
}

export type MarketDataDb = ReturnType<typeof marketDataDb>;
```

- [ ] **Step 8: Typecheck + build**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/db run typecheck && pnpm --filter @corlens/db run build`
Expected: both succeed.

- [ ] **Step 9: Commit**

```bash
git add corlens_v2/packages/db/src/
git commit -m "feat(v2): per-service prisma facades for boundary enforcement"
```

---

## Phase F — `@corlens/events` package

### Task F1: events package scaffold + EventBus interface

**Files:**
- Create: `corlens_v2/packages/events/package.json`
- Create: `corlens_v2/packages/events/tsconfig.json`
- Create: `corlens_v2/packages/events/vitest.config.ts`
- Create: `corlens_v2/packages/events/src/index.ts`

- [ ] **Step 1: Write `corlens_v2/packages/events/package.json`**

```json
{
  "name": "@corlens/events",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@corlens/contracts": "workspace:*"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/packages/events/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `corlens_v2/packages/events/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/events",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write `corlens_v2/packages/events/src/index.ts`**

```ts
import { events as eventContracts } from "@corlens/contracts";

export type EventName = eventContracts.EventName;
export type EventPayload<E extends EventName> = eventContracts.EventPayload<E>;

export type EventHandler<E extends EventName> = (payload: EventPayload<E>) => Promise<void> | void;

export interface EventBus {
  publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void>;
  subscribe<E extends EventName>(name: E, handler: EventHandler<E>): void;
  close(): Promise<void>;
}

export { InMemoryEventBus } from "./in-memory.js";
export { HttpFanoutEventBus } from "./http-fanout.js";
```

- [ ] **Step 5: Install + sanity typecheck (will fail — in-memory/http-fanout don't exist yet)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install`
Expected: install succeeds. We'll ship the next two tasks before typecheck.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/packages/events/package.json corlens_v2/packages/events/tsconfig.json corlens_v2/packages/events/vitest.config.ts corlens_v2/packages/events/src/index.ts corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): scaffold @corlens/events with EventBus port"
```

---

### Task F2: TDD `InMemoryEventBus`

**Files:**
- Create: `corlens_v2/packages/events/tests/in-memory.test.ts`
- Create: `corlens_v2/packages/events/src/in-memory.ts`

- [ ] **Step 1: Write the failing test `corlens_v2/packages/events/tests/in-memory.test.ts`**

```ts
import { describe, expect, it, vi } from "vitest";
import { InMemoryEventBus } from "../src/in-memory.js";

describe("InMemoryEventBus", () => {
  it("delivers a published event to a subscribed handler", async () => {
    const bus = new InMemoryEventBus();
    const handler = vi.fn();
    bus.subscribe("payment.confirmed", handler);

    await bus.publish("payment.confirmed", {
      userId: "11111111-1111-1111-1111-111111111111",
      paymentId: "22222222-2222-2222-2222-222222222222",
      txHash: "A".repeat(64),
      amount: "10",
      currency: "XRP",
      confirmedAt: new Date().toISOString(),
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("delivers to every handler subscribed to the same event", async () => {
    const bus = new InMemoryEventBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.subscribe("user.role_upgraded", a);
    bus.subscribe("user.role_upgraded", b);

    await bus.publish("user.role_upgraded", {
      userId: "11111111-1111-1111-1111-111111111111",
      newRole: "premium",
      upgradedAt: new Date().toISOString(),
    });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("rejects payloads that fail schema validation", async () => {
    const bus = new InMemoryEventBus();
    bus.subscribe("payment.confirmed", () => {});

    await expect(
      bus.publish("payment.confirmed", {
        userId: "not-a-uuid",
      } as never),
    ).rejects.toThrow(/payment\.confirmed/);
  });

  it("isolates handler errors so other subscribers still run", async () => {
    const bus = new InMemoryEventBus();
    const failing = vi.fn(() => {
      throw new Error("boom");
    });
    const ok = vi.fn();
    bus.subscribe("corridor.refreshed", failing);
    bus.subscribe("corridor.refreshed", ok);

    await bus.publish("corridor.refreshed", {
      corridorId: "usd-mxn",
      status: "GREEN",
      refreshedAt: new Date().toISOString(),
    });

    expect(failing).toHaveBeenCalled();
    expect(ok).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test (fails)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/events exec vitest run`
Expected: FAIL — `in-memory.js` does not exist.

- [ ] **Step 3: Implement `corlens_v2/packages/events/src/in-memory.ts`**

```ts
import { events as eventContracts } from "@corlens/contracts";
import type { EventBus, EventHandler, EventName, EventPayload } from "./index.js";

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<EventName, Set<EventHandler<EventName>>>();

  subscribe<E extends EventName>(name: E, handler: EventHandler<E>): void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(handler as EventHandler<EventName>);
  }

  async publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    const schema = eventContracts.EventRegistry[name];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid payload for ${name}: ${result.error.message}`);
    }
    const set = this.handlers.get(name);
    if (!set) return;
    await Promise.allSettled(
      [...set].map(async (h) => {
        await (h as EventHandler<E>)(payload);
      }),
    );
  }

  async close(): Promise<void> {
    this.handlers.clear();
  }
}
```

- [ ] **Step 4: Run the test (passes)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/events exec vitest run`
Expected: PASS — 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add corlens_v2/packages/events/src/in-memory.ts corlens_v2/packages/events/tests/in-memory.test.ts
git commit -m "feat(v2): InMemoryEventBus with schema-validated publish"
```

---

### Task F3: TDD `HttpFanoutEventBus`

This is what cross-process delivery looks like today — the publisher knows a list of subscriber URLs (one per service that wants the event) and POSTs the payload to each. Tomorrow this gets replaced by Redis Streams without changing callers.

**Files:**
- Create: `corlens_v2/packages/events/tests/http-fanout.test.ts`
- Create: `corlens_v2/packages/events/src/http-fanout.ts`

- [ ] **Step 1: Write the failing test `corlens_v2/packages/events/tests/http-fanout.test.ts`**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpFanoutEventBus } from "../src/http-fanout.js";

const validPayload = {
  userId: "11111111-1111-1111-1111-111111111111",
  paymentId: "22222222-2222-2222-2222-222222222222",
  txHash: "A".repeat(64),
  amount: "10",
  currency: "XRP" as const,
  confirmedAt: new Date().toISOString(),
};

afterEach(() => vi.restoreAllMocks());

describe("HttpFanoutEventBus", () => {
  it("POSTs the payload to every subscriber url", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    const bus = new HttpFanoutEventBus({
      subscribers: {
        "payment.confirmed": ["http://corridor:3004/events", "http://agent:3006/events"],
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await bus.publish("payment.confirmed", validPayload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toContain("http://corridor:3004/events");
    expect(urls).toContain("http://agent:3006/events");
  });

  it("envelopes the request body as { name, payload }", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": ["http://x/events"] },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await bus.publish("payment.confirmed", validPayload);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      name: "payment.confirmed",
      payload: validPayload,
    });
  });

  it("validates payloads against the schema before any fetch", async () => {
    const fetchMock = vi.fn();
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": ["http://x/events"] },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(bus.publish("payment.confirmed", { userId: "bad" } as never)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not throw when a subscriber returns an error — logs and continues", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const bus = new HttpFanoutEventBus({
      subscribers: {
        "payment.confirmed": ["http://broken/events", "http://ok/events"],
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(bus.publish("payment.confirmed", validPayload)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("subscribe is a noop in fanout mode (cross-process delivery is HTTP)", () => {
    const bus = new HttpFanoutEventBus({
      subscribers: { "payment.confirmed": [] },
      fetch: vi.fn() as unknown as typeof fetch,
    });
    expect(() => bus.subscribe("payment.confirmed", () => {})).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the test (fails)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/events exec vitest run`
Expected: FAIL — `http-fanout.js` does not exist.

- [ ] **Step 3: Implement `corlens_v2/packages/events/src/http-fanout.ts`**

```ts
import { events as eventContracts } from "@corlens/contracts";
import type { EventBus, EventHandler, EventName, EventPayload } from "./index.js";

export interface HttpFanoutOptions {
  subscribers: Partial<Record<EventName, string[]>>;
  fetch?: typeof fetch;
  signal?: (body: string) => Record<string, string>;
}

export class HttpFanoutEventBus implements EventBus {
  private readonly subscribers: Partial<Record<EventName, string[]>>;
  private readonly fetchImpl: typeof fetch;
  private readonly signal?: (body: string) => Record<string, string>;

  constructor(opts: HttpFanoutOptions) {
    this.subscribers = opts.subscribers;
    this.fetchImpl = opts.fetch ?? fetch;
    this.signal = opts.signal;
  }

  subscribe<E extends EventName>(_name: E, _handler: EventHandler<E>): void {
    // Cross-process delivery is HTTP — the subscriber lives in another service
    // and exposes its own /events endpoint. In-process subscribers should use
    // InMemoryEventBus.
  }

  async publish<E extends EventName>(name: E, payload: EventPayload<E>): Promise<void> {
    const schema = eventContracts.EventRegistry[name];
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new Error(`Invalid payload for ${name}: ${result.error.message}`);
    }
    const urls = this.subscribers[name] ?? [];
    if (urls.length === 0) return;

    const body = JSON.stringify({ name, payload });
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(this.signal ? this.signal(body) : {}),
    };

    await Promise.allSettled(
      urls.map(async (url) => {
        try {
          await this.fetchImpl(url, { method: "POST", headers, body });
        } catch {
          // intentionally swallow — best-effort delivery; future Redis Streams
          // adapter handles durability and retries
        }
      }),
    );
  }

  async close(): Promise<void> {}
}
```

- [ ] **Step 4: Run the test (passes)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/events exec vitest run`
Expected: PASS — 5 tests in `http-fanout.test.ts` plus the 4 from `in-memory.test.ts` = 9 green.

- [ ] **Step 5: Typecheck + build**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/events run typecheck && pnpm --filter @corlens/events run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/packages/events/src/http-fanout.ts corlens_v2/packages/events/tests/http-fanout.test.ts
git commit -m "feat(v2): HttpFanoutEventBus for cross-process event delivery"
```

---

## Phase G — `@corlens/clients` package

### Task G1: clients package scaffold + HTTP base

**Files:**
- Create: `corlens_v2/packages/clients/package.json`
- Create: `corlens_v2/packages/clients/tsconfig.json`
- Create: `corlens_v2/packages/clients/vitest.config.ts`
- Create: `corlens_v2/packages/clients/src/index.ts`
- Create: `corlens_v2/packages/clients/src/http.ts`
- Create: `corlens_v2/packages/clients/src/README.md`

- [ ] **Step 1: Write `corlens_v2/packages/clients/package.json`**

```json
{
  "name": "@corlens/clients",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@corlens/contracts": "workspace:*",
    "zod": "3.23.8"
  },
  "devDependencies": {
    "typescript": "5.7.2",
    "vitest": "2.1.8"
  }
}
```

- [ ] **Step 2: Write `corlens_v2/packages/clients/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Write `corlens_v2/packages/clients/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@corlens/clients",
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: Write `corlens_v2/packages/clients/src/http.ts`**

```ts
import type { ZodTypeAny, z } from "zod";

export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface HttpClientOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  headers?: () => Record<string, string>;
  sign?: (body: string | undefined) => Record<string, string>;
}

export class ServiceHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ServiceHttpError";
  }
}

export function createHttpClient(opts: HttpClientOptions) {
  const fetchImpl = opts.fetch ?? fetch;

  async function call<TResp extends ZodTypeAny>(
    method: HttpMethod,
    path: string,
    body: unknown,
    responseSchema: TResp,
  ): Promise<z.infer<TResp>> {
    const url = `${opts.baseUrl.replace(/\/$/, "")}${path}`;
    const bodyStr = body === undefined ? undefined : JSON.stringify(body);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      ...(opts.headers ? opts.headers() : {}),
      ...(opts.sign ? opts.sign(bodyStr) : {}),
    };
    const res = await fetchImpl(url, { method, headers, body: bodyStr });
    const text = await res.text();
    const parsed = text.length > 0 ? JSON.parse(text) : undefined;
    if (!res.ok) {
      throw new ServiceHttpError(
        `${method} ${url} failed with ${res.status}`,
        res.status,
        parsed,
      );
    }
    const result = responseSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(`Response schema mismatch for ${path}: ${result.error.message}`);
    }
    return result.data;
  }

  return {
    get: <TResp extends ZodTypeAny>(path: string, schema: TResp) =>
      call("GET", path, undefined, schema),
    post: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("POST", path, body, schema),
    put: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("PUT", path, body, schema),
    delete: <TResp extends ZodTypeAny>(path: string, schema: TResp) =>
      call("DELETE", path, undefined, schema),
    patch: <TResp extends ZodTypeAny>(path: string, body: unknown, schema: TResp) =>
      call("PATCH", path, body, schema),
  };
}

export type HttpClient = ReturnType<typeof createHttpClient>;
```

- [ ] **Step 5: Write `corlens_v2/packages/clients/src/index.ts`**

```ts
export { createHttpClient, ServiceHttpError } from "./http.js";
export type { HttpClient, HttpClientOptions, HttpMethod } from "./http.js";
export { hmacSigner, hmacVerifier } from "./hmac.js";
```

- [ ] **Step 6: Write `corlens_v2/packages/clients/src/README.md`**

```markdown
# @corlens/clients

Typed HTTP base for service-to-service calls.

## Adding a service client

When a service is built (steps 3+ in the build order), add a typed client to this package:

```ts
// src/identity-client.ts
import { identity } from "@corlens/contracts";
import { createHttpClient, type HttpClientOptions } from "./http.js";

export function createIdentityClient(opts: HttpClientOptions) {
  const http = createHttpClient(opts);
  return {
    verify: (token: string) =>
      http.get(`/verify?token=${encodeURIComponent(token)}`, identity.JwtPayload),
    profile: () => http.get("/api/auth/profile", /* ProfileResponse */ ...),
    // ...
  };
}
```

Re-export from `src/index.ts`. Refactoring a contract schema breaks every caller at compile time.
```

- [ ] **Step 7: Install + scaffold typecheck (will fail until Task G2 ships hmac.ts)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm install`
Expected: install succeeds.

- [ ] **Step 8: Commit**

```bash
git add corlens_v2/packages/clients/package.json corlens_v2/packages/clients/tsconfig.json corlens_v2/packages/clients/vitest.config.ts corlens_v2/packages/clients/src/index.ts corlens_v2/packages/clients/src/http.ts corlens_v2/packages/clients/src/README.md corlens_v2/pnpm-lock.yaml
git commit -m "feat(v2): @corlens/clients HTTP base with zod-validated responses"
```

---

### Task G2: TDD HMAC signer + verifier

For internal service-to-service auth (services calling each other directly inside the docker network, bypassing Caddy). Shared secret in env, HMAC over the request body.

**Files:**
- Create: `corlens_v2/packages/clients/tests/hmac.test.ts`
- Create: `corlens_v2/packages/clients/src/hmac.ts`

- [ ] **Step 1: Write the failing test `corlens_v2/packages/clients/tests/hmac.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import { hmacSigner, hmacVerifier } from "../src/hmac.js";

describe("hmacSigner / hmacVerifier", () => {
  const secret = "test-secret-do-not-ship";

  it("verifier accepts a request signed by the matching signer", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const body = '{"hello":"world"}';
    const headers = sign(body);
    expect(verify(body, headers)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const headers = sign('{"hello":"world"}');
    expect(verify('{"hello":"tampered"}', headers)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret: "different", maxAgeSeconds: 60 });
    const body = '{"x":1}';
    const headers = sign(body);
    expect(verify(body, headers)).toBe(false);
  });

  it("rejects a stale signature past maxAge", () => {
    const past = Math.floor(Date.now() / 1000) - 120;
    const sign = hmacSigner({ secret, nowSeconds: () => past });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const body = "{}";
    const headers = sign(body);
    expect(verify(body, headers)).toBe(false);
  });

  it("signs an empty body", () => {
    const sign = hmacSigner({ secret });
    const verify = hmacVerifier({ secret, maxAgeSeconds: 60 });
    const headers = sign(undefined);
    expect(verify(undefined, headers)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test (fails)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/clients exec vitest run`
Expected: FAIL — `hmac.js` does not exist.

- [ ] **Step 3: Implement `corlens_v2/packages/clients/src/hmac.ts`**

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export interface HmacSignerOptions {
  secret: string;
  nowSeconds?: () => number;
}

export interface HmacVerifierOptions {
  secret: string;
  maxAgeSeconds: number;
  nowSeconds?: () => number;
}

const TS_HEADER = "x-corlens-ts";
const SIG_HEADER = "x-corlens-sig";

function compute(secret: string, ts: string, body: string): string {
  return createHmac("sha256", secret).update(`${ts}\n${body}`).digest("hex");
}

export function hmacSigner(opts: HmacSignerOptions): (body: string | undefined) => Record<string, string> {
  const now = opts.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return (body) => {
    const ts = String(now());
    const sig = compute(opts.secret, ts, body ?? "");
    return { [TS_HEADER]: ts, [SIG_HEADER]: sig };
  };
}

export function hmacVerifier(
  opts: HmacVerifierOptions,
): (body: string | undefined, headers: Record<string, string>) => boolean {
  const now = opts.nowSeconds ?? (() => Math.floor(Date.now() / 1000));
  return (body, headers) => {
    const ts = headers[TS_HEADER];
    const sig = headers[SIG_HEADER];
    if (!ts || !sig) return false;

    const parsedTs = Number.parseInt(ts, 10);
    if (!Number.isFinite(parsedTs)) return false;
    if (Math.abs(now() - parsedTs) > opts.maxAgeSeconds) return false;

    const expected = compute(opts.secret, ts, body ?? "");
    if (expected.length !== sig.length) return false;
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
  };
}
```

- [ ] **Step 4: Run the test (passes)**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/clients exec vitest run`
Expected: PASS — 5 tests green.

- [ ] **Step 5: Typecheck + build**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm --filter @corlens/clients run typecheck && pnpm --filter @corlens/clients run build`
Expected: both succeed.

- [ ] **Step 6: Commit**

```bash
git add corlens_v2/packages/clients/src/hmac.ts corlens_v2/packages/clients/tests/hmac.test.ts
git commit -m "feat(v2): HMAC signer+verifier for internal service auth"
```

---

## Phase H — Workspace verification

### Task H1: Per-package typecheck scripts already added; verify root commands

- [ ] **Step 1: Run workspace typecheck**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm typecheck`
Expected: every package reports success.

- [ ] **Step 2: Run workspace build**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm build`
Expected: every package builds; `dist/` directories populated.

- [ ] **Step 3: Run lint**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm lint`
Expected: 0 errors.

- [ ] **Step 4: Run all tests**

Run: `cd /Users/beorlor/Documents/PBW_2026/corlens_v2 && pnpm test`
Expected: 17 tests pass total (3 env + 4 in-memory + 5 http-fanout + 5 hmac).

> If any of the above fail, stop and fix before proceeding. Do not create the verification commit until everything is green.

- [ ] **Step 5: Commit (verification artifacts only — `dist/` is gitignored)**

If the workspace passes everything, no files should have changed beyond the expected ones already committed. If `pnpm-lock.yaml` updated during build, commit it:

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/pnpm-lock.yaml 2>/dev/null || true
git diff --cached --quiet || git commit -m "chore(v2): refresh lockfile after foundation"
```

If there's nothing to commit, this step is a no-op.

---

### Task H2: Update spec with foundation milestone

**Files:**
- Modify: `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`

- [ ] **Step 1: Read section 12 of the spec**

Read: `/Users/beorlor/Documents/PBW_2026/corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md` lines 290-330.

- [ ] **Step 2: Mark foundation step complete**

Replace the bullet for step 1 with the same text plus a leading checkmark and a link to this plan:

Use Edit:
- old_string: `1. **Foundation (shared packages first).**`
- new_string: `1. **Foundation (shared packages first).** ✓ Implemented per [`docs/superpowers/plans/2026-05-08-foundation-shared-packages.md`](../plans/2026-05-08-foundation-shared-packages.md).`

- [ ] **Step 3: Commit**

```bash
cd /Users/beorlor/Documents/PBW_2026
git add corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md
git commit -m "docs(v2): mark foundation milestone complete in spec"
```

---

## Self-review notes

This plan was reviewed against the spec on 2026-05-08:

- **Spec § 5 (Shared packages):** all four packages from the spec (`contracts`, `db`, `clients`, `events`) are scaffolded. `@corlens/env` is a fifth shared package — the spec mentions "env validation utility" under step 1's foundation deliverables, this plan formalizes it as a package so every service consumes the same Zod-validated env loader.
- **Spec § 6 (Per-service folder structure):** tooling (Biome, Vitest, tsconfig) is in place; service-specific layout is enforced when each service is built (steps 3-8).
- **Spec § 9 (Database strategy):** six Postgres schemas created; `multiSchema` Prisma preview enabled; per-service facades enforce model scoping; cross-schema relations dropped from v1 schema.
- **Spec § 10 (Inter-service communication):** `EventBus` interface ships with two implementations (in-memory + HTTP fanout); HMAC signer/verifier in clients package covers internal service-to-service auth.
- **Spec § 11 (Swagger):** not in scope for foundation — added when each service is built.
- **Spec § 13 (Open questions):** unaffected by this plan.

No placeholders found. Type names are consistent across tasks (`EventBus`, `EventName`, `EventPayload<E>`, `HttpClient`, `IdentityDb`, `CorridorDb`, etc.). Method signatures match between definitions and call sites. The `@corlens/contracts` re-export pattern (`export * as identity from "./identity.js"`) is consistent — consumers reach domain schemas via `identity.JwtPayload`, `events.EventRegistry`, etc.

---

*End of plan.*
