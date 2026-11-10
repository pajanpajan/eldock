// Fáze 87: zvuk a video generátoru video-návodů – hlasový komentář (Edge TTS cs-CZ-AntoninNeural nebo lokální
// český hlas Windows), časy titulků z hranic slov, ffmpeg / ffprobe a výsledné MP4 (H.264 + AAC, faststart).
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

export const SAMPLE_RATE = 48_000;
/** Pauza mezi titulky u lokální syntézy (každý titulek se syntetizuje zvlášť). */
const LOCAL_GAP_MS = 320;

// ---------------------------------------------------------------- ffmpeg / ffprobe

function runs(command, env) {
  try {
    return spawnSync(command, ["-version"], { stdio: "ignore", env, windowsHide: true }).status === 0;
  } catch {
    return false;
  }
}

/** ffmpeg a ffprobe: `FFMPEG_PATH` / `FFPROBE_PATH`, `ffmpeg-static`, binárky Remotionu (`@remotion/compositor-*`) nebo PATH. */
export function resolveFfmpeg() {
  const candidates = [];
  if (process.env.FFMPEG_PATH) candidates.push({ ffmpeg: process.env.FFMPEG_PATH, ffprobe: process.env.FFPROBE_PATH ?? null, source: "FFMPEG_PATH" });
  try {
    const bundled = require("ffmpeg-static");
    if (bundled) candidates.push({ ffmpeg: bundled, ffprobe: null, source: "ffmpeg-static" });
  } catch {
    // ffmpeg-static není nainstalovaný – nevadí
  }
  const remotion = { win32: "win32-x64-msvc", linux: process.arch === "arm64" ? "linux-arm64-gnu" : "linux-x64-gnu", darwin: process.arch === "arm64" ? "darwin-arm64" : "darwin-x64" }[process.platform];
  if (remotion) {
    try {
      const dir = path.dirname(require.resolve(`@remotion/compositor-${remotion}/package.json`));
      const exe = process.platform === "win32" ? ".exe" : "";
      candidates.push({ ffmpeg: path.join(dir, `ffmpeg${exe}`), ffprobe: path.join(dir, `ffprobe${exe}`), source: `@remotion/compositor-${remotion}`, libDir: dir });
    } catch {
      // Remotion bez binárek pro tuto platformu
    }
  }
  candidates.push({ ffmpeg: "ffmpeg", ffprobe: "ffprobe", source: "PATH" });
  for (const candidate of candidates) {
    const env = candidate.libDir && process.platform !== "win32" ? { ...process.env, LD_LIBRARY_PATH: candidate.libDir, DYLD_LIBRARY_PATH: candidate.libDir } : process.env;
    if (!runs(candidate.ffmpeg, env)) continue;
    const ffprobe = candidate.ffprobe && runs(candidate.ffprobe, env) ? candidate.ffprobe : null;
    return { ffmpeg: candidate.ffmpeg, ffprobe, env, source: candidate.source };
  }
  throw new Error("Nenalezen ffmpeg – nastavte FFMPEG_PATH, nainstalujte ffmpeg-static nebo ffmpeg do PATH (Remotion ho jinak přináší v @remotion/compositor-*).");
}

function run(tool, command, args, { input, maxBuffer = 512 * 1024 * 1024 } = {}) {
  const result = spawnSync(command, args, { env: tool.env, input, maxBuffer, windowsHide: true });
  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim().split("\n").slice(-8).join("\n");
    throw new Error(`${path.basename(command)} ${args.slice(0, 6).join(" ")} … selhal (${result.status}): ${stderr}`);
  }
  return result.stdout;
}

/** Data PCM z WAV (i z roury, kde ffmpeg velikost bloku `data` nezná). */
function wavData(buffer) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (id === "data") {
      const end = size === 0 || size === 0xffffffff || offset + 8 + size > buffer.length ? buffer.length : offset + 8 + size;
      return buffer.subarray(offset + 8, end);
    }
    offset += 8 + size + (size % 2);
  }
  throw new Error("WAV bez bloku data");
}

/** Audio do 16bit PCM mono 48 kHz (Int16Array) – přes WAV, ffmpeg z Remotionu nemá surový výstup s16le. */
export function decodePcm(tool, file) {
  const raw = run(tool, tool.ffmpeg, ["-v", "error", "-i", file, "-map_metadata", "-1", "-bitexact", "-f", "wav", "-acodec", "pcm_s16le", "-ac", "1", "-ar", String(SAMPLE_RATE), "pipe:1"]);
  const data = Buffer.from(wavData(raw));
  return new Int16Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 2));
}

