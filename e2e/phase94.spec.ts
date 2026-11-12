import { expect, test, type Locator, type Page } from "@playwright/test";

import { ensureActive, goPhase, goPhaseForGroup, phaseForPalette } from "./floorplan-phases";

// Fáze 94: oficiální data ABB ETIM 9.0 – skutečné fotky v galerii řad (díly s objednacím číslem, dlaždice barvy
// rámečku, rámečky 1R–5R z dat výrobce), vestavná hloubka přístroje v detailu krabičky, EAN v kusovníku a fotky
// rozvodnic (nový projekt, výběr skříně, dokumentace).
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

async function screen(canvas: Locator, x: number, y: number) {
  await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

/** Obrázek se opravdu načetl (soubor existuje, prohlížeč ho dekódoval). */
async function loaded(image: Locator) {
  await expect.poll(() => image.evaluate((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth), { timeout: 30_000 }).toBeGreaterThan(0);
}

test("🖼️ Galerie řad: skutečné fotky ABB s objednacím číslem, fotky rámečků v barvách a rámečky 1R–5R z dat výrobce", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  // Fáze 98: design vypínačů (galerie řad, výrobce, barvy) je v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await gallery.getByTestId("gallery-series-Tango").click();
  await gallery.getByTestId("gallery-color").filter({ hasText: "Bílá (B)" }).first().click();
  const preview = gallery.getByTestId("gallery-preview");
  // Spínač, zásuvka i víceramček = fotky výrobce (ne render)
  await expect(preview.locator('[data-testid="gallery-photo"][data-real="true"]')).toHaveCount(3);
  await expect(preview.locator('[data-slot="socket"]').getByTestId("gallery-photo-mpn")).toHaveText("č. 6619A-A06357 B");
  await expect(preview.locator('[data-slot="set"]')).toContainText("Víceramček – rámeček 2R");
  await loaded(preview.locator('[data-slot="socket"] img'));
  await expect(gallery.getByTestId("gallery-photo-source")).toContainText("ABB – oficiální data ETIM 9.0");
  // Dlaždice barvy rámečku s fotkou rámečku 1R, rámečky 1R–5R potvrzené v datech výrobce
  expect(await gallery.getByTestId("gallery-frame-photo").count()).toBeGreaterThan(3);
  await loaded(gallery.getByTestId("gallery-frame-photo").first());
  const frames = gallery.getByTestId("gallery-etim-frames");
  await expect(frames).toContainText("1R 3901A-B10 B ✓");
  await expect(frames).toContainText("všechna čísla jsou v oficiálních datech výrobce ABB ETIM 9.0");
  await page.screenshot({ path: "test-results/phase94-gallery-tango.png" });

  // Řada bez čísla krytu v kusovníku (Classic) – reprezentativní výrobek řady z ETIM
  await gallery.getByTestId("gallery-series-Classic").click();
  await expect(preview.locator('[data-slot="switch"] [data-testid="gallery-photo"]')).toHaveAttribute("data-real", "true");
  await expect(preview.locator('[data-slot="switch"]').getByTestId("gallery-photo-mpn")).toHaveText("č. 3553-01289 B1");
  // Dvoubarevná Zoni: rámečky, které data výrobce neuvádějí, jsou označené ⚠
  await gallery.getByTestId("gallery-series-Zoni").click();
  await gallery.getByTestId("gallery-color").filter({ hasText: "141" }).first().click();
  await expect(gallery.getByTestId("gallery-etim-frames")).toContainText("data ABB ETIM 9.0 neuvádějí");
  await expect(gallery.locator('[data-testid="gallery-etim-frame"][data-in-etim="false"]').first()).toBeVisible();
  await page.screenshot({ path: "test-results/phase94-gallery-zoni.png" });
});

test("📦 Hloubka přístroje z ETIM v detailu krabičky a EAN v kusovníku", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
  // Řada Tango bílá (B): zásuvka 6619A-A06357 B s EAN z dat výrobce
  // Fáze 98: design vypínačů (galerie řad, výrobce, barvy) je v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await gallery.getByTestId("gallery-series-Tango").click();
  await gallery.getByTestId("gallery-color").filter({ hasText: "Bílá (B)" }).first().click();
  await gallery.getByTestId("gallery-apply").click();
  await page.getByRole("button", { name: "Použít na celý půdorys" }).click();
  await page.getByTestId("wizard-step-3").click();
  await goPhaseForGroup(page, "sockets");
  const section = palette.locator('[data-group="sockets"]');
  if ((await section.getAttribute("data-open")) !== "true") await palette.getByTestId("palette-toggle-sockets").click();
  await phaseForPalette(page, "Jednozásuvka");
  await palette.getByRole("button", { name: "Jednozásuvka", exact: false }).first().click();
  const at = await screen(canvas, 4200, 1150);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("mode-done").click();
  // Zásuvka Tango 6619A-A06357 B má podle ETIM 40 mm → v KU 68-45 zbývá 5 mm
  await ensureActive(page, canvas.locator('[data-element="socket"]'));
  await canvas.locator('[data-element="socket"]').click();
  const device = page.getByTestId("element-detail").getByTestId("element-box-device");
  await expect(device).toContainText("40 mm");
  await expect(device).toContainText("ABB ETIM 9.0, údaj u 6619A-A06357 B");
  await expect(device).toContainText("v krabici 45 mm za ním zbývá 5 mm na vodiče");
  await page.screenshot({ path: "test-results/phase94-box-depth.png" });

  await page.getByTestId("wizard-step-5").click();
  await page.getByTestId("wizard-bom").click();
  const table = page.getByTestId("wiring-bom-table");
  await expect(table).toContainText("6619A-A06357 B");
  await expect(table).toContainText("EAN 8592624446804");
  await expect(table.getByTestId("wiring-bom-ean").first()).toHaveText(/^EAN \d{13}$/);
  await page.screenshot({ path: "test-results/phase94-bom-ean.png" });
});

