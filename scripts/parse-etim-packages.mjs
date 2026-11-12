// Fáze 97: univerzální parser stažených balíčků výrobců (`npm run catalog:parse`, po `npm run catalog:discover`).
//
// Projde všechno v `data/etim/downloads/` podle `discovery.json` – BMEcat XML (1.2 / 2005, ETIM 7–10, i v ZIPu, proudově),
// tabulky XLSX / CSV (sloupce se rozpoznají podle záhlaví: objednací číslo, EAN, název, popis, řada, fotka, technický
// list, cena), e-shopové feedy ze stránek výrobků (KOPOS, OEZ, Schneider) a adresář fotobanky Legrand (vzdálený ZIP,
// fotky po položkách přes HTTP Range) – a sjednotí je na výrobky výrobce (objednací číslo, EAN, název, řada, třída ETIM,
// vlastnosti, fotky, technický list). Zaheslované soubory se přeskočí.
//
//   A) Fotky: díly řad Schneider / Legrand / Hager pro galerii „Designové řady a barvy“ (spínač, zásuvka, rámeček 1R,
//      vícerámeček v každé barvě), instalační krabice KOPOS z katalogu krabic, rozvodnice Hager / OEZ / Schneider
//      a DIN přístroje ABB / OEZ / Hager z katalogu AI Panel Builderu. Každá fotka projde kontrolou kvality
//      (HTTP 200, `Content-Type: image/*`, víc než 1,5 kB, hlavička JPEG / PNG / WebP / GIF – nikdy chybová stránka),
//      převede se na WebP 400 × 400 (celý výrobek v bílém poli, sharp) a zapíše do `public/catalog-images/manifest.json`.
//   B) Technická data: vestavné hloubky přístrojů řad Hager (EF012278 / EF000218), nejvyšší vícenásobný rámeček podle
//      ETIM (EF000074), krabice KOPOS (EAN, hloubka a průměr ze stránky výrobku, bezhalogenovost, technický list, cena
//      z ceníku), DIN přístroje a rozvodnice (EAN, ztrátový výkon Pv EF005387, hloubka, šířka v modulech) →
//      `src/lib/panel-builder/brand-etim.generated.ts`, `brand-etim-components.generated.ts`, `device-photos.generated.ts`.
//
// Na konci vypíše tabulku: balíčky, fotky podle značky, zpřesněné parametry.
//
//   --no-photos   jen data          --force   stáhne a přepíše i fotky, které už ve složce jsou
//   --only=hager,kopos               --limit=N nejvýš N stažených fotek (zkušební běh)
//
// Spuštění: `node scripts/parse-etim-packages.mjs` (sám se spustí přes tsx – importuje moduly aplikace v TypeScriptu).

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(SCRIPT), "..");

if (process.env.ELDOCK_PARSE_TSX !== "1") {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsx, SCRIPT, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ELDOCK_PARSE_TSX: "1" } });
  process.exit(result.status ?? 1);
}

const { productBlocks, zipEntries, zipEntryStream } = await import("./lib/etim-zip.mjs");
const { parseCsv, readXlsx } = await import("./lib/xlsx-read.mjs");
const { remoteZipEntry } = await import("./lib/remote-zip.mjs");
const { ETIM_UNITS, featureNumber, normalizeMpn, parseEtimProduct, productDocuments, productPhoto } = await import("../src/lib/catalog/etim.ts");
const { detectColumns, findHeaderRow, halogenFreeCode, imageProblem, validGtin } = await import("../src/lib/catalog/manufacturer-data.ts");
const { wiringPhotoPicks } = await import("../src/lib/catalog/series-photo-targets.ts");
const { parsePhotoManifest, parseProductPhotos, photoTarget, renderPhotoManifest, upsertPhoto, upsertProductPhoto } = await import("../src/lib/panel-builder/catalog-photos.ts");
const { catalogSlug } = await import("../src/lib/panel-builder/catalog-images.ts");
const { MOUNTING_BOXES } = await import("../src/lib/panel-builder/mounting-boxes-catalog.ts");
const { SERIES_FRAME_RULES } = await import("../src/lib/panel-builder/residential-series-catalog.ts");
const { externalArticleNumber } = await import("../src/lib/panel-builder/external-catalog.ts");
const { VERIFIED_ENCLOSURES } = await import("../src/lib/panel-builder/verified-enclosures.ts");
const { ABB_CZ_COMPONENTS } = await import("../prisma/seed-abb-cz.ts");
const { ABB_2026_COMPONENTS } = await import("../prisma/seed-abb-2026.ts");
const { GENERATED_CATALOG } = await import("../prisma/seed-catalog-generated.ts");
const { writeCatalogManifest } = await import("./catalog-images.ts");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const force = flag("force");
const noPhotos = flag("no-photos");
const only = value("only")?.split(",").map((brand) => brand.trim().toLowerCase()).filter(Boolean) ?? null;
const limit = Number(value("limit") ?? Infinity);

const DOWNLOADS = path.join(ROOT, "data", "etim", "downloads");
const IMAGES = path.join(ROOT, "public", "catalog-images");
const MANIFEST = path.join(IMAGES, "manifest.json");
const APP_DATA = path.join(ROOT, "src", "lib", "panel-builder", "brand-etim.generated.ts");
const SEED_DATA = path.join(ROOT, "src", "lib", "panel-builder", "brand-etim-components.generated.ts");
const DEVICE_PHOTOS = path.join(ROOT, "src", "lib", "panel-builder", "device-photos.generated.ts");
const TODAY = new Date().toISOString().slice(0, 10);
const PHOTO_PX = 400;
const PARALLEL = 4;
const USER_AGENT = "Mozilla/5.0 (compatible; catalog-data-fetch/1.0)";

const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

/** Výrobci: složka fotek, popisek, zdroj fotek a licence (souhlas provozovatele). */
const BRANDS = {
  abb: { label: "ABB", maker: "abb", source: "ABB – oficiální data ETIM 9.0 (ELSB_ETIM-9.0_2026-05, cdn.productimages.abb.com)", license: "fotka výrobce ABB – užití v Eldocku (i ve veřejném repozitáři) potvrdil provozovatel 2026-11-10" },
  kopos: { label: "KOPOS", maker: "kopos", source: "KOPOS KOLÍN – e-shop kopos.cz (stránka výrobku) a ceník XLSX od 1. 8. 2026" },
  oez: { label: "OEZ", maker: "oez", source: "OEZ – katalog oez.cz (stránka výrobku)" },
  schneider: { label: "Schneider Electric", maker: "schneider", source: "Schneider Electric – se.com (stránka výrobku, obrázek download.se.com)" },
  legrand: { label: "Legrand", maker: "legrand", source: "Legrand – archiv fotek výrobků legrand.cz (cz_cs_Legrand_obrazky_CZ_202212)" },
  hager: { label: "Hager", maker: "hager", source: "Hager – oficiální data BMEcat ETIM 10 (Hager_BMEcat_ETIM10, assets.hager.com)" },
};
const licenseOf = (brand) => BRANDS[brand].license ?? `fotka výrobce ${BRANDS[brand].label} – užití v Eldocku (i ve veřejném repozitáři) zadal provozovatel 2026-11-11 (fáze 97)`;
/** Značky v tabulce statistiky (i ty bez veřejných dat). */
const STAT_BRANDS = [
  ["abb", "ABB"],
  ["kopos", "KOPOS"],
  ["oez", "OEZ"],
  ["schneider", "Schneider"],
  ["legrand", "Legrand"],
  ["hager", "Hager"],
  ["eaton", "Eaton"],
  ["loxone", "Loxone"],
  ["taphome", "TapHome"],
];

