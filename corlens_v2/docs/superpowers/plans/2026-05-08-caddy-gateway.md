# CORLens v2 — Caddy Gateway Implementation Plan (Step 2 of 12)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Caddy as the single ingress for corlens_v2 — listening on host `:8080` in dev, with all `/api/*` routes declared and stubbed to a `503` response that names which service is responsible. No real upstream services exist yet; Step 3 (identity) will replace one stub with a real reverse_proxy and add `forward_auth` JWT validation.

**Architecture:** Caddy 2 in a docker container on the same compose stack as Postgres + Redis. Caddyfile has one site address (`:8080` for dev), one route per service prefix, and a default catch-all that serves a static "v2 gateway" landing page. `forward_auth` is intentionally NOT wired in this step — it depends on the `/verify` endpoint that ships with the identity service (Step 3). All declared route stubs return JSON `{"error": "...", "service": "<name>", "step": <N>}` with HTTP 503 so a future smoke test can verify routing was correct without needing services up.

**Tech Stack:** Caddy 2 (official `caddy:2` image), Docker Compose.

**Spec:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md` — sections 7.1 (gateway), 7.2 (identity — for the routes table this gateway forwards), 12 (build order, step 2).

**Working directory:** `/Users/beorlor/Documents/PBW_2026/corlens_v2/`

---

## Layout produced by this plan

```
corlens_v2/
├── Caddyfile                            NEW: dev gateway config
├── docker-compose.yml                   MODIFIED: add caddy service
└── docs/superpowers/
    ├── specs/.../...architecture-design.md   MODIFIED: mark step 2 complete
    └── plans/2026-05-08-caddy-gateway.md     this plan
```

No source code changes. All workspace packages from Step 1 are untouched.

---

## Conventions every task MUST follow

- **Indent:** 2 spaces in YAML; tab-free Caddyfile (Caddy is whitespace-tolerant but stay consistent — 4 spaces inside route blocks per the spec sketch).
- **No emojis** in any file.
- **Conventional Commits** for every commit. Never `--no-verify`. Never `git add -A`.
- **Stub responses** must include both `service` (which v2 service handles this prefix) and `step` (which build step adds the real implementation) as JSON fields, so anyone checking the gateway later can see what's missing.

---

## Task 1: Write the Caddyfile

**Files:**
- Create: `corlens_v2/Caddyfile`

The Caddyfile uses a single site block (`:8080`) that declares one `handle_path` per service prefix, plus a default catch-all. Each handler currently returns a stub 503 response. As services come online, the corresponding stub gets swapped for a `reverse_proxy <service>:<port>` plus the appropriate `forward_auth` block.

- [ ] **Step 1: Write `corlens_v2/Caddyfile`**

```caddy
{
    # Disable Caddy's automatic admin API listener — we don't need it in dev,
    # and it spams the logs. Re-enable with `admin :2019` when needed.
    admin off

    # Auto-TLS is off because dev listens on plain HTTP. Production will get
    # a separate site block for cor-lens.xyz once Step 12 (cutover) lands.
    auto_https off
}

