import { expect, test, type Locator, type Page } from "@playwright/test";

import { ensureActive, goPhase, goPhaseForGroup, phaseForPalette, rightTab } from "./floorplan-phases";

// Fáze 91: katalogový audit designových řad (víceramečky jen v rozsahu, který řada vyrábí – Time Arbo 4R, Decento bez
// víceramečku; Busch-axcent s rámečkem ze skutečného materiálu a stejným krytem) a instalační krabičky (výrobce,
// konstrukce stěn, potřebná hloubka u prvku, hlídač hloubky s opravou jedním klikem, tabulka krabic v kusovníku).
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  // Průvodce v 5 krocích nezávisle na profilu firmy
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
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
  await form.getByTestId("room-size-create").click();
}

function tools(page: Page) {
  const canvas = page.getByTestId("floorplan-canvas");
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  return {
    canvas,
    palette,
    // Fáze 98: značka je v paletě své fáze (rozváděč a vybavení 2, zásuvky 3, světla a ovládání 4)
    choose: async (label: string) => {
      await phaseForPalette(page, label);
      await palette.getByRole("button", { name: label, exact: false }).first().click();
    },
    clickAt: async (x: number, y: number) => {
      const at = await screen(canvas, x, y);
      await page.mouse.click(at.x, at.y);
    },
    openSection: async (group: string) => {
      // Fáze 98: skupina palety je jen ve své fázi průvodce
      await goPhaseForGroup(page, group);
      const section = palette.locator(`[data-group="${group}"]`);
      if ((await section.getAttribute("data-open")) !== "true") await palette.getByTestId(`palette-toggle-${group}`).click();
      await expect(section).toHaveAttribute("data-open", "true");
    },
  };
}

async function applySeries(page: Page, series: string) {
  // Fáze 98: galerie řad je v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  await gallery.getByTestId(`gallery-series-${series}`).click();
  await gallery.getByTestId("gallery-apply").click();
  await page.getByRole("button", { name: "Použít na celý půdorys" }).click();
}