const wanted = (brand) => !only || only.includes(brand);

// ---------------------------------------------------------------------------------------------------------------------
//  1. Sjednocené výrobky
// ---------------------------------------------------------------------------------------------------------------------

/** Výrobky podle značky → objednací číslo (normalizované) → záznam. */
const store = new Map();

function put(brand, mpn, patch, source) {
  if (!mpn) return null;
  const key = normalizeMpn(String(mpn));
  if (!store.has(brand)) store.set(brand, new Map());
  const list = store.get(brand);
  const own = list.get(key) ?? { brand, mpn: String(mpn).trim(), ean: null, name: null, description: null, series: null, etimClass: null, features: {}, images: [], datasheet: null, page: null, attrs: {}, sources: [] };
  for (const field of ["ean", "name", "description", "series", "etimClass", "datasheet", "page"]) if (!own[field] && patch[field]) own[field] = patch[field];
  if (patch.ean && !validGtin(own.ean)) own.ean = validGtin(patch.ean) ? patch.ean : own.ean;
  if (patch.features) own.features = { ...patch.features, ...own.features };
  for (const image of patch.images ?? []) if (image && !own.images.some((entry) => JSON.stringify(entry) === JSON.stringify(image))) own.images.push(image);
  for (const [name, attr] of Object.entries(patch.attrs ?? {})) if (attr !== null && attr !== undefined && own.attrs[name] === undefined) own.attrs[name] = attr;
  if (source && !own.sources.includes(source)) own.sources.push(source);
  list.set(key, own);
  return own;
}

const productOf = (brand, mpn) => (mpn ? (store.get(brand)?.get(normalizeMpn(String(mpn))) ?? null) : null);

// ---------------------------------------------------------------------------------------------------------------------
//  2. Čtení balíčků
// ---------------------------------------------------------------------------------------------------------------------

const stats = { packages: [], skipped: [] };

