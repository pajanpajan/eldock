import { expect, test, type Page } from "@playwright/test";

import { PUBLIC_STATE } from "./auth";
import { confirmLayoutWizard, goPhase, rightTab } from "./floorplan-phases";

// Fáze 112: hřebeny a fáze L1 / L2 / L3 na plátně, stykač HDO k tepelnému čerpadlu, záslepky v kusovníku, pravoúhlé vazby
// vypínačů a rohové razítko ČSN EN ISO 7200 s legendou, import ze staré revize a z měřicího přístroje, sekvenční sběr
// Scan & Snap s offline frontou a údaje provozovatele s výzvou k platbě za sadu QR štítků.

async function openDemoFloorplan(page: Page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => {
    window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard");
    window.print = () => undefined;
  });
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 300_000 });
}

test("⚡ AI Panel Builder: stykač HDO k tepelnému čerpadlu, měděné hřebeny s fázemi L1 / L2 / L3 a krycí záslepky v kusovníku", async ({ page }) => {
  test.setTimeout(480_000);
  await openDemoFloorplan(page);
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("wizard-generate").click();
  await confirmLayoutWizard(page);
  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const panel = page.getByTestId("vector-panel");
  // Tepelné čerpadlo (HDO výchozí) = instalační stykač ABB ESB za jističem a ovládací jistič B6 cívek (značení -K… po přečíslování)
  await expect(panel.getByRole("button", { name: /^-K\d+ ABB 25A ESB25-40N-06 · Stykač HDO – Tepelné čerpadlo/ })).toBeVisible({ timeout: 60_000 });
  await expect(panel.getByRole("button", { name: /Ovládání HDO/ })).toBeVisible();
  // Hřebeny pod chrániči a odznaky fází na jističích
  await expect(panel.getByTestId("comb-busbar").first()).toBeAttached();
  await expect(panel.getByTestId("comb-busbar").first()).toHaveAttribute("data-kind", "3F");
  await expect(panel.locator('[data-testid="phase-badge"][data-phase="L1"]').first()).toBeAttached();
  await expect(panel.locator('[data-testid="phase-badge"][data-phase="L2"]').first()).toBeAttached();
  await expect(page.getByTestId("blanking-summary")).toContainText(/Celkem \d+ (volných modulů|volné moduly|volný modul) → \d+ × záslepka 12M/);
  await panel.screenshot({ path: "test-results/phase112-combs.png" });

  // Volba hřebenu lišty u přípojnice: Auto → 3f → 1f → Vyp
  const comb = panel.locator('[data-testid^="rail-comb-"]').first();
  await expect(comb).toHaveAttribute("data-comb", "AUTO");
  await comb.click();
  await expect(comb).toHaveAttribute("data-comb", "3F", { timeout: 60_000 });
  await comb.click();
  await expect(comb).toHaveAttribute("data-comb", "1F", { timeout: 60_000 });
  await comb.click();
  await expect(comb).toHaveAttribute("data-comb", "OFF", { timeout: 60_000 });
  await comb.click();
  await expect(comb).toHaveAttribute("data-comb", "AUTO", { timeout: 60_000 });

  // Kusovník (List 4): krycí záslepky neobsazených modulů
  await page.goto(`${page.url()}/documentation`);
  await expect(page.getByTestId("doc-parts")).toContainText("Krycí záslepka neobsazených modulů (dělitelná lišta 12M, IP20/IP40 dle ČSN EN IEC 61439)", { timeout: 60_000 });
  await expect(page.getByTestId("doc-components")).toContainText("Stykač HDO – Tepelné čerpadlo");
});

