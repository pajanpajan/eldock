import { expect, test, type Locator, type Page } from "@playwright/test";

import { goPhase } from "./floorplan-phases";

// Fáze 109: 2D půdorys – 🎨 barva značek (dle typu / červená kontrola se ztlumeným podkladem / vlastní), 3D náhled
// s poloprůhlednými stěnami a odlišenými prvky, nábytek po jednom kusu (bez duplicitního WC), panely ABB-free@home
// s náhledem a číslem podle barvy a 🔄 převod Klasická 230 V ⇄ Smart Home se zachováním obou variant.
test.describe.configure({ mode: "serial" });

async function open(page: Page, url: string) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto(url);
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

async function clickAt(page: Page, canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const at = await canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const value = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  }, { x, y });
  await page.mouse.click(at.x, at.y);
}

test("🎨 barva značek a 🧊 3D náhled: červená kontrola ztlumí podklad, dle typu syté barvy, stěny do stropu a odlišené prvky", async ({ page }) => {
  test.setTimeout(360_000);
  await open(page, "/panel-builder/floorplan?demo=rd-4kk");
  const canvas = page.getByTestId("floorplan-canvas");
  await goPhase(page, 3);
  const colors = page.getByTestId("symbol-color").first();
  await expect(colors).toBeVisible();
  await colors.getByTestId("symbol-color-red").click();
  await expect(page.getByTestId("plan-underlay")).toHaveAttribute("data-dimmed", "true");
  await expect(canvas.locator('[data-symbol] g[stroke="#ff2e2e"]').first()).toBeAttached();
  await colors.getByTestId("symbol-color-type").click();
  await expect(page.getByTestId("plan-underlay")).toHaveAttribute("data-dimmed", "false");
  await expect(canvas.locator('[data-element="socket"] g[stroke="#38bdf8"], [data-element="double-socket"] g[stroke="#38bdf8"]').first()).toBeAttached();
  await colors.getByTestId("symbol-color-custom").click();
  await colors.getByTestId("symbol-color-input").fill("#00ff88");
  await expect(canvas.locator('[data-symbol] g[stroke="#00ff88"]').first()).toBeAttached();
  await colors.getByTestId("symbol-color-type").click();

  await page.getByTestId("pseudo3d-open").click();
  const modal = page.getByTestId("pseudo3d-modal");
  const iso = modal.getByTestId("pseudo3d-iso");
  await expect(iso).toBeVisible();
  expect(await iso.getByTestId("pseudo3d-wall-face").count()).toBeGreaterThan(8);
  expect(await iso.getByTestId("pseudo3d-room-label").count()).toBeGreaterThan(2);
  await expect(iso.locator('[data-kind="switch"][data-color="#10b981"]').first()).toBeAttached();
  await expect(iso.locator('[data-kind="light"][data-color="#fde047"]').first()).toBeAttached();
  await expect(modal.getByTestId("pseudo3d-legend")).toContainText("🟢 vypínač");
  await expect(modal.getByTestId("pseudo3d-legend")).toContainText("⚪ nábytek / zařizovací předměty");
  await page.keyboard.press("Escape");
});

