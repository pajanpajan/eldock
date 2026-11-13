import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";
import { goPhase, goPhaseForGroup, phaseForPalette, rightTab } from "./floorplan-phases";

// Fáze 63: 2D půdorys – akordeon palety, zařizovací předměty ve skutečném rozměru (žlutý roh, kóty, 45°, pás u
// umyvadla), knihovna samostatných spotřebičů, ruční posun tras v osách X / Y s resetem na automat, polygonální
// místnost se šikmou stěnou, normové CAD značení kabelů, export PDF / DXF, odkaz na web výrobce a výrobky
// chytré domácnosti (ABB-free@home, TapHome) v liště výrobců.
test.describe.configure({ mode: "serial" });

async function openFloorplan(page: Page) {
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

test("2D půdorys: akordeon palety, předměty X × Y, spotřebiče, úprava tras, šikmá stěna, CAD značení, export PDF / DXF a chytrá domácnost", async ({ page }) => {
  test.setTimeout(480_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openFloorplan(page);
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  // Fáze 98: značka je v paletě své fáze (rozváděč 2, zásuvky 3, světla a vypínače 4)
  const choose = async (label: string) => {
    await phaseForPalette(page, label);
    await palette.getByRole("button", { name: label, exact: false }).first().click();
  };
  const clickAt = async (x: number, y: number, options: { button?: "left" | "right"; clickCount?: number } = {}) => {
    await canvas.scrollIntoViewIfNeeded();
    const at = await screen(canvas, x, y);
    await page.mouse.click(at.x, at.y, options);
  };
  const title = page.getByTestId("mode-bar-title");

  // Místnost 8 × 6 m a rozváděč
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit místnost (obdélník)" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const from = await screen(canvas, 1000, 1000);
  const to = await screen(canvas, 9000, 7000);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await choose("Hlavní domovní / bytový rozváděč");
  await clickAt(1500, 6500);

  // 1) Akordeon: počet osazených prvků, sbalit / rozbalit vše, režim jedné kategorie (fáze 98: jen kategorie fáze –
  //    rozváděč ve fázi 2, zásuvky a spotřebiče ve fázi 3; kategorie fáze jsou po přepnutí rozbalené)
  await expect(palette.getByTestId("palette-count-panel")).toHaveText("1");
  await goPhase(page, 3);
  await expect(palette.locator('[data-group][data-open="false"]')).toHaveCount(0);
  await palette.getByTestId("palette-collapse-all").click();
  await goPhaseForGroup(page, "sockets");
  await expect(palette.getByTestId("palette-toggle-sockets")).toHaveAttribute("aria-expanded", "false");
  await expect(palette.getByRole("button", { name: "Jednozásuvka" })).toHaveCount(0);
  await palette.getByTestId("palette-toggle-sockets").click();
  await expect(palette.getByRole("button", { name: "Jednozásuvka" }).first()).toBeVisible();
  await palette.getByTestId("palette-single").check();
  await goPhaseForGroup(page, "appliances");
  await palette.getByTestId("palette-toggle-appliances").click();
  await expect(palette.locator('[data-group][data-open="true"]')).toHaveCount(1);
  await expect(palette.locator('[data-group="appliances"]')).toHaveAttribute("data-open", "true");
  await palette.getByTestId("palette-single").uncheck();
  await palette.getByTestId("palette-expand-all").click();
  await expect(palette.locator('[data-group][data-open="false"]')).toHaveCount(0);

  // 2) Umyvadlo a zásuvka vedle něj (fáze 74: níž než 1,2 m blíž než 0,2 m od umývacího prostoru), vana se žlutým rohem, kótami, přesným rozměrem a 45°
  await choose("Umyvadlo (600 × 450 mm)");
  await clickAt(3000, 1300);
  // Osazený předmět (při vkládání je u kurzoru ještě náhled se stejnou kresbou)
  const basin = canvas.locator('[data-element="basin"]');
  await expect(basin.getByTestId("fixture")).toHaveAttribute("data-size", "600x450");
  await expect(basin.getByTestId("fixture-band")).toHaveCount(1);
  await page.getByTestId("mode-done").click();
  await choose("Jednozásuvka");
  await clickAt(3400, 1050);
  await page.getByTestId("mode-done").click();
  await choose("Vana (1700 × 750 mm)");
  await clickAt(6500, 1600);
  await page.keyboard.press("Escape");
  // Fáze 90: hláška jmenuje přístroj a výšku, pás 0,2 m hlídá jen přístroje bez krytí IP44
  await goPhase(page, 5);
  // Fáze 100: kontrola norem je v záložce 🛡️ Normy (Linter)
  await rightTab(page, "norms");
  // Fáze 109: zásuvka u umyvadla se při vložení zvedne nad desku na 1150 mm – pořád níž než 1,2 m, hlídač ji hlásí
  await expect(page.getByTestId("plan-checks")).toContainText("Jednozásuvka (výška 1150 mm) – níž než 1,2 m blíž než 20 cm od hrany umyvadlového prostoru");
  await clickAt(6500, 1600);
  const placedBath = canvas.locator('[data-element="bath"]');
  const bath = placedBath.getByTestId("fixture");
  await expect(placedBath.getByTestId("fixture-dims")).toHaveText("X: 1,70 m × Y: 0,75 m");
  const corner = (await placedBath.getByTestId("fixture-handle").boundingBox())!;
  const target = await screen(canvas, 7550, 2075);
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  await expect(bath).toHaveAttribute("data-size", "1900x850");
  await expect(placedBath.getByTestId("fixture-dims")).toHaveText("X: 1,90 m × Y: 0,85 m");
  const detail = page.getByTestId("element-detail");
  await detail.getByLabel("Šířka X [mm]").fill("1600");
  await detail.getByLabel("Šířka X [mm]").press("Enter");
  await expect(bath).toHaveAttribute("data-size", "1600x850");
  await detail.getByTestId("fixture-rotate-45").click();
  await expect(bath).toHaveAttribute("data-rotation", "45");
  await expect(placedBath.getByTestId("fixture-zone2")).toHaveCount(1);
  await page.screenshot({ path: "test-results/phase63-fixtures.png" });
  await page.getByTestId("mode-done").click();

  // 3) Spotřebiče: přejmenování trouby a vlastní klimatizace ze šablony (prohlížeč + profil firmy) – fáze 3
  await goPhase(page, 3);
  await palette.getByTestId("appliance-edit").click();
  const editor = page.getByTestId("appliance-editor");
  await editor.getByLabel("Název spotřebiče 2").fill("Pečicí a parní trouba");
  await editor.getByTestId("appliance-template").filter({ hasText: "Klimatizace" }).click();
  await editor.getByTestId("appliance-save").click();
  await expect(editor).toHaveCount(0);
  await expect(palette.getByRole("button", { name: /Pečicí a parní trouba/ })).toBeVisible();
  await choose("Klimatizace");
  await clickAt(8000, 4000);
  await expect(page.getByTestId("appliance-detail")).toContainText("1P C16");
  await expect(page.getByTestId("appliance-detail")).toContainText("vlastní spotřebič");
  expect(await page.evaluate(() => window.localStorage.getItem("eldock.pb.appliances"))).toContain("Klimatizace");
  await page.getByTestId("mode-done").click();

  // 4) Ruční úprava trasy: vodorovný úsek jen v ose Y, reset pravým tlačítkem; dvojklik = odskok, reset tlačítkem v panelu
  await choose("Jednozásuvka");
  await clickAt(8000, 6950);
  await page.getByTestId("mode-done").click();
  // Fáze 74: úchyty úseků má jen vybraný okruh – okruh se vybere v soupisu okruhů (nebo klikem na trasu)
  await expect(canvas.getByTestId("route-segment")).toHaveCount(0);
  // Fáze 98: soupis okruhů a úprava tras jsou ve fázi 5
  await goPhase(page, 5);
  // Fáze 100: soupis okruhů a ručně upravené trasy jsou v záložce 🔌 Okruhy & Trasy
  await rightTab(page, "circuits");
  await page.locator('[data-testid="circuit-row"][data-layer="sockets"]').first().click();
  await expect(canvas.getByTestId("route-layer")).toHaveAttribute("data-focus", /.+/);
  const longest = async (axis: string, scope = "") =>
    page.evaluate(({ wanted, within }) => {
      const lines = [...document.querySelectorAll<SVGLineElement>(`${within} [data-testid="route-segment"][data-axis="${wanted}"]`)];
      const best = lines.sort((a, b) => Math.hypot(b.x2.baseVal.value - b.x1.baseVal.value, b.y2.baseVal.value - b.y1.baseVal.value) - Math.hypot(a.x2.baseVal.value - a.x1.baseVal.value, a.y2.baseVal.value - a.y1.baseVal.value))[0];
      if (!best) return null;
      const box = best.getBoundingClientRect();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2, leg: best.closest("[data-leg]")?.getAttribute("data-leg") ?? "" };
    }, { wanted: axis, within: scope });
  await expect.poll(async () => (await longest("horizontal")) !== null, { timeout: 30_000 }).toBe(true);
  const segment = (await longest("horizontal"))!;
  await page.mouse.move(segment.x, segment.y);
  await page.mouse.down();
  await page.mouse.move(segment.x + 40, segment.y - 30, { steps: 5 });
  await page.mouse.up();
  const edited = page.getByTestId("edited-routes");
  await expect(edited).toBeVisible();
  await expect(canvas.locator('[data-edited="true"]')).toHaveCount(1);
  // Pravé tlačítko na úseku upraveného okruhu vrátí celou jeho trasu na automat
  const moved = (await longest("horizontal", '[data-edited="true"]'))!;
  await page.mouse.click(moved.x, moved.y, { button: "right" });
  await expect(edited).toHaveCount(0);
  // Trasa po resetu přepočítá odložený výpočet – dvojklik až na ustálenou polohu úseku (jinak první klik trefí úsek
  // a druhý už trasu po přepočtu)
  let again = (await longest("horizontal"))!;
  await expect
    .poll(
      async () => {
        const now = await longest("horizontal");
        const stable = Boolean(now && Math.abs(now.x - again.x) < 1 && Math.abs(now.y - again.y) < 1 && now.leg === again.leg);
        if (now) again = now;
        return stable;
      },
      { intervals: [500, 500, 1000], timeout: 15_000 },
    )
    .toBe(true);
  await page.mouse.dblclick(again.x, again.y);
  await expect(edited).toBeVisible();
  await goPhase(page, 5);
  await edited.getByTestId("route-reset").first().click();
  await expect(edited).toHaveCount(0);

  // 5) Polygonální místnost se šikmou stěnou 45° (přichycení úhlu) a zásuvka u šikmé stěny – kreslení ve fázi 1
  await goPhase(page, 1);
  await page.getByRole("button", { name: "Kreslit šikmou stěnu / polygonální místnost" }).click();
  for (const [x, y] of [
    [10000, 1000],
    [13000, 1000],
    [13000, 2500],
    [11520, 3980],
    [10000, 4000],
  ]) {
    await clickAt(x, y);
  }
  await expect(canvas.getByTestId("polygon-draft")).toHaveAttribute("data-points", "5");
  await page.keyboard.press("Enter");
  await expect(canvas.locator('[data-polygon="true"]')).toHaveCount(1);
  await expect(canvas.getByTestId("polygon-vertex")).toHaveCount(5);
  await page.getByTestId("mode-done").click();
  await choose("Jednozásuvka");
  await clickAt(12100, 3300);
  await page.getByTestId("mode-done").click();
  await expect(canvas.locator('[data-room="Místnost 2"]')).toHaveCount(1);

  // 6) Normové CAD značení: rysky počtu žil a štítky okruhů
  // Fáze 98: trasy kabelů v levé paletě fáze 5
  await goPhase(page, 5);
  await page.getByTestId("cable-view-cad").click();
  await expect(canvas.locator('[data-testid="route-layer"][data-view="cad"]')).toBeAttached();
  await expect(canvas.getByTestId("cable-tick").first()).toBeAttached();
  await expect(canvas.getByTestId("cable-tag").first()).toContainText(/Okr\. -F\d+ · CYKY-J/);
  await page.screenshot({ path: "test-results/phase63-cad.png" });

  // 7) Export: DXF ke stažení s hladinami, PDF jako tiskový list s razítkem a tabulkou okruhů
  await page.getByTestId("wizard-step-5").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-dxf").click()]);
  expect(download.suggestedFilename()).toMatch(/^pudorys-elektroinstalace-1-np\.dxf$/);
  const dxf = readFileSync((await download.path())!, "utf8");
  for (const layer of ["STAVBA_MISTNOSTI", "ZARIZOVACI_PREDMETY", "ZASUVKY_230V_400V", "KABELY_SILOVE", "POPISY_A_KOTY"]) expect(dxf).toContain(layer);
  expect(dxf).toContain("AC1009");
  await page.evaluate(() => {
    (window as unknown as { printed: number }).printed = 0;
    window.print = () => void ((window as unknown as { printed: number }).printed += 1);
  });
  await page.getByTestId("export-pdf").click();
  await page.getByTestId("export-dialog").getByRole("radio", { name: /^A4/ }).click();
  await page.getByTestId("export-print").click();
  await expect(page.getByTestId("print-sheet")).toHaveAttribute("data-paper", "A4");
  await expect(page.getByTestId("title-block")).toContainText("Půdorys elektroinstalace – 1. NP");
  await expect(page.getByTestId("print-circuits").locator("tbody tr").first()).toBeAttached();
  await expect.poll(() => page.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);

  // 8) Galerie řad: věrný náhled Levit (podložka v druhé barvě) a proklik na web výrobce
  // Fáze 98: výrobce, řada, barva a úroveň instalace v kartě designu fáze 4
  await goPhase(page, 4);
  const appearance = page.getByTestId("device-appearance");
  await expect(appearance.getByTestId("series-web")).toHaveAttribute("href", /nizke-napeti\.cz\.abb\.com/);
  await appearance.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await expect(gallery.getByTestId("gallery-web")).toHaveAttribute("target", "_blank");
  await expect(gallery.getByTestId("gallery-web")).toHaveAttribute("href", /Katalog-ABB_Domovni-elektroinstalacni-material\.pdf#page=\d+/);
  // Fáze 80: Levit má produktový render z public/catalog-images (podložka v druhé barvě je v renderu)
  await expect(gallery.getByTestId("gallery-photo").first()).toHaveAttribute("src", /\/catalog-images\/abb\/levit\//);
  await page.keyboard.press("Escape");

  // 9) Chytrá domácnost v liště výrobců: TapHome, rodiny ABB a vložení senzoru free@home na sběrnici
  await appearance.getByRole("radio", { name: "TapHome", exact: true }).click();
  await expect(appearance.getByTestId("smart-catalog")).toHaveAttribute("data-family", "taphome");
  await appearance.getByRole("radio", { name: "ABB", exact: true }).click();
  await appearance.getByTestId("abb-families").locator('[data-family="abb-fah"]').click();
  const catalog = appearance.getByTestId("smart-catalog");
  await expect(catalog).toHaveAttribute("data-family", "abb-fah");
  await catalog.getByTestId("smart-catalog-level").getByRole("button", { name: "Přepnout na sběrnicovou instalaci" }).click();
  if (await page.getByTestId("level-conversion").isVisible()) await page.getByTestId("level-convert").click();
  await expect(catalog.getByTestId("smart-catalog-level")).toHaveCount(0);
  // Fáze 65: obrázkový katalog po záložkách – DIN lišta zvlášť, výrobky k osazení v záložce ovladačů
  await catalog.getByTestId("smart-tab-din").click();
  // Spínací akční člen SA-M-4.16.2.2 – karta katalogu od fáze 81 ukazuje český název a objednací číslo (MPN)
  await expect(catalog.getByTestId("smart-catalog-din")).toContainText("Člen akční spínací 4násobný, 16 A");
  await expect(catalog.getByTestId("smart-catalog-din")).toContainText("2CDG510025R0011");
  await catalog.getByTestId("smart-tab-controls").click();
  await catalog.locator('[data-product="fah-sensor-2"]').click();
  await expect(title).toContainText("Senzor / tlačítko 2násobné free@home");
  await clickAt(5000, 5000);
  await goPhase(page, 5);
  await expect(canvas.locator('[data-element="bus-2"]')).toHaveCount(1);
  // Fáze 100: detail vloženého prvku je v záložce 🎯 Detail
  await rightTab(page, "detail");
  await expect(page.getByTestId("element-detail")).toContainText("Senzor / tlačítko 2násobné free@home");
  await page.screenshot({ path: "test-results/phase63-smart.png" });
  await page.getByTestId("mode-done").click();
});
