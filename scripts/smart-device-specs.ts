// Fáze 65: výtah technických údajů přístrojů chytré domácnosti z katalogu výrobců pro technický list v 2D půdorysu.
// Spuštění: `npm run catalog:smart-specs` (po `npm run catalog:sync`). Výstup: src/lib/panel-builder/smart-device-specs.generated.ts

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PRODUCT_FAMILIES } from "../src/lib/panel-builder/smart-catalog";
import { extractSpecs, type CatalogEntry } from "../src/lib/panel-builder/smart-device-specs";
import { variantCatalogLinks } from "../src/lib/panel-builder/smart-panels";

export const CATALOG_FILE = path.join(process.cwd(), "prisma", "external-catalog", "catalog.json");
export const OUTPUT_FILE = path.join(process.cwd(), "src", "lib", "panel-builder", "smart-device-specs.generated.ts");

export function readCatalog(file = CATALOG_FILE): CatalogEntry[] {
  const data = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (Array.isArray(data)) return data as CatalogEntry[];
  const list = Object.values(data as Record<string, unknown>).find(Array.isArray);
  return (list ?? []) as CatalogEntry[];
}

/** Odkazy výrobků obrázkového katalogu na záznamy katalogu výrobců (fáze 81 i barevné varianty panelů). */
export const productLinks = () => PRODUCT_FAMILIES.flatMap((family) => family.groups.flatMap((group) => group.products.flatMap((product) => [...(product.catalog ? [product.catalog] : []), ...variantCatalogLinks(product)])));

export function renderSpecs(catalog: readonly CatalogEntry[]): string {
  const specs = extractSpecs(catalog, productLinks());
  return [
    "// Generováno skriptem scripts/smart-device-specs.ts z prisma/external-catalog/catalog.json – neupravujte ručně",
    "// (npm run catalog:smart-specs). Technické údaje přístrojů chytré domácnosti pro technický list (fáze 65).",
    "",
    'import type { DeviceSpec } from "./smart-device-specs";',
    "",
    `export const SMART_DEVICE_SPECS: Record<string, DeviceSpec> = ${JSON.stringify(specs, null, 2)};`,
    "",
  ].join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const catalog = readCatalog();
  writeFileSync(OUTPUT_FILE, renderSpecs(catalog));
  console.log(`${path.relative(process.cwd(), OUTPUT_FILE)}: ${Object.keys(extractSpecs(catalog, productLinks())).length} přístrojů`);
}