test("📦 Krabičky: stmívač s mělkou krabicí → varování a oprava 1 klikem, sádrokarton v místnosti, Kaiser, tabulka krabic v kusovníku", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const { canvas, choose, clickAt, openSection } = tools(page);
  await roomBySize(page, "Obývací pokoj", "5", "4");
  // Výrobce krabic (výchozí KOPOS Kolín) a výchozí konstrukce stěn – fáze 98: nabídka 📦 Instalační krabice ve fázích 3 a 4
  await goPhase(page, 3);
  await page.getByTestId("wizard-boxes").click();
  await expect(page.getByTestId("box-settings")).toBeVisible();
  await expect(page.getByTestId("box-maker")).toHaveValue("kopos");
  await expect(page.getByTestId("box-wall")).toHaveValue("masonry");
  await page.keyboard.press("Escape");

  await openSection("controls");
  await choose("Stmívač (otočný / tlačítkový LED)");
  await clickAt(2000, 1150);
  await page.getByTestId("mode-done").click();
  await openSection("sockets");
  await choose("Jednozásuvka");
  await clickAt(4200, 1150);
  await page.getByTestId("mode-done").click();

  // Detail stmívače: doporučená hluboká krabice KPR 68 (stmívač 230 V, WAGO svorky), min. 66 mm (fáze 98: ve fázi 4)
  await goPhase(page, 4);
  await ensureActive(page, canvas.locator('[data-element="dimmer"]'));
  await canvas.locator('[data-element="dimmer"]').click();
  const box = page.getByTestId("element-detail").getByTestId("element-box");
  await expect(box.getByTestId("element-box-summary")).toContainText("Hluboká 66 mm – KOPOS Kolín KPR 68");
  await expect(box.getByTestId("element-box-min")).toContainText("66 mm");
  await expect(box.getByTestId("element-box-min")).toContainText("stmívač 230 V");
  // Ruční mělká krabice → hlídač hloubky v Kontrole půdorysu a norem s opravou jedním klikem
  await box.getByTestId("element-box-choice").selectOption("shallow");
  await expect(box.getByTestId("element-box-warning")).toBeVisible();
  // Fáze 100: kontrola norem je v záložce 🛡️ Normy (Linter)
  await rightTab(page, "norms");
  const check = page.locator('[data-check^="box-depth"]');
  await expect(check).toContainText("Nedostatečná hloubka krabičky u Stmívač v místnosti Obývací pokoj: zvolena krabice 45 mm (KOPOS Kolín KU 68-45)");
  await expect(check).toContainText("vyžaduje min. 66 mm!");
  await page.screenshot({ path: "test-results/phase91-box-check.png" });
  await check.getByRole("button", { name: "Opravit na hlubokou krabici (1 klik)" }).click();
  await expect(page.locator('[data-check^="box-depth"]')).toHaveCount(0);
  await rightTab(page, "detail");
  await expect(box.getByTestId("element-box-choice")).toHaveValue("auto");

  // Místnost ze sádrokartonu → krabice do dutých stěn (fáze 98: vlastnost místnosti ve fázi 1)
  await goPhase(page, 1);
  await canvas.getByTestId("room-Obývací pokoj").click({ position: { x: 30, y: 30 } });
  await page.getByTestId("room-wall").selectOption("drywall");
  await goPhase(page, 4);
  await ensureActive(page, canvas.locator('[data-element="dimmer"]'));
  await canvas.locator('[data-element="dimmer"]').click();
  await expect(page.getByTestId("element-box-summary")).toContainText("KOPOS Kolín KPR 68/71L");

  // Krok 5: tabulka doporučených krabic na konci kusovníku
  await page.getByTestId("wizard-step-5").click();
  await expect(page.getByTestId("box-settings")).toBeVisible();
  await page.getByTestId("wizard-bom").click();
  const boxes = page.getByTestId("wiring-bom-boxes");
  await expect(boxes).toContainText("📦 Doporučené instalační krabičky a montážní příslušenství (dle prostředí a hloubky)");
  await expect(boxes.locator('[data-testid="wiring-bom-box"][data-code="KPR 68/71L_NA"]')).toHaveCount(1);
  await expect(boxes.locator('[data-testid="wiring-bom-box"][data-code="KPL 64-45/LD_NA"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/phase91-boxes.png" });
  await page.keyboard.press("Escape");

  // Výrobce Kaiser: do dutých stěn Electronic-Dose 75 mm (hlubší krabici O-range Kaiser nevede) a O-range Evo 49 mm
  await page.getByTestId("box-maker").selectOption("kaiser");
  await page.getByTestId("wizard-bom").click();
  await expect(boxes.locator('[data-testid="wiring-bom-box"][data-code="9268-94"]')).toHaveCount(1);
  await expect(boxes.locator('[data-testid="wiring-bom-box"][data-code="9063-03"]')).toHaveCount(1);
});

test("🔲 Víceramečky podle katalogu: 5R po změně na Time Arbo → štítek v liště, rozdělení 4R + 1R; Decento bez víceramečku", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const { canvas, clickAt } = tools(page);
  await roomBySize(page, "Obývací pokoj", "5", "4");
  await page.getByTestId("wizard-step-3").click();
  const sets = page.getByRole("region", { name: "Sestavy ve víceramečku" });
  if ((await sets.getByTestId("assembly-palette-toggle").getAttribute("aria-expanded")) !== "true") await sets.getByTestId("assembly-palette-toggle").click();
  // Levit vyrábí rámečky 1R–5R – bez upozornění, sestava 4R v nabídce
  await expect(sets.getByTestId("assembly-limit")).toHaveCount(0);
  await expect(sets.locator('[data-assembly="set-4z"]')).toBeVisible();
  // Vlastní sestava 5R
  await sets.getByTestId("assembly-custom-toggle").click();
  const custom = sets.getByTestId("assembly-custom");
  for (let index = 0; index < 3; index++) await custom.getByTestId("assembly-add").click();
  await expect(custom.getByTestId("assembly-gangs")).toHaveText("5R");
  await custom.getByTestId("assembly-custom-place").click();
  await clickAt(3500, 1150);
  await page.getByTestId("mode-done").click();
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="5"]')).toHaveCount(1);

  // Řada Time Arbo (dřevěné rámečky jen 1R–4R) na celý půdorys → štítek v horní liště a varování s rozdělením
  await applySeries(page, "Time Arbo");
  await expect(page.getByTestId("frame-limit-chip")).toContainText("Víceramček mimo katalog řady (1)");
  // Fáze 100: varování víceramečku je v kontrole norem (záložka 🛡️ Normy)
  await rightTab(page, "norms");
  const limit = page.locator('[data-check^="frame-limit"]');
  await expect(limit).toContainText("víceramček 5R");
  await expect(limit).toContainText("Řada ABB Time Arbo se vyrábí nejvýš ve čtyřrámečku (1R–4R)");
  await page.screenshot({ path: "test-results/phase91-frame-limit.png" });
  await limit.getByRole("button", { name: "Rozdělit na 4R + 1R" }).click();
  await expect(page.getByTestId("frame-limit-chip")).toHaveCount(0);
  await expect(canvas.locator('[data-testid="frame-outline"][data-gangs="4"]')).toHaveCount(1);
  await page.getByTestId("wizard-step-3").click();
  await expect(sets.getByTestId("assembly-limit")).toHaveAttribute("data-max", "4");
  await expect(sets.getByTestId("assembly-limit")).toContainText("nejvýš ve čtyřrámečku");

  // Decento: přístroje nejdou do vícenásobných rámečků – bez sestav, víceramček se rozdělí na samostatné přístroje
  await applySeries(page, "Decento");
  await page.getByTestId("wizard-step-3").click();
  await expect(sets.getByTestId("assembly-limit")).toContainText("nejdou do vícenásobných rámečků");
  await expect(sets.getByTestId("assembly-presets")).toHaveCount(0);
  await expect(sets.getByTestId("assembly-custom-toggle")).toHaveCount(0);
  await rightTab(page, "norms");
  await page.locator('[data-check^="frame-limit"]').getByRole("button", { name: "Rozdělit na samostatné přístroje" }).click();
  await expect(canvas.getByTestId("frame-outline")).toHaveCount(0);
  await expect(page.getByTestId("frame-limit-chip")).toHaveCount(0);
});

