import { expect, test, type APIRequestContext, type Browser, type BrowserContext } from "@playwright/test";

import { toast } from "./helpers";

// Fáze 68: vlastník souborů – demo, firma Panel Builderu a registrovaná firma Správy závodů si navzájem nepřečtou
// nahrané soubory; logo firmy jen v Panel Builderu se zobrazí (brána pustí soubory každému přihlášení); velín: ruční záloha.
test.describe.configure({ mode: "serial" });

const PNG_1X1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
const COMPANY = { name: "Eva Strojníková", email: "eva@strojirna-pisek.example", password: "Strojirna-Pisek-2026" };

async function upload(request: APIRequestContext, scope?: "panel") {
  const response = await request.post("/api/uploads", {
    multipart: { kind: "photo", ...(scope ? { scope } : {}), file: { name: "foto.jpg", mimeType: "image/jpeg", buffer: Buffer.from(`e2e-foto-${Date.now()}-${Math.random()}`) } },
  });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { url: string }).url;
}

const status = async (request: APIRequestContext, url: string) => (await request.get(url)).status();

async function emptyContext(browser: Browser) {
  return browser.newContext({ storageState: { cookies: [], origins: [] } });
}

/** Jen přihlášení do AI Panel Builderu – ukázková firma Tester bez přihlášení do závodu. */
async function panelOnly(browser: Browser): Promise<BrowserContext> {
  const context = await emptyContext(browser);
  const page = await context.newPage();
  await page.goto("/panel-builder/auth");
  await page.getByRole("button", { name: "Vyzkoušet ukázkovou firmu" }).click();
  await expect(page).toHaveURL(/\/panel-builder$/, { timeout: 30_000 });
  return context;
}

/** Jen obchodní demo Správy závodů (heslo dema). */
async function demoOnly(browser: Browser): Promise<BrowserContext> {
  const context = await emptyContext(browser);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Heslo / PIN").fill("eldock2026");
  await page.getByRole("button", { name: /Přihlásit/ }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
  return context;
}

/** Nově registrovaná firma Správy závodů (vlastní závod). */
async function registeredCompany(browser: Browser): Promise<BrowserContext> {
  const context = await emptyContext(browser);
  const page = await context.newPage();
  await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: "12345679", companyName: "Strojírna Písek s.r.o.", dic: "CZ12345679", street: "Budějovická 8", city: "Písek", zip: "397 01" } }));
  await page.goto("/register-plant");
  await page.getByLabel("IČO").fill("12345679");
  await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Strojírna Písek s.r.o.");
  await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(COMPANY.name);
  await page.getByLabel("Telefon").fill("+420 777 222 333");
  await page.getByLabel("Název prvního závodu").fill("Závod Písek – Lisovna");
  await page.getByLabel("E-mail (přihlášení)").fill(COMPANY.email);
  await page.getByLabel("Heslo (min. 10 znaků)").fill(COMPANY.password);
  await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
  await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
  await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
  return context;
}

test("soubory podle vlastníka: demo, firma Panel Builderu a registrovaná firma si navzájem nepřečtou nahrané soubory", async ({ page, browser }) => {
  // Výchozí přihlášení testů = obchodní demo závodu + ukázková firma Panel Builderu
  await page.goto("/app");
  const demoFile = await upload(page.request);
  const panelFile = await upload(page.request, "panel");
  expect(await status(page.request, demoFile)).toBe(200);
  expect(await status(page.request, panelFile)).toBe(200);

  const [pb, demo, company, anonymous] = await Promise.all([panelOnly(browser), demoOnly(browser), registeredCompany(browser), emptyContext(browser)]);
  const companyFile = await upload(company.request);

  // Soubor dema: jen demo účty
  expect(await status(demo.request, demoFile)).toBe(200);
  expect(await status(pb.request, demoFile)).toBe(404);
  expect(await status(company.request, demoFile)).toBe(404);
  expect(await status(anonymous.request, demoFile)).toBe(401);
  // Soubor firmy Panel Builderu: jen její přihlášení
  expect(await status(pb.request, panelFile)).toBe(200);
  expect(await status(demo.request, panelFile)).toBe(404);
  expect(await status(company.request, panelFile)).toBe(404);
  // Soubor registrované firmy: jen její zaměstnanci
  expect(await status(company.request, companyFile)).toBe(200);
  expect(await status(demo.request, companyFile)).toBe(404);
  expect(await status(pb.request, companyFile)).toBe(404);
  expect(await status(page.request, companyFile)).toBe(404);
  // Vzorové soubory demo dat (seed) čte každé přihlášení
  for (const context of [pb, demo, company]) await context.close();
  await anonymous.close();
});

test("logo firmy jen v Panel Builderu se zobrazí (brána pustí soubory firmě) a demo ho nepřečte", async ({ browser }) => {
  const pb = await panelOnly(browser);
  const page = await pb.newPage();
  await page.goto("/panel-builder/company");
  await page.getByLabel("Soubor s logem").setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: PNG_1X1 });
  await expect(toast(page)).toContainText("Logo uloženo");
  const logo = page.getByTestId("logo-preview").locator("img");
  await expect.poll(() => logo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 20_000 }).toBe(true);
  const src = (await logo.getAttribute("src"))!;
  expect(src).toMatch(/^\/api\/files\/documents\/[\w-]+\.png$/);

  const demo = await demoOnly(browser);
  expect(await status(demo.request, src)).toBe(404);
  await demo.close();

  // Úklid: ukázková firma zůstane bez loga (ostatní testy ho nečekají)
  await page.getByRole("region", { name: "Firemní logo" }).getByRole("button", { name: "Odebrat" }).click();
  await expect(toast(page)).toContainText("Logo odebráno");
  await pb.close();
});

test("velín → Zálohy a data: ruční záloha vytvoří snímek databáze a ukáže registr souborů", async ({ page }) => {
  await page.goto("/superadmin");
  await expect(page).toHaveURL(/\/superadmin\/login/, { timeout: 60_000 });
  await page.getByLabel("Heslo velínu").fill("eldock2026");
  await page.getByRole("button", { name: "Vstoupit do velínu" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("SuperAdmin velín", { timeout: 60_000 });
  await page.getByRole("link", { name: "Zálohy a data" }).click();
  const tab = page.getByTestId("superadmin-backups");
  await expect(tab).toBeVisible();
  await expect(page.getByTestId("backup-config")).toContainText("vypnuté (chybí ELDOCK_BACKUP_KEY)");
  await expect(page.getByTestId("file-registry")).toContainText("Obchodní demo");

  await page.getByTestId("backup-now").click();
  await expect(toast(page)).toContainText("Záloha spuštěna");
  await expect(async () => {
    await page.reload();
    await expect(page.getByTestId("backup-runs")).toContainText("v pořádku", { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("local-snapshots")).toContainText(/eldock-\d{8}T\d{6}Z\.db\.gz/);
  await expect(page.getByTestId("backup-runs")).toContainText("Záloha (velín)");
});
