import { readFileSync } from "node:fs";

import { expect, test, type Locator, type Page } from "@playwright/test";

import { E2E_AUTH_STATE } from "./auth";
import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 114: místnost tvaru L ze dvou obdélníků (roh ➔ roh) bez vnitřních stěn ve 2D i 3D, levý sloupec kroku 1 bez ořezů,
// velikost rozvodnice s rezervou v %, věrná grafika příslušenství s objednacím číslem, ✅ předběžné připsání kreditů po
// QR platbě s ⏳ štítkem ve velínu a 🔄 SSO z AI Panel Builderu do Hlídače revizí.
test.describe.configure({ mode: "serial" });

/** Klik do plátna v mm půdorysu. */
async function clickAt(page: Page, canvas: Locator, x: number, y: number) {
  await canvas.scrollIntoViewIfNeeded();
  const at = await canvas.evaluate((svg, point) => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    const value = new DOMPoint(point.x, point.y).matrixTransform(matrix);
    return { x: value.x, y: value.y };
  }, { x, y });
  await page.mouse.click(at.x, at.y);
}

test("📐 roh ➔ roh: dva překrývající se obdélníky = jedna L-místnost (2D i 3D bez vnitřních stěn); levý sloupec bez ořezů", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan/novy");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.waitForLoadState("networkidle");
  await goPhase(page, 1);

  // Levý sloupec: žádné tlačítko, pole ani popisek nepřeteče šířku sloupce a nic se neořízne
  const left = page.getByTestId("phase-tools-1");
  await expect(left).toBeVisible();
  const overflow = await left.evaluate((panel) => {
    const box = panel.getBoundingClientRect();
    return [...panel.querySelectorAll("button, input, select, label, span, form")]
      .filter((element) => element.getBoundingClientRect().width > 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const clipped = element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflow !== "visible";
        return rect.right > box.right + 0.5 || rect.left < box.left - 0.5 || clipped;
      })
      .map((element) => element.textContent?.trim().slice(0, 40));
  });
  expect(overflow).toEqual([]);
  await expect(left.getByRole("button", { name: /Nahrát půdorys \(PDF \/ DXF \/ BIM \.ifc \/ Obrázek\)/ })).toBeVisible();
  await left.screenshot({ path: "test-results/phase114-left-column.png" });

  // 📐 Rychlá místnost 2 kliky: přepínač „Spojovat…“ je v liště nástroje zapnutý
  const canvas = page.getByTestId("floorplan-canvas");
  await page.getByTestId("pdf-rooms-2click").click();
  await expect(page.getByTestId("merge-rects-toggle")).toBeChecked();
  await clickAt(page, canvas, 1000, 1000);
  await clickAt(page, canvas, 6000, 4000);
  await expect(canvas.locator("[data-room]")).toHaveCount(1);
  // Druhý obdélník přes první (noha L) → jedna místnost 21 m² (5 × 3 + 2 × 4 − překryv 2 × 1)
  await clickAt(page, canvas, 1000, 3000);
  await clickAt(page, canvas, 3000, 7000);
  await expect(canvas.locator("[data-room]")).toHaveCount(1);
  await expect(page.locator("[data-sonner-toast]").filter({ hasText: "Spojeno s místností" }).first()).toContainText("L-tvar, 21 m²");
  await page.keyboard.press("Escape");

  // Detail místnosti: L-tvar se skutečnou plochou
  await canvas.locator("[data-room]").first().click({ position: { x: 20, y: 20 }, force: true });
  await expect(page.getByTestId("room-area")).toContainText("L-tvar");
  await expect(page.getByTestId("room-area")).toContainText("plocha 21 m²");
  await canvas.screenshot({ path: "test-results/phase114-l-room.png" });

  // 3D náhled: jen 6 obvodových stěn, žádná vnitřní
  await page.getByTestId("pseudo3d-open").click();
  const modal = page.getByTestId("pseudo3d-modal");
  await expect(modal.getByTestId("pseudo3d-iso")).toHaveAttribute("data-walls", "6", { timeout: 60_000 });
  await expect(modal.locator('[data-testid="pseudo3d-wall-face"]')).toHaveCount(6);
  await modal.screenshot({ path: "test-results/phase114-l-room-3d.png" });
});