test("🗄️ Fotky rozvodnic ABB: nový projekt, dokumentace a výběr skříně; řada ComfortLine Compact CA z ETIM", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByTestId("enclosure-choice")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  const choice = page.getByTestId("enclosure-choice");
  await page.getByLabel("Název rozváděče").fill("RD fáze 94 – fotka rozvodnice");
  await choice.getByTestId("enclosure-choice-toggle").click();
  await choice.getByTestId("enclosure-brand").selectOption("ABB");
  await expect(choice.getByTestId("enclosure-series").locator("option", { hasText: "ComfortLine Compact CA" })).toHaveCount(1, { timeout: 30_000 });
  await choice.getByTestId("enclosure-series").selectOption("mistral65|cat");
  const model = choice.getByTestId("enclosure-model");
  await model.selectOption((await model.locator("option", { hasText: "1SLM006501A1208" }).getAttribute("value"))!);
  const photo = choice.getByTestId("enclosure-choice-summary").getByTestId("enclosure-photo");
  await expect(photo).toHaveAttribute("data-src", "/catalog-images/abb/enclosures/1slm006501a1208.webp");
  await loaded(photo.locator("img"));
  await page.getByRole("button", { name: /Založit návrh rozváděče/ }).click();
  await expect(page.getByTestId("enclosure-lock")).toContainText("ABB Mistral65 65P18X32A", { timeout: 90_000 });
  const projectUrl = page.url();

  // Dokumentace: karta zvolené rozvodnice s fotkou výrobce
  await page.goto(`${projectUrl}/documentation`);
  const card = page.getByTestId("chosen-enclosure");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await loaded(card.getByTestId("enclosure-photo").locator("img"));
  await page.screenshot({ path: "test-results/phase94-enclosure-card.png" });

  // Výběr skříně (oteplení): seznam rozvodnic ABB s fotkami
  await page.goto(`${projectUrl}/thermal`);
  await page.getByRole("button", { name: "🗄️ Výběr skříně rozváděče" }).click({ timeout: 90_000 });
  await page.getByRole("group", { name: "Výrobce skříně" }).getByRole("button", { name: "ABB" }).click();
  const list = page.getByTestId("enclosure-list");
  await expect(list).toBeVisible({ timeout: 30_000 });
  expect(await list.getByTestId("enclosure-photo").count()).toBeGreaterThan(0);
  await loaded(list.getByTestId("enclosure-photo").first().locator("img"));
  await page.screenshot({ path: "test-results/phase94-enclosure-picker.png" });
});
