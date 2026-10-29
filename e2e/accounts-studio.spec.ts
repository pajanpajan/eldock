import { expect, test, type Page } from "@playwright/test";

import { pin, startAs, startAsAccount, switchAccount, toast } from "./helpers";

// Fáze 17–18: výřezy dat podle účtu, správa podúčtů, pavouk napájení, nový areál a 3krokové Studio.

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

/** Bod v rastru 12 × 8 (viewBox 1200 × 800, okraj 70 px) → pozice v plátně v px. */
async function gridPosition(page: Page, kind: "axis" | "cell", row: number, col: number) {
  const box = (await page.getByTestId("studio-grid").boundingBox())!;
  const step = { x: 1050 / 11, y: 690 / 7 };
  const offset = kind === "cell" ? 0.5 : 0;
  const x = 70 + (col + offset) * step.x;
  const y = 70 + (row + offset) * step.y;
  return { x: box.x + (x / 1200) * box.width, y: box.y + (y / 800) * box.height };
}

test("nový areál z přepínače závodů a tlačítko Přidat budovu do areálu", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/plant/plant-jbc");
  await whenReady(
    () => page.getByRole("button", { name: "Přepnout závod" }).click(),
    () => expect(page.getByRole("menuitem", { name: /Přidat nový areál/ })).toBeVisible({ timeout: 1_000 }),
  );
  await page.getByRole("menuitem", { name: /Přidat nový areál/ }).click();
  await page.getByLabel("Název areálu").fill("Závod Turnov – Optika");
  await page.getByLabel("Kód", { exact: true }).fill("TUR");
  await page.getByLabel("Město / adresa").fill("Nádražní 15, Turnov");
  await page.getByRole("button", { name: "Založit areál" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Závod Turnov – Optika");
  await expect(page.getByText("Areál zatím nemá žádné budovy")).toBeVisible();
  await page.getByRole("link", { name: "Přidat budovu do areálu" }).click();
  await expect(page).toHaveURL(/\/studio\?plant=/);
  await expect(page.getByTestId("campus-new-building")).toBeVisible();
});

test("Studio: šablona a umístění tažením → místnost tažením B2–B5 a vrata u zdi → autopilot osazení → uložení", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");

  // Krok 1 – šablona, umístění a zvětšení budovy tažením v areálu
  await whenReady(
    () => page.getByRole("button", { name: /Výrobní hala \(66 × 42 m/ }).click(),
    () => expect(page.getByTestId("grid-dimensions")).toHaveText("66 m × 42 m", { timeout: 1_000 }),
  );
  await page.getByLabel("Název budovy").fill("Hala C - Svařovna");
  const building = page.getByTestId("campus-new-building").locator("rect").first();
  const before = (await building.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 40, before.y + before.height / 2 + 20, { steps: 5 });
  await page.mouse.up();
  const moved = (await building.boundingBox())!;
  expect(Math.round(moved.x)).not.toBe(Math.round(before.x));
  const handle = (await page.getByTestId("campus-resize-handle").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 30, { steps: 5 });
  await page.mouse.up();
  expect((await building.boundingBox())!.width).toBeGreaterThan(moved.width);
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 2 – místnost tažením přes buňky B2 → B5 (jedna řada = platný pás) a vrata kliknutím u zdi
  const start = await gridPosition(page, "cell", 1, 1);
  const end = await gridPosition(page, "cell", 1, 4);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 6 });
  await expect(page.getByTestId("studio-selection")).toContainText("B2–B5");
  await page.mouse.up();
  const rooms = page.getByRole("list", { name: "Místnosti a vrata patra" });
  await expect(rooms).toContainText("B2–B5");
  await expect(rooms.getByRole("textbox", { name: "Název místnosti 1" })).toHaveValue("Výrobní zóna 1");
  await rooms.getByRole("textbox", { name: "Název místnosti 1" }).fill("Svařovna");
  await page.getByRole("radio", { name: /Umístit vrata/ }).click();
  const wall = await gridPosition(page, "axis", 6, 11);
  await page.mouse.click(wall.x - 6, wall.y);
  await expect(rooms).toContainText("G12");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 3 – autopilot: rozváděč (napájení z hlavního RM1) a linka uvnitř Svařovny
  await expect(page.getByRole("tab", { name: "1. NP" })).toHaveCount(1);
  const boardAt = await gridPosition(page, "axis", 1, 8);
  await page.mouse.click(boardAt.x, boardAt.y);
  await expect(page.getByTestId("placement-point")).toHaveText("B9");
  await expect(page.getByLabel("Tag")).toHaveValue("R-C-01");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Hlavní rozváděč Hala C");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("RM1");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue(/^Pole \d+ \/ QF\d+$/);
  await page.getByRole("button", { name: "Osadit R-C-01" }).click();

  await page.getByLabel("Typ zařízení").selectOption("PRODUCTION_LINE");
  const lineAt = await gridPosition(page, "axis", 1, 2);
  await page.mouse.click(lineAt.x, lineAt.y);
  await expect(page.getByLabel("Tag")).toHaveValue("ML-03");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Výrobní linka 3 – Svařovna");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("R-C-01");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue("Vývod FA1");
  await expect(page.getByLabel("Místnost / zóna")).toHaveValue("Svařovna");
  await page.getByRole("button", { name: "Osadit ML-03" }).click();

  await expect(page.getByTestId("studio-draft-pin")).toHaveCount(2);
  await expect(page.locator('[data-spider-link="R-C-01>ML-03"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Uložit budovu do závodu" }).click();
  await expect(toast(page)).toContainText("Budova uložena do závodu");
  await expect(page).toHaveURL(/\/floor\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1. NP - Hlavní výroba");
  await expect(pin(page, "ML-03")).toBeVisible();
  await expect(pin(page, "R-C-01")).toBeVisible();
});
