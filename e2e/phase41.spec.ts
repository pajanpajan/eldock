import { expect, test, type Page } from "@playwright/test";

import { toast } from "./helpers";

// Fáze 41: AI Panel Builder a Správa závodů jako dva samostatné produkty – registrace firem přes ARES,
// povinný souhlas s přenesením odpovědnosti, oddělené přihlášení a propis údajů firmy.
test.use({ storageState: { cookies: [], origins: [] } });
test.describe.configure({ mode: "serial" });

/** ARES v E2E bez sítě: odpověď registru podle IČO. */
async function mockAres(page: Page, company: { ico: string; companyName: string; dic: string | null; street: string; city: string; zip: string }) {
  await page.route("**/api/ares?ico=*", (route) =>
    new URL(route.request().url()).searchParams.get("ico") === company.ico ? route.fulfill({ json: company }) : route.fulfill({ status: 503, json: { error: "Registr ARES je nedostupný – vyplňte údaje ručně." } }),
  );
}

test("úvodní stránka: dva produkty; nepřihlášený do Panel Builderu → registrace firmy s ARES a souhlasem → vlastní lišta, kredity a izolované projekty", async ({ page }) => {
  // Od fáze 58 jsou karty produktů na stránkách částí webu (domov / průmysl), ne na úvodní stránce
  await page.goto("/domovni-elektroinstalace");
  const builder = page.getByTestId("product-panel-builder");
  await expect(builder).toContainText("ELDOCK AI Panel Builder – výrobní dokumentace, oteplení a CE štítek rozváděče z fotky za 3 minuty");
  await page.goto("/prumysl");
  await expect(page.getByTestId("product-plant")).toContainText("ELDOCK Průmyslový dok – Správa výrobních závodů, dokumentace a revizí");
  await expect(page.getByTestId("product-plant").getByRole("link", { name: "Registrovat výrobní závod" })).toHaveAttribute("href", "/register-plant");

  // Přímý vstup bez přihlášení firmy → /panel-builder/auth
  await page.goto("/panel-builder");
  await expect(page).toHaveURL(/\/panel-builder\/auth/);
  await page.goto("/domovni-elektroinstalace");
  await page.getByRole("link", { name: /Spustit AI Panel Builder/ }).click();
  await expect(page).toHaveURL(/\/panel-builder\/auth/);

  // Registrace firmy: IČO → ARES předvyplní název, DIČ a sídlo
  await mockAres(page, { ico: "27074358", companyName: "Rozvaděče Turnov s.r.o.", dic: "CZ27074358", street: "Nádražní 15", city: "Turnov", zip: "511 01" });
  await page.getByRole("tab", { name: "Registrace firmy (Tester)" }).click();
  await page.getByLabel("IČO").fill("27074358");
  await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Rozvaděče Turnov s.r.o.");
  await expect(page.getByLabel("DIČ (nepovinné)")).toHaveValue("CZ27074358");
  await expect(page.getByLabel("Ulice a č. p.")).toHaveValue("Nádražní 15");
  await expect(page.getByLabel("PSČ")).toHaveValue("511 01");
  await page.getByLabel("Jméno a příjmení odpovědné osoby / projektanta").fill("Ing. Petra Rozvaděčová");
  await page.getByLabel("Telefon").fill("+420 603 111 222");
  await page.getByLabel("Ev. č. oprávnění firmy (zákon 250/2021 Sb., § 8) – nepovinné").fill("E-1234/2025");
  await page.getByLabel("E-mail (přihlášení)").fill("petra@rozvadece-turnov.example");
  await page.getByLabel("Heslo (min. 10 znaků)").fill("Modry-Kocour-2026");
  // Bez souhlasu s přenesením odpovědnosti nelze odeslat; celé znění v modalu
  const submit = page.getByRole("button", { name: "Zaregistrovat firmu a spustit Panel Builder" });
  await expect(submit).toBeDisabled();
  await page.getByRole("button", { name: /Obchodní podmínky a vyloučení odpovědnosti/ }).click();
  await expect(page.getByTestId("terms-text")).toContainText("Odpovědnost výrobce rozváděče");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("terms-consent")).toContainText("nese výhradně uživatel (výrobce rozváděče / projektant), nikoliv provozovatel platformy Eldock");
  await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
  await submit.click();

  // Vlastní lišta Panel Builderu: firma + IČO, 5 kreditů, žádné cizí projekty (PB-001 patří firmě Tester)
  await expect(page).toHaveURL(/\/panel-builder$/);
  await expect(page.getByTestId("panel-company")).toContainText("Rozvaděče Turnov s.r.o.");
  await expect(page.getByTestId("panel-company")).toContainText("IČO 27074358");
  await expect(page.getByTestId("panel-credits")).toHaveText(/Kredity: 5/);
  await expect(page.getByText("Zatím žádný projekt rozváděče")).toBeVisible();
  await expect(page.getByRole("link", { name: /PB-001/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Studio" })).toHaveCount(0);

  // Firemní údaje a razítko: úprava odpovědné osoby
  await page.getByRole("link", { name: "Firemní údaje a razítko" }).click();
  await expect(page.getByTestId("terms-accepted")).toContainText("1.0-2026-11");
  await page.getByLabel("Jméno a příjmení odpovědné osoby / projektanta").fill("Ing. Petra Nová");
  await page.getByRole("button", { name: "Uložit firemní údaje" }).click();
  await expect(toast(page)).toContainText("Firemní údaje uloženy");

  // Cizí projekt (PB-001 firmy Tester) je pro tuto firmu nedostupný
  await page.goto("/panel-builder");
  await page.getByRole("button", { name: "Odhlásit" }).click();
  await expect(page).toHaveURL(/\/$/);

  // Ukázková firma Tester (fáze 54: přihlášení na serveru, heslo není na stránce) → vlastní projekty včetně PB-001
  await page.goto("/panel-builder/auth");
  await expect(page.getByText("Tester2026!")).toHaveCount(0);
  await page.getByRole("button", { name: "Vyzkoušet ukázkovou firmu" }).click();
  await expect(page).toHaveURL(/\/panel-builder$/);
  await expect(page.getByTestId("panel-company")).toContainText("Elektro Tester s.r.o.");
  await expect(page.getByRole("link", { name: /PB-001/ })).toBeVisible();
  // Přihlášení do Panel Builderu nepouští do správy závodů
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
});

test("špatné heslo firmy a ARES nedostupný: chyba a ruční vyplnění", async ({ page }) => {
  await page.goto("/panel-builder/auth");
  await page.getByLabel("E-mail").fill("tester@eldock.cz");
  await page.getByLabel("Heslo").fill("spatne-heslo");
  await page.getByRole("button", { name: "Přihlásit se" }).click();
  await expect(page.getByTestId("auth-error")).toHaveText("Nesprávný e-mail nebo heslo.");
  await mockAres(page, { ico: "27074358", companyName: "x", dic: null, street: "", city: "", zip: "" });
  await page.getByRole("tab", { name: "Registrace firmy (Tester)" }).click();
  await page.getByLabel("IČO").fill("12345679");
  await expect(page.getByTestId("ares-status")).toContainText("vyplňte údaje ručně");
  await expect(page.getByLabel("Obchodní název firmy")).toBeEditable();
});

test("registrace výrobního závodu: firma z ARES, nový závod a Technický ředitel → rovnou v novém závodě bez Panel Builderu a bez demo závodů", async ({ page }) => {
  await mockAres(page, { ico: "12345679", companyName: "Strojírny Liberec a.s.", dic: "CZ12345679", street: "Průmyslová 3", city: "Liberec", zip: "460 01" });
  await page.goto("/register-plant");
  await page.getByLabel("IČO").fill("12345679");
  await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Strojírny Liberec a.s.");
  await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill("Ing. Karel Strojník");
  await page.getByLabel("Telefon").fill("+420 777 555 666");
  await expect(page.getByLabel("Název prvního závodu")).toHaveValue("Hlavní výrobní závod");
  await page.getByLabel("Název prvního závodu").fill("Závod Liberec – Strojírna");
  await page.getByLabel("E-mail (přihlášení)").fill("karel@strojirny-liberec.example");
  await page.getByLabel("Heslo (min. 10 znaků)").fill("Strojirna2026!");
  await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
  await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();

  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Závod Liberec – Strojírna");
  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  await expect(nav.getByRole("link", { name: /Studio/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: /Panel Builder/ })).toHaveCount(0);
  // Jen vlastní závod – demo závody Jablonec / Liberec nejsou vidět ani přes přímou adresu
  await page.getByRole("button", { name: "Přepnout závod" }).click();
  await expect(page.getByRole("menuitem", { name: /Závod Jablonec/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.goto("/plant/plant-jbc");
  await expect(page.getByText("Stránka nenalezena")).toBeVisible();

  // Odhlásit a přihlásit se vlastním heslem firmy (sdílené demo heslo neplatí)
  await page.goto("/app");
  await page.getByRole("button", { name: "Odhlásit (Zamknout)" }).click();
  await page.getByLabel("nebo e-mail").fill("karel@strojirny-liberec.example");
  await page.getByLabel("Heslo / PIN").fill("eldock2026");
  await page.getByRole("button", { name: /Přihlásit/ }).click();
  // Fáze 67: stejná hláška pro neznámý e-mail i špatné heslo
  await expect(page.getByText("Nesprávný e-mail nebo heslo.")).toBeVisible();
  await page.getByLabel("Heslo / PIN").fill("Strojirna2026!");
  await page.getByRole("button", { name: /Přihlásit/ }).click();
  await expect(page).toHaveURL(/\/plant\//);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Závod Liberec – Strojírna");
});
