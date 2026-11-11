// Fáze 92: harvester reálných produktových fotek vypínačů a zásuvek (`npm run catalog:photos`).
//
// V reálném prohlížeči (Playwright – Chromium: Microsoft Edge, Google Chrome nebo Chromium z Playwrightu) projde designové
// řady ABB z katalogu řad, pro každou barvu spočítá objednací čísla stejně jako kusovník (`compileFloorplanBom` – kryt
// spínače č. 1 / kompletní přístroj Decento a zásuvka 1N) a na oficiálním katalogu ABB pro ČR (nizke-napeti.cz.abb.com)
// najde stránku výrobku podle objednacího čísla. Fotka se bere jen tehdy, když její soubor nese přesně stejné objednací
// číslo (např. `3558A-A651_B.webp` = 3558A-A651 B) – žádné odhady podle názvu. Fotky jdou do
// `public/catalog-images/<výrobce>/<řada>/<barva>-<díl>.webp`, zdroj, stránka výrobku a datum do
// `public/catalog-images/manifest.json`; nakonec se přegeneruje manifest aplikace (`npm run catalog:images`).
//
// Slušné chování: jeden požadavek po druhém s pauzou, cookie lišta odmítnutá (jen nezbytné cookies), běžný identifikátor
// prohlížeče (nic se nepodvrhuje). Když web výrobce automatizovaný prohlížeč odmítne (CAPTCHA, 403 / 429 nebo ukončené
// spojení – 2026-11-11 nizke-napeti.cz.abb.com odmítal headless prohlížeč chybou net::ERR_HTTP2_PROTOCOL_ERROR), skript
// skončí a nic neobchází – fotky pak nahraje velín v galerii (Ctrl+V / soubor). Bez přihlášení a osobních údajů.
//
//   --only=Tango,Zoni   jen vybrané řady ABB (název řady z katalogu)
//   --dry-run           jen vypíše, co by stáhl (objednací čísla a cíle)
//   --force             přepíše i fotky, které už ve složce jsou
//   --channel=msedge    prohlížeč: msedge (výchozí), chrome, chromium
//   --limit=20          nejvýš N fotek (zkušební běh)
//
// Spuštění přes tsx (importuje moduly aplikace v TypeScriptu): `npx tsx scripts/harvest-switch-photos.mjs --only=Tango`.

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { photoTarget, parsePhotoManifest, renderPhotoManifest, upsertPhoto } from "../src/lib/panel-builder/catalog-photos.ts";
import { emptyDraft } from "../src/lib/panel-builder/floorplan-editor.ts";
import { compileFloorplanBom } from "../src/lib/panel-builder/wiring-bom.ts";
import { DESIGN_BRANDS, seriesColors } from "../src/lib/panel-builder/wiring-designs.ts";
import { CATALOG_IMAGES_DIR, writeCatalogManifest } from "./catalog-images.ts";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST = path.join(CATALOG_IMAGES_DIR, "manifest.json");
const SITE = "https://nizke-napeti.cz.abb.com";
const SOURCE = "ABB s.r.o. – oficiální katalog nizke-napeti.cz.abb.com";
const LICENSE = "fotka výrobce ABB – užití v Eldocku (i ve veřejném repozitáři) potvrdil provozovatel 2026-11-10";
const MAX_BYTES = 3 * 1024 * 1024;
const PAUSE_MS = 900;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const only = value("only")?.split(",").map((name) => name.trim().toLowerCase()).filter(Boolean) ?? null;
const limit = Number(value("limit") ?? Infinity);
const channel = value("channel") ?? "msedge";
const dryRun = flag("dry-run");
const force = flag("force");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/** Objednací číslo bez mezer a podtržítek velkými písmeny („3558A-A651 B“ = „3558A-A651_B“). */
const norm = (text) => String(text).toUpperCase().replace(/[\s_]+/g, "");

const element = (id, item, patch = {}) => ({ id, item, x: 1000, y: 1000, room: "Pokoj", mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...patch });

