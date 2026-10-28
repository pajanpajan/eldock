import { expect, test, type Page } from "@playwright/test";

import { startAs, toast } from "./helpers";

// Fáze 16: auditní report, LOTO, revizní závady a obě cesty ukončení provizoria.
// Převod na požadavek se testuje na R-CNC-04 (už má otevřený ZM-2026-0041 → doplní se komentář),
// aby se neposunulo číslování ticketů, se kterým počítá workflow.spec.

/** Klik až po hydrataci (studený dev server může stránku ještě přenačíst). */
async function clickWhenReady(page: Page, name: string | RegExp, expectVisible: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole("button", { name }).first().click();
    await expectVisible();
  }).toPass({ timeout: 30_000 });
}

test("auditní report: shoda, otevřené závady, aktivní provizorium a tisk", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/inspections/audit-report");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Kniha revizí");
  await expect(page.getByRole("region", { name: "Souhrn shody" })).toContainText("Shoda závodu");
  await expect(page.getByRole("region", { name: /Otevřené revizní závady/ })).toContainText("Chybí krytí živých částí IP2X u stykače K2");
  await expect(page.getByRole("region", { name: /Aktivní dočasná provizoria/ })).toContainText("R-LIS-01");
  await expect(page.getByRole("button", { name: /Export CSV/ })).toBeVisible();

  await page.emulateMedia({ media: "print" });
  await expect(page.locator("body > header")).toBeHidden();
  await expect(page.getByRole("region", { name: /Kniha revizí závodu/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Tisk oficiální Knihy revizí/ })).toBeHidden();
  await page.emulateMedia({ media: "screen" });
});

test("LOTO: kde vypnout a dopad vypnutí", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-r-cnc-04?tab=passport");
  await expect(page.getByTestId("loto-lockout")).toHaveText("RM1 › Pole 2 / QF2");
  await expect(page.getByRole("list", { name: "Řetězec napájení" })).toContainText("TR1");

  await page.goto("/equipment/eq-rm1?tab=passport");
  await expect(page.getByTestId("loto-impact")).toContainText("zůstane bez proudu");
  await expect(page.getByRole("region", { name: /LOTO/ })).toContainText("R-CNC-04");
});

test("revizní závada: potvrzení odstranění", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-r-ml-01?tab=inspections");
  const defects = page.getByRole("list", { name: "Závady z revize" }).first();
  await expect(defects).toContainText("Po lhůtě");
  await clickWhenReady(page, "✅ Potvrdit odstranění závady", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
  await page.getByRole("dialog").getByLabel(/Jak byla závada odstraněna/).fill("Doplněn kryt IP2X na stykač K2.");
  await page.getByRole("button", { name: "Potvrdit odstranění" }).click();
  await expect(toast(page)).toContainText("Odstranění závady potvrzeno");
  await expect(defects).toContainText("Odstraněná");
  await expect(defects).toContainText("Doplněn kryt IP2X");
});

test("provizorium: banner a ukončení 1:1 dle schématu", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-r-lis-01");
  const banner = page.getByRole("alert", { name: /Aktivní provizorium PROV-/ });
  await expect(banner).toContainText("Provizorní náhrada stykače K2");
  await expect(banner).toContainText("Oficiální technická dokumentace v2.0 zůstává v platnosti");
  await expect(banner).toContainText("do odstranění");

  await clickWhenReady(page, "Ukončit a řádně nahradit provizorium", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
  await page.getByRole("radio", { name: /Nahrazeno 1:1 dle schématu/ }).click();
  await page.getByRole("dialog").getByLabel(/Poznámka/).fill("Dodán originální stykač Siemens 3RT2026.");
  await page.getByRole("button", { name: "Ukončit provizorium" }).click();
  await expect(toast(page)).toContainText("zapojení 1:1 dle schématu");
  await expect(banner).toHaveCount(0);

  await page.goto("/equipment/eq-r-lis-01?tab=history");
  await expect(page.getByRole("region", { name: "Archiv provizorií" })).toContainText("Odstraněno – vráceno 1:1");
});

test("provizorium: zápis a převod na požadavek na změnu pro CAE", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await page.goto("/equipment/eq-r-cnc-04");
  await clickWhenReady(page, /Zapsat dočasné provizorium/, () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Co je provizorní").fill("Provizorní přemostění koncového spínače S3");
  await dialog.getByLabel(/Popis zapojení/).fill("Spínač S3 přemostěn na X2:7–8, obsluha poučena, dveře označeny.");
  await dialog.getByRole("radio", { name: "14 dní" }).click();
  await dialog.getByRole("button", { name: "Zapsat provizorium" }).click();
  await expect(toast(page)).toContainText(/Provizorium PROV-\d{4}-\d{4} zapsáno/);

  const banner = page.getByRole("alert", { name: /Aktivní provizorium PROV-/ });
  await expect(banner).toContainText("Provizorní přemostění koncového spínače S3");
  await banner.getByRole("button", { name: "Ukončit a řádně nahradit provizorium" }).click();
  await page.getByRole("radio", { name: /Finální úprava se liší od schématu/ }).click();
  await page.getByRole("dialog").getByLabel(/Popis finálního zapojení/).fill("Spínač S3 nahrazen typem s jiným zapojením kontaktů.");
  await page.getByRole("button", { name: "Ukončit a předat CAE" }).click();
  await expect(toast(page)).toContainText("Doplněno do otevřeného požadavku ZM-2026-0041");
  await expect(banner).toHaveCount(0);
});