test("🔄 převod Smart Home ⇄ Klasická 230 V: původní návrh zůstane jako varianta, přepnutí jedním klikem s rozdílem kabelů a ceny práce", async ({ page }) => {
  test.setTimeout(360_000);
  // Vzorový RD 4+kk je chytrá domácnost ABB-free@home (sběrnicová úroveň)
  await open(page, "/panel-builder/floorplan?demo=rd-4kk");
  const canvas = page.getByTestId("floorplan-canvas");
  await goPhase(page, 4);
  const lightButtons = canvas.locator('[data-element="bus-1"], [data-element="bus-2"], [data-element="bus-4"], [data-element="bus-6"]');
  const busCount = await lightButtons.count();
  expect(busCount).toBeGreaterThan(0);
  await page.getByTestId("convert-installation").first().click();
  let modal = page.getByTestId("convert-installation-modal");
  await expect(modal).toHaveAttribute("data-target", "classic");
  await modal.getByTestId("convert-classic-series").selectOption("ABB|Levit");
  await modal.getByTestId("convert-submit").click();
  await expect(modal).toBeHidden({ timeout: 30_000 });

  const variants = page.getByTestId("project-variants");
  await expect(variants).toHaveAttribute("data-active", "v2");
  await expect(variants.getByTestId("project-variant-v1")).toContainText("🤖 Varianta 1: Smart Home – ABB-free@home® (Původní)");
  await expect(variants.getByTestId("project-variant-v2")).toContainText("⚡ Varianta 2: Klasická 230 V");
  await expect(variants.getByTestId("project-variant-diff")).toContainText("Kabely:", { timeout: 30_000 });
  await expect(variants.getByTestId("project-variant-diff")).toContainText("Práce a revize:");
  await expect(lightButtons).toHaveCount(0);
  expect(await canvas.locator('[data-element^="switch-"]').count()).toBeGreaterThan(0);

  // Klasická → Smart Home s volbami převodu (třetí varianta)
  await page.getByTestId("convert-installation").first().click();
  modal = page.getByTestId("convert-installation-modal");
  await expect(modal).toHaveAttribute("data-target", "smart");
  await modal.getByTestId("convert-system-abb_freeathome").click();
  await expect(modal.getByTestId("convert-replaceSwitches")).toBeChecked();
  await expect(modal.getByTestId("convert-mergeDoorControls")).toBeChecked();
  await expect(modal.getByTestId("convert-starTopology")).toBeChecked();
  await expect(modal.getByTestId("convert-dimMainLights")).not.toBeChecked();
  await modal.getByTestId("convert-addPresence").check();
  await modal.getByTestId("convert-submit").click();
  await expect(modal).toBeHidden({ timeout: 30_000 });
  await expect(variants).toHaveAttribute("data-active", "v3");
  await expect(variants.getByTestId("project-variant-v3")).toContainText("🤖 Varianta 3: Smart Home – ABB-free@home®");
  await expect(canvas.locator('[data-element^="switch-"]')).toHaveCount(0);

  // Jedním klikem zpět na původní návrh – sběrnicová tlačítka jako na začátku
  await variants.getByTestId("project-variant-v1").click();
  await expect(variants).toHaveAttribute("data-active", "v1");
  await expect(lightButtons).toHaveCount(busCount);
});

test("📦 nábytek po jednom kusu, WC jen v Koupelně a panely ABB s náhledem i číslem podle barvy", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await open(page, "/panel-builder/floorplan/novy");
  const canvas = page.getByTestId("floorplan-canvas");
  await goPhase(page, 2);
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await expect(palette.getByRole("button", { name: /WC mísa/ })).toHaveCount(1);
  await palette.getByRole("button", { name: /Kuchyňská linka/ }).first().click();
  await clickAt(page, canvas, 5000, 5000);
  await expect(canvas.locator('[data-element="arch-kitchen"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="arch-kitchen"]')).toHaveAttribute("data-selected", "true");
  // Nástroj se vrátil na Výběr – další klik do výkresu druhou linku nevloží
  await clickAt(page, canvas, 12000, 9000);
  await expect(canvas.locator('[data-element="arch-kitchen"]')).toHaveCount(1);

  await goPhase(page, 4);
  const appearance = page.getByTestId("device-appearance");
  await appearance.getByTestId("abb-families").locator('[data-family="abb-fah"]').click();
  const catalog = appearance.getByTestId("smart-catalog");
  await catalog.getByTestId("smart-catalog-level").getByRole("button", { name: "Přepnout na sběrnicovou instalaci" }).click();
  if (await page.getByTestId("level-conversion").isVisible()) await page.getByTestId("level-convert").click();
  await catalog.getByTestId("smart-tab-controls").click();
  const roomTouch = catalog.locator('[data-card="fah-roomtouch-4"]');
  await roomTouch.getByRole("radio", { name: "Černá / antracit" }).click();
  await expect(roomTouch.locator('svg[data-panel="room-touch"]')).toHaveAttribute("data-tone", "black");
  await expect(roomTouch.getByTestId("device-mpn")).toHaveText("MPN 2TMA310011B0003");
  await roomTouch.getByRole("radio", { name: "Bílá" }).click();
  await expect(roomTouch.locator('svg[data-panel="room-touch"]')).toHaveAttribute("data-tone", "white");
  await expect(roomTouch.getByTestId("device-mpn")).toHaveText("MPN 2TMA310011W0001");
  const trevion = catalog.locator('[data-card="fah-trevion"]');
  await trevion.getByRole("radio", { name: "Černá" }).click();
  await expect(trevion.locator('svg[data-panel="trevion"]')).toHaveAttribute("data-tone", "black");
  await expect(trevion.getByTestId("device-mpn")).toHaveText("MPN 2TMA310011B0001");
  await trevion.getByRole("radio", { name: "Bílá" }).click();
  await expect(trevion.locator('svg[data-panel="trevion"]')).toHaveAttribute("data-tone", "white");
  await expect(trevion.getByTestId("device-mpn")).toHaveText("MPN: ověřte u výrobce");
});
