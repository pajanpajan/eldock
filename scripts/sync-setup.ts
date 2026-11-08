// Žurnál změn pro aplikace (fáze 70): `npm run sync:setup`.
//   --new-epoch   po obnově databáze ze zálohy – aplikace stáhnou vše znovu (jejich kurzory patří ke staré větvi žurnálu)
// Založí chybějící triggery žurnálu (migrace, která tabulku přestaví, je smaže), doplní žurnál o řádky bez záznamu
// a opraví tabulky, kterým triggery chyběly. Idempotentní – entrypoint ho pouští při každém startu kontejneru hned po
// migracích (aplikace totéž ověří i při svém startu).
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { rotateSyncEpoch } from "../src/server/services/sync";
import { ensureSyncTriggers } from "../src/server/sync/journal";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const report = await ensureSyncTriggers(prisma);
    const parts = [
      report.created.length ? `založeno triggerů ${report.created.length}` : "triggery v pořádku",
      report.dropped.length ? `smazáno starých ${report.dropped.length}` : null,
      report.backfilled ? `doplněno do žurnálu ${report.backfilled} záznamů` : null,
      report.rescoped ? `doplněn rozsah ${report.rescoped} záznamů` : null,
      report.repaired.length ? `přežurnálováno: ${report.repaired.join(", ")}` : null,
    ].filter(Boolean);
    console.log(`Žurnál změn pro aplikace: ${parts.join(", ")}.`);
    if (process.argv.includes("--new-epoch")) console.log(`Nová epocha žurnálu ${await rotateSyncEpoch(prisma)} – aplikace stáhnou data znovu.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
