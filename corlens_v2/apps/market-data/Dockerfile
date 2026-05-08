FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/db/package.json packages/db/
COPY packages/env/package.json packages/env/
COPY packages/events/package.json packages/events/
COPY packages/clients/package.json packages/clients/
COPY apps/market-data/package.json apps/market-data/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/market-data apps/market-data
RUN pnpm --filter @corlens/db exec prisma generate
RUN pnpm --filter @corlens/contracts run build
RUN pnpm --filter @corlens/db run build
RUN pnpm --filter @corlens/env run build
RUN pnpm --filter @corlens/events run build
RUN pnpm --filter @corlens/market-data run build

FROM base AS runtime
RUN apk add --no-cache wget
ENV NODE_ENV=production
RUN pnpm --version
WORKDIR /app
COPY --from=build /app /app
WORKDIR /app/apps/market-data
EXPOSE 3002
CMD ["node", "dist/index.js"]
