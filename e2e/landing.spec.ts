import { expect, test } from "@playwright/test";

test.describe("nepřihlášený návštěvník", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("úvodní stránka je veřejná a klientská zóna vede přes /login do /app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eldock – Průmyslový dok dokumentace a revizí");
    for (const name of ["Čtyři pilíře systému", "Jeden systém pro celý závod", "Ukážeme vám Eldock přímo ve vašem závodě"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByText("Eldock s.r.o. (v založení)").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Domluvit nezávaznou ukázku" })).toHaveAttribute("href", "#kontakt");
    // produktové video se líně načte a samo se rozběhne (scéna 2 začíná v 8. sekundě)
    const video = page.getByTestId("promo-video");
    await expect(video.getByText("Průmyslový dok dokumentace a revizí")).toBeAttached({ timeout: 30_000 });
    await expect(video.getByText("RH1 · Hlavní rozváděč").first()).toBeAttached({ timeout: 20_000 });

    await page.goto("/app");
    await expect(page).toHaveURL(/\/login$/);
    await page.goto("/");
    await page.getByRole("banner").getByRole("link", { name: "Klientská zóna / Přihlášení" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await expect(async () => {
      await page.locator("label", { hasText: "Petr Svoboda" }).click();
      await expect(page.getByRole("radio", { name: /^Petr Svoboda – / })).toBeChecked({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await page.getByLabel("Heslo / PIN").fill("eldock2026");
    await page.getByRole("button", { name: "Přihlásit se" }).click();
    // /app je rozcestník → údržbář přistane v závodě
    await expect(page).toHaveURL(/\/plant\/[^/]+$/);
  });
});

test("přihlášenému vede tlačítko z úvodní stránky rovnou do aplikace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Vstoupit do aplikace" }).first().click();
  await expect(page).toHaveURL(/\/(plant\/|cae|inspections\/)/);
});
