// Obnova zálohy (fáze 68): `npm run backup:restore -- [--list] [--from local|s3] [--snapshot <název>|latest] --to <prázdná složka> [--files]`.
// Obnovuje VŽDY do nové prázdné složky (vznikne <cíl>/eldock.db a s --files i <cíl>/uploads/…), nikdy přes živá data.
// Výměna dat běžící aplikace je ruční krok podle CLAUDE.md (oddíl 7) a na produkci jen se souhlasem provozovatele.
import "dotenv/config";

import path from "node:path";

import { backupConfig } from "../src/server/backup/config";
import { listLocalSnapshots, restoreBackup, s3ClientFor, SNAPSHOT_PATTERN } from "../src/server/services/backup";

const arg = (name: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
};
const kb = (bytes: number) => `${Math.round(bytes / 1024).toLocaleString("cs-CZ")} kB`;

async function main() {
  const config = backupConfig();
  for (const issue of config.issues) console.warn(`Pozor: ${issue}`);
  const from = arg("from") === "s3" ? "s3" : "local";

  if (process.argv.includes("--list")) {
    const local = await listLocalSnapshots(config.dir);
    console.log(`Místní snímky (${config.dir}):`);
    for (const item of local) console.log(`  ${item.name}  ${kb(item.bytes)}`);
    if (!local.length) console.log("  žádné");
    const s3 = s3ClientFor(config);
    if (s3 && config.s3) {
      const prefix = config.s3.prefix ? `${config.s3.prefix}/` : "";
      const remote = (await s3.list(`${prefix}db/`)).filter((object) => SNAPSHOT_PATTERN.test(object.key.split("/").pop() ?? ""));
      console.log(`Mimo server (${config.s3.endpoint}/${config.s3.bucket}/${prefix}db/):`);
      for (const object of remote.sort((a, b) => (a.key < b.key ? 1 : -1))) console.log(`  ${object.key.split("/").pop()}  ${kb(object.size)}`);
      const files = await s3.list(`${prefix}files/`);
      console.log(`  souborů úložiště: ${files.length} (${kb(files.reduce((sum, object) => sum + object.size, 0))})`);
    }
    return;
  }

  const to = arg("to");
  if (!to) throw new Error("Zadejte cílovou prázdnou složku: --to <složka> (nebo --list pro výpis záloh).");
  const result = await restoreBackup({
    config,
    from,
    snapshot: arg("snapshot") ?? "latest",
    targetDir: to,
    withFiles: process.argv.includes("--files"),
    // Úložiště souborů běžící aplikace; do složky s živou databází obnova nejde už proto, že není prázdná.
    liveDirs: [path.join(process.cwd(), "storage")],
    log: console.log,
  });
  console.log(`Obnoveno ${result.snapshot} → ${result.dbPath} (integrita ok; tabulky ${result.tables}, závody ${result.counts.plants}, zařízení ${result.counts.equipment}, uživatelé ${result.counts.users})${result.files ? `, ${result.files} souborů do ${path.join(path.resolve(to), "uploads")}` : ""}.`);
  console.log("Data běžící aplikace se nezměnila. Výměna je ruční krok (zastavit kontejner, vyměnit soubory, spustit) – viz CLAUDE.md, oddíl 7.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
