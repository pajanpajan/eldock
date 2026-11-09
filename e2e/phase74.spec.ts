import { expect, test, type Page } from "@playwright/test";

// Fáze 74: soupis okruhů s vrstvami a výběrem okruhu (úprava trasy jen u něj), plovoucí nabídka okruhu u zásuvky,
// podružný rozváděč s přiřazením okruhů a generováním propojených rozváděčů, ochranná zóna umyvadla, barva rámečku
// a klapky zvlášť a přepracovaný levý panel.
test.describe.configure({ mode: "serial" });

const el = (id: string, item: string, x: number, y: number, room: string, extra: Record<string, unknown> = {}) => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

/** Dům: obývák, garáž s podružným rozváděčem RP1, koupelna s umyvadlem a chodba s hlavním rozváděčem. */
function house() {
  return {
    version: 1,
    background: null,
    calibration: { state: "none", referenceMm: null, check: null, drawingScale: null, scaleDeviationPct: null, at: null },
    symbolScale: 1,
    environment: "INDOOR_DRY",
    mmPerPx: 10,
    widthMm: 14_000,
    heightMm: 10_000,
    rooms: [
      { id: "m1", name: "Obývák", x: 500, y: 500, w: 6000, h: 4500 },
      { id: "m2", name: "Garáž", x: 6500, y: 500, w: 5000, h: 4500 },
      { id: "m3", name: "Koupelna", x: 500, y: 5000, w: 3500, h: 3000 },
      { id: "m4", name: "Chodba", x: 4000, y: 5000, w: 7500, h: 3000 },
    ],
    elements: [
      el("rh", "panel", 4300, 7700, "Chodba"),
      el("z1", "socket", 2000, 500, "Obývák"),
      el("z2", "double-socket", 4500, 500, "Obývák"),
      el("z4", "socket", 6000, 5000, "Chodba"),
      el("l1", "ceiling-light", 3500, 2700, "Obývák"),
      el("s1", "switch-1", 1000, 5000, "Obývák", { controls: ["l1"], rotation: 180 }),
      el("d1", "data-socket", 3000, 500, "Obývák"),
      el("rp", "subpanel", 11_200, 2700, "Garáž", { boardCode: "RP1", rotation: 90 }),
      el("g1", "socket", 8000, 500, "Garáž", { board: "RP1" }),
      el("g2", "socket", 10_000, 5000, "Garáž", { board: "RP1", rotation: 180 }),
      el("gl", "ceiling-light", 9000, 2700, "Garáž", { board: "RP1" }),
      el("u", "basin", 1500, 5225, "Koupelna"),
      el("lk", "ceiling-light", 2200, 6500, "Koupelna"),
      el("sk", "switch-1", 3900, 7500, "Koupelna", { controls: ["lk"], rotation: 90 }),
    ],
    frames: [],
    annotations: [],
    floorId: "f1",
    floorName: "1. NP",
    floorLevelMm: 0,
    otherFloors: [],
    mode: "OPTIMIZED",
    series: "ABB|Tango",
    color: "abb-tango-n",
    frameColor: null,
    installation: "classic",
    installMethod: "C",
    groupedCables: 1,
    countDoubleAsTwo: true,
    supplySystem: "3F_TNS",
    smartSystem: "abb_freeathome",
    appliances: [],
    routeEdits: {},
    cableView: "color",
    socketGrouping: "compact",
    smartExtras: {},
    basinZone: "norm",
    updatedAt: 1,
  };
}

async function openHouse(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript((draft) => {
    if (!window.sessionStorage.getItem("phase74-seeded")) {
      window.localStorage.setItem("eldock.pb.floorplan:novy", JSON.stringify({ baseVersion: null, draft, at: Date.now() }));
      window.sessionStorage.setItem("phase74-seeded", "1");
    }
  }, house());
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await expect(page.getByTestId("circuit-list")).toBeVisible({ timeout: 30_000 });
}

/** Bod půdorysu v mm → souřadnice obrazovky (bod mimo okno se nejdřív posune doprostřed okna). */
async function screen(page: Page, x: number, y: number) {
  return page.getByTestId("floorplan-canvas").evaluate((svg, point) => {
    const project = () => new DOMPoint(point.x, point.y).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);
    let at = project();
    if (at.y < 0 || at.y > window.innerHeight) {
      window.scrollBy(0, at.y - window.innerHeight / 2);
      at = project();
    }
    return { x: at.x, y: at.y };
  }, { x, y });
}

