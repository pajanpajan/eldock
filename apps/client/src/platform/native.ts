// Fáze 73: most mobilní aplikace (Capacitor – Android a iOS). Jediné místo, kde rozhraní volá nativní pluginy:
// token v Klíčence iOS / Android Keystore, nativní skener QR (offline), otevření dokumentu v systémové aplikaci,
// odkazy eldock://, stav sítě, návrat do popředí, tlačítko Zpět, připomenutí synchronizace a zrcadlo fronty
// v souborech aplikace (Library – systém ho na rozdíl od dat WebView nemaže).

import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";
import { FileOpener } from "@capacitor-community/file-opener";
import { App } from "@capacitor/app";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { Device } from "@capacitor/device";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";

import type { DurableBackup, TokenStore } from "@/sync-client";

import type { EldockBridge } from "./types";

const TOKEN_KEY = "device-token";
const TOKEN_PATTERN = /^eldk_[\w-]{20,200}$/;
const BACKUP_DIR = "eldock-zrcadlo";
const REMINDER_ID = 7301;
const REMINDER_CHANNEL = "synchronizace";

// Skener QR přímo přes nativní část `@capacitor/barcode-scanner` – jeho obal v JS táhne pro web knihovnu
// html5-qrcode, kterou aplikace nepotřebuje. Android: ML Kit v aplikaci (bez Google Play a bez internetu),
// iOS: AVFoundation. Chyby: OS-PLUG-BARC-0006 = zrušeno, OS-PLUG-BARC-0007 = bez přístupu k fotoaparátu.
interface ScannerPlugin {
  scanBarcode(options: Record<string, unknown>): Promise<{ ScanResult: string; format: number }>;
}
const Scanner = registerPlugin<ScannerPlugin>("CapacitorBarcodeScanner");
const QR_CODE_HINT = 0;
const CAMERA_BACK = 1;
const ORIENTATION_ADAPTIVE = 3;

const ios = () => Capacitor.getPlatform() === "ios";

const detach = (handle: Promise<PluginListenerHandle>) => () => {
  void handle.then((listener) => listener.remove()).catch(() => undefined);
};

const errorCode = (error: unknown) => (typeof error === "object" && error && "code" in error ? String((error as { code: unknown }).code ?? "") : "");

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(reader.error ?? new Error("Soubor se nepodařilo přečíst."));
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64: string, type = "application/octet-stream"): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  dwg: "image/vnd.dwg",
  dxf: "image/vnd.dxf",
  zip: "application/zip",
};

const safeFileName = (name: string) => String(name || "soubor").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "soubor";

// ---------------------------------------------------------------------------
//  Token zařízení – iOS Klíčenka (jen toto zařízení, bez iCloudu), Android Keystore (AES-GCM)
// ---------------------------------------------------------------------------

const tokenStore: TokenStore = {
  async get() {
    try {
      const value = await SecureStorage.get(TOKEN_KEY, false, false);
      return typeof value === "string" && TOKEN_PATTERN.test(value) ? value : null;
    } catch {
      return null;
    }
  },
  async set(token) {
    if (!TOKEN_PATTERN.test(token)) throw new Error("Neplatný token zařízení.");
    await SecureStorage.set(TOKEN_KEY, token, false, false, KeychainAccess.afterFirstUnlockThisDeviceOnly);
  },
  async clear() {
    await SecureStorage.remove(TOKEN_KEY, false).catch(() => undefined);
  },
};

// ---------------------------------------------------------------------------
//  Zrcadlo fronty v souborech aplikace (Library) – zápis přes dočasný soubor
// ---------------------------------------------------------------------------

const backupPath = (name: string) => `${BACKUP_DIR}/${name.replace(/[^\w.-]/g, "_")}`;

async function readBackup(name: string, encoding?: Encoding): Promise<string | null> {
  for (const path of [backupPath(name), `${backupPath(name)}.tmp`]) {
    try {
      const result = await Filesystem.readFile({ path, directory: Directory.Library, encoding });
      return typeof result.data === "string" ? result.data : await result.data.text();
    } catch {
      // soubor není – zkusit rozepsaný dočasný
    }
  }
  return null;
}

async function writeBackup(name: string, data: string, encoding?: Encoding) {
  const path = backupPath(name);
  const temp = `${path}.tmp`;
  await Filesystem.writeFile({ path: temp, data, directory: Directory.Library, encoding, recursive: true });
  await Filesystem.deleteFile({ path, directory: Directory.Library }).catch(() => undefined);
  await Filesystem.rename({ from: temp, to: path, directory: Directory.Library, toDirectory: Directory.Library });
}

const backup: DurableBackup = {
  readText: (name) => readBackup(name, Encoding.UTF8),
  writeText: (name, text) => writeBackup(name, text, Encoding.UTF8),
  async readBlob(name) {
    const data = await readBackup(name);
    return data === null ? null : base64ToBlob(data);
  },
  async writeBlob(name, data) {
    await writeBackup(name, await blobToBase64(data));
  },
  async remove(name) {
    for (const path of [backupPath(name), `${backupPath(name)}.tmp`]) await Filesystem.deleteFile({ path, directory: Directory.Library }).catch(() => undefined);
  },
};

// ---------------------------------------------------------------------------
//  Most
// ---------------------------------------------------------------------------

