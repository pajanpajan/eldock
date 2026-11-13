import { readFileSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { E2E_AUTH_STATE } from "./auth";
import { goPhase, rightTab } from "./floorplan-phases";

// Fáze 102: lišta „🍪 Nastavení soukromí a souborů cookies“ (Rozumím a přijímám / Podrobné nastavení / Odmítnout vše,
// Google Consent Mode v2), telemetrie prvních stran `/api/telemetry`, okno kontaktu v ukázkové firmě (export kusovníku)
// a záložka velínu „📈 Návštěvnost, Leady & Tržní data“.
test.describe.configure({ mode: "serial" });

const consentCookie = async (page: Page) => (await page.context().cookies()).find((cookie) => cookie.name === "eldock_consent")?.value ?? null;

test.describe("lišta cookies pro nového návštěvníka", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("🍪 lišta se 3 tlačítky, výchozí Consent Mode v2 „denied“, „Rozumím a přijímám“ uloží volbu a lišta zmizí", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await expect(banner).toBeVisible({ timeout: 30_000 });
    await expect(banner).toContainText("🍪 Nastavení soukromí a souborů cookies");
    await expect(banner).toContainText("Kliknutím na „Rozumím a přijímám“ souhlasíte s využíváním všech cookies.");
    for (const name of ["Rozumím a přijímám", "Podrobné nastavení", "Odmítnout vše"]) await expect(banner.getByRole("button", { name })).toBeVisible();
    // Odmítnutí stejně dostupné jako souhlas – stejná velikost tlačítka
    const [accept, reject] = [(await banner.getByTestId("consent-accept").boundingBox())!, (await banner.getByTestId("consent-reject").boundingBox())!];
    expect(Math.abs(accept.width - reject.width)).toBeLessThan(2);
    expect(Math.abs(accept.height - reject.height)).toBeLessThan(2);
    await banner.getByTestId("consent-more").click();
    await expect(banner.getByTestId("consent-categories")).toContainText("3. Marketingové a remarketingové cookies");
    // Google Consent Mode v2: výchozí stav před volbou
    const defaults = await page.evaluate(() => JSON.stringify((window as unknown as { dataLayer?: unknown[] }).dataLayer?.[0] ?? null));
    expect(defaults).toContain('"consent"');
    expect(defaults).toContain('"default"');
    expect(defaults).toContain('"analytics_storage":"denied"');
    expect(defaults).toContain('"ad_user_data":"denied"');

    const saved = page.waitForResponse((response) => response.url().endsWith("/api/consent") && response.request().method() === "POST");
    await banner.getByRole("button", { name: "Rozumím a přijímám" }).click();
    expect((await saved).status()).toBe(201);
    await expect(banner).toHaveCount(0);
    expect(await consentCookie(page)).toMatch(/^v2\.a1m1\.\d+\./);
    const stored = JSON.parse((await page.evaluate(() => window.localStorage.getItem("eldock_cookie_consent_v1"))) ?? "null") as { necessary: boolean; analytics: boolean; marketing: boolean; decidedAt: string } | null;
    expect(stored).toMatchObject({ necessary: true, analytics: true, marketing: true });
    expect(Number.isNaN(Date.parse(stored!.decidedAt))).toBe(false);
    // Se souhlasem s analytikou vznikne pseudonymní id prohlížeče pro produktovou analytiku
    await page.goto("/navody");
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem("eldock_vid"))).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);

    // Změna volby z patičky: Podrobné nastavení → bez marketingu → Uložit vybrané
    await page.getByRole("contentinfo").getByTestId("consent-settings-link").click();
    const dialog = page.getByTestId("consent-settings");
    await expect(dialog).toContainText("1. Nezbytné technické a funkční cookies");
    await expect(dialog.getByTestId("consent-toggle-necessary")).toBeDisabled();
    await dialog.getByTestId("consent-toggle-marketing").uncheck();
    await dialog.getByTestId("consent-save").click();
    await expect.poll(() => consentCookie(page)).toMatch(/^v2\.a1m0\./);
  });

  test("„Odmítnout vše“ uloží jen nezbytné – bez pseudonymního id; „Podrobné nastavení“ s přepínači kategorií", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByTestId("consent-banner");
    await banner.getByRole("button", { name: "Podrobné nastavení" }).click();
    const dialog = page.getByTestId("consent-settings");
    await expect(dialog.getByTestId("consent-toggle-analytics")).not.toBeChecked();
    await expect(dialog.getByTestId("consent-toggle-marketing")).not.toBeChecked();
    await expect(dialog.getByRole("button", { name: "Uložit vybrané" })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByTestId("consent-banner").getByRole("button", { name: "Odmítnout vše" }).click();
    await expect(page.getByTestId("consent-banner")).toHaveCount(0);
    expect(await consentCookie(page)).toMatch(/^v2\.a0m0\./);
    await page.goto("/navody");
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => window.localStorage.getItem("eldock_vid"))).toBeNull();
    expect(JSON.parse((await page.evaluate(() => window.localStorage.getItem("eldock_cookie_consent_v1"))) ?? "{}")).toMatchObject({ necessary: true, analytics: false, marketing: false });
  });
});

