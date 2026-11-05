import path from "node:path";

import { expect, test } from "@playwright/test";

// Fáze 51: loga výrobců z public/brands, vyčištěný rozcestník katalogu, nový dialog projektu (2×2 dlaždice,
// více fotek), kaskáda výrobce → řada → barva v 2D půdorysu a úpravy místností (kóty, rozměr, smazání).
test.describe.configure({ mode: "serial" });

const PHOTO = path.resolve("e2e", "fixtures", "rozvadec.png");

test("🏷️ loga výrobců a rozcestník katalogu bez okrajových značek", async ({ page }) => {
  await expect(async () => {
    await page.goto("/panel-builder/catalog");
    await expect(page.getByTestId("catalog-brands")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  const brands = page.getByTestId("catalog-brands");
  const abb = brands.locator('[data-logo="ABB"] img');
  await expect(abb).toHaveAttribute("src", "/api/brand-logo/abb");
  await expect.poll(() => abb.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  for (const hidden of ["Orno", "Pollock", "Lovato", "Pfannenberg", "STEGO"]) await expect(brands.locator(`[data-logo="${hidden}"]`)).toHaveCount(0);
  // Logo je veřejný soubor (SVG z public/brands), neznámá značka = generovaný wordmark
  const response = await page.request.get("/api/brand-logo/siemens");
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await (await page.request.get("/api/brand-logo/neznama-znacka?name=Neznámá")).text()).toContain("NEZNÁMÁ");
});

test("📷 nový projekt: dlaždice 2×2, více fotek (celková + detail lišty)", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByTestId("project-modes")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 90_000 });
  const modes = page.getByTestId("project-modes");
  await expect(modes.locator("button, a")).toHaveCount(4);
  await expect(modes).not.toContainText("[");
  await expect(modes.getByRole("link", { name: "2D půdorys & kabeláž" })).toHaveAttribute("href", "/panel-builder/floorplan");
  await modes.getByRole("button", { name: /Pasport z fotek/ }).click();
  await page.getByLabel("Název rozváděče").fill("RP51 z více fotek");
  await page.getByLabel("Fotky rozváděče").setInputFiles([PHOTO, PHOTO]);
  const shots = page.getByTestId("project-shots").locator("li");
  await expect(shots).toHaveCount(2, { timeout: 30_000 });
  await expect(shots.first()).toHaveAttribute("data-shot", "main");
  await expect(shots.nth(1)).toHaveAttribute("data-shot", "rail-1");
  await expect(page.getByTestId("shots-summary")).toContainText("detaily lišt: 1");
  await page.getByRole("button", { name: "Založit a analyzovat fotku" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RP51 z více fotek");
  await page.getByTestId("delete-project").click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
});

test("🎨 2D půdorys: kaskáda výrobce → řada → barva, živé kóty a úpravy místnosti", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await expect(palette.getByRole("button", { name: /Dvojitý střídavý přepínač č\. 6\+6/ })).toBeVisible();
  await expect(palette.getByRole("button", { name: /Pokojový termostat/ })).toBeVisible();

  // Kaskáda: Schneider Electric → Asfora → černá
  const appearance = page.getByTestId("device-appearance");
  await appearance.getByRole("radio", { name: "Schneider Electric" }).click();
  await appearance.getByRole("radio", { name: "Asfora" }).click();
  await appearance.getByRole("radio", { name: /Černá matná/ }).click();

  // Kreslení místnosti s živými kótami
  const canvas = page.getByTestId("floorplan-canvas");
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 5 });
  await expect(page.getByTestId("dim-x")).toContainText("X:");
  await expect(page.getByTestId("dim-y")).toContainText("Y:");
  await expect(page.getByTestId("dim-area")).toContainText("m²");
  await page.mouse.up();

  // Vybraná místnost: rychlý štítek názvu, rozměr X v metrech, aktivní roh
  const detail = page.getByTestId("room-detail");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: "Kuchyně", exact: true }).click();
  await expect(detail.getByLabel("Název místnosti")).toHaveValue("Kuchyně");
  await detail.getByLabel("Šířka X [m]").fill("5");
  await detail.getByLabel("Šířka X [m]").press("Enter");
  await expect(page.getByTestId("room-area")).toContainText("5 ×");
  await expect(page.getByTestId("room-handle")).toBeVisible();

  // Zásuvka v místnosti dostane zvolenou řadu a barvu
  await palette.getByRole("button", { name: "Jednozásuvka" }).click();
  await canvas.click({ position: { x: 180, y: 180 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("element-appearance")).toHaveText("Schneider Electric Asfora · Černá matná / Antracit");
  await expect(page.getByTestId("wiring-inventory")).toContainText("Jednozásuvka – Schneider Electric Asfora · Černá matná / Antracit");

  // Smazání místnosti (tlačítko v detailu)
  await canvas.locator('[data-testid="room-Kuchyně"]').dispatchEvent("pointerdown");
  await expect(detail).toBeVisible();
  await detail.getByRole("button", { name: /Smazat místnost/ }).click();
  await expect(page.getByTestId("room-detail")).toHaveCount(0);
  await expect(canvas.locator('[data-testid="room-Kuchyně"]')).toHaveCount(0);
  await page.screenshot({ path: "test-results/phase51-floorplan.png", fullPage: true });
});
