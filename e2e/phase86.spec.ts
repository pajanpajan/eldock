import { expect, test } from "@playwright/test";

// Fáze 86: ověřené rozvodnice z katalogů výrobců v kaskádě nového projektu (ABB ComfortLine CA, Hager vector II
// a univers FWU, Schrack TOPO) – řady s objednacími čísly před orientačními typy Eldocku, karta „Zvolená rozvodnice
// a skříň“ s údaji z katalogu výrobce a odkazem na stránku výrobku.
test("🗄️ Kaskáda rozvodnic: nové řady s MPN a karta se zdrojem výrobce", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByTestId("enclosure-choice")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });

  const choice = page.getByTestId("enclosure-choice");
  const series = choice.getByTestId("enclosure-series");
  const model = choice.getByTestId("enclosure-model");
  await page.getByLabel("Název rozváděče").fill("RD fáze 86 – Vector II");
  await choice.getByTestId("enclosure-choice-toggle").click();

  // Schrack: řady TOPO s objednacími čísly před orientačními Amparo
  await choice.getByTestId("enclosure-brand").selectOption("Schrack");
  await expect(series.locator('option[value="topo nástěnná|cat"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(series.locator("option").nth(1)).toHaveText("TOPO nástěnná (21)");
  await expect(series.locator("option", { hasText: "TOPO zapuštěná (16)" })).toHaveCount(1);
  await expect(series.locator("option", { hasText: "Amparo (orientační)" })).toHaveCount(1);
  await series.selectOption("topo nástěnná|cat");
  await expect(model.locator("option", { hasText: "BK080153--" })).toHaveCount(1);

  // ABB ComfortLine CA s roztečí lišt 125 mm
  await choice.getByTestId("enclosure-brand").selectOption("ABB");
  await expect(series.locator('option[value="comfortline ca (rozteč 125 mm)|cat"]')).toHaveCount(1, { timeout: 30_000 });
  await series.selectOption("comfortline ca (rozteč 125 mm)|cat");
  await expect(model.locator("option", { hasText: "2CPX052183R9999" })).toHaveCount(1);

  // Hager vector II VE212SN → 2 lišty po 12 M
  await choice.getByTestId("enclosure-brand").selectOption("Hager");
  await expect(series.locator('option[value="vector ii|cat"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(series.locator('option[value="univers fwu|cat"]')).toHaveCount(1);
  await series.selectOption("vector ii|cat");
  const value = await model.locator("option", { hasText: "VE212SN" }).getAttribute("value");
  await model.selectOption(value!);
  const summary = choice.getByTestId("enclosure-choice-summary");
  await expect(summary).toContainText("2 řady × 12 M");
  await expect(summary).toContainText("VE212SN");
  await expect(page.getByTestId("design-start")).toContainText("2× DIN lišta po 12 modulech");
  await page.getByRole("button", { name: /Založit návrh rozváděče/ }).click();
  await expect(page.getByTestId("enclosure-lock")).toContainText("Hager Vector II VE212SN", { timeout: 90_000 });
  await expect(page.getByTestId("vector-panel").locator("[data-rail]")).toHaveCount(2);
  const projectUrl = page.url();

  // Krok 5: údaje z katalogu výrobce s odkazem na stránku výrobku, průhledná dvířka podle výrobce
  await page.goto(`${projectUrl}/documentation`);
  const card = page.getByTestId("chosen-enclosure");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByTestId("chosen-enclosure-mpn")).toHaveText("VE212SN");
  await expect(card.getByTestId("chosen-enclosure-source")).toContainText("Údaje z oficiálního katalogu výrobce");
  await expect(card.getByTestId("chosen-enclosure-source-link")).toHaveAttribute("href", "https://hager.com/cz/katalog/produkt/ve212sn-rozvod-nasten-uv-vector-ii-ip65-24m");
  await card.getByTestId("enclosure-door-on").click();
  await expect(card.getByTestId("chosen-enclosure-render")).toHaveAttribute("data-door", "transparent");
  await page.screenshot({ path: "test-results/phase86-enclosure.png" });
});