test.describe("telemetrie, kontakt v ukázkové firmě a velín", () => {
  // Firma Tester (ukázková) s uloženou volbou cookies, ale bez zadaného kontaktu – okno kontaktu se ukáže
  const state = JSON.parse(readFileSync(E2E_AUTH_STATE, "utf8")) as { cookies: { name: string }[]; origins: unknown[] };
  test.use({ storageState: { ...state, cookies: state.cookies.filter((cookie) => cookie.name !== "eldock_lead") } as never });

  test("📡 /api/telemetry přijme platnou událost (204), neplatnou odmítne (400); stránka pošle page_view", async ({ page, request }) => {
    expect((await request.post("/api/telemetry", { data: { type: "sandbox_started", path: "/panel-builder/floorplan", props: { sandbox: "2D Půdorys 4+kk" }, utm: { source: "linkedin" } } })).status()).toBe(204);
    expect((await request.post("/api/telemetry", { data: { type: "page_view", path: "/", referrer: "https://search.seznam.cz", landing: true } })).status()).toBe(204);
    expect((await request.post("/api/telemetry", { data: { type: "page_view", path: "/?token=x" } })).status()).toBe(400);
    expect((await request.post("/api/telemetry", { data: "{rozbité" })).status()).toBe(400);
    // sendBeacon: Playwright tělo požadavku nevidí – stačí, že stránka událost odeslala (uložení ověřuje velín níže)
    const beacon = page.waitForRequest((request) => request.url().endsWith("/api/telemetry") && request.method() === "POST", { timeout: 60_000 });
    await page.goto("/navody");
    expect((await beacon).method()).toBe("POST");
  });

  test("📩 export XLSX kusovníku za ukázkovou firmu: okno kontaktu → e-mail → soubor se stáhne a kontakt je ve velínu", async ({ page }) => {
    test.setTimeout(420_000);
    await page.setViewportSize({ width: 1536, height: 864 });
    await page.addInitScript(() => window.localStorage.setItem("eldock-floorplan-ui-mode", "wizard"));
    await expect(async () => {
      await page.goto("/panel-builder/floorplan?demo=rd-4kk");
      await expect(page.getByTestId("floorplan-canvas")).toBeVisible({ timeout: 30_000 });
    }).toPass({ timeout: 300_000 });
    await goPhase(page, 5);
    await rightTab(page, "bom");
    await page.getByTestId("wiring-bom-open").click();
    await page.getByTestId("wiring-bom-xlsx").click();
    const modal = page.getByTestId("lead-capture");
    await expect(modal).toContainText("📩 Kam vám máme poslat hotový kusovník a PDF dokumentaci?");
    await expect(modal).toContainText("Export XLSX kusovníku");
    await expect(modal.getByTestId("lead-marketing")).not.toBeChecked();
    await expect(modal.getByRole("button", { name: /Stáhnout dokumentaci & získat 1 testovací projekt zdarma/ })).toBeVisible();
    const email = `e2e-lead-${Date.now()}@eldock.test`;
    await modal.getByTestId("lead-email").fill(email);
    await modal.getByTestId("lead-role-designer").click();
    const download = page.waitForEvent("download");
    await modal.getByTestId("lead-submit").click();
    expect((await download).suggestedFilename()).toBe("kusovnik-domovni-instalace.xlsx");
    await expect(modal).toHaveCount(0);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "eldock_lead" && cookie.value === "1")).toBe(true);
    // Podruhé už bez okna
    const again = page.waitForEvent("download");
    await page.getByTestId("wiring-bom-csv").click();
    expect((await again).suggestedFilename()).toBe("kusovnik-domovni-instalace.csv");
    await expect(page.getByTestId("lead-capture")).toHaveCount(0);

    // 📈 Velín: trychtýř, kontakt s tím, co testoval, a export CSV
    await page.goto("/superadmin");
    await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
    await page.getByLabel("Heslo velínu").fill("eldock2026");
    await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
    await page.getByRole("link", { name: "📈 Návštěvnost, Leady & Tržní data" }).click();
    const market = page.getByTestId("superadmin-market");
    await expect(market).toBeVisible({ timeout: 60_000 });
    await expect(market.getByRole("heading", { name: "📈 Návštěvnost, Leady & Tržní data" })).toBeVisible();
    await expect(market.getByTestId("market-funnel")).toContainText("Spuštěný trenažér / demo");
    await expect(market.getByTestId("market-funnel")).toContainText("2D Půdorys 4+kk");
    const lead = market.getByTestId("market-lead").filter({ hasText: email });
    await expect(lead).toContainText("projektant");
    await expect(lead).toContainText("2D půdorys");
    await expect(market.getByTestId("market-consent")).toContainText("Přijato vše");
    await expect(market.getByTestId("market-brands")).toContainText("Oblíbenost designových řad vypínačů");
    const csv = await page.request.get("/superadmin/leads-export");
    expect(csv.status()).toBe(200);
    expect(await csv.text()).toContain(email);
    await page.screenshot({ path: "test-results/phase102-market.png", fullPage: true });
  });
});
