import path from "node:path";

import { expect, test } from "@playwright/test";

// Fáze 95: import BIM (IFC) – vzorová hala do Správy závodů (okno kontroly, nová budova se zdroji, rozváděči a stroji,
// rozváděč z BIMu do AI Panel Builderu) a stejný soubor IFC do 2D půdorysu (podlaží, místnosti, prvky v měřítku 1 : 1).
test.describe.configure({ mode: "serial" });

const SAMPLE = path.join(process.cwd(), "public", "samples", "eldock-sample-plant.ifc");

test("🏢 Import vzorového BIM modelu haly do závodu → mapa, rozváděče s napájením a návrh RM1 v AI Panel Builderu", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/plant/plant-jbc");
    await expect(page.getByTestId("bim-import-sample")).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 180_000 });
  await page.getByTestId("bim-import-sample").click();
  const modal = page.getByTestId("bim-import-modal");
  await expect(modal).toBeVisible({ timeout: 30_000 });
  // Okno kontroly: stavba, zdroje, rozváděče, stroje a trasy z BIMu
  await expect(modal.getByTestId("bim-structure")).toContainText("84,0 × 42,5 m");
  await expect(modal.getByTestId("bim-structure")).toContainText("5 · 3 540 m²");
  await expect(modal.getByTestId("bim-sources")).toContainText("TR1 Trafostanice 630 kVA");
  await expect(modal.getByTestId("bim-sources")).toContainText("UPS1 UPS 60 kVA · UPS / ZIS");
  await expect(modal.locator('[data-testid="bim-board-row"]')).toHaveCount(3);
  await expect(modal.locator('[data-testid="bim-board-row"][data-tag="HR1"]')).toContainText("1000");
  await expect(modal.locator('[data-testid="bim-board-row"][data-tag="R-UPS"]')).toContainText("UPS / ZIS");
  await expect(modal.getByTestId("bim-machines")).toContainText("CNC-01 CNC Frézka 45 kW · 45 kW · z RM1");
  await expect(modal.getByTestId("bim-routes")).toContainText("94,7 m");
  await expect(modal.getByTestId("bim-mode-create")).toBeChecked();
  await page.screenshot({ path: "test-results/phase95-bim-summary.png" });

  await modal.getByTestId("bim-import-confirm").click();
  const result = modal.getByTestId("bim-import-result");
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result).toContainText("10 zařízení s napájením, zálohováním a QR kódy");
  await expect(result.locator('[data-testid="bim-result-board"]')).toHaveCount(3);
  await page.screenshot({ path: "test-results/phase95-bim-result.png" });

  // ⚡ RM1 → návrh v AI Panel Builderu (vývody CNC 80 A a lis 160 A z BIMu)
  await result.locator('[data-testid="bim-result-board"][data-tag="RM1"]').getByTestId("bim-board-to-panel-builder").click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/?]+$/, { timeout: 120_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RM1 - Podružný rozváděč lisovny 250 A", { timeout: 60_000 });
  await page.screenshot({ path: "test-results/phase95-panel-builder.png" });
});

test("📐 2D půdorys: nahrání BIM .ifc → 2 podlaží, místnosti s názvy, rozváděče a prvky v měřítku 1 : 1 bez kalibrace", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("button", { name: /Nahrát půdorys \(PDF \/ DXF \/ BIM \.ifc \/ Obrázek\)/ }).first()).toBeVisible();
  await page.getByTestId("floorplan-file-input").setInputFiles(SAMPLE);
  await expect(page.getByText(/BIM eldock-sample-plant\.ifc: 2 podlaží, 5 místností/)).toBeVisible({ timeout: 60_000 });
  const canvas = page.getByTestId("floorplan-canvas");
  for (const room of ["Rozvodna VN/NN", "Kompresorovna", "Velín údržby", "Výrobní hala M1"]) await expect(canvas.locator(`[data-room="${room}"]`).first()).toBeAttached();
  await expect(canvas.locator('[data-element="data-socket"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="emergency-light"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="subpanel"]')).toHaveCount(2);
  await page.screenshot({ path: "test-results/phase95-floorplan.png" });
});
