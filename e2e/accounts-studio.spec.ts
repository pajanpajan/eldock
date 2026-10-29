import { expect, test } from "@playwright/test";

import { pin, startAs, startAsAccount, switchAccount, toast } from "./helpers";

// Fáze 17: výřezy dat podle účtu, správa podúčtů, pavouk napájení a Studio výstavby závodu.

const HALL_A_1NP = "/plant/plant-jbc/building/bld-jbc-a/floor/floor-jbc-a-1np";
const HALL_B_1NP = "/plant/plant-jbc/building/bld-jbc-b/floor/floor-jbc-b-1np";

/** Akce až po hydrataci (studený dev server může stránku ještě přenačíst). */
async function whenReady(action: () => Promise<void>, check: () => Promise<void>) {
  await expect(async () => {
    await action();
    await check();
  }).toPass({ timeout: 30_000 });
}

test("revizní technik VTZ nevidí spotřebiče ani nářadí – mapa, detail, plánovač, rychlá revize", async ({ page }) => {
  await startAsAccount(page, "acc-kovar");
  await page.goto(HALL_A_1NP);
  await expect(page.getByTestId("account-scope")).toContainText("Revizní technik VTZ");
  await expect(pin(page, "R-CNC-04")).toBeVisible();
  await expect(page.getByRole("checkbox", { name: /Ruční nářadí a svářečky/ })).toHaveCount(0);
  await whenReady(
    () => page.getByRole("button", { name: /Zobrazit vše s propadlou/ }).click(),
    () => expect(pin(page, "R-CNC-04")).toBeVisible({ timeout: 1_000 }),
  );
  await expect(pin(page, "PP-0031")).toHaveCount(0);
  await expect(pin(page, "NR-0112")).toHaveCount(0);

  await page.goto("/equipment/eq-sp-0201");
  await expect(page.getByText("SP-0201 není ve výřezu vašeho účtu")).toBeVisible();

  await page.goto("/inspections/planner");
  await whenReady(
    () => page.getByRole("button", { name: "„Propadlé a tento měsíc v celém závodě“" }).click(),
    () => expect(page.getByLabel("Rozpoznané filtry")).toContainText("Tento měsíc", { timeout: 1_000 }),
  );
  await expect(page.getByRole("region", { name: /Pochůzka/ })).toContainText("R-ML-01");
  await expect(page.getByRole("region", { name: /Pochůzka/ })).not.toContainText("SP-0201");

  await page.goto("/inspections/rapid");
  await expect(page.getByText(/nemá oprávnění/)).toBeVisible();
});

test("CAE projektant nevidí lhůtník revizí", async ({ page }) => {
  await startAs(page, "CAE_ENGINEER");
  await page.goto("/plant/plant-jbc");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Závod Jablonec");
  await expect(page.getByText("Hlídač elektrorevizí (Lhůtník)")).toHaveCount(0);
  await page.goto("/equipment/eq-r-ml-01");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("R-ML-01");
  await expect(page.getByText(/REVIZE PROPADLÁ/)).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Revize & Lhůtník/ })).toHaveCount(0);
});

test("přepínač účtů a správa podúčtů technického ředitele", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/plant/plant-jbc");
  await switchAccount(page, "Ing. Martin Dvořák");
  await page.goto("/admin/users");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Správa podúčtů");
  await expect(page.getByRole("table")).toContainText("Milan Černý");

  await page.getByLabel("Jméno a příjmení").fill("Lukáš Beneš");
  await page.getByLabel("E-mail").fill("lukas.benes@jbl-automotive.example");
  await page.getByRole("radio", { name: /Směnový údržbář/ }).click();
  await page.getByRole("button", { name: "Založit podúčet" }).click();
  await expect(toast(page)).toContainText("Podúčet Lukáš Beneš založen");
  await expect(page.getByRole("table")).toContainText("Lukáš Beneš");
});