/** Objednací čísla náhledových dílů řady v barvě – přesně podle kusovníku 2D půdorysu. */
function partMpns(seriesKey, colorId) {
  const draft = { ...emptyDraft(), series: seriesKey, color: colorId, frameColor: null, elements: [element("s", "switch-1"), element("z", "socket")] };
  const rows = compileFloorplanBom(draft, { installation: "classic" });
  const cover = rows.find((row) => row.category === "Kryty spínačů" && row.mpn)?.mpn ?? null;
  // Decento: kompletní přístroj s kulatým rámečkem (kryt zvlášť nemá)
  const device = rows.find((row) => row.category === "Přístroje spínačů" && row.mpn && /Decento/.test(row.name))?.mpn ?? null;
  const socket = rows.find((row) => row.category === "Zásuvky" && row.mpn)?.mpn ?? null;
  return { switch: cover ?? device, socket };
}

/** Cíle harvestu: řada ABB × barva × díl s objednacím číslem z kusovníku. */
function plan() {
  const targets = [];
  const skipped = [];
  for (const brand of DESIGN_BRANDS) {
    for (const series of brand.series) {
      const key = `${brand.manufacturer}|${series.name}`;
      if (only && !only.some((name) => series.name.toLowerCase().startsWith(name))) continue;
      if (brand.manufacturer !== "ABB") {
        skipped.push(`${key}: adaptér pro web výrobce ${brand.manufacturer} zatím není – fotky nahrajte v galerii (Ctrl+V)`);
        continue;
      }
      for (const color of seriesColors(key)) {
        const mpns = partMpns(key, color.id);
        for (const part of ["switch", "socket"]) {
          const mpn = mpns[part];
          const target = photoTarget(key, color.id, part);
          if (!mpn || !target) {
            skipped.push(`${key} · ${color.label} · ${part}: bez ověřeného objednacího čísla v kusovníku`);
            continue;
          }
          targets.push({ series: key, seriesName: series.name, color: color.id, colorLabel: color.label, part, mpn, file: `${target.maker}/${target.folder}/${target.base}.webp` });
        }
      }
    }
  }
  return { targets, skipped };
}

async function readManifest() {
  try {
    return parsePhotoManifest(JSON.parse(await readFile(MANIFEST, "utf8")));
  } catch {
    return [];
  }
}

class Blocked extends Error {}

