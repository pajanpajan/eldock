import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { goPhase } from "./floorplan-phases";

// Fáze 83: nastavitelná plocha 2D půdorysu – výchozí 20 × 16 m, předvolby a vlastní rozměr (5–100 m), rozšíření o 5 m
// u okraje (jeden krok Zpět s úpravou), „⛶ Přizpůsobit pohled“, jemná mřížka a plocha v razítku PDF i v DXF.
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

async function screen(canvas: Locator, x: number, y: number) {
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

test("📐 Plocha půdorysu: předvolby, vlastní rozměr, rozšíření u okraje, Přizpůsobit pohled a plocha v PDF / DXF", async ({ page }) => {
  test.setTimeout(420_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const width = page.getByTestId("plane-width");
  const height = page.getByTestId("plane-height");
  const preset = page.getByTestId("plane-preset");

  // Výchozí čistý rastr 20 × 16 m s jemnou mřížkou 0,5 m
  await expect(width).toHaveValue("20");
  await expect(height).toHaveValue("16");
  await expect(preset).toHaveValue("house");
  await expect(canvas).toHaveAttribute("viewBox", "0 0 20000 16000");
  await expect(canvas.getByTestId("grid-fine")).toHaveAttribute("data-step", "500");

  // Předvolba haly 50 × 35 m (v celkovém pohledu jen mřížka po 1 m)
  await preset.selectOption("hall");
  await expect(canvas).toHaveAttribute("viewBox", "0 0 50000 35000");
  await expect(width).toHaveValue("50");
  await expect(canvas.getByTestId("grid-fine")).toHaveCount(0);

  // Vlastní rozměr: mimo rozsah se ořízne na 5 m, pak zpět na rodinný dům
  await width.fill("3");
  await width.press("Enter");
  await expect(width).toHaveValue("5");
  await expect(page.getByText(/rozměr jde nastavit od 5 do 100 m/)).toBeVisible();
  await preset.selectOption("house");
  await expect(canvas).toHaveAttribute("viewBox", "0 0 20000 16000");

  // Místnost nakreslená k pravému okraji → plocha 25 × 16 m
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit místnost (obdélník)" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const from = await screen(canvas, 14_000, 2000);
  const to = await screen(canvas, 19_600, 6000);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await expect(width).toHaveValue("25");
  await expect(preset).toHaveValue("custom");
  await expect(page.getByText(/Plocha rozšířena na 25 × 16 m/)).toBeVisible();
  await expect(canvas.locator("[data-room]")).toHaveCount(1);

  // Zpět vrátí místnost i rozšíření jedním krokem, Znovu obojí obnoví
  await page.keyboard.press("Control+z");
  await expect(width).toHaveValue("20");
  await expect(canvas.locator("[data-room]")).toHaveCount(0);
  await page.keyboard.press("Control+y");
  await expect(width).toHaveValue("25");
  await expect(canvas.locator("[data-room]")).toHaveCount(1);

  // ⛶ Přizpůsobit pohled: výřez na nakreslenou místnost, jemná mřížka
  await page.getByRole("button", { name: /Přizpůsobit pohled/ }).click();
  await expect.poll(async () => Number(await canvas.getAttribute("data-zoom"))).toBeGreaterThan(200);
  await expect(canvas.getByTestId("grid-fine")).toHaveAttribute("data-step", "500");
  await page.screenshot({ path: "test-results/phase83-plane.png" });

  // Plocha v DXF a v razítku tiskového listu PDF
  await page.getByTestId("wizard-step-5").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-dxf").click()]);
  expect(readFileSync((await download.path())!, "utf8")).toContain(String.raw`plocha 25 \U+00D7 16 m`);
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByTestId("export-pdf").click();
  await page.getByTestId("export-print").click();
  await expect(page.getByTestId("title-block")).toContainText("plocha 25 × 16 m");
});
