import { expect, test, type Page } from "@playwright/test";
import { ensureActive, goPhase, phaseForPalette, rightTab } from "./floorplan-phases";

// Fáze 62: 2D půdorys – sestavy zásuvek a vypínačů ve víceramečku přímo z palety (hotové i vlastní), ▦+ přidání
// přístroje do rámečku, skrytí kabeláže (při párování vypínačů se světly automaticky) a „Hotovo“ vždy v liště nad
// půdorysem, která zůstává viditelná i po posunu stránky.
test.describe.configure({ mode: "serial" });

async function openFloorplan(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

test("2D půdorys: sestavy ve víceramečku, ▦+, skrytí kabeláže při párování a Hotovo nad půdorysem", async ({ page }) => {
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
  const bar = page.getByTestId("mode-bar");
  const title = page.getByTestId("mode-bar-title");
  const done = page.getByTestId("mode-done");
  const detail = page.getByTestId("element-detail");

  // Místnost a rozváděč – každý krok má název a „Hotovo“ v liště nad půdorysem
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  await expect(bar).toHaveAttribute("data-tone", "draw");
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 700, box.y + 560, { steps: 6 });
  await page.mouse.up();
  await choose("Hlavní domovní / bytový rozváděč");
  await expect(bar).toHaveAttribute("data-tone", "place");
  await expect(title).toContainText("Vkládání: Hlavní domovní");
  await canvas.click({ position: { x: 140, y: 520 } });

  // Hotová sestava 3× jednozásuvka (panel sestav nad paletou): náhled celé sestavy u kurzoru, jedním klikem
  // 3 zásuvky v rámečku 3R
  // Fáze 98: sestavy ve víceramečku jsou v levém sloupci fází 3 a 4
  await goPhase(page, 3);
  const sets = page.getByRole("region", { name: "Sestavy ve víceramečku" });
  await sets.locator('[data-assembly="set-3z"]').click();
  await expect(title).toContainText("Vkládání sestavy: 3× jednozásuvka (3R)");
  await canvas.hover({ position: { x: 400, y: 116 } });
  await expect(canvas.getByTestId("place-set-ghost")).toHaveAttribute("data-members", "3");
  await canvas.click({ position: { x: 400, y: 116 } });
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(3);
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="3"]')).toHaveCount(1);
  // „Hotovo“ ukončí vkládání i úpravu naposledy vložené sestavy
  await done.click();
  await expect(bar).toHaveAttribute("data-tone", "idle");
  await expect(detail).toHaveCount(0);

  // Vlastní sestava: vypínač č. 1 + 2× jednozásuvka (3R) uprostřed místnosti
  await sets.getByTestId("assembly-custom-toggle").click();
  const custom = sets.getByTestId("assembly-custom");
  await custom.getByLabel("Pozice 1 sestavy").selectOption("switch-1");
  await custom.getByTestId("assembly-add").click();
  await expect(custom.getByTestId("assembly-gangs")).toHaveText("3R");
  await custom.getByTestId("assembly-custom-place").click();
  await expect(title).toContainText("Vypínač č. 1 + 2× Jednozásuvka (3R)");
  await canvas.click({ position: { x: 380, y: 330 } });
  await expect(canvas.getByTestId("frame-outline")).toHaveCount(2);
  await expect(canvas.locator('[data-element="switch-1"]')).toHaveCount(1);
  // Fáze 100: fáze 3 otevře záložku 🔌 Okruhy & Trasy – detail vložené sestavy je v záložce 🎯 Detail
  await rightTab(page, "detail");
  await expect(detail.getByTestId("frame-detail")).toContainText("Víceramček 3R");
  await page.screenshot({ path: "test-results/phase62-sets.png" });
  await page.keyboard.press("Escape");

  // ▦+ v liště značky přidá stejný přístroj, „Přidat do rámečku“ v detailu jiný; plný rámeček (5R) další nepřijme
  await ensureActive(page, canvas.locator('[data-element="socket"]').first());
  await canvas.locator('[data-element="socket"]').first().click();
  await canvas.getByTestId("element-toolbar").getByRole("button", { name: "Přidat stejný přístroj vedle do rámečku" }).click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="4"]')).toHaveCount(1);
  const add = detail.getByTestId("add-to-frame");
  await add.getByLabel("Přístroj přidaný do rámečku").selectOption("switch-1");
  await add.getByTestId("add-to-frame-button").click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="5"]')).toHaveCount(1);
  await expect(add.getByTestId("add-to-frame-button")).toBeDisabled();

  // Kabeláž: vrstvu jde skrýt přepínačem u plátna i klávesou K
  const cables = page.getByTestId("toggle-cables");
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached();
  await cables.click();
  await expect(canvas.getByTestId("cable-route")).toHaveCount(0);
  await expect(cables).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("k");
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached();
  await expect(cables).toHaveAttribute("aria-pressed", "true");

  // Párování vypínače se světlem: kabeláž se sama skryje, „Hotovo“ je nad půdorysem, v bočním panelu není
  await choose("Stropní svítidlo");
  await canvas.click({ position: { x: 560, y: 460 } });
  await page.keyboard.press("Escape");
  await goPhase(page, 5);
  await ensureActive(page, canvas.locator('[data-element="switch-1"]').first());
  await canvas.locator('[data-element="switch-1"]').first().click();
  await canvas.getByTestId("element-toolbar").getByRole("button", { name: "Přiřadit vypínač ke světlu" }).click();
  await expect(bar).toHaveAttribute("data-tone", "pair");
  await expect(canvas.getByTestId("cable-route")).toHaveCount(0);
  await expect(cables).toContainText("Kabeláž skrytá");
  // Kabeláž jde při párování zapnout i z lišty kroku (přepínač v rohu plátna po posunu stránky není vidět)
  const barCables = bar.getByTestId("mode-toggle-cables");
  await barCables.click();
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached();
  await expect(barCables).toContainText("Skrýt kabeláž");
  await barCables.click();
  await expect(canvas.getByTestId("cable-route")).toHaveCount(0);
  await expect(detail.getByTestId("pairing-note")).toBeVisible();
  await expect(detail.getByRole("button", { name: /Hotovo/ })).toHaveCount(0);
  await canvas.getByRole("button", { name: /^Stropní svítidlo/ }).click();
  await expect(page.getByTestId("pair-count")).toHaveText("ovládá 1 svítidlo");
  await page.screenshot({ path: "test-results/phase62-pairing.png" });
  await done.click();
  await expect(bar).toHaveAttribute("data-tone", "edit");
  await expect(detail.getByTestId("switch-controls")).toContainText("Stropní svítidlo");
  await expect(canvas.getByTestId("cable-route").first()).toBeAttached();

  // Úprava vybraného prvku: lišta s „Hotovo“ zůstane viditelná i po posunu stránky dolů
  await expect(title).toContainText("Úprava: Vypínač č. 1");
  await page.mouse.wheel(0, 700);
  await expect(bar).toBeInViewport();
  await done.click();
  await expect(bar).toHaveAttribute("data-tone", "idle");
  await expect(detail).toHaveCount(0);
});
