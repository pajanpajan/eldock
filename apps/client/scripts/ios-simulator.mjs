// Fáze 73: spuštění aplikace Eldock pro iOS v simulátoru iPhonu a iPadu – ruční workflow
// .github/workflows/ios-build.yml (Actions → „iOS – sestavení pro simulátor“), jde i na Macu s Xcode 26:
//   node scripts/ios-simulator.mjs <App.app ze sestavení pro simulátor> <složka pro snímky a záznamy>
// Pro iPhone i iPad založí nový simulátor s nejnovějším iOS, nainstaluje App.app, spustí cz.eldock.app a vyfotí
// úvodní obrazovku (spárování – skript na nic neklepe, aplikace se nikam nepřipojuje, nic se nepáruje). Selže, když
// aplikace spadne (proces skončí, záznam o pádu), Capacitor nahlásí chybu JavaScriptu / WebView (výstup aplikace
// přes PTY – řádky „⚡️ …“), nebo obrazovka zůstane prázdná, bílá či jen s logem úvodní obrazovky (rozbor pixelů
// snímku: text a žlutá tlačítka rozhraní). Souhrn jde do GITHUB_STEP_SUMMARY a do anotací běhu (ty jsou u veřejného
// repozitáře čitelné přes API GitHubu i bez přihlášení, logy a artefakty ne).

import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { inflateSync } from "node:zlib";

const BUNDLE_ID = "cz.eldock.app";
const DEVICES = [
  { key: "iphone", family: "iPhone", prefer: [/^iPhone \d+ Pro$/, /^iPhone \d+$/, /^iPhone (?!SE)/] },
  // iPad aspoň 768 bodů na šířku – iPad mini má na výšku 744 bodů, tedy telefonní rozvržení
  { key: "ipad", family: "iPad", prefer: [/^iPad Air 11-inch/, /^iPad \(/, /^iPad Pro 11-inch/, /^iPad Air/, /^iPad Pro/, /^iPad(?! mini)/] },
];
// První spuštění WebKitu v čerstvém simulátoru bývá na runneru s Intelem pomalé
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 2_000;
const SETTLE_MS = 3_000;
const CRASH_DIR = path.join(os.homedir(), "Library", "Logs", "DiagnosticReports");
const github = Boolean(process.env.GITHUB_ACTIONS);

// Výstup Capacitoru (CAPLog → stdout aplikace): chyby, po kterých obrazovka zůstává bílá / prázdná
const FATAL_LOG = [
  [/STARTUP JS ERROR/, "chyba JavaScriptu (window.onerror)"],
  [/\[error\] - /, "chyba v konzoli JavaScriptu (console.error)"],
  [/WebView failed/, "WebView nenačetl rozhraní"],
  [/WebView process terminated/, "spadl proces WebView"],
  [/Capacitor: FATAL ERROR|Unable to export required Bridge JavaScript/, "most Capacitoru se nespustil"],
  [/ERROR: Unable to (find application directory|load)|Unable to (find|parse) (capacitor\.config\.json|config\.xml)/, "v aplikaci chybí sestavené rozhraní"],
  [/Unable to load plugin|Error loading plugin|No method found|does not respond to method call/, "chybí nativní plugin Capacitoru"],
  [/JS Eval error/, "chyba vyhodnocení JavaScriptu"],
  [/Fatal error: |Terminating app due to uncaught exception/, "pád nativní části aplikace"],
];
// Ladicí sestavení Capacitoru vypíše každé odmítnuté volání pluginu ozvěnou přes console.error (chyba z nativní
// části – objekt vždy s „errorMessage“, předtím nativní „ERROR MESSAGE:“), i když ho aplikace ošetří – např. při
// prvním startu chybí soubory zrcadla fronty. Takové řádky se jen vypíšou, za chybu se nepočítají.
const PLUGIN_REJECTION = /\[error\] - (?:LOG FROM NATIVE )?\{.*"errorMessage"/;

function fail(message) {
  console.error(github ? `::error::${escapeData(message)}` : message);
  process.exit(1);
}

const escapeData = (text) => String(text).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
const escapeProperty = (text) => escapeData(text).replace(/:/g, "%3A").replace(/,/g, "%2C");
const annotate = (level, title, message) => console.log(github ? `::${level} title=${escapeProperty(title)}::${escapeData(message)}` : `[${level}] ${title}: ${message}`);
const percent = (value) => `${(value * 100).toFixed(1)} %`;
const seconds = (ms) => Math.round(ms / 100) / 10;

function simctl(args, { allowFail = false, timeout = 600_000, env } = {}) {
  const result = spawnSync("xcrun", ["simctl", ...args], { encoding: "utf8", timeout, env, maxBuffer: 256 * 1024 * 1024 });
  if (!allowFail && (result.error || result.status !== 0)) {
    const detail = `${result.stderr ?? ""}${result.stdout ?? ""}`.trim().slice(0, 800);
    throw new Error(`xcrun simctl ${args.slice(0, 2).join(" ")} selhalo (${result.error?.message ?? `kód ${result.status}`})${detail ? `: ${detail}` : ""}`);
  }
  return result;
}

// ---------------------------------------------------------------------------
//  Simulátory
// ---------------------------------------------------------------------------

function compareVersions(a, b) {
  const left = String(a).split(".").map(Number);
  const right = String(b).split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference) return difference;
  }
  return 0;
}