test("📐 2D půdorys: vazby vypínačů Pravoúhlé CAD / Přímé / Skrýt a PDF s razítkem ČSN EN ISO 7200 a legendou", async ({ page }) => {
  test.setTimeout(360_000);
  await openDemoFloorplan(page);
  await goPhase(page, 4);
  const canvas = page.getByTestId("floorplan-canvas");
  await expect(page.getByTestId("switch-links-ortho")).toHaveAttribute("aria-pressed", "true");
  await expect(canvas.getByTestId("switch-link").first()).toHaveAttribute("data-mode", "ortho");
  const d = await canvas.getByTestId("switch-link").first().getAttribute("d");
  expect(d).toMatch(/^M [\d.-]+ [\d.-]+ (H|V|L) /);
  await page.screenshot({ path: "test-results/phase112-switch-links.png" });
  await page.getByTestId("switch-links-straight").click();
  await expect(canvas.getByTestId("switch-link").first()).toHaveAttribute("data-mode", "straight");
  await page.getByTestId("switch-links-hidden").click();
  await expect(canvas.getByTestId("switch-link")).toHaveCount(0);
  await page.getByTestId("switch-links-ortho").click();
  await expect(canvas.getByTestId("switch-link").first()).toBeAttached();

  // PDF výkres: rohové razítko (stupeň DSPS, verze v1.1, QR projektu) a vysvětlivky okruhů a kabelů
  await goPhase(page, 5);
  await page.getByTestId("export-pdf").click();
  const dialog = page.getByTestId("export-dialog");
  await dialog.getByTestId("export-stage").selectOption("DSPS");
  await dialog.getByTestId("export-version").fill("1.1");
  await dialog.getByTestId("export-version").blur();
  await expect(dialog.getByTestId("export-version")).toHaveValue("v1.1");
  await expect(dialog.getByTestId("export-stamp")).toContainText("Elektro Tester s.r.o.");
  await dialog.getByTestId("export-print").click();
  const sheet = page.getByTestId("print-root");
  const block = sheet.getByTestId("title-block");
  await expect(block).toHaveAttribute("data-standard", "ČSN EN ISO 7200");
  await expect(block).toContainText("Projektant / Montážní firma");
  await expect(block).toContainText("Elektro Tester s.r.o.");
  await expect(block).toContainText("DSPS – Skutečné provedení stavby");
  await expect(block).toContainText("2D Půdorys elektroinstalace");
  await expect(block).toContainText("v1.1");
  await expect(block.getByTestId("title-qr").locator("svg")).toBeAttached();
  await expect(sheet.getByTestId("print-legend")).toContainText("Zásuvkové okruhy");
  await expect(sheet.getByTestId("print-legend-cable").filter({ hasText: /CYKY-J [35][x×]/ }).first()).toBeAttached();
  await expect(sheet.getByTestId("print-switch-link").first()).toBeAttached();
});

