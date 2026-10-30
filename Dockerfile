# syntax=docker/dockerfile:1.7
# =============================================================================
#  Eldock – produkční obraz (Hetzner Cloud i air-gapped server v továrně)
#
#  Fáze:  deps (npm ci) → build (prisma generate + next build, output: standalone)
#         → runner (standalone server + /app/ops pro migrace a seed, neprivilegovaný uživatel)
#  Data:  /app/data/db (SQLite) a /app/storage (nahrané soubory) – svazky v docker-compose.yml
# =============================================================================

ARG NODE_VERSION=22

# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS base
# openssl: Prisma schema engine (migrace) · tini: správné předávání signálů · ca-certificates: TLS
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tini \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    # prisma.config.ts vyžaduje DATABASE_URL i při generování klienta
    DATABASE_URL=file:/tmp/build.db

# ---------------------------------------------------------------------------
FROM base AS deps
# Vrstva závislostí se mění jen se zámkem balíčků nebo schématem – ne s každou migrací či seedem
# (dřív `COPY prisma` znovu spouštělo npm ci při každé nové migraci).
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma.config.ts ./
# postinstall spustí `prisma generate` (stačí mu schéma); better-sqlite3 stáhne binárku pro Linux
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/app/data/db/eldock.db \
    ELDOCK_SEED_DEMO=1

RUN groupadd --system --gid 1001 eldock \
  && useradd --system --uid 1001 --gid eldock --home-dir /app --shell /usr/sbin/nologin eldock

# Aplikace: minimální standalone server (server.js + trasované node_modules) + statické soubory
COPY --from=build --chown=eldock:eldock /app/.next/standalone ./
COPY --from=build --chown=eldock:eldock /app/.next/static ./.next/static
COPY --from=build --chown=eldock:eldock /app/public ./public

# Provozní nástroje (jen pro entrypoint): Prisma CLI s migracemi a seed demo dat (tsx).
# Odděleně od běžící aplikace; seed zapisuje do /app/storage přes odkaz ops/storage.
COPY --from=build --chown=eldock:eldock /app/node_modules ./ops/node_modules
COPY --from=build --chown=eldock:eldock /app/package.json /app/prisma.config.ts /app/tsconfig.json ./ops/
COPY --from=build --chown=eldock:eldock /app/prisma ./ops/prisma
COPY --from=build --chown=eldock:eldock /app/src ./ops/src
RUN ln -s /app/storage /app/ops/storage \
  && mkdir -p /app/data/db /app/storage/uploads \
  && chown -R eldock:eldock /app/data /app/storage

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Ochrana proti CRLF z Windows checkoutu
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod 755 /usr/local/bin/docker-entrypoint.sh

VOLUME ["/app/data/db", "/app/storage"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/manifest.webmanifest').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Entrypoint startuje jako root jen kvůli oprávnění svazků, pak přejde na uživatele `eldock`.
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "server.js"]
