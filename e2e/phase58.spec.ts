import { expect, test } from "@playwright/test";

// Fáze 58: úvod „proč Eldock vznikl“ s rozcestníkem Domovní elektroinstalace / Průmysl a mapou webu; značky přístrojů
// dle ČSN EN 60617 s legendou a náhledem datasheetu.

test.describe("fáze 58 – veřejný web", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("úvod: proč Eldock vznikl, vlevo domovní elektroinstalace, vpravo průmysl, obě části s drobečkovou navigací a mapou webu", async ({ page, request }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await expect(page.getByTestId("mission")).toContainText("Eldock vznikl");
    const chooser = page.getByTestId("segment-chooser");
    const home = chooser.getByTestId("segment-domov");
    const industry = chooser.getByTestId("segment-prumysl");
    // domovní vlevo, průmysl vpravo
    expect((await home.boundingBox())!.x).toBeLessThan((await industry.boundingBox())!.x);
    await expect(page.getByRole("navigation", { name: "Hlavní navigace" }).getByRole("link", { name: "Průmysl" })).toHaveAttribute("href", "/prumysl");

    await home.getByTestId("segment-link-domov").click();
    await expect(page).toHaveURL(/\/domovni-elektroinstalace$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("dokumentace domovní elektroinstalace");
    await expect(page.getByTestId("breadcrumbs")).toContainText("Domovní elektroinstalace");
    await expect(page.getByTestId("product-panel-builder")).toBeVisible();
    await expect(page.getByTestId("segment-floorplan")).toContainText("ČSN EN 60617-11");
    const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(ld).toContain("BreadcrumbList");

    await page.getByTestId("cross-link-prumysl").click();
    await expect(page).toHaveURL(/\/prumysl$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("výrobního závodu");
    for (const name of ["Čtyři pilíře systému", "Jeden systém pro celý závod", "Od šanonů a Excelu k živé dokumentaci"]) await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByTestId("product-plant")).toBeVisible();

    // Mapa webu v patičce (i na právních stránkách) a sitemap.xml
    const footer = page.getByTestId("site-footer");
    for (const href of ["/domovni-elektroinstalace", "/prumysl#udrzba", "/register-plant", "/ochrana-osobnich-udaju"]) await expect(footer.locator(`a[href="${href}"]`).first()).toBeAttached();
    await page.goto("/ochrana-osobnich-udaju");
    await expect(page.getByTestId("site-footer").locator('a[href="/prumysl"]').first()).toBeAttached();
    const sitemap = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/domovni-elektroinstalace", "/prumysl"]) expect(sitemap).toContain(`<loc>https://eldock.cz${path}</loc>`);
  });
});

test("značky přístrojů: knihovna ČSN EN 60617, legenda na Listu 3 a náhled datasheetu u každého přístroje PB-001", async ({ page }) => {
  await expect(async () => {
    await page.goto("/panel-builder/catalog/znacky");
    await expect(page.getByRole("heading", { level: 1, name: "Knihovna značek ČSN EN 60617" })).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 120_000 });
  for (const kind of ["MCB", "RCD", "RCBO", "SWITCH_DISCONNECTOR", "SPD", "CONTACTOR", "RELAY_IMPULSE", "RELAY_STAIRCASE"]) await expect(page.getByTestId(`library-symbol-${kind}`)).toBeVisible();
  await expect(page.getByTestId("library-floorplan")).toContainText("Jednozásuvka");

  await page.goto("/panel-builder");
  await page.getByRole("link", { name: /PB-001/ }).click();
  await page.getByRole("link", { name: /4\. Výstupní dokumentace/ }).click();
  const list = page.getByTestId("symbol-datasheets");
  await expect(list.getByTestId("symbol-row").first()).toBeVisible();
  // vzorový rozváděč: hlavní vypínač = odpínač, jističe, chrániče a přepěťová ochrana
  for (const kind of ["SWITCH_DISCONNECTOR", "MCB", "RCD", "SPD"]) await expect(list.locator(`[data-symbol-kind="${kind}"]`).first()).toBeAttached();
  await expect(page.getByTestId("doc-symbol-legend")).toContainText("Jistič");
  await expect(page.getByTestId("doc-symbol-legend")).toContainText("ČSN EN 60617-7");

  await list.locator('[data-symbol-kind="MCB"]').first().getByTestId("datasheet-open").click();
  const dialog = page.getByTestId("datasheet-dialog");
  await expect(dialog.getByTestId("datasheet-symbol")).toContainText("Jistič");
  await expect(dialog.getByTestId("datasheet-params")).toContainText("Jmenovitý proud In");
  await expect(dialog.getByTestId("datasheet-links").getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
  await page.keyboard.press("Escape");

  // Katalog: náhled datasheetu u každého prvku
  await page.goto("/panel-builder/catalog?q=S201");
  await expect(page.getByTestId("datasheet-open").first()).toBeVisible();
});
