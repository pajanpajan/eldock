import path from "node:path";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 101: kusovník bez „doplnit“ (MPN / EAN z dat výrobců, pravdivý původ položky), karty systémů ABB pod sebou
// v pravém panelu, 3sloupcová mřížka řad a velká galerie, tlačítko Knihovny spotřebičů přes celou šířku palety,
// víceramček 1R–5R přímo v detailu prvku (orientace, obsah pozic, 🔗 spojení, ✂️ rozdělení), šablony víceramečků
// v sekcích palety a zelený box 100% lokálního zpracování BIM (.ifc) v importu půdorysu i závodu.
test.describe.configure({ mode: "serial" });

const SAMPLE = path.join(process.cwd(), "public", "samples", "eldock-sample-plant.ifc");

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

/** Bod plánu [mm] → souřadnice obrazovky. */
async function screen(canvas: Locator, x: number, y: number) {
  await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
  return canvas.evaluate((svg, point) => {
    const at = new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
    return { x: at.x, y: at.y };
  }, { x, y });
}

async function room(page: Page) {
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
}

test("▣ Víceramček 1R–5R v detailu prvku: pozice, obsah na 1 klik, ↕ svisle, 🔗 spojení a ✂️ rozdělení; šablony v paletě", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  await room(page);
  const canvas = page.getByTestId("floorplan-canvas");
  await goPhase(page, 3);
  // Šablony víceramečků přímo v sekci Zásuvky – bez samostatného boxu nad paletou
  await expect(page.getByRole("region", { name: "Sestavy ve víceramečku" })).toHaveCount(0);
  const sockets = page.getByRole("region", { name: "Vícerámečky se zásuvkami (2R–5R)" });
  await expect(sockets).toBeVisible();
  for (const id of ["set-2z", "set-3z", "set-4z", "set-z-rj", "set-tv"]) await expect(sockets.locator(`[data-assembly="${id}"]`)).toBeVisible();
  await expect(sockets.locator('[data-assembly="set-tv"]')).toContainText("TV sestava: 2× Zásuvka + RJ45 + TV (4R)");
  await expect(sockets.getByTestId("assembly-custom-toggle")).toContainText("Vlastní sestava 2R–5R");

  // Jedna zásuvka u horní stěny → Detail: ▣ Sestava ve vícerámečku, 1R (Samostatně)
  await page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }).getByRole("button", { name: "Jednozásuvka", exact: false }).first().click();
  const at = await screen(canvas, 1500, 60);
  await page.mouse.click(at.x, at.y);
  await page.getByTestId("mode-done").click();
  await canvas.locator('[data-element="socket"]').first().click();
  await rightTab(page, "detail");
  const frame = page.getByTestId("frame-detail");
  await expect(frame).toContainText("▣ Sestava ve vícerámečku (na této pozici)");
  await expect(frame.getByTestId("frame-gangs").getByRole("radio")).toHaveText(["1R (Samostatně)", "2R", "3R", "4R", "5R"]);
  await expect(frame.locator('[data-gangs="1"][role="radio"]')).toHaveAttribute("aria-checked", "true");

  // 3R → 3 pozice v jednom rámečku, obsah pozice 2 = Datová RJ45, pozice 3 = TV / SAT
  await frame.locator('[data-gangs="3"][role="radio"]').click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="3"]')).toHaveCount(1);
  await expect(frame).toHaveAttribute("data-gangs", "3");
  const positions = frame.getByTestId("frame-position");
  await expect(positions).toHaveCount(3);
  await positions.nth(1).click();
  await frame.getByTestId("frame-position-choices").locator('[data-slot-item="data-socket"]').click();
  await positions.nth(2).click();
  await frame.getByTestId("frame-position-choices").locator('[data-slot-item="tv-socket"]').click();
  await expect(positions.nth(1)).toHaveAttribute("data-item", "data-socket");
  await expect(positions.nth(2)).toHaveAttribute("data-item", "tv-socket");
  await expect(canvas.locator('[data-element="tv-socket"]')).toHaveCount(1);
  // ↕ Svisle a zpět ↔
  await frame.getByTestId("frame-orientation").locator('[data-orientation="vertical"]').click();
  await expect(frame).toHaveAttribute("data-orientation", "vertical");
  await page.screenshot({ path: "test-results/phase101-frame-vertical.png" });
  await frame.getByTestId("frame-orientation").locator('[data-orientation="horizontal"]').click();
  await expect(frame).toHaveAttribute("data-orientation", "horizontal");
  // 5R a zpět na 2R (koncové pozice se odeberou), 1R = vybraná zásuvka samostatně
  await frame.locator('[data-gangs="5"][role="radio"]').click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="5"]')).toHaveCount(1);
  await frame.locator('[data-gangs="2"][role="radio"]').click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="2"]')).toHaveCount(1);
  // ✂️ Rozdělit na samostatné přístroje
  await frame.getByTestId("frame-dissolve").click();
  await expect(canvas.getByTestId("frame-outline")).toHaveCount(0);
  // 🔗 Spojit sousední prvky (do 35 cm u stejné stěny) – v detailu i v plovoucí liště
  await canvas.locator('[data-element="socket"]').first().click();
  await rightTab(page, "detail");
  await expect(frame.getByTestId("frame-join")).toContainText("🔗 Spojit sousední prvky do společného vícerámečku (2R–5R)");
  await expect(canvas.getByTestId("element-toolbar").getByRole("button", { name: "Spojit sousední prvky do společného vícerámečku (2R–5R)" })).toBeVisible();
  await frame.getByTestId("frame-join").click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="2"]')).toHaveCount(1);
  await expect(canvas.getByTestId("element-toolbar").getByRole("button", { name: "Rozdělit vícerámeček na samostatné přístroje" })).toBeVisible();

  // Fáze 4: ▣ Vícerámečky s vypínači (u dveří / u postele) – vypínač nad zásuvkou svisle
  await goPhase(page, 4);
  const controls = page.getByRole("region", { name: "Vícerámečky s vypínači (u dveří / u postele)" });
  await expect(controls).toBeVisible();
  for (const id of ["set-s1-z-v", "set-2s1-z", "set-s1-zal-ter", "set-bed"]) await expect(controls.locator(`[data-assembly="${id}"]`)).toBeVisible();
  await expect(controls.locator('[data-assembly="set-s1-z-v"]')).toContainText("Vypínač + Zásuvka pod ním (2R svislý)");
  await page.getByTestId("floorplan-left").screenshot({ path: "test-results/phase101-palette-controls.png" }).catch(() => undefined);
});

