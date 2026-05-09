# @corlens/corridor

2,436-corridor catalog, scanner, RAG. Owns the `corridor` Postgres schema. Calls market-data for XRPL data and ai-service for embeddings + completions.

## Endpoints (behind Caddy at `/api/corridors/*`)

- `GET /api/corridors` — list (filter: tier, status, currency)
- `GET /api/corridors/:id` — full detail
- `GET /api/corridors/:id/status-history?days=30`
- `POST /api/corridors/chat` — RAG chat
- `GET /api/corridors/partner-depth/:actor/:book` — proxy to market-data
- `POST /admin/scan/:id` — manually trigger one corridor scan
- `POST /admin/refresh-all` — manually trigger refresh of every corridor
- `GET /health`, `GET /docs`

## Dev

```bash
pnpm --filter @corlens/corridor dev
```

Listens on port 3004.
