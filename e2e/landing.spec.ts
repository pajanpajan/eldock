import { expect, test } from "@playwright/test";
import { PUBLIC_STATE } from "./auth";

test.describe("nepřihlášený návštěvník", () => {
  test.use({ storageState: PUBLIC_STATE });

  test("úvodní stránka je veřejná a klientská zóna vede přes /login do /app", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Eldock – elektrodokumentace od rodinného domu po výrobní závod");
    // Fáze 111: úvod = čistý dvoustranný rozcestník (podrobnosti v podsekcích /sekce/…)
    for (const name of ["Domovní a komerční elektroinstalace & Rozváděče", "Průmysl, Administrativní budovy & Hlídač revizí"]) {
      await expect(page.getByRole("heading", { name })).toBeVisible();
    }
    await expect(page.getByText("Eldock s.r.o. (v založení)").first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Domluvte si nezávaznou ukázku" })).toHaveAttribute("href", "/kontakt");
    // produktové video (podsekce Průmysl, budovy & Hlídač revizí) se líně načte a samo se rozběhne (scéna 2 v 8. s)
    await page.goto("/sekce/prumysl-a-revize");
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
