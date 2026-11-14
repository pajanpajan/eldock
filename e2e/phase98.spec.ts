import { expect, test, type Locator, type Page } from "@playwright/test";

// Fáze 98: 2D půdorys jako fázový průvodce – v každé fázi levá paleta, plátno i pravý panel VÝHRADNĚ s nástroji a vrstvami
// dané fáze, CAD rozvržení na výšku okna (plátno vždy celé vidět), chytrý filtr vrstev (fáze 3 bez světelných tras, fáze 4
// bez zásuvkových) a volný přechod mezi fázemi tam i zpět bez ztráty dat.
test.describe.configure({ mode: "serial" });

async function openNew(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
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

/** Kategorie palety v levém sloupci (pořadí). */
const groups = (page: Page) => page.getByTestId("floorplan-left").locator("[data-group]").evaluateAll((nodes) => nodes.map((node) => `${node.getAttribute("data-group")}:${node.getAttribute("data-open")}`));

async function place(page: Page, label: string, points: [number, number][]) {
  const canvas = page.getByTestId("floorplan-canvas");
  await page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" }).getByRole("button", { name: label, exact: false }).first().click();
  for (const [x, y] of points) {
    const at = await screen(canvas, x, y);
    await page.mouse.click(at.x, at.y);
  }
  await page.getByTestId("mode-done").click();
}

async function room(page: Page) {
  const form = page.getByTestId("room-by-size");
  await form.getByTestId("room-size-name").fill("Obývací pokoj");
  await form.getByTestId("room-size-x").fill("5");
  await form.getByTestId("room-size-y").fill("4");
  await form.getByTestId("room-size-create").click();
}

test("🧭 Fáze 1–5: levá paleta a pravý panel jen s nástroji fáze, CAD rozvržení na výšku okna", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  const left = page.getByTestId("floorplan-left");
  const right = page.getByTestId("floorplan-right");

  // Fáze 1: podklad, kalibrace, místnosti X × Y a podlaží; vpravo seznam místností a detail
  await page.getByTestId("wizard-step-1").click();
  await expect(left.getByTestId("phase-tools-1")).toBeVisible();
  await expect(left.getByTestId("palette")).toHaveCount(0);
  await expect(right.getByTestId("rooms-overview")).toBeVisible();
  await expect(right.getByTestId("wiring-bom")).toHaveCount(0);
  await room(page);
  await expect(right.getByTestId("rooms-overview-room")).toHaveCount(1);
  await expect(right.getByTestId("rooms-overview-room")).toContainText("5 × 4 m · 20 m²");
  await page.screenshot({ path: "test-results/phase98-phase1.png" });

  // Fáze 2: rozváděče, zařizovací předměty a okna / dveře / nábytek (rozbalené); vpravo přívod a typ prostoru
  await page.getByTestId("wizard-next").click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", "2");
  expect(await groups(page)).toEqual(["panel:true", "fixtures:true", "architecture:true"]);
  await expect(right.getByTestId("site-settings").getByTestId("floorplan-supply")).toBeVisible();
  await expect(right.getByTestId("site-settings").getByTestId("occupancy-select")).toBeVisible();
  await expect(right.getByTestId("design-card")).toHaveCount(0);
  await expect(right.getByTestId("rooms-overview")).toHaveCount(0);

  // Fáze 3: zásuvky a spotřebiče + sestavy ve vícerámečku
  await page.getByTestId("wizard-step-3").click();
  expect(await groups(page)).toEqual(["sockets:true", "appliances:true"]);
  await expect(right.getByTestId("site-settings")).toHaveCount(0);
  await expect(right.getByTestId("design-card")).toHaveCount(0);

  // Fáze 4: světla, ovládání, stínění; vpravo karta systému a designu (galerie řad)
  await page.getByTestId("wizard-step-4").click();
  expect(await groups(page)).toEqual(["lights:true", "controls:true", "shading:true"]);
  await expect(right.getByTestId("design-card").getByTestId("series-gallery-open")).toBeVisible();
  await expect(right.getByTestId("install-methodology").getByLabel("Úroveň instalace")).toBeVisible();

  // Fáze 5: filtr vrstev, trasy a exporty vlevo; generování rozváděče nahoře vpravo, kusovník a výkaz
  await page.getByTestId("wizard-step-5").click();
  await expect(left.getByTestId("phase-tools-5")).toBeVisible();
  await expect(left.getByTestId("layer-filter-all")).toHaveAttribute("aria-checked", "true");
  await expect(left.getByTestId("wizard-bom")).toBeVisible();
  await expect(left.getByTestId("palette")).toHaveCount(0);
  await expect(right.getByTestId("wizard-generate")).toBeVisible();
  await expect(right.getByTestId("wiring-bom")).toBeVisible();
  await expect(right.getByTestId("design-card")).toHaveCount(0);
  // Spodní navigace fází pod plátnem
  await expect(page.getByTestId("phase-nav-bottom")).toContainText("Fáze 5 z 5");
  await page.getByTestId("wizard-prev-bottom").click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", "4");
  await page.getByTestId("wizard-next-bottom").click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", "5");

  // CAD rozvržení: pracovní plocha na výšku okna, pravý panel a paleta s vlastním posuvníkem, plátno celé v okně
  const layout = await page.evaluate(() => {
    const workspace = document.querySelector('[data-testid="floorplan-workspace"]')!.getBoundingClientRect();
    const frame = document.querySelector('[data-testid="floorplan-canvas-frame"]')!.getBoundingClientRect();
    const rightColumn = document.querySelector('[data-testid="floorplan-right"]') as HTMLElement;
    return { workspace: workspace.height, frameBottom: frame.bottom - workspace.top, overflow: getComputedStyle(rightColumn).overflowY, viewport: window.innerHeight };
  });
  expect(layout.workspace).toBeLessThanOrEqual(layout.viewport);
  expect(layout.frameBottom).toBeLessThanOrEqual(layout.workspace + 1);
  expect(layout.overflow).toBe("auto");
  await page.screenshot({ path: "test-results/phase98-phase5.png" });
});

