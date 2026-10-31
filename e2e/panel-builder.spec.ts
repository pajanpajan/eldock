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

test("krok 1: fotka s rámečky, Smart Fallback Picker na 3 kliky a potvrzení návrhu AI", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Domovní / Podružný rozváděč PB-001");
  await expect(page.getByTestId("demo-ai-badge")).toContainText("Demo AI režim");
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 11");
  await expect(page.getByTestId("count-PARTIAL")).toHaveText("K potvrzení: 1");
  await expect(page.getByTestId("count-UNRECOGNIZED")).toHaveText("Nerozpoznáno: 1");
  await expect(page.getByTestId("panel-photo").getByRole("button")).toHaveCount(13);

  // Nerozpoznaný -F6: kategorie → póly a charakteristika → proud → přiřadit
  await page.getByTestId("panel-photo").getByRole("button", { name: "-F6 – Nerozpoznáno" }).click();
  const picker = page.getByTestId("smart-picker");
  await expect(picker).toContainText("-F6");
  await expect(picker.getByRole("button", { name: "ABB", pressed: true })).toBeVisible();
  await picker.getByRole("button", { name: "Jistič", exact: true }).click();
  await picker.getByRole("button", { name: "1P", exact: true }).click();
  await picker.getByRole("button", { name: "Charakteristika B" }).click();
  await picker.getByRole("button", { name: "10A" }).click();
  await expect(picker.getByTestId("picker-candidates").locator("li").first()).toContainText("S201-B10");
  await expect(picker.getByTestId("picker-candidates").locator("li").first()).toContainText("2,1 W");
  await picker.getByRole("button", { name: "Přiřadit S201-B10" }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 12");

  // Picker skočil na další nedořešený (-F9) – návrh AI stačí potvrdit
  await expect(picker).toContainText("-F9");
  await picker.getByRole("button", { name: "Potvrdit návrh" }).click();
  await expect(page.getByTestId("count-VERIFIED")).toHaveText("Ověřeno: 13");
  await expect(page.getByTestId("picker-done")).toContainText("Všechny přístroje jsou ověřené");
});

test("nový projekt z ukázkové fotky a dohledání přístroje podle textu z čela", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("button", { name: "Nový projekt z fotky" }).click();
  await page.getByLabel("Název rozváděče").fill("Podružný rozváděč RP2 – dílna");
  await page.getByRole("button", { name: "Ukázková fotka" }).click();
  await page.getByRole("button", { name: "Založit a analyzovat fotku" }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PB-002");
  await expect(page.getByTestId("count-UNRECOGNIZED")).toHaveText("Nerozpoznáno: 1");

  const picker = page.getByTestId("smart-picker");
  await expect(picker).toContainText("-F6");
  await picker.getByLabel("Text z čela přístroje").fill("S201 C13");
  await picker.getByRole("button", { name: /Dohledat v datasheetech/ }).click();
  await expect(picker.getByTestId("picker-candidates").locator("li").first()).toContainText("S201-C13");
  await expect(picker.getByTestId("picker-candidates").locator("li").first()).toContainText("odhad Pv dle IEC");
  await picker.getByRole("button", { name: "Přiřadit S201-C13" }).click();
  await expect(page.getByTestId("count-UNRECOGNIZED")).toHaveText("Nerozpoznáno: 0");
});

test("krok 2: AI návrh stromu, hlídač, Zpět/Vpřed, hromadné přiřazení a uložení", async ({ page }) => {
  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: "2. Hierarchický strom a zapojení" }).click();
  const summary = page.getByTestId("tree-summary");
  await expect(summary).toContainText("Zapojeno 0/13");
  await expect(page.getByTestId("tree-loose")).toBeVisible();

  await expect(async () => {
    await page.getByRole("button", { name: "AI návrh stromu na 1 klik" }).click();
    await expect(summary).toContainText("Zapojeno 13/13", { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
  await expect(summary).toContainText("Chyby: 0");
  await expect(page.getByLabel("-F9 fáze")).toHaveValue("L2");
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");

  // Chyba: 3P jistič pod jednofázovým -F5 → hlídač; Zpět / Vpřed
  await page.getByLabel("-F3 napájeno z").selectOption({ label: "-F5 · Světla chodby" });
  await expect(page.getByTestId("tree-row--F3")).toContainText("3P přístroj -F3 nemůže být napájen z jednofázového uzlu -F5");
  await expect(summary).toContainText("Chyby: 1");
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(summary).toContainText("Chyby: 0");
  await page.getByRole("button", { name: "Vpřed" }).click();
  await expect(summary).toContainText("Chyby: 1");
  await page.getByRole("button", { name: "Zpět" }).click();
  await expect(summary).toContainText("Chyby: 0");

  // Hromadné přiřazení: -F11 a -F12 pod -Q1 a zpět pod chránič -F2
  await page.getByLabel("Vybrat -F11").check();
  await page.getByLabel("Vybrat -F12").check();
  await page.getByLabel("Hromadně zapojit pod").selectOption({ label: "-Q1 · Odpínač" });
  await page.getByRole("button", { name: "Zapojit (2)" }).click();
  await expect(page.getByLabel("-F12 napájeno z")).toHaveValue(/.+/);
  await expect(page.getByLabel("-F12 napájeno z").locator("option:checked")).toHaveText("-Q1 · Odpínač");
  await page.getByLabel("Vybrat -F11").check();
  await page.getByLabel("Vybrat -F12").check();
  await page.getByLabel("Hromadně zapojit pod").selectOption({ label: "-F2 · Proudový chránič (RCD)" });
  await page.getByRole("button", { name: "Zapojit (2)" }).click();
  await expect(page.getByLabel("-F12 napájeno z").locator("option:checked")).toHaveText("-F2 · Proudový chránič (RCD)");

  // Název obvodu inline a uložení
  await page.getByLabel("-F4 název obvodu").fill("Sporák + trouba");
  await page.getByLabel("-F4 název obvodu").blur();
  await expect(page.getByTestId("tree-save-state")).toHaveText("Uloženo");
  await page.reload();
  await expect(page.getByTestId("tree-summary")).toContainText("Zapojeno 13/13");
  await expect(page.getByLabel("-F4 název obvodu")).toHaveValue("Sporák + trouba");
  await expect(page.getByText("Strom zapojení hotov")).toBeVisible();
});
