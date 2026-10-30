import { expect, test, type Page } from "@playwright/test";

import { E2E_AUTH_STATE } from "./auth";
import { startAsAccount, toast } from "./helpers";

// Licenční moduly jsou globální stav tenantu → testy běží za sebou a na konci vše znovu zapnou.
test.describe.configure({ mode: "serial" });

async function setModule(page: Page, label: string, enabled: boolean) {
  await page.goto("/admin/modules");
  const toggle = page.getByRole("switch", { name: new RegExp(`^${label}:`) });
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled)) {
    await toggle.click();
    await expect(toast(page)).toContainText(`Modul „${label}“ ${enabled ? "aktivován" : "deaktivován"}.`);
  }
  await expect(toggle).toHaveAttribute("aria-checked", String(enabled));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: E2E_AUTH_STATE });
  await startAsAccount(page, "acc-dvorak");
  for (const label of ["Revize & Legislativa", "Pokročilá CAE projekce", "Hromadné nástroje"]) await setModule(page, label, true);
  await page.close();
});

test("konfigurace modulů: Core vždy aktivní, add-ony se přepínají", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await page.goto("/admin/modules");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Konfigurace modulů a tarifu");
  await expect(page.getByTestId("module-CORE")).toContainText("Vždy aktivní");
  await expect(page.getByRole("switch")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Podúčty a oprávnění" })).toBeVisible();
});

test("vypnutá CAE projekce skryje interaktivní prvky a pokročilé porovnání", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await setModule(page, "Pokročilá CAE projekce", false);
  await page.goto("/equipment/eq-pv-m1");
  await expect(page.getByRole("button", { name: /Interaktivní prvky/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Porovnat s v1.0" }).click();
  await expect(page.getByTestId("compare-side-before")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Barevný diff" })).toHaveCount(0);
  await expect(page.getByTestId("module-badge")).toContainText("Dostupné v modulu CAE Pro");
  await setModule(page, "Pokročilá CAE projekce", true);
});

test("vypnuté Revize & Legislativa a Hromadné nástroje: navigace, stránky a tlačítka", async ({ page }) => {
  await startAsAccount(page, "acc-dvorak");
  await setModule(page, "Revize & Legislativa", false);
  await setModule(page, "Hromadné nástroje", false);

  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  await expect(nav.getByRole("link", { name: /Revize/ }).first()).toBeVisible();
  for (const hidden of [/Plánovač/, /Rychlá revize/, /Audit/, /Studio/]) await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);

  await page.goto("/inspections/planner");
  await expect(page.getByText("Plánovač revizí je součástí modulu „Revize & Legislativa“")).toBeVisible();
  await page.goto("/studio");
  await expect(page.getByText("Studio výstavby závodu je součástí modulu „Hromadné nástroje“")).toBeVisible();
  await page.goto("/inspections");
  await expect(page.getByRole("link", { name: "Hlídač lhůt" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Import z CSV" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Generovat revizní zprávu/ })).toHaveCount(0);

  await setModule(page, "Revize & Legislativa", true);
  await setModule(page, "Hromadné nástroje", true);
  await page.goto("/inspections/planner");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Chytrý plánovač revizí");
});

test("terénní pohled směnového údržbáře: rychlé akce bez manažerských tabulek", async ({ page }) => {
  await startAsAccount(page, "acc-svoboda");
  await page.goto("/app");
  await expect(page.getByTestId("field-hint")).toBeVisible();
  await expect(page.getByRole("region", { name: "Souhrn závodu" })).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Hlavní navigace" })).toHaveCount(0);

  await page.goto("/equipment/eq-r-ml-01");
  const actions = page.getByTestId("field-quick-actions");
  await expect(actions.getByRole("link", { name: "Schéma" })).toBeVisible();
  await expect(actions.getByRole("link", { name: "QR štítek" })).toBeVisible();
  await expect(actions.getByRole("link", { name: /Nahlásit změnu|Doplnit ke změně/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /LOTO – bezpečné odpojení/ })).toBeVisible();
  await expect(page.getByRole("tab", { name: /Pasport/ })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /Revize & Lhůtník/ })).toHaveCount(0);
});

test("zákres u PDF revize: průvodce vykreslí stránku PDF místo rozbitého obrázku", async ({ page }) => {
  await startAsAccount(page, "acc-svoboda");
  await page.goto("/equipment/eq-rh1/change-request");
  await expect(page.getByRole("img", { name: /Schéma RH1 v1\.0/ })).toHaveAttribute("src", /^blob:/, { timeout: 30_000 });
});
