# @corlens/ai-service

The single owner of LLM calls in v2 — completions, embeddings, and web search. Every prompt is audited (PromptLog) for cost analysis and debugging.

## Endpoints (behind Caddy at `/api/ai/*`)

- `POST /completion` — chat completion via OpenAI
- `POST /embedding` — vector embedding via OpenAI
- `POST /web-search` — real web search via Tavily (replaces v1's hallucinating GPT webSearch)
- `GET /usage` — per-purpose rollup of tokens & cost for the current month
- `GET /health`
- `GET /docs`

## Dev

```bash
pnpm --filter @corlens/ai-service dev
```

Listens on port 3003.
