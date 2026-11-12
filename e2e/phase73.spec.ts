import { createReadStream, existsSync, statSync } from "node:fs";
import http, { type Server } from "node:http";
import path from "node:path";

import { devices, expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

import { createSqlitePrisma } from "../src/lib/sqlite-adapter";
import { PUBLIC_STATE } from "./auth";

// Fáze 73: stejné rozhraní jako mobilní aplikace (apps/client/dist) v telefonním rozvržení (Pixel 7, dotyk) proti
// E2E serveru – spárování kódem z webu, spodní lišta, skenování štítku (bez nativního skeneru záložní dialog
// s ručním zadáním), provizorium s fotkou zadané offline, odeslání po připojení a výsledek na webu. Nativní části
// (Klíčenka/Keystore, skener, zrcadlo fronty) testuje phase73-android.spec.ts v emulátoru.
// Předpoklad: `npm --prefix apps/client run build` (jinak se test přeskočí).
test.describe.configure({ mode: "serial" });

const DIST = path.resolve("apps/client/dist");
const APP_PORT = 5193;
const APP_URL = `http://127.0.0.1:${APP_PORT}/`;
const OWNER = { name: "Petra Údržbová", email: "petra@valcovna-ostrava.example", password: "Jistic-Hala-T7-2026" };
const ICO = "24719358";
const QR = "C7A3E73F10";

const MIME: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".woff2": "font/woff2" };

