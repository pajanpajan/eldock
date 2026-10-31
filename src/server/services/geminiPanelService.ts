// Gemini AI pro Panel Builder: analýza fotky rozváděče, atomizace PDF datasheetů a dohledání
// parametrů neznámého přístroje. Bez GEMINI_API_KEY (nebo když Gemini neodpoví) běží deterministický
// demo režim – služba nikdy nespadne, jen vrátí `mode: "DEMO"` (UI zobrazí štítek Demo AI režimu).

import type { ComponentCategory } from "@/generated/prisma/enums";
import { COMPONENT_CATEGORIES, estimateModules, estimatePowerLoss, iecSymbolFor, isMix, isPoles, normalizeManufacturer } from "@/lib/panel-builder/catalog";
import { extractComponents, parseComponent, type ExtractedComponent } from "@/lib/panel-builder/datasheet-extract";
import type { EnclosureDims } from "@/lib/panel-builder/layout";
import { demoDetections, type Detection } from "@/lib/panel-builder/matching";

export type AiMode = "GEMINI" | "DEMO";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 90_000;

export function geminiConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  return {
    apiKey,
    visionModel: process.env.GEMINI_VISION_MODEL?.trim() || "gemini-2.5-pro",
    datasheetModel: process.env.GEMINI_DATASHEET_MODEL?.trim() || "gemini-2.5-flash",
  };
}

export const isGeminiConfigured = () => Boolean(geminiConfig().apiKey);

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

/** Jedno volání generateContent se strukturovanou odpovědí (JSON podle schématu). */
async function generateJson<T>(model: string, parts: Part[], schema: object): Promise<T> {
  const { apiKey } = geminiConfig();
  if (!apiKey) throw new Error("GEMINI_API_KEY není nastaven.");
  const response = await fetch(`${API}/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json", responseSchema: schema },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Gemini ${model}: HTTP ${response.status}`);
  const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  return JSON.parse(text) as T;
}

const CATEGORY_ENUM = { type: "STRING", enum: [...COMPONENT_CATEGORIES] };
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const category = (value: unknown): ComponentCategory | null => ((COMPONENT_CATEGORIES as readonly unknown[]).includes(value) ? (value as ComponentCategory) : null);

// ---------------------------------------------------------------------------
//  Analýza fotky rozváděče (GEMINI_VISION_MODEL)
// ---------------------------------------------------------------------------

/**
 * Prompt pro analýzu fotky. Bez nápovědy (projekt „Různí výrobci“) model nesmí předpokládat jednu
 * značku – výrobce určí u každého modulu zvlášť. Se značkou ji jen upřednostní při horší čitelnosti.
 */
export function photoPrompt(manufacturerHint: string | null): string {
  const brand = isMix(manufacturerHint)
    ? `V rozváděči mohou být přístroje RŮZNÝCH výrobců (např. OEZ odpínač, Saltek přepěťová ochrana, Eaton jističe).
Nepředpokládej jednu značku: výrobce urči u KAŽDÉHO modulu samostatně podle loga, barvy a tvaru páček
a formátu typového kódu (ABB S201-B16, Eaton PL7-B16/1, OEZ LTN-16B-1, Schneider iC60N, Hager MBN116 …).`
    : `Převažující výrobce přístrojů je pravděpodobně ${manufacturerHint} – při horší čitelnosti ho upřednostni,
ale u každého modulu výrobce ověř podle loga a typového kódu (rozváděč může obsahovat i jiné značky).`;
  return `Jsi zkušený elektrotechnik. Na fotce je otevřený rozváděč s modulovými přístroji na DIN lištách.
Najdi všechny DIN lišty (shora dolů, číslováno od 1) a na každé všechny přístroje zleva doprava.
${brand}
Vícepólové přístroje NEROZDĚLUJ na jednotlivé moduly: sleduj ovládací páčky spojené propojovací hrazdičkou
(společná páčka přes 2, 3 nebo 4 moduly), jedno společné tlačítko TEST a jeden typový štítek přes celou šířku –
takový přístroj vrať jako JEDEN prvek s poles 2P / 3P / 3P+N / 4P a modules 2 / 3 / 4 a s jedním box_2d přes celou šířku.
Třífázový jistič (3 páčky spojené hrazdičkou) = 1 prvek 3P, 3M; čtyřpólový chránič = 1 prvek 4P, 4M.
Pro každý přístroj vrať: rail, position (od 1 zleva), box_2d [ymin, xmin, ymax, xmax] v rozsahu 0–1000,
text (vše čitelné z čela: výrobce, typ, objednací číslo), category, poles (1P, 1P+N, 2P, 3P, 3P+N, 4P),
ratedCurrentA, trippingCurve (B/C/D), modules (šířka v modulech 18 mm), manufacturer (výrobce tohoto modulu),
label (ručně psaný popis obvodu pod přístrojem, je-li čitelný) a confidence 0–1. Neznámé hodnoty vynech.
Urči i dominantního výrobce (nebo „MIX“, je-li značek více).`;
}

