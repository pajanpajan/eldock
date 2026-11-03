// Synchronizace externí databáze prvků do katalogu Eldocku: `npm run catalog:sync`.
//   --source <složka>  projekt ai-panel-builder (výchozí ELDOCK_EXTERNAL_CATALOG nebo C:\Users\janou\Desktop\Claude\ai-panel-builder)
//   --force            importovat i nezměněná data (jinak se stejný otisk přeskočí)
//   --no-export        nepřepisovat lokální export prisma/external-catalog/catalog.json
// Bez složky se použije lokální export. Nic nemaže – jen dávkový upsert (bezpečné i na produkci).
import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { importExternalCatalog, seedStandardEnclosures } from "../src/server/services/catalog-sync";
import { DEFAULT_EXTERNAL_DIR, SNAPSHOT_FILE, readExternalFolder, readSnapshot, writeSnapshot } from "../prisma/external-catalog-source";

const args = process.argv.slice(2);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
  const source = option("--source") ?? DEFAULT_EXTERNAL_DIR;

  let products = readExternalFolder(source);
  if (products) {
    console.log(`Externí databáze: ${source} – ${products.length} záznamů.`);
    if (!args.includes("--no-export")) {
      writeSnapshot(products);
      console.log(`Export uložen do ${SNAPSHOT_FILE}.`);
    }
  } else {
    products = readSnapshot();
    if (!products) throw new Error(`Složka ${source} neexistuje a lokální export ${SNAPSHOT_FILE} chybí.`);
    console.log(`Složka ${source} není k dispozici – použit lokální export (${products.length} záznamů).`);
  }

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  try {
    const enclosures = await seedStandardEnclosures(prisma);
    const result = await importExternalCatalog(prisma, products, { force: args.includes("--force") });
    console.log(`Matice standardních rozvodnic: ${enclosures} skříní.`);
    if (result.skipped) return void console.log("Externí katalog je beze změny (stejný otisk) – nic k importu. Použijte --force pro nový import.");
    console.log(
      [
        `Přístroje: ${result.components.created} nových, ${result.components.updated} aktualizovaných, ${result.components.kept} ponecháno z katalogu Eldocku.`,
        `Skříně: ${result.enclosures.created} nových, ${result.enclosures.updated} aktualizovaných.`,
        `Vazby příslušenství: ${result.relations}.`,
        `Přeskočeno (mimo DIN sortiment / bez rozměrů): ${result.skippedProducts.length}.`,
      ].join("\n"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
