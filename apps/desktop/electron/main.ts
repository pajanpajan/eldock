// Fáze 71: hlavní proces aplikace Eldock pro Windows. Rozhraní (React) běží v sandboxu s izolací kontextu
// a načítá se vlastním protokolem `eldock-app://app/` jen ze složky sestavení; síť volá rozhraní samo (CORS
// na API synchronizace). Hlavní proces drží jen to, co rozhraní nesmí: token zašifrovaný DPAPI (`safeStorage`),
// otevření souboru v systémovém prohlížeči a odkazy `eldock://pair?…` z webu (jedna instance aplikace).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { BrowserWindow, app, ipcMain, net, protocol, safeStorage, session, shell } from "electron";

const APP_SCHEME = "eldock-app";
const LINK_SCHEME = "eldock";
const DIST = path.join(__dirname, "..", "dist");
const ICON = path.join(__dirname, "..", "build", "icon.png");

// Testy a víc profilů na jednom počítači: vlastní složka dat (IndexedDB, token)
if (process.env.ELDOCK_DESKTOP_USER_DATA) app.setPath("userData", process.env.ELDOCK_DESKTOP_USER_DATA);

protocol.registerSchemesAsPrivileged([{ scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

let mainWindow: BrowserWindow | null = null;
let pendingLink: string | null = null;

const linkFrom = (argv: readonly string[]) => argv.find((arg) => arg.toLowerCase().startsWith(`${LINK_SCHEME}://`)) ?? null;

function deliverLink(link: string) {
  pendingLink = link;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("eldock:deep-link", link);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const link = linkFrom(argv);
    if (link) deliverLink(link);
    else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
  pendingLink = linkFrom(process.argv);
  // Odkaz eldock:// otevře nainstalovanou aplikaci (zapisuje i instalátor). Vývojový electron.exe a testy se do
  // registru Windows nezapisují – jinak by odkazy z webu otevíraly vývojovou verzi.
  if (app.isPackaged && !process.env.ELDOCK_DESKTOP_USER_DATA) app.setAsDefaultProtocolClient(LINK_SCHEME);
  app.setAppUserModelId("cz.eldock.desktop");
  void app.whenReady().then(start);
}

// ---------------------------------------------------------------------------
//  Token zařízení (Windows DPAPI přes safeStorage)
// ---------------------------------------------------------------------------

const tokenFile = () => path.join(app.getPath("userData"), "device-token.bin");

function readToken(): string | null {
  const file = tokenFile();
  if (!existsSync(file)) return null;
  try {
    return safeStorage.decryptString(readFileSync(file));
  } catch {
    return null;
  }
}

function writeToken(token: string) {
  if (typeof token !== "string" || !/^eldk_[\w-]{20,200}$/.test(token)) throw new Error("Neplatný token zařízení.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Systém neumí zašifrovat token zařízení (DPAPI).");
  mkdirSync(path.dirname(tokenFile()), { recursive: true });
  writeFileSync(tokenFile(), safeStorage.encryptString(token));
}

// ---------------------------------------------------------------------------
//  Okno a bezpečnost
// ---------------------------------------------------------------------------

function serveApp() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html";
    const file = path.normalize(path.join(DIST, relative));
    if (url.host !== "app" || !file.startsWith(DIST + path.sep) || !existsSync(file)) return new Response("Nenalezeno", { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function guardSession() {
  // Kamera (QR štítky, fotky) jen pro rozhraní aplikace; nic jiného (poloha, oznámení, …)
  const allowed = (origin: string, permission: string) => permission === "media" && origin.startsWith(`${APP_SCHEME}://`);
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback) => callback(allowed(contents.getURL(), permission)));
  session.defaultSession.setPermissionCheckHandler((_contents, permission, origin) => allowed(origin, permission));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    title: "Eldock",
    backgroundColor: "#09090b",
    show: false,
    autoHideMenuBar: true,
    ...(existsSync(ICON) ? { icon: ICON } : {}),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: false },
  });
  mainWindow.removeMenu();
  mainWindow.once("ready-to-show", () => mainWindow?.show());
  // Rozhraní nikam nenaviguje; odkazy http(s) otevře výchozí prohlížeč
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url === mainWindow?.webContents.getURL()) return;
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  const devUrl = process.env.ELDOCK_DESKTOP_DEV_URL;
  void (devUrl && !app.isPackaged ? mainWindow.loadURL(devUrl) : mainWindow.loadURL(`${APP_SCHEME}://app/index.html`));
}

function registerIpc() {
  ipcMain.handle("eldock:token-get", () => readToken());
  ipcMain.handle("eldock:token-set", (_event, token: string) => writeToken(token));
  ipcMain.handle("eldock:token-clear", () => rmSync(tokenFile(), { force: true }));
  ipcMain.handle("eldock:app-info", () => ({ version: app.getVersion(), hostname: os.hostname(), platform: process.platform, encrypted: safeStorage.isEncryptionAvailable() }));
  ipcMain.handle("eldock:deep-link-take", () => {
    const link = pendingLink;
    pendingLink = null;
    return link;
  });
  // Dokument z mezipaměti → dočasný soubor → výchozí aplikace Windows (PDF, výkres, návod)
  ipcMain.handle("eldock:open-file", async (_event, name: string, data: Uint8Array) => {
    const safeName = String(name || "soubor").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").slice(0, 120) || "soubor";
    const dir = path.join(app.getPath("temp"), "eldock-soubory");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, safeName);
    writeFileSync(file, Buffer.from(data));
    return shell.openPath(file);
  });
}

function start() {
  serveApp();
  guardSession();
  registerIpc();
  createWindow();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  deliverLink(url);
});

app.on("window-all-closed", () => app.quit());
