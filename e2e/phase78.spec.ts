import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

// Fáze 78: šablony sestav ve víceramečku (firma + prohlížeč), hvězdičky oblíbených s řazením nahoru a návratem na
// původní místo, kód půdorysu FP-…, „☁️ Uloženo v cloudu (HH:MM:SS)“, „📂 Moje uložené půdorysy“ a projekt do počítače
// (`.eldock.json`) a zpět se stejným nákresem.
test.describe.configure({ mode: "serial" });

const el = (id: string, item: string, x: number, y: number, room: string, extra: Record<string, unknown> = {}) => ({ id, item, x, y, room, mountHeightMm: null, frameUnits: 1, series: null, color: null, controls: [], rotation: 0, scale: null, ...extra });

function flat() {
  return {
    version: 1,
    background: null,
    calibration: { state: "none", referenceMm: null, check: null, drawingScale: null, scaleDeviationPct: null, at: null },
    symbolScale: 1,
    environment: "INDOOR_DRY",
    mmPerPx: 10,
    widthMm: 10_000,
    heightMm: 7000,
    rooms: [{ id: "m1", name: "Obývák", x: 500, y: 500, w: 6000, h: 4500 }],
    elements: [el("rh", "panel", 800, 2700, "Obývák", { rotation: 90 }), el("z1", "socket", 2000, 500, "Obývák"), el("l1", "ceiling-light", 3500, 2500, "Obývák", { light: { dimmable: true, powerW: 30, load: "dali", control: "dali", cct: true } }), el("s1", "switch-1", 6400, 1500, "Obývák", { controls: ["l1"], rotation: 270 })],
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
    routeEdits: { "panel>z1": [{ x: 800, y: 600 }, { x: 2000, y: 600 }] },
    cableView: "color",
    socketGrouping: "compact",
    smartExtras: {},
    basinZone: "norm",
    updatedAt: 1,
  };
}

async function openFlat(page: Page, key: string) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(
    ({ draft, key }) => {
      if (!window.sessionStorage.getItem(key)) {
        window.localStorage.setItem("eldock.pb.floorplan:novy", JSON.stringify({ baseVersion: null, draft, at: Date.now() }));
        window.sessionStorage.setItem(key, "1");
      }
    },
    { draft: flat(), key },
  );
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  // Obnovený koncept se hned uloží do cloudu a dostane kód půdorysu
  await expect(page.getByTestId("floorplan-save-status")).toContainText(/Uloženo v cloudu \(\d{1,2}:\d{2}:\d{2}\)/, { timeout: 30_000 });
  await expect(page.getByTestId("floorplan-code")).toHaveText(/^FP-\d{3}$/);
}

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

