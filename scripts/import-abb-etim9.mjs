// Fáze 94: import oficiálních dat ABB ve formátu BMEcat ETIM 9.0 (EDXF 5.0) – `ELSB_ETIM-9.0_2026-05.zip`.
//
// Proudově (bez rozbalení na disk, v paměti vždy jen jeden produkt) projde celý XML katalog ABB Electrification Smart
// Buildings a:
//   A) stáhne oficiální produktové fotky (média `UDX.EDXF.MIME_INFO`, kód MD01 z cdn.productimages.abb.com) pro designové
//      řady ABB – kryt spínače 1R, zásuvka 1R, rámeček 1R a víceramček 2R v každé barvě – podle objednacích čísel, která
//      počítá kusovník 2D půdorysu (`compileFloorplanBom`), pro výrobky ABB-free@home / KNX z katalogu chytré domácnosti
//      a pro ověřené rozvodnice ABB (Mistral41, Mistral65, ComfortLine), převede je na WebP 400 × 400 (sharp) a zapíše do
//      `public/catalog-images/abb/<řada>/<barva>-<díl>.webp`, `abb/smart/<id výrobku>.webp`, `abb/enclosures/<mpn>.webp`
//      a do `public/catalog-images/manifest.json` (zdroj, URL fotky, datum, GTIN);
//   B) vytáhne technické atributy: rámečky 1R–5R (počet násobků EF000074), vestavnou hloubku přístrojů (EF012278 / EF000218
//      / EF000049 v mm), GTIN; u DIN přístrojů ABB (jističe, chrániče, jističochrániče, svodiče …) ztrátový výkon
//      EF005387 [W], vestavnou hloubku EF000218 a technický list; u rozvodnic řady EF000266, moduly v řadě EF002950,
//      rozměry, krytí a montáž → `src/lib/panel-builder/abb-etim.generated.ts`, `abb-etim-components.generated.ts`
//      a `abb-etim-enclosures.generated.ts`.
//
// Slušné chování: nejvýš 4 souběžná stažení s krátkou pauzou, běžný identifikátor klienta; když CDN výrobce stahování
// odmítne (403 / 429 / opakované chyby spojení), skript stahování ukončí a nic neobchází. Bez přihlášení a osobních údajů.
//
//   --zip=cesta     ZIP / XML ETIM (jinak se hledá v kořeni projektu, data/, data/etim/raw/, docs/ a ve složkách Stažené)
//   --no-photos     jen data (bez stahování fotek)
//   --force         stáhne a přepíše i fotky, které už ve složce jsou
//   --limit=N       nejvýš N stažených fotek (zkušební běh)
//
// Spuštění: `node scripts/import-abb-etim9.mjs` (skript se sám spustí přes tsx – importuje moduly aplikace v TypeScriptu)
// nebo `npm run catalog:etim`.

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(SCRIPT), "..");

// Pod samotným Node se moduly aplikace (TypeScript s aliasy „@/“) nenačtou – skript se spustí znovu přes tsx
if (process.env.ELDOCK_ETIM_TSX !== "1") {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsx, SCRIPT, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ELDOCK_ETIM_TSX: "1" } });
  process.exit(result.status ?? 1);
}

const { productBlocks, zipEntries, zipEntryStream } = await import("./lib/etim-zip.mjs");
const { ETIM_CLASSES, ETIM_UNITS, featureNumber, normalizeMpn, parseEtimProduct, productDocuments, productPhoto } = await import("../src/lib/catalog/etim.ts");
const { parsePhotoManifest, parseProductPhotos, photoTarget, renderPhotoManifest, upsertPhoto } = await import("../src/lib/panel-builder/catalog-photos.ts");
const { PALETTE, emptyDraft } = await import("../src/lib/panel-builder/floorplan-editor.ts");
const { compileFloorplanBom } = await import("../src/lib/panel-builder/wiring-bom.ts");
const { DESIGN_BRANDS, seriesColors } = await import("../src/lib/panel-builder/wiring-designs.ts");
const { PRODUCT_FAMILIES } = await import("../src/lib/panel-builder/smart-catalog.ts");
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
const limit = Number(value("limit") ?? Infinity);

const IMAGES = path.join(ROOT, "public", "catalog-images");
const MANIFEST = path.join(IMAGES, "manifest.json");
const APP_DATA = path.join(ROOT, "src", "lib", "panel-builder", "abb-etim.generated.ts");
const SEED_DATA = path.join(ROOT, "src", "lib", "panel-builder", "abb-etim-components.generated.ts");
const ENCLOSURE_DATA = path.join(ROOT, "src", "lib", "panel-builder", "abb-etim-enclosures.generated.ts");
const SOURCE = "ABB – oficiální data ETIM 9.0 (ELSB_ETIM-9.0_2026-05, cdn.productimages.abb.com)";
const LICENSE = "fotka výrobce ABB – užití v Eldocku (i ve veřejném repozitáři) potvrdil provozovatel 2026-11-10";
const TODAY = new Date().toISOString().slice(0, 10);
const PHOTO_PX = 400;
const PARALLEL = 4;

