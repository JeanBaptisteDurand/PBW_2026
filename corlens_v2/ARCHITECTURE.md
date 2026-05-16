# Corelens V2 — Architecture in one page

> **The intent in one sentence:** Corelens v2 is the same product as
> v1, exploded into a handful of HTTP-coupled Fastify services so the
> code is easier to read and to scale piece-by-piece — **it is not
> (yet) a real microservices mesh**.

## What this codebase is

- **Six Fastify services** + one Caddy gateway + one nginx SPA, all
  in **one `docker-compose.yml`**, sharing **one Postgres** instance
  (one schema per service) and **one Redis** (BullMQ + cache).
- Services call each other directly over HTTP through typed
  connectors. There is **no event bus in production** beyond a single
  `payment.confirmed` fan-out — every other inter-service edge is a
  synchronous HTTP call.
- The SPA (`apps/web`) talks to the backend only through the Caddy
  gateway at `:8080`. No service is reached directly from the
  browser.

## What this codebase is NOT

- **Not a real microservices mesh.** No service-mesh, no per-service
  database, no per-service deploy pipeline, no async queue between
  every service.
- **Not event-driven.** The seam (`@corlens/events`) exists so we
  *can* swap an HTTP edge for a queue producer later without
  rewriting the publisher — but on day one almost every event is just
  a function call inside the publishing service.
- **Not multi-tenant.** Single Postgres, single Redis, shared volume.
  Multi-tenancy is a future concern, not a current constraint.

## Why this shape

The v1 monolith (`corlens/apps/server`, ~30 kLOC) was hard to
maintain because routes, business logic, AI calls, DB writes, and
external HTTP all lived in the same files. v2 fixes maintainability —
not deploy independence. Six smaller Fastify services with clean
controller / service / repository layering beats one big
do-everything Express app, and we can later flip any edge to a queue
without rewriting the publisher.

## How to read the tree

```
corlens_v2/
├── apps/
│   ├── identity/        users + JWT + Crossmark login + payments
│   ├── market-data/     XRPL pool + partner orderbook fetchers
│   ├── ai-service/      LLM completions + embeddings + web search
│   ├── corridor/        2 436-corridor atlas + scanner + RAG
│   ├── path/            BFS crawler + risk engine + graph builder
│   ├── agent/           9-phase Safe Path orchestrator + compliance
│   ├── mcp-server/      Claude Desktop MCP — calls the gateway
│   └── web/             Vite + React 18 SPA
├── packages/
│   ├── contracts/       Zod schemas (one source of truth for shapes)
│   ├── db/              Prisma schema split into Postgres schemas
│   ├── clients/         HTTP + HMAC helpers shared across connectors
│   ├── env/             Zod-validated env config helper
│   └── events/          publish/subscribe seam (HTTP today, queue tomorrow)
├── docker-compose.yml   the whole stack: 10 containers
├── Caddyfile            JWT forward_auth + path routing
└── docs/superpowers/    specs + plans (1 spec per ~10-commit phase)
```

Inside each service:

```
apps/<svc>/src/
├── controllers/      route handlers — Zod validation, no Prisma here
├── services/         use-cases — pure functions where possible
├── repositories/     Prisma calls scoped to this service's schema
├── connectors/       external clients (other services, XRPL, OpenAI)
├── plugins/          Fastify plugins (auth, swagger, error handler)
├── app.ts            buildApp() — wires everything; returns FastifyInstance
├── index.ts          bootstrap: load env, buildApp, listen
└── env.ts            Zod-validated env config
```

**Layering rules (enforced by code review, not by lint):**

- Controllers never touch Prisma directly — they call services.
- Services never read `req` / `res` — they take plain inputs.
- Repositories only access this service's own Postgres schema.
- Connectors are the only files that talk to anything outside the
  process.

## How to run

```sh
docker compose up -d                       # whole stack
curl http://localhost:8080/health          # gateway up
curl http://localhost:8080/api/corridors   # corridor catalog
open http://localhost:8080/                # SPA
```

Per-service dev:

```sh
pnpm --filter @corlens/path dev            # one service, watch mode
pnpm --filter @corlens/web dev             # SPA on :5173, /api proxied
```

Per-service test:

```sh
pnpm --filter @corlens/path test           # vitest
pnpm --filter @corlens/web test:e2e        # 35 Playwright tests
```

## When to add an event vs an HTTP call

Default to **HTTP**. Add an event (`@corlens/events.publish`) only
when:

1. The publisher should not block on the subscriber (e.g. payment
   confirmation → user role upgrade → cache invalidation).
2. There are multiple subscribers and the list will grow.

The first migration done (commit `5ac4fca`) was
`payment.confirmed` — identity → ai-service + agent. Adding more
events should follow the same pattern.

## When this shape stops working

Move to real microservices (separate databases, message broker,
per-service deploys) when you hit any of:

- A single service's QPS justifies its own deploy lifecycle.
- The shared Postgres becomes the bottleneck.
- One team owns a service end-to-end and wants to deploy on its
  cadence.

Until then, **keep the false-microservices shape**. It's the
maintainability win without the operational tax.

---

*For the full design rationale + per-service charters, see
[docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md](docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md).*
