// Ruční záloha (fáze 68): `npm run backup` – snímek databáze, místní rotace a (s nastaveným úložištěm a klíčem)
// šifrovaně mimo server. Na produkci: `docker exec -u eldock eldock-app sh -c 'cd /app/ops && npm run backup'`.
// Nastavení stejné jako plánovač aplikace (ELDOCK_BACKUP_*), výsledek uvidí i velín (Zálohy a data).
import "dotenv/config";

import path from "node:path";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { backupConfig } from "../src/server/backup/config";
import { parseBackupSummary, runBackup } from "../src/server/services/backup";
import { loadPlatformSettings } from "../src/server/services/platform-settings";
import { runRetention } from "../src/server/services/retention";

const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString("cs-CZ")} kB`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Chybí DATABASE_URL (viz .env.example).");
  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
  // Fáze 113: úložiště záloh a heslo šifrování z velínu (⚙️ SMTP & Cloud zálohy), když je nedává prostředí
  await loadPlatformSettings(prisma);
  const config = backupConfig();
  for (const issue of config.issues) console.warn(`Pozor: ${issue}`);
  try {
    const run = await runBackup({ prisma, config, storageRoot: path.join(process.cwd(), "storage", "uploads"), log: console.error }, "CLI");
    const summary = parseBackupSummary(run.summaryJson);
    if (run.status === "FAILED" || !summary) throw new Error(run.error ?? "Záloha selhala.");
    const { snapshot, offsite } = summary;
    console.log(`Záloha ${run.status}: ${snapshot.name} (databáze ${kb(snapshot.dbBytes)} → ${kb(snapshot.archiveBytes)}${snapshot.encrypted ? ", šifrováno" : ", NEšifrováno"}), integrita ok (závody ${snapshot.counts.plants}, zařízení ${snapshot.counts.equipment}, soubory v registru ${snapshot.counts.files}).`);
    console.log(`Místní snímky v ${summary.local.dir}: ponecháno ${summary.local.kept}, smazáno ${summary.local.removed}.`);
    if (offsite) {
      console.log(`Mimo server: snímek nahrán, soubory nové ${offsite.filesUploaded} / beze změny ${offsite.filesSkipped} / čeká ${offsite.filesPending}, smazané ze zálohy ${offsite.filesDeleted}, starší snímky smazány ${offsite.dbDeleted} (${kb(offsite.bytesUploaded)} nahráno).`);
      for (const error of offsite.errors) console.warn(`  chyba: ${error}`);
    } else if (summary.offsiteSkipped) {
      console.log(`Mimo server: ${summary.offsiteSkipped}`);
    }
    const retention = await runRetention(prisma, "CLI");
    console.log(`Retence: ${retention.summaryJson ?? retention.error}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
