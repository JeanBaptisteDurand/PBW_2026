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
COPY apps/identity/package.json apps/identity/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/identity apps/identity
RUN pnpm --filter @corlens/db exec prisma generate
RUN pnpm --filter @corlens/contracts run build
RUN pnpm --filter @corlens/db run build
RUN pnpm --filter @corlens/env run build
RUN pnpm --filter @corlens/events run build
RUN pnpm --filter @corlens/clients run build
RUN pnpm --filter @corlens/identity run build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/identity/dist ./apps/identity/dist
COPY --from=build /app/apps/identity/package.json ./apps/identity/
WORKDIR /app/apps/identity
EXPOSE 3001
CMD ["node", "dist/index.js"]