/** Bod na trase některého okruhu, kde je navrchu klikací plocha trasy (ne značka prvku) – souřadnice obrazovky. */
async function routePickPoint(page: Page) {
  return page.getByTestId("floorplan-canvas").evaluate((svg) => {
    svg.scrollIntoView({ block: "center" });
    for (const path of svg.querySelectorAll<SVGPathElement>('[data-testid="route-pick"]')) {
      const total = path.getTotalLength();
      for (const share of [0.5, 0.35, 0.65, 0.2, 0.8]) {
        const at = path.getPointAtLength(total * share).matrixTransform(path.getScreenCTM()!);
        if (document.elementFromPoint(at.x, at.y)?.getAttribute("data-testid") === "route-pick") return { x: at.x, y: at.y };
      }
    }
    return null;
  });
}

test("soupis okruhů, vrstvy, výběr okruhu a úprava trasy jen u něj; podružný rozváděč RP1", async ({ page }) => {
  await openHouse(page);
  const list = page.getByTestId("circuit-list");
  const canvas = page.getByTestId("floorplan-canvas");
  // Okruhy obou rozváděčů s vlastním číslováním, přívod RP1 a datová zásuvka
  await expect(list.locator('[data-testid="circuit-row"][data-board="RP1"]').first()).toBeVisible();
  await expect(list.locator('[data-testid="circuit-row"][data-layer="feeder"]')).toContainText("Přívod podružného rozváděče RP1");
  await expect(list.locator('[data-testid="circuit-row"][data-layer="data"]')).toContainText("D1");
  await expect(list.locator('[data-testid="circuit-row"][data-board="RP1"][data-layer="sockets"]')).toContainText("RP1 -F1");

  // Vrstvy: skrýt zásuvkové okruhy na plátně a zase zobrazit
  const sockets = canvas.locator('[data-testid="route-layer"] [data-layer="sockets"]');
  await expect(sockets.first()).toBeAttached();
  await page.getByTestId("layer-chips-canvas").getByTestId("layer-sockets").click();
  await expect(sockets).toHaveCount(0);
  await page.getByTestId("layer-chips-canvas").getByTestId("layer-sockets").click();
  await expect(sockets.first()).toBeAttached();

  // Bez vybraného okruhu nejdou úseky tras posouvat
  await expect(canvas.getByTestId("route-handles")).toHaveCount(0);
  await list.locator('[data-testid="circuit-row"][data-board="RP1"][data-layer="sockets"]').click();
  await expect(canvas.getByTestId("route-layer")).toHaveAttribute("data-focus", "RP1.sockets-1");
  await expect(page.getByTestId("focus-bar")).toBeVisible();
  await expect(canvas.locator('[data-focused="true"] [data-testid="route-handles"]').first()).toBeAttached();
  expect(await canvas.locator('[data-testid="route-handles"]').count()).toBe(await canvas.locator('[data-focused="true"] [data-testid="route-handles"]').count());
  await expect(canvas.getByTestId("circuit-halo")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(canvas.getByTestId("route-layer")).not.toHaveAttribute("data-focus", /.+/);
  // Klik na trasu okruhu ho vybere (klik přímo na čáru – klikací plocha trasy reaguje jen na tah, ne na obálku)
  const pick = await routePickPoint(page);
  expect(pick).not.toBeNull();
  await page.mouse.click(pick!.x, pick!.y);
  await expect(canvas.getByTestId("route-layer")).toHaveAttribute("data-focus", /.+/);
  await page.keyboard.press("Escape");

  // Zásuvka: plovoucí nabídka okruhů u zásuvky → nový ruční okruh
  const z1 = await screen(page, 2000, 680);
  await page.mouse.click(z1.x, z1.y);
  const popover = page.getByTestId("socket-popover");
  await expect(popover).toBeVisible();
  await expect(popover.getByTestId("socket-chip").first()).toBeVisible();
  await popover.getByTestId("socket-chip-new").click();
  await expect(page.getByText(/v novém ručním okruhu Z1/)).toBeVisible();
  await expect(popover.getByTestId("socket-chip-auto")).toBeVisible();

  // Rozváděč prvku: zásuvka obýváku do RP1 → přejde mezi okruhy RP1
  await page.getByTestId("element-board").getByTestId("board-select").selectOption("RP1");
  await expect(list.locator('[data-testid="circuit-row"][data-board="RP1"][data-layer="sockets"]').first()).toBeVisible();
  await expect.poll(async () => list.locator('[data-testid="circuit-row"][data-board="RP1"][data-layer="sockets"]').count()).toBeGreaterThanOrEqual(1);
  await page.keyboard.press("Escape");

  // Nový podružný rozváděč z palety dostane kód RP2
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await palette.getByRole("button", { name: /Podružný rozváděč \(RP\)/ }).click();
  const at = await screen(page, 2000, 9000);
  await page.mouse.click(at.x, at.y);
  await expect(page.getByTestId("subpanel-info")).toContainText("Podružný rozváděč RP2");
});

test("umyvadlo s ochrannou zónou, barva rámečku zvlášť, rozváděč RH + RP1 z jednoho generování a chytré PDF", async ({ page }) => {
  test.setTimeout(360_000);
  await openHouse(page);
  const canvas = page.getByTestId("floorplan-canvas");
  await expect(canvas.getByTestId("fixture-wash-area")).toHaveCount(1);
  await expect(canvas.getByTestId("fixture-band")).toHaveCount(1);
  const basin = await screen(page, 1500, 5300);
  await page.mouse.click(basin.x, basin.y);
  await page.getByTestId("basin-zone-strict").check();
  await expect(canvas.getByTestId("fixture-basin-strict")).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Barva rámečku jiná než klapka → vzhled v soupisu domovní instalace
  await page.getByTestId("frame-colors").getByTestId("frame-color").filter({ hasText: "Bílá (B)" }).click();
  await page.getByRole("button", { name: /Použít na celý půdorys/ }).click();
  await expect(page.getByTestId("wiring-inventory")).toContainText("rámeček Bílá (B) · klapka Černá (N)");

  // Generování: hlavní rozváděč s přívodem a propojený podružný rozváděč RP1 (1 kredit)
  await expect(page.getByTestId("generate-boards")).toContainText("RH + RP1");
  await page.getByLabel("Název rozváděče").fill("RD Novák E2E 74");
  await page.getByTestId("generate-from-floorplan").click();
  await expect(page.getByText(/Rozváděče RH \+ RP1 jsou propojené projekty/)).toBeVisible({ timeout: 90_000 });
  await page.waitForURL(/\/panel-builder\/[^/]+$/, { timeout: 90_000 });

  // Fáze 75: chytré PDF – odkazy mezi listy, obvody a přístroji vedou na existující místa a přežijí tisk do PDF
  await page.goto(page.url() + "/documentation");
  const sheets = page.getByTestId("documentation");
  await expect(sheets.getByTestId("doc-hub-row").first()).toBeVisible({ timeout: 60_000 });
  await expect(sheets.getByTestId("doc-boards")).toContainText("Podružný rozváděč RP1");
  const targets = await sheets.locator('a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")!.slice(1)));
  const ids = new Set(await sheets.locator("[id]").evaluateAll((nodes) => nodes.map((node) => node.id)));
  expect(targets.length).toBeGreaterThan(30);
  expect(targets.filter((id) => !ids.has(id))).toEqual([]);
  const pdf = (await page.pdf({ preferCSSPageSize: true, printBackground: true })).toString("latin1");
  const named = new Set([...pdf.matchAll(/\/Dest\s*(?:\/([^\s/[\]<>()]+)|\(([^)]*)\))/g)].map((match) => match[1] ?? match[2]));
  // Každý cíl v PDF je kotva dokumentace a v PDF jsou odkazy na rozcestník, obsah i přístroje
  expect([...named].filter((name) => !ids.has(name))).toEqual([]);
  expect(named.has("doc-hub")).toBe(true);
  expect(named.has("list-1")).toBe(true);
  expect([...named].filter((name) => name.startsWith("fn-")).length).toBeGreaterThan(3);
  expect([...named].filter((name) => name.startsWith("sld-")).length).toBeGreaterThan(3);
  // Odkaz z titulního listu na podružný rozváděč RP1 vede na jeho dokumentaci
  await sheets.getByTestId("doc-boards").getByRole("link").first().click();
  await expect(page.getByTestId("doc-boards")).toContainText("Napájen z rozváděče RH", { timeout: 60_000 });
});