test("šablona sestavy z vlastní sestavy, vložení jedním klikem a ⭐ oblíbené nahoru i zpět na původní místo", async ({ page }) => {
  await openFlat(page, "phase78-templates");
  const sets = page.getByRole("region", { name: "Sestavy ve víceramečku" });
  // Vlastní sestava vypínač č. 1 + jednozásuvka → šablona firmy
  await sets.getByTestId("assembly-custom-toggle").click();
  const custom = sets.getByTestId("assembly-custom");
  await custom.getByLabel("Pozice 1 sestavy").selectOption("switch-1");
  await custom.getByTestId("template-save-open").click();
  await custom.getByLabel("Název šablony sestavy").fill("Vstup do pokoje 2R");
  await custom.getByTestId("template-save-confirm").click();
  const templates = sets.getByTestId("assembly-templates");
  await expect(templates).toContainText("Vstup do pokoje 2R");
  // Vložení šablony jedním klikem do místnosti
  await templates.locator('[data-assembly^="template:"]').filter({ hasText: "Vstup do pokoje 2R" }).click();
  const at = await screen(page, 3500, 4000);
  await page.mouse.click(at.x, at.y);
  await page.keyboard.press("Escape");
  const canvas = page.getByTestId("floorplan-canvas");
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="2"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="switch-1"]')).toHaveCount(2);

  // ⭐ Dvojzásuvka: nahoru na začátek zásuvek a do sekce Oblíbené; po odebrání zpět na druhé místo
  const sockets = page.locator("#palette-sockets");
  const entryIds = () => sockets.locator("[data-entry]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-entry")));
  const before = await entryIds();
  expect(before.indexOf("double-socket")).toBeGreaterThan(0);
  await sockets.locator('[data-entry="double-socket"]').getByTestId("favorite-star").click();
  await expect.poll(entryIds).toEqual(["double-socket", ...before.filter((id) => id !== "double-socket")]);
  await expect(page.locator("#palette-favorites")).toContainText("Dvojzásuvka");
  await sockets.locator('[data-entry="double-socket"]').getByTestId("favorite-star").click();
  await expect.poll(entryIds).toEqual(before);
  await expect(page.locator("#palette-favorites")).toHaveCount(0);
  // ⭐ u hotové sestavy: přesune se na začátek hotových sestav, po odebrání zpět
  const presets = sets.getByTestId("assembly-presets");
  const presetIds = () => presets.locator("[data-assembly]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-assembly")));
  const presetsBefore = await presetIds();
  expect(presetsBefore.indexOf("set-3z")).toBeGreaterThan(0);
  await presets.locator('[data-assembly="set-3z"]').locator("..").getByTestId("favorite-star").click();
  await expect.poll(presetIds).toEqual(["set-3z", ...presetsBefore.filter((id) => id !== "set-3z")]);
  await presets.locator('[data-assembly="set-3z"]').locator("..").getByTestId("favorite-star").click();
  await expect.poll(presetIds).toEqual(presetsBefore);

  // Po obnovení stránky šablona zůstává (prohlížeč + firma)
  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByRole("region", { name: "Sestavy ve víceramečku" }).getByTestId("assembly-templates")).toContainText("Vstup do pokoje 2R");
});

test("projekt do počítače (.eldock.json) a zpět se stejným nákresem jako nový půdorys; 📂 Moje uložené půdorysy", async ({ page }) => {
  await openFlat(page, "phase78-file");
  const code = (await page.getByTestId("floorplan-code").textContent())!.trim();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("floorplan-export").click()]);
  expect(download.suggestedFilename()).toMatch(/\.eldock\.json$/);
  const path = await download.path();
  const file = JSON.parse(readFileSync(path, "utf8"));
  expect(file).toMatchObject({ format: "eldock-floorplan", schemaVersion: 1, meta: { code } });
  expect(file.draft.elements).toHaveLength(4);
  expect(file.draft.routeEdits["panel>z1"]).toHaveLength(2);
  expect(file.draft.elements.find((element: { id: string }) => element.id === "l1").light).toMatchObject({ cct: true, control: "dali" });

  // Nahrání souboru = nový půdorys firmy s dalším kódem a stejnými prvky, volbami svítidla a ruční trasou
  await page.getByTestId("floorplan-import-input").setInputFiles(path);
  await expect(page).not.toHaveURL(/\/novy$/);
  await expect(page.getByTestId("floorplan-code")).not.toHaveText(code, { timeout: 30_000 });
  const canvas = page.getByTestId("floorplan-canvas");
  await expect(canvas.locator("[data-element]")).toHaveCount(4);
  await expect(canvas.locator('[data-element="ceiling-light"] [data-testid="light-badges"]')).toHaveAttribute("data-badges", "DIM CCT DALI");
  const importedCode = (await page.getByTestId("floorplan-code").textContent())!.trim();

  // 📂 Moje uložené půdorysy: oba kódy, otevřený je označený, přepnutí na původní
  await page.getByTestId("floorplan-cloud-list").click();
  const dialog = page.getByTestId("cloud-floorplans");
  await expect(dialog.locator(`[data-code="${code}"]`)).toBeVisible();
  await expect(dialog.locator(`[data-code="${importedCode}"]`)).toContainText("otevřený");
  await dialog.locator(`[data-code="${code}"]`).click();
  await expect(page.getByTestId("floorplan-code")).toHaveText(code, { timeout: 30_000 });
});
