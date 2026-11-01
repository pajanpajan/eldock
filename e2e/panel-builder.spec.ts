import { expect, test } from "@playwright/test";

// AI Panel Builder (fáze 27–31). Výchozí účet E2E je vedoucí údržby (má oprávnění Panel Builder).
test.describe.configure({ mode: "serial" });

test("katalog prvků: navigace, okamžité hledání, filtry a atomizace vzorového PDF", async ({ page }) => {
  await page.goto("/app");
  await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: /Panel Builder/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder");
  await expect(page.getByRole("link", { name: /PB-001/ })).toContainText("Domovní / Podružný rozváděč PB-001");

  await page.getByRole("link", { name: "Katalog prvků" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Katalog prvků");
  await expect(page.getByTestId("catalog-count")).toContainText(/z \d+ prvků/);

  // Hledání bez diakritiky a pomlček
  await expect(async () => {
    await page.getByLabel("Hledat v katalogu").fill("jistic s201b16");
    await expect(page).toHaveURL(/q=jistic/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toHaveCount(0);

  // Filtr kategorie + póly
  await page.getByLabel("Hledat v katalogu").fill("");
  await page.getByLabel("Kategorie").selectOption("RCD");
  await page.getByLabel("Póly").selectOption("4P");
  await expect(page).toHaveURL(/category=RCD/);
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toHaveCount(0);

  // Atomizace vzorového PDF z demo dokumentace
  await page.getByRole("button", { name: /Atomizovat PDF datasheet/ }).click();
  await page.getByRole("button", { name: /Pohon vrat – kusovník/ }).click();
  const result = page.getByTestId("datasheet-result");
  await expect(result).toBeVisible({ timeout: 30_000 });
  await expect(result).toContainText("PCS2250101");
  await expect(result).toContainText("Demo AI režim");
  await page.getByRole("button", { name: "Importovat další PDF" }).click();
  await page.getByRole("button", { name: /Domovní rozváděč RH1/ }).click();
  await expect(result).toContainText("2CDS251001R1165", { timeout: 30_000 });
  await expect(result.getByText("Už v katalogu").first()).toBeVisible();
});

test("krok 1: výrazný výběr, živá konfigurace prvku jedním klikem a potvrzení návrhu AI", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Domovní / Podružný rozváděč PB-001");
  await expect(page.getByTestId("demo-ai-badge")).toContainText("Demo AI režim");
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 11");
  await expect(page.getByTestId("panel-photo").getByRole("button")).toHaveCount(13);

  // Výběr -F4 na fotce: jmenovka na fotce i štítek na liště
  await page.getByTestId("panel-photo").getByRole("button", { name: "-F4 – Nerozpoznáno" }).click();
  const configurator = page.getByTestId("item-configurator");
  await expect(configurator.getByLabel("Značení přístroje")).toHaveValue("-F4");
  await expect(page.getByTestId("photo-selected-label")).toHaveText("-F4 · 1M");
  await expect(page.getByTestId("rail-editing")).toHaveText("▼ UPRAVUJETE");
  await expect(configurator.getByRole("button", { name: "ABB", pressed: true })).toBeVisible();
  await expect(configurator.getByText("Odpovídající kusy z katalogu")).toHaveCount(0);

  // Jeden klik na kategorii = uložený a ověřený přístroj; další klik přenastaví proud
  await configurator.getByRole("button", { name: "Jistič", exact: true }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 12");
  await expect(page.getByTestId("assigned-device")).toContainText("ABB S201-B16");
  await configurator.getByRole("button", { name: "10A", exact: true }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("S201-B10");
  await expect(page.getByTestId("assigned-device")).toContainText("Šířka: 1M");
  await expect(page.getByTestId("configurator-status")).toHaveText("Ověřeno");

  // Funkce obvodu nahoře: rychlý štítek se hned ukáže na dlaždici DIN lišty a uloží se
  await configurator.getByRole("button", { name: "Koupelna", exact: true }).click();
  await expect(page.getByTestId("din-rails").getByRole("button", { name: /^-F4 / })).toContainText("Koupelna");
  await expect(configurator.getByLabel("Popis obvodu")).toHaveValue("Koupelna");

  // Ruční srovnání rámečku: tažení pravé hrany vybraného rámečku na fotce
  const edge = page.getByTestId("box-edge-right");
  const before = (await page.getByTestId("box-move").boundingBox())!;
  const handle = (await edge.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2 + 12, handle.y + handle.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect.poll(async () => (await page.getByTestId("box-move").boundingBox())!.width).toBeGreaterThan(before.width + 5);

  // Chránič -FI1: parametry chrániče, žádná charakteristika B/C/D
  await page.getByTestId("din-rails").getByRole("button", { name: /^-FI1 / }).click();
  await expect(configurator.getByRole("button", { name: "Chránič", pressed: true })).toBeVisible();
  await expect(configurator.getByRole("region", { name: "Typ chrániče" })).toBeVisible();
  await expect(configurator.getByRole("region", { name: "Vypínací charakteristika" })).toHaveCount(0);

  // Částečně rozpoznaný -F7: návrh AI stačí potvrdit
  await page.getByTestId("din-rails").getByRole("button", { name: /^-F7 / }).click();
  await configurator.getByRole("button", { name: "Potvrdit návrh" }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 13");
});

test("nový projekt: sloučení 3× 1M → 3P, rozdělení zpět, filtr výrobce a dohledání exotického prvku", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("button", { name: "Nový projekt z fotky" }).click();
  await page.getByLabel("Název rozváděče").fill("Podružný rozváděč RP2 – dílna");
  await expect(page.getByLabel("Převažující výrobce (nápověda pro AI)")).toHaveValue("MIX");
  await page.getByRole("button", { name: "Ukázková fotka" }).click();
  await page.getByRole("button", { name: "Založit a analyzovat fotku" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-002");
  const photoButtons = page.getByTestId("panel-photo").getByRole("button");
  await expect(photoButtons).toHaveCount(13);

  // Sloučení -F3, -F4, -F5 (3× 1P B10) → jeden 3P jistič
  await page.getByTestId("din-rails").getByRole("button", { name: /^-F3 / }).click();
  const configurator = page.getByTestId("item-configurator");
  await configurator.getByRole("button", { name: /Sloučit 3× 1M → 3P/ }).click();
  await expect(photoButtons).toHaveCount(11);
  await expect(page.getByTestId("photo-selected-label")).toHaveText("-F3 · 3M");
  await expect(page.getByTestId("assigned-device")).toContainText("S203-B10");
  await expect(page.getByTestId("din-rails").getByRole("button", { name: /^-F4 / })).toContainText("S201-B16");

  // Rozdělení zpět na 1M moduly
  await configurator.getByRole("button", { name: "Rozdělit na 1M moduly" }).click();
  await expect(photoButtons).toHaveCount(13);
  await expect(page.getByTestId("photo-selected-label")).toHaveText("-F3 · 1M");

  // Filtr výrobce jen pro tento modul: Eaton 1P B10 6 kA → PL6
  await configurator.getByRole("button", { name: "EATON" }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("Eaton PL6-B10/1");

  // Exotický prvek přes dohledání (deterministicky bez klíče)
  await configurator.getByLabel("Text z čela přístroje").fill("S203 D25");
  await configurator.getByRole("button", { name: /Dohledat přes Gemini AI/ }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("S203-D25");
});

test("Vision Analyzer 2.0: režim analýzy, 1M dělení, přidání a smazání modulu i lišty, kompaktní 2×1P", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-002/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-002");
  const photoButtons = page.getByTestId("panel-photo").getByRole("button");
  await expect(photoButtons).toHaveCount(13);

  // Přepínač režimu analýzy a tečkované dělení po 1M ve vícemodulových rámečcích
  await page.getByRole("button", { name: "🛡️ Zakrytovaný" }).click();
  await expect(page.getByRole("button", { name: "🛡️ Zakrytovaný", pressed: true })).toBeVisible();
  await expect(page.locator("[data-module-divider]").first()).toBeAttached();

  // + Přidat modul na lištu 3 → nový nerozpoznaný -F11 s rámečkem na fotce
  await page.getByRole("button", { name: "Přidat modul na lištu 3" }).click();
  await expect(photoButtons).toHaveCount(14);
  await expect(page.getByTestId("photo-selected-label")).toHaveText("-F11 · 1M");

  // Kompaktní dvojitý jistič 2×1P v 1M a rozdělení na 2 obvodové větve
  const configurator = page.getByTestId("item-configurator");
  await configurator.getByRole("button", { name: "Jistič", exact: true }).click();
  await configurator.getByRole("button", { name: "⚡ 2×1P Duální (1M)" }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("2x1P B16 kompakt");
  await configurator.getByRole("button", { name: /Rozdělit na 2 obvodové větve/ }).click();
  await expect(photoButtons).toHaveCount(15);

  // Smazat prvek
  await page.getByTestId("panel-photo").getByRole("button", { name: /^-F12 / }).click();
  await page.getByTestId("item-configurator").getByRole("button", { name: "Smazat prvek" }).click();
  await expect(photoButtons).toHaveCount(14);

  // Smazat celou lištu 3 a přidat novou
  await page.getByRole("button", { name: "Smazat celou lištu 3" }).click();
  await expect(photoButtons).toHaveCount(11); // lišta 3 měla -F9, -F10 a jednu větev 2×1P
  await expect(page.getByRole("button", { name: "Přidat modul na lištu 3" })).toHaveCount(0);
  await page.getByRole("button", { name: "Přidat DIN lištu" }).click();
  await expect(page.getByRole("button", { name: "Přidat modul na lištu 3" })).toBeVisible();
});

test("krok 2: skupinové karty, AI návrh zapojení podle DIN lišt, fáze tlačítky, přesun mezi skupinami, Zpět/Vpřed a uložení", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: "2. Zapojení a hierarchie" }).click();
  const summary = page.getByTestId("tree-summary");
  await expect(summary).toContainText("Zapojeno 0/13");
  await expect(page.getByTestId("tree-loose")).toBeVisible();

  await expect(async () => {
    await page.getByRole("button", { name: "AI návrh zapojení na 1 klik" }).click();
    await expect(summary).toContainText("Zapojeno 13/13", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(summary).toContainText("Chyby: 0");
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");

  // Karty: hlavní přívod pod -Q1 a skupina chrániče -FI1 se svými jističi; chránič vede L1, L2, L3, N
  const mainCard = page.getByTestId("group--Q1");
  const rcdCard = page.getByTestId("group--FI1");
  await expect(mainCard).toContainText("Hlavní přívod a přímé vývody");
  await expect(rcdCard).toContainText("Skupina chrániče -FI1");
  await expect(rcdCard.getByTestId("tree-row--F7")).toBeVisible();
  await expect(page.getByTestId("phase-fixed--FI1")).toHaveText("L1, L2, L3, N");
  await expect(page.getByTestId("group-load--Q1")).toContainText("informace, ne chyba");
  await expect(page.getByRole("button", { name: "-F7 fáze L2", pressed: true })).toBeVisible();

  // Fáze jedním klikem
  await page.getByRole("button", { name: "-F7 fáze L3" }).click();
  await expect(page.getByRole("button", { name: "-F7 fáze L3", pressed: true })).toBeVisible();
  // zpět na navrženou fázi (referenční výpočet oteplení v kroku 3 počítá s původním rozložením)
  await page.getByRole("button", { name: "-F7 fáze L2" }).click();

  // Přesun jističe -F9 pod hlavní vypínač a zpět; Zpět / Vpřed
  await page.getByRole("button", { name: "-F9 napájeno z -Q1 Hlavní" }).click();
  await expect(mainCard.getByTestId("tree-row--F9")).toBeVisible();
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(rcdCard.getByTestId("tree-row--F9")).toBeVisible();
  await page.getByRole("button", { name: "Vpřed" }).click();
  await expect(mainCard.getByTestId("tree-row--F9")).toBeVisible();
  await page.getByRole("button", { name: "-F9 napájeno z -FI1 Chránič (Lišta 1)" }).click();
  await expect(rcdCard.getByTestId("tree-row--F9")).toBeVisible();
  await expect(summary).toContainText("Chyby: 0");

  // Název obvodu inline a uložení
  await page.getByLabel("-F2 název obvodu").fill("Sporák + trouba");
  await page.getByLabel("-F2 název obvodu").blur();
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");
  await page.reload();
  await expect(page.getByTestId("tree-summary")).toContainText("Zapojeno 13/13");
  await expect(page.getByLabel("-F2 název obvodu")).toHaveValue("Sporák + trouba");
  await expect(page.getByText("Zapojení hotovo")).toBeVisible();
});

test("krok 3: výpočet oteplení referenčního rozváděče, živý přepočet a uložení vstupů", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: "3. Výpočet oteplení a bilance" }).click();
  const verdict = page.getByTestId("thermal-verdict");
  await expect(verdict).toContainText("VYHOVUJE dle ČSN EN 61439 – Vypočítaná teplota 42,4 °C");
  await expect(verdict).toContainText("pod limitem 70 °C");
  await expect(page.getByTestId("thermal-row--FI1")).toContainText("20,80");
  await expect(page.getByTestId("phase-balance")).toContainText("L3");
  await expect(page.getByTestId("thermal-curve")).toBeVisible();

  // Horké okolí a plná soudobost → nevyhovuje (živý přepočet), uloží se a vydrží reload
  await expect(async () => {
    await page.getByLabel("Teplota okolí [°C]").fill("55");
    await expect(page.getByLabel("Teplota okolí [°C]")).toHaveValue("55", { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
  await page.getByLabel("Koeficient soudobosti SF").fill("1");
  await expect(verdict).toContainText("NEVYHOVUJE");
  await expect(page.getByTestId("thermal-save-state")).toHaveText("Uloženo");
  await page.reload();
  await expect(page.getByTestId("thermal-verdict")).toContainText("NEVYHOVUJE");

  // Zpět na referenční vstupy; výpočtový proud Ib vývodu sníží ztráty
  await page.getByLabel("Teplota okolí [°C]").fill("30");
  await page.getByLabel("Koeficient soudobosti SF").fill("0.5");
  await expect(page.getByTestId("thermal-verdict")).toContainText("42,4 °C");
  await page.getByLabel("-F1 výpočtový proud Ib").fill("4");
  await expect(page.getByTestId("thermal-verdict")).not.toContainText("42,4 °C");
  await page.getByLabel("-F1 výpočtový proud Ib").fill("");
  await expect(page.getByTestId("thermal-verdict")).toContainText("42,4 °C");
  await expect(page.getByTestId("thermal-save-state")).toHaveText("Uloženo");
});

test("krok 4: 6 listů dokumentace, tiskový režim a propuštění pasportu ke kartě rozváděče", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: "4. Výstupní dokumentace a PDF export" }).click();
  for (const sheet of [1, 2, 3, 4, 5, 6]) await expect(page.getByTestId(`doc-sheet-${sheet}`)).toBeVisible();
  await expect(page.getByTestId("doc-functions")).toContainText("Zásuvky kuchyně");
  await expect(page.getByTestId("doc-parts").getByRole("row", { name: /2CDS251001R1165/ })).toContainText("5");
  await expect(page.getByTestId("doc-components")).toContainText("-A1");
  await expect(page.getByTestId("doc-verdict")).toContainText("VYHOVUJE dle ČSN EN 61439");
  await expect(page.getByTestId("doc-declaration")).toContainText("LVD 2014/35/EU");
  await expect(page.getByTestId("ce-label").locator("svg")).toHaveCount(2);

  // Tisk: bez hlavičky aplikace, kroků a tlačítek
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Kroky projektu" })).toBeHidden();
  await expect(page.getByRole("button", { name: /Vytisknout \/ Exportovat/ })).toBeHidden();
  await expect(page.getByTestId("doc-sheet-6")).toBeVisible();
  await page.emulateMedia({ media: "screen" });

  // Propuštění do provozu → karta rozváděče RH1
  await page.getByRole("button", { name: /Propustit dokumentaci do provozu/ }).click();
  const target = page.getByLabel("Rozváděč v Eldocku");
  await target.selectOption((await target.locator("option", { hasText: "RH1 - Hlavní areálový rozváděč" }).getAttribute("value"))!);
  await page.getByRole("button", { name: "Propustit do provozu" }).click();
  await expect(page.getByTestId("released")).toContainText("RH1 - Hlavní areálový rozváděč");
  await expect(page.getByText("Propuštěno do provozu").first()).toBeVisible();
  await page.getByTestId("released").getByRole("link").click();
  await expect(page.getByTestId("panel-passport")).toContainText("Pasport rozváděče PB-001");
  await page.getByTestId("panel-passport").getByRole("link", { name: "Otevřít dokumentaci" }).click();
  await expect(page.getByTestId("doc-sheet-1")).toBeVisible();
});
