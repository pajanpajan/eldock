import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 82: zásuvka na světelném okruhu své místnosti – volba v plovoucí nabídce i v detailu zásuvky, jištění okruhu
// 10 / 13 A pro celý půdorys, soupis okruhů „Světla + zásuvky“, normový hlídač a sloupec v soupisu místností.
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

test("💡 Zásuvka na světelném okruhu: volba u zásuvky, jištění 10 / 13 A, soupis okruhů a normový hlídač", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const clickAt = async (x: number, y: number) => {
    // Fáze 89: plátno je vyšší – vystředit, aby horní okraj nebyl pod pevnou hlavičkou stránky
    await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
    const at = await screen(canvas, x, y);
    await page.mouse.click(at.x, at.y);
  };
  const place = async (label: string, points: [number, number][]) => {
    await palette.getByRole("button", { name: label }).first().click();
    for (const [x, y] of points) await clickAt(x, y);
    await page.keyboard.press("Escape");
  };
  // Místnost se světlem, rozváděčem a dvěma zásuvkami
  await page.getByRole("button", { name: "Kreslit místnost (obdélník)" }).click();
  const from = await screen(canvas, 1000, 1000);
  const to = await screen(canvas, 7000, 5000);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await page.keyboard.press("Escape");
  await place("Hlavní domovní / bytový rozváděč", [[1300, 3000]]);
  await place("Stropní svítidlo", [[4000, 3000]]);
  await place("Jednozásuvka", [[3000, 1300], [6000, 4700]]);
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(2);

  // Plovoucí nabídka u zásuvky: 💡 Světelný okruh
  const transform = await canvas.locator('[data-element="socket"]').first().getAttribute("transform");
  const [sx, sy] = (transform ?? "").replace(/translate\(|\)/g, "").trim().split(/\s+/).map(Number);
  await clickAt(sx, sy);
  await page.getByTestId("socket-popover").getByTestId("socket-chip-lighting").click();
  await expect(page.getByTestId("socket-popover").getByTestId("socket-chip-lighting")).toHaveAttribute("aria-pressed", "true");
  const picker = page.getByTestId("socket-circuit-picker");
  await expect(picker.getByTestId("socket-circuit-select")).toHaveValue("lighting");
  await expect(picker.getByTestId("socket-circuit-current")).toContainText("Světla + zásuvky");
  await expect(picker.getByTestId("socket-circuit-current")).toContainText("jistič B10");
  await expect(page.getByTestId("circuit-list")).toContainText("Světla + zásuvky");

  // Jištění 13 A pro celý půdorys → přehled smíšených okruhů a normový hlídač
  await picker.getByTestId("lighting-socket-rating").getByRole("radio", { name: "B13" }).click();
  await expect(picker.getByTestId("socket-circuit-current")).toContainText("jistič B13");
  const mixed = page.getByTestId("lighting-socket-circuits");
  await expect(mixed.getByTestId("lighting-socket-row")).toHaveCount(1);
  await expect(mixed.getByTestId("lighting-socket-row")).toContainText("B13");
  await expect(page.getByText(/1× zásuvka na světelném okruhu – okruh jistí jistič 13 A \(nikdy 16 A\)/)).toBeVisible();

  // Zpět na zásuvkový okruh (automaticky)
  await picker.getByTestId("socket-circuit-select").selectOption("auto");
  await expect(mixed).toHaveCount(0);
  await expect(page.getByTestId("circuit-list")).not.toContainText("Světla + zásuvky");
  await page.screenshot({ path: "test-results/phase82-floorplan.png" });
});

test("💡 Soupis místností: sloupec zásuvek na světelném okruhu a jistič B10 / B13", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await page.getByRole("button", { name: /Ze soupisu místností/ }).click({ timeout: 3_000 });
    await expect(page.getByTestId("schedule-editor")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("schedule-editor").locator("thead")).toContainText("💡 zás.");
  await page.getByLabel("Zásuvky na světelném okruhu (jištění 10 / 13 A) – Chodba").fill("1");
  await page.locator("#pb-lighting-socket").selectOption("13");
  await expect(page.locator("#pb-lighting-socket")).toHaveValue("13");
});
