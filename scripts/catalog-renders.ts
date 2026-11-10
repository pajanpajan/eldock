// Fáze 80: produktové náhledy klíčových řad ABB jako vlastní vektorové rendery (`npm run catalog:renders`) – zapíše
// `public/catalog-images/abb/<řada>/<barva>-<díl>.svg` a `zdroj.json` podle `series-render.ts` (tvar a barvy z Katalogu
// ABB 2026), založí složky výrobců a přegeneruje manifest náhledů. Bez fotografií výrobce, nic se nestahuje.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { renderPlan } from "../src/lib/panel-builder/series-render";
import { CATALOG_IMAGES_DIR, writeCatalogManifest } from "./catalog-images";

/** Složky výrobců (Schneider, Legrand a Hager zatím bez náhledů – připravené pro soubory se zdrojem). */
export const MAKER_DIRS = ["abb", "schneider", "legrand", "hager"];

async function main() {
  for (const maker of MAKER_DIRS) {
    await mkdir(path.join(CATALOG_IMAGES_DIR, maker), { recursive: true });
    await writeFile(path.join(CATALOG_IMAGES_DIR, maker, ".gitkeep"), "");
  }
  const files = renderPlan();
  for (const file of files) {
    const target = path.join(CATALOG_IMAGES_DIR, file.path);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content);
  }
  console.log(`Rendery: ${files.filter((file) => file.path.endsWith(".svg")).length} souborů SVG v ${path.relative(process.cwd(), CATALOG_IMAGES_DIR)}.`);
  await writeCatalogManifest();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
