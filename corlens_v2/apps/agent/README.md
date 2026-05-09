# @corlens/agent

Safe Path orchestrator. Composes corridor + path + market-data + ai-service into a multi-phase pipeline. Streams SSE events. Persists each run.

## Endpoints (behind Caddy at `/api/safe-path*`, `/api/compliance/*`, `/api/chat`)

- `POST /api/safe-path` — run the agent (SSE stream of phase events)
- `GET  /api/safe-path` — list user's past runs
- `GET  /api/safe-path/:id` — single run detail
- `GET  /api/compliance/:id` — compliance report markdown
- `POST /api/chat` — RAG chat (proxies to path:3005 if `analysisId` in body, else corridor-level chat)
- `GET  /health`, `GET /docs`

## Dev

```bash
pnpm --filter @corlens/agent dev
```

Listens on port 3006.
