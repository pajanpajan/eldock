// Fáze 97: autonomní vyhledání a stažení datových balíčků výrobců elektroinstalačního materiálu (`npm run catalog:discover`).
//
// Pro ABB, KOPOS Kolín, OEZ, Schneider Electric, Legrand, Hager, Eaton, Schrack a Saltek projde stránky „Ke stažení /
// Ceníky / Databáze ETIM / Pro projektanty“ (adresy ze zadání + odkazy nalezené na webu výrobce, nejvýš 1 úroveň do
// hloubky na stejném webu) a odchytí přímé odkazy na `.zip`, `.xml`, `.xlsx`, `.xls`, `.csv` (BMEcat / ETIM, ceníky,
// e-shopové exporty). Kreslicí data (2D / 3D / Revit / DXF / STEP) se vynechají. Stránky se čtou běžným HTTP požadavkem,
// kde web skript odmítne (403), tak v reálném prohlížeči (Playwright – Microsoft Edge / Chrome / Chromium, bez úprav
// identity). Každý balíček se uloží do `data/etim/downloads/<výrobce>/` (ve `.gitignore`); u souboru se pozná druh
// a zaheslování (archiv / tabulka s heslem se nepoužije – heslo se nehádá). Archivy nad 400 MB (kompletní fotobanky)
// se nestahují celé – u ZIPu fotek Legrand se přes HTTP Range přečte jen adresář (fotky pak parser stahuje po položkách).
//
// Výrobci bez veřejného datového balíčku (KOPOS jen ceník, OEZ ceník jen po přihlášení, Schneider) mají „e-shopový
// feed“ ze stránek výrobků – stejná data, jaká web zobrazuje (objednací kód, EAN, parametry, hlavní fotka):
//   kopos      e-shop kopos.cz – všechny instalační krabice a montážní desky ze sitemap (`eshop-krabice.json`);
//   oez        katalog oez.cz – jističe, chrániče, jističochrániče a rozvodnice OEZ z katalogu Eldocku (`produkty-web.json`);
//   schneider  se.com (prohlížeč) – díly řad Nová Unica / Sedna / Asfora pro galerii a rozvodnice (`produkty-web.json`).
//
// Slušné chování: robots.txt každého webu (zakázaná cesta se přeskočí), jeden požadavek po druhém s pauzou, obecný
// identifikátor klienta bez osobních údajů, bez přihlašování a hesel. Když web automatizovaný přístup odmítne (CAPTCHA,
// 403 / 429, ukončené spojení), výrobce se označí „blokuje“ a nic se neobchází.
//
// Výsledek: `data/etim/downloads/discovery.json` (zdroje, soubory, stavy) + tabulka v terminálu.
//
//   --only=hager,kopos   jen vybraní výrobci          --no-browser   bez Playwrightu (jen HTTP)
//   --no-feeds           bez stránek výrobků         --refresh      stáhne znovu i soubory, které už na disku jsou
//   --limit=N            nejvýš N stránek výrobků na feed (zkušební běh)
//
// Spuštění: `node scripts/discover-and-download-etim.mjs` (skript se sám spustí přes tsx – sdílené funkce jsou v TypeScriptu).

