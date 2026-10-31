import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

import { E2E_AUTH_STATE } from "./auth";
import { toast } from "./helpers";

// Moduly a tarify jsou globální stav tenantu → testy běží za sebou a na konci vrátí KOMPLET + Obchodní demo.
test.describe.configure({ mode: "serial" });

const PHOTO = path.resolve("e2e", "fixtures", "rozvadec.png");

async function preset(page: Page, label: string) {
  await page.goto("/admin/modules");
  const button = page.getByRole("button", { name: new RegExp(label) });
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await expect(toast(page)).toContainText(`${label} nastaven.`);
  }
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function mode(page: Page, name: RegExp) {
  await page.goto("/admin/modules");
  const radio = page.getByRole("radio", { name });
  if ((await radio.getAttribute("aria-checked")) !== "true") {
    await radio.click();
    await expect(toast(page)).toContainText("Režim:");
  }
  await expect(radio).toHaveAttribute("aria-checked", "true");
}

async function feature(page: Page, label: string, enabled: boolean) {
  await page.goto("/admin/modules");
  const toggle = page.getByRole("switch", { name: new RegExp(`^${label}:`) });
  if ((await toggle.getAttribute("aria-checked")) !== String(enabled)) {
    await toggle.click();
    await expect(toast(page)).toContainText(label);
  }
  await expect(toggle).toHaveAttribute("aria-checked", String(enabled));
}

test.afterAll(async ({ browser }) => {
  const page = await browser.newPage({ storageState: E2E_AUTH_STATE });
  await preset(page, "Tarif KOMPLET ENTERPRISE");
  await mode(page, /Obchodní demo/);
  await page.close();
});

test("správa modulů: vedoucí údržby, presety, režim, podfunkce, AI Panel Builder a matice rolí", async ({ page }) => {
  // Výchozí účet E2E je vedoucí údržby → položka „Moduly“ v navigaci
  await page.goto("/app");
  await expect(async () => {
    await page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: /Moduly|Správa modulů/ }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Správa modulů a tarifů", { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });

  for (const name of ["Tarif START", "Tarif PROFI ÚDRŽBA", "Tarif KOMPLET ENTERPRISE"]) await expect(page.getByRole("button", { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Čisté pracoviště/ })).toBeVisible();
  await expect(page.getByTestId("module-CORE")).toContainText("Vždy aktivní");
  await expect(page.getByRole("switch", { name: /^AI Panel Builder – pasportizace rozváděčů z fotky:/ })).toBeVisible();
  await expect(page.getByRole("switch", { name: /^Kreslení do fotek u červenky:/ })).toBeVisible();
  await expect(page.getByTestId("role-impact").locator("article")).toHaveCount(6);

  // Matice reaguje živě: bez Enterprise ztratí ředitel Studio
  await page.getByRole("switch", { name: /^Enterprise & Onboarding:/ }).click();
  await expect(page.getByTestId("impact-PLANT_ADMIN").locator("[data-hidden-tool]", { hasText: "Studio výstavby závodu" })).toBeVisible();
  await expect(toast(page)).toContainText("deaktivován");
  await page.getByRole("switch", { name: /^Enterprise & Onboarding:/ }).click();
  await expect(toast(page)).toContainText("aktivován");
});

test("tarif START (čisté pracoviště): jednoduchá aplikace na schémata a QR štítky", async ({ page }) => {
  await preset(page, "Tarif START");
  await expect(page.getByRole("radio", { name: /Čisté pracoviště/ })).toHaveAttribute("aria-checked", "true");

  const nav = page.getByRole("navigation", { name: "Hlavní navigace" });
  for (const hidden of [/Plánovač/, /Rychlá revize/, /Audit/, /Studio/, /Panel Builder/]) await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
  await expect(nav.locator("[data-locked-feature]")).toHaveCount(0);

  await page.goto("/equipment/eq-pv-m1");
  await expect(page.getByRole("button", { name: /Porovnat s/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Interaktivní prvky/ })).toHaveCount(0);
  await expect(page.getByTestId("qr-label")).toBeVisible();

  await page.goto("/inspections/planner");
  await expect(page.getByTestId("feature-locked")).toContainText("Plánovač revizí a rychlé revize není ve vašem tarifu aktivní");
  await page.goto("/inspections");
  await expect(page.getByRole("link", { name: /Generovat revizní zprávu/ })).toHaveCount(0);
  await expect(page.locator("[data-locked-feature]")).toHaveCount(0);
});

test("obchodní demo: vypnuté funkce se zámkem a oknem s aktivací", async ({ page }) => {
  await preset(page, "Tarif START");
  await mode(page, /Obchodní demo/);

  await page.goto("/app");
  const locked = page.getByRole("button", { name: "Plánovač revizí – zamčeno, Modul Pro" });
  await expect(locked).toBeVisible();
  await locked.click();
  const dialog = page.getByTestId("upsell-dialog");
  await expect(dialog).toContainText("Plánovač revizí a rychlé revize");
  await expect(dialog).toContainText("Revize & Legislativa VTZ");
  await dialog.getByRole("link", { name: "Přejít do správy modulů a aktivovat" }).click();
  await expect(page).toHaveURL(/\/admin\/modules$/);

  await page.goto("/equipment/eq-pv-m1");
  await page.getByRole("button", { name: /Porovnat s v1\.0/ }).click();
  await expect(page.getByTestId("upsell-dialog")).toContainText("Vizuální porovnávač revizí");
});

test("podfunkce: bez kreslení do fotek jen čisté nahrání, bez porovnávače jen nová revize na schválení", async ({ page }) => {
  await preset(page, "Tarif KOMPLET ENTERPRISE");
  await mode(page, /Čisté pracoviště/);
  await feature(page, "Kreslení do fotek u červenky", false);
  await feature(page, "Vizuální porovnávač revizí", false);

  await page.goto("/equipment/eq-r-cnc-04/change-request");
  await expect(async () => {
    await page.getByTestId("photo-input").setInputFiles(PHOTO);
    await expect(page.locator("li[data-uploaded]")).toHaveCount(1, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.locator('li[data-uploaded="true"]')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.getByRole("button", { name: /Zakreslit/ })).toHaveCount(0);

  await page.goto("/equipment/eq-rm1/approve");
  await expect(page.getByTestId("compare-side-after")).toBeVisible();
  await expect(page.getByTestId("compare-side-before")).toHaveCount(0);

  await feature(page, "Kreslení do fotek u červenky", true);
  await feature(page, "Vizuální porovnávač revizí", true);
});