# ─── Dev gateway (:8080) ───────────────────────────────────────────
:8080 {
    log {
        output stdout
        format console
        level INFO
    }

    # Health endpoint for the gateway itself. Useful for docker healthcheck
    # and for confirming the gateway is up before any service has shipped.
    handle /health {
        respond `{"status":"ok","gateway":"caddy","stage":"dev"}` 200 {
            close
        }
    }

    # ─── identity (Step 3) — auth + JWT + payment ──────────────────
    handle_path /api/auth/* {
        respond `{"error":"not_implemented","service":"identity","step":3}` 503 {
            close
        }
    }
    handle_path /api/payment/* {
        respond `{"error":"not_implemented","service":"identity","step":3}` 503 {
            close
        }
    }

    # ─── market-data (Step 4) — XRPL + partner depth ───────────────
    handle_path /api/market-data/* {
        respond `{"error":"not_implemented","service":"market-data","step":4}` 503 {
            close
        }
    }

    # ─── ai-service (Step 5) — completions, embeddings, web search ─
    handle_path /api/ai/* {
        respond `{"error":"not_implemented","service":"ai-service","step":5}` 503 {
            close
        }
    }

    # ─── corridor (Step 6) — catalog, scanner, RAG ─────────────────
    handle_path /api/corridors/* {
        respond `{"error":"not_implemented","service":"corridor","step":6}` 503 {
            close
        }
    }
    handle_path /api/corridor/* {
        respond `{"error":"not_implemented","service":"corridor","step":6}` 503 {
            close
        }
    }

    # ─── path (Step 7) — entity audit ──────────────────────────────
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

    # ─── agent (Step 8) — Safe Path orchestrator + reports ─────────
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

    # ─── Aggregated docs (Step 11+) — Swagger UI fan-out ───────────
    handle /docs* {
        respond `{"error":"not_implemented","service":"docs","step":11}` 503 {
            close
        }
    }

    # ─── Catch-all: minimal landing for the gateway itself ─────────
    handle {
        respond `{"name":"corlens-v2-gateway","stage":"foundation","docs":"/docs","health":"/health"}` 200 {
            close
        }
    }
}
```

- [ ] **Step 2: Validate the Caddyfile syntax**

Run:
```
docker run --rm -v /Users/beorlor/Documents/PBW_2026/corlens_v2/Caddyfile:/etc/caddy/Caddyfile:ro caddy:2 caddy validate --config /etc/caddy/Caddyfile
```
Expected: `Valid configuration`. If invalid, fix syntax and re-validate before continuing.

- [ ] **Step 3: Commit**

Run from `/Users/beorlor/Documents/PBW_2026`:
```
git add corlens_v2/Caddyfile
git commit -m "feat(v2): caddy gateway with stub routes for every service prefix"
```

---

## Task 2: Add Caddy service to docker-compose

**Files:**
- Modify: `corlens_v2/docker-compose.yml`

Caddy joins the existing `services` block. Host port `8080` maps to container port `8080`. The Caddyfile is mounted read-only. Healthcheck hits the `/health` endpoint declared in Task 1.

- [ ] **Step 1: Read current `corlens_v2/docker-compose.yml`**

Read the file to confirm it currently has only `postgres` and `redis` services (from Step 1 / Task B1).

- [ ] **Step 2: Replace `corlens_v2/docker-compose.yml` with this content**

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
      - "5435:5432"
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
      - "6381:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  gateway:
    image: caddy:2
    container_name: corlens-v2-gateway
    restart: unless-stopped
    ports:
      - "8080:8080"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    healthcheck:
      test: ["CMD", "wget", "-q", "-O-", "http://localhost:8080/health"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
  caddy_data:
  caddy_config:
```

- [ ] **Step 3: Update root `package.json` so `pnpm dev:db` brings up the gateway too**

Read `corlens_v2/package.json`, find `"dev:db": "docker compose up -d postgres redis"`, and update it to also include the gateway. The script suite becomes:

```json
    "dev:db": "docker compose up -d postgres redis",
    "dev:up": "docker compose up -d",
    "dev:down": "docker compose down",
    "dev:reset": "docker compose down -v && docker compose up -d"
```

The diff vs current: add a new `dev:up` (everything), keep `dev:db` (just data stores), rename existing `dev:db:down` → `dev:down`, rename existing `dev:db:reset` → `dev:reset`. The intent is `dev:db` = data only, `dev:up` = full stack. No more `dev:db:down`/`dev:db:reset` aliases.

Use the Edit tool against `corlens_v2/package.json` to replace this block:

```json
    "dev:db": "docker compose up -d postgres redis",
    "dev:db:down": "docker compose down",
    "dev:db:reset": "docker compose down -v && docker compose up -d postgres redis"
```

with this block:

```json
    "dev:db": "docker compose up -d postgres redis",
    "dev:up": "docker compose up -d",
    "dev:down": "docker compose down",
    "dev:reset": "docker compose down -v && docker compose up -d"
```

- [ ] **Step 4: Bring up the full stack**

Run from `/Users/beorlor/Documents/PBW_2026/corlens_v2`:
```
pnpm dev:up
```
Expected: 3 containers start. After ~10 seconds, `docker compose ps` shows all three (postgres, redis, gateway) `running (healthy)`.

If host port 8080 is taken (some other dev tool), `docker compose ps` will show `gateway` in `Restarting` state and `docker compose logs gateway` will mention `bind: address already in use`. STOP and report BLOCKED with the conflicting process — do not silently move the gateway to a different port; the spec uses 8080.

- [ ] **Step 5: Commit**

Run from `/Users/beorlor/Documents/PBW_2026`:
```
git add corlens_v2/docker-compose.yml corlens_v2/package.json
git commit -m "feat(v2): add caddy gateway to docker-compose stack"
```

---

## Task 3: Smoke-test the gateway routes

**Files:** None created/modified — this is a verification task. Only run commands.

The gateway must answer correctly on every declared route. Run each `curl` and confirm the expected response.

- [ ] **Step 1: `curl /health` — expect 200 OK**

Run:
```
curl -sS -i http://localhost:8080/health
```
Expected output contains:
- `HTTP/1.1 200 OK`
- Response body: `{"status":"ok","gateway":"caddy","stage":"dev"}`

- [ ] **Step 2: `curl /` — expect 200 with the gateway landing JSON**

Run:
```
curl -sS http://localhost:8080/
```
Expected body: `{"name":"corlens-v2-gateway","stage":"foundation","docs":"/docs","health":"/health"}`

- [ ] **Step 3: `curl /api/auth/connect` — expect 503 identity stub**

Run:
```
curl -sS -i -X POST http://localhost:8080/api/auth/connect -H 'content-type: application/json' -d '{}'
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"identity","step":3}`.

- [ ] **Step 4: `curl /api/corridors` — expect 503 corridor stub**

Run:
```
curl -sS -i http://localhost:8080/api/corridors
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"corridor","step":6}`.

- [ ] **Step 5: `curl /api/safe-path` — expect 503 agent stub**

Run:
```
curl -sS -i -X POST http://localhost:8080/api/safe-path
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"agent","step":8}`.

- [ ] **Step 6: `curl /api/analyze` — expect 503 path stub**

Run:
```
curl -sS -i -X POST http://localhost:8080/api/analyze
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"path","step":7}`.

- [ ] **Step 7: `curl /api/market-data/xrpl/account/r123` — expect 503 market-data stub**

Run:
```
curl -sS -i http://localhost:8080/api/market-data/xrpl/account/r123
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"market-data","step":4}`.

- [ ] **Step 8: `curl /docs` — expect 503 docs stub**

Run:
```
curl -sS -i http://localhost:8080/docs
```
Expected: HTTP 503, body `{"error":"not_implemented","service":"docs","step":11}`.

- [ ] **Step 9: `curl /unknown-path` — expect 200 catch-all**

Run:
```
curl -sS -i http://localhost:8080/unknown-path
```
Expected: HTTP 200, body identical to Step 2 (the gateway landing JSON). (`handle {}` with no matcher fires for every request the earlier `handle_path` blocks didn't match.)

- [ ] **Step 10: Verify caddy logs show the requests**

Run:
```
docker compose logs --tail 30 gateway
```
Expected: console-format access log lines for the requests above. Each line includes the path and the response status (200, 503, etc.).

- [ ] **Step 11: No commit — this task is verification only**

If anything failed in Steps 1-10, STOP and report BLOCKED with the exact failing command and its output. Otherwise proceed to Task 4.

---

## Task 4: Mark Step 2 complete in the spec

**Files:**
- Modify: `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md`

- [ ] **Step 1: Find the build-order entry for Step 2 in the spec**

Read `corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md` and locate the bullet that starts:

```
2. **gateway (Caddy)** — Caddyfile with all routes stubbed to a placeholder, TLS in dev via local CA, docker-compose.
```

- [ ] **Step 2: Apply the milestone marker**

Use the Edit tool to replace:

```
2. **gateway (Caddy)** — Caddyfile with all routes stubbed to a placeholder, TLS in dev via local CA, docker-compose.
```

with:

```
2. **gateway (Caddy)** — Caddyfile with all routes stubbed to a placeholder, TLS in dev via local CA, docker-compose. ✓ Implemented per [`docs/superpowers/plans/2026-05-08-caddy-gateway.md`](../plans/2026-05-08-caddy-gateway.md). (TLS deferred to step 12 cutover; dev listens plain HTTP on `:8080`. `forward_auth` to identity is wired in step 3 when `/verify` ships.)
```

- [ ] **Step 3: Commit**

Run from `/Users/beorlor/Documents/PBW_2026`:
```
git add corlens_v2/docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md
git commit -m "docs(v2): mark caddy gateway milestone complete in spec"
```

---

## Self-review notes

This plan was reviewed against spec sections 7.1 and 12 on 2026-05-08:

- **Spec § 7.1 (Caddyfile sketch):** every route prefix in the spec's Caddyfile sketch is present in Task 1 (`/api/auth/*`, `/api/payment/*`, `/api/corridor*`, `/api/analyze`, `/api/analysis*`, `/api/graph/*`, `/api/safe-path`, `/api/compliance/*`, `/api/chat`, `/api/history*`). Plus `/api/market-data/*` and `/api/ai/*` for the new central services that Step 1 introduced as packages.
- **Spec § 12 step 2 ("Caddyfile with all routes stubbed to a placeholder, TLS in dev via local CA, docker-compose"):** routes stubbed ✓, docker-compose ✓. **TLS in dev is intentionally deferred** — section 13 of the spec already lists "Local TLS for forward_auth" as an open question and dev HTTPS via a local CA adds friction (browser CA trust prompts) for no test value at this stage. Production TLS happens automatically when Caddy serves cor-lens.xyz at cutover.
- **forward_auth (spec § 7.1 auth flow):** intentionally not wired here. The spec says "forward_auth identity:3001 { uri /verify ... }" — that identity service does not exist yet. Adding the directive now would prevent Caddy from starting once any auth-protected route is hit. Step 3 (identity) wires forward_auth as part of shipping `/verify`.
- **Aggregated `/docs` (spec § 11):** stubbed to 503 with `step: 11` — wired for real after services ship their own `/docs/json`.
- **Type / property name consistency:** all stub responses use the same `{"error","service","step"}` shape so a smoke-test script (when one is written later) can parse them uniformly.

No placeholders found in the plan. Every step has runnable commands or exact file content.

---

*End of plan.*
