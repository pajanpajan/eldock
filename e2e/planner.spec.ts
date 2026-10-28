import { expect, test, type Page } from "@playwright/test";

import { startAs } from "./helpers";

// Fáze 15: chytrý plánovač revizí – ukázkový povel, odznaky, tip „přiberte“, rychlá revize dávky a tisk.

const route = (page: Page) => page.getByRole("region", { name: /Pochůzka/ });

/** Ukázkový povel až po hydrataci (dev server může stránku ještě kompilovat). */
async function runCommand(page: Page, text: string) {
  await expect(async () => {
    await page.getByRole("button", { name: `„${text}“` }).click();
    await expect(page.getByRole("textbox", { name: "Požadavek na plán revizí" })).toHaveValue(text, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

test("ukázkový povel → odznaky, tip „přiberte při jedné cestě“ a rychlá revize dávky v pořadí pochůzky", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/inspections/planner");
  await runCommand(page, "Nářadí a prodlužováky v Hale A do 30 dnů");

  const chips = page.getByLabel("Rozpoznané filtry");
  await expect(chips).toContainText("Období: Do 30 dnů (+ propadlé)");
  await expect(chips).toContainText("Lokace: Hala A");
  await expect(chips).toContainText("Kategorie: Ruční nářadí");
  await expect(chips).toContainText("Kategorie: Prodlužováky");
  await expect(route(page)).toContainText("PP-0031");

  // Svářečka ve stejné dílně končí krátce po okně → tip.
  const tip = page.getByRole("region", { name: /Tip pro optimalizaci výjezdu/ });
  await expect(tip).toContainText("SV-0004");
  await tip.getByRole("listitem").filter({ hasText: "SV-0004" }).getByRole("button", { name: "Přidat do plánu" }).click();
  await expect(route(page)).toContainText("přidáno z tipu");

  // Odebrání odznaku zúží / rozšíří dávku.
  await page.getByRole("button", { name: "Odebrat filtr Kategorie: Ruční nářadí" }).click();
  await expect(chips).not.toContainText("Ruční nářadí");

  const firstTag = await route(page).locator("li a").first().textContent();
  const launch = page.getByRole("link", { name: /Spustit rychlou revizi této dávky \(\d+ ks\)/ });
  await launch.click();
  await expect(page).toHaveURL(/\/inspections\/rapid\?ids=/);
  await expect(page.getByTestId("plan-batch")).toContainText("Dávka z plánovače");
  await expect(page.locator("article[aria-label^='Revize ']")).toHaveAttribute("aria-label", `Revize ${firstTag}`);
});

test("kuchyňka tento měsíc: tip na kus končící příští měsíc, měsíční přehled a pochůzkový list pro tisk", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/inspections/planner");
  const input = page.getByRole("textbox", { name: "Požadavek na plán revizí" });
  await expect(async () => {
    await input.fill("Spotřebiče v kuchyňce tento měsíc");
    await expect(page.getByLabel("Rozpoznané filtry")).toContainText("Zóna: Kuchyňka", { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });

  await expect(route(page)).toContainText("SP-0204");
  await expect(page.getByRole("region", { name: /Tip pro optimalizaci výjezdu/ })).toContainText("SP-0203");

  // Měsíční přehled přepne období.
  await page.getByRole("button", { name: /^Příští měsíc/ }).click();
  await expect(page.getByLabel("Rozpoznané filtry")).toContainText("Období: Příští měsíc");
  await expect(route(page)).toContainText("SP-0203");

  // Pochůzkový list je jen v tisku.
  const sheet = page.locator(".print-route");
  await expect(sheet).toBeHidden();
  await page.emulateMedia({ media: "print" });
  await expect(sheet).toBeVisible();
  await expect(sheet).toContainText("Pochůzkový list revizí");
  await expect(sheet).toContainText("SP-0203");
  await page.emulateMedia({ media: "screen" });
});
