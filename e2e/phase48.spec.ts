import { expect, test } from "@playwright/test";

// Fáze 48: správa projektů Panel Builderu (soupis místností, úprava hlavičky, mazání jednotlivě
// i hromadně), stav kroků, záložky karty zařízení v jednom řádku, technické SEO a ukázka elaborátu.
test.describe.configure({ mode: "serial" });

const credits = async (page: import("@playwright/test").Page) => Number(/Kredity: (\d+)/.exec((await page.getByTestId("panel-credits").textContent()) ?? "")?.[1] ?? NaN);

test("🏠 rozváděč ze soupisu místností, ✓ stav kroků, ✏️ hlavička a 🗑️ smazání s vrácením kreditu", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.setViewportSize({ width: 1440, height: 1200 });
  await expect(async () => {
    await page.goto("/panel-builder");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("AI Panel Builder", { timeout: 5_000 });
  }).toPass({ timeout: 60_000 });
  const before = await credits(page);

  await page.getByRole("button", { name: "Nový projekt rozváděče" }).click();
  await page.getByRole("button", { name: /Vygenerovat rozváděč ze soupisu okruhů/ }).click();
  await expect(page.getByTestId("schedule-editor")).toBeVisible();
  await page.getByLabel("Název rozváděče").fill("RD48 ze soupisu");
  await page.getByLabel("Místo instalace").fill("Jablonec, Mírové nám. 1");
  await page.getByRole("button", { name: "🏠 Vygenerovat rozváděč", exact: true }).click();
  await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("RD48 ze soupisu");
  await expect(page.getByTestId("symbol--Q1")).toBeVisible();
  await expect(page.getByText("📍 Jablonec, Mírové nám. 1")).toBeVisible();

  // Kroky projektu se stavem: osazení je hotové, dokumentace rozpracovaná
  const steps = page.getByRole("navigation", { name: "Kroky projektu" });
  await expect(steps.locator('[data-step="recognition"]')).toHaveAttribute("data-done", "true");
  await expect(steps.locator('[data-step="recognition"]')).toContainText("✓ Hotovo");
  await expect(steps.locator('[data-step="documentation"]')).toContainText("Rozpracováno");

  // Přehled: hledání + ✏️ úprava hlavičky
  await page.goto("/panel-builder");
  await expect(page.getByTestId("panel-credits")).toContainText(`Kredity: ${before - 1}`);
  await page.getByRole("textbox", { name: "Hledat projekt" }).fill("mirove nam");
  const card = page.getByTestId("project-list").locator("li");
  await expect(card).toHaveCount(1);
  await card.getByRole("button", { name: /Upravit hlavičku projektu/ }).click();
  await page.getByLabel("Název rozváděče").fill("RD48 – přejmenováno");
  await page.getByLabel("Zákazník").fill("Novák");
  await page.getByRole("button", { name: "Uložit hlavičku" }).click();
  await expect(card).toContainText("RD48 – přejmenováno");
  await expect(card).toContainText("Novák");

  // 🗑️ Smazat tento projekt z detailu → zpět na přehled, kredit vrácen
  await card.getByRole("link").click();
  await page.getByTestId("delete-project").click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
  await expect(page.getByTestId("panel-credits")).toContainText(`Kredity: ${before}`);
  await page.getByRole("textbox", { name: "Hledat projekt" }).fill("RD48");
  await expect(page.getByText("Žádný projekt neodpovídá hledání.")).toBeVisible();
});

test("☑️ hromadný výběr: vzorový PB-001 je chráněný, vybrané testovací projekty se smažou", async ({ page }) => {
  page.on("dialog", (dialog) => void dialog.accept());
  await page.goto("/panel-builder");
  // Dva rychlé testovací návrhy
  for (const name of ["test-48a", "test-48b"]) {
    await page.getByRole("button", { name: "Nový projekt rozváděče" }).click();
    await page.getByLabel("Název rozváděče").fill(name);
    await page.getByRole("button", { name: "📐 Založit návrh rozváděče" }).click();
    await expect(page).toHaveURL(/\/panel-builder\/[^/]+$/, { timeout: 30_000 });
    await page.goto("/panel-builder");
  }
  await expect(page.getByTestId("project-PB-001")).toContainText("Vzorový projekt");
  await page.getByRole("radio", { name: "Rozpracované" }).click();
  await page.getByRole("button", { name: /Hromadný výběr/ }).click();
  await expect(page.getByRole("checkbox", { name: "Vybrat projekt PB-001" })).toBeDisabled();
  await page.getByRole("textbox", { name: "Hledat projekt" }).fill("test-48");
  for (const checkbox of await page.getByTestId("project-list").getByRole("checkbox").all()) await checkbox.check();
  await expect(page.getByTestId("bulk-delete")).toContainText("(2)");
  await page.getByTestId("bulk-delete").click();
  await expect(page.getByText("Žádný projekt neodpovídá hledání.")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("textbox", { name: "Hledat projekt" }).fill("");
  await page.getByRole("radio", { name: "Vše" }).click();
  await expect(page.getByTestId("project-PB-001")).toBeVisible();
});

test("karta zařízení: záložky v jednom řádku i na notebooku 1280 px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/equipment/eq-rh1");
  const tabs = page.getByTestId("equipment-tabs").getByRole("tablist");
  await expect(tabs).toBeVisible({ timeout: 30_000 });
  const first = await tabs.getByRole("tab").first().boundingBox();
  const last = await tabs.getByRole("tab").last().boundingBox();
  expect(Math.abs((last?.y ?? 0) - (first?.y ?? 0))).toBeLessThan(4);
});

test.describe("veřejná část bez přihlášení", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("SEO: robots.txt, sitemap.xml, náhled odkazu, metadata a JSON-LD", async ({ page, request }) => {
    const robotsTxt = await (await request.get("/robots.txt")).text();
    expect(robotsTxt).toContain("Disallow: /equipment/");
    expect(robotsTxt).toContain("Allow: /panel-builder/auth");
    expect(robotsTxt).toContain("Sitemap: https://eldock.cz/sitemap.xml");
    expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>https://eldock.cz/ukazka-elaboratu</loc>");
    const og = await request.get("/opengraph-image");
    expect(og.status()).toBe(200);
    expect(og.headers()["content-type"]).toContain("image/png");

    await page.goto("/");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://eldock.cz");
    await expect(page.locator('meta[property="og:image"]').first()).toHaveAttribute("content", /opengraph-image/);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? "{}") as { "@graph": { "@type": string }[] };
    expect(ld["@graph"].map((node) => node["@type"])).toEqual(["Organization", "SoftwareApplication"]);
  });

  test("📄 vzorový 6listový elaborát na úvodní stránce bez registrace", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("sample-elaborate").click();
    const frame = page.frameLocator('iframe[title="Vzorový 6listový elaborát rozváděče"]');
    await expect(frame.getByTestId("doc-sheet-1")).toBeVisible({ timeout: 30_000 });
    await page.goto("/ukazka-elaboratu");
    for (let sheet = 1; sheet <= 6; sheet++) await expect(page.getByTestId(`doc-sheet-${sheet}`)).toBeVisible();
    await expect(page.getByTestId("doc-sheet-1")).toContainText("PB-001");
  });
});