const PHOTO_SCHEMA = {
  type: "OBJECT",
  properties: {
    dominantManufacturer: { type: "STRING" },
    devices: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          rail: { type: "INTEGER" },
          position: { type: "INTEGER" },
          box_2d: { type: "ARRAY", items: { type: "NUMBER" } },
          text: { type: "STRING" },
          category: CATEGORY_ENUM,
          poles: { type: "STRING" },
          ratedCurrentA: { type: "NUMBER" },
          trippingCurve: { type: "STRING" },
          modules: { type: "NUMBER" },
          manufacturer: { type: "STRING" },
          label: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["rail", "position", "box_2d", "text", "modules", "confidence"],
      },
    },
  },
  required: ["devices"],
};

interface GeminiDevice {
  rail: number;
  position: number;
  box_2d: number[];
  text: string;
  category?: string;
  poles?: string;
  ratedCurrentA?: number;
  trippingCurve?: string;
  modules: number;
  manufacturer?: string;
  label?: string;
  confidence: number;
}

/** Odpověď Gemini → detekce (box z 0–1000 na %; pořadí podle lišty a pozice). */
export function toDetections(devices: readonly GeminiDevice[]): Detection[] {
  return [...devices]
    .filter((device) => Number.isFinite(device.rail) && Number.isFinite(device.position))
    .sort((a, b) => a.rail - b.rail || a.position - b.position)
    .map((device) => {
      const box = Array.isArray(device.box_2d) && device.box_2d.length === 4 ? (device.box_2d.map((value) => Math.round(Math.min(1000, Math.max(0, value))) / 10) as [number, number, number, number]) : null;
      const poles = str(device.poles);
      const curve = str(device.trippingCurve)?.toUpperCase() ?? null;
      return {
        dinRailIndex: Math.max(1, Math.round(device.rail)),
        positionOnRail: Math.max(1, Math.round(device.position)),
        modules: num(device.modules) ?? 1,
        box,
        rawOcrText: (device.text ?? "").slice(0, 200),
        category: category(device.category),
        poles: poles && isPoles(poles) ? poles : null,
        ratedCurrentA: num(device.ratedCurrentA),
        trippingCurve: curve && ["B", "C", "D"].includes(curve) ? curve : null,
        manufacturer: normalizeManufacturer(device.manufacturer),
        confidence: Math.min(1, Math.max(0, Number(device.confidence) || 0.5)),
        circuitLabel: str(device.label)?.slice(0, 80),
      };
    });
}

/** Fotky, které Gemini umí přečíst (SVG ukázky jdou do demo režimu). */
export const GEMINI_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

// ---------------------------------------------------------------------------
//  Vision Analyzer 2.0: fáze A (lišty a zakrytování) → fáze B (výřez každé lišty zvlášť)
// ---------------------------------------------------------------------------

/** Režim analýzy z UI: automaticky, nebo vynuceně podle šroubků / podle páček a kalibrace 1M. */
export type AnalysisMode = "AUTO" | "UNCOVERED" | "COVERED";
export type CoverState = "UNCOVERED" | "COVERED";

