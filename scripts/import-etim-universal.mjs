// Fáze 105: univerzální import balíčků výrobců ze složky „ETIM data“ (`npm run catalog:universal`).
//
// Projde všechny soubory ve složce (výchozí `ETIM data/` v kořeni repozitáře, jinak `--dir=…`) a rozpozná je podle obsahu:
//   – BMEcat ETIM (XML i v ZIPu): výrobce z hlavičky (SUPPLIER_NAME), objednací číslo (SUPPLIER_PID), typové označení
//     (MANUFACTURER_TYPE_DESCR), EAN (INTERNATIONAL_PID gtin, jinak 13místné SUPPLIER_ALT_PID), rozměry V × Š × H
//     (EF000040 / EF000008 / EF000049), vestavná hloubka (EF000218), ztrátový výkon Pv (EF005387), ceníková cena
//     (PRODUCT_PRICE > 0 v CZK / CSK) a fotky přibalené v ZIPu (JPG / PNG → WebP 400 × 400, celý výrobek v bílém poli);
//   – ceníkový katalog Schrack (`productcatalog.xml`): ceníkové ceny (ListPrice za PriceUnit – nikdy zákaznická
//     DiscountPrice) – pro Eldock ceny instalačních kabelů, vodičů a sběrnicových kabelů za metr;
//   – tabulky XLSX / CSV bez sloupce ceny (balení, logistika) a kreslicí data (DXF / DWG / PDF / STEP / IGES) se přeskočí.
// Výstupy:
//   – `src/lib/quoting/list-prices.generated.ts` (server-only): ceníkové ceny kabelů podle označení Eldocku (Kč / m)
//     a výrobků podle objednacího čísla katalogu (Kč / ks) se zdrojem;
//   – `src/lib/panel-builder/etim-universal.generated.ts` (server-only, seed): EAN, rozměry, hloubka, Pv a ceníková cena
//     ke kusům katalogu AI Panel Builderu (`applyEtimComponents` → `CatalogComponent`);
//   – fotky DIN přístrojů do `public/catalog-images/<výrobce>/devices/` + `manifest.json` + `device-photos.generated.ts`,
//     pak se přegeneruje index fotek (`catalog:images`) – po importu spusťte `npm run catalog:public`.
// Na konci vypíše tabulku: balíčky, výrobky, ceny, fotky a spárované položky katalogu.
//
//   --dir="ETIM data"   složka s balíčky      --no-photos   jen data      --force   přepíše i existující fotky
//
// Spuštění: `node scripts/import-etim-universal.mjs` (sám se spustí přes tsx s podmínkou react-server – importuje
// `server-only` moduly aplikace).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(SCRIPT), "..");

if (process.env.ELDOCK_UNIVERSAL_TSX !== "1") {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsx, "--conditions=react-server", SCRIPT, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ELDOCK_UNIVERSAL_TSX: "1" } });
  process.exit(result.status ?? 1);
}

const { productBlocks, zipEntries, zipEntryStream } = await import("./lib/etim-zip.mjs");
const { ETIM_UNITS, featureNumber, normalizeMpn, parseEtimProduct } = await import("../src/lib/catalog/etim.ts");
const { validGtin } = await import("../src/lib/catalog/manufacturer-data.ts");
const { parsePhotoManifest, parseProductPhotos, renderPhotoManifest, upsertProductPhoto } = await import("../src/lib/panel-builder/catalog-photos.ts");
const { catalogSlug } = await import("../src/lib/panel-builder/catalog-images.ts");
const { DEVICE_PHOTO_SOURCES, DEVICE_PHOTOS } = await import("../src/lib/panel-builder/device-photos.generated.ts");
const { ABB_CZ_COMPONENTS } = await import("../prisma/seed-abb-cz.ts");
const { ABB_2026_COMPONENTS } = await import("../prisma/seed-abb-2026.ts");
const { GENERATED_CATALOG } = await import("../prisma/seed-catalog-generated.ts");
const { writeCatalogManifest } = await import("./catalog-images.ts");
const { PRICED_CABLES, cableKey, cablePriceKey } = await import("../src/lib/quoting/cable-designations.ts");

const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const DIR = path.resolve(ROOT, value("dir") ?? "ETIM data");
const noPhotos = flag("no-photos");
const force = flag("force");

