import { expect, test, type Locator, type Page } from "@playwright/test";

import { ensureActive, goPhase, goPhaseForGroup, phaseForPalette } from "./floorplan-phases";

// Fáze 97: reálné fotky z datových balíčků výrobců se zákazníkovi opravdu vykreslí – galerie „Designové řady a barvy“ pro
// ABB, Schneider Electric, Legrand a Hager (img.complete && naturalWidth > 50 = soubor existuje a prohlížeč ho dekódoval),
// fotka a EAN krabice KOPOS v kusovníku a fotky rozvodnic Hager / OEZ / Schneider ve výběru skříně AI Panel Builderu.
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

/** Všechny obrázky v oblasti se načetly a mají skutečný rozměr (ne rozbitý odkaz ani prázdný zástupný obrázek). */
async function allLoaded(scope: Locator, minimum = 1) {
  const images = scope.locator("img");
  await expect.poll(() => images.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(minimum);
  await expect
    .poll(() => images.evaluateAll((nodes) => nodes.every((node) => (node as HTMLImageElement).complete && (node as HTMLImageElement).naturalWidth > 50)), { timeout: 30_000 })
    .toBe(true);
  return images.evaluateAll((nodes) => nodes.map((node) => ({ src: (node as HTMLImageElement).currentSrc, width: (node as HTMLImageElement).naturalWidth })));
}

test("🖼️ Galerie řad a barev: skutečné fotky ABB, Schneider Electric, Legrand a Hager se načtou", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  // Fáze 98: design vypínačů (galerie řad, výrobce, barvy) je v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  const preview = gallery.getByTestId("gallery-preview");
  for (const brand of ["ABB", "Schneider Electric", "Legrand", "Hager"]) {
    await gallery.getByRole("radio", { name: brand, exact: true }).click();
    // Výchozí řada výrobce v první barvě – fotky výrobce (data-real), ne vektorový náhled
    await expect.poll(() => preview.locator('[data-testid="gallery-photo"][data-real="true"]').count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
    const loaded = await allLoaded(preview.locator('[data-testid="gallery-photo"][data-real="true"]').locator("xpath=.."), 2);
    expect(loaded.every((image) => image.src.includes("/catalog-images/"))).toBe(true);
    await expect(gallery.getByTestId("gallery-photo-source")).toBeVisible();
    await page.screenshot({ path: `test-results/phase97-gallery-${brand.split(" ")[0].toLowerCase()}.png` });
  }
  // Hager: zdroj fotek = oficiální data BMEcat ETIM 10
  await expect(gallery.getByTestId("gallery-photo-source")).toContainText("Hager – oficiální data BMEcat ETIM 10");
});

test("📦 Kusovník: fotka a EAN krabice KOPOS ze stránky výrobce", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
  await page.getByTestId("wizard-step-3").click();
  await goPhaseForGroup(page, "sockets");
  const section = palette.locator('[data-group="sockets"]');
  if ((await section.getAttribute("data-open")) !== "true") await palette.getByTestId("palette-toggle-sockets").click();
  await phaseForPalette(page, "Jednozásuvka");
  await palette.getByRole("button", { name: "Jednozásuvka", exact: false }).first().click();
  const at = await screen(canvas, 4200, 1150);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("mode-done").click();
  // Detail zásuvky: doporučená krabice KU 68-45_KA s fotkou výrobce a EAN
  await ensureActive(page, canvas.locator('[data-element="socket"]'));
  await canvas.locator('[data-element="socket"]').click();
  const detailBox = page.getByTestId("element-detail").getByTestId("element-box");
  await allLoaded(detailBox, 1);
  await expect(detailBox.getByTestId("element-box-ean")).toHaveText(/^EAN \d{13}$/);

  await page.getByTestId("wizard-step-5").click();
  await page.getByTestId("wizard-bom").click();
  const boxes = page.getByTestId("wiring-bom-boxes-table");
  const row = boxes.locator('[data-testid="wiring-bom-box"][data-code="KU 68-45_KA"]');
  await expect(row).toHaveCount(1);
  const [photo] = await allLoaded(row, 1);
  expect(photo.src).toContain("/catalog-images/kopos/boxes/ku-68-45-ka.webp");
  await expect(row.getByTestId("wiring-bom-box-ean")).toHaveText("EAN 8595568936233");
  await page.screenshot({ path: "test-results/phase97-bom-kopos.png" });
});

test("🗄️ Výběr skříně: fotky rozvodnic Hager a OEZ; katalog: rozvodnice Schneider a DIN přístroje OEZ / ABB s fotkou", async ({ page }) => {
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
  await page.getByLabel("Název rozváděče").fill("RD fáze 97 – fotky rozvodnic");
  await page.getByRole("button", { name: /Založit návrh rozváděče/ }).click();
  // Projekt bez zvolené skříně (skříň se vybere až ve výběru skříně)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD fáze 97 – fotky rozvodnic", { timeout: 90_000 });
  await page.goto(`${page.url()}/thermal`);
  await page.getByRole("button", { name: "🗄️ Výběr skříně rozváděče" }).click({ timeout: 90_000 });
  for (const brand of ["Hager", "OEZ"]) {
    await page.getByRole("group", { name: "Výrobce skříně" }).getByRole("button", { name: brand, exact: false }).click();
    const list = page.getByTestId("enclosure-list");
    await expect(list).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => list.getByTestId("enclosure-photo").count(), { timeout: 30_000 }).toBeGreaterThan(0);
    const photos = list.getByTestId("enclosure-photo");
    await photos.first().scrollIntoViewIfNeeded();
    const [first] = await allLoaded(photos.first(), 1);
    expect(first.src).toContain(`/catalog-images/${brand.toLowerCase()}/enclosures/`);
    await page.screenshot({ path: `test-results/phase97-enclosures-${brand.toLowerCase()}.png` });
  }
  await page.keyboard.press("Escape");

  // Katalog přístrojů: rozvodnice Schneider Electric (Kaedra, Mini Pragma …) a jističe OEZ / ABB s fotkou výrobce
  for (const [query, testId, folder] of [
    ["brand=Schneider&group=ENCLOSURE", "enclosure-photo", "/catalog-images/schneider/enclosures/"],
    ["brand=OEZ&group=MCB", "device-photo", "/catalog-images/oez/devices/"],
    ["brand=ABB&group=MCB", "device-photo", "/catalog-images/abb/devices/"],
  ] as const) {
    await page.goto(`/panel-builder/catalog?${query}`);
    const photos = page.getByTestId(testId);
    await expect.poll(() => photos.count(), { timeout: 60_000 }).toBeGreaterThan(0);
    await photos.first().scrollIntoViewIfNeeded();
    const scope = testId === "device-photo" ? photos.first().locator("xpath=..") : photos.first();
    const [first] = await allLoaded(scope, 1);
    expect(first.src).toContain(folder);
    await page.screenshot({ path: `test-results/phase97-catalog-${query.split("&")[0].split("=")[1].toLowerCase()}-${testId}.png` });
  }
});