function pickRuntime() {
  const { runtimes = [] } = JSON.parse(simctl(["list", "runtimes", "-j"]).stdout);
  const ios = runtimes.filter((runtime) => runtime.isAvailable && (runtime.platform === "iOS" || /\.iOS-/.test(runtime.identifier ?? "")));
  ios.sort((a, b) => compareVersions(b.version, a.version));
  if (!ios.length) fail("Na stroji není dostupný simulátor iOS (xcrun simctl list runtimes).");
  return ios[0];
}

function pickDeviceType(runtime, device) {
  let types = runtime.supportedDeviceTypes;
  if (!types?.length) types = JSON.parse(simctl(["list", "devicetypes", "-j"]).stdout).devicetypes ?? [];
  const family = types.filter((type) => type.productFamily === device.family || type.name?.startsWith(device.family));
  for (const pattern of device.prefer) {
    const matches = family.filter((type) => pattern.test(type.name));
    // Nejnovější model (iPhone 17 Pro před 16 Pro, iPad Air 11-inch (M3) před (M2))
    if (matches.length) return matches.sort((a, b) => b.name.localeCompare(a.name, "en", { numeric: true }))[0];
  }
  throw new Error(`${runtime.name} nemá simulátor ${device.family}`);
}

/**
 * Běží aplikace? Proces simulátoru je obyčejný proces Macu s cestou …/Devices/<udid>/…/App.app/App; záložně
 * launchd simulátoru (UIKitApplication:cz.eldock.app[…]).
 */
