import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";

import { createSqlitePrisma } from "../src/lib/sqlite-adapter";

// Fáze 72: server závodu se skutečnými procesy – E2E cloud (port 3200) ↔ server závodu (Eldock.exe jako Node,
// sestavený plant-server.cjs) ↔ aplikace pro Windows. Správce spáruje server kódem z Administrace → Zařízení přes
// stránku správy serveru, tablet se spáruje se serverem závodu, provizorium z haly cloud provede jménem technika.
// Předpoklad: `npm --prefix apps/desktop install` a `run build` (jinak se test přeskočí).
test.describe.configure({ mode: "serial" });

const DESKTOP = path.resolve("apps/desktop");
const ELECTRON = path.join(DESKTOP, "node_modules", "electron", "dist", "electron.exe");
const BUILT = [path.join(DESKTOP, "dist", "index.html"), path.join(DESKTOP, "dist-electron", "main.cjs"), path.join(DESKTOP, "dist-electron", "plant-server.cjs")];
const OWNER = { name: "Jana Lisovací", email: "jana@lisovna-mlada.example", password: "Rozvadec-Hala-2026" };
const ICO = "28642139";
const PLANT_PORT = 8792;
const PLANT_URL = `http://127.0.0.1:${PLANT_PORT}`;

async function waitForPlant(child: ChildProcess) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (child.exitCode !== null) throw new Error(`server závodu skončil (${child.exitCode})`);
    try {
      if ((await fetch(`${PLANT_URL}/api/sync/v1`)).ok) return;
    } catch {
      // ještě neposlouchá
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("server závodu neodpovídá");
}

