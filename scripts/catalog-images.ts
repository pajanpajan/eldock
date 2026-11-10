// Fáze 78: oficiální náhledy výrobců v `public/catalog-images/<výrobce>/<řada>/` → manifest
// `src/lib/panel-builder/catalog-images.generated.ts` (`npm run catalog:images`).
//   --download   stáhne soubory podle `public/catalog-images/zdroje.json` (jen https, jen obrázky, bez přepsání)
//   --force      s --download přepíše i existující soubory
// Každá složka řady musí mít `zdroj.json` ({ "source": "…", "license": "…" }) – bez něj se fotky do manifestu nedostanou
// (aplikace pod fotkou vypisuje zdroj a podmínky užití). Název souboru: `<barva>-<díl>.<přípona>` (díl switch / socket /
// set, barva = id barvy řady, „rada“ = bez barvy), chytrá domácnost `smart/<id výrobku>.<přípona>`.

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CATALOG_IMAGE_EXTENSIONS, CATALOG_IMAGE_MAX_BYTES, catalogImageEntry, renderCatalogImages, type CatalogImage } from "../src/lib/panel-builder/catalog-images";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CATALOG_IMAGES_DIR = path.join(ROOT_DIR, "public", "catalog-images");
export const CATALOG_IMAGES_OUTPUT = path.join(ROOT_DIR, "src", "lib", "panel-builder", "catalog-images.generated.ts");
const root = CATALOG_IMAGES_DIR;
const download = process.argv.includes("--download");
const force = process.argv.includes("--force");

async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function fetchSources() {
  const list = await readJson(path.join(root, "zdroje.json"));
  if (!Array.isArray(list)) return console.log("  zdroje.json chybí nebo není seznam – nic ke stažení.");
  for (const row of list as { url?: unknown; target?: unknown }[]) {
    if (typeof row.url !== "string" || typeof row.target !== "string" || !row.url.startsWith("https://")) continue;
    const target = path.join(root, row.target);
    if (!target.startsWith(root + path.sep)) continue;
    if (existsSync(target) && !force) {
      console.log(`  ${row.target} ponecháno`);
      continue;
    }
    const response = await fetch(row.url, { headers: { "User-Agent": "EldockCatalogImages/1.0 (https://eldock.cz)" } });
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^image\/(png|jpeg|webp|avif|svg\+xml)/.test(type)) {
      console.log(`  ${row.target}: ${response.status} ${type} – přeskočeno`);
      continue;
    }
    const data = Buffer.from(await response.arrayBuffer());
    if (data.length > CATALOG_IMAGE_MAX_BYTES) {
      console.log(`  ${row.target}: ${Math.round(data.length / 1024)} kB – větší než limit, přeskočeno`);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    console.log(`  ${row.target} staženo (${Math.round(data.length / 1024)} kB)`);
  }
}

export async function scanCatalogImages(): Promise<{ images: CatalogImage[]; skipped: string[] }> {
  const images: CatalogImage[] = [];
  const skipped: string[] = [];
  if (!existsSync(root)) return { images, skipped };
  for (const maker of (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
    for (const series of (await readdir(path.join(root, maker.name), { withFileTypes: true })).filter((entry) => entry.isDirectory())) {
      const dir = path.join(root, maker.name, series.name);
      const license = (await readJson(path.join(dir, "zdroj.json"))) as { source?: unknown; license?: unknown } | null;
      for (const file of (await readdir(dir)).sort()) {
        const extension = path.extname(file).slice(1).toLowerCase();
        if (!CATALOG_IMAGE_EXTENSIONS.includes(extension)) continue;
        const relative = `${maker.name}/${series.name}/${file}`;
        if (typeof license?.source !== "string" || typeof license.license !== "string") {
          skipped.push(`${relative} (chybí zdroj.json se zdrojem a licencí)`);
          continue;
        }
        if ((await stat(path.join(dir, file))).size > CATALOG_IMAGE_MAX_BYTES) {
          skipped.push(`${relative} (větší než ${CATALOG_IMAGE_MAX_BYTES / 1024 / 1024} MB)`);
          continue;
        }
        const entry = catalogImageEntry(maker.name, series.name, file, { source: license.source, license: license.license });
        if (entry) images.push(entry);
        else skipped.push(`${relative} (neznámý výrobce / řada / díl)`);
      }
    }
  }
  return { images, skipped };
}

/** Manifest ze souborů ve složce (sdílí ho `catalog:renders`). */
export async function writeCatalogManifest() {
  const { images, skipped } = await scanCatalogImages();
  await writeFile(CATALOG_IMAGES_OUTPUT, renderCatalogImages(images));
  console.log(`Manifest ${path.relative(process.cwd(), CATALOG_IMAGES_OUTPUT)}: ${images.length} obrázků.`);
  for (const line of skipped) console.log(`  přeskočeno: ${line}`);
}

async function main() {
  if (download) await fetchSources();
  await writeCatalogManifest();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
