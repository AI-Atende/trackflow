# syntax=docker/dockerfile:1

# ==========================================
# base — Node 24 LTS (padrão do ecossistema)
# ==========================================
FROM node:24-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ==========================================
# deps — todas as dependências (para o build)
# ==========================================
FROM base AS deps
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ==========================================
# build — prisma generate + next build (standalone)
# ==========================================
FROM deps AS build
COPY . .
# O prisma.config.ts exige DATABASE_URL só para carregar; o generate não conecta no banco.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# ==========================================
# migrate-tools — Prisma CLI isolado para o job de migração
# (não entra no node_modules do app; versão exata do package-lock.json)
# ==========================================
FROM base AS migrate-tools
WORKDIR /migrate
COPY package-lock.json /tmp/package-lock.json
RUN --mount=type=cache,target=/root/.npm \
    PRISMA_VERSION=$(node -p "require('/tmp/package-lock.json').packages['node_modules/prisma'].version") && \
    DOTENV_VERSION=$(node -p "require('/tmp/package-lock.json').packages['node_modules/dotenv'].version") && \
    npm init -y > /dev/null && \
    npm install --omit=dev --no-audit --no-fund "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}"

# ==========================================
# runtime — só o servidor standalone + ferramentas de migração
# ==========================================
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    # Sem isso o server.js do standalone escuta só no hostname do container.
    HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Job de migração: `docker compose run --rm migrate` (ver docker-compose.yml).
COPY --from=migrate-tools --chown=node:node /migrate /migrate
COPY --chown=node:node prisma /migrate/prisma
COPY --chown=node:node prisma.config.ts /migrate/prisma.config.ts

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health > /dev/null || exit 1

CMD ["node", "server.js"]