/** Délka souboru v sekundách (ffprobe, jinak z výpisu ffmpeg). */
export function probeDuration(tool, file) {
  if (tool.ffprobe) {
    const out = run(tool, tool.ffprobe, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).toString().trim();
    const value = Number(out);
    if (Number.isFinite(value)) return value;
  }
  const result = spawnSync(tool.ffmpeg, ["-hide_banner", "-i", file], { env: tool.env, windowsHide: true });
  const match = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(result.stderr?.toString() ?? "");
  if (!match) throw new Error(`Nelze zjistit délku ${file}`);
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Proudy a metadata hotového videa. */
export function probeStreams(tool, file) {
  if (!tool.ffprobe) return null;
  const out = run(tool, tool.ffprobe, ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,sample_rate,channels:stream_tags=language:format=duration,size:format_tags=creation_time", "-of", "json", file]).toString();
  return JSON.parse(out);
}

/** Čas vzniku záznamu Playwrightu (metadata `creation_time` webm) v ms, jinak null. */
export function recordingCreatedAt(tool, file) {
  try {
    const info = probeStreams(tool, file);
    const value = info?.format?.tags?.creation_time ?? info?.format?.tags?.CREATION_TIME;
    const ms = value ? Date.parse(value) : NaN;
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- hlasový komentář

/**
 * Text pro syntézu a rozsahy titulků v něm (titulky se spojí mezerou).
 * @param {readonly { text: string; say?: string }[]} cues
 * @returns {{ speech: string; ranges: [number, number][] }}
 */
export function speechOf(cues) {
  let speech = "";
  const ranges = [];
  cues.forEach((cue, index) => {
    if (index) speech += " ";
    const from = speech.length;
    speech += cue.say ?? cue.text;
    ranges.push([from, speech.length]);
  });
  return { speech, ranges };
}

const wordsOf = (text) => text.split(/\s+/).filter(Boolean);

/** Rovnoměrné časy slov titulku podle délky slov (titulek s jinou výslovností nebo lokální hlas). */
function spreadWords(text, start, end) {
  const words = wordsOf(text);
  const total = words.reduce((sum, word) => sum + word.length + 1, 0) || 1;
  let acc = 0;
  return words.map((word) => {
    const t = Math.round(start + ((end - start) * acc) / total);
    acc += word.length + 1;
    return { w: word, t };
  });
}

/**
 * Titulky s časy z hranic slov Edge TTS (`[{ part, start, end }]` v ms). Slovo titulku bez vlastní výslovnosti
 * dostane čas své hranice; titulek s výslovností `say` rozloží slova rovnoměrně mezi první a poslední hranici.
 * @param {readonly { text: string; say?: string }[]} cues
 * @param {readonly { part: string; start: number; end: number }[]} boundaries
 * @param {number} durationMs
 * @returns {{ text: string; start: number; end: number; words: { w: string; t: number }[] }[]}
 */
export function alignCues(cues, boundaries, durationMs) {
  const { speech, ranges } = speechOf(cues);
  const marks = [];
  let position = 0;
  for (const boundary of boundaries) {
    const token = String(boundary.part ?? "").trim();
    if (!token) continue;
    let at = speech.indexOf(token, position);
    if (at < 0) {
      const core = token.replace(/[^\p{L}\p{N}]+/gu, "");
      at = core ? speech.indexOf(core, position) : -1;
    }
    if (at < 0) continue;
    marks.push({ at, start: boundary.start, end: boundary.end });
    position = at + 1;
  }
  const timed = cues.map((cue, index) => {
    const [from, to] = ranges[index];
    const inside = marks.filter((mark) => mark.at >= from && mark.at < to);
    return { cue, from, inside };
  });
  return timed.map(({ cue, from, inside }, index) => {
    const nextStart = timed.slice(index + 1).find((entry) => entry.inside.length)?.inside[0].start;
    const start = inside[0]?.start ?? (index ? null : 0);
    const end = inside.at(-1)?.end ?? nextStart ?? durationMs;
    if (start === null) return { text: cue.text, start: end, end, words: spreadWords(cue.text, end, end) };
    if (cue.say) return { text: cue.text, start, end, words: spreadWords(cue.text, start, end) };
    // stejný text pro titulek i hlas: slovo → hranice, která začíná v jeho rozsahu (pomlčky převezmou čas předchozího slova)
    const words = [];
    let cursor = 0;
    let last = start;
    for (const word of wordsOf(cue.text)) {
      const offset = speech.indexOf(word, from + cursor);
      cursor = offset >= 0 ? offset - from + word.length : cursor;
      const mark = offset >= 0 ? inside.find((entry) => entry.at >= offset && entry.at < offset + word.length) : null;
      last = mark ? mark.start : last;
      words.push({ w: word, t: last });
    }
    return { text: cue.text, start, end, words };
  });
}

const hash = (value) => createHash("sha1").update(value).digest("hex").slice(0, 16);

/** Selhání hlasové služby (jen tehdy generátor přejde na lokální hlas). */
export class TtsError extends Error {}

async function edgeSynthesize(text, file, { voice, rate }) {
  const { EdgeTTS } = await import("node-edge-tts");
  const tts = new EdgeTTS({ voice, lang: voice.slice(0, 5), outputFormat: "audio-24khz-96kbitrate-mono-mp3", saveSubtitles: true, rate, timeout: 90_000 });
  let lastError = null;
  // služba omezuje počet požadavků (HTTP 429) – mezi kapitolami pauza, při odmítnutí delší čekání
  for (const wait of [0, 4000, 10_000, 20_000, 40_000, 60_000]) {
    if (wait) {
      console.log(`[návody]   Edge TTS: ${lastError instanceof Error ? lastError.message : lastError} – další pokus za ${wait / 1000} s`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    try {
      rmSync(file, { force: true });
      await tts.ttsPromise(text, file);
      if (existsSync(file) && statSync(file).size > 1000 && existsSync(`${file}.json`)) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        return JSON.parse(readFileSync(`${file}.json`, "utf8"));
      }
      lastError = new Error("prázdná odpověď");
    } catch (error) {
      lastError = error;
    }
  }
  throw new TtsError(`Edge TTS selhalo: ${lastError instanceof Error ? lastError.message : lastError}`);
}

/** Lokální český hlas Windows (Windows.Media.SpeechSynthesis – např. „Microsoft Jakub“), výstup WAV. */
function localSynthesize(text, file) {
  if (process.platform !== "win32") throw new Error("Lokální syntéza je jen pro Windows (český hlas OneCore).");
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.Runtime.WindowsRuntime",
    "$null = [Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]",
    "$null = [Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]",
    "$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
    "function Await($op, $type) { $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $task.Wait(-1) | Out-Null; $task.Result }",
    "$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer",
    "$voice = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.Language -eq 'cs-CZ' } | Select-Object -First 1",
    "if (-not $voice) { throw 'Ve Windows není nainstalovaný český hlas (Nastavení → Čas a jazyk → Řeč).' }",
    "$synth.Voice = $voice",
    "$stream = Await ($synth.SynthesizeTextToStreamAsync($env:ELDOCK_TTS_TEXT)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])",
    "$reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))",
    "$size = [uint32]$stream.Size",
    "$null = Await ($reader.LoadAsync($size)) ([uint32])",
    "$bytes = New-Object byte[] $size",
    "$reader.ReadBytes($bytes)",
    "[System.IO.File]::WriteAllBytes($env:ELDOCK_TTS_OUT, $bytes)",
  ].join("\n");
  const result = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], { env: { ...process.env, ELDOCK_TTS_TEXT: text, ELDOCK_TTS_OUT: file }, windowsHide: true });
  if (result.status !== 0 || !existsSync(file)) throw new Error(`Lokální syntéza selhala: ${result.stderr?.toString().trim()}`);
}

/**
 * Komentář kapitoly: PCM mono 48 kHz, délka a titulky s časy (ms od začátku komentáře).
 * Edge TTS namluví celou kapitolu najednou (plynulá intonace) a titulky časuje podle hranic slov; lokální hlas
 * mluví titulek po titulku. Výsledky se ukládají do mezipaměti (`.tutorials-work/tts`) podle textu a hlasu.
 */
export async function narrateChapter(tool, chapter, { engine, voice, rate, cacheDir }) {
  mkdirSync(cacheDir, { recursive: true });
  const { speech } = speechOf(chapter.cues);
  if (engine === "edge") {
    const key = hash(`edge|${voice}|${rate}|${speech}`);
    const file = path.join(cacheDir, `${key}.mp3`);
    const meta = `${file}.json`;
    const boundaries = existsSync(file) && existsSync(meta) ? JSON.parse(readFileSync(meta, "utf8")) : await edgeSynthesize(speech, file, { voice, rate });
    const pcm = decodePcm(tool, file);
    const durationMs = Math.round((pcm.length / SAMPLE_RATE) * 1000);
    return { engine, voice, pcm, durationMs, cues: alignCues(chapter.cues, boundaries, durationMs) };
  }
  // lokální hlas: titulek po titulku s krátkou pauzou
  const parts = [];
  for (const cue of chapter.cues) {
    const text = cue.say ?? cue.text;
    const file = path.join(cacheDir, `${hash(`local|${text}`)}.wav`);
    if (!existsSync(file)) localSynthesize(text, file);
    parts.push({ cue, pcm: decodePcm(tool, file) });
  }
  const gap = Math.round((LOCAL_GAP_MS / 1000) * SAMPLE_RATE);
  const total = parts.reduce((sum, part) => sum + part.pcm.length, 0) + gap * Math.max(0, parts.length - 1);
  const pcm = new Int16Array(total);
  const cues = [];
  let offset = 0;
  for (const [index, part] of parts.entries()) {
    pcm.set(part.pcm, offset);
    const start = Math.round((offset / SAMPLE_RATE) * 1000);
    const end = Math.round(((offset + part.pcm.length) / SAMPLE_RATE) * 1000);
    cues.push({ text: part.cue.text, start, end, words: spreadWords(part.cue.text, start, end) });
    offset += part.pcm.length + (index < parts.length - 1 ? gap : 0);
  }
  return { engine, voice: "Windows cs-CZ (lokální)", pcm, durationMs: Math.round((total / SAMPLE_RATE) * 1000), cues };
}

// ---------------------------------------------------------------- stopa komentáře a výsledné MP4

/** Komentáře kapitol na časové ose videa → WAV (16 bit mono 48 kHz). */
export function writeNarrationWav(file, totalSec, clips) {
  const length = Math.ceil(totalSec * SAMPLE_RATE);
  const track = new Int16Array(length);
  for (const clip of clips) {
    const at = Math.max(0, Math.round(clip.atSec * SAMPLE_RATE));
    const room = Math.max(0, length - at);
    track.set(clip.pcm.subarray(0, room), at);
  }
  const header = Buffer.alloc(44);
  const bytes = track.length * 2;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + bytes, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(bytes, 40);
  writeFileSync(file, Buffer.concat([header, Buffer.from(track.buffer, track.byteOffset, bytes)]));
}

/**
 * Záznam obrazovky (webm) + komentář (WAV) → MP4 H.264 (CRF 23, yuv420p, High@4.1) + AAC 128 kb/s s faststart.
 * Klíčové snímky přesně na začátcích kapitol – přetočení na kapitolu je v prohlížeči okamžité.
 */
export function muxMp4(tool, { video, audio, out, startSec, durationSec, title, crf = 23, keyframes = [] }) {
  mkdirSync(path.dirname(out), { recursive: true });
  const temp = `${out}.part.mp4`;
  rmSync(temp, { force: true });
  const forced = keyframes.length ? ["-force_key_frames", keyframes.map((seconds) => seconds.toFixed(2)).join(",")] : [];
  run(tool, tool.ffmpeg, [
    "-y", "-v", "error",
    "-ss", startSec.toFixed(3), "-i", video,
    "-i", audio,
    "-map", "0:v:0", "-map", "1:a:0",
    "-t", durationSec.toFixed(3),
    // veryslow + tune animation = o ~10 % menší soubor při stejném CRF (plochy a ostré hrany rozhraní); strop 2 Mb/s
    // omezí jen špičky při posunu stránky a otevření dialogu (−25 % velikosti, statický obraz má dál kvalitu CRF 23)
    "-c:v", "libx264", "-preset", "veryslow", "-tune", "animation", "-crf", String(crf), "-maxrate", "2000k", "-bufsize", "4000k", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.1", "-r", "25",
    ...forced,
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
    "-movflags", "+faststart",
    "-metadata", `title=${title}`, "-metadata", "artist=ELDOCK", "-metadata:s:a:0", "language=ces",
    temp,
  ]);
  rmSync(out, { force: true });
  renameSync(temp, out);
}

/** Náhledový obrázek (poster) přehrávače – JPEG 1280 × 720 ze snímku hotového MP4. */
export function extractPoster(tool, video, atSec, out) {
  run(tool, tool.ffmpeg, ["-y", "-v", "error", "-ss", atSec.toFixed(2), "-i", video, "-frames:v", "1", "-vf", "scale=1280:-2", "-q:v", "4", out]);
}

/** Spuštění procesu s průběžným výstupem (build serveru, prisma). */
export function runLive(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", windowsHide: true, shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command), ...options });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(command)} ${args.join(" ")} skončil kódem ${code}`))));
  });
}
