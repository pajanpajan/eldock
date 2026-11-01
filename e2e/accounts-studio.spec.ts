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

/** Bod půdorysu v metrech (rastr 12 × 8 po 6 m: jednotné měřítko 15,909 px/m, obvod od 70 / 80,9 px ve viewBoxu 1200 × 800) → px na obrazovce. */
async function planPoint(page: Page, meters: { x: number; y: number }, nudge = { x: 0, y: 0 }) {
  await page.getByTestId("studio-grid").evaluate((element) => element.scrollIntoView({ block: "center" }));
  const box = (await page.getByTestId("studio-grid").boundingBox())!;
  const k = 1050 / 66;
  const x = 70 + meters.x * k + nudge.x;
  const y = 70 + (690 - 42 * k) / 2 + meters.y * k + nudge.y;
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

test("Studio: rozměr areálu a kóty, místnost tažením s posunem stěny, vrata, měřítko, banery zařízení a přiřazení spotřebiče do místnosti → uložení", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");

  // Krok 1 – šablona, rozměr areálu, umístění a zvětšení budovy tažením (s kótami X / Y)
  await whenReady(
    () => page.getByRole("button", { name: /Výrobní hala \(66 × 42 m/ }).click(),
    () => expect(page.getByTestId("grid-dimensions")).toHaveText("66 m × 42 m", { timeout: 1_000 }),
  );
  await expect(page.getByTestId("grid-axes")).toHaveText("Osa X (šířka): 66 m × Osa Y (hloubka): 42 m");
  await expect(page.getByTestId("floor-add-buttons").getByRole("button").first()).toHaveText(/Přidat nadzemní patro \(NP\)/);
  await expect(page.getByTestId("campus-dim-x")).toContainText("X: 66 m");
  await expect(page.getByTestId("campus-dim-y")).toContainText("Y: 42 m");
  await expect(page.getByTestId("campus-size")).toContainText("Areál 400 × 280 m");
  await whenReady(
    () => page.getByRole("button", { name: "500×350 m" }).click(),
    () => expect(page.getByTestId("campus-size")).toContainText("Areál 500 × 350 m", { timeout: 1_000 }),
  );
  await expect(page.getByTestId("campus-dim-x")).toContainText("X: 66 m");
  await page.getByLabel("Šířka areálu – osa X [m]").fill("400");
  await page.getByLabel("Hloubka areálu – osa Y [m]").fill("280");
  await expect(page.getByTestId("campus-size")).toContainText("Areál 400 × 280 m");
  await page.getByLabel("Název budovy").fill("Hala C - Svařovna");
  const building = page.getByTestId("campus-new-building").locator("rect").first();
  await building.scrollIntoViewIfNeeded();
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
  // Úchyt přichytává velikost na rozteč sloupů → rastr se prodloužil
  await expect(page.getByTestId("grid-dimensions")).not.toHaveText("66 m × 42 m");
  // Zpět na šablonu (rastr 12 × 8) a pokračovat
  await page.getByRole("button", { name: /Výrobní hala \(66 × 42 m/ }).click();
  await page.getByLabel("Název budovy").fill("Hala C - Svařovna");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 2 – měřítko 1:500, místnost tažením (jemný rastr 1 m) s živými kótami, posun stěny, vrata u zdi
  await page.getByRole("radiogroup", { name: "Měřítko zobrazení" }).getByRole("radio", { name: "1:500" }).click();
  await expect(page.getByTestId("studio-grid")).toHaveAttribute("data-scale", "1:500");
  await expect(page.getByTestId("studio-grid-scalebar")).toContainText("M 1:500");
  const start = await planPoint(page, { x: 6, y: 6 });
  const end = await planPoint(page, { x: 30, y: 12 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(page.getByTestId("studio-selection")).toContainText("X: 24 m");
  await expect(page.getByTestId("studio-selection")).toContainText("Y: 6 m");
  await expect(page.getByTestId("draft-size")).toHaveText("24 m × 6 m (144 m²)");
  await page.mouse.up();
  const rooms = page.getByRole("list", { name: "Místnosti a vrata patra" });
  await expect(rooms).toContainText("24 × 6 m");
  await expect(rooms.getByRole("textbox", { name: "Název místnosti 1" })).toHaveValue("Výrobní zóna 1");
  await rooms.getByRole("textbox", { name: "Název místnosti 1" }).fill("Svařovna");
  await expect(page.getByTestId("zone-detail-size")).toContainText("Osa X (šířka): 24 m × Osa Y (hloubka): 6 m");
  // Východní stěna: chytit a posunout o 6 m doprava
  const wallFrom = await planPoint(page, { x: 30, y: 9 });
  const wallTo = await planPoint(page, { x: 36, y: 9 });
  await page.mouse.move(wallFrom.x, wallFrom.y);
  await page.mouse.down();
  await page.mouse.move(wallTo.x, wallTo.y, { steps: 6 });
  await expect(page.getByTestId("zone-dim-x")).toContainText("X: 30 m");
  await page.mouse.up();
  await expect(page.getByTestId("zone-detail-size")).toContainText("Osa X (šířka): 30 m");
  await page.getByRole("radio", { name: /Umístit vrata/ }).click();
  const wall = await planPoint(page, { x: 66, y: 36 }, { x: -6, y: 0 });
  await page.mouse.click(wall.x, wall.y);
  await expect(rooms).toContainText("G12");
  await expect(page.getByTestId("studio-grid")).toContainText("🚪 Vrata 1");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 3 – banery typů, autopilot: rozváděč do jemného rastru, linka uvnitř Svařovny, spotřebič do místnosti
  await expect(page.getByRole("tab", { name: "1. NP" })).toHaveCount(1);
  await expect(page.getByRole("combobox", { name: "Typ zařízení" })).toHaveCount(0);
  await expect(page.getByRole("radio", { name: "Rozváděč" })).toHaveAttribute("aria-checked", "true");
  const boardAt = await planPoint(page, { x: 48, y: 6 });
  await page.mouse.click(boardAt.x, boardAt.y);
  await expect(page.getByTestId("placement-point")).toHaveText("X 48 m · Y 6 m (pole B9)");
  await expect(page.getByLabel("Tag")).toHaveValue("R-C-01");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Hlavní rozváděč Hala C");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("RM1");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue(/^Pole \d+ \/ QF\d+$/);
  await page.getByRole("button", { name: "Osadit R-C-01" }).click();
  await expect(page.getByTestId("eq-banner-count-R")).toHaveText("1");

  await page.getByRole("radio", { name: "Výrobní stroj / Linka" }).click();
  const lineAt = await planPoint(page, { x: 12, y: 9 });
  await page.mouse.click(lineAt.x, lineAt.y);
  await expect(page.getByLabel("Tag")).toHaveValue("ML-03");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Výrobní linka 3 – Svařovna");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("R-C-01");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue("Vývod FA1");
  await expect(page.getByLabel("Místnost / zóna")).toHaveValue("Svařovna");
  await page.getByRole("button", { name: "Osadit ML-03" }).click();

  await page.getByRole("radio", { name: "Spotřebič" }).click();
  const roomAt = await planPoint(page, { x: 24, y: 9 });
  await page.mouse.move(roomAt.x, roomAt.y);
  await expect(page.getByTestId("room-highlight")).toHaveCount(1);
  await page.mouse.click(roomAt.x, roomAt.y);
  await expect(page.getByTestId("placement-room")).toHaveText("Svařovna");
  await expect(page.getByLabel("Místnost / zóna")).toHaveValue("Svařovna");
  await page.getByRole("button", { name: /^Přiřadit SP-\d+ do místnosti$/ }).click();
  await expect(page.getByTestId("room-inventory")).toHaveText("🔌 1× Spotřebič");

  await expect(page.getByTestId("studio-draft-pin")).toHaveCount(2);
  await expect(page.locator('[data-spider-link="R-C-01>ML-03"]')).toHaveCount(1);
  await expect(page.getByTestId("studio-legend")).toContainText("Ruční nářadí");

  await page.getByRole("button", { name: "Uložit budovu do závodu" }).click();
  await expect(toast(page)).toContainText("Budova uložena do závodu");
  await expect(page).toHaveURL(/\/floor\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1. NP - Hlavní výroba");
  await expect(pin(page, "ML-03")).toBeVisible();
  await expect(pin(page, "R-C-01")).toBeVisible();
});
