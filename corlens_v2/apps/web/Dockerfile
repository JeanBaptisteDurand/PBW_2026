FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json biome.json ./
COPY packages/contracts/package.json packages/contracts/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile --filter @corlens/web... --filter @corlens/contracts

FROM deps AS build
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN pnpm --filter @corlens/contracts run build
RUN pnpm --filter @corlens/web run build
RUN test -f apps/web/dist/index.html

FROM nginx:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
