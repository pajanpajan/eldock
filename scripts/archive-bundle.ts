// Sjednocený archiv dokumentace: všechny samostatné soubory `docs/archiv/*.md` zůstávají,
// a navíc se z nich (+ z aktuálního `docs/PLAN.md` s deníkem posledních fází) skládá jeden soubor
// `docs/archiv/ARCHIV-KOMPLET.md` (např. pro rozbor v jiném AI).
// Spuštění: `npm run docs:bundle`. Test `archive-bundle.test.ts` hlídá, že je sjednocený soubor aktuální.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ARCHIVE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "docs", "archiv");
export const BUNDLE_NAME = "ARCHIV-KOMPLET.md";

const normalize = (text: string) => text.replace(/^﻿/, "").replace(/\r\n/g, "\n").trimEnd();

/** Pořadí: specifikace MVP → plán fází 0–35 → zadání fází podle čísla → ostatní abecedně. */
function rank(name: string): [number, number, string] {
  if (name === "SPECIFIKACE-MVP.md") return [0, 0, name];
  if (name.startsWith("PLAN-")) return [1, 0, name];
  const phase = /^ZADANI-faze-(\d+)/.exec(name);
  if (phase) return [2, Number(phase[1]), name];
  return [3, 0, name];
}

export function archiveFiles(dir = ARCHIVE_DIR): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith(".md") && name !== BUNDLE_NAME)
    .sort((a, b) => {
      const [ga, na, sa] = rank(a);
      const [gb, nb, sb] = rank(b);
      return ga - gb || na - nb || sa.localeCompare(sb);
    });
}

/** Aktuální rotující plán (tabulka fází a deník posledních fází) – fáze 48: přidává se na konec. */
export const PLAN_FILE = path.join(ARCHIVE_DIR, "..", "PLAN.md");

export function buildArchiveBundle(dir = ARCHIVE_DIR, planFile: string | null = PLAN_FILE): string {
  const files = archiveFiles(dir);
  const parts = [
    "# ELDOCK – sjednocený archiv dokumentace",
    "",
    `> Generováno skriptem \`npm run docs:bundle\` ze souborů v \`docs/archiv\` a z \`docs/PLAN.md\` – needitujte ručně, upravte jednotlivé soubory a skript spusťte znovu. Aktuální pravidla projektu jsou v \`CLAUDE.md\`.`,
    "",
    "## Obsah",
    "",
    ...files.map((name, index) => `${index + 1}. ${name}`),
    ...(planFile ? [`${files.length + 1}. docs/PLAN.md (aktuální plán a deník posledních fází)`] : []),
  ];
  for (const name of files) {
    parts.push("", "---", "", `# 📄 ${name}`, "", normalize(readFileSync(path.join(dir, name), "utf8")));
  }
  if (planFile) parts.push("", "---", "", "# 📄 docs/PLAN.md", "", normalize(readFileSync(planFile, "utf8")));
  return `${parts.join("\n")}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bundle = buildArchiveBundle();
  writeFileSync(path.join(ARCHIVE_DIR, BUNDLE_NAME), bundle);
  console.log(`docs/archiv/${BUNDLE_NAME}: ${archiveFiles().length} souborů, ${Math.round(bundle.length / 1024)} kB`);
}
