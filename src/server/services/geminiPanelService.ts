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

export async function analyzePanelPhoto(input: { image: { bytes: Buffer; mimeType: string } | null; dims: EnclosureDims; manufacturerHint?: string | null }): Promise<{ mode: AiMode; detections: Detection[]; dominantManufacturer: string | null; warning?: string }> {
  const { visionModel, apiKey } = geminiConfig();
  if (apiKey && input.image && GEMINI_IMAGE_TYPES.includes(input.image.mimeType)) {
    try {
      const result = await generateJson<{ dominantManufacturer?: string; devices: GeminiDevice[] }>(
        visionModel,
        [{ text: photoPrompt(input.manufacturerHint ?? null) }, { inline_data: { mime_type: input.image.mimeType, data: input.image.bytes.toString("base64") } }],
        PHOTO_SCHEMA,
      );
      const detections = toDetections(result.devices ?? []);
      if (detections.length) return { mode: "GEMINI", detections, dominantManufacturer: normalizeManufacturer(result.dominantManufacturer) };
      return { mode: "DEMO", detections: demoDetections(input.dims), dominantManufacturer: "ABB", warning: "Gemini na fotce nenašel žádný přístroj – zobrazena ukázková detekce." };
    } catch (error) {
      console.error("[gemini] analýza fotky selhala:", error);
      return { mode: "DEMO", detections: demoDetections(input.dims), dominantManufacturer: "ABB", warning: "Gemini neodpověděl – zobrazena ukázková detekce." };
    }
  }
  return { mode: "DEMO", detections: demoDetections(input.dims), dominantManufacturer: "ABB" };
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
