import { expect, test, type Page } from "@playwright/test";

import { PUBLIC_STATE } from "./auth";
import { goPhase, rightTab, confirmLayoutWizard } from "./floorplan-phases";

// Fáze 106: výroba rozváděče na klíč – velín zasmluvní výrobce (přístupový kód), firma v kroku 4 uvidí CNC plán 1 : 1
// a drátovací list, odešle objednávku (rezervace QR štítku EL-…), výrobce v portálu /vyroba-rozvadecu zakázku přijme,
// stáhne výrobní balíček, zapíše kusovou zkoušku a uzamkne Verzi 1.0 pod QR štítkem.
test.describe.configure({ mode: "serial" });

async function superadmin(page: Page) {
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
}

test("🏭 Výroba na klíč: výrobce z velínu, CNC & drátovací list v kroku 4, objednávka s QR štítkem, portál výrobce a Verze 1.0", async ({ page, browser }) => {
  test.setTimeout(480_000);
  page.on("dialog", (dialog) => void dialog.accept());
  // Velín: nový zasmluvněný výrobce v Libereckém kraji (kód se ukáže jen jednou)
  await superadmin(page);
  await page.getByRole("link", { name: "🏭 Výrobci rozváděčů" }).click();
  const tab = page.getByTestId("manufacturers-tab");
  await expect(tab).toBeVisible({ timeout: 60_000 });
  await tab.getByTestId("manufacturer-form-name").fill("Rozváděče E2E s.r.o.");
  await tab.getByTestId("manufacturer-form-email").fill("vyroba.e2e@rozvadece.example");
  await tab.getByTestId("manufacturer-form-region").selectOption("Liberecký kraj");
  await tab.getByTestId("manufacturer-form-leadDays").fill("6");
  await tab.getByTestId("manufacturer-form-submit").click();
  const issued = tab.getByTestId("manufacturer-code-issued");
  await expect(issued).toContainText("vyroba.e2e@rozvadece.example", { timeout: 30_000 });
  const code = ((await issued.locator("b").textContent()) ?? "").trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Firma: rozváděč z 2D půdorysu vzorového RD
  await page.goto("/panel-builder/floorplan?demo=rd-4kk");
  await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 90_000 });
  await goPhase(page, 5);
  await rightTab(page, "bom");
  const environment = page.getByTestId("floorplan-environment");
  if (await environment.count()) await environment.selectOption("TIMBER");
  await page.getByLabel("Název rozváděče").fill("RD106 výroba na klíč");
  await page.getByTestId("generate-from-floorplan").click();
  await confirmLayoutWizard(page);
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const projectUrl = page.url();

  // Krok 1b: tlačítko poptávky výroby na klíč
  await page.goto(`${projectUrl}/enclosure`);
  await expect(page.getByTestId("turnkey-entry").getByTestId("turnkey-open")).toContainText("🏭 Poptat / Objednat výrobu rozváděče na klíč", { timeout: 90_000 });

  // Krok 4: CNC plán 1:1, drátovací list, stažení DXF
  await page.goto(`${projectUrl}/documentation`);
  const cnc = page.getByTestId("cnc-panel");
  await expect(cnc).toBeVisible({ timeout: 90_000 });
  expect(await cnc.getByTestId("cnc-hole").count()).toBeGreaterThan(10);
  // Nástěnná skříň s vývodkami (u zapuštěné rozvodnice membránová příruba bez otvorů)
  await cnc.getByTestId("cnc-mounting-surface").click();
  await cnc.getByTestId("cnc-entry-both").click();
  expect(await cnc.getByTestId("cnc-gland").count()).toBeGreaterThan(3);
  await expect(cnc.getByTestId("cnc-face-bottom").getByTestId("cnc-gland").first()).toBeVisible();
  await cnc.getByTestId("cnc-door-centralStop").check();
  await cnc.getByTestId("cnc-tab-wires").click();
  const wires = cnc.getByTestId("wire-table");
  await expect(wires.getByTestId("wire-row").first()).toBeVisible();
  await expect(wires).toContainText("H07V-K (CYA)");
  await expect(wires).toContainText(/Dutinka \d+(,\d)? mm²/);
  const [dxf] = await Promise.all([page.waitForEvent("download"), cnc.getByTestId("cnc-download-dxf").click()]);
  // Fáze 113: ukázková firma má ⭐ neomezený přístup – soubory CNC bez zkušební přípony
  expect(dxf.suggestedFilename()).toBe("1_CNC_Vrtaci_plan_1-1.dxf");
  await page.screenshot({ path: "test-results/phase106-cnc.png" });

  // Objednávka výroby u vybraného výrobce → rezervace QR štítku EL-…
  await cnc.getByTestId("turnkey-open").click();
  const modal = page.getByTestId("turnkey-modal");
  await expect(modal.getByTestId("turnkey-total")).toContainText("Kč");
  await expect(modal.getByTestId("turnkey-blockers")).toHaveCount(0);
  await modal.getByTestId("turnkey-region").selectOption("Liberecký kraj");
  await modal.getByTestId("turnkey-manufacturer").filter({ hasText: "Rozváděče E2E s.r.o." }).click();
  await modal.getByTestId("turnkey-contactName").fill("Jan Zákazník");
  await modal.getByTestId("turnkey-contactEmail").fill("jan.zakaznik@e2e.example");
  await modal.getByTestId("turnkey-send").click();
  await expect(modal.getByTestId("turnkey-done")).toBeVisible({ timeout: 60_000 });
  const serial = ((await modal.getByTestId("turnkey-serial").textContent()) ?? "").trim();
  expect(serial).toMatch(/^EL-\d{6}$/);

  // Portál výrobce: přijetí, výrobní balíček, kusová zkouška a dokončení s uzamčením Verze 1.0
  const context = await browser.newContext({ storageState: PUBLIC_STATE });
  const portal = await context.newPage();
  await portal.goto("/vyroba-rozvadecu");
  await portal.getByTestId("manufacturer-email").fill("vyroba.e2e@rozvadece.example");
  await portal.getByTestId("manufacturer-code").fill(code);
  await portal.getByTestId("manufacturer-signin").click();
  const order = portal.getByTestId("manufacturer-order").filter({ hasText: serial });
  await expect(order).toHaveAttribute("data-status", "SENT", { timeout: 60_000 });
  await order.getByTestId("manufacturer-order-open").click();
  await portal.getByTestId("accept-price").fill("34900");
  await portal.getByTestId("accept-days").fill("6");
  await portal.getByTestId("accept-submit").click();
  await expect(portal.getByTestId("order-package")).toBeVisible({ timeout: 60_000 });
  const [zip] = await Promise.all([portal.waitForEvent("download"), portal.getByTestId("order-package").click()]);
  expect(zip.suggestedFilename()).toMatch(/^VYR-2026-\d{4}-vyrobni-balicek\.zip$/);
  const test106 = portal.getByTestId("factory-test");
  await test106.getByTestId("test-testerName").fill("Petr Výrobce");
  await test106.getByTestId("test-enclosureSerial").fill("SN-E2E-106");
  await test106.getByTestId("test-insulationMOhm").fill("300");
  await test106.getByTestId("test-peContinuityOhm").fill("0,03");
  await test106.getByTestId("test-rcdTripCurrentMa").fill("21");
  await test106.getByTestId("test-rcdTripTimeMs").fill("22");
  for (const key of ["ip", "clearances", "devices", "circuits", "terminals"]) await test106.getByTestId(`test-check-${key}`).check();
  await test106.getByTestId("test-torque").check();
  await test106.getByTestId("test-wiring").check();
  await test106.getByTestId("factory-test-save").click();
  await expect(portal.getByTestId("complete-order")).toBeVisible({ timeout: 60_000 });
  await portal.getByTestId("complete-order").click();
  await expect(portal.getByTestId("order-completed")).toContainText("Verze 1.0", { timeout: 90_000 });
  await portal.screenshot({ path: "test-results/phase106-portal.png" });
  await context.close();

  // Karta QR štítku: uzamčená Verze 1.0 rozváděče
  await page.goto(`/q/${serial}`);
  await expect(page.getByText(/Verze 1\.0/).first()).toBeVisible({ timeout: 60_000 });
});