import { spawnSync } from "node:child_process";
import { createWriteStream, existsSync, readdirSync, statSync } from "node:fs";
import { copyFile, mkdir, open, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const SCRIPT = fileURLToPath(import.meta.url);
const ROOT = path.join(path.dirname(SCRIPT), "..");

if (process.env.ELDOCK_DISCOVER_TSX !== "1") {
  const tsx = path.join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
  const result = spawnSync(process.execPath, [tsx, SCRIPT, ...process.argv.slice(2)], { stdio: "inherit", env: { ...process.env, ELDOCK_DISCOVER_TSX: "1" } });
  process.exit(result.status ?? 1);
}

const { oezSlug, packageKind, parseKoposProductPage, parseOezProductPage, parseRobots, robotsAllows, zipEntryEncrypted } = await import("../src/lib/catalog/manufacturer-data.ts");
const { wiringPhotoPicks } = await import("../src/lib/catalog/series-photo-targets.ts");
const { remoteZipDirectory } = await import("./lib/remote-zip.mjs");
const { zipEntries } = await import("./lib/etim-zip.mjs");

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? null;
const only = value("only")?.split(",").map((brand) => brand.trim().toLowerCase()).filter(Boolean) ?? null;
const useBrowser = !flag("no-browser");
const useFeeds = !flag("no-feeds");
const refresh = flag("refresh");
const feedLimit = Number(value("limit") ?? Infinity);

export const DOWNLOADS = path.join(ROOT, "data", "etim", "downloads");
const USER_AGENT = "Mozilla/5.0 (compatible; catalog-data-fetch/1.0)";
const MAX_DOWNLOAD = 400 * 1024 * 1024;
const PAUSE_MS = 450;
const TODAY = new Date().toISOString().slice(0, 10);

/** Datové soubory (přípona v adrese); kreslicí data a dokumenty webu se nestahují. */
const DATA_LINK = /\.(zip|xml|xlsx|xlsm|xls|csv)(?:[?#]|$)/i;
const CAD_LINK = /(?:^|[\/_-])(2d|3d|dxf|dwg|stp|step|igs|iges|revit|rfa|bim|cad|eplan|macro)(?:[\/_.-]|$)/i;
const SKIP_LINK = /cookie|privacy|ochrana[-_]osobn|terms|podminky|smlouv|sitemap\.xml/i;
/** Odkazy na další stránky „ke stažení“ na stejném webu (1 úroveň). */
const FOLLOW_LINK = /ke-stazeni|stazeni|download|cenik|ceník|etim|bmecat|pro-projektant|data-pro/i;
/** Katalog výrobků a šablony adres ({{url}}) nejsou stránky ke stažení. */
const NO_FOLLOW = /e-katalog|\/katalog\/|%7B%7B|\{\{|\/produkt/i;

/**
 * Zdroje výrobců: stránky ze zadání a stránky nalezené na webech výrobců. `browser` = web čte jen skutečný prohlížeč
 * (běžný HTTP požadavek odmítá 403). `local` = vlastní kopie balíčku na disku (zadání: „pokud je na disku“).
 */
const SOURCES = [
  { brand: "abb", label: "ABB", pages: ["https://nizke-napeti.cz.abb.com/ke-stazeni/ceniky", "https://nizke-napeti.cz.abb.com/ke-stazeni", "https://nizke-napeti.cz.abb.com/dokumenty-a-katalogy"], local: /^ELSB_ETIM.*\.zip$/i },
  { brand: "kopos", label: "KOPOS Kolín", pages: ["https://www.kopos.cz/cs/ke-stazeni", "https://www.kopos.cz/cs/ceniky", "https://www.kopos.cz/cs/podpora-pro-projektanty", "https://www.kopos.cz/cs/ceniky-ke-stazeni", "https://www.kopos.cz/cs/pro-projektanty", "https://www.kopos.cz/cs/katalogy"], feed: "kopos" },
  { brand: "oez", label: "OEZ", pages: ["https://www.oez.cz/ke-stazeni", "https://www.oez.cz/podpora/ceniky", "https://www.oez.cz/ke-stazeni/cenik-ke-stazeni", "https://www.oez.cz/ke-stazeni/dokumenty"], feed: "oez" },
  { brand: "schneider", label: "Schneider Electric", pages: ["https://www.se.com/cz/cs/", "https://www.se.com/cz/cs/download/"], browser: true, feed: "schneider" },
  { brand: "legrand", label: "Legrand", pages: ["https://www.legrand.cz/ke-stazeni", "https://www.legrand.cz/cs/ke-stazeni/databaze-etim", "https://www.legrand.cz/cs/ke-stazeni/ceniky"], browser: true, photoArchive: /Legrand_obrazky/i },
  { brand: "hager", label: "Hager", pages: ["https://hager.com/cz/ke-stazeni", "https://hager.com/cz/ke-stazeni-a-udalosti/etim-data"] },
  { brand: "eaton", label: "Eaton", pages: ["https://www.eaton.com/cz/cs-cz.html", "https://www.eaton.com/cz/cs-cz/support/software-downloads.html"], browser: true },
  { brand: "schrack", label: "Schrack Technik", pages: ["https://www.schrack.cz", "https://www.schrack.cz/eshop/catalog/download/"] },
  { brand: "saltek", label: "Saltek", pages: ["https://www.saltek.eu/cs", "https://www.saltek.eu/cs/ke-stazeni"] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fileNameOf = (url) => decodeURIComponent(new URL(url).pathname.split("/").pop() || "soubor").replace(/[^\p{L}\p{N}._ -]+/gu, "_");

// ---------------------------------------------------------------------------------------------------------------------
//  robots.txt a HTTP
// ---------------------------------------------------------------------------------------------------------------------

const robotsCache = new Map();

async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let rules = { allow: [], disallow: [] };
  try {
    const response = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(20_000) });
    if (response.ok && /text\/plain/i.test(response.headers.get("content-type") ?? "")) rules = parseRobots(await response.text(), "catalog-data-fetch");
  } catch {
    // robots.txt nedostupný – platí obecná pravidla (nic zakázaného)
  }
  robotsCache.set(origin, rules);
  return rules;
}

async function allowed(url) {
  const parsed = new URL(url);
  return robotsAllows(await robotsFor(parsed.origin), `${parsed.pathname}${parsed.search}`);
}

class Blocked extends Error {}

/** Weby, které automatizovaný přístup už odmítly – další stránky se nezkoušejí (nic se neobchází). */
const blockedHosts = new Map();

/** Stránka běžným HTTP požadavkem; 403 / 429 / ukončené spojení = Blocked (zkusí se prohlížeč). */
async function fetchPage(url) {
  let response;
  try {
    response = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept-Language": "cs-CZ,cs;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
  } catch (error) {
    throw new Blocked(`spojení selhalo (${error.cause?.code ?? error.message})`);
  }
  if (response.status === 403 || response.status === 429) throw new Blocked(`HTTP ${response.status}`);
  const html = await response.text();
  return { status: response.status, url: response.url, html, via: "http" };
}

let browser = null;
let browserPage = null;

async function openBrowser() {
  if (browserPage) return browserPage;
  const { chromium } = await import("@playwright/test");
  for (const channel of ["msedge", "chrome", undefined]) {
    try {
      browser = await chromium.launch({ channel, headless: true });
      break;
    } catch {
      // prohlížeč není nainstalovaný – další kanál
    }
  }
  if (!browser) throw new Error("Playwright: není k dispozici Edge, Chrome ani Chromium (npx playwright install chromium).");
  const context = await browser.newContext({ locale: "cs-CZ" });
  browserPage = await context.newPage();
  return browserPage;
}

/** Stránka ve skutečném prohlížeči (JavaScript, odkazy po vykreslení); CAPTCHA / 403 / ukončené spojení = Blocked. */
async function browserFetch(url) {
  const page = await openBrowser();
  let response;
  try {
    response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  } catch (error) {
    // Chybová odpověď serveru bez stránky (404 / 410) – stránka neexistuje, web přístup neblokuje
    if (/ERR_HTTP_RESPONSE_CODE_FAILURE/.test(error.message)) return { status: 404, url, html: "", via: "prohlížeč" };
    // Přesměrování skriptem stránky (navigace přerušená další navigací) – stránka se načetla jinde, nejde o blokaci
    if (/interrupted by another navigation|net::ERR_ABORTED/.test(error.message)) {
      await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
      await page.waitForTimeout(1800);
      return { status: 200, url: page.url(), html: await page.content(), via: "prohlížeč" };
    }
    throw new Blocked(`prohlížeč: ${error.message.split("\n")[0].replace(/ at https?:\/\/\S+/, "")}`);
  }
  await page.waitForTimeout(1800);
  const status = response?.status() ?? 0;
  const html = await page.content();
  if (status === 403 || status === 429 || /captcha|are you a robot|ověřte, že nejste robot|access denied/i.test(html.slice(0, 20000))) throw new Blocked(`prohlížeč: HTTP ${status}${/captcha/i.test(html) ? " (CAPTCHA)" : ""}`);
  return { status, url: page.url(), html, via: "prohlížeč" };
}

async function readPage(url, source) {
  const host = new URL(url).host;
  if (blockedHosts.has(host)) throw new Blocked(blockedHosts.get(host));
  try {
    if (source.browser && useBrowser) return await browserFetch(url);
    try {
      return await fetchPage(url);
    } catch (error) {
      if (!(error instanceof Blocked) || !useBrowser) throw error;
      return await browserFetch(url);
    }
  } catch (error) {
    if (error instanceof Blocked) blockedHosts.set(host, error.message);
    throw error;
  }
}

/** Odkazy stránky (absolutní) s textem odkazu. */
function linksOf(html, base) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*?href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    try {
      links.push({ url: new URL(match[1].replace(/&amp;/g, "&"), base).toString(), text: match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) });
    } catch {
      // neplatná adresa
    }
  }
  return links;
}

/** Stránka chce přihlášení / heslo (ceník jen pro partnery, databáze ETIM po vyžádání hesla). */
function accessNote(html) {
  const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ");
  if (/nem[aá]te opr[aá]vn[eě]n[ií] ke sta[zž]en[ií]/i.test(text)) return "stažení ceníku jen po přihlášení partnera";
  if (/heslo k soubor[uů]m si pros[ií]m vy[zž][aá]dejte|vy[zž][aá]dejte heslo/i.test(text)) return "soubory chráněné heslem (výrobce ho posílá na vyžádání e-mailem)";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
//  Stažení souboru
// ---------------------------------------------------------------------------------------------------------------------

async function head(url) {
  try {
    const response = await fetch(url, { method: "HEAD", headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: AbortSignal.timeout(30_000) });
    return { status: response.status, size: Number(response.headers.get("content-length") ?? 0) || null, type: response.headers.get("content-type"), modified: response.headers.get("last-modified"), ranges: /bytes/i.test(response.headers.get("accept-ranges") ?? "") };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

/** Prvních 4 kB souboru na disku (druh a zaheslování). */
async function headBytes(file) {
  const handle = await open(file, "r");
  try {
    const buffer = Buffer.alloc(4096);
    const { bytesRead } = await handle.read(buffer, 0, 4096, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function inspect(file) {
  const bytes = await headBytes(file);
  let kind = packageKind(file, bytes);
  const encrypted = kind === "encrypted-office" || ((kind === "zip" || kind === "xlsx") && zipEntryEncrypted(bytes));
  // ZIP bez katalogu (XML / tabulky), jen knihovny Revit / výkresy → kreslicí data, ne datový balíček
  if (kind === "zip" && !encrypted) {
    const names = (await zipEntries(file)).map((entry) => entry.name);
    if (!names.some((name) => /\.(xml|xlsx?|csv)$/i.test(name)) && names.some((name) => /\.(rfa|rvt|dwg|dxf|stp|step|igs|ifc)$/i.test(name))) kind = "cad";
  }
  return { kind, encrypted };
}

async function download(url, target) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "follow", signal: AbortSignal.timeout(15 * 60_000) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(target));
  return statSync(target).size;
}

/** Vlastní kopie balíčku na disku (kořen projektu, data/, Stažené soubory). */
function localCopy(pattern) {
  const dirs = [ROOT, path.join(ROOT, "data"), path.join(ROOT, "data", "etim"), path.join(ROOT, "data", "etim", "raw"), path.join(os.homedir(), "Downloads")];
  const users = process.platform === "win32" ? path.join(path.parse(os.homedir()).root, "Users") : null;
  if (users && existsSync(users)) for (const user of readdirSync(users)) dirs.push(path.join(users, user, "Downloads"));
  for (const dir of dirs) {
    try {
      const name = readdirSync(dir).find((entry) => pattern.test(entry));
      if (name) return path.join(dir, name);
    } catch {
      // složka neexistuje / bez přístupu
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
//  Feedy ze stránek výrobků
// ---------------------------------------------------------------------------------------------------------------------

async function sitemapUrls(url) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`sitemap ${url}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const xml = (url.endsWith(".gz") ? gunzipSync(buffer) : buffer).toString("utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].replace(/&amp;/g, "&").trim());
  if (/<sitemapindex/i.test(xml)) {
    const nested = [];
    for (const loc of locs) nested.push(...(await sitemapUrls(loc)));
    return nested;
  }
  return locs;
}

async function feedKopos(log) {
  const urls = (await sitemapUrls("https://www.kopos.cz/sitemap.xml")).filter((url) => /\/cs\/produkt\/\d+-[^/]*(krabic|deska)/i.test(url));
  const products = [];
  let blocked = null;
  for (const url of urls.slice(0, feedLimit)) {
    if (!(await allowed(url))) continue;
    try {
      const page = await fetchPage(url);
      const product = page.status === 200 ? parseKoposProductPage(page.html, url) : null;
      if (product) products.push(product);
    } catch (error) {
      if (error instanceof Blocked) {
        blocked = error.message;
        break;
      }
    }
    await sleep(PAUSE_MS);
  }
  log(`kopos: e-shop ${urls.length} stránek krabic / desek v sitemap, přečteno ${products.length}${blocked ? `, zastaveno (${blocked})` : ""}`);
  return { file: "eshop-krabice.json", data: { source: "KOPOS KOLÍN a.s. – e-shop kopos.cz (stránky výrobků, sitemap)", retrievedAt: TODAY, products }, count: products.length, blocked };
}

/** Typové označení OEZ ze záznamu katalogu („neprůhledné dveře OEZ RZG-Z-1S8“ → „RZG-Z-1S8“). */
const oezType = (record) => {
  const matches = [...`${record.type_designation ?? ""}`.matchAll(/\b([A-Z]{2,5}[A-Z0-9]*-[A-Z0-9,.\-/]+)/g)].map((match) => match[1]);
  return matches.at(-1) ?? null;
};

async function feedOez(log) {
  const catalog = JSON.parse(await readFile(path.join(ROOT, "prisma", "external-catalog", "catalog.json"), "utf8"));
  const targets = catalog.filter((record) => record.manufacturer === "OEZ" && ["MCB", "RCD", "RCBO", "DISTRIBUTION_BOARD", "FUSE_DISCONNECTOR"].includes(record.category)).map((record) => ({ record, type: oezType(record), code: String(record.mpn).replace(/^OEZ:/i, "") })).filter((target) => target.type);
  const urls = new Set(await sitemapUrls("https://www.oez.cz/sitemap.xml"));
  const products = [];
  const missing = [];
  let blocked = null;
  for (const target of targets.slice(0, feedLimit)) {
    const slug = oezSlug(target.type);
    const exact = `https://www.oez.cz/${slug}`;
    const candidates = [...(urls.has(exact) ? [exact] : []), ...[...urls].filter((url) => url.startsWith(`${exact}-`) && /-\d{6,}$/.test(url))];
    let found = null;
    for (const url of candidates.slice(0, 4)) {
      if (!(await allowed(url))) continue;
      try {
        const page = await fetchPage(url);
        const product = page.status === 200 ? parseOezProductPage(page.html, url) : null;
        if (product && product.orderCode === target.code) found = product;
      } catch (error) {
        if (error instanceof Blocked) blocked = error.message;
      }
      await sleep(PAUSE_MS);
      if (found || blocked) break;
    }
    if (blocked) break;
    if (found) products.push({ ...found, catalogMpn: target.record.mpn });
    else missing.push(target.type);
  }
  log(`oez: katalog Eldocku ${targets.length} výrobků (jističe, chrániče, jističochrániče, rozvodnice), stránka výrobce nalezena u ${products.length}${missing.length ? `, bez stránky ${missing.length} (např. ${missing.slice(0, 5).join(", ")})` : ""}${blocked ? `, zastaveno (${blocked})` : ""}`);
  return { file: "produkty-web.json", data: { source: "OEZ s.r.o. – katalog oez.cz (stránky výrobků)", retrievedAt: TODAY, products }, count: products.length, blocked };
}

/** Stránka výrobku se.com → objednací číslo, název, EAN, hloubka a obrázky (download.se.com). */
async function schneiderProduct(mpn) {
  const url = `https://www.se.com/cz/cs/product/${encodeURIComponent(mpn)}/`;
  const page = await browserFetch(url);
  const data = await browserPage.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const images = [...document.querySelectorAll("img")].map((img) => img.currentSrc || img.src).filter((src) => /download\.(se|schneider-electric)\.com\/files\?/.test(src));
    const meta = (name) => document.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute("content") ?? null;
    return { text: text.slice(0, 60000), images, title: document.title, ogImage: meta("og:image") };
  });
  const ean = /EAN[^\d]{0,40}(\d{13})/.exec(data.text)?.[1] ?? null;
  const depth = /Hloubka[^\n\d]{0,60}(\d+(?:[.,]\d+)?)\s*mm/i.exec(data.text)?.[1] ?? null;
  // Obrázky: reference p_Doc_Ref (pohled zepředu / výchozí) – bez náhradního obrázku, aby chybějící vrátil 404
  const refs = [...new Set([...data.images, data.ogImage ?? ""].map((src) => /p_Doc_Ref=([^&]+)/.exec(src)?.[1]).filter(Boolean))];
  const ordered = [...refs].sort((a, b) => Number(/Default|Front|_main/i.test(b)) - Number(/Default|Front|_main/i.test(a)));
  return { mpn, page: page.url, status: page.status, title: data.title.replace(/\s*\|\s*Schneider Electric.*$/, ""), ean, depthMm: depth ? Number(depth.replace(",", ".")) : null, images: ordered.map((ref) => `https://download.se.com/files?p_Doc_Ref=${ref}&p_File_Type=rendition_1500_jpg`) };
}

async function feedSchneider(log) {
  if (!useBrowser) return { file: "produkty-web.json", data: null, count: 0, blocked: "bez prohlížeče (--no-browser)" };
  const wiring = JSON.parse(await readFile(path.join(ROOT, "prisma", "external-catalog", "wiring.json"), "utf8"));
  const catalog = JSON.parse(await readFile(path.join(ROOT, "prisma", "external-catalog", "catalog.json"), "utf8"));
  const picks = wiringPhotoPicks(wiring, undefined, ["Schneider"]);
  const boards = catalog.filter((record) => record.manufacturer === "SCHNEIDER" && record.category === "DISTRIBUTION_BOARD").map((record) => String(record.mpn));
  const mpns = [...new Set([...picks.map((pick) => pick.mpn), ...boards])].slice(0, feedLimit);
  // Stránky přečtené dřívějším během se znovu nenačítají (--refresh = všechny znovu)
  const previous = refresh ? [] : await readFile(path.join(DOWNLOADS, "schneider", "produkty-web.json"), "utf8").then((text) => JSON.parse(text).products ?? []).catch(() => []);
  const products = previous.filter((product) => mpns.includes(product.mpn));
  let blocked = null;
  for (const mpn of mpns) {
    if (products.some((product) => product.mpn === mpn)) continue;
    if (!(await allowed(`https://www.se.com/cz/cs/product/${mpn}/`))) continue;
    try {
      const product = await schneiderProduct(mpn);
      if (product.status === 200) products.push(product);
    } catch (error) {
      if (error instanceof Blocked) {
        blocked = error.message;
        break;
      }
    }
    await sleep(PAUSE_MS);
  }
  log(`schneider: se.com ${mpns.length} výrobků (${picks.length} dílů řad pro galerii, ${boards.length} rozvodnic), přečteno ${products.length}${previous.length ? ` (z dřívějšího běhu ${products.filter((product) => previous.includes(product)).length})` : ""}${blocked ? `, zastaveno (${blocked})` : ""}`);
  return { file: "produkty-web.json", data: { source: "Schneider Electric – se.com/cz (stránky výrobků, obrázky download.se.com)", retrievedAt: TODAY, products }, count: products.length, blocked };
}

const FEEDS = { kopos: feedKopos, oez: feedOez, schneider: feedSchneider };

// ---------------------------------------------------------------------------------------------------------------------
//  Hlavní běh
// ---------------------------------------------------------------------------------------------------------------------

async function discover(source, log) {
  const dir = path.join(DOWNLOADS, source.brand);
  const result = { brand: source.brand, label: source.label, pages: [], files: [], feeds: [], blocked: null, notes: [] };
  const queue = [...source.pages];
  const seen = new Set();
  const dataLinks = new Map();
  let followed = 0;
  while (queue.length) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    if (!(await allowed(url))) {
      result.pages.push({ url, status: "robots", note: "robots.txt zakazuje" });
      continue;
    }
    try {
      const page = await readPage(url, source);
      const note = accessNote(page.html);
      if (note && !result.notes.includes(note)) result.notes.push(note);
      result.pages.push({ url, final: page.url, status: page.status, via: page.via, ...(note ? { note } : {}) });
      if (page.status !== 200) continue;
      const host = new URL(page.url).host;
      for (const link of linksOf(page.html, page.url)) {
        if (DATA_LINK.test(link.url) && !CAD_LINK.test(link.url) && !SKIP_LINK.test(link.url)) {
          if (!dataLinks.has(link.url)) dataLinks.set(link.url, { url: link.url, label: link.text, page: page.url });
        } else if (followed < 6 && new URL(link.url).host === host && FOLLOW_LINK.test(link.url) && !NO_FOLLOW.test(link.url) && !seen.has(link.url) && !queue.includes(link.url) && !/\.(pdf|jpg|png|docx?)(\?|$)/i.test(link.url)) {
          queue.push(link.url);
          followed++;
        }
      }
    } catch (error) {
      // Výrobce „blokuje“, jen když se nenačetla žádná jeho stránka; jinak jen nedostupná vedlejší stránka (časový limit)
      const loadedAny = result.pages.some((entry) => entry.status === 200);
      result.pages.push({ url, status: loadedAny ? "nedostupná" : "blokuje", note: error.message });
      if (error instanceof Blocked && !result.blocked && !loadedAny) result.blocked = error.message;
    }
    await sleep(PAUSE_MS);
  }
  // Vlastní kopie balíčku na disku (ABB ETIM 9.0) – použije se místo stažení stejného souboru, a když web výrobce
  // automatizovaný přístup odmítne, je jediným zdrojem (zadání: „zpracuj lokální archiv, pokud je na disku“)
  const local = source.local ? localCopy(source.local) : null;
  if (local && ![...dataLinks.values()].some((link) => fileNameOf(link.url) === path.basename(local))) {
    const target = path.join(dir, path.basename(local));
    await mkdir(dir, { recursive: true });
    if (!existsSync(target) || statSync(target).size !== statSync(local).size) await copyFile(local, target);
    const entry = { url: null, name: path.basename(local), label: "vlastní kopie balíčku na disku", local, size: statSync(target).size, status: "kopie z disku", path: path.relative(ROOT, target).split(path.sep).join("/"), ...(await inspect(target)) };
    result.files.push(entry);
    log(`${source.brand}: kopie z disku ${entry.name} (${(entry.size / 1024 ** 2).toFixed(1)} MB) – ${local}`);
  }
  for (const link of dataLinks.values()) {
    const name = fileNameOf(link.url);
    const target = path.join(dir, name);
    const entry = { url: link.url, name, label: link.label, page: link.page };
    if (!(await allowed(link.url))) {
      result.files.push({ ...entry, status: "robots" });
      continue;
    }
    const info = await head(link.url);
    entry.size = info.size ?? null;
    entry.modified = info.modified ?? null;
    if (info.status && info.status !== 200 && info.status !== 405) {
      result.files.push({ ...entry, status: `HTTP ${info.status}` });
      continue;
    }
    if (info.size && info.size > MAX_DOWNLOAD) {
      entry.status = "vzdálený";
      entry.note = `archiv ${(info.size / 1024 ** 3).toFixed(1)} GB se nestahuje celý`;
      // Adresář fotobanky jen u výrobce bez fotek v datech ETIM (Legrand – databáze ETIM je pod heslem); Hager má
      // u každého výrobku v BMEcat přímou adresu fotky, jeho 7 GB archiv není potřeba
      if (source.photoArchive && /obrazky|obrázky|images|foto/i.test(name) && /\.zip$/i.test(name) && source.photoArchive.test(name)) {
        try {
          const directory = await remoteZipDirectory(link.url, { userAgent: USER_AGENT, size: info.size });
          const index = `${name.replace(/\.zip$/i, "")}.index.json`;
          await mkdir(dir, { recursive: true });
          await writeFile(path.join(dir, index), JSON.stringify({ url: link.url, size: info.size, retrievedAt: TODAY, entries: directory.entries.filter((file) => /\.(jpe?g|png|webp|tiff?|gif)$/i.test(file.name)).map((file) => [file.name, file.offset, file.compressed, file.method, file.uncompressed]) }));
          entry.index = index;
          entry.note += ` – přečten jen adresář (${directory.entries.length} souborů, ${(directory.directorySize / 1024 ** 2).toFixed(1)} MB), fotky po položkách přes HTTP Range`;
        } catch (error) {
          entry.note += ` – adresář nečitelný (${error.message})`;
        }
      }
      result.files.push(entry);
      continue;
    }
    try {
      if (existsSync(target) && !refresh && (!info.size || statSync(target).size === info.size)) entry.status = "na disku";
      else if (local && path.basename(local) === name && (!info.size || statSync(local).size === info.size)) {
        await mkdir(dir, { recursive: true });
        await copyFile(local, target);
        entry.status = "kopie z disku";
        entry.local = local;
      } else {
        entry.size = await download(link.url, target);
        entry.status = "staženo";
      }
      Object.assign(entry, await inspect(target));
      entry.path = path.relative(ROOT, target).split(path.sep).join("/");
      if (entry.encrypted) entry.note = "chráněno heslem – nelze číst (heslo se nehádá)";
      if (entry.kind === "html") entry.note = "místo souboru přišla stránka HTML";
      if (entry.kind === "cad") entry.note = "kreslicí data (knihovna Revit / výkresy), ne datový balíček";
    } catch (error) {
      entry.status = "chyba";
      entry.note = error.message;
    }
    result.files.push(entry);
    log(`${source.brand}: ${entry.status} ${name}${entry.size ? ` (${(entry.size / 1024 ** 2).toFixed(1)} MB)` : ""}${entry.note ? ` – ${entry.note}` : ""}`);
  }
  if (source.feed && useFeeds && FEEDS[source.feed]) {
    try {
      const feed = await FEEDS[source.feed](log);
      if (feed.data) {
        await mkdir(dir, { recursive: true });
        await writeFile(path.join(dir, feed.file), `${JSON.stringify(feed.data, null, 1)}\n`);
      }
      result.feeds.push({ name: feed.file, path: feed.data ? `data/etim/downloads/${source.brand}/${feed.file}` : null, count: feed.count, ...(feed.blocked ? { note: feed.blocked } : {}) });
      if (feed.blocked && !result.blocked) result.blocked = feed.blocked;
    } catch (error) {
      result.feeds.push({ name: source.feed, count: 0, note: error.message });
    }
  }
  return result;
}

async function main() {
  const sources = SOURCES.filter((source) => !only || only.includes(source.brand));
  const log = (line) => console.log(`  ${line}`);
  const previous = existsSync(path.join(DOWNLOADS, "discovery.json")) ? JSON.parse(await readFile(path.join(DOWNLOADS, "discovery.json"), "utf8")) : { sources: [] };
  const results = [];
  for (const source of sources) {
    console.log(`▶ ${source.label}`);
    results.push(await discover(source, log));
  }
  if (browser) await browser.close();
  // Výrobci mimo tento běh (--only) si ponechají předchozí výsledek
  const merged = [...previous.sources.filter((entry) => !results.some((result) => result.brand === entry.brand)), ...results].sort((a, b) => SOURCES.findIndex((source) => source.brand === a.brand) - SOURCES.findIndex((source) => source.brand === b.brand));
  await mkdir(DOWNLOADS, { recursive: true });
  await writeFile(path.join(DOWNLOADS, "discovery.json"), `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: merged }, null, 2)}\n`);

  console.log("");
  console.log("Výsledek vyhledání datových balíčků výrobců (data/etim/downloads/discovery.json)");
  console.log("┌─────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────┐");
  for (const entry of merged) {
    const files = entry.files.map((file) => `${file.name} [${file.status}${file.encrypted ? ", heslo" : ""}${file.size ? `, ${(file.size / 1024 ** 2).toFixed(1)} MB` : ""}]`);
    const feeds = entry.feeds.map((feed) => `${feed.name}: ${feed.count} výrobků${feed.note ? ` (${feed.note})` : ""}`);
    const lines = [...files, ...feeds, ...entry.notes.map((note) => `⚠ ${note}`), ...(entry.blocked ? [`⛔ blokuje automatizovaný přístup: ${entry.blocked} – nic se neobchází`] : [])];
    if (!lines.length) lines.push("žádný veřejný datový soubor nenalezen");
    lines.forEach((line, index) => console.log(`│ ${(index ? "" : entry.label).padEnd(19)} │ ${line.slice(0, 90).padEnd(90)} │`));
    console.log("├─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤");
  }
  console.log("└─────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────┘");
}

await main();
