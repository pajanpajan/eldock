import { expect, test, type Page } from "@playwright/test";

import { toast } from "./helpers";

// Fáze 43: návrh rozváděče od nuly (bez fotky), kaskádové pravé menu s drag & drop osazováním,
// výběr skříně podle velikosti, logo a razítko firmy v dokumentaci a popisky 1:1.
test.describe.configure({ mode: "serial" });

/** PNG z plátna prohlížeče (bílé pozadí + modrý „otisk“). */
async function canvasPng(page: Page): Promise<Buffer> {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 60;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, 120, 60);
    context.strokeStyle = "#1d4ed8";
    context.lineWidth = 6;
    context.strokeRect(20, 10, 80, 40);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return Buffer.from(base64, "base64");
}

let projectUrl = "";

test("návrh od nuly: 1× 12M, presety a další lišta, kaskáda výrobce → kategorie → parametry, vložení 3×, drag & drop a skříň", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1500 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });

  // studený dev server stránku během kompilace přenačítá – dialog otevřít opakovaně
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByRole("button", { name: /Navrhnout od nuly/, pressed: true })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Název rozváděče").fill("Rozvodnice RD1 – rodinný dům");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  projectUrl = page.url();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Rozvodnice RD1");
  await expect(page.getByRole("link", { name: /1a Návrh a osazení DIN lišt/ })).toBeVisible();
  // Čisté plátno bez fotky
  await expect(page.getByTestId("panel-photo")).toHaveCount(0);
  const summary = page.getByTestId("rail-summary");
  await expect(summary).toHaveText("Konfigurace: 1 DIN lišta × 12 M · Obsazeno: 0 / 12 M (0 % · volná rezerva 100 %)");

  // Šířka řady presetem a druhá lišta
  await page.getByRole("button", { name: "Lišta 1: 14M (12+2)" }).click();
  await expect(summary).toContainText("1 DIN lišta × 14 M");
  await page.getByRole("button", { name: "Přidat další DIN lištu (řadu)" }).click();
  await expect(summary).toContainText("2 DIN lišty × 14 M · Obsazeno: 0 / 28 M");
  await page.getByRole("button", { name: "Lišta 2 o modul užší" }).click();
  await expect(summary).toContainText("2 DIN lišty × 14/13 M");

  // Kaskáda: hledání výrobce, výběr ABB schová ostatní karty
  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  await menu.getByLabel("Hledat výrobce podle názvu").fill("noa");
  await expect(menu.getByTestId("brand-grid").getByRole("button")).toHaveCount(1);
  await menu.getByLabel("Hledat výrobce podle názvu").fill("");
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await expect(menu.getByTestId("brand-grid")).toHaveCount(0);
  await expect(menu.getByRole("button", { name: /Vybrat jiného výrobce/ })).toBeVisible();
  await menu.getByRole("button", { name: "Jistič", exact: true }).click();
  await menu.getByRole("button", { name: "C", exact: true }).click();
  await menu.getByRole("button", { name: "10A", exact: true }).click();
  const card = page.getByTestId("placement-card");
  await expect(card).toContainText("ABB S201-C10");
  await expect(page.getByTestId("placement-mpn")).toContainText("2CDS251001R0104");

  // +3× na aktivní lištu 1 (nově přidaná lišta 2 se stala aktivní)
  await page.getByRole("button", { name: "◉ Lišta 1" }).click();
  await expect(page.getByTestId("placement-target")).toContainText("Aktivní lišta 1");
  await card.getByLabel("Popis obvodu nového přístroje").fill("Zásuvky");
  await card.getByRole("button", { name: "Vložit 3× na aktivní lištu" }).click();
  const panel = page.getByTestId("vector-panel");
  await expect(panel.locator("[data-symbol]")).toHaveCount(3);
  await expect(page.getByTestId("symbol--F3").getByTestId("symbol-value")).toHaveText("C10");
  await expect(page.getByTestId("symbol--F1").getByTestId("symbol-label")).toHaveText("Zásuvky");
  await expect(summary).toContainText("Obsazeno: 3 / 27 M");

  // Chránič na začátek lišty 1 přetažením karty (vloží se před -F1 a značení se přečísluje)
  await menu.getByRole("button", { name: "Chránič", exact: true }).last().click(); // dlaždice kategorie (štítek „Chránič“ je výš)
  await expect(card).toContainText("F202 A-40/0,03");
  const zone = page.getByTestId("vector-drop-zone");
  const zoneBox = (await zone.boundingBox())!;
  const first = (await page.getByTestId("symbol--F1").boundingBox())!;
  await page.getByTestId("placement-drag").dragTo(zone, { targetPosition: { x: first.x - zoneBox.x + 4, y: first.y - zoneBox.y + first.height / 2 } });
  await expect(panel.locator("[data-symbol]")).toHaveCount(4);
  await expect(page.getByTestId("rail-usage-1")).toHaveText("5/14 M");
  await expect(page.getByTestId("symbol--FI1")).toBeVisible();

  // Druhá lišta: aktivace a 1× vložení přepěťové ochrany
  await page.getByRole("button", { name: "◉ Lišta 2" }).click();
  await menu.getByRole("button", { name: "SPD (Přepěťovka)", exact: true }).click();
  await card.getByRole("button", { name: /Vložit na aktivní lištu \(1×\)/ }).click();
  await expect(page.getByTestId("rail-usage-2")).toHaveText("4/13 M");
  // Přesun lišty šipkou: SPD nahoru
  await page.getByRole("button", { name: "Posunout lištu 2 nahoru" }).click();
  await expect(page.getByTestId("rail-usage-1")).toHaveText("4/13 M");

  // Svorky / Hřebeny / Příslušenství
  await menu.getByRole("button", { name: "Svorky / Hřebeny / Příslušenství" }).click();
  await expect(menu.getByRole("button", { name: "Pomocný kontakt" })).toBeVisible();

  // Výběr skříně: nejdřív výrobce, pak jen vyhovující skříně
  await page.getByRole("button", { name: /Výběr skříně rozváděče/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByTestId("enclosure-hint")).toBeVisible();
  await dialog.getByRole("button", { name: "HAGER" }).click();
  const list = dialog.getByTestId("enclosure-list");
  await expect(list).toBeVisible();
  // návrh = 2 řady, nejširší 14 M → řady 12 M vyřazeny
  for (const text of await list.getByRole("button").allTextContents()) expect(text).not.toMatch(/× 12 M =/);
  // standardní matice má P_max; reálné skříně z externí DB ho nemusí uvádět
  await list.getByRole("button").filter({ hasText: "orientační" }).first().click();
  await expect(dialog).toHaveCount(0);
  await expect(toast(page)).toContainText(/Skříň Hager .* propsána/);
});

