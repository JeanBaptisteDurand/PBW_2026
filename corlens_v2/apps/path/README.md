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