function appRunning(udid) {
  const ps = spawnSync("ps", ["-axo", "pid=,command="], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout ?? "";
  if (ps.split("\n").some((line) => line.includes(`/Devices/${udid}/`) && /\/App\.app\/App(\s|$)/.test(line))) return true;
  const listing = simctl(["spawn", udid, "launchctl", "list"], { allowFail: true, timeout: 60_000 }).stdout ?? "";
  const line = listing.split("\n").find((row) => row.includes(`UIKitApplication:${BUNDLE_ID}[`));
  return Boolean(line && /^\d+$/.test(line.trim().split(/\s+/)[0]));
}

function crashReports() {
  try {
    return readdirSync(CRASH_DIR)
      .filter((name) => /^App[-_.].*\.(ips|crash)$/i.test(name))
      .map((name) => path.join(CRASH_DIR, name));
  } catch {
    return [];
  }
}

/**
 * Spuštění aplikace. `pty`: výstup přes pseudoterminál simctl (aplikace vidí terminál → řádkový buffer, nic se
 * neztratí ani při ukončení); `files`: záložně přesměrování do souborů s NSUnbufferedIO (stdout bez bufferu).
 */
function launch(udid, mode, base) {
  const env = { ...process.env, SIMCTL_CHILD_NSUnbufferedIO: "YES" };
  const startedAt = Date.now();
  if (mode === "pty") {
    const chunks = [];
    // stdin jako otevřená roura: konec vstupu (/dev/null) by simctl mohl vzít jako konec relace i s aplikací
    const child = spawn("xcrun", ["simctl", "launch", "--console-pty", "--terminate-running-process", udid, BUNDLE_ID], { env, stdio: ["pipe", "pipe", "pipe"] });
    child.stdin.on("error", () => undefined);
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    child.stderr.on("data", (chunk) => chunks.push(chunk));
    const closed = new Promise((resolve) => {
      child.on("close", () => resolve(true));
      child.on("error", (error) => {
        chunks.push(Buffer.from(`xcrun simctl launch: ${error.message}\n`));
        resolve(true);
      });
    });
    return {
      startedAt,
      text: () => Buffer.concat(chunks).toString("utf8"),
      async stop() {
        simctl(["terminate", udid, BUNDLE_ID], { allowFail: true });
        if (!(await Promise.race([closed, sleep(15_000).then(() => false)]))) child.kill("SIGKILL");
        child.stdin.destroy();
      },
    };
  }
  const files = [`${base}-stdout.txt`, `${base}-stderr.txt`];
  simctl(["launch", "--terminate-running-process", `--stdout=${files[0]}`, `--stderr=${files[1]}`, udid, BUNDLE_ID], { env });
  return {
    startedAt,
    text: () => files.map((file) => (existsSync(file) ? readFileSync(file, "utf8") : "")).join("\n"),
    async stop() {
      simctl(["terminate", udid, BUNDLE_ID], { allowFail: true });
      await sleep(1_000);
      for (const file of files) rmSync(file, { force: true });
    },
  };
}

function screenshot(udid, file) {
  simctl(["io", udid, "screenshot", "--type=png", file], { timeout: 60_000 });
  return analyze(decodePng(readFileSync(file)));
}

/** Čeká, až aplikace vykreslí rozhraní (dva snímky po sobě bez problému), nebo spadne. */
async function waitForUi(udid, app, probe) {
  let last = null;
  let seen = false;
  let hits = 0;
  let firstOkMs = 0;
  let lastNote = "";
  while (Date.now() - app.startedAt < READY_TIMEOUT_MS) {
    await sleep(POLL_MS);
    const running = appRunning(udid);
    if (running) seen = true;
    else if (seen || Date.now() - app.startedAt > 60_000) return { ready: false, crashed: true, last };
    if (!running) continue;
    try {
      last = screenshot(udid, probe);
    } catch (error) {
      last = { problem: `snímek se nepodařil (${error instanceof Error ? error.message : error})` };
    }
    const note = last.problem ?? "rozhraní vykreslené";
    if (note !== lastNote) console.log(`  ${seconds(Date.now() - app.startedAt)} s: ${note}`);
    lastNote = note;
    hits = last.problem ? 0 : hits + 1;
    if (hits === 1) firstOkMs = Date.now() - app.startedAt;
    if (hits >= 2) return { ready: true, afterMs: firstOkMs, last };
  }
  return { ready: false, crashed: false, last };
}

function checkAppLog(text) {
  const lines = text.split("\n");
  const rejections = lines.filter((line) => PLUGIN_REJECTION.test(line));
  const relevant = lines.filter((line) => !PLUGIN_REJECTION.test(line));
  const problems = [];
  for (const [pattern, label] of FATAL_LOG) {
    const index = relevant.findIndex((line) => pattern.test(line));
    if (index >= 0) problems.push(`${label}: ${relevant.slice(index, index + 4).map((line) => line.trim()).filter(Boolean).join(" | ").slice(0, 400)}`);
  }
  if (!text.includes("Loading app at")) problems.push("výstup aplikace se nezachytil – chyby JavaScriptu nejde ověřit");
  else if (!text.includes("WebView loaded")) problems.push("WebView nedokončil načtení rozhraní (ve výstupu chybí „WebView loaded“)");
  const rejected = [...new Set(rejections.map((line) => line.replace(/^.*?\[error\] - (?:LOG FROM NATIVE )?/, "").slice(0, 200)))];
  return { capacitorLines: lines.filter((line) => /⚡️|ERROR MESSAGE:|\[Capacitor Plugin Error\]/u.test(line)), rejections: rejections.length, rejected, problems };
}

async function checkDevice(device, runtime, appPath, outDir) {
  const type = pickDeviceType(runtime, device);
  const result = { key: device.key, device: type.name, runtime: runtime.name, ok: false, readyAfterS: null, screen: null, capacitorLines: 0, pluginRejections: 0, pluginRejected: [], problems: [] };
  console.log(`\n▶ ${type.name} · ${runtime.name}`);
  const udid = simctl(["create", `Eldock ${device.family}`, type.identifier, runtime.identifier]).stdout.trim();
  let app = null;
  try {
    simctl(["bootstatus", udid, "-b"], { timeout: 900_000 });
    // Stejný stavový řádek na všech snímcích
    simctl(["status_bar", udid, "override", "--time", "9:41", "--batteryState", "charged", "--batteryLevel", "100"], { allowFail: true });
    simctl(["install", udid, appPath]);
    const crashesBefore = new Set(crashReports());
    const base = path.join(outDir, device.key);
    const probe = `${base}-prubeh.png`;

    app = launch(udid, "pty", base);
    const ui = await waitForUi(udid, app, probe);
    if (ui.crashed) result.problems.push("aplikace neběží – spadla nebo se hned ukončila");
    else if (!ui.ready) result.problems.push(`rozhraní se do ${READY_TIMEOUT_MS / 1000} s nevykreslilo: ${ui.last?.problem ?? "bez snímku"}`);
    else {
      result.readyAfterS = seconds(ui.afterMs);
      await sleep(SETTLE_MS);
    }

    // Výsledný snímek – i při chybě, pro rozbor (workflow ho nahraje i jako samostatný artefakt eldock-<zařízení>.png)
    try {
      result.screen = screenshot(udid, path.join(outDir, `eldock-${device.key}.png`));
      if (ui.ready && result.screen.problem) result.problems.push(`výsledný snímek: ${result.screen.problem}`);
    } catch (error) {
      result.problems.push(`výsledný snímek se nepodařil (${error instanceof Error ? error.message : error})`);
    }
    if (ui.ready) rmSync(probe, { force: true });
    if (!ui.crashed && !appRunning(udid)) result.problems.push("aplikace po vykreslení skončila");

    // Systémový záznam aplikace a WebKitu ještě před ukončením aplikace
    const minutes = Math.ceil((Date.now() - app.startedAt) / 60_000) + 1;
    const system = simctl(["spawn", udid, "log", "show", "--style", "compact", "--info", "--last", `${minutes}m`, "--predicate", 'process == "App" OR process BEGINSWITH "com.apple.WebKit"'], { allowFail: true, timeout: 300_000 });
    writeFileSync(`${base}-system.log`, system.stdout || system.stderr || "");

    await app.stop();
    let appLog = app.text();
    app = null;
    if (ui.ready && !appLog.includes("Loading app at")) {
      console.log("  výstup aplikace přes PTY je prázdný – spouštím znovu s výstupem do souborů");
      app = launch(udid, "files", base);
      const again = await waitForUi(udid, app, probe);
      if (again.ready) rmSync(probe, { force: true });
      else result.problems.push(`druhé spuštění (výstup do souborů): ${again.crashed ? "aplikace spadla" : (again.last?.problem ?? "rozhraní se nevykreslilo")}`);
      await sleep(SETTLE_MS);
      appLog = app.text();
      await app.stop();
      app = null;
    }
    appLog = appLog.replace(/\r\n?/g, "\n");
    writeFileSync(`${base}-aplikace.log`, appLog);
    const log = checkAppLog(appLog);
    result.capacitorLines = log.capacitorLines.length;
    result.pluginRejections = log.rejections;
    result.pluginRejected = log.rejected.slice(0, 10);
    result.problems.push(...log.problems);
    if (github) console.log(`::group::Výstup aplikace – ${type.name} (${log.capacitorLines.length} řádků ⚡️)`);
    console.log(log.capacitorLines.slice(0, 300).join("\n") || "(prázdný)");
    if (github) console.log("::endgroup::");

    const crashes = crashReports().filter((file) => !crashesBefore.has(file));
    for (const file of crashes) copyFileSync(file, path.join(outDir, path.basename(file)));
    if (crashes.length) result.problems.push(`záznam o pádu aplikace: ${crashes.map((file) => path.basename(file)).join(", ")}`);
    result.ok = result.problems.length === 0;
    return result;
  } finally {
    await app?.stop();
    simctl(["shutdown", udid], { allowFail: true });
    simctl(["delete", udid], { allowFail: true });
  }
}

// ---------------------------------------------------------------------------
//  Rozbor snímku (PNG bez knihoven: zlib + filtry řádků)
// ---------------------------------------------------------------------------

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("snímek není PNG");
  let offset = 8;
  let header = null;
  const data = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = { width: chunk.readUInt32BE(0), height: chunk.readUInt32BE(4), depth: chunk[8], color: chunk[9], interlace: chunk[12] };
    else if (type === "IDAT") data.push(chunk);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[header?.color];
  if (!header || !channels || (header.depth !== 8 && header.depth !== 16) || header.interlace) throw new Error(`nepodporovaný formát PNG (${JSON.stringify(header)})`);
  const { width, height } = header;
  const step = header.depth / 8;
  const bpp = channels * step;
  const stride = width * bpp;
  const raw = inflateSync(Buffer.concat(data));
  const rgb = Buffer.alloc(width * height * 3);
  let previous = Buffer.alloc(stride);
  let line = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    for (let index = 0; index < stride; index++) {
      const left = index >= bpp ? line[index - bpp] : 0;
      const up = previous[index];
      const corner = index >= bpp ? previous[index - bpp] : 0;
      let value = raw[start + 1 + index];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - corner;
        const toLeft = Math.abs(estimate - left);
        const toUp = Math.abs(estimate - up);
        const toCorner = Math.abs(estimate - corner);
        value += toLeft <= toUp && toLeft <= toCorner ? left : toUp <= toCorner ? up : corner;
      }
      line[index] = value & 0xff;
    }
    for (let x = 0; x < width; x++) {
      const at = x * bpp;
      const target = (y * width + x) * 3;
      // 16 bitů: stačí horní bajt; šedá → stejná hodnota do všech kanálů
      rgb[target] = line[at];
      rgb[target + 1] = channels >= 3 ? line[at + step] : line[at];
      rgb[target + 2] = channels >= 3 ? line[at + 2 * step] : line[at];
    }
    [previous, line] = [line, previous];
  }
  return { width, height, rgb };
}

