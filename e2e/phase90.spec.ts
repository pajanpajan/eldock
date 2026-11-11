import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 90: krok 1 průvodce bez automatického přeskoku na krok 2 (místnosti jedna za druhou s předvolbou další
// místnosti, i po prvním uložení a obnovení stránky), krokové karty se živým stavem, okna / dveře / nábytek s žlutým
// rohem a přichycením ke stěně (PDF i DXF), koupelnové zóny bez falešného poplachu u ZAL_M a MAG, umyvadlový prostor
// a řady ABB Garant / Variant+ / Praktik / Decento podle katalogu 2026.
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  // Průvodce v 5 krocích nezávisle na profilu firmy (fáze 89 ukládá kompaktní režim i do profilu) – volba prohlížeče vyhrává
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
    choose: (label: string) => palette.getByRole("button", { name: label, exact: false }).first().click(),
    clickAt: async (x: number, y: number) => {
      const at = await screen(canvas, x, y);
      await page.mouse.click(at.x, at.y);
    },
    openSection: async (group: string) => {
      const section = palette.locator(`[data-group="${group}"]`);
      if ((await section.getAttribute("data-open")) !== "true") await palette.getByTestId(`palette-toggle-${group}`).click();
      await expect(section).toHaveAttribute("data-open", "true");
    },
  };
}

test("🧭 Krok 1: místnosti jedna za druhou bez přeskoku na krok 2, předvolba další místnosti a krokové karty", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const wizard = page.getByTestId("floorplan-wizard");
  const form = page.getByTestId("room-by-size");
  const name = form.getByTestId("room-size-name");
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("wizard-step-1-status")).toHaveText("zatím žádná místnost");
  await expect(name).toHaveValue("Obývací pokoj");

  // + Vytvořit místnost: průvodce zůstává v kroku 1 a formulář nabídne další typ místnosti
  await form.getByTestId("room-size-create").click();
  await expect(page.getByTestId("floorplan-canvas").getByTestId("room-Obývací pokoj")).toBeVisible();
  await expect(name).toHaveValue("Kuchyň");
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("wizard-step-1-status")).toHaveText("1 místnost · měřítko OK");
  // Nový půdorys vznikne na serveru při první změně (adresa se přepne na /panel-builder/floorplan/<id>)
  await expect(page).toHaveURL(/\/panel-builder\/floorplan\/(?!novy)[\w-]+$/, { timeout: 30_000 });
  await form.getByTestId("room-size-create").click();
  await expect(page.getByTestId("floorplan-canvas").getByTestId("room-Kuchyň")).toBeVisible();
  // Uložení po druhé místnosti překreslí stránku uloženého půdorysu – krok zůstane 1
  await expect(page.getByTestId("floorplan-save-status")).toContainText("Uloženo v cloudu", { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(name).toHaveValue("Ložnice");
  await form.getByTestId("room-size-create").click();
  await expect(page.getByTestId("floorplan-canvas").getByTestId("room-Ložnice")).toBeVisible();
  await expect(name).toHaveValue("Koupelna");
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("wizard-step-1-status")).toHaveText("3 místnosti · měřítko OK");

  // Obnovení stránky: krok 1 drží relace prohlížeče (bez ní by nákres s místnostmi otevřel krok 2)
  await expect(page.getByTestId("floorplan-save-status")).toHaveAttribute("data-state", "saved", { timeout: 30_000 });
  await expect(page.getByTestId("floorplan-save-status")).toContainText("Uloženo v cloudu");
  await page.reload();
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 60_000 });
  await expect(wizard).toHaveAttribute("data-step", "1");
  await expect(page.getByTestId("floorplan-canvas").locator("[data-room]")).toHaveCount(3);

  // Na další krok jen tlačítkem → krok 1 dostane fajfku, aktivní krok 2 je žlutě zvýrazněný
  await page.getByTestId("wizard-next").click();
  await expect(wizard).toHaveAttribute("data-step", "2");
  await expect(page.getByTestId("wizard-step-1")).toHaveAttribute("data-done", "true");
  await expect(page.getByTestId("wizard-step-1")).toContainText("✓");
  await expect(page.getByTestId("wizard-step-2")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("wizard-step-2-status")).toContainText("ABB");

  // Názvy krokových karet se nezkracují v běžných šířkách okna a karty se vejdou bez posuvníku
  // (při 1920 px odznak designu a přepínač režimu v řádku karet dřív zkrátily „Podklad a místnosti“)
  const stepper = page.getByTestId("wizard-stepper");
  for (const width of [1920, 1600, 1366, 1280]) {
    await page.setViewportSize({ width, height: 1080 });
    await expect(async () => {
      const layout = await stepper.evaluate((nav) => ({
        cut: [...nav.querySelectorAll("button b")].filter((title) => title.scrollWidth > title.clientWidth + 1).map((title) => title.textContent),
        overflow: nav.scrollWidth - nav.clientWidth,
      }));
      expect(layout.cut, `zkrácené názvy kroků při šířce ${width} px`).toEqual([]);
      expect(layout.overflow, `posuvník krokových karet při šířce ${width} px`).toBeLessThanOrEqual(1);
    }).toPass({ timeout: 10_000 });
  }
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.screenshot({ path: "test-results/phase90-stepper.png" });
});

