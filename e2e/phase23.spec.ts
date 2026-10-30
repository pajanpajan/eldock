import { expect, test } from "@playwright/test";

import { startAsAccount } from "./helpers";

// Moduly a tarify testuje phase25.spec.ts; tady terénní pohled a zákres nad PDF z auditu fáze 23.

test("terénní pohled směnového údržbáře: rychlé akce bez manažerských tabulek", async ({ page }) => {
  await startAsAccount(page, "acc-svoboda");
  await page.goto("/app");
  await expect(page.getByTestId("field-hint")).toBeVisible();
  await expect(page.getByRole("region", { name: "Souhrn závodu" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Hlavní navigace" })).toHaveCount(0);

  await page.goto("/equipment/eq-r-ml-01");
  const actions = page.getByTestId("field-quick-actions");
  await expect(actions.getByRole("link", { name: "Schéma" })).toBeVisible();
  await expect(actions.getByRole("link", { name: "QR štítek" })).toBeVisible();
  await expect(actions.getByRole("link", { name: /Nahlásit změnu|Doplnit ke změně/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /LOTO – bezpečné odpojení/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Pasport/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Revize & Lhůtník/ })).toHaveCount(0);
});

test("zákres u PDF revize: průvodce vykreslí stránku PDF místo rozbitého obrázku", async ({ page }) => {
  await startAsAccount(page, "acc-svoboda");
  await page.goto("/equipment/eq-rh1/change-request");
  await expect(page.getByRole("img", { name: /Schéma RH1 v1\.0/ })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
});
