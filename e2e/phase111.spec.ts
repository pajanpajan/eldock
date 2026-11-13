import { expect, test, type Page } from "@playwright/test";

import { PUBLIC_STATE } from "./auth";
import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 111: průvodce uspořádáním skříně a lišt (4 koncepce se skutečnými rozvodnicemi, 2 pole Silnoproud | Slaboproud,
// šířka všech lišt, 24M lišty s přepážkou), úvodní rozcestník a logo na „/“, 1 testovací projekt s prodejním modalem
// a Hlídač revizí s AI čtečkou výrobního štítku a identifikačním štítkem EL-xxxxxx.

/** Malý platný PNG (1 × 1) – fotka výrobního štítku pro E2E. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

/** ARES v E2E bez sítě: odpověď registru podle IČO. */
async function mockAres(page: Page, company: { ico: string; companyName: string; dic: string | null; street: string; city: string; zip: string }) {
  await page.route("**/api/ares?ico=*", (route) => (new URL(route.request().url()).searchParams.get("ico") === company.ico ? route.fulfill({ json: company }) : route.fulfill({ status: 503, json: { error: "ARES nedostupný" } })));
}

test("📐 2D půdorys → ⚡ rozváděč: průvodce uspořádáním skříně, 2 pole Silnoproud | Slaboproud, šířka všech lišt a 24M s přepážkou", async ({ page }) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 300_000 });
  // Ukázka se otevře v kroku 1 – tlačítko generování je ve fázi 5 v záložce ⚡ Kusovník & Rozváděč
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("wizard-generate").click();

  const wizard = page.getByTestId("layout-wizard");
  await expect(wizard).toBeVisible({ timeout: 120_000 });
  for (const concept of ["two_field", "wide24", "compact18", "two_boards"]) await expect(wizard.getByTestId(`layout-option-${concept}`)).toBeVisible();
  // Se Smart Home doporučená dvoupolová skříň – skutečné rozvodnice z databáze se 2 poli po 12 M
  await expect(wizard.getByTestId("layout-option-two_field")).toHaveAttribute("aria-checked", "true");
  await expect(wizard.getByTestId("layout-option-two_field")).toContainText("Doporučeno");
  await expect(wizard.getByTestId("layout-summary-two_field")).toContainText("Pole A – Silnoproud");
  await expect(wizard.getByTestId("layout-enclosures")).toContainText("2 pole ×");
  await page.screenshot({ path: "test-results/phase111-wizard.png" });
  await wizard.getByTestId("layout-option-wide24").click();
  await expect(wizard.getByTestId("layout-enclosures")).toContainText("× 24 M");
  await wizard.getByTestId("layout-option-two_field").click();
  await wizard.getByTestId("layout-wizard-confirm").click();

  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const panel = page.getByTestId("vector-panel");
  await expect(panel.getByTestId("vector-field-A")).toHaveText("Pole A – Silnoproud 230/400 V", { timeout: 60_000 });
  await expect(panel.getByTestId("vector-field-B")).toHaveText("Pole B – Slaboproud / Smart Home");
  await expect(panel.getByTestId("vector-partition-vertical")).toBeAttached();
  await expect(page.getByTestId("rail-summary")).toContainText("2 pole vedle sebe");
  await panel.screenshot({ path: "test-results/phase111-two-fields.png" });

  // Šířka všech lišt 24M → přístroje znovu na lišty; přepínač 1 pole / 2 pole vedle sebe
  await page.getByTestId("rails-width-24").click();
  await expect(panel.locator("g[data-rail]").first()).toHaveAttribute("data-capacity", "24", { timeout: 60_000 });
  await expect(panel.locator('g[data-rail]:not([data-capacity="24"])')).toHaveCount(0);
  await page.getByTestId("rails-fields-1").click();
  await expect(panel.getByTestId("vector-fields")).toHaveCount(0, { timeout: 60_000 });
  await page.getByTestId("rails-fields-2").click();
  await expect(panel.getByTestId("vector-fields")).toBeAttached({ timeout: 60_000 });

  // Průvodce z horní lišty plátna: široké 24M lišty, silnoproud nahoře, slaboproud dole za přepážkou
  await page.getByTestId("layout-wizard-open").click();
  const again = page.getByTestId("layout-wizard");
  await expect(again).toBeVisible({ timeout: 60_000 });
  await again.getByTestId("layout-option-wide24").click();
  await again.getByTestId("layout-wizard-confirm").click();
  await expect(panel.getByTestId("vector-partition")).toBeAttached({ timeout: 60_000 });
  await expect(panel.getByTestId("vector-fields")).toHaveCount(0);
  await expect(panel.locator('g[data-rail]:not([data-capacity="24"])')).toHaveCount(0);
  await panel.screenshot({ path: "test-results/phase111-wide24.png" });
});

