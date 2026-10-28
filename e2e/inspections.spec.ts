import { expect, test } from "@playwright/test";

import { pin, startAs, toast } from "./helpers";

// Fáze 14: vrstvy půdorysu, rychlá revize spotřebiče a hromadná revize.

const HALL_A_1NP = "/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np";

test("vrstvy půdorysu skrývají spotřebiče a přepínač ⚠️ ukáže jen propadlé / končící", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto(HALL_A_1NP);

  // Výchozí: rozváděče a stroje ano, nářadí ne.
  await expect(pin(page, "R-CNC-04")).toBeVisible();
  await expect(pin(page, "NR-0112")).toHaveCount(0);

  await page.getByRole("checkbox", { name: /Ruční nářadí a svářečky/ }).check();
  await expect(pin(page, "NR-0112")).toBeVisible();
  await expect(pin(page, "SV-0004")).toBeVisible();

  await page.getByRole("button", { name: /Zobrazit vše s propadlou \/ končící revizí/ }).click();
  await expect(page.locator("button.pin-button")).toHaveCount(3);
  await expect(pin(page, "PP-0031")).toHaveAttribute("aria-label", /REVIZE PROPADLÁ před 21 dny/);
  await expect(pin(page, "NR-0087")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Zařízení patra" })).toContainText("Revize končí za 9 dní");
});

test("rychlá revize: VYHOVUJE uloží kus jedním klikem a přejde na další", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/inspections/rapid");
  const card = page.locator("article[aria-label^='Revize ']");
  // Výběr místnosti až po hydrataci (dev server může stránku ještě kompilovat).
  await expect(async () => {
    await page.locator("#rapid-zone").selectOption("Kuchyňka – Energetika 1. NP");
    await expect(card).toHaveAttribute("aria-label", "Revize SP-0201", { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await expect(card).toContainText("REVIZE PROPADLÁ před 5 dny");

  await card.getByRole("button", { name: /^VYHOVUJE/ }).click();
  await expect(toast(page)).toContainText("SP-0201 VYHOVUJE");
  await expect(card).not.toHaveAttribute("aria-label", "Revize SP-0201");

  // Nevyhovující měření zablokuje VYHOVUJE.
  await card.getByLabel(/iso/).fill("0,4");
  await expect(card.getByRole("button", { name: /^VYHOVUJE/ })).toBeDisabled();

  await page.goto("/equipment/eq-sp-0201");
  await expect(page.getByRole("tab")).toHaveText(["Revize & Měření (ČSN 33 1600 ed. 2)"]);
  await expect(page.getByRole("heading", { level: 1 }).locator("..")).toContainText("Revize platná do");
});

test("hromadná revize v přehledu revizí zezelená vybrané položky", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/inspections");
  await page.getByRole("checkbox", { name: "Vybrat NR-0112 pro hromadnou revizi" }).check();
  await page.getByRole("checkbox", { name: "Vybrat R-CNC-04 pro hromadnou revizi" }).check();
  await page.getByRole("button", { name: "Zapsat hromadnou revizi (2 vybráno)" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("ČSN 33 1600 ed. 2");
  await dialog.getByRole("button", { name: "Zapsat 2 položky" }).click();
  await expect(toast(page)).toContainText("Hromadná revize zapsána: 2 položky");

  await page.goto("/equipment/eq-r-cnc-04?tab=inspections");
  await expect(page.getByRole("region", { name: "Stav elektrorevize" })).toContainText("Revize platná");
});
