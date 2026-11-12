import { expect, test, type Page } from "@playwright/test";
import { ensureActive, goPhase, phaseForPalette, rightTab } from "./floorplan-phases";

// Fáze 59: Panel Builder – vložený přístroj nezůstane vybraný, úprava a přesun přístroje na liště; 2D půdorys –
// natočení další značky podle předchozí, víceramček s přisazením, přiřazení vypínače ke světlu, zakreslení změn
// (příčka, text) a druhé podlaží se stoupacím vedením.
test.describe.configure({ mode: "serial" });

async function openFloorplan(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

test("Panel Builder: po vložení nic nezůstane vybrané, přístroj jde upravit kliknutím a přesunout", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1500 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByLabel("Název rozváděče")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Název rozváděče").fill("RD59 – úpravy na liště");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });

  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  const card = page.getByTestId("placement-card");
  const mode = page.getByTestId("configurator-mode");
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await menu.getByRole("button", { name: "Zásuvky", exact: true }).click();
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--F1")).toBeVisible();
  // Vložený jistič není vybraný – další volba v kaskádě ho nezmění
  await expect(mode).toHaveText("➕ Vložit nový přístroj");
  await expect(page.getByTestId("vector-selected")).toHaveCount(0);
  await menu.getByRole("button", { name: "Chránič", exact: true }).first().click();
  await expect(card).toContainText("F204");
  await expect(page.getByTestId("symbol--F1")).toHaveAttribute("aria-label", /B16/);
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--FI1")).toBeVisible();
  await expect(page.getByTestId("symbol--F1")).toHaveAttribute("aria-label", /B16/);
  await expect(mode).toHaveText("➕ Vložit nový přístroj");

  // Úprava jen po kliknutí: oranžový režim „Úprava přístroje -F1“, změna 16 A → 20 A, Hotovo
  await page.getByTestId("vector-panel").getByRole("button", { name: /^-F1 / }).click();
  await expect(mode).toContainText("Úprava přístroje -F1");
  await expect(page.getByTestId("edit-banner")).toContainText("ukládají rovnou do -F1");
  await page.getByTestId("item-configurator").getByRole("button", { name: "20A", exact: true }).click();
  await expect(page.getByTestId("symbol--F1")).toHaveAttribute("aria-label", /B20/);
  // Přesun: -F1 doprava za chránič (◀ ▶), značení se přepočítá podle pořadí
  const before = (await page.getByTestId("symbol--FI1").boundingBox())!.x;
  await page.getByTestId("item-move").getByRole("button", { name: "Posunout přístroj vpravo" }).click();
  await expect.poll(async () => (await page.getByTestId("symbol--FI1").boundingBox())!.x).toBeLessThan(before);
  await page.getByTestId("edit-done").click();
  await expect(mode).toHaveText("➕ Vložit nový přístroj");
  await page.screenshot({ path: "test-results/phase59-panel.png", fullPage: false });
});

