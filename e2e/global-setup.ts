import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { AUTH_COOKIE, signAuthToken } from "../src/lib/auth";
import { E2E_AUTH_SECRET, E2E_AUTH_STATE } from "./auth";

const UPLOAD_DIRS = ["photos", "revisions", "markups", "voice", "documents"].map((dir) => path.join("storage", "uploads", dir));

/**
 * Databázi připravuje už příkaz webServeru (`e2e/prepare-db.ts`). Tady podepíšeme přihlašovací cookie
 * pro všechny testy (`storageState`; test přihlášení ji vynuluje), zapamatujeme si čas
 * a po testech smažeme soubory, které testy nahrály (seedové složky `seed/` zůstanou).
 */
export default async function globalSetup(config: FullConfig) {
  const token = await signAuthToken("acc-novotny", { secret: E2E_AUTH_SECRET, ttl: 60 * 60 * 6 });
  mkdirSync(path.dirname(E2E_AUTH_STATE), { recursive: true });
  writeFileSync(
    E2E_AUTH_STATE,
    JSON.stringify({ cookies: [{ name: AUTH_COOKIE, value: token, domain: "localhost", path: "/", expires: -1, httpOnly: true, secure: false, sameSite: "Lax" }], origins: [] }),
  );
  await warmUp(config);
  const startedAt = Date.now();
  return function globalTeardown() {
    for (const dir of UPLOAD_DIRS) {
      let names: string[] = [];
      try {
        names = readdirSync(dir);
      } catch {
        continue;
      }
      for (const name of names) {
        const file = path.join(dir, name);
        const stat = statSync(file);
        if (stat.isFile() && stat.mtimeMs >= startedAt) rmSync(file, { force: true });
      }
    }
  };
}

/** Trasy, které testy otevírají jako první – studený dev server je kompiluje a mezitím stránky přenačítá. */
const WARM_ROUTES = [
  "/plant/plant-jbc",
  "/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np",
  "/equipment/eq-rm1",
  "/inspections",
  "/inspections/planner",
  "/studio",
  "/panel-builder",
  "/cae",
];

/**
 * Zahřátí dev serveru: každou trasu otevře v prohlížeči a počká, až se 4 s nepřenačte (max. 90 s).
 * Bez toho první testy na čerstvém serveru náhodně padají, protože se stránka během kompilace obnovuje.
 */
async function warmUp(config: FullConfig) {
  const project = config.projects[0];
  const baseURL = project.use.baseURL;
  if (!baseURL || process.env.E2E_SKIP_WARMUP === "1") return;
  const browser = await chromium.launch({ channel: project.use.channel });
  const context = await browser.newContext({ storageState: E2E_AUTH_STATE, baseURL });
  const page = await context.newPage();
  for (const route of WARM_ROUTES) {
    let lastNavigation = Date.now();
    const onNavigate = () => (lastNavigation = Date.now());
    page.on("framenavigated", onNavigate);
    const started = Date.now();
    try {
      await page.goto(route, { timeout: 120_000 });
      while (Date.now() - lastNavigation < 4_000 && Date.now() - started < 90_000) await page.waitForTimeout(500);
    } catch (error) {
      console.warn(`[e2e] Zahřátí ${route} selhalo:`, error instanceof Error ? error.message : error);
    }
    page.off("framenavigated", onNavigate);
  }
  await browser.close();
}
