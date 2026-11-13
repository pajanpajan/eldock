// Fáze 111: 📷 AI čtečka výrobního štítku zařízení / spotřebiče – údaje ze štítku (název a typ, výrobce, model, výrobní
// číslo S/N, napětí, příkon / proud, krytí IP, třída ochrany I / II / III dle ČSN 33 1600 ed. 2) a skupina používání
// A–E pro lhůtu příští revize. Extraktor z textu štítku (výstup OCR, ruční přepis, „Live Text“ z mobilu) i normalizace
// odpovědi Gemini. Čisté funkce (klient, server, testy).

export type ProtectionClass = "I" | "II" | "III";
export type UsageGroup = "A" | "B" | "C" | "D" | "E";

export interface NameplateReading {
  name: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  voltage: string | null;
  /** Příkon ve W (z „90 W“, „1,5 kW“). */
  powerW: number | null;
  /** Proud v A (z „1,5 A“, „500 mA“). */
  currentA: number | null;
  ipRating: string | null;
  protectionClass: ProtectionClass | null;
  usageGroup: UsageGroup | null;
  /** Rok výroby / datum ze štítku (je-li). */
  year: number | null;
}

export const EMPTY_READING: NameplateReading = { name: null, manufacturer: null, model: null, serialNumber: null, voltage: null, powerW: null, currentA: null, ipRating: null, protectionClass: null, usageGroup: null, year: null };

/** Výrobci častí na štítcích kanceláří, kuchyněk, dílen a rozvoden (normalizovaný zápis). */
export const KNOWN_MANUFACTURERS = [
  "ABB", "Bosch", "Makita", "Hilti", "DeWalt", "Metabo", "Festool", "Milwaukee", "Black+Decker", "Narex", "Einhell", "Würth",
  "Dell", "HP", "Lenovo", "Apple", "Samsung", "LG", "Philips", "Asus", "Acer", "Fujitsu", "Eizo", "BenQ", "AOC", "iiyama", "Brother", "Canon", "Epson", "Kyocera", "Ricoh", "Xerox", "Konica Minolta",
  "ETA", "Tefal", "Philips", "De'Longhi", "Krups", "Siemens", "Gorenje", "Whirlpool", "Electrolux", "Beko", "Candy", "Sencor", "Concept", "Moulinex", "Rowenta", "Braun", "Dyson", "Miele", "AEG", "Zanussi", "Liebherr", "Indesit", "Hisense",
  "Daikin", "Mitsubishi", "Toshiba", "Panasonic", "Fujitsu", "Gree", "Midea", "Haier",
  "Schneider Electric", "Eaton", "Hager", "OEZ", "Legrand", "Noark", "Schrack", "Siemens", "Phoenix Contact", "Weidmüller", "Finder", "Omron", "Danfoss", "Grundfos",
  "Emos", "Solight", "Brennenstuhl", "Kopp", "Hama", "Vivanco", "Tracon", "Panlux", "Greenlux", "Kanlux", "Beghelli", "Ledvance", "Osram", "Tridonic",
  "Dražice", "Tatramat", "Ariston", "Stiebel Eltron", "Vaillant", "Bosch Thermotechnik",
] as const;

const unique = [...new Set(KNOWN_MANUFACTURERS)];

const clean = (value: string | null | undefined, max = 80) => {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const number = (value: string) => Number(value.replace(/\s/g, "").replace(",", "."));

/** Třída ochrany ze štítku: „Class II“, „Třída II“, symbol dvojitého čtverce (回 / ⧈ / ▣), „SELV“ = III, „PE / ⏚“ = I. */
export function protectionClassOf(text: string): ProtectionClass | null {
  const upper = text.toUpperCase();
  if (/(?:CLASS|TŘÍDA|TRIDA|KLASSE|CL\.?)\s*(?:OCHRANY\s*)?III\b/.test(upper) || /\bSELV\b|\bPELV\b/.test(upper)) return "III";
  if (/(?:CLASS|TŘÍDA|TRIDA|KLASSE|CL\.?)\s*(?:OCHRANY\s*)?II\b/.test(upper) || /[回⧈▣⧉]/.test(text) || /DOUBLE INSULAT|DVOJIT[ÁA] IZOLAC/.test(upper)) return "II";
  if (/(?:CLASS|TŘÍDA|TRIDA|KLASSE|CL\.?)\s*(?:OCHRANY\s*)?I\b/.test(upper) || /[⏚]/.test(text) || /OCHRANN[ÝY] VODI[ČC]|\bPE\b/.test(upper)) return "I";
  return null;
}

export function ipRatingOf(text: string): string | null {
  const match = /\bIP\s?([0-6X])([0-9X])\b/i.exec(text);
  return match ? `IP${match[1].toUpperCase()}${match[2].toUpperCase()}` : null;
}

/** Výrobní číslo: „S/N“, „SN“, „Serial No.“, „Ser. No.“, „Výr. č.“, „V.č.“, „Nr.“. */
export function serialOf(text: string): string | null {
  const match = /(?:S\/N|\bS\.?N\.?|SERIAL\s*(?:NO|NUMBER|NR)?\.?|SER\.?\s*NO\.?|V[ÝY]R(?:OBN[ÍI])?\.?\s*[ČC](?:[ÍI]SLO)?\.?|\bV\.?\s?[ČC]\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/.]{3,31})/i.exec(text);
  return match ? match[1].replace(/[.\-/]+$/, "").toUpperCase() : null;
}

