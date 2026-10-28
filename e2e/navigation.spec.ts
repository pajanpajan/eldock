import { expect, test } from "@playwright/test";

import { pin, startAs } from "./helpers";

// 3úrovňová navigace: areál → izometrie budovy → půdorys patra → detail zařízení.
test("areál → budova → patro → detail zařízení", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/");
  await expect(page).toHaveURL(/\/plant\/plant-jbc$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Závod Jablonec");

  // Level 1: Hala A má oranžový odznak, klik na budovu v mapě → izometrie.
  const hallA = page.locator('svg [role=link][aria-label^="Hala A"]');
  await expect(hallA).toHaveAttribute("aria-label", /Hala A - Lisovna/);
  await hallA.click({ position: { x: 15, y: 15 } });
  await expect(page).toHaveURL(/\/building\/bld-jbc-a$/);

  // Level 2: patro v seznamu pater.
  await page.locator('ul[aria-label="Patra budovy"] a', { hasText: "Hlavní výroba" }).click();
  await expect(page).toHaveURL(/\/floor\/floor-jbc-a-1np$/);

  // Level 3: pin R-CNC-04 je oranžový, rychlý náhled → detail.
  const cnc = pin(page, "R-CNC-04");
  await expect(cnc).toHaveAttribute("aria-label", /Čeká na aktualizaci/);
  await cnc.click();
  await expect(page.getByRole("dialog")).toContainText("ZM-2026-0041");
  await page.getByRole("link", { name: "Otevřít detail" }).click();

  await expect(page).toHaveURL(/\/equipment\/eq-r-cnc-04$/);
  const banner = page.getByRole("alert", { name: "Výstraha: nahlášená změna" });
  await expect(banner).toContainText("Vyměněn stykač K4 za jiný typ");
  await expect(banner.locator("polyline")).not.toHaveCount(0);

  // Jednopodlažní Hala B vede z areálu rovnou na půdorys.
  await page.goto("/plant/plant-jbc");
  await page.locator('svg [role=link][aria-label^="Hala B"]').click({ position: { x: 15, y: 15 } });
  await expect(page).toHaveURL(/\/floor\/floor-jbc-b-1np$/);
  await expect(pin(page, "R-ML-01")).toHaveAttribute("aria-label", /Aktuální/);
});

test("QR odkaz otevře detail přímo a neexistující zařízení vrátí 404 stránku", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-rm1");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RM1");
  await expect(page.getByRole("region", { name: "Nová revize čeká na schválení" })).toContainText("v1.3");

  await page.goto("/equipment/neexistuje");
  await expect(page.getByText(/nenalezen|neexistuje/i).first()).toBeVisible();
});