async function main() {
  const { targets, skipped } = plan();
  console.log(`Harvester fotek řad: ${targets.length} cílů${only ? ` (řady: ${only.join(", ")})` : ""}, ${skipped.length} přeskočeno.`);
  if (dryRun) {
    for (const target of targets.slice(0, limit)) console.log(`  ${target.series} · ${target.colorLabel} · ${target.part}: ${target.mpn} → ${target.file}`);
    for (const line of skipped) console.log(`  přeskočeno: ${line}`);
    return;
  }
  const browser = await chromium.launch({ channel: channel === "chromium" ? undefined : channel, headless: true });
  const context = await browser.newContext({ locale: "cs-CZ" });
  const page = await context.newPage();
  let photos = await readManifest();
  const pages = new Map(); // stránka výrobku → { url, images: Map<normMPN, url> }
  const productOf = new Map(); // normMPN → stránka výrobku
  const report = { saved: 0, kept: 0, missing: [] };
  let cookies = false;

  async function open(url) {
    let response;
    try {
      response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    } catch (error) {
      // Ukončené spojení / síťová chyba = web automatizovaný prohlížeč nepustil – nic se neobchází
      const reason = String(error?.message ?? error).split(/\r?\n/)[0].replace(/^page\.goto: /, "");
      throw new Blocked(`Web výrobce spojení s automatizovaným prohlížečem ukončil (${reason}) – harvester končí, nic neobchází. Fotky nahrajte ve velínu v galerii řad (📷 Ctrl+V / soubor).`);
    }
    const status = response?.status() ?? 0;
    const text = (await page.content()).slice(0, 20_000);
    if (status === 403 || status === 429 || /captcha|are you a robot|ověřte, že nejste robot/i.test(text)) throw new Blocked(`Web výrobce požadavek odmítl (${status}) nebo chce ověření robota – harvester končí, nic neobchází.`);
    if (!cookies) {
      // Cookie lišta: jen nezbytné cookies
      await page.getByText("Odmítnout vše", { exact: true }).first().click({ timeout: 2500 }).catch(() => undefined);
      cookies = true;
    }
    await sleep(PAUSE_MS);
    return status;
  }

  async function productPage(mpn) {
    const key = norm(mpn);
    if (productOf.has(key)) return pages.get(productOf.get(key)) ?? null;
    await open(`${SITE}/cs/search/search?q=${encodeURIComponent(mpn)}`);
    const links = await page.$$eval("a[href]", (anchors) => anchors.map((anchor) => ({ href: anchor.href, text: anchor.textContent ?? "" })));
    const hit = links.find((link) => link.href.startsWith("https://nizke-napeti.cz.abb.com/") && !link.href.includes("/search/") && link.text.toUpperCase().replace(/[\s_]+/g, "").includes(key));
    if (!hit) return null;
    if (!pages.has(hit.href)) {
      await open(hit.href);
      // Fotky variant výrobku: /files/product-variant/<id>/default_webp/<OBJEDNACÍ_ČÍSLO>.webp
      const sources = await page.$$eval("img", (images) => images.map((image) => image.currentSrc || image.src));
      const images = new Map();
      for (const source of sources) {
        const match = /\/files\/product-variant\/\d+\/default_webp\/([^/?#]+)\.webp$/i.exec(source);
        if (match) images.set(decodeURIComponent(match[1]).toUpperCase().replace(/[\s_]+/g, ""), source);
      }
      pages.set(hit.href, { url: hit.href, images });
      for (const variant of images.keys()) productOf.set(variant, hit.href);
    }
    productOf.set(key, hit.href);
    return pages.get(hit.href);
  }

  try {
    let done = 0;
    for (const target of targets) {
      if (done >= limit) break;
      const destination = path.join(CATALOG_IMAGES_DIR, target.file);
      if (existsSync(destination) && !force && photos.some((photo) => photo.file === target.file)) {
        report.kept += 1;
        continue;
      }
      const product = await productPage(target.mpn);
      const image = product?.images.get(norm(target.mpn));
      if (!product || !image) {
        report.missing.push(`${target.series} · ${target.colorLabel} · ${target.part} (${target.mpn})`);
        continue;
      }
      const response = await context.request.get(image, { timeout: 45_000 });
      const type = response.headers()["content-type"] ?? "";
      const body = await response.body();
      await sleep(PAUSE_MS / 2);
      if (!response.ok() || !/^image\/webp/.test(type) || body.length > MAX_BYTES || body.length < 1000) {
        report.missing.push(`${target.series} · ${target.colorLabel} · ${target.part} (${target.mpn}): ${response.status()} ${type} ${body.length} B`);
        continue;
      }
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, body);
      photos = upsertPhoto(photos, {
        series: target.series,
        color: target.color,
        part: target.part,
        file: target.file,
        source: `${SOURCE} (${target.mpn})`,
        license: LICENSE,
        sourceUrl: product.url,
        retrievedAt: new Date().toISOString().slice(0, 10),
      });
      report.saved += 1;
      done += 1;
      console.log(`  ✓ ${target.series} · ${target.colorLabel} · ${target.part}: ${target.mpn} → ${target.file} (${Math.round(body.length / 1024)} kB)`);
    }
  } catch (error) {
    if (!(error instanceof Blocked)) throw error;
    console.error(`  ⛔ ${error.message}`);
  } finally {
    await browser.close();
    await writeFile(MANIFEST, renderPhotoManifest(photos));
    await writeCatalogManifest();
  }
  console.log(`Hotovo: ${report.saved} nových fotek, ${report.kept} ponecháno, ${report.missing.length} bez fotky se stejným objednacím číslem.`);
  for (const line of report.missing) console.log(`  bez fotky: ${line}`);
  for (const line of skipped) console.log(`  přeskočeno: ${line}`);
  console.log(`Manifest fotek: ${path.relative(ROOT, MANIFEST)}`);
}

await main();
