#!/bin/sh
# Eldock – start kontejneru:
#   1. (root) připraví svazky /app/data/db a /app/storage pro uživatele `eldock` a přejde na něj
#   2. aplikuje Prisma migrace (`prisma migrate deploy`) – bezpečné při každém startu
#   3. je-li databáze prázdná a ELDOCK_SEED_DEMO=1, naplní ji demo daty (`npm run db:seed`),
#      jinak jen doplní chybějící demo zařízení s PDF projekty (`npm run db:demo-docs`) a katalog
#      AI Panel Builderu se vzorovým rozváděčem PB-001 (`npm run db:panel-builder`)
#   4. spustí aplikaci (CMD, výchozí `node server.js`)
set -eu

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data/db /app/storage/uploads
  chown -R eldock:eldock /app/data /app/storage
  exec setpriv --reuid=eldock --regid=eldock --init-groups "$0" "$@"
fi

DB_FILE="${DATABASE_URL#file:}"
echo "[eldock] Databáze: ${DB_FILE}"

cd /app/ops
echo "[eldock] Aplikuji migrace (prisma migrate deploy)…"
node node_modules/prisma/build/index.js migrate deploy

# Prázdná databáze = žádný závod
PLANTS="$(node -e '
  const Database = require("better-sqlite3");
  // Ne readonly: databáze v režimu WAL potřebuje k otevření i soubor -shm.
  const db = new Database(process.argv[1], { fileMustExist: true });
  console.log(db.prepare("SELECT COUNT(*) AS c FROM \"Plant\"").get().c);
' "$DB_FILE")"

if [ "$PLANTS" = "0" ]; then
  if [ "${ELDOCK_SEED_DEMO:-1}" = "1" ]; then
    echo "[eldock] Databáze je prázdná – plním demo daty (npm run db:seed)…"
    npm run db:seed --silent
  else
    echo "[eldock] Databáze je prázdná, ELDOCK_SEED_DEMO=0 – demo data se nenahrávají."
  fi
else
  echo "[eldock] Databáze obsahuje ${PLANTS} závod(y) – seed se přeskakuje."
  # Nová demo zařízení s reálnými PDF doplní i do existující databáze (nic nemaže ani nepřepisuje).
  if [ "${ELDOCK_SEED_DEMO:-1}" = "1" ]; then
    npm run db:demo-docs --silent || echo "[eldock] Varování: doplnění demo dokumentace PDF selhalo."
    npm run db:panel-builder --silent || echo "[eldock] Varování: doplnění katalogu AI Panel Builderu selhalo."
  fi
fi

cd /app
echo "[eldock] Startuji aplikaci na portu ${PORT:-3000}…"
exec "$@"
