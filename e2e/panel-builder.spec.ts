import { expect, test, type Page } from "@playwright/test";

// AI Panel Builder (fáze 27–31, 41, 42 – vektorový rozváděč a drag & drop zapojení). Samostatný produkt: E2E běží za přihlášenou demo firmu Tester.
test.describe.configure({ mode: "serial" });

test("katalog prvků: navigace, okamžité hledání, filtry a atomizace vzorového PDF", async ({ page }) => {
  // Správa závodů už Panel Builder v navigaci nemá – produkt má vlastní lištu s firmou a kredity
  await page.goto("/app");
  await expect(page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: /Panel Builder/ })).toHaveCount(0);
  // první vstup do samostatné skupiny tras: studený dev server ji může během kompilace přenačíst
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("panel-company")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByTestId("panel-company")).toContainText("IČO 12345679");
  await expect(page.getByTestId("panel-credits")).toContainText(/Kredity: \d+/);
  await expect(page.getByRole("link", { name: /PB-001/ })).toContainText("Domovní / Podružný rozváděč PB-001");

  await page.getByRole("main").getByRole("link", { name: "Katalog prvků" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Katalog prvků");

  // Fáze 47 – krok 1: rozcestník výrobců s logy (odebrané značky v něm nejsou)
  const brands = page.getByTestId("catalog-brands");
  await expect(brands.getByRole("link", { name: /^Siemens \(/ })).toBeVisible();
  await expect(brands.getByRole("link", { name: /^(Finder|Mean Well|Elko)/ })).toHaveCount(0);
  await expect(brands.locator('[data-logo="ABB"]')).toBeVisible();
  // Krok 2: kategorie výrobce → krok 3: prvky s dlaždicovými filtry
  await brands.getByRole("link", { name: /^ABB \(/ }).click();
  await page.getByTestId("catalog-groups").getByRole("link", { name: /^Proudové chrániče/ }).click();
  await page.getByTestId("catalog-tiles").getByRole("link", { name: "4P", exact: true }).click();
  await expect(page).toHaveURL(/poles=4P/);
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toHaveCount(0);
  await page.getByRole("link", { name: "Zpět na kategorie" }).click();
  await page.getByTestId("catalog-groups").getByRole("link", { name: /^Jističochrániče/ }).click();
  await expect(page.getByRole("cell", { name: "DS301C C16 A30" })).toBeVisible();
  // Ventilátory rozváděčů s datasheetem (Rittal)
  await page.getByRole("link", { name: "Zpět na kategorie" }).click();
  await page.getByRole("link", { name: "Zpět na všechny výrobce" }).click();
  await page.getByTestId("catalog-brands").getByRole("link", { name: /^Rittal \(/ }).click();
  await page.getByTestId("catalog-groups").getByRole("link", { name: /^Ventilátory/ }).click();
  await expect(page.getByTestId("catalog-items").getByTestId("datasheet-link").first()).toBeVisible();
  await page.getByRole("link", { name: "Zpět na kategorie" }).click();
  await page.getByRole("link", { name: "Zpět na všechny výrobce" }).click();

  // Globální hledání bez diakritiky a pomlček
  await expect(async () => {
    await page.getByLabel("Hledat v katalogu").fill("jistic s201b16");
    await expect(page).toHaveURL(/q=jistic/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(page.getByRole("cell", { name: "2CDS251001R1165" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "2CSF204102R1400" })).toHaveCount(0);

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

test("krok 1: čistá fotka se zoomem, 2D vektorový rozváděč, živá konfigurace prvku, štítek dvojklikem a našeptávač databáze", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Domovní / Podružný rozváděč PB-001");
  await expect(page.getByTestId("demo-ai-badge")).toContainText("Demo AI režim");
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 11");
  const panel = page.getByTestId("vector-panel");
  await expect(panel.locator("[data-symbol]")).toHaveCount(13);

  // Fotka je čistá předloha bez rámečků; přiblížení tlačítkem
  const photo = page.getByTestId("panel-photo");
  await expect(photo.locator("rect")).toHaveCount(0);
  await photo.getByRole("button", { name: "Přiblížit fotku" }).click();
  await expect(page.getByTestId("photo-zoom")).toHaveText("140 %");
  await photo.getByRole("button", { name: "Celá fotka" }).click();
  await expect(page.getByTestId("photo-zoom")).toHaveText("100 %");

  // Standardizované symboly: odpínač s červenou páčkou, chránič s tlačítkem [ T ], 3 šroubky u 3M jističe
  await expect(page.getByTestId("symbol--Q1").locator('[data-mechanics="red-lever"]')).toHaveCount(1);
  await expect(page.getByTestId("symbol--Q1").getByTestId("symbol-value")).toHaveText("(40A)");
  await expect(page.getByTestId("symbol--FI1").locator("[data-test-button]")).toHaveCount(1);
  await expect(page.getByTestId("symbol--FI1").getByTestId("symbol-value")).toContainText("0,03A");
  await expect(page.getByTestId("symbol--F1").locator("[data-screw]")).toHaveCount(6);
  await expect(page.getByTestId("symbol--F1").locator("[data-tie-bar]")).toHaveCount(1);
  await expect(page.getByTestId("symbol--FV1").locator("[data-cartridge]")).toHaveCount(4);

  // Výběr nerozpoznaného -F4 ve vektorovém rozváděči
  await panel.getByRole("button", { name: /^-F4 / }).click();
  const configurator = page.getByTestId("item-configurator");
  await expect(configurator.getByLabel("Značení přístroje")).toHaveValue("-F4");
  await expect(page.getByTestId("vector-selected")).toContainText("-F4");
  await expect(panel.getByRole("button", { name: /^-F4 /, pressed: true })).toBeVisible();
  await expect(configurator.getByRole("button", { name: "ABB", pressed: true })).toBeVisible();

  // Jeden klik na kategorii = uložený a ověřený přístroj; symbol hned ukáže výrobce a hodnotu
  await configurator.getByRole("button", { name: "Jistič", exact: true }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 12");
  await expect(page.getByTestId("assigned-device")).toContainText("ABB S201-B16");
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-value")).toHaveText("B16");
  await configurator.getByRole("button", { name: "10A", exact: true }).click();
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-value")).toHaveText("B10");
  await expect(page.getByTestId("assigned-device")).toContainText("S201-B10");
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-detail")).toHaveText("S201-B10");
  await expect(page.getByTestId("assigned-device")).toContainText("Šířka: 1M");
  await expect(page.getByTestId("configurator-status")).toHaveText("Ověřeno");

  // Funkce obvodu: rychlý štítek se hned propíše do spodního štítku symbolu
  await configurator.getByRole("button", { name: "Koupelna", exact: true }).click();
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-label")).toHaveText("Koupelna");
  await expect(configurator.getByLabel("Popis obvodu", { exact: true })).toHaveValue("Koupelna");
  // Smart Preset štítku Koupelna = jistič 1P B16; vrátit 10A (referenční oteplení v kroku 3)
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-value")).toHaveText("B16");
  await configurator.getByRole("button", { name: "10A", exact: true }).click();
  await expect(page.getByTestId("symbol--F4").getByTestId("symbol-value")).toHaveText("B10");

  // Dvojklik na symbol = úprava štítku přímo na rozváděči
  await page.getByTestId("symbol--F5").dblclick();
  await page.getByLabel("Funkce obvodu na štítku").fill("Světla koupelny + terasa");
  await page.getByLabel("Funkce obvodu na štítku").press("Enter");
  await expect(page.getByTestId("symbol--F5").getByTestId("symbol-label")).toHaveText("Světla koupelny + terasa");
  await expect(configurator.getByLabel("Popis obvodu", { exact: true })).toHaveValue("Světla koupelny + terasa");

  // Režim zobrazení: výkres osazení (černobílý CAD)
  await panel.getByRole("button", { name: "Výkres osazení" }).click();
  await expect(panel).toHaveAttribute("data-theme", "print");
  await panel.getByRole("button", { name: "Tmavý editor (CAD Dark)" }).click();

  // Chránič -FI1: parametry chrániče, žádná charakteristika B/C/D
  await panel.getByRole("button", { name: /^-FI1 / }).click();
  await expect(configurator.getByRole("button", { name: "Chránič", pressed: true })).toBeVisible();
  await expect(configurator.getByRole("region", { name: "Typ chrániče" })).toBeVisible();
  await expect(configurator.getByRole("region", { name: "Vypínací charakteristika" })).toHaveCount(0);

  // Částečně rozpoznaný -F7: našeptávač z databáze (filtr ABB → Jistič → 1P) a výběr kusu
  await panel.getByRole("button", { name: /^-F7 / }).click();
  await expect(configurator.getByTestId("catalog-filter")).toContainText("ABB → Jistič → 1P");
  await configurator.getByLabel("Hledat v databázi prvků").fill("s201 b16");
  const hits = configurator.getByTestId("catalog-hits");
  await expect(hits).toContainText("2CDS251001R1165");
  await hits.getByRole("button", { name: /ABB S201-B16/ }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 13");
  await expect(page.getByTestId("assigned-device")).toContainText("ABB S201-B16");
  await expect(page.getByTestId("symbol--F7").getByTestId("symbol-value")).toHaveText("B16");
});

test("nový projekt: sloučení 3× 1M → 3P, rozdělení zpět, filtr výrobce a dohledání exotického prvku", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("button", { name: "Nový projekt rozváděče" }).click();
  // Výchozí režim je návrh od nuly – pasportizace z fotky je druhá volba
  await expect(page.getByRole("button", { name: /Navrhnout nový rozváděč od nuly/, pressed: true })).toBeVisible();
  await page.getByRole("button", { name: /Pasportizovat rozváděč z fotky/ }).click();
  await page.getByLabel("Název rozváděče").fill("Podružný rozváděč RP2 – dílna");
  await expect(page.getByLabel("Převažující výrobce (nápověda pro AI)")).toHaveValue("MIX");
  await page.getByRole("button", { name: "Ukázková fotka" }).click();
  await page.getByRole("button", { name: "Založit a analyzovat fotku" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-002");
  const panel = page.getByTestId("vector-panel");
  const symbols = panel.locator("[data-symbol]");
  await expect(symbols).toHaveCount(13);

  // Sloučení -F3, -F4, -F5 (3× 1P B10) → jeden 3P jistič se třemi páčkami na hrazdičce
  await panel.getByRole("button", { name: /^-F3 / }).click();
  const configurator = page.getByTestId("item-configurator");
  await configurator.getByRole("button", { name: /Sloučit 3× 1M → 3P/ }).click();
  await expect(symbols).toHaveCount(11);
  await expect(page.getByTestId("vector-selected")).toContainText("-F3 · lišta 2, 3M");
  await expect(page.getByTestId("assigned-device")).toContainText("S203-B10");
  await expect(page.getByTestId("symbol--F3").locator("[data-lever]")).toHaveCount(3);
  await expect(panel.getByRole("button", { name: /^-F4 / })).toContainText("S201-B16");

  // Rozdělení zpět na 1M moduly
  await configurator.getByRole("button", { name: "Rozdělit na 1M moduly" }).click();
  await expect(symbols).toHaveCount(13);
  await expect(page.getByTestId("vector-selected")).toContainText("-F3 · lišta 2, 1M");

  // Kaskáda: jiný výrobce jen pro tento modul – Eaton 1P B10 6 kA → PL6
  await configurator.getByRole("button", { name: /Vybrat jiného výrobce/ }).click();
  await configurator.getByLabel("Hledat výrobce podle názvu").fill("eat");
  await expect(configurator.getByTestId("brand-grid").getByRole("button")).toHaveCount(1);
  await configurator.getByRole("button", { name: "Eaton", exact: true }).click();
  await expect(configurator.getByTestId("brand-grid")).toHaveCount(0);
  await expect(page.getByTestId("assigned-device")).toContainText("Eaton PL6-B10/1");
  await expect(page.getByTestId("symbol--F3").getByTestId("symbol-manufacturer")).toHaveText("Eaton");

  // Exotický prvek přes dohledání (deterministicky bez klíče)
  // Ruční korekce a AI dohledání jsou v akordeonu Pokročilé
  await configurator.getByText("Pokročilé / Ruční korekce a AI dohledání").click();
  await configurator.getByLabel("Text z čela přístroje").fill("S203 D25");
  await configurator.getByRole("button", { name: /Dohledat přes Gemini AI/ }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("S203-D25");
});

test("Vision Analyzer 2.0: režim analýzy, přidání a smazání modulu i lišty, kompaktní 2×1P", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-002/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-002");
  const panel = page.getByTestId("vector-panel");
  const symbols = panel.locator("[data-symbol]");
  await expect(symbols).toHaveCount(13);

  // Přepínač režimu analýzy; šroubky svorek podle šířky (4M chránič = 4 nahoře + 4 dole)
  await page.getByRole("button", { name: "🛡️ Zakrytovaný" }).click();
  await expect(page.getByRole("button", { name: "🛡️ Zakrytovaný", pressed: true })).toBeVisible();
  await expect(page.getByTestId("symbol--FI1").locator("[data-screw]")).toHaveCount(8);

  // + Přidat modul na lištu 3 → nový nerozpoznaný -F11
  await page.getByRole("button", { name: "Přidat modul na lištu 3" }).click();
  await expect(symbols).toHaveCount(14);
  await expect(page.getByTestId("vector-selected")).toContainText("-F11");

  // Kompaktní dvojitý jistič 2×1P v 1M a rozdělení na 2 obvodové větve
  const configurator = page.getByTestId("item-configurator");
  // Nový modul bez výrobce: kaskáda začíná kartami výrobců (kategorie až po výběru)
  await expect(configurator.getByRole("button", { name: "Jistič", exact: true })).toHaveCount(0);
  await configurator.getByRole("button", { name: "⚡ Obecný přístroj (bez výrobce)" }).click();
  await configurator.getByRole("button", { name: "Jistič", exact: true }).click();
  await configurator.getByRole("button", { name: "⚡ 2×1P Duální (1M)" }).click();
  await expect(page.getByTestId("assigned-device")).toContainText("2x1P B16 kompakt");
  await configurator.getByRole("button", { name: /Rozdělit na 2 obvodové větve/ }).click();
  await expect(symbols).toHaveCount(15);

  // Smazat prvek
  await panel.getByRole("button", { name: /^-F12 / }).click();
  await page.getByTestId("item-configurator").getByRole("button", { name: "Smazat prvek" }).click();
  await expect(symbols).toHaveCount(14);

  // Smazat celou lištu 3 a přidat novou
  await page.getByRole("button", { name: "Smazat celou lištu 3" }).click();
  await expect(symbols).toHaveCount(11); // lišta 3 měla -F9, -F10 a jednu větev 2×1P
  await expect(page.getByRole("button", { name: "Přidat modul na lištu 3" })).toHaveCount(0);
  await page.getByRole("button", { name: "Přidat další DIN lištu (řadu)" }).click();
  await expect(page.getByRole("button", { name: "Přidat modul na lištu 3" })).toBeVisible();
});

/** Přetažení přístroje na přístroj ve vektorovém rozváděči (myš). */
async function dragSymbol(page: Page, from: string, to: string) {
  await page.getByTestId("vector-panel").scrollIntoViewIfNeeded();
  const source = (await page.getByTestId(`symbol-${from}`).boundingBox())!;
  const target = (await page.getByTestId(`symbol-${to}`).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 10, source.y + source.height / 2 + 10, { steps: 3 });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 8 });
  await page.mouse.up();
}

test("krok 2: hlavní přívod, AI návrh na 1 klik, drag & drop na vektorovém rozváděči, modré spojnice, Zpět/Vpřed a uložení", async ({ page }) => {
  // celý vektorový rozváděč (3 lišty) na obrazovce – přetahování mezi lištami bez posouvání
  await page.setViewportSize({ width: 1440, height: 2200 });
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: "2. Zapojení a hierarchie" }).click();
  const summary = page.getByTestId("tree-summary");
  await expect(summary).toContainText("Zapojeno 0/13");
  const wires = page.getByTestId("vector-wires");
  await expect(wires.locator("path")).toHaveCount(0);
  await expect(page.getByTestId("incomer-root")).toContainText("zatím není určen");

  await expect(async () => {
    await page.getByRole("button", { name: "AI návrh zapojení na 1 klik" }).click();
    await expect(summary).toContainText("Zapojeno 13/13", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(summary).toContainText("Chyby: 0");
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");
  // Přívodní šipka do -Q1, hřebenové sběrnice skupin a odbočky
  await expect(page.getByTestId("incomer-root")).toContainText("-Q1");
  await expect(page.getByLabel("Hlavní vstupní prvek")).toHaveValue(/.+/);
  await expect(wires.locator('[data-wire="incomer"]')).toHaveCount(1);
  await expect(wires.locator('[data-wire="bus"]')).not.toHaveCount(0);
  await expect(wires.locator('[data-wire="drop"]')).toHaveCount(12);

  // Výběr -F7: fáze v panelu vybraného prvku
  const panel = page.getByTestId("vector-panel");
  await panel.getByRole("button", { name: /^-F7 / }).click();
  const inspector = page.getByTestId("tree-inspector");
  await expect(inspector.getByRole("button", { name: "-F7 fáze L2", pressed: true })).toBeVisible();
  await inspector.getByRole("button", { name: "-F7 fáze L3" }).click();
  await expect(inspector.getByRole("button", { name: "-F7 fáze L3", pressed: true })).toBeVisible();
  // zpět na navrženou fázi (referenční výpočet oteplení v kroku 3 počítá s původním rozložením)
  await inspector.getByRole("button", { name: "-F7 fáze L2" }).click();

  // Drag & drop: -F9 přímo pod hlavní odpínač -Q1, Zpět / Vpřed
  await dragSymbol(page, "-F9", "-Q1");
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "-F9 → napájeno z -Q1" }).first()).toBeVisible();
  await panel.getByRole("button", { name: /^-F9 / }).click();
  await expect(inspector.getByLabel("-F9 napájeno z").locator("option:checked")).toContainText("-Q1");
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(inspector.getByLabel("-F9 napájeno z").locator("option:checked")).toContainText("-FI1");
  await page.getByRole("button", { name: "Vpřed" }).click();
  await expect(inspector.getByLabel("-F9 napájeno z").locator("option:checked")).toContainText("-Q1");
  // Jistič přetažený na jiný jistič skupiny chrániče → vedle něj (pod -FI1), ne do série
  await dragSymbol(page, "-F9", "-F10");
  await expect(inspector.getByLabel("-F9 napájeno z").locator("option:checked")).toContainText("-FI1");
  await expect(summary).toContainText("Chyby: 0");
  await expect(summary).toContainText("Zapojeno 13/13");

  // „Připojit jističe vpravo“ u chrániče -FI1 (na liště 1 vpravo nic není)
  await page.getByRole("button", { name: "🔗 Připojit jističe vpravo na této liště" }).click();
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "nejsou žádné jističe" }).first()).toBeVisible();

  // Hlavní vstupní prvek může být i chránič: 🎯 a klik na -FI1, pak Zpět
  await page.getByRole("button", { name: /Určit hlavní vstupní prvek/ }).click();
  await expect(page.getByTestId("pick-hint")).toBeVisible();
  await panel.getByRole("button", { name: /^-FI1 / }).click();
  await expect(page.getByTestId("incomer-root")).toContainText("-FI1");
  await expect(summary).toContainText("Zapojeno 13/13");
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(page.getByTestId("incomer-root")).toContainText("-Q1");

  // Směr přívodu zespoda se uloží
  await page.getByRole("button", { name: "⬆ Přívod ZESPODA" }).click();
  await expect(page.getByRole("button", { name: "⬆ Přívod ZESPODA", pressed: true })).toBeVisible();
  await expect(wires).toContainText("PŘÍVOD ZESPODA");

  // Název obvodu v panelu vybraného prvku a uložení
  await panel.getByRole("button", { name: /^-F2 / }).click();
  await inspector.getByLabel("-F2 název obvodu").fill("Sporák + trouba");
  await inspector.getByLabel("-F2 název obvodu").blur();
  await expect(page.getByTestId("symbol--F2").getByTestId("symbol-label")).toHaveText("Sporák + trouba");
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");
  await page.reload();
  await expect(page.getByTestId("tree-summary")).toContainText("Zapojeno 13/13");
  await expect(page.getByRole("button", { name: "⬆ Přívod ZESPODA", pressed: true })).toBeVisible();
  await expect(page.getByTestId("symbol--F2").getByTestId("symbol-label")).toHaveText("Sporák + trouba");
  await expect(page.getByText("Zapojení hotovo")).toBeVisible();
  await page.getByRole("button", { name: "⬇ Přívod SHORA" }).click();
  await expect(page.getByRole("button", { name: "⬇ Přívod SHORA", pressed: true })).toBeVisible();
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
  // Údaje registrované firmy: titulní list, razítko na všech listech, prohlášení o shodě a štítek CE
  await expect(page.getByTestId("doc-manufacturer")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByTestId("doc-manufacturer")).toContainText("12345679");
  await expect(page.getByTestId("doc-manufacturer")).toContainText("Ing. Tomáš Tester");
  await expect(page.getByTestId("stamp-author")).toHaveCount(6);
  await expect(page.getByTestId("doc-sheet-3").getByTestId("stamp-manufacturer")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByTestId("doc-declaration")).toContainText("na svou výhradní odpovědnost");
  await expect(page.getByTestId("declaration-signature")).toContainText("Ing. Tomáš Tester");
  await expect(page.getByTestId("label-manufacturer")).toContainText("Elektro Tester s.r.o., Průmyslová 1280/7, 466 01 Jablonec nad Nisou");
  // Tisk až po potvrzení odborné kontroly a převzetí odpovědnosti
  const print = page.getByRole("button", { name: /Vytisknout \/ Exportovat/ });
  await expect(print).toBeDisabled();
  await page.getByTestId("print-confirmation").getByRole("checkbox").check();
  await expect(print).toBeEnabled();

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
