# `@corlens/web`

React SPA for Corelens v2. Step 9 of the [build order](../../docs/superpowers/specs/2026-05-08-corlens-v2-architecture-design.md#12-build-order).

## Dev

```bash
docker compose up -d           # bring up the v2 backend
pnpm --filter @corlens/web dev # SPA at http://localhost:5173 (proxies /api → :8080)
```

## Stack

Vite 6 + React 18 + React Router v7 + TanStack Query 5 + Tailwind 3 + ReactFlow 11 + cobe + Three.js + `@crossmarkio/sdk`. Typed API wrappers consume `@corlens/contracts`.

## Layout

```
src/
  api/       per-service typed wrappers (identity / corridor / path / agent)
  auth/      Crossmark SIWE flow + useAuth
  routes/    one file per top-level route (lazy-loaded)
  fragments/ per-route building blocks
  components/ shared UI primitives + feature components
  hooks/     useSSE, useCorridorAtlas, ...
  stores/    Zustand stores (safePathStore)
  lib/       pure helpers
  styles/    tailwind.css entry
```

See [the Phase F plan](../../docs/superpowers/plans/2026-05-15-web-spa.md) for the porting roadmap.
