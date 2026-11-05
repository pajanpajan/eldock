// Fáze 56: měření přesnosti AI rozpoznávání fotek rozváděčů.
//
// Složka s fotkami: ke každé fotce `rozvadec.jpg` patří `rozvadec.truth.json` (ručně ověřená pravda, viz
// src/lib/panel-builder/recognition-eval.ts → TruthFile). Skript pustí stejnou analýzu jako aplikace
// (fáze A lišty → B výřezy lišt → C lupa na přístroje) a vypíše přesnost.
//
//   npm run eval:recognition -- <složka> [--model=gemini-3.1-pro-preview] [--no-zoom] [--mode=AUTO|COVERED|UNCOVERED]
//
// Potřebuje GEMINI_API_KEY v .env (načte se automaticky). Výsledek se uloží i do <složka>/eval-<model>-<datum>.json.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import { EVAL_FIELDS, percent, scorePhoto, type PhotoScore, type TruthFile } from "../src/lib/panel-builder/recognition-eval";

const args = process.argv.slice(2);
const folder = args.find((arg) => !arg.startsWith("--"));
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.split("=")[1];
if (!folder) {
  console.error("Použití: npm run eval:recognition -- <složka s fotkami a *.truth.json> [--model=…] [--no-zoom] [--mode=AUTO]");
  process.exit(2);
}
if (existsSync(".env")) process.loadEnvFile(".env");
if (option("model")) process.env.GEMINI_VISION_MODEL = option("model");
if (args.includes("--no-zoom")) process.env.GEMINI_ZOOM_PASS = "0";

const { analyzePanelPhoto, geminiConfig, isGeminiConfigured } = await import("../src/server/services/geminiPanelService");
if (!isGeminiConfigured()) {
  console.error("Chybí GEMINI_API_KEY (.env) – bez klíče běží jen demo režim a měření nedává smysl.");
  process.exit(2);
}

const MIME: Record<string, string> = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
const photos = readdirSync(resolve(folder)).filter((file) => MIME[extname(file).toLowerCase()] && existsSync(join(folder, `${basename(file, extname(file))}.truth.json`)));
if (!photos.length) {
  console.error(`Ve složce ${folder} není žádná fotka s odpovídajícím *.truth.json.`);
  process.exit(2);
}

const model = geminiConfig().visionModel;
const mode = (option("mode") ?? "AUTO") as "AUTO" | "COVERED" | "UNCOVERED";
console.log(`Model ${model}, lupa ${process.env.GEMINI_ZOOM_PASS === "0" ? "vypnutá" : "zapnutá"}, režim ${mode}, fotek ${photos.length}\n`);

const results: { photo: string; seconds: number; mode: string; warning?: string; score: PhotoScore }[] = [];
for (const photo of photos) {
  const truth = JSON.parse(readFileSync(join(folder, `${basename(photo, extname(photo))}.truth.json`), "utf8")) as TruthFile;
  const bytes = readFileSync(join(folder, photo));
  const started = Date.now();
  const analysis = await analyzePanelPhoto({
    image: { bytes, mimeType: MIME[extname(photo).toLowerCase()] },
    dims: { widthMm: 0, heightMm: 0, dinRailsCount: truth.rails.length, modulesPerRail: Math.max(12, ...truth.rails.map((rail) => rail.reduce((sum, device) => sum + device.modules, 0))) },
    manufacturerHint: truth.manufacturerHint ?? null,
    mode,
  });
  const score = scorePhoto(truth, analysis.mode === "GEMINI" ? analysis.detections : []);
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  results.push({ photo, seconds, mode: analysis.mode, warning: analysis.warning, score });
  if (args.includes("--show")) {
    for (const d of analysis.detections) {
      console.log(`  L${d.dinRailIndex}/${d.positionOnRail} ${String(d.modules).padStart(3)}M ${(d.category ?? "?").padEnd(11)} ${(d.poles ?? "").padEnd(5)} ${d.trippingCurve ?? ""}${d.ratedCurrentA ?? ""} ${d.rcdType ? `typ ${d.rcdType} ${d.rcdSensitivityMa ?? ""}mA` : ""} ${d.manufacturer ?? ""} conf ${d.confidence.toFixed(2)} | ${d.rawOcrText.slice(0, 70)}`);
    }
  }
  console.log(
    `${photo}: lišty ${score.railsPredicted}/${score.railsTruth}, přístroje přesně ${score.exact}/${score.devicesTruth} (${percent(score.exact, score.devicesTruth)}), vynechané ${score.missed}, navíc ${score.extra}, ${seconds} s${analysis.mode !== "GEMINI" ? ` – ${analysis.mode}: ${analysis.warning ?? ""}` : ""}`,
  );
}

const total = (pick: (score: PhotoScore) => number) => results.reduce((sum, row) => sum + pick(row.score), 0);
console.log(`\nCELKEM: přístroje přesně ${total((s) => s.exact)}/${total((s) => s.devicesTruth)} (${percent(total((s) => s.exact), total((s) => s.devicesTruth))}), vynechané ${total((s) => s.missed)}, navíc ${total((s) => s.extra)}`);
for (const field of EVAL_FIELDS) {
  const correct = total((s) => s.fields[field].correct);
  const all = total((s) => s.fields[field].total);
  if (all) console.log(`  ${field.padEnd(18)} ${percent(correct, all).padStart(6)}  (${correct}/${all})`);
}
const out = join(folder, `eval-${model}-${new Date().toISOString().slice(0, 10)}.json`);
writeFileSync(out, JSON.stringify({ model, zoom: process.env.GEMINI_ZOOM_PASS !== "0", mode, results }, null, 1));
console.log(`\nVýsledek: ${out}`);
