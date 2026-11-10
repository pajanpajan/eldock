import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 65: zásuvkové okruhy v kompaktních zónách s volbou rozdělení, optimalizací a ručním okruhem; obrázkový katalog
// chytré domácnosti (segmentový přepínač ABB, záložky, karty s náhledem a akcemi), ruční moduly na DIN lištu a technický
// list se schématem zapojení (z karty, z palety i z přehledu akčních členů); loga Loxone a TapHome.
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

/** Bod půdorysu v mm → souřadnice obrazovky (přes matici SVG plátna). */
async function screen(canvas: Locator, x: number, y: number) {
  return canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const at = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: at.x, y: at.y };
  }, { x, y });
}

function editor(page: Page) {
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  const clickAt = async (x: number, y: number, shift = false) => {
    await canvas.scrollIntoViewIfNeeded();
    const at = await screen(canvas, x, y);
    if (shift) await page.keyboard.down("Shift");
    await page.mouse.click(at.x, at.y);
    if (shift) await page.keyboard.up("Shift");
  };
  return {
    canvas,
    palette,
    clickAt,
    room: async (x1: number, y1: number, x2: number, y2: number) => {
      await page.getByRole("button", { name: "Kreslit místnost (obdélník)" }).click();
      await canvas.scrollIntoViewIfNeeded();
      const from = await screen(canvas, x1, y1);
      const to = await screen(canvas, x2, y2);
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(to.x, to.y, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.press("Escape");
    },
    /** Skutečná poloha n-té zásuvky (po přichycení ke stěně) – „translate(x y)“ v mm. */
    clickSocket: async (index: number, shift = false) => {
      const transform = await canvas.locator('[data-element="socket"]').nth(index).getAttribute("transform");
      const [x, y] = (transform ?? "").replace(/translate\(|\)/g, "").trim().split(/\s+/).map(Number);
      await clickAt(x, y, shift);
    },
    /** Značka z palety na více místech; Esc ukončí vkládání. */
    place: async (label: string, points: [number, number][]) => {
      await palette.getByRole("button", { name: label }).first().click();
      for (const [x, y] of points) await clickAt(x, y);
      await page.keyboard.press("Escape");
    },
  };
}

test("🔌 Zásuvkové okruhy: kompaktní zóny, volba rozdělení, optimalizace a ruční okruh u zásuvky i výběru", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const fp = editor(page);
  // Byt jako jedna velká místnost, rozváděč uprostřed, zásuvky po obvodu
  await fp.room(1000, 1000, 13_000, 9000);
  await fp.place("Hlavní domovní / bytový rozváděč", [[7000, 5000]]);
  const sockets: [number, number][] = [];
  for (const x of [2000, 4000, 6000, 8000, 10_000, 12_000]) sockets.push([x, 1300], [x, 8700]);
  sockets.push([1300, 5000], [12_700, 5000]);
  await fp.place("Jednozásuvka", sockets);
  await expect(fp.canvas.locator('[data-element="socket"]')).toHaveCount(14);

  const panel = page.getByTestId("socket-circuits");
  const rows = panel.getByTestId("socket-circuit-row");
  await expect(panel.getByTestId("socket-grouping-compact")).toHaveAttribute("aria-checked", "true");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toHaveAttribute("data-designation", /^-F\d+$/);
  // Dosavadní rozdělení: upozornění na okruhy přes celý byt; optimalizace vrátí kompaktní zóny
  await panel.getByTestId("socket-grouping-distance").click();
  await expect(panel.getByTestId("socket-grouping-distance")).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByTestId("socket-distance-hint")).toBeVisible();
  await panel.getByTestId("socket-grouping-rooms").click();
  await expect(panel.getByTestId("socket-grouping-rooms")).toHaveAttribute("aria-checked", "true");
  await panel.getByTestId("optimize-sockets").click();
  await expect(panel.getByTestId("socket-grouping-compact")).toHaveAttribute("aria-checked", "true");

  // Ruční okruh u jedné zásuvky (první vložená, vlevo nahoře): nový ruční okruh Z1, Ctrl+Z vrátí automatické rozdělení
  await fp.clickSocket(0);
  const picker = page.getByTestId("socket-circuit-picker");
  await expect(picker).toBeVisible();
  await expect(picker.getByTestId("socket-circuit-current")).toContainText("automaticky");
  await picker.getByTestId("socket-circuit-select").selectOption("new");
  await expect(picker.getByTestId("socket-circuit-current")).toContainText("ruční okruh Z1");
  await expect(panel.getByText("ruční Z1")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await expect(panel.getByText("ruční Z1")).toHaveCount(0);

  // Výběr dvou vzdálených zásuvek (vlevo nahoře a vpravo dole) → spojit do jednoho okruhu
  await fp.clickSocket(0);
  await fp.clickSocket(11, true);
  const selection = page.getByTestId("selection-sockets");
  await expect(selection).toContainText("Zásuvek ve výběru: 2");
  await selection.getByTestId("join-sockets").click();
  await expect(panel.getByText("ruční Z1")).toBeVisible();
  await expect(rows).toHaveCount(3);
  // Klik na okruh v panelu vybere jeho zásuvky na plátně
  await page.keyboard.press("Escape");
  await rows.filter({ hasText: "ruční Z1" }).click();
  await expect(page.getByTestId("selection-panel")).toContainText("Vybráno 2 prvků");
  await page.screenshot({ path: "test-results/phase65-sockets.png" });
});