/**
 * Obsah obrazovky bez stavového řádku nahoře a domovské lišty dole. Rozhraní Eldocku je tmavé (#09090b, karty
 * #18181b) se světlým textem a žlutými tlačítky (#facc15); úvodní obrazovka iOS (Splash) je žluté logo bez textu.
 */
function analyze({ width, height, rgb }) {
  const top = Math.round(height * 0.08);
  const bottom = Math.round(height * 0.95);
  const total = (bottom - top) * width;
  const count = new Uint32Array(4096);
  const sums = new Float64Array(4096 * 3);
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3;
      const bin = ((rgb[at] >> 4) << 8) | ((rgb[at + 1] >> 4) << 4) | (rgb[at + 2] >> 4);
      count[bin]++;
      sums[bin * 3] += rgb[at];
      sums[bin * 3 + 1] += rgb[at + 1];
      sums[bin * 3 + 2] += rgb[at + 2];
    }
  }
  let mode = 0;
  for (let bin = 1; bin < 4096; bin++) if (count[bin] > count[mode]) mode = bin;
  const background = [0, 1, 2].map((channel) => sums[mode * 3 + channel] / count[mode]);
  let content = 0;
  let yellow = 0;
  let text = 0;
  let minX = width;
  let maxX = -1;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 3;
      const r = rgb[at];
      const g = rgb[at + 1];
      const b = rgb[at + 2];
      if (Math.max(Math.abs(r - background[0]), Math.abs(g - background[1]), Math.abs(b - background[2])) > 40) {
        content++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
      }
      // Žlutá tlačítka (i v barevném prostoru Display P3)
      if (r >= 200 && g >= 150 && b <= 130 && r - b >= 90) yellow++;
      // Světlý neutrální text
      const low = Math.min(r, g, b);
      if (low >= 190 && Math.max(r, g, b) - low <= 40) text++;
    }
  }
  const luma = 0.2126 * background[0] + 0.7152 * background[1] + 0.0722 * background[2];
  const screen = {
    width,
    height,
    background: `#${background.map((value) => Math.round(value).toString(16).padStart(2, "0")).join("")}`,
    backgroundShare: count[mode] / total,
    content: content / total,
    yellow: yellow / total,
    text: text / total,
    contentWidth: maxX >= minX ? (maxX - minX + 1) / width : 0,
    problem: null,
  };
  if (luma > 200 && screen.backgroundShare > 0.85) screen.problem = "bílá obrazovka";
  // Karta spárování na iPadu zabírá jen ~3 % plochy, načítací kolečko ~0,05 %
  else if (screen.content < 0.005) screen.problem = "prázdná obrazovka (jen pozadí, nanejvýš načítací kolečko)";
  else if (screen.text < 0.0002) screen.problem = "na obrazovce není text rozhraní (zůstalo jen logo úvodní obrazovky?)";
  else if (screen.yellow < 0.002) screen.problem = "chybí žlutá tlačítka rozhraní (nenačetly se styly?)";
  return screen;
}

