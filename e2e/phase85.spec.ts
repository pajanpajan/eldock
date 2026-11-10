import { expect, test } from "@playwright/test";

// Fáze 85: volitelný výběr konkrétní skříně / rozvodnice při zakládání projektu (výrobce → řada → model), lišty
// návrhu podle skříně s omezením a karta „Zvolená rozvodnice a skříň“ v dokumentaci (náhled s dvířky, MPN,
// objednací údaje do schránky, kusovník).
test.describe.configure({ mode: "serial" });

test("🗄️ Nový návrh se zvolenou rozvodnicí: kaskáda, lišty podle skříně, omezení a karta v dokumentaci", async ({ page, context }) => {
  test.setTimeout(360_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await expect(async () => {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click({ timeout: 5_000 });
    await expect(page.getByTestId("enclosure-choice")).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 60_000 });

  // Volitelný krok: ABB → Mistral → MISTRAL65 3 × 18 M (objednací číslo z katalogu výrobce)
  const choice = page.getByTestId("enclosure-choice");
  await page.getByLabel("Název rozváděče").fill("RD fáze 85 – Mistral");
  await choice.getByTestId("enclosure-choice-toggle").click();
  await choice.getByTestId("enclosure-brand").selectOption("ABB");
  await expect(choice.getByTestId("enclosure-series").locator('option[value="mistral|cat"]')).toHaveCount(1, { timeout: 30_000 });
  await choice.getByTestId("enclosure-series").selectOption("mistral|cat");
  const model = choice.getByTestId("enclosure-model");
  const value = await model.locator("option", { hasText: "1SLM006501A1208" }).getAttribute("value");
  await model.selectOption(value!);
  const summary = choice.getByTestId("enclosure-choice-summary");
  await expect(summary).toContainText("3 řady × 18 M");
  await expect(summary).toContainText("1SLM006501A1208");
  await expect(page.getByTestId("design-start")).toContainText("3× DIN lišta po 18 modulech");
  // Orientační skříň (Schrack) nemá objednací číslo – „ověřte“
  await choice.getByTestId("enclosure-brand").selectOption("Schrack");
  await expect(choice.getByTestId("enclosure-series").locator("option", { hasText: "Amparo (orientační)" })).toHaveCount(1, { timeout: 30_000 });
  await choice.getByTestId("enclosure-brand").selectOption("ABB");
  await expect(choice.getByTestId("enclosure-series").locator('option[value="mistral|cat"]')).toHaveCount(1, { timeout: 30_000 });
  await choice.getByTestId("enclosure-series").selectOption("mistral|cat");
  await model.selectOption(value!);
  await page.getByRole("button", { name: /Založit návrh rozváděče/ }).click();

  // Krok 1: tři lišty po 18 M ze skříně, další řadu skříň nepustí
  await expect(page.getByTestId("enclosure-lock")).toContainText("ABB MISTRAL65", { timeout: 90_000 });
  const panel = page.getByTestId("vector-panel");
  await expect(panel.locator("[data-rail]")).toHaveCount(3);
  await expect(panel.locator('[data-rail="1"]')).toHaveAttribute("data-capacity", "18");
  await panel.getByRole("button", { name: /Přidat další DIN lištu/ }).click();
  await expect(page.getByText(/má jen 3 řady – další DIN lištu nepustí/)).toBeVisible();
  await expect(panel.locator("[data-rail]")).toHaveCount(3);
  const projectUrl = page.url();

  // Krok 5: karta zvolené rozvodnice – náhled s dvířky i bez, typ, MPN, objednací údaje a kusovník
  await page.goto(`${projectUrl}/documentation`);
  const card = page.getByTestId("chosen-enclosure");
  await expect(card).toBeVisible({ timeout: 90_000 });
  await expect(card.getByTestId("chosen-enclosure-fixed")).toBeVisible();
  await expect(card.getByTestId("chosen-enclosure-type")).toContainText("MISTRAL65");
  await expect(card.getByTestId("chosen-enclosure-mpn")).toHaveText("1SLM006501A1208");
  await expect(card.getByTestId("chosen-enclosure-render")).toHaveAttribute("data-door", "none");
  await card.getByTestId("enclosure-door-on").click();
  await expect(card.getByTestId("chosen-enclosure-render")).toHaveAttribute("data-door", "transparent");
  await expect(card.getByTestId("chosen-enclosure-render").locator("[data-door]")).toHaveCount(1);
  await card.getByTestId("copy-enclosure-order").click();
  await expect(page.getByText("Objednací údaje rozvodnice jsou ve schránce.")).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("Objednací číslo (MPN): 1SLM006501A1208");
  expect(copied).toContain("Rozložení: 3 řady × 18 M (celkem 54 M)");
  await expect(card.getByTestId("enclosure-bom-link")).toHaveAttribute("href", "#list-4");
  await expect(page.getByTestId("doc-parts").locator("tbody tr").first()).toContainText("1SLM006501A1208");
  await page.screenshot({ path: "test-results/phase85-enclosure.png" });

  // Krok 3: uvolnění omezení – lištu jde přidat
  await page.goto(`${projectUrl}/enclosure`);
  await page.getByTestId("enclosure-release").click();
  await expect(page.getByTestId("enclosure-lock")).toHaveCount(0, { timeout: 30_000 });
  await page.goto(projectUrl);
  await page.getByTestId("vector-panel").getByRole("button", { name: /Přidat další DIN lištu/ }).click();
  await expect(page.getByTestId("vector-panel").locator("[data-rail]")).toHaveCount(4, { timeout: 30_000 });
});
