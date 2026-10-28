import { mkdirSync } from "node:fs";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { startAs, type Role } from "./helpers";

// Screenshoty klíčových obrazovek do docs/screenshots/ (nad čistým seedem, před workflow testem).
// Spouští se jen na vyžádání, aby běžný běh E2E neměnil soubory v repozitáři:
//   E2E_SCREENSHOTS=1 npm run test:e2e   (PowerShell: $env:E2E_SCREENSHOTS=1; npm run test:e2e)

const OUT = path.resolve("docs", "screenshots");

test.skip(!process.env.E2E_SCREENSHOTS, "Screenshoty jen s E2E_SCREENSHOTS=1");

async function shot(page: Page, role: Role, url: string, name: string, prepare?: (page: Page) => Promise<void>) {
  await startAs(page, role);
  await page.goto(url);
  await page.waitForLoadState("networkidle");
  // Tlačítko Next.js Dev Tools do dokumentace nepatří.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  if (prepare) await prepare(page);
  // Animace přechodů a toasty dobíhají.
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

test("klíčové obrazovky", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.emulateMedia({ reducedMotion: "reduce" });

  await shot(page, "MAINTENANCE", "/plant/plant-jbc", "01-areal");
  await shot(page, "MAINTENANCE", "/plant/plant-jbc/building/bld-jbc-a", "02-izometrie", async (p) => {
    await p.locator('ul[aria-label="Patra budovy"] a', { hasText: "Hlavní výroba" }).hover();
  });
  await shot(page, "MAINTENANCE", "/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np", "03-pudorys");
  await shot(page, "MAINTENANCE", "/equipment/eq-r-cnc-04", "04-detail-banner");
  await shot(page, "MAINTENANCE", "/equipment/eq-r-ml-01?tab=history", "05-historie-revizi");
  await shot(page, "MAINTENANCE", "/equipment/eq-r-ml-01/change-request", "06-pruvodce-zakres");
  await shot(page, "MAINTENANCE", "/equipment/eq-rm1/approve", "07-schvaleni-porovnani");
  await shot(page, "CAE_ENGINEER", "/cae", "08-cae-dashboard");
  await shot(page, "CAE_ENGINEER", "/cae", "09-cae-ticket", async (p) => {
    await p.getByRole("link", { name: "ZM-2026-0041" }).click();
    await expect(p).toHaveURL(/\/cae\/tickets\//);
    await p.waitForLoadState("networkidle");
  });

  // Tablet na výšku (dotyk) – detail zařízení.
  await page.setViewportSize({ width: 820, height: 1180 });
  await shot(page, "MAINTENANCE", "/equipment/eq-rm1", "10-tablet-detail");
});
