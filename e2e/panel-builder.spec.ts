import { expect, test } from "@playwright/test";

// AI Panel Builder (fáze 27–31). Výchozí účet E2E je vedoucí údržby (má oprávnění Panel Builder).
test.describe.configure({ mode: "serial" });

test("katalog prvků: navigace, okamžité hledání, filtry a atomizace vzorového PDF", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: /Panel Builder/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder");
  await expect(page.getByRole("link", { name: /PB-001/ })).toContainText("Domovní / Podružný rozváděč PB-001");

  await page.getByRole("link", { name: "Katalog prvků" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Katalog prvků");
  await expect(page.getByTestId("catalog-count")).toContainText(/z \d+ prvků/);

  // Hledání bez diakritiky a pomlček
  await expect(async () => {
    await page.getByLabel("Hledat v katalogu").fill("jistic s201b16");
    await expect(page).toHaveURL(/q=jistic/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toHaveCount(0);

  // Filtr kategorie + póly
  await page.getByLabel("Hledat v katalogu").fill("");
  await page.getByLabel("Kategorie").selectOption("RCD");
  await page.getByLabel("Póly").selectOption("4P");
  await expect(page).toHaveURL(/category=RCD/);
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toHaveCount(0);

  // Atomizace vzorového PDF z demo dokumentace
  await page.getByRole("button", { name: /Atomizovat PDF datasheet/ }).click();
  await page.getByRole("button", { name: /Pohon vrat – kusovník/ }).click();
  const result = page.getByTestId("datasheet-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("PCS2250101");
  await expect(result).toContainText("Demo AI režim");
  await page.getByRole("button", { name: "Importovat další PDF" }).click();
  await page.getByRole("button", { name: /Domovní rozváděč RH1/ }).click();
  await expect(result).toContainText("2CDS251001R1165", { timeout: 30_000 });
  await expect(result.getByText("Už v katalogu").first()).toBeVisible();
});
