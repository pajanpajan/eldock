// Fáze 87: generátor dvou ozvučených českých video-návodů (`npm run tutorials:generate`).
//
// 1. Komentář: každá kapitola z `src/lib/tutorials.ts` se namluví (Edge TTS cs-CZ-AntoninNeural, nebo `--tts=local`
//    = český hlas Windows bez odesílání textu ven) a z hranic slov vzniknou časy titulků.
// 2. Server: vlastní Next.js s čistou databází `tutorials.db` (migrace + seed, firma Tester bez přihlašovací brány)
//    a odděleným `NEXT_DIST_DIR=.next-tutorials` (produkční build, `--server=dev` = dev server).
// 3. Natáčení: Playwright (`recordVideo` 1920 × 1080) se žlutočerveným kurzorem a titulkovou lištou ze
//    `scripts/tutorials/overlay.mjs`; akce kapitol (`scripts/tutorials/scenarios.mjs`) čekají na slova komentáře.
// 4. Střih: komentáře kapitol na časové ose záznamu → MP4 H.264 CRF 23 + AAC 128 kb/s s faststart do
//    `public/tutorials/` a časy kapitol do `src/lib/tutorials.generated.ts` (kapitoly na /navody a v editorech).
//
// Volby: --only=pudorys,panel-builder · --tts=edge|local · --voice=cs-CZ-AntoninNeural · --rate=+0% ·
// --server=prod|dev · --skip-build · --reuse-db · --port=3210 · --base-url=http://… (běžící server s bypassem
// přihlášení, bez přípravy databáze) · --browser=msedge|chromium · --headed · --shots · --keep-server · --crf=23
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

import { TUTORIALS, chapterBadge } from "../src/lib/tutorials.ts";
import { Chapter, Director, sleep } from "./tutorials/director.mjs";
import { TtsError, extractPoster, muxMp4, narrateChapter, probeStreams, recordingCreatedAt, resolveFfmpeg, runLive, writeNarrationWav } from "./tutorials/media.mjs";
import { tutorialOverlay } from "./tutorials/overlay.mjs";
import { SCENARIOS } from "./tutorials/scenarios.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORK = path.join(ROOT, ".tutorials-work");
const OUT_DIR = path.join(ROOT, "public", "tutorials");
const GENERATED = path.join(ROOT, "src", "lib", "tutorials.generated.ts");
const DB_FILE = "tutorials.db";
const DIST_DIR = ".next-tutorials";
const VIEW = { width: 1920, height: 1080 };
/** Odznak kapitoly se ukáže o chvíli dřív, než hlas začne mluvit. */
const LEAD_MS = 650;
/** Po konci komentáře kapitoly ještě chvíli ticho (výsledek akce zůstane na obrazovce). */
const TAIL_MS = 750;
const OUTRO_MS = 2600;
const OUTRO_TEXT = "Vyzkoušejte si to na eldock.cz – všechny návody najdete na eldock.cz/navody";

function parseArgs(argv) {
  const options = {};
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (match) options[match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = match[2] ?? true;
  }
  return options;
}

const args = parseArgs(process.argv.slice(2));
const engine = String(args.tts ?? process.env.TUTORIAL_TTS ?? "edge");
const voice = String(args.voice ?? process.env.TUTORIAL_VOICE ?? "cs-CZ-AntoninNeural");
const rate = String(args.rate ?? "+0%");
const serverMode = String(args.server ?? "prod");
const port = Number(args.port ?? 3210);
const channel = String(args.browser ?? (process.platform === "win32" ? "msedge" : "chromium"));
const crf = Number(args.crf ?? 23);

const log = (message) => console.log(`[návody] ${message}`);
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;

// ---------------------------------------------------------------- server

/** Podřízené procesy najdou `tsx` a `prisma` i při spuštění bez npm (node scripts/generate-tutorials.mjs). */
const childEnv = (extra = {}) => {
  const bin = path.join(ROOT, "node_modules", ".bin");
  const key = Object.keys(process.env).find((name) => name.toLowerCase() === "path") ?? "PATH";
  return { ...process.env, [key]: `${bin}${path.delimiter}${process.env[key] ?? ""}`, ...extra };
};