test("📦 průvodce z půdorysu: velikost rozvodnice s rezervou v % – větší skříň = víc DIN lišt; příslušenství s vlastní grafikou a MPN", async ({ page }) => {
  test.setTimeout(480_000);
  await page.setViewportSize({ width: 1600, height: 1100 });
  await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
  await expect(async () => {
    await page.goto("/panel-builder/floorplan?demo=rd-4kk");
    await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 300_000 });
  await goPhase(page, 5);
  await rightTab(page, "bom");
  await page.getByTestId("wizard-generate").click();

  const wizard = page.getByTestId("layout-wizard");
  await expect(wizard).toBeVisible({ timeout: 120_000 });
  const tiers = wizard.getByTestId("layout-tiers");
  await expect(tiers).toContainText("📦 Zvolte velikost rozvodnice a požadovanou rezervu (dle ČSN EN IEC 61439 min. 20 %)");
  const cards = tiers.locator('[role="radio"]');
  expect(await cards.count()).toBeGreaterThanOrEqual(2);
  await expect(cards.first()).toContainText(/🟢 Rezerva \d+ % \(\d+ volných M/);
  await expect(tiers).toContainText("Doporučeno");
  // Větší velikost (druhá karta) → skříň s víc řadami
  const bigger = cards.nth(1);
  const key = (await bigger.getAttribute("data-testid"))!.replace("layout-tier-", "");
  const [fields, rows] = key.split("x").map(Number);
  await bigger.click();
  await expect(bigger).toHaveAttribute("aria-checked", "true");
  await page.screenshot({ path: "test-results/phase114-wizard-tiers.png" });
  await wizard.getByTestId("layout-wizard-confirm").click();

  await expect(page).toHaveURL(/\/panel-builder\/(?!floorplan)[^/]+$/, { timeout: 120_000 });
  const panel = page.getByTestId("vector-panel");
  await expect(panel.locator("g[data-rail]")).toHaveCount(fields * rows, { timeout: 60_000 });

  // Svorky / Hřebeny / Příslušenství: HLAK s barevnými komorami, vypínací spoušť ABB S2C-A2 s objednacím číslem
  const menu = page.getByRole("region", { name: "Konfigurátor prvku" });
  if (await menu.getByTestId("brand-grid").count()) await menu.getByRole("button", { name: "ABB", exact: true }).click();
  else {
    await menu.getByRole("button", { name: /Vybrat jiného výrobce/ }).click();
    await menu.getByRole("button", { name: "ABB", exact: true }).click();
  }
  await menu.getByRole("button", { name: "Svorky / Hřebeny / Příslušenství", exact: true }).click();
  await menu.getByRole("button", { name: "Svorka / svorkovnice", exact: true }).click();
  const card = page.getByTestId("placement-card");
  await expect(card.locator('[data-accessory="TERMINAL_BLOCK"] [data-terminal="hlak"]')).toBeAttached();
  await expect(card.locator('[data-chamber="PE"]')).toBeAttached();
  await menu.getByRole("button", { name: "Vypínací spoušť", exact: true }).click();
  await expect(card.locator('[data-accessory="SHUNT_TRIP"]')).toBeAttached();
  await expect(page.getByTestId("placement-mpn")).toContainText("2CDS200909R0002");
  await expect(page.getByTestId("placement-mpn")).not.toContainText("odhad IEC");
  await card.screenshot({ path: "test-results/phase114-accessory.png" });
});

test("✅ Zaplatil jsem QR kódem: kredity hned, ⏳ ve velínu ke kontrole výpisu a potvrzení platby v bance", async ({ page }) => {
  test.setTimeout(420_000);
  page.on("dialog", (dialog) => void dialog.accept());
  await expect(async () => {
    await page.goto("/panel-builder/credits");
    await expect(page.getByTestId("credit-packages")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  await page.getByTestId("order-START_30").click();
  await expect(page).toHaveURL(/\/panel-builder\/credits\/[^/]+$/, { timeout: 60_000 });
  // IČO jen když je vyplněné ve velínu (test fáze 112 ho ve sdílené e2e databázi nastavuje)
  await expect(page.getByTestId("payment-supplier")).toContainText(/Pavel Janoušek · ELDOCK\.cz · Jablonec nad Nisou · (IČO \d{8} · )?Neplátce DPH/);
  const vs = (await page.getByRole("heading", { level: 1 }).textContent())!.match(/VS (\d+)/)![1];
  await page.getByTestId("provisional-pay").click();
  await expect(page.getByTestId("provisional-active")).toContainText("aktivní předběžně", { timeout: 60_000 });
  await expect(page.getByTestId("provisional-pay")).toHaveCount(0);

  // Velín: ⏳ Čeká na kontrolu výpisu z banky, odznak záložky, notifikace bez SMTP jen ve velínu → Potvrdit platbu v bance
  await page.goto("/superadmin?tab=orders");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
  await page.goto("/superadmin?tab=orders");
  await expect(page.getByTestId("order-provisional-badge")).toBeVisible();
  const row = page.getByTestId(`order-${vs}`);
  await expect(row.getByTestId(`provisional-${vs}`)).toHaveText("⏳ Čeká na kontrolu výpisu z banky");
  await expect(row).toContainText(/jen ve velínu|upozorněno/);
  await row.screenshot({ path: "test-results/phase114-velin-provisional.png" });
  await row.getByTestId(`confirm-${vs}`).click();
  await expect(row).toContainText("Uhrazeno", { timeout: 60_000 });
  await expect(row.getByTestId(`provisional-${vs}`)).toHaveCount(0);
});

test("🔄 SSO: z AI Panel Builderu do Hlídače revizí jedním klikem (ukázka → testovací závod)", async ({ browser }) => {
  test.setTimeout(300_000);
  // Jen přihlášení AI Panel Builderu (bez relace Správy závodů)
  const state = JSON.parse(readFileSync(E2E_AUTH_STATE, "utf8")) as { cookies: { name: string }[]; origins: unknown[] };
  const page = await browser.newPage({ storageState: { cookies: state.cookies.filter((cookie) => cookie.name !== "digitry-auth"), origins: [] } as never });
  await expect(async () => {
    await page.goto("/hlidac-revizi");
    await expect(page.getByTestId("hlidac-intro")).toBeVisible({ timeout: 30_000 });
  }).toPass({ timeout: 240_000 });
  const sso = page.getByTestId("sso-bridge");
  await expect(sso).toContainText("🔄 Pokračovat pod mým účtem z Panel Builderu (Elektro Tester s.r.o. / tester@eldock.cz)");
  await sso.click();
  await expect(page.getByTestId("hlidac-entitlement")).toBeVisible({ timeout: 120_000 });
  await expect(page.getByTestId("hlidac-intro")).toHaveCount(0);
  await page.screenshot({ path: "test-results/phase114-sso-hlidac.png" });
  await page.close();
});