test.describe("server závodu", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(![ELECTRON, ...BUILT].every((file) => existsSync(file)), "Aplikace pro Windows není nainstalovaná a sestavená (apps/desktop)");

  test("správce spáruje server závodu, tablet v hale přes něj zapíše provizorium a cloud ho provede", async ({ page, context }) => {
    test.setTimeout(300_000);
    // Registrace firmy (technický ředitel = správce firmy)
    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: ICO, companyName: "Lisovna Mladá s.r.o.", dic: `CZ${ICO}`, street: "Tovární 3", city: "Mladá Boleslav", zip: "293 01" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill(ICO);
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Lisovna Mladá s.r.o.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 555 666");
    await page.getByLabel("Název prvního závodu").fill("Závod Mladá Boleslav");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });

    const prisma = createSqlitePrisma({ url: "file:./e2e.db", strict: true });
    try {
      const { plantId } = await prisma.registeredCompany.findFirstOrThrow({ where: { ico: ICO }, select: { plantId: true } });
      if (!plantId) throw new Error("firma bez závodu");
      await prisma.building.create({ data: { id: "e2e72-hala", plantId, code: "L", name: "Hala lisů", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
      await prisma.floor.create({ data: { id: "e2e72-1np", buildingId: "e2e72-hala", level: 0, code: "1NP", name: "1. NP" } });
      await prisma.equipment.create({ data: { id: "e2e72-rm", floorId: "e2e72-1np", tag: "RM-P3", name: "Rozváděč lisu P3", type: "SWITCHBOARD", pinX: 10, pinY: 10 } });
    } finally {
      await prisma.$disconnect();
    }

    // Administrace → Zařízení → Spárovat server závodu
    await page.goto("/admin/devices");
    const card = page.getByTestId("plant-server-card");
    await card.getByTestId("plant-server-pair-start").click();
    const cloudCode = (await card.getByTestId("plant-server-code").innerText()).trim();
    await expect(card.getByTestId("plant-server-cloud")).toContainText("http://localhost:3200");

    // Server závodu: Eldock.exe jako Node s vlastní složkou dat
    const plantData = mkdtempSync(path.join(os.tmpdir(), "eldock-server-zavodu-e2e-"));
    const profile = mkdtempSync(path.join(os.tmpdir(), "eldock-desktop-e2e72-"));
    const plantProcess = spawn(ELECTRON, [path.join(DESKTOP, "dist-electron", "plant-server.cjs"), "--data", plantData, "--port", String(PLANT_PORT), "--host", "127.0.0.1"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdio: "pipe" });
    const plantLog: string[] = [];
    plantProcess.stdout?.on("data", (chunk: Buffer) => plantLog.push(chunk.toString()));
    plantProcess.stderr?.on("data", (chunk: Buffer) => plantLog.push(chunk.toString()));
    let app: Awaited<ReturnType<typeof electron.launch>> | null = null;
    try {
      await waitForPlant(plantProcess);
      // Správa serveru: heslo (jen z tohoto počítače), spárování s cloudem, kód pro tablet
      const plantPage = await context.newPage();
      await plantPage.goto(`${PLANT_URL}/`);
      await plantPage.locator("#setup-password").fill("Sprava-Serveru-2026");
      await plantPage.getByRole("button", { name: "Nastavit heslo" }).click();
      await plantPage.locator("#pair-server").fill("http://localhost:3200");
      await plantPage.locator("#pair-code").fill(cloudCode);
      await plantPage.getByRole("button", { name: "Spárovat s cloudem" }).click();
      await expect(plantPage.locator("#cloud-status")).toContainText("Spárováno a synchronizováno", { timeout: 60_000 });
      await expect(plantPage.locator("#cloud-status")).toContainText("Závod Mladá Boleslav");
      await plantPage.locator("tr", { hasText: OWNER.name }).getByRole("button", { name: "Kód pro zařízení" }).click();
      const hallCode = (await plantPage.locator("#pairing .code").innerText()).trim();
      expect(hallCode).toMatch(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      // Web vidí server závodu mezi zařízeními firmy
      await page.goto("/admin/devices");
      await expect(page.getByTestId("company-devices")).toContainText("Server závodu");

      // Tablet v hale se spáruje se serverem závodu
      app = await electron.launch({ executablePath: ELECTRON, args: [DESKTOP], env: { ...process.env, ELDOCK_DESKTOP_USER_DATA: profile } });
      const win = await app.firstWindow();
      await win.getByTestId("pair-server-input").fill(PLANT_URL);
      await win.getByTestId("pair-code-input").fill(hallCode);
      await win.getByTestId("pair-name-input").fill("Tablet lis P3");
      await win.getByTestId("pair-submit").click();
      await expect(win.getByTestId("sync-status")).toContainText("Synchronizováno se serverem závodu", { timeout: 60_000 });
      await win.getByTestId("search-input").fill("RM-P3");
      await win.getByTestId("search-input").press("Enter");
      await expect(win.getByTestId("equipment-tag")).toHaveText("RM-P3");

      // Provizorium z haly: server závodu ho převezme hned, do cloudu ho přepošle sám
      await win.getByTestId("action-temp-mod").click();
      await win.getByTestId("temporary-mod-title").fill("Přemostění koncového spínače lisu");
      await win.getByTestId("temporary-mod-description").fill("Do dodání nového spínače, hlídá obsluha");
      await win.getByTestId("temporary-mod-submit").click();
      // Hned po zápisu: převzato serverem závodu, číslo zatím nemá (cloud o něm ještě nerozhodl)
      await expect(win.getByTestId("temporary-mods")).toContainText("Přemostění koncového spínače lisu", { timeout: 30_000 });
      await expect(win.getByTestId("temporary-mods")).toContainText("čeká na cloud");
      // Server závodu úpravu přepošle sám (pár sekund po převzetí); aplikace výsledek dostane při další synchronizaci
      await expect(async () => {
        await win.getByTestId("sync-now").click({ timeout: 10_000 });
        await expect(win.getByTestId("temporary-mods")).toContainText(/PROV-\d{4}-\d{4}/, { timeout: 5_000 });
      }).toPass({ timeout: 90_000 });
      const number = (await win.getByTestId("temporary-mods").innerText()).match(/PROV-\d{4}-\d{4}/)?.[0];
      expect(number).toBeTruthy();
      await expect(plantPage.locator("#relays")).toContainText("Provedeno v cloudu", { timeout: 40_000 });

      // Na webu: provizorium z haly zapsané jménem technika (správce firmy)
      await page.goto("/equipment/e2e72-rm");
      await expect(page.getByText(number ?? "PROV-").first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await app?.close();
      plantProcess.kill();
      await new Promise((resolve) => setTimeout(resolve, 500));
      rmSync(profile, { recursive: true, force: true });
      rmSync(plantData, { recursive: true, force: true });
      if (plantLog.length) console.log(plantLog.join("").slice(-2000));
    }
  });
});