const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");

// ---------------------------------------------------------------------------
//  1. Kde je ZIP
// ---------------------------------------------------------------------------

function findArchive() {
  const own = value("zip");
  if (own) return existsSync(own) ? own : null;
  const pattern = /^ELSB_ETIM.*\.(zip|xml)$/i;
  const dirs = [ROOT, path.join(ROOT, "data"), path.join(ROOT, "data", "etim"), path.join(ROOT, "data", "etim", "raw"), path.join(ROOT, "docs"), path.join(os.homedir(), "Downloads")];
  // Windows: Stažené soubory všech uživatelů (C:\Users\*\Downloads)
  const users = process.platform === "win32" ? path.join(path.parse(os.homedir()).root, "Users") : null;
  if (users && existsSync(users)) for (const user of readdirSync(users)) dirs.push(path.join(users, user, "Downloads"));
  const found = [];
  for (const dir of dirs) {
    try {
      for (const name of readdirSync(dir)) if (pattern.test(name)) found.push(path.join(dir, name));
    } catch {
      // složka neexistuje / bez přístupu
    }
  }
  return found.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0] ?? null;
}

// ---------------------------------------------------------------------------
//  2. Co hledat – objednací čísla z kusovníku, katalogu chytré domácnosti, rozvodnic a DIN přístrojů
// ---------------------------------------------------------------------------

