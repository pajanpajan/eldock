import { expect, test } from "@playwright/test";

// Fáze 45: editovatelné štítky se Smart Presety a číslováním, sticky karta přístroje s chytrým
// vložením, prostředí instalace (ČSN 33 2000-5-51 ed. 3) a elektro-linter s opravou 1 klikem.
test.describe.configure({ mode: "serial" });

test("štítky s presety a číslováním, linter s opravou 1 klikem, prostředí a chytré vložení na novou lištu", async ({ page }) => {
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
  await page.getByLabel("Název rozváděče").fill("Rozvodnice RD2 – garáž");
  await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });

  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  const card = page.getByTestId("placement-card");
  const linter = page.getByTestId("linter");
  await menu.getByRole("button", { name: "ABB", exact: true }).click();

  // Smart Preset: Zásuvky = jistič 1P B16; bez chrániče linter hlásí chybu
  await menu.getByRole("button", { name: "Zásuvky", exact: true }).click();
  await expect(card.getByLabel("Popis obvodu nového přístroje")).toHaveValue("Zásuvky");
  await expect(card).toContainText("ABB S201-B16");
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--F1")).toBeVisible();
  await expect(linter.locator('[data-rule="rcd-missing"]')).toBeVisible();

  // Oprava 1 klikem připraví chránič; vložením chyba zmizí. Číslování: Chránič 1 → Chránič 2
  await linter.locator('[data-rule="rcd-missing"]').getByRole("button", { name: /Opravit 1 klikem/ }).click();
  await expect(card).toContainText("F204 A-40/0,03");
  await menu.getByRole("button", { name: "Chránič", exact: true }).first().click();
  await expect(card.getByLabel("Popis obvodu nového přístroje")).toHaveValue("Chránič 1");
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("symbol--FI1")).toBeVisible();
  await expect(linter.locator('[data-rule="rcd-missing"]')).toHaveCount(0);
  await menu.getByRole("button", { name: "Chránič", exact: true }).first().click();
  await expect(card.getByLabel("Popis obvodu nového přístroje")).toHaveValue("Chránič 2");

  // Varná deska: preset 3P (3M) B16
  await menu.getByRole("button", { name: "Varná deska", exact: true }).click();
  await expect(card).toContainText("S203-B16");

  // Vlastní štítek s presetem v režimu úprav (uloží se a přežije obnovení stránky)
  await menu.getByRole("button", { name: "Přidat vlastní" }).click();
  await menu.getByLabel("Název vlastního štítku").fill("Sauna");
  await menu.getByLabel("Název vlastního štítku").press("Enter");
  await menu.getByRole("button", { name: /Upravit štítky/ }).click();
  await menu.getByLabel("Preset kategorie – Sauna").selectOption("MCB");
  await menu.getByLabel("Preset póly – Sauna").selectOption("3P");
  await menu.getByLabel("Preset proud – Sauna").selectOption("25");
  await menu.getByTestId("chips-done").click();
  await page.waitForTimeout(1200); // zápis do DB po chvíli klidu
  await page.reload();
  await menu.getByRole("button", { name: "ABB", exact: true }).click();
  await menu.getByRole("button", { name: "Sauna", exact: true }).click();
  await expect(card).toContainText("S203-B25");

  // Linter: štítek „Chránič 3“ na jističi → oprava 1 klikem změní přístroj na chránič
  await page.getByTestId("vector-panel").getByRole("button", { name: /^-F1 / }).click();
  const configurator = page.getByTestId("item-configurator");
  await expect(configurator.getByTestId("assigned-device")).toContainText("S201-B16");
  await configurator.getByLabel("Popis obvodu", { exact: true }).fill("Chránič 3");
  await configurator.getByLabel("Popis obvodu", { exact: true }).press("Enter");
  const wrong = linter.locator('[data-rule="label-category"]');
  await expect(wrong).toBeVisible();
  await wrong.getByRole("button", { name: /Opravit 1 klikem/ }).click();
  await expect(wrong).toHaveCount(0);
  await expect(page.getByTestId("symbol--FI1")).toBeVisible();
  await expect(page.getByTestId("symbol--FI2")).toBeVisible();
  // Ruční šířka a dohledání jsou v akordeonu
  await expect(configurator.getByTestId("advanced")).toBeVisible();
  await expect(configurator.getByLabel("Text z čela přístroje")).toBeHidden();

  // Prostředí: garáž vyžaduje min. IP 44 → skříň IP 41 nevyhovuje
  await page.getByLabel("Prostředí instalace").selectOption("GARAGE");
  await expect(page.getByTestId("environment-warning")).toContainText("IP 41");
  await expect(page.getByRole("button", { name: "Vybrat vhodnou skříň (min. IP 54)" })).toBeVisible();
  await expect(page.getByTestId("environment-notes")).toContainText("IK 07");

  // Chytré vložení: lišta 8M je plná → nabídne novou lištu
  await page.getByRole("button", { name: "Nový přístroj" }).click();
  await page.getByRole("button", { name: "Lišta 1: 8M" }).click();
  await expect(page.getByTestId("rail-usage-1")).toHaveText("6/8 M");
  await menu.getByRole("button", { name: "Varná deska", exact: true }).click();
  await expect(card.getByTestId("insert-1")).toHaveText(/Přidat novou lištu a vložit/);
  await card.getByTestId("insert-1").click();
  await expect(page.getByTestId("rail-usage-2")).toHaveText("3/8 M");
});
