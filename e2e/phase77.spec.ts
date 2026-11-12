import { expect, test, type Page } from "@playwright/test";
import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 77: stínící technika (vývody motorů žaluzií), čidla oken a vody, chytré termostaty a hlavice, pokročilé osvětlení
// (stmívání, CCT, RGB / RGBW, DALI, 24 V PWM) se štítky u značky, rychlou lištou u světla a moduly do rozváděče.
test.describe.configure({ mode: "serial" });

const el = (id: string, item: string, x: number, y: number, room: string, extra: Record<string, unknown> = {}) => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

/** Obývák s oknem (motory žaluzií), termostatem s hlavicemi, čidly a světly; koupelna s čidlem vody. */
function house(installation: "classic" | "bus_loxone") {
  const bus = installation === "bus_loxone";
  return {
    version: 1,
    background: null,
    calibration: { state: "none", referenceMm: null, check: null, drawingScale: null, scaleDeviationPct: null, at: null },
    symbolScale: 1,
    environment: "INDOOR_DRY",
    mmPerPx: 10,
    widthMm: 12_000,
    heightMm: 7000,
    rooms: [
      { id: "m1", name: "Obývák", x: 500, y: 500, w: 6000, h: 4500 },
      { id: "m2", name: "Koupelna", x: 6500, y: 500, w: 3500, h: 4500 },
    ],
    elements: [
      el("rh", "panel", 800, 2700, "Obývák", { rotation: 90 }),
      el("z1", "socket", 2000, 500, "Obývák"),
      el("l1", "ceiling-light", 3500, 2200, "Obývák"),
      el("s1", bus ? "bus-1" : "switch-1", 6400, 1500, "Obývák", { controls: ["l1"], rotation: 270 }),
      el("p1", "led-strip", 3500, 3800, "Obývák", { light: { dimmable: true, powerW: 40, load: "led", color: "rgbw" } }),
      el("bs", bus ? "bus-blind" : "blind", 6400, 2000, "Obývák", { controls: ["mo1"], rotation: 270 }),
      el("mo1", "blind-motor", 2500, 5000, "Obývák", { rotation: 180 }),
      el("mo2", "blind-motor", 5000, 5000, "Obývák", { rotation: 180, drive: "dc24" }),
      el("t1", bus ? "bus-smart-thermostat" : "smart-thermostat", 6400, 3200, "Obývák", { controls: ["h1"], rotation: 270 }),
      el("h1", "heating-head", 1300, 4600, "Obývák"),
      el("h2", "heating-head", 4500, 4600, "Obývák"),
      el("w1", "window-contact", 3800, 5000, "Obývák", { rotation: 180 }),
      el("v1", "water-sensor", 8500, 4600, "Koupelna"),
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
    installation,
    installMethod: "C",
    groupedCables: 1,
    countDoubleAsTwo: true,
    supplySystem: "3F_TNS",
    smartSystem: "loxone",
    appliances: [],
    routeEdits: {},
    cableView: "color",
    socketGrouping: "compact",
    smartExtras: {},
    basinZone: "norm",
    updatedAt: 1,
  };
}

async function openHouse(page: Page, draft: ReturnType<typeof house>, key: string) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(
    ({ draft, key }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("eldock.pb.floorplan:novy", JSON.stringify({ baseVersion: null, draft, at: Date.now() }));
        window.sessionStorage.setItem(key, "1");
      }
    },
    { draft, key },
  );
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await goPhase(page, 5);
  // Fáze 100: soupis okruhů je v záložce 🔌 Okruhy & Trasy
  await rightTab(page, "circuits");
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

async function clickAt(page: Page, x: number, y: number) {
  const at = await screen(page, x, y);
  await page.mouse.click(at.x, at.y);
}