const IMAGES = path.join(ROOT, "public", "catalog-images");
const MANIFEST = path.join(IMAGES, "manifest.json");
const DEVICE_PHOTOS_FILE = path.join(ROOT, "src", "lib", "panel-builder", "device-photos.generated.ts");
const PRICES_FILE = path.join(ROOT, "src", "lib", "quoting", "list-prices.generated.ts");
const SEED_FILE = path.join(ROOT, "src", "lib", "panel-builder", "etim-universal.generated.ts");
const TODAY = new Date().toISOString().slice(0, 10);
const PHOTO_PX = 400;
const LICENSE = (label) => `fotka výrobce ${label} – užití v Eldocku (i ve veřejném repozitáři) zadal provozovatel 2026-11-12 (fáze 105)`;

/** Výrobci podle hlavičky BMEcat (SUPPLIER_NAME) – složka fotek a popisek. */
const MAKERS = [
  { pattern: /\bOEZ\b/i, brand: "OEZ", maker: "oez" },
  { pattern: /\bHager\b/i, brand: "Hager", maker: "hager" },
  { pattern: /\bABB\b/i, brand: "ABB", maker: "abb" },
  { pattern: /\bSchneider\b/i, brand: "Schneider", maker: "schneider" },
  { pattern: /\bEaton\b/i, brand: "Eaton", maker: "eaton" },
];

const stats = { packages: [], skipped: [], photos: { added: 0, kept: 0, missing: 0 }, prices: 0, seed: 0 };

// ---------------------------------------------------------------------------------------------------------------------
//  Cíle – kusy katalogu AI Panel Builderu podle výrobce (objednací číslo = typové označení u OEZ, číslo ABB u ABB)
// ---------------------------------------------------------------------------------------------------------------------

const CATALOG = [...ABB_CZ_COMPONENTS, ...ABB_2026_COMPONENTS, ...GENERATED_CATALOG].filter((row) => row.articleNumber);
const targetsOf = (brand) => {
  const map = new Map();
  for (const row of CATALOG) if (String(row.manufacturer).toLowerCase() === brand.toLowerCase()) map.set(normalizeMpn(row.articleNumber), row);
  return map;
};

// ---------------------------------------------------------------------------------------------------------------------
//  Čtení balíčků
// ---------------------------------------------------------------------------------------------------------------------

/** Začátek XML (pro rozpoznání formátu) z položky ZIPu nebo ze souboru. */
async function head(source, bytes = 4096) {
  let text = "";
  for await (const chunk of source) {
    text += Buffer.from(chunk).toString("utf8");
    if (text.length >= bytes) break;
  }
  return text.slice(0, bytes);
}

/** Bloky `<tag …>…</tag>` proudem (jeden výrobek v paměti). */
async function* blocks(chunks, open, close) {
  let buffer = "";
  const decoder = new TextDecoder("utf-8");
  for await (const chunk of chunks) {
    buffer += decoder.decode(chunk, { stream: true });
    let end;
    while ((end = buffer.indexOf(close)) >= 0) {
      const start = buffer.lastIndexOf(open, end);
      if (start >= 0) yield buffer.slice(start, end + close.length);
      buffer = buffer.slice(end + close.length);
    }
    if (buffer.length > 4_000_000 && buffer.indexOf(open) < 0) buffer = buffer.slice(-1000);
  }
}