export interface PhotoAnalysis {
  mode: AiMode;
  detections: Detection[];
  dominantManufacturer: string | null;
  /** Počet skutečně nalezených DIN lišt (fáze A); null = demo / jednoprůchodová pojistka. */
  railCount?: number | null;
  coverState?: CoverState | null;
  warning?: string;
}

export const RAILS_PROMPT = `Jsi zkušený elektrotechnik. Na fotce je rozváděč s modulovými přístroji na DIN lištách.
1) Urči stav zakrytování: "UNCOVERED" = odkrytovaný (jsou vidět šroubky svorek a připojené vodiče),
   "COVERED" = zakrytovaný čelní plastovou maskou (šroubky nejsou vidět, jen výřezy s páčkami přístrojů).
2) Vrať box_2d [ymin, xmin, ymax, xmax] v rozsahu 0–1000 POUZE pro skutečné DIN lišty OSAZENÉ modulovými
   přístroji (jističe, chrániče, vypínače, svodiče, stykače, relé …), seřazené shora dolů. Rámeček obepíná
   celou řadu přístrojů včetně páček.
NIKDY neoznačuj jako DIN lištu holé mosazné svorkovnice PE/N (zemnicí a nulové můstky se šroubky),
prázdné DIN lišty bez přístrojů, kabelové žlaby, svazky vodičů ani štítky. Když si nejsi jistý, lištu nevracej.`;

const RAILS_SCHEMA = {
  type: "OBJECT",
  properties: {
    coverState: { type: "STRING", enum: ["UNCOVERED", "COVERED"] },
    dominantManufacturer: { type: "STRING" },
    rails: { type: "ARRAY", items: { type: "OBJECT", properties: { box_2d: { type: "ARRAY", items: { type: "NUMBER" } } }, required: ["box_2d"] } },
  },
  required: ["coverState", "rails"],
};

/** Inženýrský prompt pro jednu vyříznutou lištu – metodika podle zakrytování. */
export function railPrompt(cover: CoverState, manufacturerHint: string | null): string {
  const counting =
    cover === "UNCOVERED"
      ? `Rozváděč je ODKRYTOVANÝ – počítej podle šroubků svorek:
1) Zleva doprava spočítej všechny šroubky (svorky) v horní nebo spodní linii lišty. Každý šroubek = 1 modulová
   pozice 18 mm (kromě kompaktních přístrojů, kde jsou 2 šroubky v 1 modulu nebo šroubky ve dvou patrech nad sebou).
2) Zkontroluj svislé dělicí spáry mezi těly přístrojů a spojovací hrazdičky páček:
   - 3 sousední moduly (3 šroubky nahoře) se společnou páčkou / hrazdičkou přes 3 póly nebo s jedním tělem bez spáry
     uprostřed = VŽDY JEDEN přístroj poles "3P", modulesWidth 3. Nikdy je nerozděluj na tři 1P jističe.
   - 4 moduly (4 šroubky) s testovacím tlačítkem "T" = proudový chránič category "RCD", poles "4P", modulesWidth 4.`
      : `Rozváděč je ZAKRYTOVANÝ čelní maskou – šroubky nejsou vidět, počítej podle páček a měřítka 1M:
1) Kalibrace: najdi na liště nejzřetelnější standardní 1modulový jistič (18 mm) a urči jeho šířku w_1M.
2) Změř celkovou šířku celé osazené řady přístrojů a vyděl ji w_1M – to je PŘESNÝ celkový počet modulů
   na liště (totalModules). Součet modulesWidth všech vrácených přístrojů se MUSÍ rovnat totalModules –
   nevynechej žádný přístroj, zvlášť ne na konci řady.
3) Přístroje rozliš podle počtu a šířky páček, spojovacích hrazdiček (3P / 4P), tlačítek "T" a svislých spár
   ve výřezu masky.`;
  const brand = isMix(manufacturerHint)
    ? "Výrobce urči u každého přístroje samostatně (logo, barva páček, formát typového kódu) – v rozváděči může být více značek."
    : `Převažující výrobce je pravděpodobně ${manufacturerHint}; u každého přístroje ho ale ověř.`;
  return `Jsi zkušený elektrotechnik. Na obrázku je JEDNA DIN lišta rozváděče (výřez z větší fotky; přístroje
sousedních lišt na okrajích ignoruj). Projdi přístroje zleva doprava a vrať každý jako jeden prvek.
${counting}
Kompaktní přístroje (póly ≠ šířka): dvojitý jistič 2 úzké páčky v 1 modulu = poles "2x1P", modulesWidth 1;
kompaktní 1P+N v 1 modulu (2 šroubky) = poles "1P+N", modulesWidth 1; kompaktní 3P ve 2 modulech = poles "3P", modulesWidth 2.
${brand}
Pro každý přístroj vrať: position (od 1 zleva), box_2d [ymin, xmin, ymax, xmax] 0–1000 v souřadnicích TOHOTO výřezu,
text (vše čitelné z čela), category, poles, modulesWidth, ratedCurrentA, trippingCurve (B/C/D), manufacturer,
label (ručně psaný popis obvodu, je-li čitelný) a confidence 0–1. Vrať i totalModules (celkový počet modulů řady).`;
}

