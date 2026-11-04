// Zdroj externí databáze prvků (fáze 43): složka projektu „ai-panel-builder“ (SQL seedy s JSON záznamy
// `catalog_upsert_product`) nebo lokální export `prisma/external-catalog/catalog.json` (je v Gitu,
// takže ho importuje i produkce bez přístupu ke složce).
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { compactProduct, payloadsFromSql, productKey, type ExternalProduct } from "../src/lib/panel-builder/external-catalog";
import type { ExternalWiringDevice } from "../src/lib/panel-builder/wiring-devices";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SNAPSHOT_DIR = path.join(here, "external-catalog");
export const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "catalog.json");
export const DEFAULT_EXTERNAL_DIR = process.env.ELDOCK_EXTERNAL_CATALOG ?? "C:\\Users\\janou\\Desktop\\Claude\\ai-panel-builder";

const byKey = (products: readonly ExternalProduct[]) => {
  // Pozdější záznam (vyšší číslo seedu) přepíše dřívější se stejným výrobcem + MPN
  const map = new Map<string, ExternalProduct>();
  for (const product of products) map.set(productKey(product.manufacturer, product.mpn), product);
  return [...map.values()].sort((a, b) => productKey(a.manufacturer, a.mpn).localeCompare(productKey(b.manufacturer, b.mpn)));
};

/** Záznamy ze složky externího projektu (`db/*.sql`), null = složka není k dispozici. */
export function readExternalFolder(dir: string): ExternalProduct[] | null {
  const db = path.join(dir, "db");
  if (!existsSync(db)) return null;
  const files = readdirSync(db).filter((name) => name.endsWith(".sql")).sort();
  const products = files.flatMap((name) => payloadsFromSql(readFileSync(path.join(db, name), "utf8")));
  return byKey(products.map((product) => compactProduct(product as ExternalProduct & Record<string, unknown>)));
}

/** Záznamy z lokálního exportu (`prisma/external-catalog/*.json`), null = export neexistuje. */
export function readSnapshot(dir = SNAPSHOT_DIR): ExternalProduct[] | null {
  if (!existsSync(dir)) return null;
  // wiring.json (domovní přístroje, fáze 47) má vlastní formát a čte se přes readWiringSnapshot
  const files = readdirSync(dir).filter((name) => name.endsWith(".json") && name !== path.basename(WIRING_SNAPSHOT)).sort();
  if (!files.length) return null;
  const products = files.flatMap((name) => {
    const value = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as unknown;
    return Array.isArray(value) ? (value as ExternalProduct[]) : [];
  });
  return byKey(products);
}

/** Uloží export (jeden záznam na řádek – čitelný diff v Gitu). */
export function writeSnapshot(products: readonly ExternalProduct[]) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_FILE, `[\n${products.map((product) => JSON.stringify(product)).join(",\n")}\n]\n`);
}

export const WIRING_SNAPSHOT = path.join(SNAPSHOT_DIR, "wiring.json");

/** Domovní přístroje ze složky externího projektu (`catalog/wiring/<značka>/facts.json`), null = složka chybí. */
export function readWiringFolder(dir: string): ExternalWiringDevice[] | null {
  const root = path.join(dir, "catalog", "wiring");
  if (!existsSync(root)) return null;
  const rows = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, "facts.json")))
    .flatMap((entry) => JSON.parse(readFileSync(path.join(root, entry.name, "facts.json"), "utf8")) as ExternalWiringDevice[]);
  // Kompaktní záznam (bez dokumentů a odvozených polí), řazený podle značky a čísla
  return rows
    .map(({ brand, article, ean, title, series, category, product_url, features, in_a, width_mm, height_mm, depth_mm }) => ({ brand, article, ean, title, series, category, product_url, features, in_a, width_mm, height_mm, depth_mm }))
    .sort((a, b) => `${a.brand}:${a.article}`.localeCompare(`${b.brand}:${b.article}`));
}

export function readWiringSnapshot(): ExternalWiringDevice[] | null {
  if (!existsSync(WIRING_SNAPSHOT)) return null;
  const value = JSON.parse(readFileSync(WIRING_SNAPSHOT, "utf8")) as unknown;
  return Array.isArray(value) ? (value as ExternalWiringDevice[]) : null;
}

export function writeWiringSnapshot(rows: readonly ExternalWiringDevice[]) {
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(WIRING_SNAPSHOT, `[\n${rows.map((row) => JSON.stringify(row)).join(",\n")}\n]\n`);
}
