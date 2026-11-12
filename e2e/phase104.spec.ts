import { expect, test } from "@playwright/test";

// Fáze 104: ochrana know-how a katalogových dat – doložka zák. č. 121/2000 Sb. v patičce a v ukázce elaborátu, bez
// hlavičky X-Powered-By, kopírovací roboti mimo veřejné SEO stránky 403, robots.txt, katalog skříní s fotkami ze serveru
// i bez přihlášení a katalogová data výrobců (index fotek, EAN) jen pro přihlášené.
test.describe.configure({ mode: "serial" });

const NOTICE =
  "© 2026 ELDOCK.cz – Všechna práva vyhrazena. Databáze prvků, výpočtové algoritmy a struktura dokumentace jsou chráněny autorským právem a zvláštním právem pořizovatele databáze dle zák. č. 121/2000 Sb. Automatizované vytěžování (scraping) a reverzní inženýrství je zakázáno.";
const HTTRACK = "Mozilla/4.5 (compatible; HTTrack 3.0x; Windows 98)";

test.describe("veřejný web bez přihlášení", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("patička s doložkou a bez X-Powered-By; HTTrack / python-requests na aplikační cestě 403, na SEO stránce 200; robots.txt", async ({ page, request }) => {
    test.setTimeout(180_000);
    const response = await page.goto("/");
    expect(response?.headers()["x-powered-by"]).toBeUndefined();
    await expect(page.getByTestId("ip-notice")).toHaveText(NOTICE);
    const blocked = await request.get("/panel-builder/floorplan", { headers: { "user-agent": HTTRACK }, maxRedirects: 0 });
    expect(blocked.status()).toBe(403);
    expect(await blocked.text()).toContain("121/2000 Sb.");
    expect((await request.get("/api/catalog-images/manifest", { headers: { "user-agent": "python-requests/2.32.3" } })).status()).toBe(403);
    expect((await request.get("/", { headers: { "user-agent": HTTRACK } })).status()).toBe(200);
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toMatch(/User-Agent: HTTrack\s+Disallow: \//i);
    expect(robots).toMatch(/User-Agent: python-requests\s+Disallow: \//i);
  });

  test("ukázka elaborátu má doložku v zápatí listů", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/ukazka-elaboratu");
    await expect(page.getByTestId("doc-ip-notice").first()).toContainText("zák. č. 121/2000 Sb.", { timeout: 60_000 });
  });

  test("katalog skříní ukáže fotky výrobců ze serveru; index fotek a EAN nepřihlášenému server nevydá", async ({ page, request }) => {
    test.setTimeout(180_000);
    // Skupina „Rozvodnice a skříně rozváděčů“ výrobce ABB (tabulka skříní s fotkami výrobce)
    await page.goto("/panel-builder/catalog?brand=ABB&group=ENCLOSURE");
    await expect(page.getByTestId("enclosure-photo").first()).toBeAttached({ timeout: 60_000 });
    expect(await page.getByTestId("enclosure-photo").first().getAttribute("data-src")).toMatch(/^\/catalog-images\/.+\/enclosures\/.+\.webp$/);
    expect((await request.post("/api/catalog-images/lookup", { data: { items: [{ kind: "box", key: "KPR 68_KA" }] } })).status()).toBe(401);
    const manifest = await (await request.get("/api/catalog-images/manifest")).json();
    expect(manifest.catalog).toEqual([]);
  });
});