test("oteplení: P_max vybrané skříně, popisky 1:1 s kalibrací a exportem, logo a razítko v dokumentaci", async ({ page }) => {
  test.skip(!projectUrl, "závisí na předchozím testu");
  await page.goto(`${projectUrl}/thermal`);
  await expect(page.getByTestId("pmax-check")).toContainText("Hager");
  await expect(page.getByTestId("pmax-check")).toContainText(/skříně \d+ W/);

  // Popisky 1:1
  await page.goto(projectUrl);
  await page.getByTestId("labels-link").click();
  const sheet = page.getByTestId("label-sheet");
  await expect(sheet.getByTestId("calibration")).toContainText("100 mm = 10 cm");
  await expect(sheet.locator('[data-cell="-F1"]').first()).toHaveAttribute("data-width-mm", "17.5");
  await expect(sheet.locator('[data-cell="-FI1"]').first()).toHaveAttribute("data-width-mm", "35");
  await page.getByRole("button", { name: "18 mm", exact: true }).click();
  await expect(sheet.locator('[data-cell="-F1"]').first()).toHaveAttribute("data-width-mm", "18");
  await expect(sheet.getByTestId("device-labels").locator("[data-label]")).toHaveCount(5);
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export CSV/ }).click();
  expect((await csv).suggestedFilename()).toMatch(/-popisky\.csv$/);
  const xlsx = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export XLSX/ }).click();
  expect((await xlsx).suggestedFilename()).toMatch(/-popisky\.xlsx$/);

  // Logo a razítko firmy (bílé pozadí se vyčistí)
  await page.goto("/panel-builder/company");
  const png = await canvasPng(page);
  await page.getByLabel("Soubor s logem").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("logo-preview").locator("img")).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Soubor s razítkem").setInputFiles({ name: "razitko.png", mimeType: "image/png", buffer: png });
  await expect(page.getByTestId("stamp-preview").locator("img")).toBeVisible({ timeout: 15_000 });

  // Dokumentace: logo na titulním listu, v razítku a na štítku; razítko v prohlášení i kusové zkoušce
  await page.goto(`${projectUrl}/documentation`);
  await expect(page.getByTestId("doc-sheet-1").getByTestId("doc-logo").first()).toBeVisible();
  await expect(page.getByTestId("ce-label").getByTestId("doc-logo")).toBeVisible();
  await expect(page.getByTestId("declaration-signature").getByTestId("doc-stamp")).toBeVisible();
  await expect(page.getByTestId("routine-test-signature").getByTestId("doc-stamp")).toBeVisible();

  // Úklid: logo a razítko odebrat (ostatní E2E počítají s výchozím razítkem ELDOCK)
  await page.goto("/panel-builder/company");
  await page.getByTestId("company-branding").getByRole("button", { name: "Odebrat" }).first().click();
  await expect(page.getByTestId("logo-preview").locator("img")).toHaveCount(0);
  await page.getByTestId("company-branding").getByRole("button", { name: "Odebrat" }).first().click();
  await expect(page.getByTestId("stamp-preview").locator("img")).toHaveCount(0);
});