test("🧱 Pravý panel: karty systémů ABB pod sebou přes celou šířku, mřížka řad 3 sloupce, velká galerie; Knihovna spotřebičů přes celou šířku", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  await room(page);
  await goPhase(page, 4);
  await rightTab(page, "detail");
  const card = page.getByTestId("design-card");
  await card.getByRole("radio", { name: "ABB", exact: true }).click();
  const families = card.getByTestId("abb-families");
  await expect(families).toBeVisible();
  expect(await families.evaluate((node) => getComputedStyle(node).flexDirection)).toBe("column");
  const boxes = await families.getByRole("radio").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map((rect) => ({ x: rect.x, y: rect.y, w: rect.width, h: rect.height })));
  expect(boxes).toHaveLength(3);
  await expect(families.getByRole("radio")).toContainText(["Domovní spínače a zásuvky", "ABB-free@home®", "ABB i-bus® KNX & flexTronics®"]);
  const inner = await families.evaluate((node) => node.clientWidth);
  for (const [index, box] of boxes.entries()) {
    // Plná šířka panelu (bez okraje 2 × 4 px), pod sebou a bez překryvu
    expect(box.w).toBeGreaterThan(inner - 12);
    if (index) expect(box.y).toBeGreaterThanOrEqual(boxes[index - 1].y + boxes[index - 1].h - 0.5);
  }
  // Text karty se neláme po slovech: nadpis na 1 řádek
  const titleHeights = await families.getByRole("radio").evaluateAll((nodes) => nodes.map((node) => (node.querySelector("span span") as HTMLElement).getBoundingClientRect().height));
  for (const height of titleHeights) expect(height).toBeLessThan(24);
  const grid = card.getByTestId("series-grid");
  expect(await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length)).toBe(3);
  await expect(card.getByTestId("series-gallery-open")).toHaveText(/🎨 Otevřít velkou galerii řad a barev/);
  await card.screenshot({ path: "test-results/phase101-design-card.png" });

  // Levá paleta fáze 3: ⚙️ Knihovna spotřebičů přes obě kolony mřížky
  await goPhase(page, 3);
  const button = page.getByTestId("appliance-edit");
  await expect(button).toHaveText("⚙️ Knihovna spotřebičů (upravit / přidat)");
  const grid2 = page.getByTestId("palette-grid-appliances");
  const [buttonBox, gridBox] = [(await button.boundingBox())!, (await grid2.boundingBox())!];
  expect(buttonBox.width).toBeGreaterThan(gridBox.width - 2);
});

test("🔒 BIM import 2D půdorysu: okno se zárukou 100% lokálního zpracování, převod .ifc v prohlížeči", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.postData()?.includes("ISO-10303-21")) requests.push(request.url());
  });
  await page.getByTestId("floorplan-bim-open").first().click();
  const dialog = page.getByTestId("floorplan-bim-dialog");
  await expect(dialog.getByTestId("bim-local-notice")).toContainText("🔒 100% Lokální a bezpečné zpracování (Zero-Cloud & Offline-ready):");
  await expect(dialog.getByTestId("bim-local-notice")).toContainText("zpracován výhradně lokálně v paměti vašeho prohlížeče");
  await dialog.getByTestId("floorplan-bim-input").setInputFiles(SAMPLE);
  await expect(page.getByText(/BIM eldock-sample-plant\.ifc: 2 podlaží, 5 místností/)).toBeVisible({ timeout: 60_000 });
  // Obsah souboru .ifc (STEP ISO-10303-21) neodešel na žádný server
  expect(requests).toEqual([]);
});

test("📋 Kusovník vzorového RD 4+kk: žádné „doplnit“, objednací čísla s EAN a pravdivý původ položek bez čísla", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 300_000 });
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("wiring-bom-open").click();
  const table = page.getByTestId("wiring-bom-table");
  await expect(table).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText(/doplnit/i);
  const eans = await page.getByTestId("wiring-bom-ean").allInnerTexts();
  expect(eans.length).toBeGreaterThan(3);
  const codes = eans.map((text) => text.replace(/\D/g, "")).filter((digits) => digits.length === 13);
  expect(codes.length).toBe(eans.length);
  for (const code of codes) {
    const digits = [...code].map(Number);
    const sum = digits.slice(0, 12).reduce((total, digit, index) => total + digit * (index % 2 ? 3 : 1), 0);
    expect((10 - (sum % 10)) % 10, code).toBe(digits[12]);
  }
  await expect(page.getByRole("dialog")).toContainText("typové označení – výrobce dle nabídky");
  await page.getByRole("dialog").screenshot({ path: "test-results/phase101-bom.png" });
});