test("🛋️ Okna, dveře a nábytek: přichycení ke stěně, levé / pravé otevírání, žlutý roh, natočení, PDF a DXF", async ({ page }) => {
  test.setTimeout(360_000);
  await openNew(page);
  const { canvas, choose, clickAt, openSection } = tools(page);
  // Ložnice 4 × 4 m na volném místě (x 1–5 m, y 1–5 m)
  await roomBySize(page, "Ložnice", "4", "4");
  await expect(canvas.getByTestId("room-Ložnice")).toHaveAttribute("x", "1000");
  await page.getByTestId("wizard-step-3").click();
  await openSection("architecture");

  // Dveře u horní stěny: zárubeň na stěně, křídlo do místnosti (střed 0,4 m od stěny), natočení 0°
  await choose("Dveře jednokřídlé (0,80 × 0,80 m)");
  await clickAt(2000, 1150);
  await page.getByTestId("mode-done").click();
  const door = canvas.locator('[data-element="arch-door-1"]').getByTestId("fixture");
  await expect(door).toHaveAttribute("data-at", "2000,1400");
  await expect(door).toHaveAttribute("data-rotation", "0");
  await expect(door).toHaveAttribute("data-arch", "opening");
  // Výběr dveří: detail s rozměrem, levé / pravé otevírání a pevná natočení
  await clickAt(2000, 1400);
  const detail = page.getByTestId("fixture-detail");
  await expect(detail).toContainText("X: 0,80 m × Y: 0,80 m");
  await expect(detail.getByTestId("fixture-flip")).toContainText("Levé / Pravé otevírání");
  await expect(detail.getByTestId("fixture-flip")).toContainText("teď levé");
  await detail.getByTestId("fixture-flip").click();
  await expect(door).toHaveAttribute("data-flip", "true");
  await expect(detail.getByTestId("fixture-flip")).toContainText("teď pravé");
  await detail.getByTestId("fixture-rotation-180").click();
  await expect(door).toHaveAttribute("data-rotation", "180");
  await detail.getByTestId("fixture-rotation-0").click();
  await page.keyboard.press("Escape");

  // Okno u levé stěny: střed na stěně, natočení 270°
  await choose("Okno jednokřídlé (1,00 × 0,25 m)");
  await clickAt(1150, 3000);
  await page.getByTestId("mode-done").click();
  const windowShape = canvas.locator('[data-element="arch-window-1"]').getByTestId("fixture");
  await expect(windowShape).toHaveAttribute("data-at", "1000,3000");
  await expect(windowShape).toHaveAttribute("data-rotation", "270");

  // Manželská postel 1,80 × 2,00 m – žlutý roh zvětší na 2,00 × 2,10 m (živé kóty)
  await choose("Manželská postel – dvoulůžko (1,80 × 2,00 m)");
  await clickAt(3000, 3000);
  await page.getByTestId("mode-done").click();
  const placedBed = canvas.locator('[data-element="arch-bed-double"]');
  const bed = placedBed.getByTestId("fixture");
  await expect(bed).toHaveAttribute("data-size", "1800x2000");
  await expect(bed).toHaveAttribute("data-fixture", "bed_double");
  await clickAt(3000, 3000);
  await expect(placedBed.getByTestId("fixture-dims")).toHaveText("X: 1,80 m × Y: 2,00 m");
  const corner = (await placedBed.getByTestId("fixture-handle").boundingBox())!;
  const target = await screen(canvas, 4100, 4100);
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 6 });
  await page.mouse.up();
  await expect(bed).toHaveAttribute("data-size", "2000x2100");
  await expect(placedBed.getByTestId("fixture-dims")).toHaveText("X: 2,00 m × Y: 2,10 m");
  await page.screenshot({ path: "test-results/phase90-architecture.png" });
  await page.keyboard.press("Escape");

  // Výstupy: DXF s vrstvou ARCHITEKTURA_NABYTEK, tiskový list s kresbou nábytku (v legendě značek není)
  await page.getByTestId("wizard-step-5").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-dxf").click()]);
  const dxf = readFileSync((await download.path())!, "utf8");
  expect(dxf).toContain("ARCHITEKTURA_NABYTEK");
  expect(dxf).toContain(String.raw`POST_2 2000 \U+00D7 2100`);
  expect(dxf).toContain("DVE_1 800");
  await page.evaluate(() => {
    window.print = () => undefined;
  });
  await page.getByTestId("export-pdf").click();
  await page.getByTestId("export-print").click();
  const sheet = page.getByTestId("print-sheet");
  await expect(sheet.locator('[data-arch="furniture"]')).toHaveCount(1);
  await expect(sheet.locator('[data-arch="opening"]')).toHaveCount(2);
  await expect(sheet).not.toContainText("Manželská postel");
});