/** Model / typové označení: „Model“, „Type“, „Typ“, „Mod.“, „REF“. */
export function modelOf(text: string): string | null {
  const match = /(?:\bMODEL|\bMOD\.|\bTYPE|\bTYP|\bREF\.?|\bART\.?\s*(?:NO|NR)?\.?)\s*[:#.]?\s*([A-Z0-9][A-Z0-9\-/.+ ]{1,30}?)(?=\s{2,}|\s*(?:\n|$|S\/N|SN\b|SERIAL|\d{2,3}\s?V\b|IP\d))/im.exec(text);
  const value = match ? match[1].trim() : null;
  return value && !/^(no|nr)$/i.test(value) ? value.toUpperCase() : null;
}

export function voltageOf(text: string): string | null {
  const range = /(\d{2,3})\s*(?:-|–|…|\.\.\.)\s*(\d{2,3})\s*V\s*(?:~|AC)?/i.exec(text);
  const single = /(\d{1,3}(?:[.,]\d)?)\s*V\s*(~|AC|DC|=|⎓)?/i.exec(text);
  const hz = /(\d{2})(?:\s*[/–-]\s*(\d{2}))?\s*Hz/i.exec(text);
  const hzText = hz ? ` / ${hz[2] ? `${hz[1]}/${hz[2]}` : hz[1]} Hz` : "";
  if (range) return `${range[1]}–${range[2]} V AC${hzText}`;
  if (!single) return null;
  const dc = single[2] === "DC" || single[2] === "=" || single[2] === "⎓";
  return `${single[1].replace(".", ",")} V ${dc ? "DC" : "AC"}${dc ? "" : hzText}`;
}

export function powerOf(text: string): number | null {
  const kw = /(\d+(?:[.,]\d+)?)\s*kW\b/i.exec(text);
  if (kw) return Math.round(number(kw[1]) * 1000);
  const w = /(\d{1,5}(?:[.,]\d+)?)\s*W\b(?!h)/i.exec(text);
  return w ? Math.round(number(w[1])) : null;
}

export function currentOf(text: string): number | null {
  const ma = /(\d{2,4})\s*mA\b/i.exec(text);
  if (ma) return Math.round(number(ma[1])) / 1000;
  const a = /(\d{1,3}(?:[.,]\d+)?)\s*A\b(?!C)/.exec(text);
  return a ? number(a[1]) : null;
}

export function manufacturerOf(text: string): string | null {
  const lower = text.toLowerCase();
  const hit = unique.find((brand) => new RegExp(`(^|[^a-z])${brand.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(lower));
  if (hit) return hit;
  const labelled = /(?:MANUFACTURER|HERSTELLER|V[ÝY]ROBCE|MADE BY)\s*[:#]?\s*([A-Z][\w&.' -]{1,30})/i.exec(text);
  return labelled ? clean(labelled[1], 40) : null;
}

export function yearOf(text: string): number | null {
  const match = /(?:\bROK\s*V[ÝY]ROBY|\bYEAR|\bBJ|\bMFG\.?\s*(?:DATE)?|\bDATE)\s*[:#.]?\s*(?:\d{1,2}[./-])?(20\d{2}|19\d{2})/i.exec(text) ?? /\b(20[0-4]\d)\b/.exec(text);
  return match ? Number(match[1]) : null;
}

/**
 * Údaje z textu výrobního štítku (výstup OCR, ruční přepis): výrobce, model, S/N, napětí, příkon, proud, krytí, třída
 * ochrany a rok. Název = první řádek, který není jen výrobce / technický údaj.
 */
export function parseNameplateText(raw: string): NameplateReading {
  const text = raw.replace(/\r/g, "").trim();
  if (!text) return { ...EMPTY_READING };
  const manufacturer = manufacturerOf(text);
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const technical = /\b(S\/N|SN|SERIAL|MODEL|TYPE|TYP|IP\d|\d+\s*V\b|\d+\s*W\b|\d+\s*A\b|HZ|CLASS|TŘÍDA|MADE IN|CE\b)/i;
  const nameLine = lines.find((line) => !technical.test(line) && line.length >= 3 && (!manufacturer || line.toLowerCase() !== manufacturer.toLowerCase()));
  return {
    name: clean(nameLine ?? null),
    manufacturer,
    model: modelOf(text),
    serialNumber: serialOf(text),
    voltage: voltageOf(text),
    powerW: powerOf(text),
    currentA: currentOf(text),
    ipRating: ipRatingOf(text),
    protectionClass: protectionClassOf(text),
    usageGroup: null,
    year: yearOf(text),
  };
}

const asClass = (value: unknown): ProtectionClass | null => {
  const text = String(value ?? "").toUpperCase().replace(/TŘÍDA|TRIDA|CLASS|\s/g, "");
  return text === "I" || text === "1" ? "I" : text === "II" || text === "2" ? "II" : text === "III" || text === "3" ? "III" : null;
};
const asGroup = (value: unknown): UsageGroup | null => {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-E]$/.test(text) ? (text as UsageGroup) : null;
};
const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? number(value.replace(/[^\d.,-]/g, "")) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

/** Odpověď AI (JSON) → čtení štítku; chybějící údaje doplní extraktor z přečteného textu (`rawText`). */
export function normalizeReading(raw: Partial<Record<keyof NameplateReading | "rawText", unknown>> | null | undefined): NameplateReading {
  const text = typeof raw?.rawText === "string" ? raw.rawText : "";
  const fromText = text ? parseNameplateText(text) : EMPTY_READING;
  const str = (key: keyof NameplateReading, max = 80) => clean(typeof raw?.[key] === "string" ? (raw[key] as string) : null, max);
  return {
    name: str("name") ?? fromText.name,
    manufacturer: str("manufacturer", 40) ?? fromText.manufacturer,
    model: str("model", 60) ?? fromText.model,
    serialNumber: (str("serialNumber", 40) ?? fromText.serialNumber)?.toUpperCase() ?? null,
    voltage: str("voltage", 40) ?? fromText.voltage,
    powerW: asNumber(raw?.powerW) ?? fromText.powerW,
    currentA: asNumber(raw?.currentA) ?? fromText.currentA,
    ipRating: (str("ipRating", 8) && ipRatingOf(str("ipRating", 8)!)) || fromText.ipRating,
    protectionClass: asClass(raw?.protectionClass) ?? fromText.protectionClass,
    usageGroup: asGroup(raw?.usageGroup),
    year: (asNumber(raw?.year) && asNumber(raw?.year)! >= 1950 && asNumber(raw?.year)! <= 2100 ? Math.round(asNumber(raw?.year)!) : null) ?? fromText.year,
  };
}

const decimal = (value: number) => String(Math.round(value * 100) / 100).replace(".", ",");

/** Údaje štítku → sloupce zařízení (prázdné údaje nepřepisují vyplněné). */
export function readingToEquipment(reading: NameplateReading) {
  const current = reading.currentA !== null ? `${decimal(reading.currentA)} A${reading.powerW ? ` (${reading.powerW.toLocaleString("cs-CZ")} W)` : ""}` : reading.powerW ? `${reading.powerW.toLocaleString("cs-CZ")} W` : null;
  return {
    ...(reading.manufacturer ? { manufacturer: reading.manufacturer } : {}),
    ...(reading.model ? { model: reading.model } : {}),
    ...(reading.serialNumber ? { serialNumber: reading.serialNumber } : {}),
    ...(reading.voltage ? { ratedVoltage: reading.voltage } : {}),
    ...(current ? { ratedCurrent: current } : {}),
    ...(reading.powerW ? { ratedPowerKw: Math.round((reading.powerW / 1000) * 1000) / 1000 } : {}),
    ...(reading.ipRating ? { ipRating: reading.ipRating } : {}),
    ...(reading.protectionClass ? { protectionClass: reading.protectionClass } : {}),
    ...(reading.usageGroup ? { usageGroup: reading.usageGroup } : {}),
    ...(reading.year ? { yearInstalled: reading.year } : {}),
  };
}

/** Uložené čtení (JSON u zařízení) → objekt; poškozený JSON = null. */
export function parseReading(json: string | null | undefined): NameplateReading | null {
  if (!json) return null;
  try {
    return normalizeReading(JSON.parse(json) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export const PROTECTION_CLASS_LABELS: Record<ProtectionClass, string> = {
  I: "Třída I – ochranný vodič PE",
  II: "Třída II – dvojitá izolace 回",
  III: "Třída III – SELV",
};
