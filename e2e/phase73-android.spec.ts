import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { _android as android, expect, test, type AndroidDevice, type AndroidWebView } from "@playwright/test";

import { createSqlitePrisma } from "../src/lib/sqlite-adapter";

// Fáze 73: skutečná aplikace pro Android (ladicí APK) v emulátoru proti E2E serveru – spárování odkazem eldock://
// z webu, token v Android Keystore, provizorium offline (režim letadlo), zrcadlo fronty v souborech aplikace,
// ztráta dat WebView (smazaná IndexedDB) → obnova fronty ze zrcadla, odeslání po připojení a výsledek na webu.
// Předpoklad: běžící emulátor nebo připojený telefon (adb) a `npm --prefix apps/client run android:apk`
// (jinak se test přeskočí). Emulátor vidí počítač na adrese 10.0.2.2.
test.describe.configure({ mode: "serial" });

const PKG = "cz.eldock.app";
const APK = path.resolve("apps/client/android/app/build/outputs/apk/debug/app-debug.apk");
const SDK = process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT ?? path.join(os.homedir(), "AppData", "Local", "Android", "Sdk");
const ADB = path.join(SDK, "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");
const SERVER = "http://10.0.2.2:3200";
const OWNER = { name: "Ondřej Válcovna", email: "ondrej@valcovna-trinec.example", password: "Stykac-Android-A7-2026" };
const ICO = "24719366";

/** Připojené zařízení Android (emulátor), jinak `null` – test se přeskočí. */
async function connectedDevice(): Promise<AndroidDevice | null> {
  if (!existsSync(ADB)) return null;
  spawnSync(ADB, ["start-server"], { stdio: "ignore" });
  const listed = spawnSync(ADB, ["devices"], { encoding: "utf8" }).stdout ?? "";
  if (!/\tdevice\b/.test(listed)) return null;
  const [device] = await android.devices({ omitDriverInstall: true });
  return device ?? null;
}

const shell = async (device: AndroidDevice, command: string) => (await device.shell(command)).toString("utf8");

