import { expect, test, type Locator, type Page } from "@playwright/test";
import { goPhase } from "./floorplan-phases";

// Fáze 81: dotykové panely a displejové ovladače chytré domácnosti (barvy, krabice, věrné náhledy) a akční členy na
// DIN lištu – souhrn „V rozváděči“ v půdorysu, SysAP na DIN liště a kategorie 🏠 Chytrá domácnost v kaskádě Kroku 1
// (filtr řady ABB, přesný kus a šířka podle katalogu, symbol vícemodulového aktoru).
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
}

/** Od fáze 94 mají panely ABB v katalogu fotku výrobce (public/catalog-images), ostatní věrný vektorový náhled. */
const preview = (card: Locator, panel: string) => card.getByTestId("device-photo").or(card.locator(`[data-testid="device-illustration"][data-panel="${panel}"]`)).first();

async function clickAt(page: Page, canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const at = await canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const value = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  }, { x, y });
  await page.mouse.click(at.x, at.y);
}

test("🏠 Panely chytré domácnosti: barvy a krabice IP TOUCH, osazení, Loxone a TapHome; DIN lišta „V rozváděči“ a SysAP na liště", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  // Fáze 98: výrobce, řada, barva a úroveň instalace v kartě designu fáze 4
  await goPhase(page, 4);
  const appearance = page.getByTestId("device-appearance");
  await appearance.getByTestId("abb-families").locator('[data-family="abb-fah"]').click();
  const catalog = appearance.getByTestId("smart-catalog");
  await catalog.getByTestId("smart-catalog-level").getByRole("button", { name: "Přepnout na sběrnicovou instalaci" }).click();
  if (await page.getByTestId("level-conversion").isVisible()) await page.getByTestId("level-convert").click();
  await expect(catalog.getByTestId("smart-catalog-level")).toHaveCount(0);

  // Panely: IP TOUCH 10" ve 4 barvách, číslo a krabice podle barvy, věrný náhled
  await catalog.getByTestId("smart-tab-panels").click();
  const ipTouch = catalog.locator('[data-card="fah-ip-touch-10"]');
  await expect(preview(ipTouch, "ip-touch")).toBeVisible();
  await expect(ipTouch.getByTestId("device-variants").getByRole("radio")).toHaveCount(4);
  await ipTouch.getByRole("radio", { name: "Černá" }).click();
  await expect(ipTouch.getByTestId("device-mpn")).toHaveText("MPN 2TMA130050B0054");
  await expect(ipTouch.getByTestId("device-boxes")).toContainText("2TMA130160B0132");
  await expect(ipTouch.getByTestId("device-boxes")).toContainText("2TMA130161B0001");
  await ipTouch.getByRole("radio", { name: "Zlatá" }).click();
  await expect(ipTouch.getByTestId("device-mpn")).toHaveText("MPN: ověřte u výrobce");
  await ipTouch.getByRole("radio", { name: "Černá" }).click();
  await ipTouch.locator('[data-product="fah-ip-touch-10"]').click();
  await clickAt(page, canvas, 5000, 5000);
  await page.keyboard.press("Escape");
  // Fáze 98: katalog panelů i osazený panel jsou ve fázi 4 (detail prvku je ve všech fázích)
  await expect(canvas.locator('[data-element="bus-display"]')).toHaveCount(1);
  await expect(page.getByTestId("element-detail")).toContainText('IP TOUCH 10"');
  // Detail prvku: barva a krabice panelu s čísly do kusovníku (povrchová krabice v barvě panelu)
  const choice = page.getByTestId("panel-choice");
  await expect(choice.getByTestId("panel-bom")).toContainText("2TMA130050B0054");
  await expect(choice.getByTestId("panel-bom")).toContainText("2TMA130160B0132");
  await choice.getByRole("radio", { name: "Povrchová" }).click();
  await expect(choice.getByTestId("panel-bom")).toContainText("2TMA130161B0001");
  // Ovladače: RoomTouch 4" a Trevion 2,4"
  await catalog.getByTestId("smart-tab-controls").click();
  await expect(preview(catalog.locator('[data-card="fah-roomtouch-4"]'), "room-touch")).toBeVisible();
  await expect(preview(catalog.locator('[data-card="fah-trevion"]'), "trevion")).toBeVisible();

  // DIN lišta: „V rozváděči: X ks (Y automaticky + Z ručně)“, SysAP s adaptérem nahradí nástěnný
  await catalog.getByTestId("smart-tab-din").click();
  const sap = catalog.locator('[data-card="abb_freeathome-fah-sap"]');
  const sapDin = catalog.locator('[data-card="abb_freeathome-fah-sap-din"]');
  await expect(sap.getByTestId("din-total")).toHaveText("1 ks");
  await sapDin.getByTestId("din-add").click();
  await expect(sapDin.getByTestId("din-count")).toContainText("V rozváděči: 1 ks (0 automaticky z půdorysu + 1 ručně přidáno)");
  await expect(sap.getByTestId("din-total")).toHaveText("0 ks");
  await goPhase(page, 4);
  await expect(page.getByTestId("smart-home").getByTestId("smart-modules")).toContainText("SAP.3 + SAP-A1.1");

  // Loxone Wall Display 10" a TapHome Ovladač s displejem (3 varianty, 4 barvy, oblíbený multizónový)
  await appearance.getByRole("radio", { name: "Loxone", exact: true }).click();
  await catalog.getByTestId("smart-tab-panels").click();
  await expect(catalog.locator('[data-card="lox-wall-display-10"]').getByTestId("device-illustration")).toHaveAttribute("data-panel", "wall-display");
  await catalog.getByTestId("smart-tab-controls").click();
  await expect(catalog.locator('[data-card="lox-touch-pure-display"]').getByTestId("device-illustration")).toHaveAttribute("data-panel", "pure-display");
  await appearance.getByRole("radio", { name: "TapHome", exact: true }).click();
  await catalog.getByTestId("smart-tab-controls").click();
  const multi = catalog.locator('[data-card="tap-display-multi"]');
  await expect(multi.getByTestId("device-favorite")).toBeVisible();
  await expect(multi.getByTestId("device-variants").getByRole("radio")).toHaveCount(4);
  await expect(multi.locator('svg[data-panel="tap-display"]')).toHaveAttribute("data-keys", "∧≡∨");
  await expect(catalog.locator('[data-card="tap-display-thermo"] svg[data-panel="tap-display"]')).toHaveAttribute("data-keys", "+−");
  await page.screenshot({ path: "test-results/phase81-panels.png" });
});

