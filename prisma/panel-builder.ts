// Přírůstkový seed AI Panel Builderu bez mazání dat: `npm run db:panel-builder`.
// Spouští ho i `docker-entrypoint.sh` při každém startu (ELDOCK_SEED_DEMO=1) – je idempotentní.
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { seedPanelBuilder } from "./seed-panel-builder";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

// Katalog a vzorový PB-001 vždy (součást produktu), demo firma Tester jen s ELDOCK_SEED_DEMO=1 (výchozí).
seedPanelBuilder(prisma, { demo: process.env.ELDOCK_SEED_DEMO !== "0" })
  .then(({ components, project, tester, enclosures, external, fans, failures }) => {
    // Fáze 54: selhání jednotlivých kroků vypsat a skončit kódem 1 (entrypoint vypíše varování, ostatní kroky doběhly).
    for (const failure of failures) console.error(`AI Panel Builder – krok selhal: ${failure}`);
    if (failures.length) process.exitCode = 1;
    console.log(
      `AI Panel Builder: katalog ${components} prvků aktualizován, vzorový projekt PB-001 ${project ? "založen" : "už existuje"}, firma Tester ${tester.created ? "založena" : "už existuje"}${tester.attached ? ` (přiřazeno projektů: ${tester.attached})` : ""}, skříní ${enclosures + 1}, ventilátorů ${fans}, externí databáze ${!external ? "bez exportu" : external.skipped ? "beze změny" : `+${external.components.created} přístrojů, ${external.enclosures.created + external.enclosures.updated} skříní, ${external.relations} vazeb`}.`,
    );
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
