import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";
import sharp from "sharp";

import { createSqlitePrisma } from "../src/lib/sqlite-adapter";

// Fáze 71: aplikace Eldock pro Windows (Electron) proti E2E serveru – spárování kódem z webu, první
// synchronizace, štítek ze čtečky čárových kódů, zadání změny s fotkou a odstranění závady offline, odeslání
// po připojení (výsledek vidět na webu) a odpojení. Předpoklad: `npm --prefix apps/desktop install` a
// `npm --prefix apps/desktop run build` (jinak se test přeskočí – během E2E se v projektu nic nesestavuje).
test.describe.configure({ mode: "serial" });

const DESKTOP = path.resolve("apps/desktop");
const ELECTRON = path.join(DESKTOP, "node_modules", "electron", "dist", "electron.exe");
const BUILT = [path.join(DESKTOP, "dist", "index.html"), path.join(DESKTOP, "dist-electron", "main.cjs")];
const OWNER = { name: "Radek Lisovna", email: "radek@lisovna-kolin.example", password: "Svorkovnice-X1-Kryt-2026" };
const ICO = "27135799";
const QR = "B4E2E71C0D";

test.describe("aplikace Eldock pro Windows", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(![ELECTRON, ...BUILT].every((file) => existsSync(file)), "Aplikace pro Windows není nainstalovaná a sestavená (apps/desktop)");

  test("spárování kódem z webu, synchronizace, štítek, úpravy offline a odeslání po připojení", async ({ page }) => {
    test.setTimeout(300_000);
    // Registrace firmy Správy závodů (jako ve fázi 70)
    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: ICO, companyName: "Lisovna Kolín s.r.o.", dic: `CZ${ICO}`, street: "Průmyslová 7", city: "Kolín", zip: "280 02" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill(ICO);
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Lisovna Kolín s.r.o.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 333 444");
    await page.getByLabel("Název prvního závodu").fill("Závod Kolín – Lisovna");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

    // Nová firma nemá zařízení – hala, rozváděč s revizí a závadou přímo do databáze (triggery je zapíšou do žurnálu)
    const prisma = createSqlitePrisma({ url: "file:./e2e.db", strict: true });
    try {
      const { plantId } = await prisma.registeredCompany.findFirstOrThrow({ where: { ico: ICO }, select: { plantId: true } });
      if (!plantId) throw new Error("firma bez závodu");
      await prisma.building.create({ data: { id: "e2e71-hala", plantId, code: "H", name: "Hala lisů", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
      await prisma.floor.create({ data: { id: "e2e71-1np", buildingId: "e2e71-hala", level: 0, code: "1NP", name: "1. NP" } });
      await prisma.equipment.create({
        data: {
          id: "e2e71-rm",
          floorId: "e2e71-1np",
          tag: "RM-L1",
          name: "Rozváděč lisovací linky",
          type: "SWITCHBOARD",
          manufacturer: "ABB",
          pinX: 10,
          pinY: 10,
          qrToken: QR,
          inspections: { create: { id: "e2e71-revize", type: "PERIODIC", inspectionDate: new Date("2026-06-01"), validUntil: new Date("2029-06-01"), reportNumber: "E2E-71", inspectorName: "Iva Revizní", inspectorLicense: "E2A-71", result: "CAPABLE_WITH_DEFECTS", reportUrl: "/api/files/documents/e2e71.pdf" } },
        },
      });
      await prisma.inspectionDefect.create({ data: { id: "e2e71-zavada", inspectionId: "e2e71-revize", equipmentId: "e2e71-rm", description: "Chybí kryt svorkovnice X1", deadline: new Date(Date.now() + 14 * 86_400_000) } });
    } finally {
      await prisma.$disconnect();
    }

    // Můj účet → kód párování a odkaz „otevřít a spárovat“
    await page.goto("/ucet");
    const card = page.getByTestId("devices-card");
    await card.getByTestId("pair-start").click();
    const code = (await card.getByTestId("pair-code").innerText()).trim();
    expect(await card.getByTestId("pair-open-app").getAttribute("href")).toBe(`eldock://pair?server=${encodeURIComponent("http://localhost:3200")}&code=${code}`);

    const profile = mkdtempSync(path.join(os.tmpdir(), "eldock-desktop-e2e-"));
    const app = await electron.launch({ executablePath: ELECTRON, args: [DESKTOP], env: { ...process.env, ELDOCK_DESKTOP_USER_DATA: profile } });
    try {
      const win = await app.firstWindow();
      // Spárování: adresa serveru a opsaný kód (malá písmena)
      await win.getByTestId("pair-server-input").fill("http://localhost:3200");
      await win.getByTestId("pair-code-input").fill(code.toLowerCase());
      await win.getByTestId("pair-name-input").fill("Tablet hala lisů");
      await win.getByTestId("pair-submit").click();
      await expect(win.getByTestId("sync-status")).toContainText("Synchronizováno", { timeout: 90_000 });
      await expect(card.getByTestId("pair-done")).toBeVisible({ timeout: 20_000 });
      await expect(card.getByTestId("my-devices")).toContainText("Tablet hala lisů");
      await expect(card.getByTestId("my-devices")).toContainText("aplikace 1.0.0");

      // Čtečka čárových kódů „napíše“ obsah QR štítku a Enter → detail zařízení
      await win.getByTestId("search-input").fill(`http://localhost:3200/equipment/e2e71-rm?qr=${QR}`);
      await win.getByTestId("search-input").press("Enter");
      await expect(win.getByTestId("equipment-tag")).toHaveText("RM-L1");
      await expect(win.getByTestId("defects")).toContainText("Chybí kryt svorkovnice X1");
      await expect(win.getByTestId("label-replaced")).toHaveCount(0);

      // V hale bez signálu: zadání změny s fotkou a odstranění závady
      await app.context().setOffline(true);
      await expect(win.getByTestId("sync-status")).toContainText("Offline");
      await win.getByTestId("action-change").click();
      await win.getByTestId("change-request-note").fill("Doplněn kryt svorkovnice X1, zapsáno offline v hale");
      const photo = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#facc15" } }).jpeg().toBuffer();
      await win.getByTestId("photo-input").setInputFiles({ name: "kryt.jpg", mimeType: "image/jpeg", buffer: photo });
      await expect(win.getByTestId("photo-previews").locator("img")).toHaveCount(1);
      await win.getByTestId("change-request-submit").click();
      await win.getByTestId("resolve-e2e71-zavada").click();
      await win.getByTestId("resolve-defect-note").fill("Kryt doplněn a zajištěn");
      await win.getByTestId("resolve-defect-submit").click();
      await expect(win.getByTestId("pending-for-equipment").getByText("Čeká na odeslání")).toHaveCount(2);
      await expect(win.getByTestId("sync-status")).toContainText("čekají úpravy");

      // Po připojení se úpravy odešlou (aplikace sama, tlačítkem Synchronizovat hned)
      await app.context().setOffline(false);
      await win.getByTestId("sync-now").click();
      await expect(win.getByTestId("pending-for-equipment")).toHaveCount(0, { timeout: 90_000 });
      const requests = win.getByTestId("change-requests");
      await expect(requests).toContainText("Doplněn kryt svorkovnice X1, zapsáno offline v hale");
      const number = (await requests.innerText()).match(/ZM-\d{4}-\d{4}/)?.[0];
      expect(number).toBeTruthy();
      await expect(requests.locator("img")).toHaveCount(1);
      await expect(win.getByTestId("defects")).toContainText("Kryt doplněn a zajištěn");
      await win.getByTestId("open-queue").click();
      await expect(win.getByTestId("queue-applied")).toContainText("Zadání změny – RM-L1");
      await expect(win.getByTestId("queue-applied")).toContainText("Odstranění závady – RM-L1");

      // Na webu: změna z haly i odstraněná závada
      await page.goto("/equipment/e2e71-rm");
      await expect(page.getByText(number ?? "ZM-").first()).toBeVisible({ timeout: 30_000 });

      // Odpojení z aplikace → token neplatí, aplikace chce spárovat znovu
      await win.getByTestId("open-settings").click();
      await win.getByTestId("disconnect").click();
      await win.getByTestId("disconnect-confirm").click();
      await expect(win.getByTestId("pair-form")).toBeVisible({ timeout: 20_000 });
      await page.goto("/ucet");
      await expect(page.getByTestId("devices-card")).toContainText("Zatím žádné spárované zařízení.");
      await page.goto("/admin/devices");
      await expect(page.getByTestId("company-devices")).toContainText("Tablet hala lisů");
      await expect(page.getByTestId("company-devices")).toContainText("Odpojeno");
    } finally {
      await app.close();
      rmSync(profile, { recursive: true, force: true });
    }
  });
});
