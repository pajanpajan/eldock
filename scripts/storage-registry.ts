// Doplnění registru souborů (fáze 68): `npm run storage:registry`.
//   --dry-run   jen vypsat, co by se zapsalo
// Soubory nahrané před fází 68 dostanou vlastníka podle záznamu, který na ně odkazuje (závod → firma / demo, firma
// Panel Builderu); více vlastníků nebo tabulka bez vlastníka = sdílený soubor. Idempotentní – entrypoint ho pouští
// při každém startu kontejneru před aplikací, podruhé nic nezapíše.
import "dotenv/config";

import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { backfillFileRegistry } from "../src/server/services/file-registry";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
  const root = path.join(process.cwd(), "storage", "uploads");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const report = await backfillFileRegistry(prisma, root, { dryRun });
    const { demo, company, shared } = report.byOwner;
    console.log(`Registr souborů: ${report.scanned} souborů v úložišti, ${report.alreadyRegistered} už v registru.`);
    if (report.registered || report.unreferenced) {
      console.log(`${dryRun ? "Zapsalo by se" : "Zapsáno"} ${report.registered} (firma ${company}, demo ${demo}, sdílené ${shared}); bez odkazu v databázi ${report.unreferenced} (nezapisují se).`);
    }
    if (report.sharedTables.length) console.log(`Sdílené podle tabulek bez vlastníka: ${report.sharedTables.join(", ")}.`);
    if (dryRun) console.log("Nic se nezapsalo (--dry-run).");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