async function isUp(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function prepareDatabase() {
  const file = path.join(ROOT, DB_FILE);
  if (args.reuseDb && existsSync(file)) return log(`Databáze ${DB_FILE} zůstává (--reuse-db).`);
  for (const suffix of ["", "-journal", "-wal", "-shm"]) rmSync(file + suffix, { force: true });
  const env = childEnv({ DATABASE_URL: `file:./${DB_FILE}` });
  const prisma = path.join(ROOT, "node_modules", "prisma", "build", "index.js");
  log(`Čistá databáze ${DB_FILE} (migrace + seed)…`);
  await runLive(process.execPath, [prisma, "migrate", "deploy"], { cwd: ROOT, env });
  await runLive(process.execPath, [prisma, "db", "seed"], { cwd: ROOT, env });
}

function killTree(child) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  else child.kill("SIGTERM");
}

async function startServer() {
  if (args.baseUrl) {
    const url = String(args.baseUrl).replace(/\/$/, "");
    if (!(await isUp(`${url}/manifest.webmanifest`))) throw new Error(`Server ${url} neodpovídá.`);
    log(`Používám běžící server ${url} (musí mít ELDOCK_BYPASS_AUTH=1 nebo přihlášenou firmu).`);
    return { url, stop: () => {} };
  }
  const url = `http://localhost:${port}`;
  if (await isUp(`${url}/manifest.webmanifest`)) throw new Error(`Na portu ${port} už běží server – zastavte ho, nebo ho předejte přes --base-url=${url}.`);
  await prepareDatabase();
  mkdirSync(WORK, { recursive: true });
  const env = childEnv({
    NODE_ENV: serverMode === "prod" ? "production" : "development",
    NEXT_DIST_DIR: DIST_DIR,
    DATABASE_URL: `file:./${DB_FILE}`,
    NEXT_TELEMETRY_DISABLED: "1",
    // firma Tester bez přihlašovací brány (jen lokální server generátoru)
    ELDOCK_BYPASS_AUTH: "1",
    ELDOCK_AUTH_SECRET: randomBytes(24).toString("hex"),
    ELDOCK_LOCK_ACCOUNT_SWITCHER: "",
    GEMINI_API_KEY: "",
    ELDOCK_SMTP_URL: "",
    ELDOCK_GA4_ID: "",
    ELDOCK_BACKUP: "0",
    ELDOCK_BACKUP_DIR: path.join(WORK, "backups"),
    ELDOCK_BACKUP_KEY: "",
    ELDOCK_BACKUP_S3_ENDPOINT: "",
  });
  const next = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
  if (serverMode === "prod" && !(args.skipBuild && existsSync(path.join(ROOT, DIST_DIR, "BUILD_ID")))) {
    log(`Produkční build do ${DIST_DIR} (několik minut)…`);
    await runLive(process.execPath, [next, "build"], { cwd: ROOT, env });
  }
  const logFile = path.join(WORK, "server.log");
  const out = createWriteStream(logFile);
  const child = spawn(process.execPath, [next, serverMode === "prod" ? "start" : "dev", "-p", String(port)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  const started = Date.now();
  while (!(await isUp(`${url}/manifest.webmanifest`))) {
    if (child.exitCode !== null) throw new Error(`Server skončil (kód ${child.exitCode}) – viz ${logFile}`);
    if (Date.now() - started > 300_000) throw new Error(`Server nenaběhl do 5 minut – viz ${logFile}`);
    await sleep(1000);
  }
  log(`Server ${url} běží (${serverMode}, log ${path.relative(ROOT, logFile)}).`);
  return { url, stop: () => killTree(child) };
}

/** Trasy natáčení se jednou otevřou mimo záznam (dev server je kompiluje, produkční nahřeje mezipaměť). */
async function warmUp(browser, url) {
  const context = await browser.newContext({ baseURL: url, viewport: VIEW, locale: "cs-CZ", timezoneId: "Europe/Prague", colorScheme: "dark" });
  const page = await context.newPage();
  const visit = async (route) => {
    try {
      await page.goto(route, { timeout: 180_000 });
      await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
    } catch (error) {
      log(`Zahřátí ${route} selhalo: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
    }
  };
  for (const route of ["/panel-builder", "/panel-builder/floorplan", "/panel-builder/floorplan/novy", "/panel-builder/catalog"]) await visit(route);
  // kroky projektu na vzorovém PB-001 (dynamické trasy jsou pro všechny projekty stejné)
  await visit("/panel-builder");
  const sample = await page.getByRole("link", { name: /PB-001/ }).first().getAttribute("href").catch(() => null);
  if (sample) for (const step of ["", "/tree", "/enclosure", "/thermal", "/documentation", "/labels"]) await visit(`${sample}${step}`);
  await context.close();
}

// ---------------------------------------------------------------- natáčení

async function setBanner(page, banner) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await page.evaluate((value) => window.__eldockTutorial?.setBanner(value), banner);
      return;
    } catch {
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await sleep(200);
    }
  }
}

/**
 * Zápis do public/tutorials: ve Windows soubor občas na chvíli zamkne jiný proces (antivir, náhledy Průzkumníka) a
 * ffmpeg ho neotevře („Could not open file … I/O error“) – zápis se zkusí znovu, aby se kvůli tomu nezahodilo celé natáčení.
 */
async function retryWrite(label, action, attempts = 5) {
  for (let attempt = 1; ; attempt++) {
    try {
      return action();
    } catch (error) {
      if (attempt >= attempts) throw error;
      log(`  ${label}: pokus ${attempt} selhal (${error instanceof Error ? error.message.split("\n")[0] : error}) – znovu za 3 s`);
      await sleep(3000);
    }
  }
}

async function record(tool, browser, url, tutorial, voices) {
  const rawDir = path.join(WORK, "raw", tutorial.id);
  rmSync(rawDir, { recursive: true, force: true });
  mkdirSync(rawDir, { recursive: true });
  const context = await browser.newContext({
    baseURL: url,
    viewport: VIEW,
    deviceScaleFactor: 1,
    locale: "cs-CZ",
    timezoneId: "Europe/Prague",
    colorScheme: "dark",
    acceptDownloads: true,
    recordVideo: { dir: rawDir, size: VIEW },
  });
  await context.addInitScript(tutorialOverlay);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: url }).catch(() => {});
  const page = await context.newPage();
  const pageCreated = Date.now();
  page.on("dialog", (dialog) => void dialog.accept().catch(() => {}));
  page.on("pageerror", (error) => log(`Chyba stránky: ${error.message.split("\n")[0]}`));
  const director = new Director(page, { log });
  const scenario = SCENARIOS[tutorial.id];
  const shared = { url, tutorial };
  await scenario.prepare(director, shared);

  const marks = [];
  for (const [index, chapter] of tutorial.chapters.entries()) {
    const narration = voices[index];
    const start = Date.now();
    const audioStart = start + LEAD_MS;
    const absolute = narration.cues.map((cue) => ({ text: cue.text, start: audioStart + cue.start, end: audioStart + cue.end, words: cue.words.map((word) => ({ w: word.w, t: audioStart + word.t })) }));
    await setBanner(page, { badge: chapterBadge(tutorial, index), cues: absolute });
    log(`${tutorial.id} · ${index + 1}/${tutorial.chapters.length} ${chapter.title} (${(narration.durationMs / 1000).toFixed(1)} s)`);
    const timeline = new Chapter({ audioStart, durationMs: narration.durationMs, cues: narration.cues });
    try {
      await scenario.chapters[index](director, timeline, shared);
    } catch (error) {
      await page.screenshot({ path: path.join(rawDir, `chyba-kapitola-${index + 1}.png`) }).catch(() => {});
      throw error;
    }
    const overrun = Date.now() - (audioStart + narration.durationMs + TAIL_MS);
    if (overrun > 0) log(`  akce kapitoly přetáhly komentář o ${(overrun / 1000).toFixed(1)} s`);
    await sleep(-overrun);
    if (args.shots) await page.screenshot({ path: path.join(rawDir, `kapitola-${index + 1}.png`) }).catch(() => {});
    marks.push({ start, audioStart });
  }
  const outro = Date.now();
  await setBanner(page, { badge: "✓ HOTOVO · ELDOCK", cues: [{ text: OUTRO_TEXT, start: outro, end: outro + OUTRO_MS, words: OUTRO_TEXT.split(" ").map((w) => ({ w, t: outro })) }] });
  await sleep(OUTRO_MS);
  const end = Date.now();
  const video = page.video();
  await context.close();
  const raw = await video.path();

  // časová osa: začátek videa = vznik záznamu (metadata webm), střih těsně před první kapitolou
  const created = recordingCreatedAt(tool, raw) ?? pageCreated;
  log(`  vznik záznamu: metadata ${created === pageCreated ? "nedostupná" : `${created - pageCreated} ms proti otevření stránky`}`);
  const trim = Math.max(0, (marks[0].start - created) / 1000 - 0.2);
  const total = (end - created) / 1000 - trim;
  const wav = path.join(rawDir, "komentar.wav");
  writeNarrationWav(wav, total, marks.map((mark, index) => ({ atSec: (mark.audioStart - created) / 1000 - trim, pcm: voices[index].pcm })));
  const out = path.join(ROOT, "public", tutorial.file.replace(/^\//, ""));
  log(`  střih ${tutorial.file} (${total.toFixed(1)} s)…`);
  // začátky kapitol na desetiny sekundy nahoru – stejný čas má přehrávač i klíčový snímek
  const chapterStarts = marks.map((mark) => Math.max(0, Math.ceil(((mark.start - created) / 1000 - trim) * 10) / 10));
  await retryWrite("střih MP4", () => muxMp4(tool, { video: raw, audio: wav, out, startSec: trim, durationSec: total, title: `ELDOCK – ${tutorial.title}`, crf, keyframes: chapterStarts }));
  await retryWrite("plakátek", () => extractPoster(tool, out, Math.min(total - 0.5, (chapterStarts[3] ?? chapterStarts[0]) + 1.5), out.replace(/\.mp4$/, ".jpg")));
  const info = probeStreams(tool, out);
  const videoStream = info?.streams?.find((stream) => stream.codec_type === "video");
  const audioStream = info?.streams?.find((stream) => stream.codec_type === "audio");
  if (info && (!videoStream || !audioStream)) throw new Error(`${out}: chybí ${videoStream ? "zvuková" : "obrazová"} stopa`);
  const sizeBytes = statSync(out).size;
  const durationSec = Number(info?.format?.duration ?? total);
  log(`  hotovo: ${path.relative(ROOT, out)} · ${mb(sizeBytes)} · ${durationSec.toFixed(1)} s · ${videoStream?.codec_name ?? "?"} ${videoStream?.width ?? "?"}×${videoStream?.height ?? "?"} + ${audioStream?.codec_name ?? "?"} (${audioStream?.tags?.language ?? "?"})`);
  return {
    id: tutorial.id,
    durationSec: Math.round(durationSec * 10) / 10,
    sizeBytes,
    width: videoStream?.width ?? VIEW.width,
    height: videoStream?.height ?? VIEW.height,
    video: videoStream?.codec_name ?? "h264",
    audio: audioStream?.codec_name ?? "aac",
    chapters: chapterStarts,
    voice: voices[0].engine === "edge" ? `Edge TTS ${voices[0].voice}` : voices[0].voice,
  };
}

// ---------------------------------------------------------------- výstup

function writeGenerated(results) {
  const media = Object.fromEntries(results.map((result) => [result.id, result]));
  const body = [
    "// Vygenerováno skriptem `npm run tutorials:generate` (scripts/generate-tutorials.mjs) – ručně neupravovat.",
    "// Časy kapitol (s od začátku videa), délka, velikost a stopy MP4 v public/tutorials.",
    "",
    'import type { TutorialId } from "./tutorials";',
    "",
    "export interface TutorialMedia {",
    "  id: TutorialId;",
    "  durationSec: number;",
    "  sizeBytes: number;",
    "  width: number;",
    "  height: number;",
    "  video: string;",
    "  audio: string;",
    "  chapters: readonly number[];",
    "  voice: string;",
    "}",
    "",
    `export const TUTORIAL_GENERATED_AT = ${JSON.stringify(new Date().toISOString())};`,
    "",
    `export const TUTORIAL_MEDIA: Partial<Record<TutorialId, TutorialMedia>> = ${JSON.stringify(media, null, 2)};`,
    "",
  ].join("\n");
  writeFileSync(GENERATED, body);
}

async function readExisting() {
  try {
    const generated = await import(`../src/lib/tutorials.generated.ts?t=${Date.now()}`);
    return generated.TUTORIAL_MEDIA ?? {};
  } catch {
    return {};
  }
}

async function main() {
  const wanted = args.only ? String(args.only).split(",") : null;
  const tutorials = TUTORIALS.filter((tutorial) => !wanted || wanted.includes(tutorial.id));
  if (!tutorials.length) throw new Error(`--only: žádný návod (${TUTORIALS.map((tutorial) => tutorial.id).join(", ")})`);
  const tool = resolveFfmpeg();
  log(`ffmpeg: ${tool.source}${tool.ffprobe ? " (+ ffprobe)" : ""}`);

  // 1. komentář (při výpadku Edge TTS lokální český hlas Windows)
  let used = engine;
  const voices = {};
  for (const tutorial of tutorials) {
    voices[tutorial.id] = [];
    for (const chapter of tutorial.chapters) {
      let narration;
      try {
        narration = await narrateChapter(tool, chapter, { engine: used, voice, rate, cacheDir: path.join(WORK, "tts") });
      } catch (error) {
        if (!(error instanceof TtsError) || used !== "edge" || process.platform !== "win32") throw error;
        log(`VAROVÁNÍ: ${error instanceof Error ? error.message : error} – přepínám na lokální český hlas Windows.`);
        used = "local";
        narration = await narrateChapter(tool, chapter, { engine: used, voice, rate, cacheDir: path.join(WORK, "tts") });
      }
      voices[tutorial.id].push(narration);
    }
    if (used === "local" && voices[tutorial.id].some((narration) => narration.engine === "edge")) {
      // jeden návod jedním hlasem
      voices[tutorial.id] = [];
      for (const chapter of tutorial.chapters) voices[tutorial.id].push(await narrateChapter(tool, chapter, { engine: "local", voice, rate, cacheDir: path.join(WORK, "tts") }));
    }
    const seconds = voices[tutorial.id].reduce((sum, narration) => sum + narration.durationMs, 0) / 1000;
    log(`Komentář ${tutorial.id}: ${tutorial.chapters.length} kapitol, ${seconds.toFixed(1)} s (${voices[tutorial.id][0].voice})`);
  }

  // 2. server a 3. natáčení
  mkdirSync(OUT_DIR, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ channel: channel === "chromium" ? undefined : channel, headless: !args.headed, args: ["--hide-scrollbars", "--force-color-profile=srgb"] });
  const results = [];
  try {
    await warmUp(browser, server.url);
    for (const tutorial of tutorials) results.push(await record(tool, browser, server.url, tutorial, voices[tutorial.id]));
  } finally {
    await browser.close().catch(() => {});
    if (!args.keepServer) server.stop();
  }

  // 4. časy kapitol pro aplikaci (ostatní návody beze změny, když se generoval jen jeden)
  const previous = await readExisting();
  const merged = TUTORIALS.map((tutorial) => results.find((result) => result.id === tutorial.id) ?? (previous[tutorial.id] ? { ...previous[tutorial.id] } : null)).filter(Boolean);
  writeGenerated(merged);
  log(`Časy kapitol zapsány do ${path.relative(ROOT, GENERATED)}.`);
}

main().catch((error) => {
  console.error(`[návody] CHYBA: ${error instanceof Error ? error.stack : error}`);
  process.exit(1);
});
