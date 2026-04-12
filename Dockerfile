# ─── Stage 1: Base with pnpm ─────────────────────────────────
FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ─── Stage 2: Install dependencies ──────────────────────────
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
RUN pnpm install --frozen-lockfile

# ─── Stage 3: Build everything ───────────────────────────────
FROM deps AS build
COPY . .
# Generate Prisma client
RUN pnpm --filter @xrplens/server exec prisma generate
# Build shared core package first
RUN pnpm --filter @xrplens/core run build 2>/dev/null || true
# Build server
RUN pnpm --filter @xrplens/server run build
# Build web (static files)
RUN pnpm --filter @xrplens/web run build

# ─── Stage 4: Production server ──────────────────────────────
FROM base AS server
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=build /app/packages/core ./packages/core
COPY --from=build /app/apps/server/dist ./apps/server/dist
COPY --from=build /app/apps/server/prisma ./apps/server/prisma
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/package.json ./
COPY --from=build /app/pnpm-workspace.yaml ./
# Re-generate Prisma client in production image
RUN cd apps/server && npx prisma generate
WORKDIR /app/apps/server
EXPOSE 3001
CMD ["node", "dist/index.js"]

# ─── Stage 5: Production web (nginx) ────────────────────────
FROM nginx:alpine AS web
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
