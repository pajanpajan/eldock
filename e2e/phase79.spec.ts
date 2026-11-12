import { expect, test, type Page } from "@playwright/test";
import { goPhase, phaseForPalette } from "./floorplan-phases";

// Fáze 79: import výkresu DXF do 2D půdorysu – hladiny s barvou a počtem objektů, jednotky z hlavičky (měřítko 1 : 1 bez
// kalibrace), vyčištění architektonického balastu, ztlumení do šedé s krytím, přichytávání zásuvky k čáře stěny a DWG
// s návodem na uložení jako DXF.
test.describe.configure({ mode: "serial" });

const dxf = (...sections: (string | number)[][]) => [...sections.flat(), 0, "EOF"].join("\n");
const section = (name: string, ...body: (string | number)[]) => [0, "SECTION", 2, name, ...body, 0, "ENDSEC"];

/** Byt 6 × 4 m v cm ($INSUNITS 5): stěny, okna, kóty, nábytek a popisy. */
const FLAT_DXF = dxf(
  section("HEADER", 9, "$INSUNITS", 70, 5),
  section("TABLES", 0, "TABLE", 2, "LAYER", 0, "LAYER", 2, "A-STENY", 70, 0, 62, 7, 0, "LAYER", 2, "A-OKNA", 70, 0, 62, 4, 0, "LAYER", 2, "A-KOTY", 70, 0, 62, 1, 0, "LAYER", 2, "A-NABYTEK", 70, 0, 62, 3, 0, "LAYER", 2, "A-TEXT", 70, 0, 62, 2, 0, "ENDTAB"),
  section(
    "ENTITIES",
    0, "LWPOLYLINE", 8, "A-STENY", 90, 4, 70, 1, 10, 0, 20, 0, 10, 600, 20, 0, 10, 600, 20, 400, 10, 0, 20, 400,
    0, "LINE", 8, "A-OKNA", 10, 200, 20, 400, 11, 350, 21, 400,
    0, "LINE", 8, "A-KOTY", 10, 0, 20, -50, 11, 600, 21, -50,
    0, "CIRCLE", 8, "A-NABYTEK", 10, 300, 20, 200, 40, 40,
    0, "TEXT", 8, "A-TEXT", 10, 250, 20, 150, 40, 20, 1, "Obývák",
  ),
);

async function openEmpty(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
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

test("DXF: hladiny, jednotky 1 : 1, vyčištění balastu, ztlumení s krytím a přichycení zásuvky ke stěně výkresu", async ({ page }) => {
  await openEmpty(page);
  await page.getByTestId("floorplan-file-input").setInputFiles({ name: "byt.dxf", mimeType: "application/dxf", buffer: Buffer.from(FLAT_DXF, "utf8") });
  const panel = page.getByTestId("cad-layers");
  await expect(panel).toBeVisible({ timeout: 30_000 });
  // cm z hlavičky → 6 × 4,5 m (kóta 50 cm pod stěnou), bez kalibrace
  await expect(panel.getByTestId("cad-units")).toContainText("6 × 4,5 m");
  await expect(panel.getByTestId("cad-units")).toContainText("jednotky cm (z hlavičky $INSUNITS)");
  const layers = panel.getByTestId("cad-layer-list");
  await expect(layers.locator("[data-layer]")).toHaveCount(5);
  const canvas = page.getByTestId("floorplan-canvas");
  await expect(canvas.getByTestId("cad-underlay")).toHaveAttribute("data-layers", "5");

  // 🧹 skryje kóty, nábytek a texty – zůstanou stěny a okna
  await panel.getByTestId("cad-clean").click();
  await expect(canvas.getByTestId("cad-underlay")).toHaveAttribute("data-layers", "2");
  await expect(layers.locator('[data-layer="A-KOTY"] [data-testid="cad-layer-eye"]')).toHaveAttribute("aria-checked", "false");
  await expect(layers.locator('[data-layer="A-STENY"] [data-testid="cad-layer-eye"]')).toHaveAttribute("aria-checked", "true");
  // 👁️ ručně zpět
  await layers.locator('[data-layer="A-TEXT"] [data-testid="cad-layer-eye"]').click();
  await expect(canvas.getByTestId("cad-underlay")).toHaveAttribute("data-layers", "3");

  // 🌑 ztlumení a krytí
  await panel.getByTestId("cad-monochrome").check();
  await expect(canvas.getByTestId("cad-underlay")).toHaveAttribute("data-monochrome", "true");
  await panel.getByTestId("cad-opacity").fill("40");
  await expect(canvas.getByTestId("cad-underlay")).toHaveAttribute("opacity", "0.4");

  // Přichycení: zásuvka kousek od spodní stěny výkresu (okraj 1 m → stěna y = 1000 + 4000 mm) skončí přesně na čáře
  await phaseForPalette(page, "Jednozásuvka");
  await page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }).getByRole("button", { name: "Jednozásuvka" }).first().click();
  const near = await screen(page, 3500, 5000 - 60);
  await page.mouse.move(near.x, near.y);
  await expect(canvas.getByTestId("cad-snap-marker")).toBeVisible();
  await page.mouse.click(near.x, near.y);
  await page.keyboard.press("Escape");
  await goPhase(page, 5);
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(1);
  const position = await canvas.locator('[data-element="socket"]').getAttribute("transform");
  expect(position).toMatch(/translate\(3\d{3}(\.\d+)? 5000\)/);
});

test("DWG: srozumitelná výzva uložit výkres jako DXF", async ({ page }) => {
  await openEmpty(page);
  await page.getByTestId("floorplan-file-input").setInputFiles({ name: "byt.dwg", mimeType: "application/acad", buffer: Buffer.from("AC1032\u0000\u0000binární data", "binary") });
  await expect(page.getByText(/Uložte výkres v CAD programu jako DXF/)).toBeVisible();
  await expect(page.getByTestId("cad-layers")).toHaveCount(0);
});
