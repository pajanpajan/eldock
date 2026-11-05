import { expect, test } from "@playwright/test";

// Fáze 56: úvodní stránka pro čtyři cílové skupiny, newsletter s dvojím potvrzením a nastavení cookies.

test.describe("fáze 56 – veřejný web", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("rozcestník „Jsem…“ vede na sekce elektrikáře, revizního technika, průmyslu a údržby", async ({ page }) => {
    await page.goto("/");
    const chooser = page.getByTestId("audience-chooser");
    await expect(chooser.getByRole("link")).toHaveCount(4);
    for (const [role, anchor] of [["Elektrikář", "elektrikar"], ["Revizní technik", "revizni-technik"], ["Technický ředitel", "prumysl"], ["Údržbář", "udrzba"]] as const) {
      await expect(chooser.getByRole("link", { name: new RegExp(role) })).toHaveAttribute("href", `#${anchor}`);
      await expect(page.locator(`section#${anchor}`)).toBeAttached();
    }
    await chooser.getByRole("link", { name: /Revizní technik/ }).click();
    await expect(page).toHaveURL(/#revizni-technik$/);
    await expect(page.getByRole("heading", { name: /Revize bez přepisování/ })).toBeInViewport();
    await expect(page.getByTestId("trust-points")).toContainText("ČSN EN IEC 61439");
  });

  test("newsletter: bez souhlasu nejde odeslat, se souhlasem přijde výzva k potvrzení e-mailem", async ({ page }) => {
    await page.goto("/#novinky");
    const form = page.getByTestId("newsletter-form");
    await form.getByRole("textbox", { name: "E-mail" }).fill(`e2e-${Date.now()}@eldock.test`);
    await form.getByLabel("Moje profese (nepovinné)").selectOption("revizni-technik");
    await form.getByRole("button", { name: "Odebírat novinky" }).click();
    // povinný souhlas – prohlížeč formulář neodešle
    await expect(page.getByTestId("newsletter-message")).toHaveCount(0);
    await form.getByTestId("newsletter-consent").check();
    await form.getByRole("button", { name: "Odebírat novinky" }).click();
    await expect(page.getByTestId("newsletter-message")).toContainText("potvrzení odběru");
  });

  test("neplatný odkaz pro potvrzení / odhlášení se nic neprovede a ukáže vysvětlení", async ({ page }) => {
    await page.goto("/newsletter/odhlaseni?t=neplatny-token-0123456789abcdef");
    await page.getByRole("button", { name: "Odhlásit odběr" }).click();
    await expect(page.getByTestId("newsletter-result")).toContainText("neplatný");
    await page.goto("/newsletter/potvrzeni");
    await expect(page.getByText("Odkaz je neúplný")).toBeVisible();
  });

  test("s Google Analytics se ukáže lišta; „Odmítnout vše“ uloží volbu a analytiku nenačte", async ({ page }) => {
    // Konfigurace z /api/consent jako by byl nastavený ELDOCK_GA4_ID; Google se v testu nikdy nevolá
    await page.route("**/api/consent", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { ga4Id: "G-TEST12345" } }) : route.continue()));
    await page.route("**/googletagmanager.com/**", (route) => route.abort());
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible();
    await expect(banner.getByRole("button", { name: "Přijmout vše" })).toBeVisible();
    const saved = page.waitForResponse((response) => response.url().endsWith("/api/consent") && response.request().method() === "POST");
    await banner.getByRole("button", { name: "Odmítnout vše" }).click();
    expect((await saved).status()).toBe(201);
    await expect(banner).toHaveCount(0);
    const consent = (await page.context().cookies()).find((cookie) => cookie.name === "eldock_consent");
    expect(consent?.value).toMatch(/^v1\.a0m0\./);
    await expect(page.locator('script[src*="googletagmanager"]')).toHaveCount(0);
    // po obnovení se lišta znovu neptá
    await page.reload();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
  });

  test("nastavení cookies z patičky: bez analytiky jen nezbytné, lišta se nezobrazuje", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    await page.getByRole("contentinfo").getByTestId("consent-settings-link").click();
    const dialog = page.getByTestId("consent-settings");
    await expect(dialog).toContainText("Nezbytné");
    await expect(dialog).toContainText("eldock_consent");
    await expect(dialog).toContainText("Volitelné cookies (analytické ani marketingové) web teď nepoužívá");
    await page.goto("/ochrana-osobnich-udaju#cookies");
    await expect(page.locator("section#cookies")).toContainText("Odmítnutí je stejně snadné jako přijetí");
  });
});