// ---------------------------------------------------------------------------
//  Souhrn
// ---------------------------------------------------------------------------

const describeScreen = (screen) =>
  screen?.width ? `snímek ${screen.width} × ${screen.height} px, obsah na ${percent(screen.contentWidth)} šířky, žlutá ${percent(screen.yellow)}, světlý text ${percent(screen.text)}, pozadí ${screen.background}` : "bez snímku";

function report(result) {
  const title = `${result.device} · ${result.runtime}`;
  const rejections = result.pluginRejections ? `; odmítnutá volání pluginů ošetřená aplikací: ${result.pluginRejections} (${result.pluginRejected.join(" ‖ ").slice(0, 600)})` : "";
  if (result.ok) annotate("notice", title, `Aplikace běží, rozhraní vykreslené za ${result.readyAfterS} s; ${describeScreen(result.screen)}; výstup Capacitoru bez chyb (${result.capacitorLines} řádků, WebView loaded)${rejections}.`);
  else annotate("error", title, `${result.problems.join("\n")}\n${describeScreen(result.screen)}${rejections}`);
}

function summary(results, runtime) {
  const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, "<br>");
  const rows = results.map((result) => {
    const screen = result.screen?.width ? result.screen : null;
    return `| ${cell(result.device)} | ${result.ok ? "✅ běží" : `❌ ${cell(result.problems.join("\n"))}`} | ${result.readyAfterS ?? "–"} s | ${screen ? `${screen.width} × ${screen.height}` : "–"} | ${screen ? percent(screen.contentWidth) : "–"} | ${screen ? `${percent(screen.yellow)} / ${percent(screen.text)}` : "–"} |`;
  });
  const text = [
    `### Aplikace Eldock v simulátoru – ${runtime.name}, úvodní obrazovka bez spárování`,
    "",
    "| Zařízení | Výsledek | Rozhraní za | Snímek (px) | Obsah na šířku | Žlutá / světlý text |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
    ...results
      .filter((result) => result.pluginRejections)
      .map((result) => `- ${cell(result.device)} – odmítnutá volání pluginů ošetřená aplikací (${result.pluginRejections}×): ${result.pluginRejected.map((text) => `\`${text.replace(/`/g, "'")}\``).join(", ")}`),
    "",
    "Snímky: artefakty **eldock-iphone.png** a **eldock-ipad.png**; vše včetně záznamů (výstup aplikace, systémový log, případné záznamy o pádu): artefakt **eldock-ios-simulator**.",
  ].join("\n");
  console.log(`\n${text}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
}

