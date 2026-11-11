// Fáze 96: oznámení všech veřejných stránek vyhledávačům přes IndexNow – Seznam.cz (search.seznam.cz/indexnow)
// a IndexNow (api.indexnow.org → Bing a partneři protokolu). Adresy bere z živé sitemapy webu, klíč ze souboru
// `public/<32 znaků hex>.txt` (stejný jako `INDEXNOW_KEY` v `src/lib/indexnow.ts`). Pošle POST se seznamem adres
// (host, key, keyLocation, urlList) a GET ping s úvodní stránkou; vypíše stavové kódy (200 / 202 = přijato).
//
//   npm run seo:ping                 (po nasazení na produkci)
//   node scripts/seo-indexnow-ping.mjs --site=https://eldock.cz --dry-run

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ENDPOINTS = ["https://search.seznam.cz/indexnow", "https://api.indexnow.org/indexnow"];

/** Klíč IndexNow ze souboru `public/<klíč>.txt` (název = obsah, 32 znaků hex). */
export function readKey(publicDir = path.join(ROOT, "public")) {
  for (const name of readdirSync(publicDir)) {
    const match = /^([0-9a-f]{32})\.txt$/.exec(name);
    if (match && readFileSync(path.join(publicDir, name), "utf8").trim() === match[1]) return match[1];
  }
  throw new Error("V public/ chybí soubor klíče IndexNow (<32 znaků hex>.txt).");
}

/** Adresy `<loc>` ze sitemap.xml. */
export function parseSitemap(xml) {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1].replace(/&amp;/g, "&"));
}

export function payloadFor(site, key, urls) {
  const host = new URL(site).host;
  return { host, key, keyLocation: `${new URL(site).origin}/${key}.txt`, urlList: [...new Set(urls.filter((url) => new URL(url).host === host))] };
}

async function send(endpoint, method, payload) {
  const url = method === "POST" ? endpoint : `${endpoint}?url=${encodeURIComponent(payload.urlList[0])}&key=${payload.key}`;
  try {
    const response = await fetch(url, method === "POST" ? { method, headers: { "Content-Type": "application/json; charset=utf-8" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20_000) } : { signal: AbortSignal.timeout(20_000) });
    const text = (await response.text().catch(() => "")).trim().replace(/\s+/g, " ").slice(0, 160);
    return { status: response.status, text };
  } catch (error) {
    return { status: 0, text: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const site = (args.find((arg) => arg.startsWith("--site="))?.slice(7) ?? "https://eldock.cz").replace(/\/$/, "");
  const dryRun = args.includes("--dry-run");
  const key = readKey();
  const sitemap = await fetch(`${site}/sitemap.xml`, { signal: AbortSignal.timeout(20_000) });
  if (!sitemap.ok) throw new Error(`${site}/sitemap.xml vrátil ${sitemap.status}.`);
  const urls = parseSitemap(await sitemap.text());
  const keyFile = await fetch(`${site}/${key}.txt`, { signal: AbortSignal.timeout(20_000) });
  console.log(`IndexNow: ${urls.length} adres ze ${site}/sitemap.xml, klíč ${site}/${key}.txt → ${keyFile.status}`);
  const payload = payloadFor(site, key, urls);
  if (dryRun) return void console.log(JSON.stringify(payload, null, 2));
  let accepted = 0;
  for (const endpoint of ENDPOINTS) {
    for (const method of ["POST", "GET"]) {
      const result = await send(endpoint, method, payload);
      const ok = result.status === 200 || result.status === 202;
      if (ok) accepted++;
      console.log(`${ok ? "✅" : "❌"} ${method.padEnd(4)} ${endpoint} → HTTP ${result.status}${method === "POST" ? ` (${payload.urlList.length} adres)` : ` (${payload.urlList[0]})`}${result.text ? ` · ${result.text}` : ""}`);
    }
  }
  if (!accepted) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
