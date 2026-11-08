import "server-only";

import type { PrismaClient } from "@/generated/prisma/client";
import { createSqlitePrisma } from "@/lib/sqlite-adapter";

// Jediná instance klienta pro celou aplikaci. V dev režimu ji držíme
// v globalThis, aby HMR nevytvářel při každé změně nové připojení.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaReady: Promise<void> | undefined;
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
  // Transakce a dotazy mimo ně se na jediném spojení střídají ve frontě (sqlite-adapter.ts). Přísný režim
  // (dotaz přes vnější klient uvnitř `$transaction` = chyba) mimo produkci – v dev, testech i E2E.
  const client = createSqlitePrisma({ url, timeout: 5000, strict: process.env.NODE_ENV !== "production" });
  // WAL jen za běhu produkčního serveru. V dev režimu by soubory -wal / -shm v kořeni projektu
  // (mění se při každém dotazu) budily hlídač souborů Turbopacku a stránka by se donekonečna
  // znovu načítala; `next build` (také NODE_ENV=production) nesmí přepnout lokální dev.db.
  const runtime = process.env.NODE_ENV === "production" && process.env.NEXT_PHASE !== "phase-production-build";
  const pragmas = runtime ? SQLITE_PRAGMAS : ["PRAGMA journal_mode = DELETE"];
  const ready = (async () => {
    for (const pragma of pragmas) await client.$queryRawUnsafe(pragma);
  })().catch((error) => console.error("[prisma] PRAGMA se nepodařilo nastavit:", error));
  return { client, ready };
}

function initPrisma() {
  if (globalForPrisma.prisma) return { client: globalForPrisma.prisma, ready: globalForPrisma.prismaReady ?? Promise.resolve() };
  return createPrismaClient();
}

const instance = initPrisma();
export const prisma = instance.client;
/**
 * PRAGMA po startu nastavené (fáze 70). Start serveru na ně počká před první transakcí – `PRAGMA journal_mode` /
 * `foreign_keys` uvnitř transakce nejde změnit a ve frontě spojení by jinak čekaly až za dlouhou úvodní transakcí.
 */
export const prismaReady: Promise<void> = instance.ready;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaReady = prismaReady;
}