const text = (block, name) => {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`).exec(block);
  return match ? match[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim() : null;
};

/** Ceníková cena BMEcat (net_list / nrp) v CZK; 0 nebo jiná měna = bez ceny. */
function bmecatPrice(block) {
  for (const match of block.matchAll(/<PRODUCT_PRICE price_type="([^"]+)">([\s\S]*?)<\/PRODUCT_PRICE>/g)) {
    const amount = Number((text(match[2], "PRICE_AMOUNT") ?? "").replace(",", "."));
    const currency = (text(match[2], "PRICE_CURRENCY") ?? "CZK").toUpperCase();
    if (amount > 0 && (currency === "CZK" || currency === "CSK") && /list|nrp|gros/i.test(match[1])) return Math.round(amount * 100) / 100;
  }
  return null;
}

/** BMEcat ETIM: výrobky spárované s katalogem Eldocku + přibalené fotky. */
async function readBmecat(file, entry, entries, label) {
  const header = await head(entry ? zipEntryStream(file, entry) : (await import("node:fs")).createReadStream(file), 8000);
  const supplier = /<SUPPLIER_NAME>([^<]*)</.exec(header)?.[1] ?? "";
  const maker = MAKERS.find((candidate) => candidate.pattern.test(supplier));
  if (!maker) {
    stats.skipped.push(`${label}: BMEcat výrobce „${supplier || "?"}“ – v katalogu Eldocku nejsou jeho přístroje`);
    return;
  }
  const catalogName = /<CATALOG_NAME>([^<]*)</.exec(header)?.[1] ?? label;
  const version = /<REFERENCE_FEATURE_SYSTEM_NAME>([^<]*)</.exec(header)?.[1] ?? /ETIM[- ]?(\d+)/i.exec(label)?.[0] ?? "ETIM";
  // Fotky v ZIPu: „154853_LMF-6B-1N-030A.JPG“ → typové označení za číslem souboru
  const images = new Map();
  for (const item of entries ?? []) {
    const base = item.name.split("/").pop() ?? "";
    if (!/\.(jpe?g|png)$/i.test(base)) continue;
    const stem = base.replace(/\.(jpe?g|png)$/i, "").replace(/^\d+_/, "");
    for (const candidate of [stem, stem.replace(/^[A-Z]+_(?:[A-Z]+_)?/, "")]) {
      const key = normalizeMpn(candidate);
      if (!images.has(key)) images.set(key, item);
    }
  }
  const source = `${maker.brand} – oficiální data BMEcat ${version.replace("-", " ")} (${catalogName}${images.size ? ", fotky v balíčku" : ""})`;
  const targets = targetsOf(maker.brand);
  let count = 0;
  let matched = 0;
  const chunks = entry ? zipEntryStream(file, entry) : (await import("node:fs")).createReadStream(file);
  for await (const block of productBlocks(chunks)) {
    const product = parseEtimProduct(block);
    if (!product) continue;
    count++;
    const keys = [product.typeCode, product.pid, product.pid.replace(/^[A-Z]+:/, "")].filter(Boolean).map((key) => normalizeMpn(key));
    const target = keys.map((key) => targets.get(key)).find(Boolean);
    if (!target) continue;
    matched++;
    const alt = text(block, "SUPPLIER_ALT_PID");
    const ean = validGtin(product.gtin) ? product.gtin : alt && /^\d{13}$/.test(alt) && validGtin(alt) ? alt : null;
    const mm = (name) => featureNumber(product, name, ETIM_UNITS.mm);
    const data = {
      ...(ean ? { ean } : {}),
      ...(mm("EF000040") ? { heightMm: mm("EF000040") } : {}),
      ...(mm("EF000008") ? { widthMm: mm("EF000008") } : {}),
      ...(mm("EF000218") ?? mm("EF000049") ? { depthMm: mm("EF000218") ?? mm("EF000049") } : {}),
      ...(featureNumber(product, "EF005387") ? { powerLossWatts: featureNumber(product, "EF005387") } : {}),
    };
    const price = bmecatPrice(block);
    if (price) {
      data.listPriceCzk = price;
      data.listPriceSource = source;
      prices.set(`item:${normalizeMpn(target.articleNumber)}`, { price, source, unit: "ks" });
    }
    if (Object.keys(data).length) seed.set(target.articleNumber, { ...(seed.get(target.articleNumber) ?? {}), ...data, source });
    const image = keys.map((key) => images.get(key)).find(Boolean);
    if (image) photoJobs.push({ file, entry: image, brand: maker.brand, maker: maker.maker, articleNumber: target.articleNumber, source, gtin: ean });
  }
  stats.packages.push({ name: label, kind: `BMEcat ${version}`, brand: maker.brand, products: count, matched, photos: images.size });
}

/** Kabel podle textu katalogu („Kabel CYKY-J 3 x 1,5 mm²“, „Instalační kabel J-Y(ST)Y 2x2x0,8“) → klíč Eldocku. */
const PACKAGING = /kruh|buben|cívk|civk|role|balen/i;

/** Ceníkový katalog Schrack: ceny kabelů a vodičů za metr podle označení Eldocku. */
async function readSchrack(file, entry, label) {
  const wanted = new Map(PRICED_CABLES.map((cable) => [cablePriceKey(cable), cable]));
  const best = new Map();
  let count = 0;
  const chunks = entry ? zipEntryStream(file, entry) : (await import("node:fs")).createReadStream(file);
  for await (const block of blocks(chunks, "<Product ", "</Product>")) {
    count++;
    const name = text(block, "Text") ?? "";
    const key = cableKey(name);
    if (!key || !wanted.has(key)) continue;
    const list = Number(text(block, "ListPrice") ?? 0);
    const unit = Math.max(1, Number(text(block, "PriceUnit") ?? 1));
    if (!(list > 0) || (text(block, "QuantityUnit") ?? "m") !== "m") continue;
    const assortment = text(block, "Assortment") ?? "";
    if (assortment === "nichtsort") continue;
    const perMetre = Math.round((list / unit) * 100) / 100;
    // Přednost: běžná položka (bez balení na bubnu / v kruhu), sklad Schrack, pak nejnižší cena
    const rank = (PACKAGING.test(name) ? 2 : 0) + (assortment === "lzl" || assortment === "abhol" ? 0 : 1);
    const own = best.get(key);
    if (!own || rank < own.rank || (rank === own.rank && perMetre < own.price)) best.set(key, { price: perMetre, rank, id: /<Product ID="([^"]+)"/.exec(block)?.[1] ?? "", name });
  }
  const source = `Schrack Technik – ceník (${label}, ceníková cena za m bez DPH)`;
  for (const [key, entryBest] of best) prices.set(`cable:${key}`, { price: entryBest.price, source, unit: "m" });
  stats.packages.push({ name: label, kind: "ceník Schrack (productcatalog)", brand: "Schrack", products: count, matched: best.size, photos: 0 });
}

// ---------------------------------------------------------------------------------------------------------------------
//  Fotky
// ---------------------------------------------------------------------------------------------------------------------

const prices = new Map();
const seed = new Map();
const photoJobs = [];

async function savePhotos(products) {
  const devicePhotos = { ...DEVICE_PHOTOS };
  const sources = [...DEVICE_PHOTO_SOURCES];
  let list = products;
  for (const job of photoJobs) {
    const slug = catalogSlug(job.articleNumber);
    const relative = `${job.maker}/devices/${slug}.webp`;
    const target = path.join(IMAGES, ...relative.split("/"));
    // Fotka z dřívějšího importu (ABB ETIM 9.0, stránky výrobce) zůstává, pokud není --force
    if (!force && (devicePhotos[slug] || existsSync(target))) {
      stats.photos.kept++;
      continue;
    }
    const chunks = [];
    for await (const chunk of zipEntryStream(job.file, job.entry)) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    if (bytes.length < 1500) {
      stats.photos.missing++;
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await sharp(bytes).flatten({ background: "#ffffff" }).resize(PHOTO_PX, PHOTO_PX, { fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toFile(target);
    if (!sources.includes(job.source)) sources.push(job.source);
    devicePhotos[slug] = [`/catalog-images/${relative}`, sources.indexOf(job.source)];
    list = upsertProductPhoto(list, { kind: "device", brand: job.brand, mpn: job.articleNumber, file: relative, source: job.source, license: LICENSE(job.brand), retrievedAt: TODAY, ...(job.gtin ? { gtin: job.gtin } : {}) });
    stats.photos.added++;
  }
  return { list, devicePhotos, sources };
}

function renderDevicePhotos(map, sources) {
  const ordered = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  return [
    "// Generuje `node scripts/parse-etim-packages.mjs` z dat výrobců v data/etim/downloads (fáze 97) a doplňuje",
    "// `node scripts/import-etim-universal.mjs` z balíčků ve složce „ETIM data“ (fáze 105) – needitujte ručně.",
    "// Fotky DIN přístrojů podle objednacího čísla katalogu (slug) – jen pro serverové stránky (katalog AI Panel Builderu),",
    "// do klientského balíčku nepatří. Hodnota = [cesta v public/, index zdroje v DEVICE_PHOTO_SOURCES].",
    "",
    `export const DEVICE_PHOTO_SOURCES: readonly string[] = ${JSON.stringify(sources, null, 2)};`,
    "",
    `export const DEVICE_PHOTOS: Readonly<Record<string, readonly [string, number]>> = ${JSON.stringify(ordered, null, 1)};`,
    "",
  ].join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------
//  Výstupy
// ---------------------------------------------------------------------------------------------------------------------

function renderPrices() {
  const sources = [...new Set([...prices.values()].map((entry) => entry.source))].sort();
  const map = Object.fromEntries([...prices.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, [entry.price, sources.indexOf(entry.source)]]));
  return [
    "// Generuje `node scripts/import-etim-universal.mjs` z balíčků ve složce „ETIM data“ (fáze 105) – needitujte ručně.",
    "// Ceníkové ceny výrobců bez DPH (bez individuálního rabatu) jako základ cenové nabídky: klíč `cable:<označení>` = Kč / m",
    "// (kabely a vodiče podle označení Eldocku), `item:<objednací číslo>` = Kč / ks. Hodnota = [cena, index zdroje].",
    "// Jen na serveru (fáze 104 – ceníky do klientského bundlu nesmí).",
    "",
    'import "server-only";',
    "",
    `export const LIST_PRICES_RETRIEVED = ${JSON.stringify(TODAY)};`,
    "",
    `export const LIST_PRICE_SOURCES: readonly string[] = ${JSON.stringify(sources, null, 2)};`,
    "",
    `export const LIST_PRICES: Readonly<Record<string, readonly [number, number]>> = ${JSON.stringify(map, null, 1)};`,
    "",
  ].join("\n");
}

function renderSeed() {
  const ordered = Object.fromEntries([...seed.entries()].sort(([a], [b]) => a.localeCompare(b)));
  return [
    "// Generuje `node scripts/import-etim-universal.mjs` z balíčků ve složce „ETIM data“ (fáze 105) – needitujte ručně.",
    "// Data výrobců ke kusům katalogu AI Panel Builderu podle objednacího čísla: EAN, rozměry, vestavná hloubka, ztrátový",
    "// výkon Pv a ceníková cena – seed je zapíše ke kusům katalogu (`applyEtimComponents`). Jen pro seed (server) – bez",
    "// `server-only`, seed běží v tsx bez podmínky react-server; klientský modul ho importovat nesmí (test fáze 105).",
    "",
    "export interface UniversalComponentData {",
    "  ean?: string;",
    "  heightMm?: number;",
    "  widthMm?: number;",
    "  depthMm?: number;",
    "  powerLossWatts?: number;",
    "  listPriceCzk?: number;",
    "  listPriceSource?: string;",
    "  source: string;",
    "}",
    "",
    `export const UNIVERSAL_COMPONENTS: Record<string, UniversalComponentData> = ${JSON.stringify(ordered, null, 2)};`,
    "",
  ].join("\n");
}

async function main() {
  if (!existsSync(DIR)) throw new Error(`Složka ${DIR} neexistuje.`);
  const files = readdirSync(DIR).filter((name) => statSync(path.join(DIR, name)).isFile()).sort();
  for (const name of files) {
    const full = path.join(DIR, name);
    if (/\.zip$/i.test(name)) {
      const entries = await zipEntries(full);
      const xml = entries.filter((item) => /\.xml$/i.test(item.name)).sort((a, b) => b.uncompressed - a.uncompressed)[0];
      if (!xml) {
        const kinds = [...new Set(entries.map((item) => item.name.split(".").pop()?.toLowerCase()).filter((ext) => ext && ext.length <= 4))].join(", ");
        stats.skipped.push(`${name}: bez katalogu XML (kreslicí data: ${kinds})`);
        continue;
      }
      const start = await head(zipEntryStream(full, xml));
      if (/<BMECAT/i.test(start)) await readBmecat(full, xml, entries, name);
      else if (/<Catalog\s[^>]*CustomerNumber=/i.test(start)) await readSchrack(full, xml, name);
      else stats.skipped.push(`${name}: neznámý formát XML`);
    } else if (/\.xml$/i.test(name)) {
      const start = await head((await import("node:fs")).createReadStream(full));
      if (/<BMECAT/i.test(start)) await readBmecat(full, null, null, name);
      else if (/<Catalog\s[^>]*CustomerNumber=/i.test(start)) await readSchrack(full, null, name);
      else stats.skipped.push(`${name}: neznámý formát XML`);
    } else stats.skipped.push(`${name}: tabulka bez ceníkových cen (balení a logistika – EAN zpracoval import fáze 97)`);
  }
  if (!noPhotos && photoJobs.length) {
    const manifestRaw = JSON.parse(await readFile(MANIFEST, "utf8"));
    const { list, devicePhotos, sources } = await savePhotos(parseProductPhotos(manifestRaw));
    await writeFile(MANIFEST, renderPhotoManifest(parsePhotoManifest(manifestRaw), list));
    await writeFile(DEVICE_PHOTOS_FILE, renderDevicePhotos(devicePhotos, sources));
    await writeCatalogManifest();
  }
  await mkdir(path.dirname(PRICES_FILE), { recursive: true });
  await writeFile(PRICES_FILE, renderPrices());
  await writeFile(SEED_FILE, renderSeed());
  stats.prices = prices.size;
  stats.seed = seed.size;
  console.log("\nBalíčky:");
  console.table(stats.packages);
  if (stats.skipped.length) console.log(`Přeskočeno:\n  ${stats.skipped.join("\n  ")}`);
  console.log(`Fotky: nové ${stats.photos.added}, ponechané ${stats.photos.kept}, neplatné ${stats.photos.missing}`);
  console.log(`Ceníkové ceny: ${stats.prices} (${path.relative(ROOT, PRICES_FILE)}), data ke kusům katalogu: ${stats.seed} (${path.relative(ROOT, SEED_FILE)})`);
}

await main();
