import { expect, test } from "@playwright/test";

// Fáze 60: trasy podél stěn, pořadí zásuvek nezávislé na kreslení, rozváděč z půdorysu podle hierarchie od jednoho
// výrobce a převod hotového rozváděče na jiného výrobce.
test.describe.configure({ mode: "serial" });

test("půdorys → trasy podél stěn a optimální pořadí → rozváděč Eaton se stromem → převod na ABB", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const choose = (label: string) => palette.getByRole("button", { name: label, exact: false }).first().click();

  // Bez místností trasy pravoúhle (upozornění), po zakreslení místnosti podél stěn
  await choose("Hlavní domovní / bytový rozváděč");
  await canvas.click({ position: { x: 120, y: 500 } });
  await choose("Jednozásuvka");
  // Zásuvky „na přeskáčku“ u horní stěny budoucí místnosti
  for (const x of [520, 200, 600, 280, 420]) await canvas.click({ position: { x, y: 104 } });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("cable-walls")).toContainText("Trasy zatím pravoúhle");
  await page.getByRole("button", { name: "Kreslit místnost" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 100, box.y + 100);
  await page.mouse.down();
  await page.mouse.move(box.x + 700, box.y + 560, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByTestId("cable-walls")).toContainText("podél stěn");
  await expect(page.getByTestId("cable-walls")).toContainText("kratší než v pořadí kreslení");
  await page.getByTestId("floorplan-canvas").screenshot({ path: "test-results/phase60-walls.png" });

  // Rozváděč od jednoho výrobce (Eaton) se stromem podle hierarchie
  await page.getByTestId("floorplan-manufacturer").selectOption("Eaton");
  await page.getByTestId("floorplan-environment").selectOption("INDOOR_DRY");
  await page.getByLabel("Název rozváděče").fill("RD60 Eaton");
  await page.getByTestId("generate-from-floorplan").click();
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 90_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD60 Eaton");
  const panel = page.getByTestId("vector-panel");
  await expect(panel.getByRole("button", { name: /^-Q1 / })).toHaveAttribute("aria-label", /Eaton/i);

  // Převod celého rozváděče na ABB: náhled, převod, hodnoty a značení zůstanou
  await page.getByTestId("transfer-open").click();
  const dialog = page.getByTestId("transfer-dialog");
  await dialog.getByTestId("transfer-manufacturer").selectOption("ABB");
  await expect(dialog.getByTestId("transfer-summary")).toContainText("shodných");
  await expect(dialog.getByTestId("transfer-rows").locator("tbody tr").first()).toBeVisible();
  await dialog.getByTestId("transfer-apply").click();
  await expect(dialog).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /^-Q1 / })).toHaveAttribute("aria-label", /ABB/i, { timeout: 30_000 });
  await expect(panel.getByRole("button", { name: /^-FI1 / })).toBeVisible();

  // Strom zapojení z generátoru je hotový (krok 2)
  await page.goto(page.url() + "/tree");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD60 Eaton");
  await page.screenshot({ path: "test-results/phase60-tree.png" });
});