test("🛁 Koupelna: ZAL_M a MAG u vany bez falešné chyby zóny, zásuvka s přesným názvem a umyvadlový prostor", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const { canvas, choose, clickAt, openSection } = tools(page);
  // Koupelna 3 × 2,5 m (x 1–4 m, y 1–3,5 m), vana pod oknem u horní stěny (hrana vany y 1125–1875 mm)
  await roomBySize(page, "Koupelna", "3", "2,5");
  await page.getByTestId("wizard-step-3").click();
  await openSection("fixtures");
  await choose("Vana (1700 × 750 mm)");
  await clickAt(2000, 1500);
  await page.getByTestId("mode-done").click();
  // Zóna 2 vany je ořezaná obrysem koupelny (nepřesahuje za stěnu na fasádu)
  await expect(canvas.locator('[data-element="bath"]').getByTestId("fixture-zones")).toHaveAttribute("data-clipped", "true");

  // Okenní kontakt MAG (2,1 m) a vývod motoru žaluzie ZAL_M (2,45 m) v okně nad vanou
  await openSection("shading");
  await choose("Okenní / dveřní magnetický kontakt");
  await clickAt(1900, 1060);
  await page.getByTestId("mode-done").click();
  await choose("Vývod pro motor žaluzie / rolety (u okna)");
  await clickAt(2300, 1060);
  await page.getByTestId("mode-done").click();
  // Panel kontrol se ukáže jen se zjištěním – chyba zóny 0–2 žádná
  await expect(canvas.locator('[data-element="window-contact"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="blind-motor"]')).toHaveCount(1);
  await expect(page.locator('[data-check^="bath-zone"]')).toHaveCount(0);
  const checks = page.getByTestId("plan-checks");

  // Jednozásuvka 43 cm od vany: chyba s přesným názvem, výškou a vzdáleností, tlačítko Zobrazit vybere zásuvku
  await openSection("sockets");
  await choose("Jednozásuvka");
  await clickAt(3280, 1400);
  await page.getByTestId("mode-done").click();
  const zone = checks.locator('[data-check^="bath-zone"]');
  await expect(zone).toHaveCount(1);
  await expect(zone).toContainText(/1\. NP: Jednozásuvka \(výška 300 mm\) zasahuje do zóny 2 koupelny \(\d+ cm od vany, min\. 60 cm\)/);
  await zone.getByRole("button", { name: "Zobrazit" }).click();
  await expect(page.getByTestId("element-detail")).toContainText("Jednozásuvka");
  await page.keyboard.press("Escape");

  // Umyvadlo: umyvadlový prostor (pás + 0,2 m, doporučených 0,4 m) s popiskem i bez výběru
  await openSection("fixtures");
  await choose("Umyvadlo (600 × 450 mm)");
  await clickAt(3300, 3200);
  await page.getByTestId("mode-done").click();
  const basin = canvas.locator('[data-element="basin"]');
  await expect(basin.getByTestId("fixture-band")).toHaveCount(1);
  await expect(basin.getByTestId("fixture-band-recommended")).toHaveCount(1);
  await expect(basin.getByTestId("fixture-basin-label")).toHaveText("UMYVADLOVÝ PROSTOR");
  await page.screenshot({ path: "test-results/phase90-bathroom.png" });
});