let launchLinkTaken = false;

export function nativeBridge(): EldockBridge {
  return {
    kind: ios() ? "ios" : "android",
    syncPlatform: ios() ? "IOS" : "ANDROID",
    mobile: true,
    token: tokenStore,

    async appInfo() {
      const [device, app] = await Promise.all([Device.getInfo().catch(() => null), App.getInfo().catch(() => null)]);
      const version = app?.version ?? __APP_VERSION__;
      if (ios()) {
        const kind = device?.model?.startsWith("iPad") ? "iPad" : "iPhone";
        return { version, deviceName: `${kind} – ${device?.name && device.name !== kind ? device.name : `iOS ${device?.osVersion ?? ""}`.trim()}`, label: "Eldock pro iOS", tokenProtection: "v Klíčence iOS, jen v tomto zařízení" };
      }
      const model = device?.name?.trim() || [device?.manufacturer, device?.model].filter(Boolean).join(" ") || "telefon";
      return { version, deviceName: `Android – ${model}`, label: "Eldock pro Android", tokenProtection: "zašifrovaný klíčem v Android Keystore" };
    },

    async openFile(name, data) {
      const fileName = safeFileName(name);
      try {
        const written = await Filesystem.writeFile({ path: `soubory/${fileName}`, data: await blobToBase64(data), directory: Directory.Cache, recursive: true });
        const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
        await FileOpener.open({ filePath: written.uri, contentType: data.type || MIME_BY_EXTENSION[extension] || "application/octet-stream", openWithDefault: true });
        return "";
      } catch (error) {
        if (errorCode(error) === "8") return "v telefonu není aplikace, která tento typ souboru otevře.";
        return error instanceof Error ? error.message : "neznámá chyba";
      }
    },

    async takeDeepLink() {
      if (launchLinkTaken) return null;
      launchLinkTaken = true;
      const launch = await App.getLaunchUrl().catch(() => undefined);
      return launch?.url && /^eldock:/i.test(launch.url) ? launch.url : null;
    },
    onDeepLink(callback) {
      return detach(App.addListener("appUrlOpen", (event) => /^eldock:/i.test(event.url) && callback(event.url)));
    },

    async scanQr() {
      try {
        const result = await Scanner.scanBarcode({
          hint: QR_CODE_HINT,
          scanInstructions: "Namiřte fotoaparát na QR štítek zařízení",
          scanButton: false,
          scanText: " ",
          cameraDirection: CAMERA_BACK,
          scanOrientation: ORIENTATION_ADAPTIVE,
          android: { scanningLibrary: "mlkit" },
          cancelButtonAccessibilityLabel: "Zrušit skenování",
          torchButtonOnAccessibilityLabel: "Zapnout světlo",
          torchButtonOffAccessibilityLabel: "Vypnout světlo",
        });
        return result.ScanResult?.trim() || null;
      } catch (error) {
        const code = errorCode(error);
        if (code.endsWith("0006")) return null;
        if (code.endsWith("0007")) throw new Error(ios() ? "Aplikace nemá přístup k fotoaparátu – povolte ho v Nastavení → Eldock → Fotoaparát." : "Aplikace nemá přístup k fotoaparátu – povolte ho v Nastavení → Aplikace → Eldock → Oprávnění.");
        throw new Error("Skener QR se nepodařilo spustit.");
      }
    },

    network: {
      async connected() {
        try {
          return (await Network.getStatus()).connected;
        } catch {
          return navigator.onLine;
        }
      },
      onChange(callback) {
        return detach(Network.addListener("networkStatusChange", (status) => callback(status.connected)));
      },
    },

    onResume(callback) {
      return detach(App.addListener("resume", callback));
    },
    onBack(callback) {
      return detach(App.addListener("backButton", () => callback()));
    },
    async minimize() {
      await App.minimizeApp().catch(() => undefined);
    },

    backup,

    async remindSync(at) {
      await LocalNotifications.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => undefined);
      if (!at) return;
      const permission = await LocalNotifications.checkPermissions().catch(() => null);
      if (permission?.display !== "granted") return;
      if (!ios()) await LocalNotifications.createChannel({ id: REMINDER_CHANNEL, name: "Synchronizace", description: "Připomenutí, když data v telefonu nejsou synchronizovaná déle než 24 hodin", importance: 3 }).catch(() => undefined);
      await LocalNotifications.schedule({
        notifications: [
          {
            id: REMINDER_ID,
            title: "Eldock – synchronizujte data",
            body: "Data v telefonu jsou starší než 24 hodin. Připojte se k síti a otevřete Eldock – úpravy z haly se odešlou.",
            schedule: { at, allowWhileIdle: true },
            channelId: REMINDER_CHANNEL,
            // Přesný alarm nechceme: bez oprávnění by Android 12+ při každém naplánování otevřel Nastavení
            // („Alarmy a připomenutí“) a vytrhl uživatele z aplikace; připomenutí po 24 h přesnost nepotřebuje
            isExactNotification: false,
          },
        ],
      });
    },
    async allowNotifications() {
      try {
        const status = await LocalNotifications.checkPermissions();
        if (status.display === "granted") return true;
        if (status.display === "denied") return false;
        return (await LocalNotifications.requestPermissions()).display === "granted";
      } catch {
        return false;
      }
    },
  };
}