// ---------------------------------------------------------------------------

const [appArg, outArg] = process.argv.slice(2);
if (process.platform !== "darwin") fail("Simulátor iOS běží jen na macOS s Xcode.");
if (!appArg || !outArg) fail("Použití: node scripts/ios-simulator.mjs <App.app ze sestavení pro simulátor> <složka pro snímky a záznamy>");
const appPath = path.resolve(appArg);
const outDir = path.resolve(outArg);
if (!existsSync(path.join(appPath, "Info.plist"))) fail(`Nenalezeno sestavení aplikace ${appPath} (xcodebuild … -sdk iphonesimulator -derivedDataPath build).`);
mkdirSync(outDir, { recursive: true });

const runtime = pickRuntime();
console.log(`Simulátor: ${runtime.name} (${runtime.identifier}), aplikace ${appPath}`);
const results = [];
for (const device of DEVICES) {
  let result;
  try {
    result = await checkDevice(device, runtime, appPath, outDir);
  } catch (error) {
    result = { key: device.key, device: device.family, runtime: runtime.name, ok: false, readyAfterS: null, screen: null, capacitorLines: 0, pluginRejections: 0, pluginRejected: [], problems: [error instanceof Error ? error.message : String(error)] };
  }
  results.push(result);
  report(result);
}
writeFileSync(path.join(outDir, "souhrn.json"), `${JSON.stringify({ runtime: runtime.name, results }, null, 2)}\n`);
summary(results, runtime);
if (!results.every((result) => result.ok)) process.exitCode = 1;