const element = (id, item, patch = {}) => ({ id, item, x: 1000, y: 1000, room: "Pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });
const bomOf = (seriesKey, colorId, elements) => compileFloorplanBom({ ...emptyDraft(), series: seriesKey, color: colorId, frameColor: null, elements }, { installation: "classic" });

/** Přístroje, u kterých hlídač krabic počítá s vestavnou hloubkou (položka palety → kategorie řádku kusovníku). */
const DEPTH_ITEMS = [
  ["switch-1", "Přístroje spínačů"],
  ["switch-6", "Přístroje spínačů"],
  ["switch-7", "Přístroje spínačů"],
  ["button", "Přístroje spínačů"],
  ["dimmer", "Přístroje spínačů"],
  ["blind", "Přístroje spínačů"],
  ["thermostat", "Ostatní přístroje"],
  ["socket", "Zásuvky"],
  ["double-socket", "Zásuvky"],
  ["usb-socket", "Zásuvky"],
  ["surge-socket", "Zásuvky"],
  ["data-socket", "Ostatní přístroje"],
];

/** Řádky kusovníku bez objednacích čísel ABB (kabely z výkazu, krabice jiných výrobců). */
const NOT_ABB_CATEGORIES = new Set(["Kabely", "Instalační krabice"]);

/** Písmeno barvy v objednacím čísle nástěnných řad (Praktik, Variant+): bílá B, šedá S, hnědá H, béžová D. */
const SURFACE_LETTER = { white: "B", grey: "S", brown: "H", beige: "D" };

/**
 * Řady, u kterých kusovník číslo krytu / zásuvky / rámečku nepočítá (matice katalogu ho nemá): reprezentativní výrobek
 * z dat ETIM pro fotku dílu v barvě řady. Šablony objednacích čísel ověřené v ELSB_ETIM-9.0_2026-05 – `{code}` = kód
 * barvy řady (B1, 03, 84 …), `{letter}` = písmeno barvy nástěnné řady; použije se první šablona, kterou ETIM vede
 * s fotkou. `families` = jen barvy těchto skupin (Garant je v ETIM jen šedý hliníkový).
 */
const PHOTO_FALLBACKS = {
  "ABB|Classic": { switch: ["3553-01289 {code}"], socket: ["5517-2389 {code}"], frame: ["3901C-B10 {code}"] },
  "ABB|Swing": { switch: ["3557G-A01340 {code}"], socket: ["5518G-A02359 {code}", "5518G-A02349 {code}"] },
  // Swing L = přístroje Swing se středem vždy jasně bílým (B1) a rámečky řady L
  "ABB|Swing L": { switch: ["3557G-A01340 B1"], socket: ["5518G-A02359 B1"] },
  "ABB|Time": { socket: ["6619E-A06352 {code}", "6619E-A06397 {code}", "5599E-A02357 {code}"] },
  // Busch-Jaeger (společná kapitola krytů, str. 170): zásuvka 6619B s kódem barvy krytu
  "ABB|future linear": { socket: ["6619B-A06357{code}"] },
  "ABB|solo": { socket: ["6619B-A06357{code}"] },
  "ABB|solo carat": { socket: ["6619B-A06357{code}"] },
  "ABB|Busch-axcent": { socket: ["6619B-A06357{code}"] },
  "ABB|Variant+ (IP54)": { switch: ["3558N-C01510 {letter}"], socket: ["5518N-C02510 {letter}"] },
  "ABB|Praktik (IP44)": { switch: ["3553-01929 {letter}"], socket: ["5518-2929 {letter}"], set: ["5518-2029 {letter}"] },
  "ABB|Garant (IP44)": { switch: ["3558N-C01850"], socket: ["5518-2750"], families: ["grey"] },
};

/** Záložní objednací čísla fotek dílů pro barvu řady (šablony s kódem / písmenem barvy). */
function photoFallbacks(seriesKey, seriesColor) {
  const own = PHOTO_FALLBACKS[seriesKey];
  if (!own || !seriesColor) return {};
  if (own.families && !own.families.includes(seriesColor.family)) return {};
  const letter = SURFACE_LETTER[seriesColor.family] ?? null;
  const fill = (template) => {
    if (template.includes("{code}") && !seriesColor.code) return null;
    if (template.includes("{letter}") && !letter) return null;
    return template.replace("{code}", seriesColor.code ?? "").replace("{letter}", letter ?? "");
  };
  const result = {};
  for (const part of ["switch", "socket", "frame", "set"]) {
    const list = (own[part] ?? []).map(fill).filter(Boolean);
    if (list.length) result[part] = list;
  }
  return result;
}

function plan() {
  const series = [];
  const depth = [];
  // Všechna objednací čísla, která kusovník řad ABB počítá (všechny prvky palety v každé barvě) – EAN a ověření v ETIM
  const bom = new Set();
  for (const brand of DESIGN_BRANDS.filter((entry) => entry.manufacturer === "ABB")) {
    for (const option of brand.series) {
      const key = `ABB|${option.name}`;
      const colors = seriesColors(key);
      for (const color of colors) {
        const base = bomOf(key, color.id, [element("s", "switch-1"), element("z", "socket")]);
        const cover = base.find((row) => row.category === "Kryty spínačů" && row.mpn)?.mpn ?? null;
        // Decento: kompletní přístroj s kulatým rámečkem (kryt zvlášť nemá)
        const device = base.find((row) => row.category === "Přístroje spínačů" && row.mpn && /Decento/.test(row.name))?.mpn ?? null;
        const socket = base.find((row) => row.category === "Zásuvky" && row.mpn)?.mpn ?? null;
        const frames = [];
        for (let gangs = 1; gangs <= 5; gangs++) {
          const row = bomOf(key, color.id, [element("z", "socket", { frameUnits: gangs })]).find((entry) => entry.category === "Rámečky" && entry.name.startsWith(`Rámeček ${gangs}násobný (${gangs}R)`) && !/rozdělený/.test(entry.name));
          frames.push({ gangs, mpn: row?.mpn ?? null });
        }
        // Řada bez čísla dílu v kusovníku: reprezentativní výrobek z ETIM (jen pro fotku, do kusovníku se nepíše)
        const fallback = photoFallbacks(key, (option.colors ?? []).find((entry) => entry.id === color.id) ?? null);
        series.push({ key, colorId: color.id, colorLabel: color.label, parts: { switch: cover ?? device, socket, frame: frames[0].mpn, set: frames[1].mpn }, fallback, frames });
        for (const row of bomOf(key, color.id, PALETTE.map((item, index) => element(`p${index}`, item.id)))) if (row.mpn && !NOT_ABB_CATEGORIES.has(row.category)) bom.add(row.mpn);
        for (const frame of frames) if (frame.mpn) bom.add(frame.mpn);
      }
      // Vestavná hloubka přístrojů – mechanismy řady (barva na hloubce nezáleží, bere se první barva)
      const first = colors[0];
      if (!first) continue;
      for (const [item, category] of DEPTH_ITEMS) {
        const rows = bomOf(key, first.id, [element("d", item)]).filter((row) => row.category === category && row.mpn);
        if (rows.length) depth.push({ key, item, mpns: rows.map((row) => row.mpn) });
      }
    }
  }
  // Chytrá domácnost ABB (free@home, KNX, dotykové panely) – objednací číslo výrobku nebo první barevné varianty
  const smart = [];
  for (const family of PRODUCT_FAMILIES.filter((entry) => entry.manufacturer === "ABB")) {
    for (const group of family.groups) {
      for (const product of group.products) {
        const mpns = [product.catalog?.mpn, product.articleNumber, ...(product.variants ?? []).map((variant) => variant.mpn)].filter((mpn) => typeof mpn === "string" && mpn.trim());
        if (mpns.length) smart.push({ id: product.id, label: product.label, mpns: [...new Set(mpns)] });
      }
    }
  }
  const enclosures = VERIFIED_ENCLOSURES.filter((row) => row.manufacturer === "ABB").map((row) => ({ articleNumber: row.articleNumber, model: row.model, series: row.series, rows: row.rows, modulesPerRow: row.modulesPerRow, widthMm: row.widthMm, heightMm: row.heightMm, depthMm: row.depthMm, ipRating: row.ipRating }));
  const din = [...new Map([...ABB_CZ_COMPONENTS, ...ABB_2026_COMPONENTS, ...GENERATED_CATALOG].filter((row) => row.manufacturer === "ABB" && row.articleNumber).map((row) => [normalizeMpn(row.articleNumber), row])).values()];
  return { series, depth, smart, enclosures, din, bom: [...bom].sort() };
}

// ---------------------------------------------------------------------------
//  3. Proudové čtení ETIM
// ---------------------------------------------------------------------------

async function readEtim(archive, wanted) {
  const found = new Map();
  const enclosures = [];
  let total = 0;
  let withPhoto = 0;
  const classes = new Map();
  const chunks = archive.toLowerCase().endsWith(".zip")
    ? zipEntryStream(archive, (await zipEntries(archive)).find((entry) => /\.xml$/i.test(entry.name)) ?? (() => { throw new Error("V ZIPu není XML katalog ETIM."); })())
    : (await import("node:fs")).createReadStream(archive);
  for await (const block of productBlocks(chunks)) {
    const product = parseEtimProduct(block);
    if (!product) continue;
    total++;
    if (productPhoto(product)) withPhoto++;
    if (product.etimClass) classes.set(product.etimClass, (classes.get(product.etimClass) ?? 0) + 1);
    const key = normalizeMpn(product.pid);
    if (wanted.has(key)) found.set(key, product);
    if (product.etimClass === ETIM_CLASSES.enclosure) enclosures.push(product);
  }
  return { found, enclosures, total, withPhoto, classes };
}

// ---------------------------------------------------------------------------
//  4. Stažení a převod fotek
// ---------------------------------------------------------------------------

class Blocked extends Error {}
const cache = new Map();
let failures = 0;
let downloaded = 0;

async function fetchImage(url) {
  if (cache.has(url)) return cache.get(url);
  const response = await fetch(url, { headers: { "User-Agent": "EldockCatalogImages/1.0 (https://eldock.cz)" }, signal: AbortSignal.timeout(20_000) }).catch((error) => {
    failures++;
    if (failures >= 8) throw new Blocked(`opakované chyby spojení (${error.message})`);
    return null;
  });
  if (!response) return null;
  if (response.status === 403 || response.status === 429) throw new Blocked(`CDN výrobce odpověděla ${response.status}`);
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !/^image\//.test(type)) return null;
  const data = Buffer.from(await response.arrayBuffer());
  cache.set(url, data);
  return data;
}

/** Fotka → WebP 400 × 400 (celý výrobek v bílém poli, bez ořezu). */
async function savePhoto(url, target) {
  if (existsSync(target) && !force) return "kept";
  if (downloaded >= limit) return "limit";
  const data = await fetchImage(url);
  if (!data) return "missing";
  await mkdir(path.dirname(target), { recursive: true });
  await sharp(data, { animated: false }).flatten({ background: "#ffffff" }).trim({ threshold: 6 }).resize(PHOTO_PX, PHOTO_PX, { fit: "contain", background: "#ffffff" }).webp({ quality: 82 }).toFile(target);
  downloaded++;
  return "saved";
}

async function inBatches(jobs, run) {
  const results = [];
  for (let start = 0; start < jobs.length; start += PARALLEL) {
    results.push(...(await Promise.all(jobs.slice(start, start + PARALLEL).map(run))));
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  return results;
}

const slug = (text) => text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// ---------------------------------------------------------------------------
//  5. Hlavní běh
// ---------------------------------------------------------------------------

async function main() {
  const archive = findArchive();
  if (!archive) {
    console.error("ELSB_ETIM*.zip nenalezen (kořen projektu, data/, data/etim/raw/, docs/, Stažené soubory) – zadejte --zip=cesta.");
    process.exit(1);
  }
  console.log(`ETIM 9.0: ${archive}`);
  const targets = plan();
  const wanted = new Set();
  for (const row of targets.series) for (const mpn of [...Object.values(row.parts), ...Object.values(row.fallback).flat(), ...row.frames.map((frame) => frame.mpn)]) if (mpn) wanted.add(normalizeMpn(mpn));
  for (const row of targets.depth) for (const mpn of row.mpns) wanted.add(normalizeMpn(mpn));
  for (const row of targets.smart) for (const mpn of row.mpns) wanted.add(normalizeMpn(mpn));
  for (const row of targets.enclosures) wanted.add(normalizeMpn(row.articleNumber));
  for (const row of targets.din) wanted.add(normalizeMpn(row.articleNumber));
  for (const mpn of targets.bom) wanted.add(normalizeMpn(mpn));
  const started = Date.now();
  const etim = await readEtim(archive, wanted);
  console.log(`Zpracováno ${etim.total} produktů ETIM (${etim.withPhoto} s fotkou MD01) za ${Math.round((Date.now() - started) / 100) / 10} s; hledaných objednacích čísel ${wanted.size}, nalezeno ${etim.found.size}.`);
  const productOf = (mpn) => (mpn ? (etim.found.get(normalizeMpn(mpn)) ?? null) : null);

  // Rozvodnice ABB z ETIM: řady, moduly v řadě, rozměry, krytí, montáž a materiál (jen úplné záznamy)
  const known = new Set(targets.enclosures.map((row) => normalizeMpn(row.articleNumber)));
  const etimEnclosures = [];
  const etimEnclosureProducts = [];
  const enclosureChecks = [];
  // Počet modulů z ETIM jen s potvrzením v popisu výrobce („… 72 modulů“, „IP41/6M“): u multimediálních (Media) a
  // kombinovaných variant (K, VP) počítá ETIM celou mřížku včetně polí pro média / svorky – popis uvádí méně modulů
  const enclosureSkipped = { unconfirmed: [], mismatch: [] };
  const statedModules = (text) => {
    const match = /(\d+)\s*modul/i.exec(text) ?? /\/(\d+)\s*M\b/.exec(text) ?? /(\d+)\s*M\b/.exec(text);
    return match ? Number(match[1]) : null;
  };
  for (const product of etim.enclosures) {
    const rows = featureNumber(product, "EF000266");
    const perRow = featureNumber(product, "EF002950");
    const width = featureNumber(product, "EF000008", ETIM_UNITS.mm);
    const height = featureNumber(product, "EF000040", ETIM_UNITS.mm);
    const depth = featureNumber(product, "EF000049", ETIM_UNITS.mm);
    const ip = product.features.EF005474?.detail ?? (typeof product.features.EF005474?.value === "string" ? product.features.EF005474.value : null);
    const mounting = product.features.EF000003?.detail ?? "";
    const material = product.features.EF001596?.detail ?? "";
    if (!rows || !perRow || !width || !height || !depth || !ip || !/^IP\d{2}$/.test(ip)) continue;
    const entry = {
      articleNumber: product.pid,
      model: product.typeCode ?? product.pid,
      series: (product.series ?? "").trim(),
      rows,
      modulesPerRow: perRow,
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      ipRating: ip,
      installation: /flush|hollow/i.test(mounting) ? "FLUSH" : "SURFACE",
      material: /steel|metal/i.test(material) ? "PAINTED_STEEL" : "PLASTIC",
      gtin: product.gtin,
      description: product.shortCze ?? product.longCze ?? product.pid,
      page: productDocuments(product).page,
    };
    if (known.has(normalizeMpn(product.pid))) {
      const own = targets.enclosures.find((row) => normalizeMpn(row.articleNumber) === normalizeMpn(product.pid));
      const differs = ["rows", "modulesPerRow", "widthMm", "heightMm", "depthMm", "ipRating"].filter((field) => String(own[field]) !== String(entry[field]));
      enclosureChecks.push({ articleNumber: product.pid, model: own.model, differs: differs.map((field) => `${field}: katalog ${own[field]} × ETIM ${entry[field]}`) });
    } else if (/MISTRAL|ComfortLine/i.test(entry.series)) {
      const stated = statedModules(entry.description);
      if (stated === null) enclosureSkipped.unconfirmed.push(entry.model);
      else if (stated !== entry.rows * entry.modulesPerRow) enclosureSkipped.mismatch.push(`${entry.model} ${entry.rows}×${entry.modulesPerRow} (popis ${stated} M)`);
      else {
        etimEnclosures.push(entry);
        etimEnclosureProducts.push({ entry, product });
      }
    }
  }

  // A) fotky řad, chytré domácnosti a rozvodnic
  const manifest = await readManifest();
  let photos = manifest;
  const jobs = [];
  let fallbackPhotos = 0;
  for (const row of targets.series) {
    for (const [part, own] of Object.entries(row.parts)) {
      // Číslo z kusovníku, jinak první záložní výrobek řady, který ETIM vede s fotkou
      const mpn = [own, ...(row.fallback[part] ?? [])].find((candidate) => candidate && productOf(candidate) && productPhoto(productOf(candidate))) ?? null;
      const product = productOf(mpn);
      const photo = product ? productPhoto(product) : null;
      const target = photoTarget(row.key, row.colorId, part);
      if (!photo || !target) continue;
      if (mpn !== own) fallbackPhotos++;
      jobs.push({ kind: "series", row, part, mpn, product, url: photo.source, file: `${target.maker}/${target.folder}/${target.base}.webp` });
    }
  }
  const smartSaved = [];
  for (const row of targets.smart) {
    const product = row.mpns.map(productOf).find((candidate) => candidate && productPhoto(candidate)) ?? null;
    if (product) jobs.push({ kind: "smart", row, mpn: product.pid, product, url: productPhoto(product).source, file: `abb/smart/${row.id}.webp` });
  }
  for (const row of targets.enclosures) {
    const product = productOf(row.articleNumber);
    if (product && productPhoto(product)) jobs.push({ kind: "enclosure", row, mpn: row.articleNumber, product, url: productPhoto(product).source, file: `abb/enclosures/${slug(row.articleNumber)}.webp` });
  }
  // Rozvodnice přidané z ETIM (výběr skříně) – fotka výrobce stejně jako u ověřených
  for (const { entry, product } of etimEnclosureProducts) {
    if (productPhoto(product)) jobs.push({ kind: "enclosure", row: entry, mpn: entry.articleNumber, product, url: productPhoto(product).source, file: `abb/enclosures/${slug(entry.articleNumber)}.webp` });
  }
  let blocked = null;
  const outcome = { saved: 0, kept: 0, missing: 0, limit: 0 };
  if (!noPhotos) {
    try {
      const results = await inBatches(jobs, async (job) => {
        const status = await savePhoto(job.url, path.join(IMAGES, ...job.file.split("/")));
        return { job, status };
      });
      for (const { job, status } of results) {
        outcome[status]++;
        if (status !== "saved" && status !== "kept") continue;
        if (job.kind === "series") photos = upsertPhoto(photos, { series: job.row.key, color: job.row.colorId, part: job.part, file: job.file, source: SOURCE, license: LICENSE, sourceUrl: job.url, retrievedAt: TODAY, mpn: job.mpn, ...(job.product.gtin ? { gtin: job.product.gtin } : {}) });
        if (job.kind === "smart") smartSaved.push(job.row.id);
      }
    } catch (error) {
      if (!(error instanceof Blocked)) throw error;
      blocked = error.message;
    }
    // Fáze 97: fotky výrobků (krabice, rozvodnice, přístroje z `parse-etim-packages`) zůstávají v manifestu
    await writeFile(MANIFEST, renderPhotoManifest(photos, await readProducts()));
    for (const folder of ["smart", "enclosures"]) {
      const dir = path.join(IMAGES, "abb", folder);
      if (existsSync(dir)) await writeFile(path.join(dir, "zdroj.json"), `${JSON.stringify({ source: SOURCE, license: LICENSE }, null, 2)}\n`);
    }
  }

  // B) technická data
  const frames = {};
  const gtin = {};
  for (const row of targets.series) {
    const list = row.frames
      .filter((frame) => frame.mpn)
      .map((frame) => {
        const product = productOf(frame.mpn);
        const gangs = product ? featureNumber(product, "EF000074") : null;
        return { gangs: frame.gangs, mpn: frame.mpn, gtin: product?.gtin ?? null, inEtim: Boolean(product), etimGangs: gangs };
      });
    if (list.length) frames[`${row.key}|${row.colorId}`] = list;
    for (const mpn of [...Object.values(row.parts), ...row.frames.map((frame) => frame.mpn)]) {
      const product = productOf(mpn);
      if (product?.gtin) gtin[mpn] = product.gtin;
    }
  }
  const depths = {};
  for (const row of targets.depth) {
    for (const mpn of row.mpns) {
      const product = productOf(mpn);
      if (!product) continue;
      const mm = featureNumber(product, "EF012278", ETIM_UNITS.mm) ?? featureNumber(product, "EF000218", ETIM_UNITS.mm);
      if (mm && mm > 0) {
        const own = depths[`${row.key}|${row.item}`];
        // Nejhlubší díl přístroje (strojek, kryt) rozhoduje o krabici
        if (!own || mm > own.depthMm) depths[`${row.key}|${row.item}`] = { mpn, depthMm: mm };
      }
      if (product.gtin) gtin[mpn] = product.gtin;
    }
  }
  // Kusovník: GTIN / EAN každého objednacího čísla, které je v datech ETIM výrobce (= ověřené číslo)
  let bomFound = 0;
  const bomMissing = [];
  for (const mpn of targets.bom) {
    const product = productOf(mpn);
    if (!product) {
      bomMissing.push(mpn);
      continue;
    }
    bomFound++;
    if (product.gtin) gtin[mpn] = product.gtin;
  }
  const smartData = {};
  for (const row of targets.smart) {
    for (const mpn of row.mpns) {
      const product = productOf(mpn);
      if (product?.gtin) gtin[mpn] = product.gtin;
      if (product && !smartData[row.id]) smartData[row.id] = { mpn, gtin: product.gtin, datasheet: productDocuments(product).datasheet };
    }
  }
  const din = {};
  for (const row of targets.din) {
    const product = productOf(row.articleNumber);
    if (!product) continue;
    const loss = featureNumber(product, "EF005387");
    const depthMm = featureNumber(product, "EF000218", ETIM_UNITS.mm);
    const docs = productDocuments(product);
    din[row.articleNumber] = { ...(product.gtin ? { ean: product.gtin } : {}), ...(docs.datasheet ? { datasheetUrl: docs.datasheet } : {}), ...(loss !== null && loss > 0 && loss < 500 ? { powerLossWatts: loss } : {}), ...(depthMm && depthMm > 0 ? { depthMm } : {}) };
  }

  await writeFile(APP_DATA, renderAppData({ frames, depths, gtin, smart: smartData }));
  await writeFile(SEED_DATA, renderSeedData({ din }));
  await writeFile(ENCLOSURE_DATA, renderEnclosureData(etimEnclosures.sort((a, b) => a.articleNumber.localeCompare(b.articleNumber))));
  await writeCatalogManifest();

  // Statistika
  const framesInEtim = Object.values(frames).flat().filter((frame) => frame.inEtim).length;
  const framesTotal = Object.values(frames).flat().length;
  const missingFrames = Object.entries(frames).flatMap(([key, list]) => list.filter((frame) => !frame.inEtim).map((frame) => `${key} ${frame.gangs}R ${frame.mpn}`));
  console.log("");
  console.log("Statistika importu ETIM 9.0");
  console.log(`  produktů v archivu: ${etim.total} (s fotkou ${etim.withPhoto}); tříd ETIM: ${etim.classes.size}`);
  console.log(`  fotky: ${jobs.length} cílů – staženo a převedeno ${outcome.saved}, ponecháno ${outcome.kept}, bez fotky ${outcome.missing}${outcome.limit ? `, nad limit ${outcome.limit}` : ""}${noPhotos ? " (--no-photos)" : ""}`);
  console.log(`    řady ABB: ${jobs.filter((job) => job.kind === "series").length} (z toho ${fallbackPhotos} reprezentativní výrobek řady bez čísla v kusovníku), chytrá domácnost: ${jobs.filter((job) => job.kind === "smart").length}, rozvodnice: ${jobs.filter((job) => job.kind === "enclosure").length}`);
  console.log(`  rámečky 1R–5R z kusovníku: ${framesTotal}, v ETIM ${framesInEtim}`);
  console.log(`  vestavné hloubky přístrojů: ${Object.keys(depths).length}, GTIN / EAN: ${Object.keys(gtin).length}`);
  console.log(`  kusovník řad ABB: ${bomFound} z ${targets.bom.length} objednacích čísel nalezeno v ETIM (EAN, ověřeno)${bomMissing.length ? `; v ETIM chybí např. ${bomMissing.slice(0, 8).join(", ")}` : ""}`);
  console.log(`  DIN přístroje ABB: ${targets.din.length} v katalogu, v ETIM ${Object.keys(din).length} (Pv z ETIM ${Object.values(din).filter((row) => row.powerLossWatts).length})`);
  console.log(`  rozvodnice ABB: ověřené ${targets.enclosures.length} (v ETIM ${enclosureChecks.length}, rozdíl údajů ${enclosureChecks.filter((row) => row.differs.length).length}), nové z ETIM ${etimEnclosures.length}`);
  for (const row of enclosureChecks.filter((check) => check.differs.length).slice(0, 12)) console.log(`    ${row.model} (${row.articleNumber}): ${row.differs.join("; ")}`);
  console.log(`    vynecháno: ${enclosureSkipped.mismatch.length} s jiným počtem modulů v popisu výrobce (např. ${enclosureSkipped.mismatch.slice(0, 4).join(", ")}), ${enclosureSkipped.unconfirmed.length} bez počtu modulů v popisu (např. ${enclosureSkipped.unconfirmed.slice(0, 6).join(", ")})`);
  if (missingFrames.length) console.log(`  rámečky z kusovníku, které ETIM nevede (${missingFrames.length}): ${missingFrames.slice(0, 12).join(" · ")}${missingFrames.length > 12 ? " …" : ""}`);
  if (blocked) console.log(`  STAHOVÁNÍ ZASTAVENO: ${blocked} – nic se neobchází, chybějící fotky doplní velín v galerii (Ctrl+V).`);
}

async function readManifest() {
  try {
    return parsePhotoManifest(JSON.parse(await readFile(MANIFEST, "utf8")));
  } catch {
    return [];
  }
}

async function readProducts() {
  try {
    return parseProductPhotos(JSON.parse(await readFile(MANIFEST, "utf8")));
  } catch {
    return [];
  }
}

function renderAppData(data) {
  return [
    "// Generuje `node scripts/import-abb-etim9.mjs` z oficiálních dat ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – needitujte ručně.",
    "// Rámečky 1R–5R z kusovníku s ověřením v ETIM (počet násobků EF000074), vestavné hloubky přístrojů řad (EF012278 /",
    "// EF000218 v mm), GTIN / EAN objednacích čísel a výrobky chytré domácnosti (technický list).",
    "// Fáze 104: celý import dat výrobců jen na serveru (do klientského bundlu nesmí – viz src/server/catalog-data.ts)",
    'import "server-only";',
    "",
    "export interface EtimFrame {",
    "  gangs: number;",
    "  mpn: string;",
    "  gtin: string | null;",
    "  /** Objednací číslo je v datech ETIM výrobce. */",
    "  inEtim: boolean;",
    "  /** Počet násobků podle ETIM (EF000074); null = neuvedeno. */",
    "  etimGangs: number | null;",
    "}",
    "",
    `export const ETIM_SOURCE = ${JSON.stringify(SOURCE)};`,
    "",
    "/** Rámečky řady a barvy („ABB|Tango|abb-tango-b“). */",
    `export const ETIM_FRAMES: Record<string, EtimFrame[]> = ${JSON.stringify(data.frames, null, 2)};`,
    "",
    "/** Vestavná hloubka přístroje řady podle ETIM („ABB|Levit|dimmer“) – nejhlubší díl přístroje. */",
    `export const ETIM_DEVICE_DEPTHS: Record<string, { mpn: string; depthMm: number }> = ${JSON.stringify(data.depths, null, 2)};`,
    "",
    "/** GTIN / EAN objednacích čísel z kusovníku řad ABB (přístroje, kryty, rámečky) a chytré domácnosti – číslo je v datech výrobce. */",
    `export const ETIM_GTIN: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(data.gtin).sort(([a], [b]) => a.localeCompare(b))), null, 2)};`,
    "",
    "/** Výrobky chytré domácnosti ABB v ETIM (id výrobku katalogu → objednací číslo, GTIN, technický list). */",
    `export const ETIM_SMART: Record<string, { mpn: string; gtin: string | null; datasheet: string | null }> = ${JSON.stringify(data.smart, null, 2)};`,
    "",
  ].join("\n");
}

function renderSeedData(data) {
  return [
    "// Generuje `node scripts/import-abb-etim9.mjs` z oficiálních dat ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – needitujte ručně.",
    "// DIN přístroje ABB podle objednacího čísla: EAN (GTIN), technický list, ztrátový výkon Pv [W] (EF005387) a vestavná",
    "// hloubka [mm] (EF000218) – seed AI Panel Builderu je zapíše ke kusům katalogu (`applyEtimComponents`).",
    "",
    "export interface EtimComponentData {",
    "  ean?: string;",
    "  datasheetUrl?: string;",
    "  powerLossWatts?: number;",
    "  depthMm?: number;",
    "}",
    "",
    `export const ABB_ETIM_COMPONENTS: Record<string, EtimComponentData> = ${JSON.stringify(Object.fromEntries(Object.entries(data.din).sort(([a], [b]) => a.localeCompare(b))), null, 2)};`,
    "",
  ].join(String.fromCharCode(10));
}

function renderEnclosureData(enclosures) {
  return [
    "// Generuje `node scripts/import-abb-etim9.mjs` z oficiálních dat ABB ETIM 9.0 (ELSB_ETIM-9.0_2026-05) – needitujte ručně.",
    "// Rozvodnice ABB (Mistral41 / Mistral65 / ComfortLine Compact), které ETIM vede s úplnými údaji – řady EF000266, moduly",
    "// v řadě EF002950, šířka / výška / hloubka EF000008 / EF000040 / EF000049, krytí EF005474, montáž EF000003, materiál",
    "// EF001596 –, s počtem modulů potvrzeným popisem výrobce a které ověřený seznam (`verified-enclosures.ts`) ještě nemá.",
    "// Jen pro seed (server), ne do klienta.",
    "",
    "export interface EtimEnclosure {",
    "  articleNumber: string;",
    "  model: string;",
    "  series: string;",
    "  rows: number;",
    "  modulesPerRow: number;",
    "  widthMm: number;",
    "  heightMm: number;",
    "  depthMm: number;",
    "  ipRating: string;",
    '  installation: "SURFACE" | "FLUSH";',
    '  material: "PLASTIC" | "PAINTED_STEEL";',
    "  gtin: string | null;",
    "  description: string;",
    "  page: string | null;",
    "}",
    "",
    `export const ABB_ETIM_ENCLOSURES: EtimEnclosure[] = ${JSON.stringify(enclosures, null, 2)};`,
    "",
  ].join(String.fromCharCode(10));
}

await main();
