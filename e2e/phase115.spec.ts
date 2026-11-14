import { expect, test } from "@playwright/test";

import { confirmLayoutWizard, goPhase, rightTab } from "./floorplan-phases";

// Fáze 115: celá řada ABB-free@home na DIN lištu (SA-M 4× / 8× / 12×, Pv 8 W z datasheetu ABB), hřeben jen v záhlaví
// lišty po skupinách chráničů bez duplicitních vodičů, CNC prohlížeč s listy a přiblížením, průmysl s mapou areálu hned
// pod pruhem závodu, podlaží bez Chytré revize, centrum „📋 Revize & Plánovač“ (/revize) a navigace v 5 sekcích.
test.describe.configure({ mode: "serial" });

test("⚡ free@home 4M / 8M / 12M s Pv 8 W, hřeben v záhlaví lišty bez duplicitních vodičů, kusovník PS-END a CNC prohlížeč", async ({ page }) => {
  test.setTimeout(540_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 300_000 });
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("wizard-generate").click();
  await confirmLayoutWizard(page);
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const projectUrl = page.url();
  const panel = page.getByTestId("vector-panel");

  // Hřeben pod 4P chráničem s 1P jističi: 3f L1 L2 L3 bez vidličky na N, N chrániče na můstek N-FIx
  const comb = panel.locator('[data-testid="comb-busbar"][data-kind="3P"]').first();
  await expect(comb).toHaveAttribute("data-conductors", "L1 L2 L3", { timeout: 60_000 });
  await expect(panel.locator('[data-testid="comb-busbar"][data-conductors*="N"][data-kind="3P"]')).toHaveCount(0);
  await expect(panel.getByTestId("comb-neutral").first()).toHaveAttribute("data-to", /^N-FI/);
  const rail = (await comb.getAttribute("data-comb-rail"))!;
  await panel.screenshot({ path: "test-results/phase115-combs.png" });

  // Krok 2 (zapojení): jistič napájený hřebenem nemá modrou spojnici od chrániče
  const fedIds = async () => {
    await page.goto(`${projectUrl}/tree`);
    const tree = page.getByTestId("vector-panel");
    await expect(tree.locator('[data-wire="drop"]').first()).toBeAttached({ timeout: 90_000 });
    return tree;
  };
  let tree = await fedIds();
  const combed = (await tree.locator(`[data-testid="comb-busbar"][data-comb-rail="${rail}"]`).first().getAttribute("data-ids"))!.split(" ").slice(1);
  expect(combed.length).toBeGreaterThan(0);
  for (const id of combed) await expect(tree.locator(`[data-wire="drop"][data-to="${id}"]`)).toHaveCount(0);
  await tree.screenshot({ path: "test-results/phase115-tree-combs.png" });

  // Volba hřebenu v záhlaví lišty: Bez hřebenu → hřeben zmizí a jističe dostanou vodiče, Auto → hřeben zpět
  await page.goto(projectUrl);
  const button = page.getByTestId(`rail-comb-${rail}`);
  await expect(button).toHaveAttribute("data-comb", "AUTO", { timeout: 60_000 });
  await button.click();
  await expect(page.getByTestId(`rail-comb-menu-${rail}`)).toContainText("[ Bez hřebenu (drátováno vodiči) ]");
  await expect(page.getByTestId(`rail-comb-menu-${rail}`)).toContainText("[ 3P+N (L1·L2·L3·N) ]");
  await page.getByTestId(`rail-comb-${rail}-OFF`).click();
  await expect(button).toHaveAttribute("data-comb", "OFF", { timeout: 60_000 });
  await expect(page.getByTestId("vector-panel").locator(`[data-testid="comb-busbar"][data-comb-rail="${rail}"]`)).toHaveCount(0);
  tree = await fedIds();
  for (const id of combed) await expect(tree.locator(`[data-wire="drop"][data-to="${id}"]`)).toHaveCount(1);
  await page.goto(projectUrl);
  await button.click();
  await page.getByTestId(`rail-comb-${rail}-AUTO`).click();
  await expect(button).toHaveAttribute("data-comb", "AUTO", { timeout: 60_000 });
  await expect(page.getByTestId("vector-panel").locator(`[data-testid="comb-busbar"][data-comb-rail="${rail}"]`).first()).toBeAttached();

  // Kaskáda: hřeben ani koncovka hřebenu se na lištu nevkládají
  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  if (await menu.getByTestId("brand-grid").count()) await menu.getByRole("button", { name: "ABB", exact: true }).click();
  else {
    await menu.getByRole("button", { name: /Vybrat jiného výrobce/ }).click();
    await menu.getByRole("button", { name: "ABB", exact: true }).click();
  }
  await menu.getByRole("button", { name: "Svorky / Hřebeny / Příslušenství", exact: true }).click();
  await expect(menu.getByRole("button", { name: "Hřebenová propojovací lišta", exact: true })).toHaveCount(0);
  await expect(menu.getByRole("button", { name: "Koncovka hřebenu", exact: true })).toHaveCount(0);
  await expect(menu.getByTestId("cascade-comb-hint")).toContainText("Hřeben: …");

  // Chytrá domácnost: spínací aktor free@home 4× (4M) / 8× (8M) / 12× (12M), SA-M-8.16.2.2 s Pv 8 W od ABB
  await menu.getByRole("button", { name: "🏠 Chytrá domácnost / PLC / Aktory", exact: true }).click();
  await menu.getByRole("button", { name: "ABB-free@home® (SA-M, BA-M, DA/M, HA-M, SysAP)", exact: true }).click();
  await menu.getByRole("button", { name: "Spínací aktor", exact: true }).click();
  for (const label of ["4× (4M)", "8× (8M)", "12× (12M)"]) await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  await expect(menu.getByRole("button", { name: "2×", exact: true })).toHaveCount(0);
  await menu.getByRole("button", { name: "8× (8M)", exact: true }).click();
  await expect(page.getByTestId("placement-mpn")).toContainText("2CDG510026R0011", { timeout: 30_000 });
  await expect(page.getByTestId("placement-loss")).toHaveText("8 W");
  await menu.getByRole("button", { name: "Stmívací aktor", exact: true }).click();
  for (const label of ["4× (6M)", "6× (8M)"]) await expect(menu.getByRole("button", { name: label, exact: true })).toBeVisible();
  await page.getByTestId("placement-card").screenshot({ path: "test-results/phase115-free-at-home.png" });

  // Krok 4: kusovník s hřebeny ABB PS a koncovkami PS-END, CNC prohlížeč s listy a přiblížením
  await page.goto(`${projectUrl}/documentation`);
  await expect(page.getByTestId("doc-parts")).toContainText("PS-END", { timeout: 90_000 });
  await expect(page.getByTestId("doc-parts")).toContainText("2CDL230001R1012");
  const cnc = page.getByTestId("cnc-panel");
  await expect(cnc.getByTestId("cnc-drawing")).toHaveAttribute("data-sheet", "all", { timeout: 60_000 });
  await cnc.getByTestId("cnc-sheet-plate").click();
  await expect(cnc.getByTestId("cnc-drawing")).toHaveAttribute("data-sheet", "plate");
  expect(await cnc.getByTestId("cnc-device").count()).toBeGreaterThan(5);
  await expect(cnc.getByTestId("cnc-hole-legend")).toContainText("Ø 4,2 mm – závit M5");
  await cnc.getByTestId("cnc-zoom-in").click();
  await expect(cnc.getByTestId("cnc-zoom-level")).toHaveText("125 %");
  await cnc.getByTestId("cnc-zoom-fit").click();
  await expect(cnc.getByTestId("cnc-zoom-level")).toHaveText("100 %");
  // Výkres vyplní šířku okna (ne drobný náhled uprostřed plátna)
  const canvas = (await cnc.getByTestId("cnc-canvas").boundingBox())!;
  const drawing = (await cnc.getByTestId("cnc-drawing").boundingBox())!;
  expect(drawing.width).toBeGreaterThan(canvas.width * 0.95);
  await cnc.getByTestId("cnc-sheet-faces").click();
  expect(await cnc.getByTestId("cnc-gland").count()).toBeGreaterThan(3);
  await cnc.getByTestId("cnc-sheet-plate").click();
  await cnc.getByTestId("cnc-drawing").screenshot({ path: "test-results/phase115-cnc-plate.png" });
  await cnc.getByTestId("cnc-tab-cuts").click();
  await expect(cnc.getByTestId("cut-table")).toContainText("Koncová krytka ABB PS-END");
});

