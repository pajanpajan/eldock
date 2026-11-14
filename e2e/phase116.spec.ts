import { expect, test } from "@playwright/test";

import { startAs, toast } from "./helpers";

// Fáze 116: detail stroje / rozváděče se záložkami hned pod hlavičkou a kompaktním identifikačním pruhem, kusovník
// s prediktivní životností a oficiálními datasheety, souhrnný nákupní report, doplnění pasportu 5 z 5 s OOEZ / OPŘPČ,
// Červenky u stroje a pochůzkový režim revizního technika s 2D minimapou a rychlým zápisem.
test.describe.configure({ mode: "serial" });

test("📋 rozváděč R-SKL: záložky nahoře, kompaktní pruh, kusovník & životnost, datasheet a nákupní report", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("dialog", (dialog) => void dialog.accept());
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/equipment/eq-r-skl");
    await expect(page.getByTestId("equipment-tabs")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 120_000 });

  // Lišta záložek je první věc pod hlavičkou – bez rolování
  const tabs = page.getByTestId("equipment-tabs");
  const tabNames = await tabs.getByRole("tab").allTextContents();
  expect(tabNames.slice(0, 7)).toEqual(["📐 Schéma", "📋 Kusovník & Životnost", expect.stringMatching(/^✏️ Červenky \(\d+\)$/), "🧊 3D rozváděč", "🕒 Historie změn", "🛡️ Pasport & Shoda (61439)", "📅 Revize & Lhůtník"]);
  expect(tabNames).toContain("🔍 Diagnostika & Spoje (Údržba)");
  const tabsBox = (await tabs.boundingBox())!;
  expect(tabsBox.y + tabsBox.height).toBeLessThan(600);

  // Kompaktní identifikační pruh pod lištou: 3 karty do 145 px, jde sbalit
  const strip = page.getByTestId("identity-strip");
  expect((await strip.boundingBox())!.y).toBeGreaterThan(tabsBox.y);
  for (const id of ["identity-photo", "nameplate-card", "identity-qr"]) expect((await strip.getByTestId(id).boundingBox())!.height).toBeLessThanOrEqual(145);
  await expect(strip.getByTestId("nameplate-capture")).toContainText("📷 Vyfotit štítek (AI)");
  await expect(strip.getByRole("button", { name: /Tisk QR/ })).toBeVisible();
  await page.getByTestId("identity-strip-toggle").click();
  await expect(strip).toHaveAttribute("data-collapsed", "true");
  await expect(strip.getByTestId("identity-qr")).toHaveCount(0);
  await page.getByTestId("identity-strip-toggle").click();
  await expect(strip.getByTestId("identity-qr")).toBeVisible();

  // 📋 Kusovník & Životnost
  await tabs.getByRole("tab", { name: "📋 Kusovník & Životnost" }).click();
  const bom = page.getByTestId("bom-lifespan");
  await expect(bom.getByTestId("lifespan-controls")).toContainText("Provozní režim stroje:");
  const k1 = bom.locator('[data-testid="bom-row"][data-designation="-K1"]');
  const remaining = async () => Number(await k1.getByTestId("bom-remaining").getAttribute("data-remaining"));
  const before = await remaining();
  expect(before).toBeGreaterThan(0);
  expect(before).toBeLessThanOrEqual(100);
  await expect(k1).toContainText("výrobce: B10d");
  await expect(bom.locator('[data-testid="bom-row"][data-designation="-X1"]')).toContainText("bez opotřebení");

  // Směnnost 24/7 → zbývá méně
  await bom.getByTestId("lifespan-shift-4").click();
  await expect.poll(remaining, { timeout: 30_000 }).toBeLessThan(before);
  // Četnost spínání 120 sepnutí/h → stykač po životnosti
  const rate = k1.getByRole("textbox", { name: "Četnost spínání -K1 [sepnutí/hod]" });
  await rate.fill("120");
  await rate.press("Enter");
  await expect(k1.getByTestId("bom-end")).toHaveText("🔴 Překročeno – vyměnit ihned", { timeout: 30_000 });
  await expect(k1.getByTestId("bom-remaining")).toContainText(/🔴 0 % zbývá \(překročeno o \+[\d,\s]+ %\)/);
  await expect(k1.getByTestId("bom-rate")).not.toContainText("(odhad)");

  // Sklad závodu podle MPN
  const stock = k1.getByTestId("bom-stock-input");
  await stock.fill("2");
  await stock.press("Enter");
  await expect(k1.getByTestId("bom-stock")).toHaveText("🟢 Skladem: 2 ks", { timeout: 30_000 });

  // 📄 Oficiální datasheet Schneider Electric LC1D25BD
  await k1.getByTestId("bom-datasheet").click();
  const sheet = page.getByTestId("datasheet-dialog");
  await expect(sheet).toHaveAttribute("data-verified", "true");
  await expect(sheet.getByTestId("datasheet-lifespan")).toContainText(/1\s369\s863 cyklů/);
  await expect(sheet.getByTestId("datasheet-dimensions")).toHaveText("45 × 85 × 101 mm (Š × V × H)");
  await expect(sheet.getByTestId("datasheet-diagram")).toBeVisible();
  await expect(sheet.getByTestId("datasheet-pdf")).toHaveAttribute("href", /se\.com\/cz\/cs\/product\/download-pdf\/LC1D25BD/);
  await page.keyboard.press("Escape");

  // 🔄 Vyměněno (Reset 100 %) – kus ze skladu
  await k1.getByTestId("bom-replace").click();
  await expect.poll(remaining, { timeout: 30_000 }).toBe(100);
  await expect(k1.getByTestId("bom-stock")).toHaveText("🟢 Skladem: 1 ks");
  await page.screenshot({ path: "test-results/phase116-bom.png", fullPage: false });

  // 📚 Návody & Datasheety: ověřené listy dílů kusovníku
  await tabs.getByRole("tab", { name: /Návody & Datasheety/ }).click();
  await expect(page.getByTestId("bom-datasheets").locator('[data-part="LC1D25BD"]')).toHaveAttribute("data-verified", "true");

  // 📦 Souhrnný nákupní report
  await tabs.getByRole("tab", { name: "📋 Kusovník & Životnost" }).click();
  await bom.getByTestId("purchase-report-link").click();
  await expect(page).toHaveURL(/\/nakupni-report\?zavod=/);
  const report = page.getByTestId("purchase-report");
  await expect(report).toHaveAttribute("data-triggered", "true");
  await expect(report.getByTestId("purchase-trigger")).toContainText("Spuštěno prvním varováním");
  const line = report.locator('[data-testid="purchase-line"][data-part="LC1D25BD"]');
  await expect(line).toBeVisible();
  const needed = Number(await line.getAttribute("data-needed"));
  expect(needed).toBeGreaterThan(1);
  await expect(line).toHaveAttribute("data-stock", "1");
  await expect(line).toHaveAttribute("data-order", String(needed - 1));
  const download = page.waitForEvent("download");
  await report.getByTestId("purchase-xlsx").click();
  expect((await download).suggestedFilename()).toMatch(/^nakupni-report-.*\.xlsx$/);
  await report.getByTestId("purchase-horizon-365").click();
  await expect(page).toHaveURL(/vyhled=365/);
  await report.getByTestId("purchase-email").fill("nakup@example.com");
  await report.getByTestId("purchase-frequency").selectOption("MONTHLY");
  await report.getByTestId("purchase-save").click();
  await expect(toast(page)).toContainText("nakup@example.com");
  const pdf = await page.request.get(await report.getByTestId("purchase-pdf").getAttribute("href").then((href) => href!));
  expect(pdf.status()).toBe(200);
  await page.screenshot({ path: "test-results/phase116-purchase.png", fullPage: false });
});