test("2D půdorys: natočení podle předchozí značky, víceramček, vypínač ke světlu, zakreslení změn a druhé podlaží", async ({ page }) => {
  test.setTimeout(360_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openFloorplan(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  // Fáze 98: značka je v paletě své fáze (rozváděč 2, zásuvky 3, světla a vypínače 4)
  const choose = async (label: string) => {
    await phaseForPalette(page, label);
    await palette.getByRole("button", { name: label, exact: false }).first().click();
  };
  const detail = page.getByTestId("element-detail");

  // Místnost, rozváděč
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 700, box.y + 560, { steps: 6 });
  await page.mouse.up();
  await choose("Hlavní domovní / bytový rozváděč");
  await canvas.click({ position: { x: 140, y: 520 } });

  // Zásuvka uprostřed místnosti, R otočí; další zásuvka převezme natočení 90°
  await choose("Jednozásuvka");
  await canvas.hover({ position: { x: 380, y: 330 } });
  await expect(canvas.getByTestId("place-ghost")).toHaveAttribute("data-rotation", "0");
  await canvas.click({ position: { x: 380, y: 330 } });
  await page.keyboard.press("r");
  await expect(detail).toContainText("otočení 90°");
  await canvas.hover({ position: { x: 380, y: 420 } });
  await expect(canvas.getByTestId("place-ghost")).toHaveAttribute("data-rotation", "90");
  await canvas.click({ position: { x: 380, y: 420 } });
  await expect(detail).toContainText("otočení 90°");
  await page.keyboard.press("Escape");

  // Víceramček: 2 zásuvky + vypínač vedle sebe u horní stěny → Shift + klik → 3R s přisazením
  await choose("Jednozásuvka");
  await canvas.click({ position: { x: 250, y: 112 } });
  await canvas.click({ position: { x: 300, y: 112 } });
  await choose("Vypínač č. 1");
  await canvas.click({ position: { x: 360, y: 150 } });
  await page.keyboard.press("Escape");
  const sockets = canvas.locator('[data-element="socket"]');
  await ensureActive(page, sockets.nth(2));
  await sockets.nth(2).click();
  await ensureActive(page, sockets.nth(3));
  await sockets.nth(3).click({ modifiers: ["Shift"] });
  await goPhase(page, 5);
  await ensureActive(page, canvas.locator('[data-element="switch-1"]').first());
  await canvas.locator('[data-element="switch-1"]').first().click({ modifiers: ["Shift"] });
  const selection = page.getByTestId("selection-panel");
  await expect(selection).toContainText("Vybráno 3 prvků");
  await selection.getByTestId("make-frame").click();
  await expect(canvas.getByTestId("frame-outline")).toHaveAttribute("data-gangs", "3");
  await expect(detail.getByTestId("frame-detail")).toContainText("Víceramček 3R");

  // Vypínač → světlo: 🔗 v plovoucí liště vypínače, klik na svítidlo
  await choose("Stropní svítidlo");
  await canvas.click({ position: { x: 450, y: 300 } });
  await page.keyboard.press("Escape");
  await goPhase(page, 5);
  // Fáze 100: kontrola půdorysu je v záložce 🛡️ Normy (Linter)
  await rightTab(page, "norms");
  await expect(page.getByTestId("plan-checks")).toContainText("svítidlo bez vypínače");
  await ensureActive(page, canvas.locator('[data-element="switch-1"]').first());
  await canvas.locator('[data-element="switch-1"]').first().click();
  await canvas.getByTestId("element-toolbar").getByRole("button", { name: "Přiřadit vypínač ke světlu" }).click();
  // Fáze 62: krok párování a jeho „Hotovo“ jsou v liště nad půdorysem, ne v bočním panelu
  await expect(page.getByTestId("mode-bar")).toHaveAttribute("data-tone", "pair");
  await expect(canvas.getByTestId("pair-candidate")).toHaveCount(1);
  await canvas.getByRole("button", { name: /^Stropní svítidlo/ }).click();
  await page.getByTestId("mode-done").click();
  await expect(detail.getByTestId("switch-controls")).toContainText("Stropní svítidlo");
  await rightTab(page, "norms");
  await expect(page.getByTestId("plan-checks-ok")).toBeVisible();
  await expect(page.getByTestId("plan-checks")).toHaveCount(0);
  // Druhé světlo bez vypínače → automatické přiřazení k nejbližšímu vypínači v místnosti
  await choose("Stropní svítidlo");
  await canvas.click({ position: { x: 600, y: 450 } });
  await page.keyboard.press("Escape");
  await goPhase(page, 5);
  await rightTab(page, "norms");
  await page.getByTestId("check-fix-lights-unpaired").click();
  await expect(page.getByTestId("plan-checks-ok")).toBeVisible();
  await expect(page.getByTestId("plan-checks")).toHaveCount(0);

  // Úprava PDF → nová příčka v modré barvě s křížovou šrafou, textové pole
  const pdfMenu = async (name: RegExp) => {
    // Fáze 98: úpravy podkladu (příčky, texty) jsou v levém sloupci fáze 1
    await goPhase(page, 1);
    await expect(page.getByRole("menu")).toHaveCount(0);
    await page.getByTestId("pdf-edit-menu").click();
    await page.getByRole("menuitem", { name }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  };
  await pdfMenu(/Nová příčka/);
  const bar = page.getByTestId("annotate-bar");
  await bar.getByRole("radio", { name: "Barva #2563eb" }).click();
  await bar.getByRole("radio", { name: "Křížová šrafa" }).click();
  // Lišta nástroje posune plátno – souřadnice až po jejím zobrazení
  await canvas.scrollIntoViewIfNeeded();
  const drawBox = (await canvas.boundingBox())!;
  await page.mouse.move(drawBox.x + 420, drawBox.y + 200);
  await page.mouse.down();
  await page.mouse.move(drawBox.x + 420, drawBox.y + 520, { steps: 6 });
  await page.mouse.up();
  const wall = canvas.locator('[data-note="wall"] polygon').first();
  await expect(wall).toHaveAttribute("stroke", /#38bdf8|#2563eb/);
  await expect(wall).toHaveAttribute("fill", /hatch-cross-2563eb/);
  await expect(page.getByTestId("annotation-detail")).toContainText("Nová příčka");
  await page.getByTestId("annotation-detail").getByLabel("Tloušťka konstrukce [mm]").selectOption("125");
  await expect(page.getByTestId("annotation-size")).toContainText("tloušťka 125 mm");
  await pdfMenu(/Textové pole/);
  await canvas.click({ position: { x: 560, y: 160 } });
  await page.getByTestId("annotation-text").fill("Nová SDK příčka 125 mm");
  await page.getByTestId("annotation-detail").getByRole("button", { name: "L", exact: true }).click();
  await expect(canvas.locator('[data-note="text"] text').first()).toHaveText("Nová SDK příčka 125 mm");
  await page.getByTestId("floorplan-canvas").screenshot({ path: "test-results/phase59-floor1.png" });

  // Druhé podlaží: přidat, stoupací vedení a zásuvky; výpočet zahrne obě podlaží
  // Fáze 89 / 98: správa podlaží je v levém sloupci fáze 1 (blok „🏢 Podlaží“)
  await goPhase(page, 1);
  await expect(page.getByTestId("wizard-floors")).toBeVisible();
  await page.getByTestId("floor-add").click();
  await page.getByTestId("floor-add-form").getByLabel("Název nového podlaží").fill("2. NP");
  await page.getByTestId("floor-add-confirm").click();
  await expect(page.getByTestId("active-floor")).toContainText("2. NP");
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(0);
  await choose("Stoupací vedení");
  await canvas.click({ position: { x: 160, y: 500 } });
  await choose("Jednozásuvka");
  await canvas.click({ position: { x: 500, y: 300 } });
  await canvas.click({ position: { x: 560, y: 300 } });
  await page.keyboard.press("Escape");
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("cable-circuits")).toContainText("(2. NP)");
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached();
  // Fáze 89: přepínač podlaží v řádku průvodce (ve všech krocích)
  await page.getByTestId("floor-switch").selectOption({ label: "1. NP" });
  await expect(page.getByTestId("active-floor")).toContainText("1. NP");
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(4);
  // Fáze 100: soupis domovní instalace je v záložce ⚡ Kusovník & Rozváděč
  await rightTab(page, "bom");
  await expect(page.getByTestId("wiring-inventory")).toContainText("2 podlaží");
  await page.screenshot({ path: "test-results/phase59-editor.png", fullPage: true });
});