/** WebView aplikace (po restartu procesu nový). */
async function appWebView(device: AndroidDevice, previous?: AndroidWebView): Promise<AndroidWebView> {
  for (let attempt = 0; attempt < 120; attempt++) {
    const view = device.webViews().find((candidate) => candidate.pkg() === PKG && candidate !== previous);
    if (view) return view;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("WebView aplikace Eldock se neobjevil");
}

test.describe("aplikace Eldock pro Android (emulátor)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test.skip(!existsSync(APK), "APK aplikace pro Android není sestavené (npm --prefix apps/client run android:apk)");

  test("spárování odkazem, provizorium offline, obnova fronty po ztrátě dat WebView a odeslání", async ({ page }) => {
    test.setTimeout(480_000);
    const device = await connectedDevice();
    test.skip(!device, "Není připojený emulátor ani telefon s Androidem (adb devices)");
    if (!device) return;

    // Registrace firmy a zařízení v hale (jako fáze 71–72)
    await page.route("**/api/ares?ico=*", (route) => route.fulfill({ json: { ico: ICO, companyName: "Válcovna Třinec a.s.", dic: `CZ${ICO}`, street: "Průmyslová 1", city: "Třinec", zip: "739 61" } }));
    await page.goto("/register-plant");
    await page.getByLabel("IČO").fill(ICO);
    await expect(page.getByLabel("Obchodní název firmy")).toHaveValue("Válcovna Třinec a.s.");
    await page.getByLabel("Kontaktní osoba (Technický ředitel)").fill(OWNER.name);
    await page.getByLabel("Telefon").fill("+420 777 666 777");
    await page.getByLabel("Název prvního závodu").fill("Válcovna A7");
    await page.getByLabel("E-mail (přihlášení)").fill(OWNER.email);
    await page.getByLabel("Heslo (min. 10 znaků)").fill(OWNER.password);
    await page.getByRole("checkbox", { name: /Souhlas s obchodními podmínkami/ }).check();
    await page.getByRole("button", { name: "Registrovat závod a přihlásit se" }).click();
    await expect(page).toHaveURL(/\/plant\//, { timeout: 30_000 });
    const prisma = createSqlitePrisma({ url: "file:./e2e.db", strict: true });
    try {
      const { plantId } = await prisma.registeredCompany.findFirstOrThrow({ where: { ico: ICO }, select: { plantId: true } });
      if (!plantId) throw new Error("firma bez závodu");
      await prisma.building.create({ data: { id: "e2e73a-hala", plantId, code: "A", name: "Hala A7", mapPolygon: "0,0 1,0 1,1", labelX: 0, labelY: 0 } });
      await prisma.floor.create({ data: { id: "e2e73a-1np", buildingId: "e2e73a-hala", level: 0, code: "1NP", name: "1. NP" } });
      await prisma.equipment.create({ data: { id: "e2e73a-rm", floorId: "e2e73a-1np", tag: "RM-A7", name: "Rozváděč stolice A7", type: "SWITCHBOARD", pinX: 10, pinY: 10 } });
    } finally {
      await prisma.$disconnect();
    }
    await page.goto("/ucet");
    await page.getByTestId("devices-card").getByTestId("pair-start").click();
    const code = (await page.getByTestId("devices-card").getByTestId("pair-code").innerText()).trim();

    try {
      // Čistá instalace; oznámení povolená předem (systémový dotaz by překryl aplikaci), displej zapnutý a odemčený
      await shell(device, "input keyevent KEYCODE_WAKEUP");
      await shell(device, "wm dismiss-keyguard");
      await shell(device, "cmd connectivity airplane-mode disable");
      await device.installApk(APK);
      await shell(device, `pm clear ${PKG}`);
      await shell(device, `pm grant ${PKG} android.permission.POST_NOTIFICATIONS`);

      // Odkaz „otevřít a spárovat“ z webu (eldock://pair) otevře aplikaci s vyplněným serverem a kódem
      const link = `eldock://pair?server=${encodeURIComponent(SERVER)}&code=${code}`;
      await shell(device, `am start -W -a android.intent.action.VIEW -d '${link}' ${PKG}`);
      let webview = await appWebView(device);
      let app = await webview.page();
      await expect(app.getByTestId("pair-server-input")).toHaveValue(SERVER, { timeout: 60_000 });
      await expect(app.getByTestId("pair-code-input")).toHaveValue(/^[0-9A-Z]{4}-[0-9A-Z]{4}$/);
      await expect(app.getByTestId("pair-name-input")).toHaveValue(/^Android – /);
      await app.getByTestId("pair-name-input").fill("Telefon Android A7");
      await app.getByTestId("pair-submit").click();
      await expect(app.getByTestId("sync-status")).toContainText("Synchronizováno", { timeout: 120_000 });
      await expect(app.getByTestId("mobile-nav")).toBeVisible();
      // Připomenutí synchronizace se naplánovalo bez systémového Nastavení (přesné alarmy) – aplikace zůstala vpředu
      await new Promise((resolve) => setTimeout(resolve, 3000));
      expect(await shell(device, "dumpsys activity activities | grep topResumedActivity")).toContain(PKG);
      // Token zařízení je v Android Keystore (šifrovaný), ne v datech WebView
      await app.getByTestId("nav-settings").click();
      await expect(app.getByTestId("settings-screen")).toContainText("zašifrovaný klíčem v Android Keystore");
      await expect(app.getByTestId("settings-screen")).toContainText("Eldock pro Android 1.0.0");
      await page.goto("/admin/devices");
      await expect(page.getByTestId("company-devices")).toContainText("Telefon Android A7");
      await expect(page.getByTestId("company-devices")).toContainText("Android");

      // V hale bez signálu (režim letadlo): provizorium do fronty
      await app.getByTestId("nav-home").click();
      await app.getByTestId("search-input").fill("RM-A7");
      await app.getByTestId("search-input").press("Enter");
      await expect(app.getByTestId("equipment-tag")).toHaveText("RM-A7");
      await shell(device, "cmd connectivity airplane-mode enable");
      // Systém hlásí bez sítě (plugin Network); pokus o synchronizaci skončí „Offline“ i bez události
      await expect.poll(() => app.evaluate(async () => (await (window as unknown as { Capacitor: { Plugins: { Network: { getStatus(): Promise<{ connected: boolean }> } } } }).Capacitor.Plugins.Network.getStatus()).connected), { timeout: 30_000 }).toBe(false);
      await app.getByTestId("sync-now").click();
      await expect(app.getByTestId("sync-status")).toContainText("Offline", { timeout: 30_000 });
      await app.getByTestId("action-temp-mod").click();
      await app.getByTestId("temporary-mod-title").fill("Přemostění čidla stolice A7");
      await app.getByTestId("temporary-mod-description").fill("Zapsáno v telefonu v režimu letadlo");
      await app.getByTestId("temporary-mod-submit").click();
      await expect(app.getByTestId("pending-for-equipment").getByText("Čeká na odeslání")).toHaveCount(1);

      // Zrcadlo fronty v souborech aplikace (mimo data WebView)
      await expect.poll(async () => shell(device, `run-as ${PKG} cat files/eldock-zrcadlo/outbox.json`), { timeout: 15_000 }).toContain("Nové provizorium – RM-A7");
      await expect.poll(async () => shell(device, `run-as ${PKG} cat files/eldock-zrcadlo/pairing.json`), { timeout: 15_000 }).toContain(SERVER);

      // Systém smaže data WebView (IndexedDB) – po startu aplikace frontu obnoví ze zrcadla
      await shell(device, `am force-stop ${PKG}`);
      expect(await shell(device, `run-as ${PKG} ls app_webview/Default`)).toContain("IndexedDB");
      await shell(device, `run-as ${PKG} rm -rf app_webview/Default/IndexedDB`);
      await shell(device, `am start -W -n ${PKG}/.MainActivity`);
      webview = await appWebView(device, webview);
      app = await webview.page();
      await expect(app.getByTestId("mobile-nav")).toBeVisible({ timeout: 60_000 });
      await app.getByTestId("nav-queue").click();
      await expect(app.getByTestId("queue-pending")).toContainText("Nové provizorium – RM-A7");

      // Po připojení se obnovená úprava odešle a data závodu se stáhnou znovu
      await shell(device, "cmd connectivity airplane-mode disable");
      await expect(async () => {
        await app.getByTestId("sync-now").click({ timeout: 10_000 });
        await expect(app.getByTestId("queue-applied")).toContainText(/PROV-\d{4}-\d{4}/, { timeout: 10_000 });
      }).toPass({ timeout: 120_000 });
      const number = (await app.getByTestId("queue-applied").innerText()).match(/PROV-\d{4}-\d{4}/)?.[0];
      expect(number).toBeTruthy();
      await app.getByTestId("nav-home").click();
      await app.getByTestId("search-input").fill("RM-A7");
      await app.getByTestId("search-input").press("Enter");
      await expect(app.getByTestId("temporary-mods")).toContainText(number ?? "PROV-");
      // Odeslaná úprava ze zrcadla zmizela
      await expect.poll(async () => shell(device, `run-as ${PKG} cat files/eldock-zrcadlo/outbox.json`), { timeout: 15_000 }).toBe("[]");

      await page.goto("/equipment/e2e73a-rm");
      await expect(page.getByText(number ?? "PROV-").first()).toBeVisible({ timeout: 30_000 });
    } finally {
      await shell(device, "cmd connectivity airplane-mode disable").catch(() => "");
      await shell(device, `am force-stop ${PKG}`).catch(() => "");
      await device.close().catch(() => undefined);
    }
  });
});