test("📥 AI Panel Builder: rozváděč z okruhů staré revizní zprávy (CSV z PC Revize)", async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto("/panel-builder");
  await page.getByTestId("revision-import-open").click();
  const modal = page.getByTestId("revision-import");
  await modal.getByTestId("revision-tab-template").click();
  await expect(modal.getByTestId("revision-template")).toContainText("Označení · Název · Místnost · Jistič / typ");
  const download = page.waitForEvent("download");
  await modal.getByTestId("revision-template-csv").click();
  expect((await download).suggestedFilename()).toBe("eldock-import-revize.csv");

  await modal.getByTestId("revision-tab-device").click();
  const csv = "﻿Označení;Název;Místnost;Jistič / typ;Kabel;Riso [MΩ];Zs [Ω];Výsledek\n-F1;Zásuvky kuchyň;Kuchyň;B16;CYKY-J 3×2,5;>299,9;0,62;Vyhovuje\n-F2;Světla obývák;Obývák;B10;CYKY-J 3×1,5;250;0,81;Vyhovuje\n-F3;Varná deska;Kuchyň;3×B16;CYKY-J 5×2,5;310;0,55;Vyhovuje\n-FI1;Proudový chránič;;RCD 40A 30mA;;;;Vyhovuje\n";
  await modal.getByTestId("revision-file-device").setInputFiles({ name: "pc-revize.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  const preview = modal.getByTestId("revision-preview");
  await expect(preview).toHaveAttribute("data-kind", "circuits", { timeout: 60_000 });
  await expect(preview).toHaveAttribute("data-count", "4");
  await expect(preview.getByTestId("revision-riso").first()).toHaveText("> 299,9");
  await expect(preview.getByTestId("revision-zs").nth(1)).toHaveText("0,81");
  await modal.getByTestId("revision-panel-name").fill("RD z revize E2E");
  await modal.getByTestId("revision-create-panel").click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 120_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD z revize E2E", { timeout: 60_000 });
  await expect(page.getByTestId("vector-panel").getByRole("button", { name: /Varná deska/ })).toBeVisible();
});

test("🛡️ Hlídač revizí: import spotřebičů do místnosti a ⚡ Scan & Snap bez signálu (offline fronta se po připojení odešle)", async ({ page, context }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(async () => {
    await page.goto("/hlidac-revizi");
    await expect(page.getByTestId("hlidac-workspace")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.getByTestId("hlidac-open-new-building").click();
  await page.getByTestId("hlidac-building-name").fill("Budova E2E 112");
  await page.getByTestId("hlidac-floor-rooms-0").fill("Kancelář 112, Rozvodna 112");
  await page.getByTestId("hlidac-building-create").click();
  await page.getByTestId("hlidac-room-Kancelář 112").click({ timeout: 60_000 });
  await expect(page.getByTestId("hlidac-room-title")).toContainText("Kancelář 112");

  // 📥 Import tabulky spotřebičů (export Metrel) do místnosti s převzatou revizí
  await page.getByTestId("revision-import-open").click();
  const modal = page.getByTestId("revision-import");
  const csv = "Metrel ES Manager\nObject;Name;R low [Ω];Riso [MΩ];Serial No.;Result;Date\nSP-1121;Monitor Dell UltraSharp 27;0,08;>200;CN-0892K1-74210;Vyhovuje;12.03.2026\n;Prodlužovací přívod 5 zásuvek 3 m;0,12;150;PP-2026-0153;Vyhovuje;12.03.2026\n";
  await modal.getByTestId("revision-file-device").setInputFiles({ name: "metrel.csv", mimeType: "text/csv", buffer: Buffer.from(csv, "utf8") });
  await expect(modal.getByTestId("revision-preview")).toHaveAttribute("data-kind", "appliances", { timeout: 60_000 });
  await expect(modal.getByTestId("revision-serial").first()).toHaveText("CN-0892K1-74210");
  await expect(modal.getByTestId("revision-room")).toHaveValue("Kancelář 112");
  await modal.getByTestId("revision-inspector").fill("Ing. Revizní E2E");
  await modal.getByTestId("revision-import-floor").click();
  const devices = page.getByTestId("hlidac-devices");
  await expect(devices).toContainText("S/N CN-0892K1-74210", { timeout: 60_000 });
  await expect(devices).toContainText("S/N PP-2026-0153");

  // ⚡ Scan & Snap: další štítek v pořadí, text štítku, bez signálu → offline fronta → po připojení odesláno
  await page.getByTestId("snap-open").click();
  const loop = page.getByTestId("snap-loop");
  await expect(loop.getByTestId("snap-room")).toHaveValue("Kancelář 112");
  await loop.getByTestId("snap-inspector").fill("Ing. Revizní E2E");
  await loop.getByTestId("snap-label-ok").click();
  await expect(loop).toHaveAttribute("data-step", "2");
  await loop.getByText("Text štítku").click();
  await loop.getByTestId("snap-text").fill("BOSCH\nAku příklepová vrtačka GSB 18V-55\nS/N: 583012345\nClass II");
  await loop.getByTestId("snap-skip-photo").click();
  await expect(loop).toHaveAttribute("data-step", "3");
  await context.setOffline(true);
  await loop.getByTestId("snap-pass").click();
  await expect(loop.getByTestId("snap-row").first()).toHaveAttribute("data-status", "queued");
  const indicator = page.getByTestId("offline-indicator");
  await expect(indicator).toContainText("📡 Offline režim – 1 záznam čeká na odeslání", { timeout: 30_000 });
  await page.screenshot({ path: "test-results/phase112-offline.png" });
  await context.setOffline(false);
  await expect(indicator).toHaveCount(0, { timeout: 60_000 });
  await page.keyboard.press("Escape");
  await expect(devices).toContainText("S/N 583012345", { timeout: 60_000 });
});

test.describe("provozovatel ve velínu, výzva k platbě za sadu QR štítků a patička", () => {
  test("🏢 velín: IČO a sada 50 QR štítků → objednávka s QR platbou SPD → dodavatel na faktuře a v patičce", async ({ page, browser }) => {
    test.setTimeout(300_000);
    await page.goto("/superadmin?tab=provozovatel");
    await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
    await page.getByLabel("Heslo velínu").fill("eldock2026");
    await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
    await page.goto("/superadmin?tab=provozovatel");
    const settings = page.getByTestId("operator-settings");
    await expect(settings).toBeVisible({ timeout: 60_000 });
    await expect(settings.getByTestId("operator-name")).toHaveValue("Pavel Janoušek");
    await settings.getByTestId("operator-ico").fill("27082440");
    await settings.getByTestId("operator-registry").fill("Živnostenský rejstřík MěÚ Jablonec nad Nisou");
    await settings.getByTestId("operator-save").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz" }).first()).toBeVisible({ timeout: 30_000 });
    await settings.getByTestId("label-set-add").click();
    await settings.getByTestId("label-set-title-0").fill("Sada 50 stříbrných QR štítků ELDOCK 30 × 15 mm");
    await settings.getByTestId("label-set-count-0").fill("50");
    await settings.getByTestId("label-set-price-0").fill("690");
    await settings.getByTestId("label-sets-save").click();
    await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Uloženo 1 sad QR štítků" }).first()).toBeVisible({ timeout: 30_000 });

    // Firma objedná sadu štítků → výzva k platbě s QR (SPD) a dodavatelem z velínu
    await page.goto("/panel-builder/credits");
    await page.getByTestId("label-sets").getByTestId("order-labels-50").click();
    await expect(page).toHaveURL(/\/panel-builder\/credits\/[^/]+$/, { timeout: 60_000 });
    await expect(page.getByTestId("payment-qr")).toHaveAttribute("data-spd", /^SPD\*1\.0\*ACC:CZ\d{22}\+RZBCCZPP\*AM:835\.00\*CC:CZK\*X-VS:\d+\*MSG:ELDOCK QR stitky/);
    await page.goto(`${page.url()}/invoice`);
    const invoice = page.getByTestId("invoice");
    await expect(invoice.getByTestId("invoice-supplier")).toContainText("Pavel Janoušek", { timeout: 60_000 });
    await expect(invoice.getByTestId("invoice-supplier")).toContainText("IČO 27082440");
    await expect(invoice.getByTestId("invoice-item")).toContainText("Sada 50 ks stříbrných QR štítků ELDOCK");
    await expect(invoice.getByTestId("invoice-total")).toHaveText("835 Kč");
    await invoice.screenshot({ path: "test-results/phase112-invoice.png" });

    // Patička veřejného webu: provozovatel a IČO z velínu (místo „Eldock s.r.o. (v založení)“)
    const visitor = await browser.newPage({ storageState: PUBLIC_STATE });
    await visitor.goto("/");
    await expect(visitor.getByTestId("footer-operator")).toHaveText("ELDOCK.cz · Pavel Janoušek · Jablonec nad Nisou · info@eldock.cz");
    await expect(visitor.getByTestId("footer-registry")).toContainText("IČO 27082440");
    await expect(visitor.getByText("Eldock s.r.o. (v založení)")).toHaveCount(0);
    await visitor.goto("/obchodni-podminky");
    await expect(visitor.getByText(/Provozovatelem platformy ELDOCK je Pavel Janoušek, .*IČO 27082440/)).toBeVisible();
    await visitor.close();
  });
});