test("🛡️ Pasport & Shoda: doplnění liniového schématu, oteplení a vnějších vlivů → 5 z 5, OOEZ / OPŘPČ", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/equipment/eq-r-vzt-01?tab=passport");
    await expect(page.getByTestId("passport-status")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  const status = page.getByTestId("passport-status");
  await expect(status).toContainText("Pasport neúplný – chybí 3 z 5 dokumentů (Liniové schéma, Výpočet oteplení, Vnější vlivy)");

  await page.getByTestId("passport-generate-SINGLE_LINE_DIAGRAM").click();
  await page.getByTestId("passport-dialog").getByTestId("passport-save").click();
  await expect(status).toHaveAttribute("data-present", "3", { timeout: 30_000 });

  await page.getByTestId("passport-generate-THERMAL_CALCULATION").click();
  const thermal = page.getByTestId("passport-dialog");
  const losses = thermal.getByRole("textbox", { name: /^Ztrátový výkon / });
  for (let index = 0; index < (await losses.count()); index++) if (!(await losses.nth(index).inputValue())) await losses.nth(index).fill("2");
  await expect(thermal.getByTestId("thermal-result")).toHaveAttribute("data-ok", "true");
  await thermal.getByTestId("passport-save").click();
  await expect(status).toHaveAttribute("data-present", "4", { timeout: 30_000 });

  await page.getByTestId("passport-generate-EXTERNAL_INFLUENCES").click();
  await page.getByTestId("passport-dialog").getByTestId("passport-save").click();
  await expect(status).toHaveText("✅ Pasport kompletní – 5 z 5 dokumentů dle ČSN EN IEC 61439-2", { timeout: 30_000 });
  await expect(page.locator('[data-testid="passport-doc"][data-state="present"]')).toHaveCount(5);

  const card = page.locator('[data-testid="passport-doc"][data-category="THERMAL_CALCULATION"]');
  await expect(card).toContainText("✅ V pasportu (platný dokument)");
  const href = (await card.getByTestId("doc-download").getAttribute("href"))!;
  expect(href).toMatch(/^\/equipment\/eq-r-vzt-01\/pasport\/\w+\?tisk=1$/);
  const print = await page.request.get(href.replace("?tisk=1", "?nahled=1"));
  expect(print.status()).toBe(200);
  expect(await print.text()).toContain("VYHOVUJE");

  // Odpovědné osoby dle ČSN EN 50110-1 ed. 4 na kartě LOTO
  await page.getByTestId("loto-responsible-edit").click();
  await page.getByTestId("loto-ooez-name").fill("Petr Testovací");
  await page.getByTestId("loto-oprpc-name").fill("Eva Testovací");
  await page.getByTestId("loto-responsible-save").click();
  await expect(page.getByTestId("loto-ooez")).toContainText("Petr Testovací", { timeout: 30_000 });
  await expect(page.getByTestId("loto-oprpc")).toContainText("Eva Testovací");
  await page.screenshot({ path: "test-results/phase116-passport.png", fullPage: false });
});