/** Statický server sestaveného rozhraní (jako WebView mobilní aplikace – soubory z dist/). */
function serveDist(): Promise<Server> {
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? "/", APP_URL).pathname);
    let file = path.normalize(path.join(DIST, pathname));
    if (!file.startsWith(DIST)) return void response.writeHead(403).end();
    if (!existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, "index.html");
    response.writeHead(200, { "content-type": MIME[path.extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(APP_PORT, "127.0.0.1", () => resolve(server)));
}

/** Nic nepřečnívá do strany (telefon bez vodorovného posouvání). */
const noHorizontalScroll = (phone: Page) => phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test.describe("aplikace Eldock v telefonu", () => {
  test.use({ storageState: PUBLIC_STATE });
  test.skip(!existsSync(path.join(DIST, "index.html")), "Rozhraní aplikace není sestavené (npm --prefix apps/client run build)");

  test("spárování, spodní lišta, štítek, provizorium s fotkou offline a odeslání po připojení", async ({ page, browser }) => {
    test.setTimeout(300_000);
    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: ICO, companyName: "Válcovna Ostrava a.s.", dic: `CZ${ICO}`, street: "Hutní 12", city: "Ostrava", zip: "703 00" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill(ICO);
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Válcovna Ostrava a.s.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 444 555");
    await page.getByLabel("Název prvního závodu").fill("Válcovna T7");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

    const prisma = createSqlitePrisma({ url: "file:./e2e.db", strict: true });
    try {
      const { plantId } = await prisma.registeredCompany.findFirstOrThrow({ where: { ico: ICO }, select: { plantId: true } });
      if (!plantId) throw new Error("firma bez závodu");
      await prisma.building.create({ data: { id: "e2e73-hala", plantId, code: "T", name: "Hala válcovací tratě", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
      await prisma.floor.create({ data: { id: "e2e73-1np", buildingId: "e2e73-hala", level: 0, code: "1NP", name: "1. NP" } });
      await prisma.equipment.create({ data: { id: "e2e73-rm", floorId: "e2e73-1np", tag: "RM-T7", name: "Rozváděč válcovací tratě T7", type: "SWITCHBOARD", pinX: 10, pinY: 10, qrToken: QR } });
    } finally {
      await prisma.$disconnect();
    }

    await page.goto("/ucet");
    const card = page.getByTestId("devices-card");
    await card.getByTestId("pair-start").click();
    const code = (await card.getByTestId("pair-code").innerText()).trim();

    const server = await serveDist();
    const phoneContext = await browser.newContext({ ...devices["Pixel 7"], locale: "cs-CZ", timezoneId: "Europe/Prague", storageState: PUBLIC_STATE });
    try {
      const phone = await phoneContext.newPage();
      await phone.goto(APP_URL);
      // Párování: tlačítko pro QR z webu (bez fotoaparátu adresa a kód ručně)
      await expect(phone.getByTestId("pair-scan")).toBeVisible();
      await phone.getByTestId("pair-server-input").fill("http://localhost:3200");
      await phone.getByTestId("pair-code-input").fill(code);
      await phone.getByTestId("pair-name-input").fill("Telefon údržby T7");
      await phone.getByTestId("pair-submit").click();
      await expect(phone.getByTestId("sync-status")).toContainText("Synchronizováno", { timeout: 90_000 });
      await expect(card.getByTestId("pair-done")).toBeVisible({ timeout: 20_000 });
      await expect(card.getByTestId("my-devices")).toContainText("Telefon údržby T7");

      // Telefonní rozvržení: spodní lišta místo tlačítek hlavičky, nic nepřečnívá
      await expect(phone.getByTestId("mobile-nav")).toBeVisible();
      await expect(phone.getByTestId("open-queue")).toBeHidden();
      expect(await noHorizontalScroll(phone)).toBe(true);
      await phone.getByTestId("floors-toggle").click();
      await expect(phone.getByTestId("floor-e2e73-1np")).toBeVisible();

      // Skenovat ze spodní lišty: bez nativního skeneru záložní dialog – text štítku ručně
      await phone.getByTestId("nav-scan").click();
      const scanDialog = phone.getByTestId("scan-dialog");
      await expect(scanDialog).toBeVisible();
      await scanDialog.getByLabel("Text štítku").fill(`http://localhost:3200/equipment/e2e73-rm?qr=${QR}`);
      await scanDialog.getByRole("button", { name: "Najít" }).click();
      await expect(phone.getByTestId("equipment-tag")).toHaveText("RM-T7");
      await expect(scanDialog).toBeHidden();
      expect(await noHorizontalScroll(phone)).toBe(true);

      // V hale bez signálu: provizorium s fotkou z galerie (dialog je spodní panel)
      await phoneContext.setOffline(true);
      await expect(phone.getByTestId("sync-status")).toContainText("Offline");
      await phone.getByTestId("action-temp-mod").click();
      const sheet = phone.getByTestId("temporary-mod-dialog");
      await expect(sheet).toBeVisible();
      const box = await sheet.boundingBox();
      const viewport = phone.viewportSize();
      expect(box && viewport ? Math.abs(box.y + box.height - viewport.height) : 99).toBeLessThan(2);
      await expect(sheet.getByTestId("photo-camera")).toBeVisible();
      await phone.getByTestId("temporary-mod-title").fill("Přemostění koncového spínače T7");
      await phone.getByTestId("temporary-mod-description").fill("Zapsáno z telefonu offline, hlídá obsluha tratě");
      const photo = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#facc15" } }).jpeg().toBuffer();
      await sheet.getByTestId("photo-input").setInputFiles({ name: "spinac.jpg", mimeType: "image/jpeg", buffer: photo });
      await expect(sheet.getByTestId("photo-previews").locator("img")).toHaveCount(1);
      await phone.getByTestId("temporary-mod-submit").click();
      await expect(phone.getByTestId("pending-for-equipment").getByText("Čeká na odeslání")).toHaveCount(1);

      // Úpravy ve spodní liště: čeká 1, po připojení odejde a vrátí číslo provizoria
      await phone.getByTestId("nav-queue").click();
      await expect(phone.getByTestId("queue-pending")).toContainText("Nové provizorium – RM-T7");
      await phoneContext.setOffline(false);
      await phone.getByTestId("sync-now").click();
      await expect(phone.getByTestId("queue-applied")).toContainText(/PROV-\d{4}-\d{4}/, { timeout: 90_000 });
      const number = (await phone.getByTestId("queue-applied").innerText()).match(/PROV-\d{4}-\d{4}/)?.[0];
      expect(number).toBeTruthy();

      // Přehled ze spodní lišty → detail s provizoriem a fotkou ze serveru
      await phone.getByTestId("nav-home").click();
      await phone.getByTestId("search-input").fill("RM-T7");
      await phone.getByTestId("search-input").press("Enter");
      await expect(phone.getByTestId("temporary-mods")).toContainText(number ?? "PROV-");

      // Na webu: provizorium z telefonu
      await page.goto("/equipment/e2e73-rm");
      await expect(page.getByText(number ?? "PROV-").first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await phoneContext.close();
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
