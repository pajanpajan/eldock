// Fáze 66: jednorázové přepočítání lhůt revizí podle NV 190/2022 Sb., příloha č. 4 (`npm run db:fix-intervals`).
// Zkrátí lhůty a platnosti revizí VTZ a LPS, které přesahují nejdelší zákonnou lhůtu (původní platnost zůstane
// v `validUntilOriginal`), a spotřebičům s výchozí lhůtou staré tabulky dá výchozí lhůtu ČSN 33 1600 ed. 2.
// Nic nemaže ani neprodlužuje. Podruhé nic neudělá (značka `migration.phase66-intervals`).
//   --dry-run  jen vypíše, co by se změnilo (nic nezapíše, značku nekontroluje)
//   --force    proběhne i se značkou (např. po ručním doplnění dat)
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { migratePhase66Intervals } from "../src/server/services/inspection-intervals";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

migratePhase66Intervals(prisma, { dryRun, force })
  .then((result) => {
    if (result.skipped) {
      console.log("Lhůty revizí (fáze 66): oprava už proběhla – přeskakuji.");
      return;
    }
    const { capped, appliances } = result;
    const prefix = dryRun ? "[jen výpis] " : "";
    console.log(
      `${prefix}Lhůty revizí (fáze 66): zkontrolováno ${capped.checked} zařízení, zkrácené lhůty VTZ / LPS ${capped.intervals}, ` +
        `zkrácené platnosti revizí ${capped.records}, nové výchozí lhůty spotřebičů ${appliances.length}.`,
    );
    for (const change of capped.changes) {
      console.log(`  ${change.tag} (${change.type}): ${change.interval ? `lhůta ${change.interval.from} → ${change.interval.to} měsíců` : "lhůta beze změny"}, zkrácené platnosti ${change.records}`);
    }
    for (const change of appliances) console.log(`  ${change.tag}: výchozí lhůta ${change.from} → ${change.to} měsíců (ČSN 33 1600 ed. 2)`);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
