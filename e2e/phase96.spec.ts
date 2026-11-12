import { expect, test } from "@playwright/test";
import { PUBLIC_STATE } from "./auth";

// Fáze 96: viditelnost ve vyhledávačích – nepřihlášený robot (Googlebot, bez cookies) dostane 200 bez přesměrování
// na veřejných stránkách, vstupní stránce a katalogu AI Panel Builderu, 5 SEO stránkách, robots.txt, sitemap.xml
// a klíči IndexNow; SEO stránka má H1, FAQ a JSON-LD, náhled oteplení počítá.
test.describe.configure({ mode: "serial" });
test.use({ storageState: PUBLIC_STATE, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" });

const LANDINGS = ["/ai-panel-builder", "/2d-pudorys-elektroinstalace", "/vypocet-otepleni-rozvadece", "/kusova-zkouska-rozvadece", "/prumyslova-udrzba-a-revize"];
const KEY = "691cb2cf48b1a728710c6a7aa654013e";

test("🔎 robot bez přihlášení: 200 bez přesměrování na veřejných stránkách, katalogu, robots.txt, sitemap.xml a klíči IndexNow", async ({ request }) => {
  test.setTimeout(600_000);
  for (const pathname of [...LANDINGS, "/panel-builder/catalog", "/panel-builder", "/", "/navody", "/ukazka-elaboratu", "/robots.txt", "/sitemap.xml", `/${KEY}.txt`]) {
    // Dev server stránku napoprvé překládá – opakovat do úspěchu, přesměrování se ale nepovoluje
    await expect(async () => {
      const response = await request.get(pathname, { maxRedirects: 0, timeout: 120_000 });
      expect(response.status(), pathname).toBe(200);
    }).toPass({ timeout: 240_000 });
  }
  const robots = await (await request.get("/robots.txt")).text();
  for (const bot of ["*", "Googlebot", "SeznamBot", "bingbot", "OAI-SearchBot", "GPTBot", "PerplexityBot", "ClaudeBot"]) expect(robots).toContain(`User-Agent: ${bot}`);
  expect(robots).toContain("Allow: /");
  expect(robots).toContain("Disallow: /api/");
  expect(robots).toContain("Disallow: /superadmin");
  expect(robots).toContain("Sitemap: https://eldock.cz/sitemap.xml");
  expect(robots).toContain("Host: https://eldock.cz");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const pathname of LANDINGS) expect(sitemap).toContain(`<loc>https://eldock.cz${pathname}</loc>`);
  expect(sitemap).toContain("<loc>https://eldock.cz/panel-builder/catalog</loc>");
  expect((await (await request.get(`/${KEY}.txt`)).text()).trim()).toBe(KEY);
  // Editor půdorysu dál vyžaduje přihlášenou firmu
  expect((await request.get("/panel-builder/floorplan", { maxRedirects: 0 })).status()).toBe(307);
});

test("📄 SEO stránka: H1, FAQ, JSON-LD FAQPage, tlačítko vyzkoušení; interaktivní náhled oteplení; patička s odkazy", async ({ page }) => {
  test.setTimeout(300_000);
  await expect(async () => {
    await page.goto("/vypocet-otepleni-rozvadece");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Výpočet oteplení rozváděče dle ČSN EN IEC 61439 a IEC TR 60890", { timeout: 20_000 });
  }).toPass({ timeout: 240_000 });
  expect(await page.locator('[data-testid="seo-faq"]').count()).toBeGreaterThanOrEqual(4);
  const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
  expect(ld.some((text) => text.includes('"FAQPage"'))).toBe(true);
  expect(ld.some((text) => text.includes('"SoftwareApplication"') && text.includes('"CADSoftware"'))).toBe(true);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://eldock.cz/vypocet-otepleni-rozvadece");
  // Náhled výpočtu: vyšší ztrátový výkon = vyšší oteplení
  const preview = page.getByTestId("thermal-preview");
  const before = await preview.getByTestId("thermal-result").innerText();
  await preview.getByTestId("thermal-loss-input").fill("300");
  await expect(preview.getByTestId("thermal-loss")).toHaveText("300 W");
  await expect(preview.getByTestId("thermal-result")).not.toHaveText(before);
  // Patička: přímé odkazy na všechny vstupní stránky, katalog a návody
  const footer = page.getByTestId("site-footer");
  for (const pathname of [...LANDINGS, "/panel-builder/catalog"]) await expect(footer.locator(`a[href="${pathname}"]`)).toHaveCount(1);
  // Video-návody jsou v patičce i ve sloupci Domovní elektroinstalace
  expect(await footer.locator('a[href="/navody"]').count()).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: "test-results/phase96-thermal.png", fullPage: true });

  // Veřejná vstupní stránka AI Panel Builderu a katalog jen ke čtení
  await page.goto("/panel-builder");
  await expect(page.getByTestId("panel-builder-public")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("AI Panel Builder – návrh rozváděče online");
  await page.goto("/panel-builder/catalog");
  await expect(page.getByTestId("catalog-public-login")).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: "test-results/phase96-catalog.png" });
});