test("🏠 Chytrá domácnost: segmentový přepínač ABB, obrázkový katalog, osazení, ruční moduly a technický list se schématem", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const fp = editor(page);
  const appearance = page.getByTestId("device-appearance");

  // Segmentový přepínač rodin ABB s podtitulky
  const families = appearance.getByTestId("abb-families");
  await expect(families.getByRole("radio")).toHaveCount(3);
  await expect(families).toContainText("17 designových řad");
  await expect(families).toContainText("Chytrá elektroinstalace – 24 V sběrnice & Wireless");
  await expect(families).toContainText("Systémová automatizace budov");
  await families.locator('[data-family="abb-fah"]').click();
  const catalog = appearance.getByTestId("smart-catalog");
  await expect(catalog).toHaveAttribute("data-family", "abb-fah");
  await catalog.getByTestId("smart-catalog-level").getByRole("button", { name: "Přepnout na sběrnicovou instalaci" }).click();
  if (await page.getByTestId("level-conversion").isVisible()) await page.getByTestId("level-convert").click();
  await expect(catalog.getByTestId("smart-catalog-level")).toHaveCount(0);

  // Záložky a karty s vektorovým náhledem, popisem a štítky
  for (const tab of ["controls", "inbox", "panels", "din"]) await expect(catalog.getByTestId(`smart-tab-${tab}`)).toBeVisible();
  const sensor = catalog.locator('[data-card="fah-sensor-2"]');
  await expect(sensor.getByTestId("device-illustration")).toHaveAttribute("data-kind", "button");
  await expect(sensor.getByTestId("device-badges")).toContainText("24 V DC sběrnice");
  // Osadit do půdorysu → Osazeno: 1 ks
  await sensor.locator('[data-product="fah-sensor-2"]').click();
  await fp.clickAt(5000, 5000);
  await page.keyboard.press("Escape");
  await expect(fp.canvas.locator('[data-element="bus-2"]')).toHaveCount(1);
  await expect(sensor.getByTestId("placed-count")).toHaveText("Osazeno: 1 ks");
  // Prvky do krabičky: akční člen se svorkovnicí
  await catalog.getByTestId("smart-tab-inbox").click();
  await expect(catalog.locator('[data-card="fah-wl-act-1"]').getByTestId("device-illustration")).toHaveAttribute("data-kind", "inbox");

  // DIN lišta: automatický počet a ruční navýšení (přičte se do přehledu akčních členů); fáze 81 – „V rozváděči: X ks
  // (Y automaticky z půdorysu + Z ručně přidáno)“
  await catalog.getByTestId("smart-tab-din").click();
  const psu = catalog.locator('[data-card="abb_freeathome-fah-psu"]');
  await expect(psu.getByTestId("din-auto")).toHaveText("1");
  await expect(psu.getByTestId("din-total")).toHaveText("1 ks");
  const sa8 = catalog.locator('[data-card="abb_freeathome-fah-sa8"]');
  await expect(sa8.getByTestId("din-auto")).toHaveText("0");
  await sa8.getByTestId("din-add").click();
  await expect(sa8.getByTestId("din-manual")).toHaveText("1");
  await expect(sa8.getByTestId("din-count")).toContainText("V rozváděči: 1 ks (0 automaticky z půdorysu + 1 ručně přidáno)");
  const smart = page.getByTestId("smart-home");
  await expect(smart.getByTestId("smart-modules")).toContainText("SA-M-8.16.2.2");
  await expect(smart.getByTestId("smart-modules")).toContainText("ručně");
  await sa8.getByTestId("din-remove").click();
  await expect(sa8.getByTestId("din-manual")).toHaveText("0");
  await expect(sa8.getByTestId("din-total")).toHaveText("0 ks");

  // Technický list z karty: parametry, kóty a schéma zapojení
  await sa8.getByTestId("datasheet-open").click();
  const sheet = page.getByTestId("datasheet");
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("heading", { name: /8násobný/ })).toBeVisible();
  await expect(sheet.getByTestId("datasheet-ids")).toContainText("2CDG510026R0011");
  await expect(sheet.locator('[data-row="voltage"]')).toContainText("24 V DC");
  await expect(sheet.locator('[data-row="ip"]')).toContainText("IP 20");
  await expect(sheet.getByTestId("dimension-w")).toContainText("140 mm");
  await expect(sheet.getByTestId("wiring-diagram")).toHaveAttribute("data-wiring", "din-switch");
  await expect(sheet.getByTestId("wiring-diagram").locator('[data-terminal="BUS+"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(sheet).toHaveCount(0);
  // Technický list z palety (sběrnicový prvek) a z přehledu akčních členů
  await page.getByTestId("palette-datasheet").first().click();
  await expect(page.getByTestId("datasheet").getByTestId("wiring-diagram")).toHaveAttribute("data-wiring", "bus-fah");
  await page.keyboard.press("Escape");
  await smart.getByTestId("module-datasheet").first().click();
  await expect(page.getByTestId("datasheet")).toBeVisible();
  await page.keyboard.press("Escape");

  // Loxone: dotykový ovladač bez rámečku, čisté logo
  await appearance.getByRole("radio", { name: "Loxone", exact: true }).click();
  await expect(appearance.getByTestId("smart-catalog")).toHaveAttribute("data-family", "loxone");
  // Otevřená záložka (DIN lišta) zůstává i u jiného výrobce – ovladače jsou ve vlastní záložce
  await appearance.getByTestId("smart-tab-controls").click();
  await expect(appearance.locator('[data-card="lox-touch-pure"]').getByTestId("device-illustration")).toHaveAttribute("data-kind", "touch");
  const loxone = await (await page.request.get("/api/brand-logo/loxone")).text();
  expect(loxone).toContain("LOXONE");
  expect(loxone).toContain("#69C350");
  expect(loxone).not.toContain("#000000");
  expect(await (await page.request.get("/api/brand-logo/taphome")).text()).toContain("TapHome");
  await page.screenshot({ path: "test-results/phase65-smart.png" });
});