test("✏️ Červenky u stroje R-CNC-04: seznam zákresů, stav, dopad dle EU 2023/1230 a předání k překreslení", async ({ page }) => {
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/equipment/eq-r-cnc-04?tab=redlines");
    await expect(page.getByTestId("equipment-redlines")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  const list = page.getByTestId("equipment-redlines");
  await expect(list.getByTestId("redline-item")).toHaveCount(2);
  await expect(list.locator('[data-number="ZM-2025-0007"]').getByTestId("redline-stage")).toHaveText(/^Schváleno do v\d+\.\d+$/);
  await expect(list.locator('[data-number="ZM-2026-0041"]').getByTestId("redline-impact")).toContainText("Dopad dle EU 2023/1230:");
  await expect(list.getByTestId("redline-new")).toHaveAttribute("href", "/equipment/eq-r-cnc-04/change-request");
  await list.locator('[data-number="ZM-2026-0041"]').getByTestId("redline-route").click();
  const dialog = page.getByTestId("redline-route-dialog");
  await expect(dialog.getByTestId("routing-internal")).toBeVisible();
  await expect(dialog.getByTestId("routing-pool")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "📐 Schéma" }).click();
  await expect(page.getByTestId("redlines-summary")).toContainText("1 otevřené");
});

test("🚶 Revize & Plánovač: pochůzková trasa Budova ➔ Patro ➔ Místnost, minimapa patra a rychlý zápis", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await startAs(page, "MAINTENANCE");
  await expect(async () => {
    await page.goto("/revize");
    await expect(page.getByTestId("walk-sort")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 90_000 });
  await page.getByTestId("walk-sort-trasa").click();
  await expect(page).toHaveURL(/razeni=trasa/);
  const walk = page.getByTestId("walk-route");
  await expect(walk.getByTestId("walk-stop").first()).toContainText(/^Zastávka 1: /);
  // Každá místnost (zastávka) jen jednou
  const stops = await walk.getByTestId("walk-stop").evaluateAll((elements) => elements.map((element) => `${(element as HTMLElement).dataset.floor}|${(element as HTMLElement).dataset.room}`));
  expect(new Set(stops).size).toBe(stops.length);

  // 📍 Kde přesně to najdu – minimapa patra s pulzujícím špendlíkem (R-ML-01: rozváděč montážní linky po termínu;
  // spotřebiče z pochůzky hlídají pozdější testy plánovače a digestu)
  const row = walk.locator('[data-testid="walk-row"][data-equipment="R-ML-01"]');
  await expect(row.getByTestId("walk-location")).toContainText("📍");
  await row.getByTestId("walk-map").click();
  await expect(row.getByTestId("floor-minimap")).toBeVisible({ timeout: 30_000 });
  await expect(row.locator('[data-testid="minimap-pin"][data-active="true"]')).toHaveCount(1);
  // Trasa po patře: očíslované špendlíky 1 ➔ 2 ➔ 3
  const first = walk.getByTestId("walk-stop").first();
  await first.getByTestId("walk-floor-route").click();
  await expect(first.locator('[data-testid="floor-minimap"][data-route="true"] [data-testid="minimap-pin"]').first()).toContainText("1", { timeout: 30_000 });

  // ⚡ Rychlý zápis na 1 klik → hotovo v dnešním výjezdu
  const progress = walk.getByTestId("walk-progress");
  const doneBefore = Number(await progress.getAttribute("data-done"));
  await walk.getByTestId("walk-tech-name").fill("Jan Testovací");
  await walk.getByTestId("walk-tech-license").fill("TEST-116/2026");
  // Revize VTZ (rozváděč): rozsah a platnost osvědčení technika
  await walk.getByTestId("walk-tech-scope").selectOption("E2A");
  await walk.getByTestId("walk-tech-valid").fill("2030-12-31");
  await row.getByTestId("walk-quick").click();
  await row.getByTestId("walk-riso").fill("250");
  await row.getByTestId("walk-rpe").fill("0,2");
  await row.getByTestId("walk-zs").fill("0,45");
  await row.getByTestId("walk-quick-save").click();
  await expect(progress).toHaveAttribute("data-done", String(doneBefore + 1), { timeout: 30_000 });
  await expect(walk.locator('[data-testid="walk-row"][data-equipment="R-ML-01"]')).toHaveAttribute("data-done", "true");
  await page.screenshot({ path: "test-results/phase116-walk.png", fullPage: false });

  // Lhůtník a Hlídač revizí mají stejný pochůzkový režim
  await page.goto("/revize?tab=lhutnik&razeni=trasa");
  await expect(page.getByTestId("walk-sort-trasa")).toHaveAttribute("aria-current", "true");
  await expect(page.getByTestId("walk-route")).toBeVisible();
  await page.goto("/hlidac-revizi?razeni=trasa");
  await expect(page.getByTestId("walk-route")).toBeVisible({ timeout: 30_000 });
});
