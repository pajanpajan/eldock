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

test("Studio: budova v metrech, více budov v konceptu, místnost s posunem stěny a Zpět/Vpřed, vrata, kontextový krok 3 s produktovými banery, vlastní nabídkou, součty v místnostech a úpravou → uložení", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");

  // Výchozí obrazovka = čistá mapa závodu bez konceptu nové budovy; průvodce areálem až po kliknutí
  await expect(page.getByTestId("studio-map-hint")).toHaveText("Klikněte na libovolnou budovu pro správu jejího vybavení a místností.");
  await expect(page.getByTestId("campus-new-building")).toHaveCount(0);
  await expect(page.getByText("Krok 1:")).toHaveCount(0);
  await whenReady(
    () => page.getByRole("button", { name: "✏️ Upravit areál / + Přidat budovu" }).click(),
    () => expect(page.getByTestId("campus-new-building")).toBeVisible({ timeout: 1_000 }),
  );

  // Krok 1 – šablona, rozměr areálu a budovy v metrech, posun a zvětšení tažením (s kótami X / Y)
  await whenReady(
    () => page.getByRole("button", { name: /Výrobní hala \(66 × 42 m/ }).click(),
    () => expect(page.getByTestId("grid-dimensions")).toHaveText("66 m × 42 m", { timeout: 1_000 }),
  );
  await expect(page.getByTestId("grid-axes")).toHaveText("Osa X (šířka): 66 m × Osa Y (hloubka): 42 m");
  await expect(page.getByTestId("floor-add-buttons").getByRole("button").first()).toHaveText(/Přidat nadzemní patro \(NP\)/);
  await expect(page.getByTestId("campus-dim-x")).toContainText("X: 66 m");
  await expect(page.getByTestId("campus-size")).toContainText("Areál 400 × 280 m");
  await whenReady(
    () => page.getByRole("button", { name: "500×350 m" }).click(),
    () => expect(page.getByTestId("campus-size")).toContainText("Areál 500 × 350 m", { timeout: 1_000 }),
  );
  await page.getByLabel("Šířka areálu – osa X [m]").fill("400");
  await page.getByLabel("Hloubka areálu – osa Y [m]").fill("280");
  await expect(page.getByTestId("campus-size")).toContainText("Areál 400 × 280 m");

  // Rozměr budovy přímo v metrech – bez limitu 20 × 16 os (114 × 90 m), osy se dopočítají
  await page.getByLabel("Šířka budovy – osa X [m]").fill("114");
  await page.getByLabel("Šířka budovy – osa X [m]").press("Enter");
  await page.getByLabel("Hloubka budovy – osa Y [m]").fill("90");
  await page.getByLabel("Hloubka budovy – osa Y [m]").press("Enter");
  await expect(page.getByTestId("grid-dimensions")).toHaveText("114 m × 90 m");
  await expect(page.getByTestId("campus-dim-x")).toContainText("X: 114 m");
  await expect(page.getByTestId("grid-advanced")).toContainText("osy 1–20 × A–P");

  const building = page.getByTestId("campus-new-building").locator("rect").first();
  await building.scrollIntoViewIfNeeded();
  const before = (await building.boundingBox())!;
  await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
  await page.mouse.down();
  await page.mouse.move(before.x + before.width / 2 + 30, before.y + before.height / 2 + 15, { steps: 5 });
  await page.mouse.up();
  const moved = (await building.boundingBox())!;
  expect(Math.round(moved.x)).not.toBe(Math.round(before.x));
  const handle = (await page.getByTestId("campus-resize-handle").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 30, { steps: 5 });
  await page.mouse.up();
  await expect(page.getByTestId("grid-dimensions")).not.toHaveText("114 m × 90 m");

  // Zpět na šablonu 66 × 42 m a název
  await page.getByRole("button", { name: /Výrobní hala \(66 × 42 m/ }).click();
  await page.getByLabel("Název budovy").fill("Hala C - Svařovna");

  // Druhá budova konceptu: přidat, zkontrolovat přepínač a vrátit se k první
  await page.getByTestId("building-switcher").getByRole("button", { name: "Přidat další budovu" }).click();
  const switcher = page.getByTestId("building-switcher");
  await expect(switcher.getByRole("tab")).toHaveCount(2);
  await expect(switcher.getByRole("tab", { selected: true })).toContainText("Hala D");
  await expect(page.getByTestId("campus-concept-building")).toHaveCount(1);
  await switcher.getByRole("tab", { name: /Hala C/ }).click();
  await expect(page.getByLabel("Název budovy")).toHaveValue("Hala C - Svařovna");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 2 – bez šablon rozdělení patra; místnost tažením s kótami, posun stěny, Zpět / Vpřed, vrata u zdi
  await expect(page.getByText("Rozdělit patro šablonou")).toHaveCount(0);
  await page.getByRole("radiogroup", { name: "Měřítko zobrazení" }).getByRole("radio", { name: "1:500" }).click();
  await expect(page.getByTestId("studio-grid")).toHaveAttribute("data-scale", "1:500");
  const start = await planPoint(page, { x: 6, y: 6 });
  const end = await planPoint(page, { x: 30, y: 12 });
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await expect(page.getByTestId("studio-selection")).toContainText("X: 24 m");
  await expect(page.getByTestId("draft-size")).toHaveText("24 m × 6 m (144 m²)");
  await page.mouse.up();
  const rooms = page.getByRole("list", { name: "Místnosti a vrata patra" });
  await expect(rooms).toContainText("24 × 6 m");
  await rooms.getByRole("textbox", { name: "Název místnosti 1" }).fill("Svařovna");
  const wallFrom = await planPoint(page, { x: 30, y: 9 });
  const wallTo = await planPoint(page, { x: 36, y: 9 });
  await page.mouse.move(wallFrom.x, wallFrom.y);
  await page.mouse.down();
  await page.mouse.move(wallTo.x, wallTo.y, { steps: 6 });
  await expect(page.getByTestId("zone-dim-x")).toContainText("X: 30 m");
  await page.mouse.up();
  await expect(page.getByTestId("zone-detail-size")).toContainText("Osa X (šířka): 30 m");
  // Zpět vrátí posun stěny (24 m), Vpřed ho znovu provede (30 m)
  await page.getByTestId("zone-history").getByRole("button", { name: "Zpět (Ctrl+Z)" }).click();
  await expect(page.getByTestId("zone-detail-size")).toContainText("Osa X (šířka): 24 m");
  await page.getByTestId("zone-history").getByRole("button", { name: "Vpřed (Ctrl+Y)" }).click();
  await expect(page.getByTestId("zone-detail-size")).toContainText("Osa X (šířka): 30 m");
  await page.getByRole("radio", { name: /Umístit vrata/ }).click();
  const wall = await planPoint(page, { x: 66, y: 36 }, { x: -6, y: 0 });
  await page.mouse.click(wall.x, wall.y);
  await expect(rooms).toContainText("G12");
  await page.getByRole("button", { name: "Další krok" }).click();

  // Krok 3 – 1) místnost, 2) kategorie, 3) produktový banner a vložení
  await expect(page.getByRole("tab", { name: "1. NP" })).toHaveCount(1);
  await page.getByRole("radiogroup", { name: "Místnosti patra" }).getByRole("radio", { name: "Svařovna" }).click();
  await expect(page.getByTestId("room-selected")).toHaveCount(1);
  await page.getByRole("radio", { name: "Rozváděč", exact: true }).click();
  await page.getByRole("radio", { name: "Podružný / Patrový rozváděč (RP)" }).click();
  await expect(page.getByLabel("Tag", { exact: true })).toHaveValue("R-C-01");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Podružný rozváděč – Svařovna");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("RM1");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue(/^Pole \d+ \/ QF\d+$/);
  // vložení klikem do jemného rastru uvnitř místnosti
  const boardAt = await planPoint(page, { x: 30, y: 9 });
  await page.mouse.click(boardAt.x, boardAt.y);
  await expect(toast(page)).toContainText("R-C-01 vloženo do místnosti Svařovna");
  await expect(page.getByTestId("eq-banner-count-R")).toHaveText("1");

  await page.getByRole("radio", { name: "Výrobní stroj / Linka" }).click();
  await page.getByRole("radio", { name: "Lisovací linka", exact: true }).click();
  await expect(page.getByLabel("Tag", { exact: true })).toHaveValue("ML-03");
  await expect(page.getByLabel("Název", { exact: true })).toHaveValue("Lisovací linka – Svařovna");
  await expect(page.getByLabel("Napájeno z").locator("option:checked")).toHaveText("R-C-01");
  await expect(page.getByLabel("Vývod / okruh")).toHaveValue("Vývod FA1");
  await page.getByRole("button", { name: "Vložit ML-03 do místnosti Svařovna" }).click();
  // filtr půdorysu: rozváděč je při kategorii „Výrobní stroj / Linka“ ztlumený
  await expect(page.getByTestId("studio-draft-pin").filter({ hasText: "R-C-01" })).toHaveCSS("opacity", "0.2");
  await page.getByRole("button", { name: "Zobrazit vše" }).click();
  await expect(page.getByTestId("studio-draft-pin").filter({ hasText: "R-C-01" })).toHaveCSS("opacity", "1");
  await expect(page.locator('[data-spider-link="R-C-01>ML-03"]')).toHaveCount(1);

  await page.getByRole("radio", { name: "Spotřebič", exact: true }).click();
  await page.getByRole("radio", { name: "Kávovar / Rychlovarná konvice" }).click();
  await page.getByRole("button", { name: /^Vložit SP-\d+ do místnosti Svařovna$/ }).click();
  const svarovna = page.locator('[data-testid="room-inventory"][data-room="Svařovna"]');
  await expect(svarovna.getByTestId("room-chip")).toHaveText(["☕ 1× Kávovar"]);

  // Upravit nabídku: dlaždici rozdělit na „Kávovar“ (prefix KAV) a vlastní „Rychlovarná konvice“ (prefix RK)
  await page.getByTestId("menu-edit-templates").click();
  const editor = page.getByTestId("template-editor");
  await expect(editor.getByLabel("Název dlaždice 2")).toHaveValue("Kávovar / Rychlovarná konvice");
  await editor.getByLabel("Název dlaždice 2").fill("Kávovar");
  await editor.getByLabel("Prefix tagu dlaždice 2").fill("KAV");
  await page.getByTestId("menu-edit-templates").click();
  await page.getByRole("button", { name: "Přidat vlastní dlaždici" }).click();
  await page.getByLabel("Ikona nové dlaždice").fill("🫖");
  await page.getByLabel("Název nové dlaždice").fill("Rychlovarná konvice");
  await page.getByLabel("Prefix tagu nové dlaždice").fill("RK");
  await page.getByRole("button", { name: "Uložit dlaždici" }).click();
  await expect(page.getByLabel("Tag", { exact: true })).toHaveValue("RK01");
  await page.getByRole("button", { name: "Vložit RK01 do místnosti Svařovna" }).click();
  await page.getByRole("radio", { name: "Kávovar", exact: true }).click();
  await expect(page.getByLabel("Tag", { exact: true })).toHaveValue("KAV01");
  await page.getByRole("button", { name: "Vložit KAV01 do místnosti Svařovna" }).click();
  // součty přímo v místnosti podle názvu přístroje
  await expect(svarovna.getByTestId("room-chip")).toHaveText(["☕ 2× Kávovar", "🫖 1× Rychlovarná konvice"]);
  // nabídka se pamatuje v prohlížeči i v nastavení tenantu
  expect(await page.evaluate(() => localStorage.getItem("eldock.studio.menu"))).toContain("Rychlovarná konvice");

  // Upravit stávající: seskupené řádky, rychlé + / − (další tag v řadě) a rozbalení na kusy
  await page.getByRole("radio", { name: /Upravit stávající \(3\)/ }).click();
  const kavovar = page.getByTestId("existing-list").locator('[data-testid="group-row"][data-group="Kávovar"]');
  await expect(kavovar.getByTestId("group-count")).toHaveText("(2×)");
  await page.getByRole("button", { name: "Přidat kus: Kávovar" }).click();
  await expect(toast(page)).toContainText("KAV02 přidáno");
  await expect(kavovar.getByTestId("group-count")).toHaveText("(3×)");
  await expect(svarovna.getByTestId("room-chip").first()).toHaveText("☕ 3× Kávovar");
  await page.getByRole("button", { name: "Ubrat kus: Kávovar" }).click();
  await expect(kavovar.getByTestId("group-count")).toHaveText("(2×)");
  await page.getByRole("button", { name: "Rozbalit: Kávovar" }).click();
  await expect(page.getByRole("list", { name: "Kusy: Kávovar" }).getByRole("button", { name: /KAV01/ })).toBeVisible();
  await expect(page.getByRole("list", { name: "Kusy: Kávovar" }).getByRole("button", { name: /KAV02/ })).toHaveCount(0);

  // Přejmenování kategorie v nabídce (legenda i banner)
  await page.getByTestId("menu-edit-categories").click();
  await page.getByLabel("Název kategorie: Spotřebič").fill("Spotřebiče a kuchyňky");
  await page.getByTestId("menu-edit-categories").click();
  await expect(page.getByTestId("studio-legend")).toContainText("Spotřebiče a kuchyňky");
  await expect(page.getByRole("radio", { name: "Spotřebiče a kuchyňky" })).toBeVisible();

  // Upravit stávající: linka ML-03 – nový název, uložení; Zpět vrátí změnu
  await page.getByRole("radio", { name: "Výrobní stroj / Linka" }).click();
  await page.getByRole("radio", { name: /Upravit stávající \(1\)/ }).click();
  await page.getByRole("button", { name: "Rozbalit: Lisovací linka" }).click();
  await page.getByTestId("existing-list").getByRole("button", { name: /ML-03/ }).click();
  await page.getByLabel("Název zařízení").fill("Lisovací linka 400 t");
  await page.getByRole("button", { name: "Uložit změny" }).click();
  await expect(page.getByTestId("existing-list")).toContainText("Lisovací linka 400 t");
  await page.getByTestId("placement-history").getByRole("button", { name: "Zpět (Ctrl+Z)" }).click();
  await expect(page.getByTestId("existing-list")).toContainText("Lisovací linka – Svařovna");
  await page.getByTestId("placement-history").getByRole("button", { name: "Vpřed (Ctrl+Y)" }).click();
  await expect(page.getByTestId("existing-list")).toContainText("Lisovací linka 400 t");
  await expect(page.getByTestId("studio-legend")).toContainText("Ruční nářadí");

  // Uložení obou budov konceptu v jedné transakci
  await page.getByRole("button", { name: "Uložit 2 budovy do závodu" }).click();
  await expect(toast(page)).toContainText("Uloženo 2 budovy do závodu");
  await expect(page).toHaveURL(/\/floor\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("1. NP - Hlavní výroba");
  await expect(pin(page, "ML-03")).toBeVisible();
  await expect(pin(page, "R-C-01")).toBeVisible();
  // seskupené štítky jsou i v uloženém půdorysu patra (mimo Studio)
  await expect(page.locator("svg text", { hasText: "☕ 2× Kávovar" })).toHaveCount(1);
  await expect(page.locator("svg text", { hasText: "🫖 1× Rychlovarná konvice" })).toHaveCount(1);
});

test("Studio: mapa závodu → klik na budovu → zařízení patra (přidání, přesun do jiné místnosti, smazání s potvrzením) → uložení změn patra", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/studio");

  // Klik na budovu v mapě závodu otevře rovnou zařízení přízemí (bez kroku 1)
  await whenReady(
    () => page.getByRole("button", { name: "Otevřít budovu: Administrativa" }).click(),
    () => expect(page.getByTestId("building-title")).toContainText("Administrativa", { timeout: 1_000 }),
  );
  await expect(page.getByTestId("building-bar").getByRole("tab", { name: "1. NP", selected: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Režim práce s budovou" }).getByRole("tab", { selected: true })).toContainText("Zařízení a napájení");
  // stávající zařízení i seskupené štítky ze seedu (metrová architektura vzorového závodu)
  await expect(page.getByTestId("studio-existing-pin").filter({ hasText: "RP-ADM1" })).toBeVisible();
  const kitchen = page.locator('[data-testid="room-inventory"][data-room="Kuchyňka"]');
  // stejný počet kusů → česká abeceda (ch až za h)
  await expect(kitchen.getByTestId("room-chip")).toHaveText(["🧊 1× Chladnička", "☕ 1× Kávovar", "🔌 1× Prodlužovací přívod", "🫖 1× Rychlovarná konvice"]);
  await expect(page.locator('[data-testid="room-inventory"][data-room="Kanceláře mistrů"]').getByTestId("room-chip").first()).toHaveText("🖥️ 4× PC sestava");

  // Kuchyňka → Spotřebič → Upravit stávající: + další kávovar
  await page.getByRole("radiogroup", { name: "Místnosti patra" }).getByRole("radio", { name: "Kuchyňka" }).click();
  // kategorie může mít z předchozího testu vlastní název („Spotřebiče a kuchyňky“) – nabídka je tenantová
  await page.getByTestId("eq-banner-SP").click();
  await page.getByRole("radio", { name: /Upravit stávající \(4\)/ }).click();
  await page.getByRole("button", { name: "Přidat kus: Kávovar" }).click();
  await expect(toast(page)).toContainText("přidáno – Kávovar (2×)");
  await expect(kitchen.getByTestId("room-chip").first()).toHaveText("☕ 2× Kávovar");

  // Uložená konvice do jiné místnosti (Kancelář údržby)
  await page.getByRole("button", { name: "Rozbalit: Rychlovarná konvice" }).click();
  await page.getByRole("list", { name: "Kusy: Rychlovarná konvice" }).getByRole("button", { name: /SP-0522/ }).click();
  await page.getByTestId("edit-form").getByLabel("Místnost").selectOption("Kancelář údržby");
  await page.getByTestId("edit-form").getByRole("button", { name: "Uložit změny" }).click();
  await expect(page.locator('[data-testid="room-inventory"][data-room="Kancelář údržby"]').getByTestId("room-chip")).toContainText(["🫖 1× Rychlovarná konvice"]);

  // Smazání uložené chladničky s potvrzením (smaže se až při uložení)
  await page.getByRole("button", { name: "Rozbalit: Chladnička" }).click();
  await page.getByRole("list", { name: "Kusy: Chladnička" }).getByRole("button", { name: /SP-0523/ }).click();
  await page.getByTestId("edit-form").getByRole("button", { name: "Smazat" }).click();
  await page.getByTestId("confirm-delete").getByRole("button", { name: "Ano, smazat" }).click();
  await expect(page.getByTestId("pending-deletes")).toContainText("SP-0523");
  await expect(kitchen.getByTestId("room-chip")).toHaveText(["☕ 2× Kávovar", "🔌 1× Prodlužovací přívod"]);
  await expect(page.getByTestId("pending-changes")).toHaveText("Neuložené změny: 3");

  // Uložit změny patra → potvrzení smazání → zůstává se ve Studiu nad stejnou budovou
  await page.getByRole("button", { name: "Uložit změny patra" }).click();
  await expect(page.getByTestId("confirm-save-deletes")).toContainText("SP-0523");
  await page.getByRole("button", { name: "Ano, uložit a smazat" }).click();
  await expect(toast(page)).toContainText("Změny budovy Administrativa uloženy");
  await expect(page.getByTestId("pending-changes")).toHaveText("Bez neuložených změn");
  await expect(kitchen.getByTestId("room-chip")).toHaveText(["☕ 2× Kávovar", "🔌 1× Prodlužovací přívod"]);
  await expect(page.getByTestId("pending-deletes")).toHaveCount(0);

  // Režim „Místnosti, zóny a vrata“ otevře rozvržení uloženého patra; zpět na mapu závodu
  await page.getByRole("tab", { name: /Místnosti, zóny a vrata/ }).click();
  await expect(page.getByTestId("editing-existing-floor")).toBeVisible();
  await expect(page.getByRole("list", { name: "Místnosti a vrata patra" }).getByRole("textbox", { name: "Název místnosti 2" })).toHaveValue("Kanceláře mistrů");
  await page.getByRole("tab", { name: /Budova a podlaží/ }).click();
  await expect(page.getByLabel("Využití patra 2. NP")).toHaveValue("Kanceláře");
  await page.getByTestId("building-bar").getByRole("button", { name: "Mapa závodu" }).click();
  await expect(page.getByTestId("studio-map-hint")).toBeVisible();

  // Uložený půdorys patra (mimo Studio) má přepočítané štítky
  await page.goto("/plant/plant-jbc/building/bld-jbc-k/floor/floor-jbc-k-1np");
  await expect(page.locator("svg text", { hasText: "☕ 2× Kávovar" })).toHaveCount(1);
  await expect(page.locator("svg text", { hasText: "🧊 1× Chladnička" })).toHaveCount(0);
});