test.describe("úvodní rozcestník a logo ELDOCK", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("vlevo domovní instalace & rozváděče, vpravo průmysl & Hlídač revizí, podsekce s moduly a logo vždy na /", async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    const left = page.getByTestId("gateway-elektroinstalace");
    const right = page.getByTestId("gateway-prumysl-a-revize");
    await expect(left).toContainText("🏠⚡");
    await expect(left).toContainText("Pro montážní elektrikáře, revizní techniky, projektanty a výrobce rozváděčů.");
    for (const title of ["2D Půdorys & Kabeláž", "AI Panel Builder", "Cenové nabídky & Kusovníky"]) await expect(left).toContainText(title);
    await expect(right).toContainText("🏭🛡️");
    await expect(right).toContainText("AI čtečka výrobních štítků z fotky");
    await expect(page.getByTestId("gateway-cta-elektroinstalace")).toContainText("Vstoupit do sekce: Domovní instalace & Rozváděče");
    await expect(page.getByTestId("gateway-cta-prumysl-a-revize")).toContainText("Vstoupit do sekce: Průmysl, Budovy & Hlídač revizí");
    // Obě poloviny v prvním pohledu vedle sebe (detail až po rozkliknutí)
    const [a, b] = [(await left.boundingBox())!, (await right.boundingBox())!];
    expect(a.x).toBeLessThan(b.x);
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(a.y + a.height).toBeLessThan(1000);
    await page.screenshot({ path: "test-results/phase111-gateway.png" });

    await right.click();
    await expect(page).toHaveURL(/\/sekce\/prumysl-a-revize$/);
    await expect(page.getByTestId("section-launch-hlidac")).toHaveAttribute("href", "/hlidac-revizi");
    await expect(page.getByTestId("pricing-buildings")).toContainText("ELDOCK REVIZE & BUDOVY");
    await page.getByTestId("logo-home").click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByTestId("gateway-elektroinstalace").click();
    await expect(page).toHaveURL(/\/sekce\/elektroinstalace$/);
    await expect(page.getByTestId("section-launch-pudorys")).toHaveAttribute("href", "/panel-builder/floorplan/novy");
    await expect(page.getByTestId("pricing-installer")).toContainText("1 testovací projekt zdarma");
    await expect(page.getByTestId("pricing-actions")).toContainText("ušetří 5 kreditů");

    // Hlídač revizí bez přihlášení: přehled, režimy objektu a tarify
    await page.goto("/hlidac-revizi");
    await expect(page.getByTestId("hlidac-intro")).toContainText("Hlídač revizí & Správa spotřebičů a zařízení");
    await expect(page.getByTestId("pricing-buildings")).toContainText("až pro 500 spotřebičů");
    await page.getByTestId("logo-home").click();
    await expect(page).toHaveURL(/\/$/);
    for (const path of ["/kontakt", "/prezentace", "/superadmin/login", "/panel-builder", "/login"]) {
      await page.goto(path);
      await expect(page.getByTestId("logo-home").first(), path).toHaveAttribute("href", "/");
    }
  });
});

