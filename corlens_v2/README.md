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