test("🔌💡 Chytrý filtr vrstev a volný přechod mezi fázemi bez ztráty dat", async ({ page }) => {
  test.setTimeout(420_000);
  await openNew(page);
  const canvas = page.getByTestId("floorplan-canvas");
  await room(page);
  // Fáze 2: rozváděč RH a postel
  await page.getByTestId("wizard-step-2").click();
  await place(page, "Hlavní domovní / bytový rozváděč", [[600, 3500]]);
  await place(page, "Jednolůžko / dětská postel", [[3000, 2800]]);
  // Fáze 3: dvě zásuvky
  await page.getByTestId("wizard-step-3").click();
  await place(page, "Jednozásuvka", [[4200, 1150], [4200, 2600]]);
  // Fáze 4: světlo a vypínač
  await page.getByTestId("wizard-step-4").click();
  await place(page, "Stropní svítidlo", [[2500, 1800]]);
  await place(page, "Vypínač č. 1", [[300, 1200]]);

  const layer = (name: string) => canvas.locator(`[data-testid="route-layer"] [data-layer="${name}"]`);
  // Fáze 4: světelné trasy a vazba vypínač → světlo ostře, zásuvkové trasy skryté, zásuvky a nábytek na 30 %
  await expect.poll(() => layer("lighting").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(layer("sockets")).toHaveCount(0);
  await expect(canvas.locator('[data-element="socket"]').first()).toHaveAttribute("data-view", "dim");
  await expect(canvas.locator('[data-element="arch-bed-single"]')).toHaveAttribute("data-view", "dim");
  await expect(canvas.locator('[data-element="ceiling-light"]')).toHaveAttribute("data-view", "active");
  await expect(canvas.locator('[data-element="panel"]')).toHaveAttribute("data-view", "context");
  await expect(canvas.locator('[data-room="Obývací pokoj"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/phase98-phase4-layers.png" });

  // Fáze 3: zásuvkové trasy ostře, světelné skryté, světla potlačená na 25 %, půdorys / nábytek / rozváděč viditelné
  await page.getByTestId("wizard-step-3").click();
  await expect.poll(() => layer("sockets").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(layer("lighting")).toHaveCount(0);
  await expect(canvas.getByTestId("switch-link")).toHaveCount(0);
  await expect(canvas.locator('[data-element="ceiling-light"]')).toHaveAttribute("data-view", "dim");
  await expect(canvas.locator('[data-element="ceiling-light"]')).toHaveAttribute("opacity", "0.25");
  await expect(canvas.locator('[data-element="arch-bed-single"]')).toHaveAttribute("data-view", "context");
  await expect(canvas.locator('[data-element="panel"]')).toBeVisible();
  await expect(canvas.locator('[data-room="Obývací pokoj"]')).toHaveCount(1);
  await page.screenshot({ path: "test-results/phase98-phase3-layers.png" });

  // Volný přechod: ze 4 zpět do 2 (přívod 1× 230 V), do 3 (další zásuvka) a do 5 – nic se neztratí
  await page.getByTestId("wizard-step-4").click();
  await page.getByTestId("wizard-step-2").click();
  await page.getByTestId("site-settings").getByTestId("floorplan-supply").selectOption("1F_TNS");
  await page.getByTestId("wizard-step-3").click();
  await place(page, "Jednozásuvka", [[2500, 3600]]);
  await page.getByTestId("wizard-step-5").click();
  await expect(canvas.locator('[data-element="socket"]')).toHaveCount(3);
  await expect(canvas.locator('[data-element="ceiling-light"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="panel"]')).toHaveCount(1);
  await expect(canvas.locator('[data-element="arch-bed-single"]')).toHaveCount(1);
  await expect.poll(() => layer("sockets").count(), { timeout: 30_000 }).toBeGreaterThan(0);
  await expect(layer("lighting").first()).toBeAttached();
  // Fáze 5: filtr vrstev
  await page.getByTestId("layer-filter-power").click();
  await expect(layer("lighting")).toHaveCount(0);
  await page.getByTestId("layer-filter-lighting").click();
  await expect(layer("sockets")).toHaveCount(0);
  await page.getByTestId("layer-filter-all").click();
  // Krokové karty i tahák vidí všechny fáze hotové (kromě generování)
  await expect(page.getByTestId("wizard-step-3-status")).toHaveText("3 zásuvky / spotřebiče");
  await page.getByTestId("wizard-step-2").click();
  await expect(page.getByTestId("site-settings").getByTestId("floorplan-supply")).toHaveValue("1F_TNS");
  await page.screenshot({ path: "test-results/phase98-back-to-2.png" });

  // „⚡ Vygenerovat rozváděč“ z taháku v jiné fázi přepne do fáze 5 – ke kontrole před generováním a formuláři rozváděče
  // (fáze 100: tahák zakázky je v záložce 🛡️ Normy (Linter), formulář v záložce ⚡ Kusovník & Rozváděč)
  await page.getByTestId("right-tab-norms").click();
  await page.getByTestId("live-checklist-generate").click();
  await expect(page.getByTestId("floorplan-wizard")).toHaveAttribute("data-step", "5");
  await expect(page.getByTestId("right-tab-bom")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByTestId("generation-checklist")).toBeVisible();
  await expect(page.getByTestId("generate-from-floorplan")).toBeVisible();
});

test("⚡ AI Panel Builder: 4 fáze projektu ve stejném stylu, části 1a / 1b a 4a / 4b, Elektro-linter ve fázi 2", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByRole("link", { name: /PB-001/ }).first().click();
  const stepper = page.getByTestId("panel-phase-stepper");
  await expect(stepper).toHaveAttribute("data-phase", "1", { timeout: 60_000 });
  const cards = stepper.getByTestId("panel-phase-cards").getByRole("link");
  await expect(cards).toHaveCount(4);
  const labels = ["1. Osazení DIN lišt & Skříň", "2. Strom zapojení, Fáze & Linter", "3. Výpočet oteplení IEC 60890", "4. Dokumentace, Kusovník & Štítky"];
  for (const [index, label] of labels.entries()) await expect(cards.nth(index)).toContainText(label);
  // Stejný vzhled jako průvodce 2D půdorysem: aktivní fáze žlutě
  await expect(stepper.getByTestId("panel-phase-1")).toHaveAttribute("aria-current", "step");
  await expect(stepper.getByTestId("panel-phase-1")).toHaveClass(/border-yellow-400/);

  // Fáze 1, část 1a: jen osazení DIN lišt (vektorový rozváděč) – strom ani oteplení na stránce nejsou
  await expect(stepper.getByTestId("panel-page-recognition")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("vector-panel")).toBeVisible();
  await expect(page.getByTestId("tree-summary")).toHaveCount(0);
  await expect(page.getByTestId("thermal-verdict")).toHaveCount(0);
  // Další → část 1b Skříň rozváděče
  await expect(stepper.getByTestId("next-step")).toContainText("1b · Skříň rozváděče");
  await stepper.getByTestId("next-step").click();
  await expect(page).toHaveURL(/\/enclosure$/, { timeout: 60_000 });
  await expect(page.getByTestId("panel-page-enclosure")).toHaveAttribute("aria-current", "page");
  await expect(page.getByTestId("panel-phase-stepper")).toHaveAttribute("data-phase", "1");

  // Fáze 2: strom zapojení s fázemi a souhrnem Elektro-linteru, bez částí
  await page.getByTestId("panel-phase-2").click();
  await expect(page).toHaveURL(/\/tree$/, { timeout: 60_000 });
  await expect(page.getByTestId("tree-summary")).toBeVisible();
  await expect(page.getByTestId("tree-linter")).toBeVisible();
  await expect(page.getByTestId("panel-subpages")).toHaveCount(0);
  await expect(page.getByTestId("vector-panel")).toBeVisible();

  // Fáze 3: výpočet oteplení
  await page.getByTestId("next-step").click();
  await expect(page).toHaveURL(/\/thermal$/, { timeout: 60_000 });
  await expect(page.getByTestId("thermal-verdict")).toContainText("VYHOVUJE");
  await expect(page.getByTestId("panel-phase-3")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("tree-summary")).toHaveCount(0);

  // Fáze 4: 4a dokumentace a kusovník → 4b štítky (konec průvodce, volný návrat)
  await page.getByTestId("next-step").click();
  await expect(page).toHaveURL(/\/documentation$/, { timeout: 60_000 });
  await expect(page.getByTestId("doc-sheet-1")).toBeVisible();
  await expect(page.getByTestId("thermal-verdict")).toHaveCount(0);
  await page.getByTestId("panel-page-labels").click();
  await expect(page).toHaveURL(/\/labels$/, { timeout: 60_000 });
  await expect(page.getByTestId("panel-phase-4")).toHaveAttribute("aria-current", "step");
  await expect(page.getByTestId("next-step")).toHaveCount(0);
  await expect(page.getByTestId("prev-step")).toContainText("4a · Dokumentace a kusovník (PDF)");
  await page.screenshot({ path: "test-results/phase98-panel-builder.png" });
  await page.getByTestId("panel-phase-1").click();
  await expect(page.getByTestId("vector-panel")).toBeVisible({ timeout: 60_000 });
});

test("🏭 ELDOCK Průmysl: přepínač 4 agend závodu – vždy jen jedna agenda, volný přechod mezi nimi", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(async () => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/plant\/plant-jbc$/, { timeout: 30_000 });
  }).toPass({ timeout: 120_000 });
  const switcher = page.getByTestId("plant-phase-switcher");
  await expect(switcher).toHaveAttribute("data-phase", "1");
  const cards = switcher.getByTestId("plant-phase-cards").getByRole("link");
  await expect(cards).toHaveCount(4);
  const labels = ["1. Mapa závodu & BIM (.ifc)", "2. Rozváděče, Stroje & QR štítky", "3. Schémata, Červenka & Zálohy PLC", "4. Revize & Plánovač"];
  for (const [index, label] of labels.entries()) await expect(cards.nth(index)).toContainText(label);
  await expect(switcher.getByTestId("plant-phase-1")).toHaveAttribute("aria-current", "step");
  await expect(switcher.getByTestId("plant-phase-1")).toHaveClass(/border-yellow-400/);

  // Agenda 1: mapa areálu a souhrn; seznam zařízení ani lhůtník tu nejsou
  await expect(page.getByRole("group", { name: "Mapa areálu" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Souhrn závodu" })).toBeVisible();
  await expect(page.getByTestId("plant-equipment")).toHaveCount(0);
  await expect(page.getByText("Hlídač elektrorevizí (Lhůtník)")).toHaveCount(0);

  // Agenda 2: karty rozváděčů a strojů s tiskem QR štítku
  await switcher.getByTestId("plant-phase-2").click();
  await expect(page).toHaveURL(/\?faze=2$/, { timeout: 60_000 });
  await expect(page.getByTestId("plant-phase-switcher")).toHaveAttribute("data-phase", "2");
  await expect(page.getByRole("group", { name: "Mapa areálu" })).toHaveCount(0);
  await expect(page.getByTestId("plant-equipment-boards")).toBeVisible();
  // Fáze 100: vzorový BIM model haly (demo-ready, fáze 95 – dřívější testy téže databáze) má vlastní podružný RM1
  // v Hale H1; hlavní rozváděč nn vzorového závodu je v Energetice
  const rm1 = page.locator('[data-testid="plant-equipment-card"][data-tag="RM1"]').filter({ hasText: "Energetika" });
  await expect(rm1).toHaveCount(1);
  await expect(rm1).toContainText("Hlavní rozváděč");
  await expect(rm1.getByTestId("plant-equipment-qr")).toHaveAttribute("href", /\/equipment\/[^/]+\/label$/);

  // Agenda 3: schémata, Červenka (otevřený zákres ZM-2026-0041) a zálohy PLC
  await page.getByTestId("plant-phase-next").click();
  await expect(page).toHaveURL(/\?faze=3$/, { timeout: 60_000 });
  await expect(page.getByTestId("plant-equipment")).toHaveCount(0);
  const cnc = page.locator('[data-testid="plant-docs-row"][data-tag="R-CNC-04"]');
  await expect(cnc.locator('[data-testid="plant-docs-change"][data-redline="true"]')).toContainText("ZM-2026-0041");
  await expect(cnc.getByTestId("plant-docs-backup")).toContainText("TIA Portal V19");
  await expect(cnc.getByTestId("plant-docs-schema")).toHaveAttribute("href", /\?tab=schema$/);

  // Agenda 4: lhůtník revizí, Nařízení (EU) 2023/1230 a What-If simulátor (R-CNC-04 → RM1 → TR1)
  await page.getByTestId("plant-phase-next").click();
  await expect(page).toHaveURL(/\?faze=4$/, { timeout: 60_000 });
  await expect(page.getByTestId("plant-docs")).toHaveCount(0);
  // Fáze 115: agenda 4 = „📋 Revize & Plánovač“ – lhůtník je záložka centra revizí
  await expect(page.getByTestId("revision-hub")).toBeVisible();
  await page.getByTestId("revision-tab-lhutnik").click();
  await expect(page).toHaveURL(/\?faze=4&tab=lhutnik$/, { timeout: 60_000 });
  await expect(page.getByText("Hlídač elektrorevizí (Lhůtník)")).toBeVisible();
  await expect(page.getByTestId("plant-legislation")).toContainText("Nařízení (EU) 2023/1230");
  const simulator = page.getByTestId("plant-simulator");
  await simulator.getByTestId("plant-simulator-target").selectOption({ label: "R-CNC-04 - Rozváděč CNC centra 04" });
  await simulator.getByLabel("Nový stroj [kW]").fill("30");
  await expect(simulator.getByTestId("simulator-amps")).toContainText("+48,1 A");
  await expect(simulator.locator("[data-sim]")).toHaveCount(3);
  await expect(page.getByTestId("plant-phase-next")).toHaveCount(0);
  await page.screenshot({ path: "test-results/phase98-plant.png" });

  // Volný návrat na mapu
  await page.getByTestId("plant-phase-1").click();
  await expect(page.getByRole("group", { name: "Mapa areálu" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("plant-compliance")).toHaveCount(0);
});
