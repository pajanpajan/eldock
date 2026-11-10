import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 89: místnost zadáním rozměrů X × Y, přesun tažením s magnetickým přichycením ke stěně sousední místnosti,
// průvodce 2D půdorysem v 5 krocích a trvalé přepnutí do kompaktní CAD lišty (localStorage).
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
  await canvas.evaluate((svg) => svg.scrollIntoView({ block: "center", behavior: "instant" }));
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

async function roomBySize(page: Page, name: string, x: string, y: string) {
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill(name);
  await form.getByTestId("room-size-x").fill(x);
  await form.getByTestId("room-size-y").fill(y);
  await form.getByTestId("room-size-y").press("Enter");
}

test("📐 Místnost podle rozměrů X × Y a přisunutí s přichycením ke stěně sousední místnosti", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  // Nový nákres začíná krokem 1 průvodce (podklad a místnosti) – nad plátnem jediná lišta
  const wizard = page.getByTestId("floorplan-wizard");
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("device-appearance")).toHaveCount(0);

  // Obývací pokoj 5,5 × 4,0 m (tečka i čárka) a ložnice 4 × 3,5 m na volném místě vedle
  await roomBySize(page, "Obývací pokoj", "5.5", "4,0");
  const living = canvas.getByTestId("room-Obývací pokoj");
  await expect(living).toHaveAttribute("width", "5500");
  await expect(living).toHaveAttribute("height", "4000");
  await expect(canvas.locator('[data-room="Obývací pokoj"]')).toContainText("5,5 × 4 m (22 m²)");
  await roomBySize(page, "Ložnice", "4", "3,5");
  const bedroom = canvas.getByTestId("room-Ložnice");
  await expect(bedroom).toHaveAttribute("x", "7000");
  await expect(bedroom).toHaveAttribute("y", "1000");

  // Přisunutí ložnice tažením za plochu: levá stěna 50 mm od stěny obýváku a o 100 mm níž → přichytí se líc na líc a do rohu
  const from = await screen(canvas, 9000, 2750);
  const to = await screen(canvas, 8550, 2830);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await expect(canvas.locator('[data-testid="snap-guide"][data-kind="wall"]')).toHaveCount(1);
  await page.mouse.up();
  await expect(bedroom).toHaveAttribute("x", "6500");
  await expect(bedroom).toHaveAttribute("y", "1000");
  await expect(canvas.getByTestId("snap-guide")).toHaveCount(0);

  // Dvojklik na místnost → přepis Šířky X v detailu místnosti
  const middle = await screen(canvas, 8500, 3000);
  await page.mouse.dblclick(middle.x, middle.y);
  const width = page.getByTestId("room-detail").getByLabel("Šířka X [m]");
  await expect(width).toBeFocused();
  // pole detailu je číselné (desetinný oddělovač podle jazyka prohlížeče) – Playwright do něj píše tečkou
  await width.fill("4.5");
  await width.press("Enter");
  await expect(bedroom).toHaveAttribute("width", "4500");
  await page.screenshot({ path: "test-results/phase89-rooms.png" });
});

test("🧭 Průvodce v 5 krocích a trvalý kompaktní režim bez průvodce (localStorage)", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  const wizard = page.getByTestId("floorplan-wizard");
  const steps: [string, string][] = [
    ["2", "device-appearance"],
    ["3", "symbol-scale"],
    ["4", "cable-view-color"],
    ["5", "wizard-generate"],
  ];
  for (const [step, testId] of steps) {
    await page.getByTestId("wizard-next").click();
    await expect(wizard).toHaveAttribute("data-step", step);
    await expect(page.getByTestId(testId)).toBeVisible();
  }
  await expect(page.getByTestId("wizard-next")).toHaveCount(0);
  // Odznak zvoleného designu vrací na krok 2, krok jde vybrat i kliknutím
  await page.getByTestId("design-badge").click();
  await expect(wizard).toHaveAttribute("data-step", "2");
  await page.getByTestId("wizard-step-1").click();
  await expect(page.getByTestId("room-by-size")).toBeVisible();

  // Kompaktní lišta: jeden řádek, menu na kliknutí, volba přežije znovunačtení
  await page.getByTestId("ui-mode-compact").click();
  await expect(page.getByTestId("floorplan-compact-bar")).toBeVisible();
  await expect(wizard).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("eldock-floorplan-ui-mode"))).toBe("compact");
  await page.getByTestId("compact-design").click();
  await expect(page.getByTestId("compact-design-panel").getByTestId("device-appearance")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("compact-design-panel")).toHaveCount(0);
  await page.getByTestId("compact-routes").click();
  await expect(page.getByTestId("compact-routes-panel").getByTestId("cable-view-cad")).toBeVisible();
  await page.screenshot({ path: "test-results/phase89-compact.png" });
  await page.reload();
  await expect(page.getByTestId("floorplan-compact-bar")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("floorplan-wizard")).toHaveCount(0);
  // Zpět na průvodce
  await page.getByTestId("ui-mode-wizard").click();
  await expect(page.getByTestId("floorplan-wizard")).toBeVisible();
  expect(await page.evaluate(() => window.localStorage.getItem("eldock-floorplan-ui-mode"))).toBe("wizard");
});