const RAIL_SCHEMA = {
  type: "OBJECT",
  properties: {
    totalModules: { type: "NUMBER" },
    devices: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          position: { type: "INTEGER" },
          box_2d: { type: "ARRAY", items: { type: "NUMBER" } },
          text: { type: "STRING" },
          category: CATEGORY_ENUM,
          poles: { type: "STRING" },
          modulesWidth: { type: "NUMBER" },
          ratedCurrentA: { type: "NUMBER" },
          trippingCurve: { type: "STRING" },
          manufacturer: { type: "STRING" },
          label: { type: "STRING" },
          confidence: { type: "NUMBER" },
        },
        required: ["position", "box_2d", "modulesWidth", "confidence"],
      },
    },
  },
  required: ["devices"],
};

/** Výřez pásu lišty z celé fotky (v px) – pro přepočet souřadnic zpět. */
export interface CropRegion {
  left: number;
  top: number;
  width: number;
  height: number;
  imageWidth: number;
  imageHeight: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Pás lišty s přesahem +15 % výšky lišty nahoru i dolů (aspoň 4 % fotky), aby byly vidět šroubky svorek. */
export function cropRegionFor(box: readonly number[], imageWidth: number, imageHeight: number): CropRegion {
  const [ymin, xmin, ymax, xmax] = box.map((value) => clamp(value, 0, 1000) / 1000);
  const bandHeight = (ymax - ymin) * imageHeight;
  const pad = Math.max(0.15 * bandHeight, 0.04 * imageHeight);
  const top = Math.floor(clamp(ymin * imageHeight - pad, 0, imageHeight - 1));
  const bottom = Math.ceil(clamp(ymax * imageHeight + pad, top + 1, imageHeight));
  const left = Math.floor(clamp(xmin * imageWidth - 0.02 * imageWidth, 0, imageWidth - 1));
  const right = Math.ceil(clamp(xmax * imageWidth + 0.02 * imageWidth, left + 1, imageWidth));
  return { left, top, width: right - left, height: bottom - top, imageWidth, imageHeight };
}

/** Rámeček 0–1000 z výřezu → % celé fotky. */
export function toPhotoBox(box: readonly number[], region: CropRegion): [number, number, number, number] {
  const [ymin, xmin, ymax, xmax] = box.map((value) => clamp(value, 0, 1000) / 1000);
  const y = (v: number) => Math.round(((region.top + v * region.height) / region.imageHeight) * 10000) / 100;
  const x = (v: number) => Math.round(((region.left + v * region.width) / region.imageWidth) * 10000) / 100;
  return [y(ymin), x(xmin), y(ymax), x(xmax)];
}

interface GeminiRailDevice {
  position: number;
  box_2d: number[];
  text?: string;
  category?: string;
  poles?: string;
  modulesWidth: number;
  ratedCurrentA?: number;
  trippingCurve?: string;
  manufacturer?: string;
  label?: string;
  confidence: number;
}

/**
 * Přístroje jedné lišty → detekce v souřadnicích celé fotky. Je-li součet šířek menší než totalModules
 * (AI vynechala konec řady), doplní se chybějící moduly jako nerozpoznané 1M pozice vpravo.
 */
export function toRailDetections(devices: readonly GeminiRailDevice[], rail: number, region: CropRegion, totalModules: number | null | undefined): Detection[] {
  const sorted = [...devices].filter((device) => Array.isArray(device.box_2d) && device.box_2d.length === 4).sort((a, b) => a.position - b.position || a.box_2d[1] - b.box_2d[1]);
  const detections: Detection[] = sorted.map((device, index) => {
    const poles = str(device.poles);
    const curve = str(device.trippingCurve)?.toUpperCase() ?? null;
    const width = Math.round((num(device.modulesWidth) ?? 1) * 2) / 2;
    return {
      dinRailIndex: rail,
      positionOnRail: index + 1,
      modules: clamp(width, 0.5, 12),
      box: toPhotoBox(device.box_2d, region),
      rawOcrText: (device.text ?? "").slice(0, 200),
      category: category(device.category),
      poles: poles && isPoles(poles) ? poles : null,
      ratedCurrentA: num(device.ratedCurrentA),
      trippingCurve: curve && ["B", "C", "D"].includes(curve) ? curve : null,
      manufacturer: normalizeManufacturer(device.manufacturer),
      confidence: Math.min(1, Math.max(0, Number(device.confidence) || 0.5)),
      circuitLabel: str(device.label)?.slice(0, 80),
    };
  });
  const used = detections.reduce((sum, detection) => sum + detection.modules, 0);
  const missing = Math.round((num(totalModules) ?? 0) - used);
  if (missing > 0 && detections.length) {
    // Šířka 1M odhadem z rozpoznaných přístrojů; doplněné pozice navazují vpravo od posledního.
    const perModule = detections.reduce((sum, d) => sum + (d.box ? (d.box[3] - d.box[1]) / d.modules : 0), 0) / detections.length;
    const last = detections[detections.length - 1].box!;
    for (let i = 0; i < missing; i++) {
      const xmin = Math.min(99.5, last[3] + i * perModule);
      detections.push({
        dinRailIndex: rail,
        positionOnRail: detections.length + 1,
        modules: 1,
        box: [last[0], xmin, last[2], Math.min(100, xmin + perModule)],
        rawOcrText: "(doplněno – AI modul vynechala)",
        category: null,
        poles: null,
        ratedCurrentA: null,
        trippingCurve: null,
        manufacturer: null,
        confidence: 0.2,
      });
    }
  }
  return detections;
}

/** Výřez pásu z fotky (sharp) jako JPEG. */
async function cropRail(image: { bytes: Buffer }, box: readonly number[]): Promise<{ bytes: Buffer; region: CropRegion }> {
  const sharp = (await import("sharp")).default;
  const meta = await sharp(image.bytes).rotate().metadata();
  const width = meta.autoOrient?.width ?? meta.width ?? 0;
  const height = meta.autoOrient?.height ?? meta.height ?? 0;
  if (!width || !height) throw new Error("Neznámé rozměry fotky.");
  const region = cropRegionFor(box, width, height);
  const bytes = await sharp(image.bytes).rotate().extract({ left: region.left, top: region.top, width: region.width, height: region.height }).jpeg({ quality: 90 }).toBuffer();
  return { bytes, region };
}

/** Jednoprůchodová analýza celé fotky (pojistka, když fáze A nenajde lištu). */
async function analyzeSinglePass(image: { bytes: Buffer; mimeType: string }, hint: string | null): Promise<Detection[]> {
  const { visionModel } = geminiConfig();
  const result = await generateJson<{ devices: GeminiDevice[] }>(visionModel, [{ text: photoPrompt(hint) }, { inline_data: { mime_type: image.mimeType, data: image.bytes.toString("base64") } }], PHOTO_SCHEMA);
  return toDetections(result.devices ?? []);
}

/**
 * Vision Analyzer 2.0: fáze A najde skutečné DIN lišty a zakrytování, fáze B analyzuje výřez každé lišty
 * zvlášť (šroubky u odkrytovaného, páčky a kalibrace 1M u zakrytovaného) a přepočte souřadnice zpět.
 * Bez klíče / u SVG / při chybě deterministický demo režim.
 */
export async function analyzePanelPhoto(input: { image: { bytes: Buffer; mimeType: string } | null; dims: EnclosureDims; manufacturerHint?: string | null; mode?: AnalysisMode }): Promise<PhotoAnalysis> {
  const { visionModel, apiKey } = geminiConfig();
  const hint = input.manufacturerHint ?? null;
  const demo = (warning?: string): PhotoAnalysis => ({ mode: "DEMO", detections: demoDetections(input.dims), dominantManufacturer: "ABB", ...(warning ? { warning } : {}) });
  if (!apiKey || !input.image || !GEMINI_IMAGE_TYPES.includes(input.image.mimeType)) return demo();
  const image = input.image;
  try {
    const phaseA = await generateJson<{ coverState?: string; dominantManufacturer?: string; rails?: { box_2d: number[] }[] }>(
      visionModel,
      [{ text: RAILS_PROMPT }, { inline_data: { mime_type: image.mimeType, data: image.bytes.toString("base64") } }],
      RAILS_SCHEMA,
    );
    const rails = (phaseA.rails ?? [])
      .map((rail) => rail.box_2d)
      .filter((box) => Array.isArray(box) && box.length === 4 && box[2] - box[0] >= 20 && box[3] - box[1] >= 50)
      .sort((a, b) => a[0] - b[0]);
    const detected: CoverState = phaseA.coverState === "UNCOVERED" ? "UNCOVERED" : "COVERED";
    const cover: CoverState = input.mode && input.mode !== "AUTO" ? input.mode : detected;

    if (!rails.length) {
      const detections = await analyzeSinglePass(image, hint);
      if (!detections.length) return demo("Gemini na fotce nenašel žádnou DIN lištu s přístroji – zobrazena ukázková detekce.");
      return { mode: "GEMINI", detections, dominantManufacturer: normalizeManufacturer(phaseA.dominantManufacturer), railCount: null, coverState: cover, warning: "Lišty se nepodařilo vymezit – použita analýza celé fotky." };
    }

    const detections: Detection[] = [];
    for (const [index, box] of rails.entries()) {
      const crop = await cropRail(image, box);
      const result = await generateJson<{ totalModules?: number; devices?: GeminiRailDevice[] }>(
        visionModel,
        [{ text: railPrompt(cover, hint) }, { inline_data: { mime_type: "image/jpeg", data: crop.bytes.toString("base64") } }],
        RAIL_SCHEMA,
      );
      detections.push(...toRailDetections(result.devices ?? [], index + 1, crop.region, result.totalModules));
    }
    if (!detections.length) return demo("Gemini na lištách nenašel žádný přístroj – zobrazena ukázková detekce.");
    return { mode: "GEMINI", detections, dominantManufacturer: normalizeManufacturer(phaseA.dominantManufacturer), railCount: rails.length, coverState: cover };
  } catch (error) {
    console.error("[gemini] analýza fotky selhala:", error);
    return demo("Gemini neodpověděl – zobrazena ukázková detekce.");
  }
}

// ---------------------------------------------------------------------------
//  Datasheety a dohledání parametrů (GEMINI_DATASHEET_MODEL)
// ---------------------------------------------------------------------------

const COMPONENT_SCHEMA = {
  type: "OBJECT",
  properties: {
    manufacturer: { type: "STRING" },
    series: { type: "STRING" },
    typeCode: { type: "STRING" },
    articleNumber: { type: "STRING" },
    category: CATEGORY_ENUM,
    poles: { type: "STRING" },
    ratedCurrentA: { type: "NUMBER" },
    trippingCurve: { type: "STRING" },
    breakingCapacityKa: { type: "NUMBER" },
    rcdSensitivityMa: { type: "NUMBER" },
    rcdType: { type: "STRING" },
    modulesCount: { type: "NUMBER" },
    powerLossWatts: { type: "NUMBER" },
    description: { type: "STRING" },
    page: { type: "INTEGER" },
  },
  required: ["manufacturer", "typeCode", "articleNumber", "category"],
};

type GeminiComponent = Partial<Record<keyof typeof COMPONENT_SCHEMA.properties, unknown>>;

/** Validace a doplnění položky od Gemini (Pv chybí → odhad IEC). */
export function toExtracted(raw: GeminiComponent): ExtractedComponent | null {
  const articleNumber = str(raw.articleNumber);
  const typeCode = str(raw.typeCode);
  const kind = category(raw.category);
  if (!articleNumber || !typeCode || !kind) return null;
  const polesRaw = str(raw.poles);
  const poles = polesRaw && isPoles(polesRaw) ? polesRaw : "1P";
  const current = num(raw.ratedCurrentA) ?? 0;
  const modules = num(raw.modulesCount) ?? estimateModules(kind, poles, current);
  const loss = typeof raw.powerLossWatts === "number" && raw.powerLossWatts >= 0 ? raw.powerLossWatts : null;
  const rcd = kind === "RCD" || kind === "RCBO";
  return {
    manufacturer: str(raw.manufacturer)!.slice(0, 60),
    series: (str(raw.series) ?? typeCode.split(/[-\s/]/)[0]).slice(0, 80),
    typeCode: typeCode.slice(0, 80),
    articleNumber: articleNumber.slice(0, 60),
    category: kind,
    poles,
    ratedCurrentA: current,
    trippingCurve: str(raw.trippingCurve)?.toUpperCase().slice(0, 1) ?? null,
    breakingCapacityKa: num(raw.breakingCapacityKa),
    rcdSensitivityMa: rcd ? (num(raw.rcdSensitivityMa) ?? 30) : null,
    rcdType: rcd ? (str(raw.rcdType)?.toUpperCase() ?? "A") : null,
    modulesCount: modules,
    widthMm: modules ? Math.round(modules * 17.5 * 100) / 100 : null,
    powerLossWatts: loss ?? estimatePowerLoss(kind, poles, current),
    powerLossEstimated: loss === null,
    iecSymbol: iecSymbolFor(kind, poles),
    description: (str(raw.description) ?? typeCode).slice(0, 200),
    sourcePage: num(raw.page) ?? 1,
  };
}

const DATASHEET_PROMPT = `Rozpadni přiložený PDF datasheet / katalog / kusovník na jednotlivé elektrické přístroje.
Každý přístroj s objednacím číslem vrať jako samostatnou položku: výrobce, řada, typ, objednací číslo, kategorie,
póly, jmenovitý proud In, charakteristika, Icn v kA, citlivost IΔn v mA a typ chrániče, šířka v modulech 18 mm,
jmenovitý ztrátový výkon Pv ve W (je-li uveden), krátký popis česky a stránka PDF.`;

export async function extractDatasheetComponents(input: { pages: string[][]; pdf: Buffer | null }): Promise<{ mode: AiMode; components: ExtractedComponent[] }> {
  const { apiKey, datasheetModel } = geminiConfig();
  if (apiKey) {
    try {
      const parts: Part[] = input.pdf
        ? [{ text: DATASHEET_PROMPT }, { inline_data: { mime_type: "application/pdf", data: input.pdf.toString("base64") } }]
        : [{ text: `${DATASHEET_PROMPT}\n\nText PDF:\n${input.pages.map((lines, i) => `--- strana ${i + 1} ---\n${lines.join("\n")}`).join("\n").slice(0, 200_000)}` }];
      const result = await generateJson<{ components: GeminiComponent[] }>(datasheetModel, parts, { type: "OBJECT", properties: { components: { type: "ARRAY", items: COMPONENT_SCHEMA } }, required: ["components"] });
      const components = (result.components ?? []).map(toExtracted).filter((component): component is ExtractedComponent => component !== null);
      if (components.length) return { mode: "GEMINI", components };
    } catch (error) {
      console.error("[gemini] atomizace datasheetu selhala:", error);
    }
  }
  return { mode: "DEMO", components: extractComponents(input.pages) };
}

/** ABB System pro M compact S200: objednací číslo z typu (S201-B16 → 2CDS251001R0165). */
export function abbS200Article(typeCode: string): string | null {
  const match = /^S20([1-4])-([BCDK])(\d{1,2})$/.exec(typeCode);
  if (!match) return null;
  const curveDigit = { B: "5", C: "4", D: "1", K: "7" }[match[2] as "B" | "C" | "D" | "K"];
  return `2CDS25${match[1]}001R0${match[3].padStart(2, "0")}${curveDigit}`;
}

const LOOKUP_PROMPT = (text: string, hints: string) =>
  `Dohledej v katalozích výrobců elektrický přístroj podle textu z jeho čela: "${text}". Nápověda z fotky: ${hints}.
Vrať jeho parametry včetně objednacího čísla a jmenovitého ztrátového výkonu Pv ve W při In; popis napiš česky.`;

/**
 * Dohledání neznámého přístroje podle textu z čela (Gemini, jinak deterministicky: známé řady
 * typových označení + odhad Pv podle IEC). Vrací null, když z textu nelze nic odvodit.
 */
export async function lookupComponent(input: { text: string; hints: { category: ComponentCategory | null; poles: string | null; current: number | null; curve: string | null; manufacturer: string | null } }): Promise<{
  mode: AiMode;
  component: ExtractedComponent | null;
}> {
  const { apiKey, datasheetModel } = geminiConfig();
  const hints = JSON.stringify(input.hints);
  if (apiKey) {
    try {
      const raw = await generateJson<GeminiComponent>(datasheetModel, [{ text: LOOKUP_PROMPT(input.text, hints) }], COMPONENT_SCHEMA);
      const component = toExtracted(raw);
      if (component) return { mode: "GEMINI", component };
    } catch (error) {
      console.error("[gemini] dohledání přístroje selhalo:", error);
    }
  }
  return { mode: "DEMO", component: deterministicLookup(input.text, input.hints) };
}

function deterministicLookup(text: string, hints: { category: ComponentCategory | null; poles: string | null; current: number | null; curve: string | null; manufacturer: string | null }): ExtractedComponent | null {
  const cleaned = text.trim().toUpperCase().replace(/\s+/g, " ");
  if (cleaned.length < 3) return null;
  // ABB S200: „S201 B16“, „s203-c25“ → normalizovaný typ a vypočtené objednací číslo
  const s200 = /\bS\s?20([1-4])\s*-?\s*([BCDK])\s?(\d{1,2})\b/.exec(cleaned);
  if (s200) {
    const typeCode = `S20${s200[1]}-${s200[2]}${s200[3]}`;
    const article = abbS200Article(typeCode)!;
    return parseComponent(article, "ABB", `${typeCode} Jistič ${s200[1] === "1" ? "1P" : `${s200[1]}P`}, ${s200[3]}A, char. ${s200[2]}, 6kA`, 1);
  }
  // Obecný text → parametry z textu a nápovědy pickeru, objednací číslo jako „IEC-<typ>“
  const parsed = parseComponent(`IEC-${cleaned.replace(/[^A-Z0-9]+/g, "-").slice(0, 40)}`, hints.manufacturer ?? "Neznámý výrobce", cleaned, 1);
  const kind = parsed.category === "OTHER" && hints.category ? hints.category : parsed.category;
  const poles = hints.poles ?? parsed.poles;
  const current = parsed.ratedCurrentA || hints.current || 0;
  if (!current && kind === "OTHER") return null;
  return {
    ...parsed,
    category: kind,
    poles,
    ratedCurrentA: current,
    trippingCurve: kind === "MCB" || kind === "RCBO" ? (parsed.trippingCurve ?? hints.curve) : null,
    modulesCount: estimateModules(kind, poles, current),
    powerLossWatts: estimatePowerLoss(kind, poles, current),
    powerLossEstimated: true,
    iecSymbol: iecSymbolFor(kind, poles),
    typeCode: cleaned.slice(0, 40),
    description: `${parsed.description} (odhad dle IEC)`.slice(0, 200),
  };
}
