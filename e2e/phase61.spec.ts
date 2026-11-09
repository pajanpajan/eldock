import { expect, test } from "@playwright/test";

// Fáze 61: chytrá domácnost (systém a výrobce, spínací / stmívací akční členy podle zátěží, moduly do rozváděče),
// normový hlídač půdorysu (koupelnové zóny, IP44) a galerie designových řad ABB podle katalogu 2026.
test.describe.configure({ mode: "serial" });

test("chytrá domácnost: akční členy ABB-free@home / KNX podle svítidel, normový hlídač a galerie řad → rozváděč s moduly", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const choose = (label: string) => palette.getByRole("button", { name: label, exact: false }).first().click();

  // Galerie řad: Busch-axcent v provedení beton → náhled s materiálem kámen → použít
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await gallery.getByTestId("gallery-series-Busch-axcent").click();
  // Fáze 74: barva řady (klapka / kryt) – řada barev rámečku pod ní má stejné názvy
  await gallery.getByRole("radiogroup", { name: "Barva řady" }).getByRole("radio", { name: /Mechová černá \/ beton/ }).click();
  await expect(gallery.getByTestId("gallery-preview").locator('[data-material="stone"]').first()).toBeAttached();
  await expect(gallery.getByTestId("gallery-details")).toContainText("2CKA001754A4795");
  await gallery.screenshot({ path: "test-results/phase61-gallery.png" });
  await gallery.getByTestId("gallery-apply").click();
  await expect(page.getByTestId("device-appearance").getByRole("radio", { name: "Busch-axcent" })).toHaveAttribute("aria-checked", "true");

  // Koupelna s vanou: zásuvka u vany = chyba zóny, oprava IP44 jedním klikem
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 700, box.y + 560, { steps: 6 });
  await page.mouse.up();
  await page.getByTestId("room-detail").getByRole("button", { name: "Koupelna", exact: true }).click();
  await choose("Hlavní domovní / bytový rozváděč");
  await canvas.click({ position: { x: 140, y: 520 } });
  await choose("Vana");
  await canvas.click({ position: { x: 300, y: 300 } });
  // Zásuvka 0,3 m nad hranou vany (vana 1700 × 750 mm se středem v místě kliknutí) – měřítko plátna z viewBox
  const mmPerPx = await canvas.evaluate((svg) => {
    const view = (svg as SVGSVGElement).viewBox.baseVal;
    const rect = svg.getBoundingClientRect();
    return Math.max(view.width / rect.width, view.height / rect.height);
  });
  await choose("Jednozásuvka");
  await canvas.click({ position: { x: 300, y: Math.round(300 - (375 + 300) / mmPerPx) } });
  await page.keyboard.press("Escape");
  const checks = page.getByTestId("plan-checks");
  await expect(checks.locator('[data-check^="bath-zone"]')).toContainText("zóně 0–2");
  await checks.locator('[data-check^="wet-ip"]').getByRole("button", { name: /na zásuvku IP44/ }).click();
  await expect(canvas.locator('[data-element="ip44-socket"]')).toHaveCount(1);

  // Sběrnicová instalace: světla a tlačítka → výpočet akčních členů ABB-free@home, pak KNX
  await page.getByTestId("install-methodology").getByLabel("Úroveň instalace").selectOption("bus_loxone");
  await choose("Stropní svítidlo");
  await canvas.click({ position: { x: 500, y: 250 } });
  await canvas.click({ position: { x: 560, y: 420 } });
  await page.keyboard.press("Escape");
  // Druhé světlo stmívané 300 W → 2 kanály stmívače paralelně
  await canvas.locator('[data-element="ceiling-light"]').nth(1).click();
  const spec = page.getByTestId("light-spec");
  await spec.getByLabel("Stmívané svítidlo").check();
  await spec.getByLabel("Příkon svítidla [W]").fill("300");
  await choose("Sběrnicové tlačítko 2násobné");
  await canvas.click({ position: { x: 640, y: 112 } });
  await page.keyboard.press("Escape");
  const smart = page.getByTestId("smart-home");
  await expect(smart.getByTestId("smart-modules")).toContainText("SA-M-4.16.2.2");
  await expect(smart.getByTestId("smart-modules")).toContainText("DA/M.4.210.2.1");
  await expect(smart.getByTestId("smart-modules")).toContainText("PS-M-64.1.1");
  await expect(smart).toContainText("2 kanály stmívače paralelně");
  await smart.getByTestId("smart-system-abb_knx").click();
  await expect(smart.getByTestId("smart-modules")).toContainText("UD/S 4.210.2.1");
  await expect(smart.getByTestId("smart-modules")).toContainText("SV/S 30.640.5.1");
  await page.screenshot({ path: "test-results/phase61-smart.png", fullPage: false });

  // Rozváděč z půdorysu s akčními členy KNX
  await page.getByTestId("floorplan-environment").selectOption("INDOOR_DRY");
  await page.getByLabel("Název rozváděče").fill("RD61 KNX");
  await page.getByTestId("generate-from-floorplan").click();
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD61 KNX");
  await expect(page.getByTestId("vector-panel").getByRole("button", { name: /UD\/S 4\.210\.2\.1/ }).first()).toBeVisible();
});
