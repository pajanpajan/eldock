import { expect, test } from "@playwright/test";
import { PUBLIC_STATE } from "./auth";

// Fáze 54: opravy veřejného webu – 404 místo přihlášení, právní stránky, mobilní menu a tlačítka bez přetečení.
test.describe("fáze 54 – veřejný web", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("neznámá adresa vrací 404 místo přesměrování, trasy aplikace dál vedou na přihlášení, právní stránky jsou veřejné", async ({ page, request }) => {
    expect((await request.get("/llms.txt", { maxRedirects: 0 })).status()).toBe(404);
    expect((await request.get("/inspections", { maxRedirects: 0 })).status()).toBe(307);

    const typo = await page.goto("/neexistujici-stranka");
    expect(typo?.status()).toBe(404);
    await expect(page.getByText("Stránka nenalezena")).toBeVisible();
    await expect(page.getByRole("link", { name: "Úvodní stránka", exact: true })).toHaveAttribute("href", "/");

    await page.goto("/ochrana-osobnich-udaju");
    await expect(page.getByRole("heading", { level: 1, name: "Zásady zpracování osobních údajů" })).toBeVisible();
    await expect(page.getByText(/Gemini/)).toBeVisible();
    await page.goto("/obchodni-podminky");
    await expect(page.getByText(/118\/2016 Sb\./)).toBeVisible();
    await page.goto("/");
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Ochrana osobních údajů" })).toHaveAttribute("href", "/ochrana-osobnich-udaju");
  });

  test("mobil: menu sekcí, tlačítka produktů uvnitř karty a bez zdvojených emoji", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByTestId("landing-menu").click();
    const menu = page.getByRole("navigation", { name: "Sekce stránky (mobil)" });
    // Fáze 107: položka „Kontakt & Spolupráce“ vede na samostatnou stránku /kontakt
    await menu.getByRole("link", { name: "Kontakt & Spolupráce" }).click();
    await expect(menu).toBeHidden();
    await expect(page).toHaveURL(/\/kontakt$/);

    // Fáze 58: produktová karta Panel Builderu je v části Domovní elektroinstalace
    await page.goto("/domovni-elektroinstalace");
    const card = page.getByTestId("product-panel-builder");
    const cardBox = (await card.boundingBox())!;
    for (const button of [card.getByRole("link", { name: /Spustit AI Panel Builder/ }), card.getByTestId("sample-elaborate")]) {
      const box = (await button.boundingBox())!;
      expect(box.x + box.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
    }
    await expect(page.getByText(/[🚀📄⚡🏭]/u)).toHaveCount(0);
  });
});