/** Proudové čtení BMEcat (ZIP / XML) → výrobky; `keep` = filtr (ABB jen hledaná čísla). */
async function readBmecat(brand, file, keep) {
  let chunks;
  if (/\.zip$/i.test(file)) {
    const entry = (await zipEntries(file)).find((item) => /\.xml$/i.test(item.name));
    // ZIP bez XML katalogu (knihovny Revit / výkresy) není datový balíček
    if (!entry) return null;
    chunks = zipEntryStream(file, entry);
  } else chunks = (await import("node:fs")).createReadStream(file);
  let count = 0;
  for await (const block of productBlocks(chunks)) {
    const product = parseEtimProduct(block);
    if (!product) continue;
    count++;
    if (keep && !keep(product)) continue;
    const photos = product.media.filter((item) => item.code === "MD01" && item.source && /^https:\/\//.test(item.source)).map((item) => item.source);
    const best = productPhoto(product)?.source ?? null;
    const docs = productDocuments(product);
    put(brand, product.pid, { ean: product.gtin, name: product.shortCze, description: product.longCze, series: product.series, etimClass: product.etimClass, features: product.features, images: [...new Set([best, ...photos].filter(Boolean))], datasheet: docs.datasheet, page: docs.page }, path.basename(file));
  }
  return count;
}

const DESCRIPTION_SHEETS = /basic data|ceník|cenik|list1|sheet1|data|produkty|products/i;

/** Tabulka XLSX / CSV → výrobky podle rozpoznaných sloupců (každý list zvlášť). */
function readTable(brand, name, sheets) {
  let count = 0;
  for (const sheet of sheets) {
    let header = findHeaderRow(sheet.rows);
    // List jen s objednacím číslem a bezhalogenovostí (Hager „Environmental & certification“)
    if (header < 0 && sheet.rows[0] && detectColumns(sheet.rows[0]).mpn !== undefined && sheet.rows[0].some((cell) => /^ishalogenfree$/i.test(cell))) header = 0;
    if (header < 0) continue;
    const head = sheet.rows[header];
    const columns = detectColumns(head);
    const halogen = head.findIndex((cell) => /^ishalogenfree$/i.test(cell));
    const priceIsPerThousand = columns.price !== undefined && /1000\s*MJ/i.test(head[columns.price]);
    for (const row of sheet.rows.slice(header + 1)) {
      const mpn = row[columns.mpn]?.trim();
      if (!mpn || mpn.length > 60) continue;
      const cell = (role) => (columns[role] !== undefined ? row[columns[role]]?.trim() || null : null);
      const price = cell("price") ? Number(cell("price").replace(",", ".")) : null;
      const image = cell("image");
      put(
        brand,
        mpn,
        {
          ean: cell("ean"),
          name: cell("name"),
          description: cell("description"),
          series: cell("series"),
          etimClass: /^EC\d{6}$/.test(cell("etimClass") ?? "") ? cell("etimClass") : null,
          images: image && /^https:\/\//.test(image) ? [image] : [],
          datasheet: /^https:\/\//.test(cell("datasheet") ?? "") ? cell("datasheet") : null,
          page: /^https:\/\//.test(cell("page") ?? "") ? cell("page") : null,
          attrs: {
            ...(price !== null && Number.isFinite(price) && price > 0 ? { priceCzk: Math.round((priceIsPerThousand ? price / 1000 : price) * 100) / 100 } : {}),
            ...(halogen >= 0 && row[halogen] ? { halogenFree: /^V_?Yes$/i.test(row[halogen]) } : {}),
          },
        },
        `${name}${DESCRIPTION_SHEETS.test(sheet.name) ? "" : ` (${sheet.name})`}`,
      );
      count++;
    }
  }
  return count;
}

/** Feedy ze stránek výrobků (discover-and-download-etim). */
function readFeed(brand, name, feed) {
  let count = 0;
  for (const product of feed.products ?? []) {
    if (brand === "kopos") put(brand, product.code, { ean: product.ean, name: product.name, images: product.image ? [product.image] : [], datasheet: product.datasheet, page: product.page, attrs: { depthMm: product.depthMm, diameterMm: product.diameterMm, halogenFree: Boolean(product.halogenFree) || halogenFreeCode(product.code), material: product.material } }, name);
    else if (brand === "oez") put(brand, product.catalogMpn ?? product.orderCode, { ean: product.ean, name: product.type, description: product.description, images: product.image ? [product.image] : [], page: product.page, attrs: { modules: product.modules, poles: product.poles, depthMm: product.depthMm, widthMm: product.widthMm, heightMm: product.heightMm, ip: product.ip } }, name);
    else if (brand === "schneider") put(brand, product.mpn, { ean: product.ean, name: product.title, images: product.images ?? [], page: product.page, attrs: { pageDepthMm: product.depthMm } }, name);
    else continue;
    count++;
  }
  return count;
}

/** Fotobanka Legrand: objednací číslo (6 číslic, případně s písmenem) → nejlepší položka archivu (pohled zepředu). */
function readPhotoIndex(brand, index) {
  const byCode = new Map();
  // „752101-LEGRAND-1000.jpg“ = hlavní fotka výrobku (1000 px), „LG-…-WEB-F / -PF“ = pohled zepředu; „_a…_e“ a „DECO“
  // = další pohledy a fotky v interiéru
  const score = (name) => (/-LEGRAND-1000\./i.test(name) ? 5 : 0) + (/WEB-P?F\.|-F\.|_F\.|front/i.test(name) ? 3 : 0) + (/\.jpe?g$/i.test(name) ? 1 : 0) - (/deco|ambi|situ|install|zoom|detail|_[a-z]\./i.test(name) ? 4 : 0);
  for (const [name, offset, compressed, method, uncompressed] of index.entries) {
    const base = name.split("/").pop() ?? name;
    const match = /(?:^|[^0-9])(\d{6}[A-Z]?)(?=[^0-9A-Z]|$)/i.exec(base);
    if (!match) continue;
    const code = match[1].toUpperCase();
    const own = byCode.get(code);
    if (!own || score(base) > score(own.name)) byCode.set(code, { name, offset, compressed, method, uncompressed });
  }
  for (const [code, entry] of byCode) put(brand, code, { images: [{ zip: index.url, entry }] }, "fotobanka (adresář ZIP)");
  return byCode.size;
}

async function readPackages() {
  const discovery = JSON.parse(await readFile(path.join(DOWNLOADS, "discovery.json"), "utf8").catch(() => '{"sources":[]}'));
  if (!discovery.sources.length) throw new Error("Chybí data/etim/downloads/discovery.json – nejdřív spusťte `npm run catalog:discover`.");
  // ABB: jen DIN přístroje z katalogu AI Panel Builderu (řady, rozvodnice a chytrou domácnost zpracoval import fáze 94)
  const abbWanted = new Set(abbDevices().map((row) => normalizeMpn(row.articleNumber)));
  for (const source of discovery.sources) {
    if (!wanted(source.brand) || !BRANDS[source.brand]) continue;
    for (const file of source.files ?? []) {
      if (!file.path || file.encrypted || !["zip", "xml", "xlsx", "csv"].includes(file.kind)) {
        if (file.encrypted) stats.skipped.push(`${source.label}: ${file.name} (heslo)`);
        continue;
      }
      // Sešit s makry (nástroj výrobce, ne datový balíček výrobků)
      if (/\.xlsm$/i.test(file.name)) {
        stats.skipped.push(`${source.label}: ${file.name} (sešit s makry – nástroj výrobce, ne data výrobků)`);
        continue;
      }
      const full = path.join(ROOT, file.path);
      if (!existsSync(full)) continue;
      const started = Date.now();
      let count = 0;
      let kind = file.kind;
      if (file.kind === "xlsx") count = readTable(source.brand, file.name, await readXlsx(full));
      else if (file.kind === "csv") count = readTable(source.brand, file.name, [{ name: file.name, rows: parseCsv(await readFile(full, "utf8")) }]);
      else {
        kind = "BMEcat";
        count = await readBmecat(source.brand, full, source.brand === "abb" ? (product) => abbWanted.has(normalizeMpn(product.pid)) : null);
        if (count === null) {
          stats.skipped.push(`${source.label}: ${file.name} (ZIP bez katalogu XML – kreslicí data / knihovna Revit)`);
          continue;
        }
      }
      stats.packages.push({ brand: source.brand, label: source.label, name: file.name, kind, count, seconds: Math.round((Date.now() - started) / 100) / 10 });
    }
    for (const feed of source.feeds ?? []) {
      if (!feed.path || !existsSync(path.join(ROOT, feed.path))) continue;
      const count = readFeed(source.brand, feed.name, JSON.parse(await readFile(path.join(ROOT, feed.path), "utf8")));
      stats.packages.push({ brand: source.brand, label: source.label, name: feed.name, kind: "feed ze stránek výrobků", count });
    }
    for (const file of (source.files ?? []).filter((entry) => entry.index)) {
      const indexPath = path.join(DOWNLOADS, source.brand, file.index);
      if (!existsSync(indexPath)) continue;
      const count = readPhotoIndex(source.brand, JSON.parse(await readFile(indexPath, "utf8")));
      stats.packages.push({ brand: source.brand, label: source.label, name: file.name, kind: "fotobanka (vzdálený ZIP)", count });
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
//  3. Cíle – co z katalogu Eldocku vyfotit / zpřesnit
// ---------------------------------------------------------------------------------------------------------------------

function abbDevices() {
  return [...new Map([...ABB_CZ_COMPONENTS, ...ABB_2026_COMPONENTS, ...GENERATED_CATALOG].filter((row) => row.manufacturer === "ABB" && row.articleNumber).map((row) => [normalizeMpn(row.articleNumber), row])).values()];
}

async function externalCatalog() {
  return JSON.parse(await readFile(path.join(ROOT, "prisma", "external-catalog", "catalog.json"), "utf8"));
}

/** Barva popisu Hager („…, S.1, bílá mat“, „…, lumina passion, Alu mosaz“) → obecná barva galerie. */
function hagerColor(text) {
  const tail = String(text ?? "").toLowerCase().split(",").slice(-2).join(",");
  if (/dřev|mosaz|bronz|zlat/.test(tail)) return "wood";
  if (/černá|černé|antracit|grafit/.test(tail)) return "black";
  if (/krémov|slonov|béžov/.test(tail)) return "ivory";
  if (/alu\b|hliník|nerez|ocel|chrom/.test(tail)) return "alu";
  if (/stříbrn|šedá|titan/.test(tail)) return "grey";
  if (/bílá|bílé|polární/.test(tail)) return "white";
  return null;
}

/** Pravidla výběru dílů řad Hager z dat ETIM (popis výrobce + třída ETIM). */
const HAGER_SERIES = [
  {
    key: "Hager|lumina",
    match: (product) => /^WL/i.test(product.mpn),
    parts: {
      switch: (product) => product.etimClass === "EC001590" && /^Spínač 1-pólový, řazení 1,/i.test(product.description ?? "") && !/podsvětl/i.test(product.description ?? ""),
      socket: (product) => product.etimClass === "EC000125" && /^Zásuvka schuko/i.test(product.description ?? "") && !/víčk|svodič/i.test(product.description ?? ""),
      frame: (product) => product.etimClass === "EC000007" && /^Rámeček 1-násobný, lumina (intense|soul|passion)/i.test(product.description ?? ""),
      set: (product) => product.etimClass === "EC000007" && /^Rámeček 2-násobný vodorovný, lumina/i.test(product.description ?? ""),
    },
    prefer: (product) => (/intense/i.test(product.description ?? "") ? 0 : /soul/i.test(product.description ?? "") ? 1 : 2) + (/bezšroub/i.test(product.description ?? "") ? 0 : 0.5),
  },
  {
    key: "Hager|berker S.1 / B.3 / Q.1 / Q.3",
    match: (product) => /(^|[\s,(])S\.1([\s,/)]|$)/.test(product.description ?? ""),
    parts: {
      // Kolébka spínače = „Kryt jednoduchý, S.1/B.x, <barva>“ (strojek je společný pro všechny řady berker)
      switch: (product) => product.etimClass === "EC000011" && /^(Kryt jednoduchý|Kolébka),/i.test(product.description ?? "") && !/dělen|čočk|knx|2-násob|3-násob|symbol|potisk/i.test(product.description ?? ""),
      socket: (product) => product.etimClass === "EC000125" && /^Zásuvka SCHUKO, S\.1/i.test(product.description ?? "") && !/led|usa|kanad|víčk/i.test(product.description ?? ""),
      frame: (product) => product.etimClass === "EC000007" && /^Rámeček, 1-násobný, S\.1,/i.test(product.description ?? ""),
      set: (product) => product.etimClass === "EC000007" && /^Rámeček, 2-násobný(, vodorovný)?\s*, S\.1,/i.test(product.description ?? ""),
    },
    prefer: (product) => (/lesk/i.test(product.description ?? "") ? 0 : 0.5),
  },
];

function hagerPicks() {
  const products = [...(store.get("hager")?.values() ?? [])];
  const picks = [];
  for (const series of HAGER_SERIES) {
    const own = products.filter(series.match);
    for (const [part, test] of Object.entries(series.parts)) {
      const byColor = new Map();
      for (const product of own.filter(test)) {
        const color = hagerColor(product.description);
        if (!color) continue;
        const current = byColor.get(color);
        if (!current || series.prefer(product) < series.prefer(current) || (series.prefer(product) === series.prefer(current) && product.mpn < current.mpn)) byColor.set(color, product);
      }
      for (const [colorId, product] of byColor) picks.push({ seriesKey: series.key, colorId, part, mpn: product.mpn, ean: product.ean, title: product.description });
    }
  }
  return picks;
}

/** Vestavná hloubka přístrojů řad Hager (prvky palety → popis strojku / zásuvky) a nejvyšší rámeček podle ETIM. */
function hagerSeriesData() {
  const products = [...(store.get("hager")?.values() ?? [])];
  const depths = {};
  const limits = {};
  const depthOf = (product) => featureNumber(product, "EF012278", ETIM_UNITS.mm) ?? featureNumber(product, "EF000218", ETIM_UNITS.mm);
  const ITEMS = [
    ["switch-1", (product) => product.etimClass === "EC001590" && /řazení 1\b/i.test(product.description ?? "") && !/podsvětl/i.test(product.description ?? "")],
    ["switch-6", (product) => product.etimClass === "EC001590" && /řazení 6\b|střídav/i.test(product.description ?? "") && !/podsvětl|6\+6/i.test(product.description ?? "")],
    ["socket", (product) => product.etimClass === "EC000125" && /^Zásuvka schuko/i.test(product.description ?? "") && !/víčk|usa|svodič/i.test(product.description ?? "")],
  ];
  for (const series of HAGER_SERIES) {
    const own = products.filter(series.match);
    for (const [item, test] of ITEMS) {
      // Řada berker: strojky jsou společné (popis bez S.1) – hloubka zásuvky / spínače s krytem řady
      for (const product of own.filter(test)) {
        const mm = depthOf(product);
        if (!mm || mm <= 0 || mm > 120) continue;
        const key = `${series.key}|${item}`;
        if (!depths[key] || mm > depths[key].depthMm) depths[key] = { mpn: product.mpn, depthMm: mm, source: "Hager ETIM 10" };
      }
    }
    const frames = own.filter((product) => product.etimClass === "EC000007");
    let best = null;
    for (const frame of frames) {
      const gangs = featureNumber(frame, "EF000074");
      if (gangs && gangs >= 1 && gangs <= 6 && (!best || gangs > best.gangs)) best = { gangs, mpn: frame.mpn };
    }
    if (best) limits[series.key] = { maxFrameGang: Math.min(best.gangs, 5), etimGangs: best.gangs, mpn: best.mpn, frames: frames.length, source: `Hager ETIM 10 – rámeček ${best.gangs}R ${best.mpn}` };
  }
  return { depths, limits };
}

// ---------------------------------------------------------------------------------------------------------------------
//  4. Stažení a převod fotek
// ---------------------------------------------------------------------------------------------------------------------

class Blocked extends Error {}
const blockedHosts = new Map();
let downloaded = 0;
const photoStats = new Map();
const bump = (brand, field, job = null) => {
  const own = photoStats.get(brand) ?? { saved: 0, kept: 0, rejected: 0, missing: 0, reasons: new Map(), examples: [] };
  own[field]++;
  // Příklady výrobků bez fotky v datech výrobce (do hlášení)
  if (field === "missing" && job && own.examples.length < 6) own.examples.push(job.kind === "series" ? `${job.pick.seriesKey.split("|")[1]} ${job.pick.colorId} ${job.pick.part} ${job.pick.mpn}` : `${job.kind} ${job.mpn}`);
  photoStats.set(brand, own);
  return own;
};

async function imageBytes(image) {
  if (typeof image === "object" && image.zip) {
    const bytes = await remoteZipEntry(image.zip, image.entry, { userAgent: USER_AGENT });
    return { bytes, problem: imageProblem({ bytes }), url: `${image.zip}#${image.entry.name}` };
  }
  const url = String(image);
  const host = new URL(url).host;
  if (blockedHosts.has(host)) throw new Blocked(blockedHosts.get(host));
  let response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  } catch (error) {
    return { bytes: new Uint8Array(), problem: `spojení selhalo (${error.cause?.code ?? error.message})`, url };
  }
  if (response.status === 403 || response.status === 429) {
    blockedHosts.set(host, `${host} odpověděl ${response.status}`);
    throw new Blocked(blockedHosts.get(host));
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return { bytes, problem: imageProblem({ status: response.status, contentType: response.headers.get("content-type"), bytes }), url };
}

/** Fotka → WebP 400 × 400 (celý výrobek v bílém poli, bez ořezu). Kontrola kvality před uložením. */
async function savePhoto(job) {
  const target = path.join(IMAGES, ...job.file.split("/"));
  if (existsSync(target) && !force) return { status: "kept", url: job.sourceUrl ?? null };
  if (downloaded >= limit) return { status: "limit" };
  const reasons = [];
  for (const image of job.images) {
    let result;
    try {
      result = await imageBytes(image);
    } catch (error) {
      if (error instanceof Blocked) return { status: "blocked", reason: error.message };
      reasons.push(error.message);
      continue;
    }
    if (result.problem) {
      reasons.push(result.problem);
      continue;
    }
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await sharp(Buffer.from(result.bytes), { animated: false }).flatten({ background: "#ffffff" }).trim({ threshold: 6 }).resize(PHOTO_PX, PHOTO_PX, { fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toFile(target);
      downloaded++;
      return { status: "saved", url: result.url };
    } catch (error) {
      reasons.push(`převod selhal (${error.message})`);
    }
  }
  return { status: reasons.length ? "rejected" : "missing", reason: reasons[0] ?? "bez fotky v datech" };
}

async function runJobs(jobs) {
  const results = [];
  for (let start = 0; start < jobs.length; start += PARALLEL) {
    results.push(...(await Promise.all(jobs.slice(start, start + PARALLEL).map(async (job) => ({ job, ...(await savePhoto(job)) })))));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return results;
}

const imagesOf = (product) => (product ? product.images : []);
const gtinOf = (product, fallback) => (validGtin(product?.ean) ? product.ean : validGtin(fallback) ? fallback : null);

// ---------------------------------------------------------------------------------------------------------------------
//  5. Hlavní běh
// ---------------------------------------------------------------------------------------------------------------------

async function main() {
  const started = Date.now();
  await readPackages();
  console.log(`Načteno ${stats.packages.length} balíčků / feedů za ${Math.round((Date.now() - started) / 100) / 10} s: ${[...store].map(([brand, list]) => `${BRANDS[brand]?.label ?? brand} ${list.size}`).join(", ")} výrobků.`);

  const catalog = await externalCatalog();
  const wiring = JSON.parse(await readFile(path.join(ROOT, "prisma", "external-catalog", "wiring.json"), "utf8"));
  const jobs = [];

  // A1) Díly řad Schneider / Legrand (katalog domovních přístrojů) a Hager (ETIM) pro galerii
  const seriesPicks = [...wiringPhotoPicks(wiring).map((pick) => ({ ...pick, brand: pick.seriesKey.startsWith("Schneider") ? "schneider" : "legrand" })), ...hagerPicks().map((pick) => ({ ...pick, brand: "hager" }))].filter((pick) => wanted(pick.brand));
  for (const pick of seriesPicks) {
    const target = photoTarget(pick.seriesKey, pick.colorId, pick.part);
    if (!target) continue;
    const product = productOf(pick.brand, pick.mpn) ?? (pick.brand === "legrand" ? productOf("legrand", pick.mpn.replace(/^0+/, "").padStart(6, "0")) : null);
    jobs.push({ kind: "series", brand: pick.brand, pick, product, images: imagesOf(product), file: `${target.maker}/${target.folder}/${target.base}.webp`, gtin: gtinOf(product, pick.ean) });
  }
  // A2) Instalační krabice KOPOS
  const boxes = MOUNTING_BOXES.filter((box) => box.maker === "kopos" && box.code);
  if (wanted("kopos")) for (const box of boxes) jobs.push({ kind: "box", brand: "kopos", mpn: box.code, product: productOf("kopos", box.code), images: imagesOf(productOf("kopos", box.code)), file: `kopos/boxes/${catalogSlug(box.code)}.webp` });
  // A3) Rozvodnice (Hager ETIM, OEZ a Schneider ze stránek výrobků)
  const enclosureTargets = [];
  for (const record of catalog.filter((entry) => entry.category === "DISTRIBUTION_BOARD")) {
    const brand = { HAGER: "hager", OEZ: "oez", SCHNEIDER: "schneider" }[record.manufacturer];
    if (!brand || !wanted(brand)) continue;
    enclosureTargets.push({ brand, mpn: String(record.mpn), articleNumber: externalArticleNumber(record.manufacturer, String(record.mpn)), record });
  }
  for (const row of VERIFIED_ENCLOSURES.filter((entry) => entry.manufacturer === "Hager")) if (wanted("hager")) enclosureTargets.push({ brand: "hager", mpn: row.articleNumber, articleNumber: row.articleNumber, verified: row });
  for (const target of enclosureTargets) {
    const product = productOf(target.brand, target.mpn);
    // EAN: data výrobce, jinak katalog Eldocku (se.com EAN na stránce výrobku neuvádí)
    jobs.push({ kind: "enclosure", brand: target.brand, mpn: target.articleNumber, product, images: imagesOf(product), file: `${BRANDS[target.brand].maker}/enclosures/${catalogSlug(target.articleNumber)}.webp`, gtin: gtinOf(product, target.record?.ean) });
  }
  // A4) DIN přístroje (ABB ETIM 9.0, OEZ ze stránek výrobků, Hager ETIM 10)
  const deviceTargets = [];
  if (wanted("abb")) for (const row of abbDevices()) deviceTargets.push({ brand: "abb", mpn: row.articleNumber, articleNumber: row.articleNumber });
  // Všechny kusy katalogu OEZ / Hager kromě skříní a domovních přístrojů (jističe, chrániče, přípojnice, odpínače …)
  for (const record of catalog.filter((entry) => !["DISTRIBUTION_BOARD", "CABINET"].includes(entry.category) && !/^WD_/.test(entry.category) && ["OEZ", "HAGER"].includes(entry.manufacturer))) {
    const brand = record.manufacturer.toLowerCase();
    if (wanted(brand)) deviceTargets.push({ brand, mpn: String(record.mpn), articleNumber: externalArticleNumber(record.manufacturer, String(record.mpn)) });
  }
  for (const target of deviceTargets) {
    const product = productOf(target.brand, target.mpn);
    if (product) jobs.push({ kind: "device", brand: target.brand, mpn: target.articleNumber, product, images: imagesOf(product), file: `${BRANDS[target.brand].maker}/devices/${catalogSlug(target.articleNumber)}.webp` });
  }

  // Stažení
  const manifestRaw = JSON.parse(await readFile(MANIFEST, "utf8").catch(() => '{"version":1,"photos":[]}'));
  let photos = parsePhotoManifest(manifestRaw);
  let products = parseProductPhotos(manifestRaw);
  const devicePhotos = [];
  let blocked = [];
  if (!noPhotos) {
    const results = await runJobs(jobs.filter((job) => job.images.length || existsSync(path.join(IMAGES, ...job.file.split("/")))));
    for (const job of jobs.filter((entry) => !entry.images.length && !existsSync(path.join(IMAGES, ...entry.file.split("/"))))) bump(job.brand, "missing", job);
    for (const result of results) {
      const { job } = result;
      if (result.status === "blocked") {
        if (!blocked.includes(result.reason)) blocked.push(result.reason);
        bump(job.brand, "missing", job);
        continue;
      }
      if (result.status === "rejected") {
        const own = bump(job.brand, "rejected");
        own.reasons.set(result.reason, (own.reasons.get(result.reason) ?? 0) + 1);
        continue;
      }
      if (result.status !== "saved" && result.status !== "kept") {
        bump(job.brand, "missing", job);
        continue;
      }
      bump(job.brand, result.status);
      // Ponechaná fotka: dřívější položka manifestu (adresa fotky, datum stažení) zůstává
      const known = job.kind === "series" ? photos.some((entry) => entry.file === job.file) : products.some((entry) => entry.file === job.file);
      if (result.status === "kept" && known) {
        if (job.kind === "device") devicePhotos.push({ key: catalogSlug(job.mpn), src: `/catalog-images/${job.file}`, source: BRANDS[job.brand].source, mpn: job.mpn });
        continue;
      }
      const sourceUrl = typeof result.url === "string" && /^https:\/\//.test(result.url) ? result.url.split("#")[0] : (job.product?.page ?? null);
      const base = { source: BRANDS[job.brand].source, license: licenseOf(job.brand), ...(sourceUrl ? { sourceUrl } : {}), retrievedAt: TODAY };
      if (job.kind === "series") photos = upsertPhoto(photos, { series: job.pick.seriesKey, color: job.pick.colorId, part: job.pick.part, file: job.file, ...base, mpn: job.pick.mpn, ...(job.gtin ? { gtin: job.gtin } : {}) });
      else {
        const gtin = job.gtin ?? gtinOf(job.product);
        products = upsertProductPhoto(products, { kind: job.kind, brand: BRANDS[job.brand].label, mpn: job.mpn, file: job.file, ...base, ...(gtin ? { gtin } : {}) });
        if (job.kind === "device") devicePhotos.push({ key: catalogSlug(job.mpn), src: `/catalog-images/${job.file}`, source: BRANDS[job.brand].source, mpn: job.mpn });
      }
    }
    await writeFile(MANIFEST, renderPhotoManifest(photos, products));
    for (const [brand, folder] of [["kopos", "boxes"], ["hager", "enclosures"], ["oez", "enclosures"], ["schneider", "enclosures"]]) {
      const dir = path.join(IMAGES, BRANDS[brand].maker, folder);
      if (existsSync(dir)) await writeFile(path.join(dir, "zdroj.json"), `${JSON.stringify({ source: BRANDS[brand].source, license: licenseOf(brand) }, null, 2)}\n`);
    }
  }
  // Fotky přístrojů z dřívějšího běhu (soubory na disku + manifest) zůstávají v manifestu pro server
  for (const product of products.filter((entry) => entry.kind === "device")) {
    if (!devicePhotos.some((photo) => photo.key === catalogSlug(product.mpn)) && existsSync(path.join(IMAGES, ...product.file.split("/")))) devicePhotos.push({ key: catalogSlug(product.mpn), src: `/catalog-images/${product.file}`, source: product.source, mpn: product.mpn });
  }

  // B) Technická data
  const hager = hagerSeriesData();
  const koposBoxes = {};
  const boxDiffs = [];
  for (const box of boxes) {
    const product = productOf("kopos", box.code);
    if (!product) continue;
    const depthMm = typeof product.attrs.depthMm === "number" ? product.attrs.depthMm : null;
    koposBoxes[box.code] = { ean: gtinOf(product), depthMm, diameterMm: typeof product.attrs.diameterMm === "number" ? product.attrs.diameterMm : null, halogenFree: Boolean(product.attrs.halogenFree), material: product.attrs.material ?? null, datasheet: product.datasheet ?? null, page: product.page ?? null, priceCzk: product.attrs.priceCzk ?? null };
    if (depthMm && box.depthMm && Math.abs(depthMm - box.depthMm) >= 1 && ["shallow", "deep", "electronics"].includes(box.role)) boxDiffs.push(`${box.type}: katalog ${box.depthMm} mm × kopos.cz ${depthMm} mm`);
  }
  // DIN přístroje a rozvodnice do seedu (EAN, Pv, hloubka, technický list)
  const components = {};
  const enclosureChecks = [];
  const enclosureFixes = {};
  for (const target of [...deviceTargets, ...enclosureTargets]) {
    const product = productOf(target.brand, target.mpn);
    if (!product || target.brand === "abb") continue;
    const loss = featureNumber(product, "EF005387");
    const depthMm = featureNumber(product, "EF000218", ETIM_UNITS.mm) ?? (typeof product.attrs.depthMm === "number" ? product.attrs.depthMm : null);
    const data = { ...(gtinOf(product) ? { ean: gtinOf(product) } : {}), ...(product.datasheet && /^https:\/\//.test(product.datasheet) ? { datasheetUrl: product.datasheet } : {}), ...(loss !== null && loss > 0 && loss < 500 ? { powerLossWatts: loss } : {}), ...(depthMm && depthMm > 0 && depthMm < 400 ? { depthMm } : {}) };
    // Do seedu jen kusy katalogu (DIN přístroje) – rozvodnice jsou v katalogu skříní, data u nich slouží ke kontrole
    if (Object.keys(data).length && !target.record?.enclosure && !target.verified) components[target.articleNumber] = data;
    // Rozvodnice: řady × moduly a rozměry podle výrobce proti katalogu Eldocku (jen hlášení)
    if (target.record?.enclosure) {
      const rows = featureNumber(product, "EF000266");
      const perRow = featureNumber(product, "EF002950");
      const own = target.record.enclosure;
      const differs = [];
      if (rows && own.rows && rows !== own.rows) differs.push(`řady ${own.rows} × ETIM ${rows}`);
      if (perRow && own.modules_per_row && perRow !== own.modules_per_row) differs.push(`moduly v řadě ${own.modules_per_row} × ETIM ${perRow}`);
      const height = featureNumber(product, "EF000040", ETIM_UNITS.mm) ?? product.attrs.heightMm;
      if (height && target.record.height_mm && Math.abs(height - target.record.height_mm) > 2) differs.push(`výška ${target.record.height_mm} × ${height} mm`);
      enclosureChecks.push({ brand: target.brand, articleNumber: target.articleNumber, differs });
      // Oprava katalogu jen tehdy, když data ETIM potvrzuje i popis výrobce („2-řadá, 24 mod.“)
      const text = `${product.name ?? ""} ${product.description ?? ""}`;
      const statedRows = Number(/(\d)\s*-\s*řad/i.exec(text)?.[1] ?? 0);
      const statedTotal = Number(/(\d+)\s*(?:mod\.|modul|M\b)/i.exec(text)?.[1] ?? 0);
      if (rows && perRow && statedRows === rows && statedTotal === rows * perRow && (rows !== own.rows || perRow !== own.modules_per_row)) {
        enclosureFixes[target.articleNumber] = { rows, modulesPerRow: perRow, totalModules: rows * perRow, source: `${BRANDS[target.brand].label} ETIM 10 (řady EF000266, moduly v řadě EF002950) a popis výrobce „${text.trim().slice(0, 90)}“` };
      }
    }
  }
  await writeFile(APP_DATA, renderAppData({ depths: hager.depths, limits: hager.limits, koposBoxes }));
  await writeFile(SEED_DATA, renderSeedData(components, enclosureFixes));
  await writeFile(DEVICE_PHOTOS, renderDevicePhotos(devicePhotos));
  await writeCatalogManifest();

  // Statistika
  console.log("");
  console.log("1) Balíčky, ceníky a feedy (data/etim/downloads)");
  for (const row of stats.packages) console.log(`   ${row.label.padEnd(20)} ${row.name.padEnd(58)} ${String(row.kind).padEnd(26)} ${String(row.count).padStart(6)} záznamů${row.seconds ? ` (${row.seconds} s)` : ""}`);
  for (const line of stats.skipped) console.log(`   přeskočeno: ${line}`);
  console.log("");
  console.log("2) Reálné fotky WebP (ověřené: HTTP 200, image/*, > 1,5 kB, platná hlavička) podle značky");
  console.log("   Značka       uloženo  ponecháno  odmítnuto  bez fotky   celkem v katalogu (public/catalog-images)");
  for (const [brand, label] of STAT_BRANDS) {
    const own = photoStats.get(brand) ?? { saved: 0, kept: 0, rejected: 0, missing: 0, reasons: new Map() };
    const folder = path.join(IMAGES, brand);
    const total = existsSync(folder) ? countWebp(folder) : 0;
    const reasons = [...[...own.reasons].map(([reason, count]) => `odmítnuto ${count}× ${reason}`), ...(own.examples?.length ? [`bez fotky např. ${own.examples.join(", ")}`] : [])].join("; ");
    console.log(`   ${label.padEnd(12)} ${String(own.saved).padStart(7)} ${String(own.kept).padStart(10)} ${String(own.rejected).padStart(10)} ${String(own.missing).padStart(10)} ${String(total).padStart(10)}${reasons ? `   (${reasons.slice(0, 220)})` : ""}`);
  }
  if (blocked.length) console.log(`   STAHOVÁNÍ ZASTAVENO: ${blocked.join("; ")} – nic se neobchází.`);
  console.log("");
  console.log("3) Zpřesněné parametry v katalogu");
  const eanCount = (brand) => Object.entries(components).filter(([key, data]) => data.ean && deviceOrEnclosureBrand(key, brand, deviceTargets, enclosureTargets)).length;
  console.log(`   Hager:   vestavné hloubky přístrojů řad ${Object.keys(hager.depths).length} (${Object.entries(hager.depths).map(([key, row]) => `${key.split("|").slice(1).join(" ")} ${row.depthMm} mm`).join(", ")}); rámečky podle ETIM: ${Object.entries(hager.limits).map(([key, row]) => `${key.split("|")[1]} max ${row.etimGangs}R`).join(", ")}`);
  console.log(`            DIN přístroje a rozvodnice v katalogu s daty ETIM ${Object.keys(components).filter((key) => deviceOrEnclosureBrand(key, "hager", deviceTargets, enclosureTargets)).length} (EAN ${eanCount("hager")}, Pv ${Object.entries(components).filter(([key, data]) => data.powerLossWatts && deviceOrEnclosureBrand(key, "hager", deviceTargets, enclosureTargets)).length}, hloubka ${Object.entries(components).filter(([key, data]) => data.depthMm && deviceOrEnclosureBrand(key, "hager", deviceTargets, enclosureTargets)).length})`);
  console.log(`   OEZ:     přístroje a rozvodnice ze stránek výrobce ${Object.keys(components).filter((key) => deviceOrEnclosureBrand(key, "oez", deviceTargets, enclosureTargets)).length} (EAN ${eanCount("oez")}, hloubka ${Object.entries(components).filter(([key, data]) => data.depthMm && deviceOrEnclosureBrand(key, "oez", deviceTargets, enclosureTargets)).length})`);
  console.log(`   KOPOS:   krabice z katalogu ${boxes.length}, na webu výrobce ${Object.keys(koposBoxes).length} (EAN ${Object.values(koposBoxes).filter((row) => row.ean).length}, hloubka ${Object.values(koposBoxes).filter((row) => row.depthMm).length}, průměr ${Object.values(koposBoxes).filter((row) => row.diameterMm).length}, bezhalogenové ${Object.values(koposBoxes).filter((row) => row.halogenFree).length}, cena z ceníku ${Object.values(koposBoxes).filter((row) => row.priceCzk).length})${boxDiffs.length ? `; rozdíl hloubky: ${boxDiffs.join(", ")}` : "; hloubky souhlasí s katalogem"}`);
  console.log(`   Schneider / Legrand / Hager: díly řad pro galerii ${seriesPicks.length} (MPN + EAN z katalogu výrobce)`);
  const differing = enclosureChecks.filter((row) => row.differs.length);
  console.log(`   Rozvodnice opravené podle výrobce (ETIM + popis): ${Object.keys(enclosureFixes).length}${Object.keys(enclosureFixes).length ? ` – ${Object.entries(enclosureFixes).map(([key, fix]) => `${key} ${fix.rows}×${fix.modulesPerRow}`).join(", ")}` : ""}`);
  console.log(`   Rozvodnice ověřené proti datům výrobce: ${enclosureChecks.length}, rozdíl údajů ${differing.length}${differing.length ? ` (např. ${differing.slice(0, 4).map((row) => `${row.articleNumber}: ${row.differs.join(", ")}`).join("; ")})` : ""}`);
  for (const [key, row] of Object.entries(hager.limits)) {
    const rules = SERIES_FRAME_RULES[key];
    if (rules && rules.maxFrameGang !== row.maxFrameGang) console.log(`   ⚠ ${key}: pravidla řady ${rules.maxFrameGang}R × ETIM ${row.etimGangs}R`);
  }
  const dataKoposCodes = ["KU 68-1901", "KPR 68", "KPR 68/71", "KPR 68/L", "KUP 68", "KPRL 68-70/LD", "KEZ", "MDZ", "KP 64/FD", "KP 68/2", "KP 68/3"];
  const kopos = store.get("kopos") ?? new Map();
  const typeOf = (product) => product.mpn.replace(/_[A-Z]{2,3}$/, "").replace(/\s+/g, " ").trim().toUpperCase();
  const koposFound = dataKoposCodes.map((code) => {
    const exact = [...kopos.values()].filter((product) => typeOf(product) === code.toUpperCase()).map((product) => product.mpn);
    // Nejbližší typy výrobce (stejný začátek označení, např. „KPR 68/71“ → „KPR 68/71L_NA“)
    const close = exact.length ? [] : [...new Set([...kopos.values()].filter((product) => typeOf(product).startsWith(code.toUpperCase())).map((product) => product.mpn))].slice(0, 3);
    return { code, exact, close };
  });
  console.log(`   KOPOS kódy ze zadání: ${koposFound.map((row) => `${row.code} → ${row.exact.length ? row.exact.join(" / ") : row.close.length ? `přesně tento typ výrobce nevede, nejbližší ${row.close.join(" / ")}` : "výrobce nevede"}`).join("; ")}`);
}

const deviceOrEnclosureBrand = (articleNumber, brand, devices, enclosures) => [...devices, ...enclosures].some((target) => target.articleNumber === articleNumber && target.brand === brand);

function countWebp(dir) {
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) count += countWebp(path.join(dir, entry.name));
    else if (/\.webp$/i.test(entry.name)) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------------------------------------------------
//  6. Generované moduly
// ---------------------------------------------------------------------------------------------------------------------

const HEADER = "// Generuje `node scripts/parse-etim-packages.mjs` z dat výrobců v data/etim/downloads (fáze 97) – needitujte ručně.";

function renderAppData({ depths, limits, koposBoxes }) {
  return [
    HEADER,
    "// Vestavné hloubky přístrojů řad Hager (ETIM 10: EF012278 / EF000218), nejvyšší vícenásobný rámeček řady podle ETIM",
    "// (EF000074) a instalační krabice KOPOS ze stránek výrobků e-shopu kopos.cz a ceníku XLSX (EAN, hloubka, průměr,",
    "// bezhalogenovost, technický list, ceníková cena bez DPH za kus).",
    "// Fáze 104: celý import dat výrobců jen na serveru (do klientského bundlu nesmí – viz src/server/catalog-data.ts)",
    'import "server-only";',
    "",
    "export interface BrandDeviceDepth {",
    "  mpn: string;",
    "  depthMm: number;",
    "  /** Zdroj údaje („Hager ETIM 10“). */",
    "  source: string;",
    "}",
    "",
    "export interface EtimFrameLimit {",
    "  /** Nejvyšší rámeček řady pro editor (nejvýš 5 pozic). */",
    "  maxFrameGang: number;",
    "  /** Nejvyšší počet násobků rámečku v datech výrobce. */",
    "  etimGangs: number;",
    "  mpn: string;",
    "  /** Počet rámečků řady v datech ETIM. */",
    "  frames: number;",
    "  source: string;",
    "}",
    "",
    "export interface KoposBoxData {",
    "  ean: string | null;",
    "  depthMm: number | null;",
    "  diameterMm: number | null;",
    "  halogenFree: boolean;",
    "  material: string | null;",
    "  datasheet: string | null;",
    "  page: string | null;",
    "  /** Ceníková cena bez DPH za kus (ceník KOPOS od 1. 8. 2026). */",
    "  priceCzk: number | null;",
    "}",
    "",
    `export const KOPOS_DATA_SOURCE = ${JSON.stringify(BRANDS.kopos.source)};`,
    "",
    "/** Vestavná hloubka přístroje řady („Hager|lumina|socket“) – nejhlubší díl podle dat výrobce. */",
    `export const BRAND_DEVICE_DEPTHS: Record<string, BrandDeviceDepth> = ${JSON.stringify(depths, null, 2)};`,
    "",
    "/** Nejvyšší vícenásobný rámeček řady podle dat ETIM výrobce („Hager|lumina“). */",
    `export const ETIM_FRAME_LIMITS: Record<string, EtimFrameLimit> = ${JSON.stringify(limits, null, 2)};`,
    "",
    "/** Krabice KOPOS podle objednacího kódu katalogu krabic („KU 68-45_KA“). */",
    `export const KOPOS_BOX_DATA: Record<string, KoposBoxData> = ${JSON.stringify(Object.fromEntries(Object.entries(koposBoxes).sort(([a], [b]) => a.localeCompare(b))), null, 2)};`,
    "",
  ].join("\n");
}

function renderSeedData(components, enclosureFixes = {}) {
  return [
    HEADER,
    "// DIN přístroje a rozvodnice Hager (ETIM 10) a OEZ (stránky výrobků oez.cz) podle objednacího čísla katalogu: EAN (GTIN),",
    "// ztrátový výkon Pv [W] (EF005387), hloubka [mm] (EF000218 / „Hloubka (netto)“) a technický list – seed AI Panel",
    "// Builderu je zapíše ke kusům katalogu (`applyEtimComponents`). Jen pro seed (server), ne do klienta.",
    "",
    'import type { EtimComponentData } from "./abb-etim-components.generated";',
    "",
    `export const BRAND_ETIM_COMPONENTS: Record<string, EtimComponentData> = ${JSON.stringify(Object.fromEntries(Object.entries(components).sort(([a], [b]) => a.localeCompare(b))), null, 2)};`,
    "",
    "/** Opravy řad × modulů rozvodnic katalogu podle dat výrobce (ETIM potvrzený popisem výrobce). */",
    "export interface EnclosureFix {",
    "  rows: number;",
    "  modulesPerRow: number;",
    "  totalModules: number;",
    "  source: string;",
    "}",
    "",
    `export const BRAND_ENCLOSURE_FIXES: Record<string, EnclosureFix> = ${JSON.stringify(Object.fromEntries(Object.entries(enclosureFixes).sort(([a], [b]) => a.localeCompare(b))), null, 2)};`,
    "",
  ].join("\n");
}

function renderDevicePhotos(devicePhotos) {
  const sources = [...new Set(devicePhotos.map((photo) => photo.source))].sort();
  const map = Object.fromEntries(devicePhotos.sort((a, b) => a.key.localeCompare(b.key)).map((photo) => [photo.key, [photo.src, sources.indexOf(photo.source)]]));
  return [
    HEADER,
    "// Fotky DIN přístrojů podle objednacího čísla katalogu (slug) – jen pro serverové stránky (katalog AI Panel Builderu),",
    "// do klientského balíčku nepatří. Hodnota = [cesta v public/, index zdroje v DEVICE_PHOTO_SOURCES].",
    "",
    `export const DEVICE_PHOTO_SOURCES: readonly string[] = ${JSON.stringify(sources, null, 2)};`,
    "",
    `export const DEVICE_PHOTOS: Readonly<Record<string, readonly [string, number]>> = ${JSON.stringify(map, null, 1)};`,
    "",
  ].join("\n");
}

await main();