test("⚡ Kaskáda Kroku 1: Chytrá domácnost – filtr řady ABB, KNX spínací 8× a Loxone Miniserver 9 M jako aktor na liště", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1500 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Navrhnout od nuly/, pressed: true })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Název rozváděče").fill("Rozvodnice chytré domácnosti");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });

  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await menu.getByRole("button", { name: "🏠 Chytrá domácnost / PLC / Aktory", exact: true }).click();
  const series = menu.getByRole("region", { name: "Řada / systém" });
  await expect(series.getByRole("button")).toHaveText(["Vše", "ABB-free@home® (SA-M, BA-M, DA/M, HA-M, SysAP)", "ABB i-bus® KNX (SA/S, JRA/S, UD/S, SV/S)"]);
  await series.getByRole("button", { name: /ABB i-bus® KNX/ }).click();
  await menu.getByRole("button", { name: "Spínací aktor", exact: true }).click();
  // Fáze 115: C3 nabízí jen existující kusy systému s šířkou („8× (8M)“)
  await menu.getByRole("button", { name: /^8× \(\d+M\)$/ }).click();
  const card = page.getByTestId("placement-card");
  await expect(card).toContainText("ABB SA/S 8.16.2.2");
  await expect(page.getByTestId("placement-mpn")).toContainText("2CDG110263R0011");
  await card.getByTestId("insert-1").click();
  const panel = page.getByTestId("vector-panel");
  const actor = panel.locator('[data-smart="switch"]');
  await expect(actor).toHaveCount(1);
  await expect(actor.getByTestId("symbol-smart-label")).toHaveText("SPÍNACÍ 8×16A");
  await expect(actor.locator("[data-channel-led]")).toHaveCount(8);

  // Loxone: systémový modul = Miniserver, šířka 9 M podle katalogu (nevejde se → nová lišta)
  await menu.getByRole("button", { name: /Vybrat jiného výrobce/ }).click();
  await menu.getByRole("button", { name: "Loxone", exact: true }).click();
  await menu.getByRole("button", { name: "🏠 Chytrá domácnost / PLC / Aktory", exact: true }).click();
  await expect(menu.getByRole("region", { name: "Řada / systém" })).toHaveCount(0);
  await menu.getByRole("button", { name: "Systémový modul / Miniserver", exact: true }).click();
  await expect(card).toContainText("Loxone Miniserver");
  await expect(page.getByTestId("placement-mpn")).toContainText("LOXONE:100335");
  await expect(page.getByTestId("placement-details")).toContainText("9 M");
  await card.getByTestId("insert-1").click();
  await expect(panel.locator('[data-smart="system"]')).toHaveCount(1);
  await expect(panel.locator('[data-smart="system"]').getByTestId("symbol-smart-label")).toHaveText("SYSTÉM");
  await page.screenshot({ path: "test-results/phase81-cascade.png" });
});
