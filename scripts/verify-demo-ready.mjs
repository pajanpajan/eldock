#!/usr/bin/env node
// Fáze 99: „pre-flight check“ před prezentací ELDOCK – `npm run verify:demo`.
//
//   npm run verify:demo            → Playwright proti vlastnímu E2E serveru (čistá databáze e2e.db, port 3200):
//                                    e2e/demo-ready.spec.ts (prezentace, demo scénáře, vzorový rozváděč, průmyslový
//                                    závod – bez chyb v konzoli), e2e/phase99.spec.ts (rozlišení 1366 × 768 a 1536 × 864)
//                                    a e2e/phase100.spec.ts (🌗 podklad, paleta, 4 záložky, výkon plátna, galerie řad)
//   npm run verify:demo -- --prod  → navíc rychlá kontrola produkce https://eldock.cz (veřejné stránky, /prezentace
//                                    s 10 slidy a One-Pagerem, fotky katalogu a jejich mezipaměť) – bez přihlášení, nic se
//                                    nezapisuje
//   npm run verify:demo -- --only-prod → jen kontrola produkce (po nasazení, bez lokálního E2E serveru)
//   --keep-cache                   → nemazat build E2E serveru (.next-e2e) – rychlejší opakovaný běh bez změn kódu
import { existsSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const PROD_URL = process.env.DEMO_PROD_URL ?? "https://eldock.cz";
const results = [];

function step(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? ` – ${detail}` : ""}`);
}

async function productionCheck() {
  const { chromium } = await import("@playwright/test");
  for (const pathname of ["/", "/panel-builder", "/ukazka-elaboratu", "/navody", "/prezentace", "/robots.txt", "/sitemap.xml"]) {
    try {
      const response = await fetch(`${PROD_URL}${pathname}`, { redirect: "manual", headers: { "User-Agent": "Mozilla/5.0 (compatible; demo-preflight/1.0)" } });
      step(`produkce ${pathname}`, response.status === 200, `HTTP ${response.status}`);
    } catch (error) {
      step(`produkce ${pathname}`, false, String(error));
    }
  }
  // Fotky katalogu: vzorek z manifestu (první z každé složky výrobce) – 200 image/webp
  const manifest = JSON.parse(readFileSync(path.join(ROOT, "public", "catalog-images", "manifest.json"), "utf8"));
  const files = [...(manifest.photos ?? []), ...(manifest.products ?? [])].map((entry) => entry.file);
  const sample = [...new Map(files.map((file) => [file.split("/").slice(0, 2).join("/"), file])).values()];
  let broken = 0;
  for (const file of sample) {
    const response = await fetch(`${PROD_URL}/catalog-images/${file}`, { method: "HEAD" }).catch(() => null);
    if (!response || response.status !== 200 || !(response.headers.get("content-type") ?? "").startsWith("image/")) broken += 1;
  }
  step("produkce – fotky katalogu", broken === 0, `${sample.length - broken} / ${sample.length} složek výrobců vrací image/*`);
  // Fáze 100: statické fotky katalogu rok v mezipaměti prohlížeče (next.config.ts headers)
  const cached = sample.length ? await fetch(`${PROD_URL}/catalog-images/${sample[0]}`, { method: "HEAD" }).catch(() => null) : null;
  const cacheControl = cached?.headers.get("cache-control") ?? "";
  step("produkce – mezipaměť fotek katalogu", cacheControl.includes("max-age=31536000") && cacheControl.includes("immutable"), cacheControl || "bez hlavičky Cache-Control");

  const browser = await chromium.launch({ channel: process.env.E2E_BROWSER_CHANNEL || "msedge" }).catch(() => chromium.launch());
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    await page.goto(`${PROD_URL}/prezentace`, { waitUntil: "networkidle" });
    const slides = await page.getByTestId("pitch-slide").count();
    step("produkce /prezentace – 10 slidů", slides === 10, `${slides} slidů`);
    await page.getByTestId("pitch-mode-onepager").click();
    const onePager = await page.getByTestId("pitch-onepager").isVisible();
    step("produkce /prezentace – Executive One-Pager A4", onePager);
    step("produkce /prezentace – konzole bez chyb", errors.length === 0, errors.slice(0, 3).join(" | "));
  } finally {
    await browser.close();
  }
}

function localCheck() {
  if (!args.has("--keep-cache") && existsSync(path.join(ROOT, ".next-e2e"))) {
    rmSync(path.join(ROOT, ".next-e2e"), { recursive: true, force: true });
    console.log("🧹 Smazán build E2E serveru (.next-e2e) – server se přeloží z aktuálního kódu.");
  }
  console.log("▶ Playwright: e2e/demo-ready.spec.ts + e2e/phase99.spec.ts + e2e/phase100.spec.ts (E2E server na portu 3200, čistá databáze e2e.db)\n");
  const run = spawnSync("npx", ["playwright", "test", "e2e/demo-ready.spec.ts", "e2e/phase99.spec.ts", "e2e/phase100.spec.ts", "--reporter=list"], { cwd: ROOT, stdio: "inherit", shell: process.platform === "win32" });
  step("lokální E2E kontrola živé ukázky", run.status === 0, run.status === 0 ? "prezentace, demo scénáře, rozváděč, závod, rozlišení a vzhled 2D půdorysu" : `Playwright skončil kódem ${run.status}`);
}

console.log("🎯 ELDOCK – kontrola připravenosti živé ukázky a prezentace\n");
if (!args.has("--only-prod")) localCheck();
if (args.has("--prod") || args.has("--only-prod")) await productionCheck();
const failed = results.filter((result) => !result.ok);
console.log(`\n${failed.length ? "❌" : "✅"} ${results.length - failed.length} / ${results.length} kontrol v pořádku${failed.length ? ` – oprav: ${failed.map((result) => result.name).join(", ")}` : " – ukázka je připravená."}`);
process.exit(failed.length ? 1 : 0);