test("logo ELDOCK v přihlášené aplikaci (Správa závodů, AI Panel Builder, 2D půdorys) vede na úvodní stránku /", async ({ page }) => {
  test.setTimeout(240_000);
  for (const path of ["/app", "/panel-builder", "/panel-builder/floorplan", "/hlidac-revizi"]) {
    await expect(async () => {
      await page.goto(path);
      await expect(page.getByTestId("logo-home").first()).toHaveAttribute("href", "/", { timeout: 20_000 });
    }).toPass({ timeout: 120_000 });
  }
  await page.getByTestId("logo-home").first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId("gateway")).toBeVisible();
});

test.describe("1 testovací projekt zdarma, pak kredity", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("💎 nová firma: zkušební rozváděč zdarma se zkušebním označením, další rozváděč = prodejní modal", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await mockAres(page, { ico: "27082440", companyName: "Elektro Zkouška s.r.o.", dic: null, street: "Dlouhá 5", city: "Liberec", zip: "460 01" });
    await page.goto("/panel-builder/auth");
    await page.getByRole("tab", { name: "Registrace firmy (Tester)" }).click();
    await page.getByLabel("IČO").fill("27082440");
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Elektro Zkouška s.r.o.");
    await page.getByLabel("Jméno a příjmení odpovědné osoby / projektanta").fill("Jan Zkušební");
    await page.getByLabel("Telefon").fill("+420 603 000 111");
    await page.getByLabel("E-mail (přihlášení)").fill(`zkouska-${Date.now()}@eldock.test`);
    await page.getByLabel("Heslo (min. 10 znaků)").fill("Zeleny-Kocour-2026");
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Zaregistrovat firmu a spustit Panel Builder" }).click();
    await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 60_000 });
    await expect(page.getByTestId("panel-credits")).toHaveText(/Kredity: 0 \(\+ Dobít kredity \/ Tarify\)/);
    await expect(page.getByTestId("panel-trial")).toContainText("zkušební 2D půdorys + zkušební rozváděč");

    // Zkušební rozváděč od nuly – zdarma
    await expect(async () => {
      await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
      await expect(page.getByTestId("new-project-charge")).toContainText("🎁 Zkušební rozváděč zdarma", { timeout: 3_000 });
    }).toPass({ timeout: 60_000 });
    await page.getByLabel("Název rozváděče").fill("Zkušební RH");
    await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
    await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 60_000 });
    await page.goto(`${page.url()}/documentation`);
    await expect(page.getByTestId("trial-project-notice")).toContainText("ZKUŠEBNÍ VÝSTUP – ELDOCK TRIAL (1. testovací projekt zdarma)", { timeout: 60_000 });
    await expect(page.getByTestId("doc-sheet-1").getByTestId("trial-watermark")).toBeAttached();

    // Testovací projekt vyčerpaný – další rozváděč otevře prodejní modal s ceníkem
    await page.goto("/panel-builder");
    await expect(page.getByTestId("panel-trial")).toContainText("zkušební 2D půdorys");
    await page.getByTestId("new-project-paywall").click();
    const modal = page.getByTestId("paywall-modal");
    await expect(modal).toContainText("💎 Odemkněte plnou verzi ELDOCK – Tato zakázka vám ušetří ~8 hodin práce (5 200 Kč)");
    await expect(modal.getByTestId("paywall-prices")).toContainText("Kompletní rozváděč");
    await expect(modal.getByTestId("paywall-package-MONTER_125")).toContainText("125 kr.");
    await page.screenshot({ path: "test-results/phase111-paywall.png" });
    await modal.getByTestId("paywall-topup").click();
    await expect(page).toHaveURL(/\/panel-builder\/credits$/);
    await expect(page.getByTestId("credits-trial")).toContainText("zkušební 2D půdorys");

    // Nový 2D půdorys je ještě zkušební zdarma
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-charge-notice")).toContainText("🎁 Zkušební 2D půdorys zdarma", { timeout: 60_000 });
  });
});

