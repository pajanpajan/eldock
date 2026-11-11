import { expect, test, type Page } from "@playwright/test";

// Fáze 93: obchodní centra (ČSN 33 2000-7-718, BD4) a zdravotnictví (ČSN 33 2000-7-710 ed. 2) – typ objektu v půdorysu
// i v AI Panel Builderu, Elektro-linter s doplněním CENTRAL STOP a elektroměru MID jedním klikem, zálohování napájení
// rozváděčů s filtrem větví nad mapou areálu a předvolby Knihy revizí se souhrnným tiskem pro HZS / MZ.
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

test("2D půdorys: typ objektu v kroku 2 i v kompaktní liště, paleta 🏥 Zdravotnictví jen v režimu Skupina 1", async ({ page }) => {
  test.setTimeout(300_000);
  await openNew(page);
  await page.getByTestId("wizard-step-2").click();
  const select = page.getByTestId("occupancy-select");
  await expect(select).toHaveValue("RESIDENTIAL");
  await expect(select.locator("option")).toHaveText([
    "🏠 Bytová / Domovní instalace (ČSN 33 2130 ed. 4 – BD1, běžné kabely CYKY)",
    "🛍️ Obchodní centrum / Prostor pro veřejnost (ČSN 33 2000-7-718 · BD3/BD4 · Bezhalogenové kabely B2ca)",
    "🏥 Zdravotnický prostor – Skupina 1: Ordinace, vyšetřovny a lůžka (ČSN 33 2000-7-710 ed. 2)",
  ]);
  const palette = page.getByRole("complementary", { name: "Paleta elektroinstalačních značek" });
  await expect(palette.locator('[data-group="medical"]')).toHaveCount(0);

  await select.selectOption("COMMERCIAL_BD4");
  await expect(page.getByTestId("occupancy-note")).toContainText("bezhalogenové B2ca-s1,d1,a1");
  await select.selectOption("MEDICAL_G1");
  await expect(page.getByTestId("occupancy-note")).toContainText("2 okruzích A / B");
  await expect(palette.locator('[data-group="medical"]')).toHaveCount(1);
  await expect(palette.getByRole("button", { name: /EKV – přípojka doplňujícího ochranného pospojování/ }).first()).toBeAttached();

  // Kompaktní lišta: typ objektu je vidět přímo v liště
  await page.getByTestId("ui-mode-compact").click();
  await expect(page.getByTestId("compact-occupancy")).toContainText("🏥 Zdravotnictví · Skupina 1");
});

test("AI Panel Builder: projekt obchodního centra – linter BD4 a doplnění spouště CENTRAL STOP a elektroměru MID 1 klikem", async ({ page }) => {
  test.setTimeout(300_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1500 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByLabel("Název rozváděče")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Název rozváděče").fill("RJ-A12 – nájemní jednotka OC");
  await page.getByTestId("occupancy-select").selectOption("COMMERCIAL_BD4");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByTestId("project-occupancy")).toHaveText("🛍️ Obchodní centrum · BD4");

  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  const card = page.getByTestId("placement-card");
  const linter = page.getByTestId("linter");
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await menu.getByRole("button", { name: "Zásuvky", exact: true }).click();
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--F1")).toBeVisible();

  await linter.getByTestId("linter-badge").click();
  const central = linter.locator('[data-rule="bd4-central-stop"]');
  await expect(central).toContainText("CENTRAL STOP");
  await expect(linter.locator('[data-rule="bd4-mid-meter"]')).toContainText("elektroměr MID");
  await central.getByRole("button", { name: "[ + Doplnit vypínací spoušť CENTRAL STOP a podružný MID elektroměr (1-klik) ]" }).click();
  await expect(page.getByText("Opraveno: + Doplnit vypínací spoušť CENTRAL STOP a podružný MID elektroměr (1-klik)")).toBeVisible({ timeout: 30_000 });
  await expect(linter.locator('[data-rule="bd4-central-stop"]')).toHaveCount(0, { timeout: 30_000 });
  await expect(linter.locator('[data-rule="bd4-mid-meter"]')).toHaveCount(0);
});

test("areál: zálohování napájení na kartě rozváděče a filtr větví DA nad mapou se součtem výkonu a rezervou", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/equipment/eq-r-lis-01");
  const card = page.getByTestId("power-backup-card");
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByTestId("power-tier-BACKUP_GENERATOR_DA").click();
  await card.getByTestId("backup-capacity").fill("250");
  await card.getByTestId("tenant-unit").fill("Lisovna – nájemní jednotka A1");
  await card.getByTestId("power-backup-save").click();
  await expect(page.getByTestId("header-backup-tier")).toHaveText("⚡ DA 15s", { timeout: 30_000 });
  await expect(page.getByTestId("header-tenant-unit")).toContainText("Lisovna – nájemní jednotka A1");

  await page.goto("/plant/plant-jbc");
  const filter = page.getByTestId("power-backup-filter");
  await expect(filter).toBeVisible({ timeout: 60_000 });
  await filter.getByTestId("backup-filter-BACKUP_GENERATOR_DA").click();
  await expect(filter.getByTestId("backup-headline")).toContainText("Celkem na DA:");
  await expect(filter.getByTestId("backup-headline")).toContainText("kapacita DA 250 kVA");
  await expect(filter.getByTestId("backup-members")).toContainText("Lisovna – nájemní jednotka A1");
  await expect(page.locator('[data-backup="on"]').first()).toBeAttached();
  // Hledání nájemní jednotky / oddělení
  await filter.getByTestId("backup-filter-ALL").click();
  await filter.getByTestId("tenant-search").fill("najemni jednotka a1");
  await expect(filter.getByTestId("backup-members").locator("li")).toHaveCount(1);

  // Úklid: rozváděč zpět na běžnou síť bez nájemní jednotky
  await page.goto("/equipment/eq-r-lis-01");
  await card.getByTestId("power-tier-GRID_STANDARD").click();
  await card.getByTestId("tenant-unit").fill("");
  await card.getByTestId("power-backup-save").click();
  await expect(page.getByTestId("header-backup-tier")).toHaveCount(0, { timeout: 30_000 });
});

test("Kniha revizí: předvolby průmysl / obchodní centrum / zdravotnictví a souhrnný tisk pro HZS a akreditační komisi MZ", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/inspections");
  const presets = page.getByTestId("inspection-presets");
  await expect(presets).toBeVisible({ timeout: 60_000 });
  await expect(presets.getByTestId("inspection-preset-INDUSTRY")).toContainText("[ 🏭 Průmyslový závod ]");
  await expect(presets.getByTestId("inspection-preset-RETAIL")).toContainText("[ 🛍️ Obchodní centrum (BD4 + Nouzové osv. + Central Stop) ]");
  await expect(presets.getByTestId("inspection-preset-HEALTH")).toContainText("[ 🏥 Zdravotnictví (Skupina 1/2 + ČSN EN 62353 + ZIS IT) ]");
  await presets.getByTestId("inspection-preset-RETAIL").click();
  await expect(presets.getByTestId("inspection-preset-RETAIL")).toHaveAttribute("aria-pressed", "true");
  await presets.getByTestId("inspection-preset-print").click();
  await expect(page).toHaveURL(/\/inspections\/audit-report\?predvolba=RETAIL/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Souhrnný export pro HZS");
  await expect(page.getByRole("button", { name: "🖨️ Souhrnný tisk pro HZS (PDF)" })).toBeVisible();
  await page.getByTestId("audit-preset-HEALTH").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Souhrnný export pro akreditační komise MZ");
});
