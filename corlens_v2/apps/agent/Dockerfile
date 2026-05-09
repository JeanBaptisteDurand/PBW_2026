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
COPY apps/agent/package.json apps/agent/
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY packages packages
COPY apps/agent apps/agent
RUN pnpm --filter @corlens/db exec prisma generate
RUN pnpm --filter @corlens/contracts run build
RUN pnpm --filter @corlens/db run build
RUN pnpm --filter @corlens/env run build
RUN pnpm --filter @corlens/events run build
RUN pnpm --filter @corlens/clients run build
RUN pnpm --filter @corlens/agent run build
RUN pnpm deploy --filter @corlens/agent --prod /deploy
# Copy the generated Prisma engine (created by prisma generate, not in pnpm store)
RUN cp -r /app/node_modules/.pnpm/@prisma+client@6.1.0_prisma@6.1.0/node_modules/.prisma \
         /deploy/node_modules/.pnpm/@prisma+client@6.1.0_prisma@6.1.0/node_modules/

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /deploy ./
WORKDIR /app
EXPOSE 3006
CMD ["node", "dist/index.js"]