test("pavouk napájení vykreslí topologii Haly B", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto(HALL_B_1NP);
  const toggle = page.getByRole("button", { name: /Zobrazit pavouka napájení/ });
  await whenReady(
    () => toggle.click(),
    () => expect(page.getByTestId("power-spider")).toBeVisible({ timeout: 1_000 }),
  );
  await expect(page.locator('[data-spider-link="R-ML-01>ML-01"]')).toHaveCount(1);
  await expect(page.locator('[data-spider-link="R-ML-01>ROB-07"]')).toHaveCount(1);
  await expect(page.locator('[data-spider-link="RM1>R-ML-01"]')).toHaveCount(1);
});

test("Studio: rastr → budova a patra → místnosti → zařízení s napájením → uložení", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");

  // Krok 1 – rastr
  await whenReady(
    () => page.getByLabel(/Vodorovné osy/).fill("10"),
    () => expect(page.getByTestId("grid-dimensions")).toHaveText("54 m × 42 m", { timeout: 1_000 }),
  );
  await page.getByLabel(/Svislé osy/).fill("6");
  await expect(page.getByTestId("grid-dimensions")).toHaveText("54 m × 30 m");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 2 – budova a patra
  await page.getByLabel("Název budovy").fill("Hala C - Svařovna");
  await page.getByLabel("Využití patra 1. NP").fill("Svařovací linky");
  await page.getByRole("button", { name: "Přidat podzemní patro (PP)" }).click();
  await expect(page.getByLabel("Využití patra 1. PP")).toBeVisible();
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 3 – místnost a vrata
  await page.getByLabel(/^Od/).fill("A1");
  await page.getByLabel(/^Do/).fill("C5");
  await page.getByLabel("Název místnosti / zóny").fill("Svařovací linka 1");
  await page.getByRole("button", { name: "Přidat místnost" }).click();
  await page.getByLabel("Osa vrat").fill("C10");
  await page.getByRole("button", { name: "Přidat vrata" }).click();
  await expect(page.getByRole("list", { name: "Místnosti a vrata patra" })).toContainText("Svařovací linka 1");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 4 – rozváděč napájený z RM1 a linka z nového rozváděče
  await page.getByRole("tab", { name: "1. NP ✦" }).click();
  await page.getByLabel("Průsečík", { exact: true }).fill("B9");
  await page.getByLabel("Typ zařízení").selectOption("SWITCHBOARD");
  await page.getByLabel("Tag").fill("R-SV-01");
  await page.getByLabel("Název", { exact: true }).fill("Rozváděč svařovny");
  await page.getByLabel("Napájeno z").selectOption({ label: "RM1" });
  await expect(page.getByLabel("Pole / jistič / okruh")).not.toHaveValue("");
  await page.getByRole("button", { name: "Osadit zařízení" }).click();

  await page.getByLabel("Průsečík", { exact: true }).fill("B3");
  await page.getByLabel("Typ zařízení").selectOption("PRODUCTION_LINE");
  await page.getByLabel("Tag").fill("SVL-01");
  await page.getByLabel("Název", { exact: true }).fill("Svařovací linka");
  await page.getByLabel("Napájeno z").selectOption({ label: "R-SV-01 (toto patro) ✦ nový" });
  await expect(page.getByLabel("Pole / jistič / okruh")).toHaveValue("Vývod FA1");
  await page.getByRole("button", { name: "Osadit zařízení" }).click();

  await expect(page.getByTestId("studio-draft-pin")).toHaveCount(2);
  await expect(page.locator('[data-spider-link="R-SV-01>SVL-01"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Uložit budovu do závodu" }).click();
  await expect(toast(page)).toContainText("Budova uložena do závodu");
  await expect(page).toHaveURL(/\/floor\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1. NP - Svařovací linky");
  await expect(pin(page, "SVL-01")).toBeVisible();
  await expect(pin(page, "R-SV-01")).toBeVisible();
});
