// Úklid osiřelých souborů v storage/uploads (fáze 48): `npm run storage:cleanup`.
//   --dry-run   jen vypsat, co by se smazalo
// Smaže soubory, na které neodkazuje žádný záznam v databázi, starší než 24 hodin; složky seed/ nikdy.
import "dotenv/config";

import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { cleanupStorage } from "../src/server/services/storage-cleanup";

const dryRun = process.argv.includes("--dry-run");
const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString("cs-CZ")} kB`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
  const root = path.join(process.cwd(), "storage", "uploads");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const report = await cleanupStorage(prisma, root, { dryRun });
    console.log(`Úložiště ${root}: ${report.scanned} souborů, ${report.references} odkazů v databázi.`);
    if (!report.references) return void console.log("Databáze neobsahuje žádný odkaz na soubory – z bezpečnostních důvodů se nic nemaže.");
    const total = report.orphans.reduce((sum, file) => sum + file.bytes, 0);
    for (const orphan of report.orphans) console.log(`  ${dryRun ? "smazalo by se" : "osiřelý"}: ${orphan.url} (${kb(orphan.bytes)})`);
    console.log(dryRun ? `Osiřelých souborů starších 24 h: ${report.orphans.length} (${kb(total)}). Nic se nesmazalo (--dry-run).` : `Smazáno ${report.removed} osiřelých souborů, uvolněno ${kb(report.freedBytes)}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
