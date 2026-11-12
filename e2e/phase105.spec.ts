import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 105: náhled skříně v kroku 1b (fotka výrobce / render řady vedle mřížky modulů), 3D náhled a kontrola výšek,
// rozpad délky světelných okruhů, cenová nabídka bez interních pojmů pro zákazníka a export do velkoobchodu.
test.describe.configure({ mode: "serial" });

const FORBIDDEN = /ceníkov|normohodin|\bNH\b|rabat/i;

async function openDemo(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
}

test("🧊 2D půdorys: 3D náhled s otáčením a pohledem na stěnu, změna výšky prvku a rozpad délky světelných okruhů", async ({ page }) => {
  test.setTimeout(360_000);
  await openDemo(page);
  await page.getByTestId("pseudo3d-open").click();
  const modal = page.getByTestId("pseudo3d-modal");
  await expect(modal).toBeVisible();
  const iso = modal.getByTestId("pseudo3d-iso");
  await expect(iso).toBeVisible();
  expect(await iso.getByTestId("pseudo3d-element").count()).toBeGreaterThan(10);
  await expect(modal.getByTestId("pseudo3d-issues").or(modal.getByTestId("pseudo3d-ok"))).toBeVisible();
  const rotation = Number(await iso.getAttribute("data-rotation"));
  await modal.getByTestId("pseudo3d-rotate-right").click();
  await expect(iso).toHaveAttribute("data-rotation", String((rotation + 90) % 360));
  // Výška vybraného prvku číslem
  const socket = iso.locator('[data-testid="pseudo3d-element"][data-z="300"]').first();
  const id = await socket.getAttribute("data-id");
  await socket.click();
  await modal.getByTestId("pseudo3d-height-input").fill("1150");
  await modal.getByTestId("pseudo3d-height-apply").click();
  await expect(iso.locator(`[data-testid="pseudo3d-element"][data-id="${id}"]`)).toHaveAttribute("data-z", "1150");
  // Pohled na stěnu s pravítkem výšek
  await modal.getByTestId("pseudo3d-mode-wall").click();
  await expect(modal.getByTestId("pseudo3d-wall")).toBeVisible();
  for (const side of ["N", "E", "S", "W"]) await expect(modal.getByTestId(`pseudo3d-side-${side}`)).toBeVisible();
  await page.screenshot({ path: "test-results/phase105-pseudo3d.png" });
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);

  // Výkaz kabeláže: světelný okruh s rozpadem vodorovně + svislé svody + rezerva = celkem
  await goPhase(page, 5);
  await rightTab(page, "circuits");
  await expect(page.getByTestId("circuit-breakdown").first()).toContainText(/Vodorovně po stěnách \/ stropu [\d,]+ m \+ svislé svody k vypínačům a rozváděči [\d,]+ m \+ rezerva [\d,]+ m = celkem [\d,]+ m/, { timeout: 30_000 });
});

test("💰 2D půdorys: cenová nabídka – interní upozornění jen v aplikaci, výstup pro zákazníka bez interních pojmů, DPH, kapitoly a export do velkoobchodu", async ({ page }) => {
  test.setTimeout(360_000);
  await openDemo(page);
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("quote-open").click();
  const wizard = page.getByTestId("quote-wizard");
  await expect(wizard).toBeVisible();
  await expect(wizard.getByTestId("quote-internal-notice")).toContainText("ℹ️ Informace ke kalkulaci (interní – nezobrazuje se v nabídce pro zákazníka):");
  const customer = wizard.getByTestId("quote-customer");
  await expect(customer).toContainText("Dodávka elektroinstalačního materiálu");
  await expect(customer).toContainText("Elektromontážní a instalační práce");
  await expect(customer).toContainText("Zkoušky, měření a výchozí revize");
  expect(await customer.innerText()).not.toMatch(FORBIDDEN);
  await expect(customer).toContainText("DPH 12 %");
  await wizard.getByTestId("quote-vat-21").click();
  await expect(customer).toContainText("DPH 21 %");
  await wizard.getByTestId("quote-construction-concrete").click();
  await wizard.getByTestId("quote-discount-10").click();
  await wizard.getByTestId("quote-layout-chapters").click();
  await expect(customer.locator('[data-testid^="quote-chapter-"]').first().locator("tbody tr")).toHaveCount(1);
  expect(await customer.innerText()).not.toMatch(FORBIDDEN);
  // Kabely mají ceníkovou cenu (Schrack) – interní souhrn uvádí zdroj, výstup pro zákazníka ne
  await expect(wizard.getByTestId("quote-internal")).toContainText("Schrack", { timeout: 30_000 });
  expect(await customer.innerText()).not.toContain("Schrack");
  // Export do velkoobchodu: soubor pro import košíku Sonepar
  const exporter = wizard.getByTestId("wholesaler-export");
  await exporter.getByTestId("wholesaler-sonepar").click();
  const [download] = await Promise.all([page.waitForEvent("download"), exporter.getByTestId("wholesaler-download-csv").click()]);
  expect(download.suggestedFilename()).toMatch(/-sonepar\.csv$/);
  const content = readFileSync((await download.path())!, "utf8");
  expect(content.startsWith("﻿Objednací číslo / EAN;Množství;Jednotka;Poznámka")).toBe(true);
  expect(content.split("\n").length).toBeGreaterThan(5);
  await exporter.getByTestId("wholesaler-email").click();
  await expect(exporter.getByTestId("wholesaler-email-text")).toContainText("Poptávka materiálu");
  await page.screenshot({ path: "test-results/phase105-quote.png" });
});

test("🗄️ AI Panel Builder: každá skříň v kroku 1b má náhled (fotka / render) vedle mřížky modulů; nabídka v kroku 4", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("link", { name: /PB-001/ }).first()).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 120_000 });
  await page.getByRole("link", { name: /PB-001/ }).first().click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 60_000 });
  const projectUrl = page.url();
  await page.goto(`${projectUrl}/enclosure`);
  const cards = page.getByTestId("enclosure-card");
  await expect(cards.first()).toBeVisible({ timeout: 90_000 });
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let index = 0; index < Math.min(count, 12); index += 1) {
    const card = cards.nth(index);
    await expect(card.getByTestId("enclosure-visual")).toHaveCount(1);
    await expect(card.getByTestId("enclosure-fill")).toHaveCount(1);
    await expect(card.getByTestId("enclosure-visual").locator("img, svg").first()).toBeVisible();
  }
  await page.screenshot({ path: "test-results/phase105-enclosures.png" });

  await page.goto(`${projectUrl}/documentation`);
  await page.getByTestId("quote-entry").getByTestId("quote-open").click({ timeout: 90_000 });
  const wizard = page.getByTestId("quote-wizard");
  await expect(wizard.getByTestId("quote-customer")).toContainText("Kompletace a zapojení rozváděče");
  expect(await wizard.getByTestId("quote-customer").innerText()).not.toMatch(FORBIDDEN);
});