test("🛡️ Hlídač revizí: budova s patry a místnostmi, spotřebič na 1 klik, 📷 výrobní štítek (S/N, třída) a identifikační štítek EL-xxxxxx", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(async () => {
    await page.goto("/hlidac-revizi");
    await expect(page.getByTestId("hlidac-workspace")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.getByTestId("hlidac-mode-OFFICE").click();
  await expect(page.getByTestId("hlidac-mode-OFFICE")).toHaveAttribute("aria-pressed", "true");

  await page.getByTestId("hlidac-open-new-building").click();
  await page.getByTestId("hlidac-building-name").fill("Administrativní budova E2E");
  await page.getByTestId("hlidac-floor-rooms-0").fill("Kancelář E2E-101, Kuchyňka E2E");
  await page.getByTestId("hlidac-add-floor").click();
  await page.getByTestId("hlidac-floor-rooms-1").fill("Kancelář E2E-204");
  await page.getByTestId("hlidac-building-create").click();
  await page.getByTestId("hlidac-room-Kancelář E2E-101").click({ timeout: 60_000 });
  await expect(page.getByTestId("hlidac-room-title")).toContainText("Kancelář E2E-101");

  await page.getByTestId("hlidac-palette-monitor").click();
  const devices = page.getByTestId("hlidac-devices");
  await expect(devices.getByTestId("hlidac-device").filter({ hasText: "Monitor" })).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("hlidac-palette-extension").click();
  await expect(devices.getByTestId("hlidac-device")).toHaveCount(2, { timeout: 60_000 });
  await expect(devices).toContainText("sk. E");

  // Detail spotřebiče: 2 fotografické sloty, AI čtečka štítku (bez Gemini – text štítku) a identifikační štítek
  await devices.getByTestId("hlidac-device").filter({ hasText: "Monitor" }).getByRole("button", { name: /Výrobní štítek/ }).click();
  const dialog = page.getByTestId("device-detail");
  await expect(dialog.getByTestId("device-slot-photo")).toContainText("📸 Fotka zařízení");
  await expect(dialog.getByTestId("nameplate-capture")).toContainText("[ 📷 Vyfotit / Nahrát výrobní štítek (AI přečte údaje) ]");
  await dialog.getByText("Text ze štítku").click();
  await dialog.getByTestId("nameplate-text").fill("DELL\nMonitor Dell UltraSharp 27\nModel: U2723QE\nS/N: CN-0892K1-74210\n100-240V~ 50/60Hz 1.5A\nClass I");
  await dialog.getByTestId("nameplate-input").setInputFiles({ name: "stitek.png", mimeType: "image/png", buffer: PNG });
  await expect(dialog.getByTestId("nameplate-photo")).toHaveAttribute("src", /\/api\/files\/photos\//, { timeout: 60_000 });
  const form = dialog.getByTestId("nameplate-form");
  await expect(form.getByTestId("nameplate-field-serialNumber")).toHaveValue("CN-0892K1-74210");
  await expect(form.getByTestId("nameplate-field-model")).toHaveValue("U2723QE");
  await expect(form.getByTestId("nameplate-field-protectionClass")).toHaveValue("I");
  await form.getByTestId("nameplate-field-title").fill("Monitor Dell UltraSharp 27");
  await form.getByTestId("nameplate-field-usageGroup").selectOption("E");
  await form.getByTestId("nameplate-save").click();
  await expect(dialog.getByTestId("id-label-serial")).toHaveText(/^EL-\d{6}$/, { timeout: 60_000 });
  await expect(dialog.getByTestId("id-label-sn")).toHaveText("S/N: CN-0892K1-74210");
  await expect(dialog.getByTestId("id-label-title")).toHaveText("Monitor Dell UltraSharp 27");
  await expect(dialog.getByTestId("nameplate-photo")).toBeVisible();
  await dialog.screenshot({ path: "test-results/phase111-nameplate.png" });

  // Tisk štítku na kotouč Zebra 30 × 15 mm
  const href = await dialog.getByTestId("id-label-print-30x15").getAttribute("href");
  await page.goto(href!);
  await expect(page.getByTestId("equipment-id-label")).toHaveAttribute("data-size", "30x15", { timeout: 60_000 });
  await expect(page.getByTestId("id-label-sn")).toContainText("CN-0892K1-74210");
  await expect(page.getByTestId("id-label-serial")).toHaveText(/^EL-\d{6}$/);
});