test("🏭 Průmysl: mapa areálu hned pod pruhem závodu, podlaží bez Chytré revize, /revize se semaforem budov a navigace v 5 sekcích", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(async () => {
    await page.goto("/plant/plant-jbc");
    await expect(page.getByTestId("plant-strip")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 180_000 });
  const strip = page.getByTestId("plant-strip");
  await expect(strip.getByRole("heading", { level: 1 })).toContainText("Závod Jablonec");
  await expect(strip.getByTestId("plant-kpi-buildings")).toContainText(/\d+ budov/);
  await expect(strip.getByTestId("plant-kpi-equipment")).toContainText("zařízení");
  await expect(strip.getByTestId("plant-kpi-redlines")).toContainText("Červenky");
  await expect(page.getByTestId("trip-optimizer")).toHaveCount(0);
  // Mapa areálu začíná bez rolování
  const map = page.getByRole("group", { name: "Mapa areálu" });
  await expect(map).toBeVisible({ timeout: 60_000 });
  // Pruh závodu na jeden řádek, mapa začíná v horní polovině okna (1440 × 900)
  expect((await strip.boundingBox())!.height).toBeLessThan(80);
  expect((await map.boundingBox())!.y).toBeLessThan(500);
  await page.screenshot({ path: "test-results/phase115-plant.png" });

  // Navigace v 5 sekcích, revize na jednom místě
  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  for (const id of ["areal", "stroje", "schemata", "revize", "sprava"]) await expect(nav.getByTestId(`nav-section-${id}`)).toBeVisible();
  await expect(nav.getByTestId("nav-section-areal").getByRole("button")).toHaveAttribute("aria-current", "page");
  await nav.getByTestId("nav-section-revize").getByRole("button").click();
  await expect(nav.getByTestId("nav-panel-revize").getByRole("link", { name: /Revize & Plánovač/ })).toHaveAttribute("href", "/revize");

  // Podlaží: hned filtry vrstev a půdorys haly, žádná Chytrá revize
  await page.goto("/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np");
  await expect(page.getByRole("group", { name: "Filtr stavu" })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("trip-optimizer")).toHaveCount(0);
  expect((await page.getByRole("group", { name: "Filtr stavu" }).boundingBox())!.y).toBeLessThan(400);

  // /revize: semafor budov → filtr budovy, záložky agendy
  await page.goto("/revize");
  const hub = page.getByTestId("revision-hub");
  await expect(hub).toBeVisible({ timeout: 60_000 });
  const buildings = hub.getByTestId("revision-building");
  expect(await buildings.count()).toBeGreaterThanOrEqual(3);
  await expect(hub.getByTestId("revision-tab-panel-chytra").getByTestId("trip-optimizer")).toBeVisible();
  await page.screenshot({ path: "test-results/phase115-revize.png" });
  const first = buildings.first();
  const id = (await first.getAttribute("data-building"))!;
  await first.click();
  await expect(page).toHaveURL(new RegExp(`budova=${id}`), { timeout: 60_000 });
  await expect(page.getByTestId("revision-building-filter")).toBeVisible();
  await page.getByTestId("revision-tab-lhutnik").click();
  await expect(page).toHaveURL(/tab=lhutnik/, { timeout: 60_000 });
  await expect(page.getByText("Hlídač elektrorevizí (Lhůtník)")).toBeVisible();
  await page.getByTestId("revision-tab-ticr").click();
  await expect(page.getByTestId("revision-tab-panel-ticr")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("revision-tab-spotrebice").click();
  await expect(page.getByTestId("revision-hlidac-link")).toHaveAttribute("href", "/hlidac-revizi");

  // 4. agenda závodu = totéž centrum revizí
  await page.goto("/plant/plant-jbc?faze=4");
  await expect(page.getByTestId("plant-compliance").getByTestId("revision-hub")).toBeVisible({ timeout: 60_000 });
});
