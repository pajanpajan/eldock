import "server-only";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "@/generated/prisma/client";

// Jediná instance klienta pro celou aplikaci. V dev režimu ji držíme
// v globalThis, aby HMR nevytvářel při každé změně nové připojení.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Výkonnostní PRAGMA pro produkční provoz SQLite. Adaptér drží jediné spojení, takže stačí je
 * spustit jednou po startu: WAL (čtení neblokuje zápis), synchronous=NORMAL (s WAL bezpečné,
 * výrazně méně fsync), cizí klíče vynucené. `busy_timeout` nastavuje volba `timeout` adaptéru.
 */
export const SQLITE_PRAGMAS = ["PRAGMA journal_mode = WAL", "PRAGMA synchronous = NORMAL", "PRAGMA busy_timeout = 5000", "PRAGMA foreign_keys = ON"] as const;

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Chybí proměnná prostředí DATABASE_URL (viz .env.example).");
  }
  const adapter = new PrismaBetterSqlite3({ url, timeout: 5000 });
  const client = new PrismaClient({ adapter });
  // WAL jen za běhu produkčního serveru. V dev režimu by soubory -wal / -shm v kořeni projektu
  // (mění se při každém dotazu) budily hlídač souborů Turbopacku a stránka by se donekonečna
  // znovu načítala; `next build` (také NODE_ENV=production) nesmí přepnout lokální dev.db.
  const runtime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  const pragmas = runtime ? SQLITE_PRAGMAS : ["PRAGMA journal_mode = DELETE"];
  void (async () => {
    for (const pragma of pragmas) await client.$queryRawUnsafe(pragma);
  })().catch((error) => console.error("[prisma] PRAGMA se nepodařilo nastavit:", error));
  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