test("klasika: paleta stínění, štítky a volby svítidla, rychlá lišta, pohon motoru a párování hlavic", async ({ page }) => {
  await openHouse(page, house("classic"), "phase77-classic");
  const canvas = page.getByTestId("floorplan-canvas");
  // Paleta: skupina stínící techniky, čidel a vytápění (fáze 98: ve fázi 4 se světly a ovladači)
  // „Rozbalit vše“ je neaktivní, když je paleta už celá rozbalená (výchozí stav)
  await goPhase(page, 4);
  const expand = page.getByTestId("palette-expand-all");
  if (await expand.isEnabled()) await expand.click();
  const shading = page.locator("#palette-shading");
  for (const symbol of ["ZAL_M", "MAG", "VOD", "TER_S", "HLV"]) await expect(shading.getByRole("button", { name: new RegExp(symbol) }).first()).toBeVisible();
  await expect(page.locator("#palette-lights").getByRole("button", { name: /LED_P/ })).toBeVisible();
  // Značky dle ČSN EN 60617: motor Ⓜ, ventil hlavice, čidla
  await expect(canvas.locator('[data-symbol="blind_motor"]')).toHaveCount(2);
  await expect(canvas.locator('[data-symbol="valve"]')).toHaveCount(2);
  await expect(canvas.locator('[data-symbol="sensor"]')).toHaveCount(2);
  // LED pásek RGBW na 24 V PWM má štítky u značky
  await expect(canvas.locator('[data-element="led-strip"] [data-testid="light-badges"]')).toHaveAttribute("data-badges", "DIM RGBW 24V");
  // Žaluziový okruh B10 v soupisu okruhů (jen motor 230 V; 24 V DC napájí zdroj systému) – soupis okruhů ve fázi 5
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  const list = page.getByTestId("circuit-list");
  await expect(list.locator('[data-testid="circuit-row"][data-layer="shading"]')).toContainText("Žaluzie – Obývák");
  await expect(list.locator('[data-testid="circuit-row"]').filter({ hasText: "Zdroj 24 V DC – LED osvětlení" })).toHaveCount(1);

  // Detail světla: CCT přepne fázové stmívání na DALI (DT8) – štítky u značky
  await clickAt(page, 3500, 2200);
  const spec = page.getByTestId("light-spec");
  await expect(spec).toBeVisible();
  await spec.getByTestId("light-cct").check();
  const badges = canvas.locator('[data-element="ceiling-light"] [data-testid="light-badges"]');
  await expect(badges).toHaveAttribute("data-badges", "DIM CCT DALI");
  await expect(spec.getByTestId("light-control-dali")).toHaveAttribute("aria-checked", "true");
  await expect(spec.getByTestId("light-tech-note")).toContainText("5×1,5");
  // Rychlá lišta u světla: 🌈 zapne RGBW
  await page.getByTestId("quick-color").click();
  await expect(badges).toHaveAttribute("data-badges", "DIM CCT RGBW DALI");
  await rightTab(page, "circuits");
  await expect(list.locator('[data-testid="circuit-row"]').filter({ hasText: "(DALI)" })).toHaveCount(1);
  await page.keyboard.press("Escape");

  // Motor žaluzie: pohon 24 V DC → kabel SYKFY / CAT7 a žaluziový okruh 230 V zmizí
  await clickAt(page, 2500, 4900);
  const device = page.getByTestId("device-controls");
  await expect(device).toContainText("Ovladač: ZAL (Obývák)");
  await device.getByTestId("blind-drive").selectOption("dc24");
  await expect(device).toContainText("SYKFY / CAT7");
  await rightTab(page, "circuits");
  await expect(list.locator('[data-testid="circuit-row"]').first()).toBeVisible();
  await expect(list.locator('[data-testid="circuit-row"][data-layer="shading"]')).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Termostat: párování s druhou hlavicí
  await clickAt(page, 6400, 3200);
  await expect(device).toContainText("Ovládá 1 hlavici");
  await device.getByTestId("pair-device").click();
  await expect(page.getByTestId("pairing-note")).toBeVisible();
  await clickAt(page, 4500, 4600);
  await page.keyboard.press("Escape");
  await clickAt(page, 6400, 3200);
  await expect(device).toContainText("Ovládá 2 hlavice");
});

test("sběrnice: kanály 24 V PWM a binárních vstupů, zdroj LED s rezervou 20 % a moduly v chytré domácnosti", async ({ page }) => {
  await openHouse(page, house("bus_loxone"), "phase77-bus");
  // Fáze 98: akční členy chytré domácnosti v pravém panelu fáze 4, soupis okruhů ve fázi 5
  await goPhase(page, 4);
  const smart = page.getByTestId("smart-home");
  await expect(smart).toBeVisible();
  await expect(smart.getByTestId("smart-channels").locator('[data-role="pwm"]')).toBeVisible();
  await expect(smart.getByTestId("smart-channels").locator('[data-role="input"]')).toBeVisible();
  // 2 drátové hlavice + rezerva 20 % (aspoň 1 kanál) = 3 kanály topení
  await expect(smart.getByTestId("smart-channels").locator('[data-role="heating"]')).toContainText("topení: 3");
  // 40 W × 1,2 = 48 W → zdroj HDR-60-24
  await expect(smart.getByTestId("smart-led-supply")).toContainText("48 W");
  await expect(smart.getByTestId("smart-modules")).toContainText("HDR-60-24");
  // Sběrnice: žaluziové aktory napájí jeden okruh B10 v rozváděči
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("circuit-list").locator('[data-testid="circuit-row"][data-layer="shading"]')).toContainText("napájení žaluziových akčních členů");
});