test("🎨 Řady ABB: Garant / Variant+ / Praktik bez rámečku se zásuvkou pod víčkem, Decento ve tvaru spojených kruhů", async ({ page }) => {
  test.setTimeout(240_000);
  await openNew(page);
  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("series-gallery-open").click();
  const gallery = page.getByTestId("series-gallery");
  const preview = gallery.getByTestId("gallery-preview");

  await gallery.getByTestId("gallery-series-Garant (IP44)").click();
  await expect(gallery.getByTestId("gallery-title")).toContainText("Garant (IP44)");
  await expect(gallery.getByTestId("gallery-color")).toHaveCount(2);
  await expect(gallery.getByTestId("gallery-color").nth(1)).toContainText("Šedá / antracitová");
  await expect(gallery.getByTestId("gallery-frame-none")).toContainText("bez samostatného podomítkového rámečku");
  await expect(gallery.getByTestId("gallery-frame-colors")).toBeHidden();
  await expect(preview).toContainText("Dvojzásuvka IP44 s odklápěcím víčkem (nástěnná)");
  await expect(preview.getByTestId("mockup-gland").first()).toBeVisible();
  await expect(preview.getByTestId("mockup-lid")).toHaveCount(3);
  await expect(gallery).toContainText("str. 498");
  await page.screenshot({ path: "test-results/phase90-garant.png" });

  await gallery.getByTestId("gallery-series-Variant+ (IP54)").click();
  await expect(gallery.getByTestId("gallery-color")).toHaveCount(2);
  await expect(preview).toContainText("Dvojzásuvka IP54 s odklápěcím víčkem (nástěnná)");
  await expect(gallery).toContainText("str. 506");
  await gallery.getByTestId("gallery-series-Praktik (IP44)").click();
  await expect(gallery.getByTestId("gallery-color")).toHaveCount(2);
  await expect(gallery).toContainText("str. 502");

  // Decento: 5 pevných provedení (i bílá / černý dub), víceramček jako spojené kruhy, zásuvka se šroubky
  await gallery.getByTestId("gallery-series-Decento").click();
  await expect(gallery.getByTestId("gallery-color")).toHaveCount(5);
  await expect(gallery.getByTestId("gallery-frame-none")).toContainText("pevná dvojice porcelánového středu");
  await expect(preview.locator('[data-outline="decento"]')).toHaveCount(1);
  await expect(preview.getByTestId("mockup-screw")).toHaveCount(6);
  await gallery.getByTestId("gallery-color").filter({ hasText: "Bílá / černý dub" }).click();
  await page.screenshot({ path: "test-results/phase90-decento.png" });
  await gallery.getByTestId("gallery-apply").click();
  await expect(page.getByTestId("design-badge")).toContainText("ABB Decento · Bílá / černý dub");
  await expect(page.getByTestId("frame-color-none")).toContainText("pevná dvojice");
});