test("🎨 Busch-axcent: rámeček ze skutečného materiálu zvlášť, kryt beze změny; Decento jako samostatné kulaté přístroje", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  // Fáze 98: galerie řad je v kartě designu fáze 4
  await goPhase(page, 4);
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  const preview = gallery.getByTestId("gallery-preview");
  await gallery.getByTestId("gallery-series-Busch-axcent").click();
  // 6 krytů ze společné kapitoly a 8 rámečků 1R–5R (Katalog ABB 2026, str. 166 a 170)
  await expect(gallery.getByTestId("gallery-color")).toHaveCount(6);
  await expect(gallery.getByTestId("gallery-frame-color")).toHaveCount(8);
  await gallery.getByTestId("gallery-frame-color").filter({ hasText: "Beton" }).click();
  await expect(preview.locator('[data-part="carrier"]').first()).toBeAttached();
  await page.screenshot({ path: "test-results/phase91-axcent.png" });
  await gallery.getByTestId("gallery-apply").click();
  await expect(page.getByTestId("design-badge")).toContainText("ABB Busch-axcent · rámeček Beton · kryt Studio bílá (84)");

  // Decento: samostatné kulaté přístroje s roztečí 91 mm, zásuvka se zemnicím kolíkem a středovým šroubkem
  await page.getByTestId("series-gallery-open").click();
  await gallery.getByTestId("gallery-series-Decento").click();
  await expect(preview.locator('[data-outline="decento"]')).toHaveAttribute("data-pitch-mm", "91");
  await expect(preview).toContainText("3 samostatné přístroje · rozteč 91 mm");
  await gallery.getByTestId("gallery-color").filter({ hasText: "Bílá / přírodní buk" }).click();
  await page.screenshot({ path: "test-results/phase91-decento.png" });
  await gallery.getByTestId("gallery-series-Variant+ (IP54)").click();
  await expect(preview.getByTestId("mockup-hinge").first()).toBeAttached();
  await page.screenshot({ path: "test-results/phase91-variant.png" });
});
