// Deterministická „atomizace“ PDF datasheetu / kusovníku: z textu stránek vytáhne jednotlivé
// přístroje (objednací číslo, typ, kategorie, póly, proud, charakteristika …). Používá se bez
// GEMINI_API_KEY a jako pojistka, když Gemini neodpoví. Čistá funkce – text dodá klient (pdf.js).

import type { ComponentCategory } from "@/generated/prisma/enums";

import { CATEGORY_LABELS, estimateModules, estimatePowerLoss, iecSymbolFor, normalizeSearch, type CatalogFields } from "./catalog";

export interface ExtractedComponent extends CatalogFields {
  breakingCapacityKa: number | null;
  modulesCount: number;
  widthMm: number | null;
  powerLossWatts: number;
  /** Pv nebylo v podkladu → odhad podle IEC tabulek. */
  powerLossEstimated: boolean;
  iecSymbol: string;
  sourcePage: number;
}

/** Objednací čísla výrobců: ABB (2CDS251001R1165, 1SPE007717F0620), Schneider (A9F04116), PCSCHEMATIC demo (PCS2250101). */
const ARTICLE_PATTERNS: { manufacturer: string; pattern: RegExp }[] = [
  { manufacturer: "ABB", pattern: /\b\d[A-Z]{3}\d{6}[A-Z]\d{4}\b/g },
  { manufacturer: "Schneider", pattern: /\bA9[A-Z]\d{5}\b/g },
  { manufacturer: "PCSCHEMATIC (demo)", pattern: /\bPCS0?\d{6,8}\b/g },
];

const TYPE_PATTERNS: { pattern: RegExp; series: string }[] = [
  { pattern: /\bS20[1-4]M?-[BCDK]\d+\b/, series: "System pro M compact S200" },
  { pattern: /\bSD20[1-4]\/\d+\b/, series: "SD200" },
  { pattern: /\bF[H]?20[24]\s+A?C?-\d+\/0,\d+\b/, series: "System pro M compact F200" },
  { pattern: /\bDS20[1-4]\s+[BC]\d+\s+A?C?\d+\b/, series: "DS201" },
  { pattern: /\bOVR\b.*?\bQS\b/, series: "OVR" },
  { pattern: /\bRES\d+x\d+\b/, series: "MISTRAL41W" },
  { pattern: /\bPCS-[A-Z0-9-]+\b/, series: "PCSCHEMATIC demo" },
];

/** Klasifikace přístroje podle klíčových slov (normalizovaný text bez diakritiky). */
const CATEGORY_RULES: [RegExp, ComponentCategory][] = [
  [/\baux\b|pomocny kontakt/, "OTHER"],
  [/mistral|\bres\d+x\d+|skrin|rozvodnic|enclosure/, "ENCLOSURE"],
  [/\bovr\b|surge|prepet|\bspd\b|svodic/, "SPD"],
  [/rcbo|jisticochranic|\bds20\d/, "RCBO"],
  [/rccb|chranic|\bfh?20[24]\b|\biid\b/, "RCD"],
  [/vypinac|odpinac|\bsd20\d|disconnect|\bisw\b/, "MAIN_SWITCH"],
  [/contactor|stykac|\besb\d|\bict\b/, "CONTACTOR"],
  [/\bmcb\b|jistic|circuit breaker|\bs20[1-4]|\bic60|\bpl7|\bltn\b/, "MCB"],
  [/relay|\brele\b|thermal overload|nadproud/, "RELAY"],
  [/power supply|napajeci zdroj|\bpsu\b/, "PSU"],
  [/\bplc\b|digital (inputs?|outputs?)/, "PLC"],
  [/terminal|svork|endplate|divider/, "TERMINAL"],
];

export function classify(text: string): ComponentCategory {
  const normalized = normalizeSearch(text);
  return CATEGORY_RULES.find(([pattern]) => pattern.test(normalized))?.[1] ?? "OTHER";
}

function detectPoles(text: string, typeCode: string, category: ComponentCategory): string {
  const series = /\bS20([1-4])|\bSD20([1-4])|\bFH?20([24])|\bDS20([1-4])/.exec(typeCode);
  const digit = series ? Number(series.slice(1).find(Boolean)) : null;
  if (digit) return category === "RCD" ? `${digit}P` : digit === 1 ? "1P" : `${digit}P`;
  if (/\b3N\b/.test(text)) return "3P+N";
  const match = /\b([1-4])\s*-?\s*p(?:ol)?(\+N)?\b/i.exec(text);
  if (match) return `${match[1]}P${match[2] ? "+N" : ""}`;
  return category === "RCD" || category === "RCBO" ? "2P" : category === "SPD" ? "3P+N" : "1P";
}

function detectCurrent(text: string, typeCode: string): { current: number; curve: string | null } {
  const curve = /-([BCDK])(\d+)\b/.exec(typeCode) ?? /\b([BCD])(\d+)\b/.exec(typeCode);
  if (curve) return { curve: curve[1] === "K" ? null : curve[1], current: Number(curve[2]) };
  const slash = /-(\d+)\/0,\d+/.exec(typeCode) ?? /\/(\d+)\b/.exec(typeCode);
  const amps = /(\d+(?:[.,]\d+)?)\s*A\b(?!C)/.exec(text);
  const charText = /char\.?\s*([BCD])\b/i.exec(text);
  const current = slash ? Number(slash[1]) : amps ? Number(amps[1].replace(",", ".")) : 0;
  return { current, curve: charText ? charText[1].toUpperCase() : null };
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Jeden přístroj z textu (řádky se stejným objednacím číslem jsou už spojené). */
export function parseComponent(articleNumber: string, manufacturer: string, rawText: string, sourcePage: number): ExtractedComponent {
  // Za pozicí ve schématu (/12.1) následuje funkce obvodu – ta k přístroji nepatří.
  const text = rawText
    .split(/\s\/\d+(?:\.\d+)?\b/)[0]
    .replace(new RegExp(articleNumber, "g"), " ")
    .replace(/(?:^|\s)(?:=[\w.]+\/\+[\w.]+\/)?-[A-Z]{1,3}\d+(?:\.\w+)?\b/g, " ") // značení -F3, =SYS0.1/+1.1/-UC1.Q1
    .replace(/\s--\s/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const typeMatch = TYPE_PATTERNS.map(({ pattern, series }) => ({ match: pattern.exec(text), series })).find(({ match }) => match);
  const typeCode = typeMatch?.match?.[0].trim() ?? text.split(" ").find((token) => /\d/.test(token) && /[-/]/.test(token)) ?? articleNumber;
  const category = classify(text);
  const poles = detectPoles(text, typeCode, category);
  const { current, curve } = detectCurrent(text, typeCode);
  const sensitivity = /(\d+)\s*mA\b/i.exec(text) ?? (/\/0,03\b/.test(typeCode) ? ["", "30"] : null);
  const rcdType = /\btype\s*(AC|A|B|F)\b/i.exec(text)?.[1].toUpperCase() ?? /\bFH?20[24]\s+(AC|A)-/.exec(typeCode)?.[1] ?? null;
  const breaking = /(\d+(?:[.,]\d+)?)\s*kA\b/i.exec(text);
  const loss = /(\d+(?:[.,]\d+)?)\s*W\b/.exec(text);

  const description = text.replace(typeCode, "").replace(/\s+\d+\s*$/, "").trim().slice(0, 140) || `${CATEGORY_LABELS[category]} ${poles} ${current} A`;
  const modulesCount = estimateModules(category, poles, current);
  const isProtective = category === "MCB" || category === "RCD" || category === "RCBO";

  return {
    manufacturer,
    series: typeMatch?.series ?? typeCode.split(/[-\s/]/)[0],
    typeCode,
    articleNumber,
    category,
    poles,
    ratedCurrentA: current,
    trippingCurve: category === "MCB" || category === "RCBO" ? (curve ?? null) : null,
    breakingCapacityKa: breaking ? Number(breaking[1].replace(",", ".")) : isProtective ? 6 : null,
    rcdSensitivityMa: category === "RCD" || category === "RCBO" ? (sensitivity ? Number(sensitivity[1]) : 30) : null,
    rcdType: category === "RCD" || category === "RCBO" ? (rcdType ?? "A") : null,
    modulesCount,
    widthMm: modulesCount ? round(modulesCount * 17.5) : null,
    powerLossWatts: loss ? Number(loss[1].replace(",", ".")) : estimatePowerLoss(category, poles, current),
    powerLossEstimated: !loss,
    iecSymbol: iecSymbolFor(category, poles),
    description,
    sourcePage,
  };
}

/**
 * Atomizace PDF: stránky (řádky textu) → jednotlivé přístroje podle objednacích čísel.
 * Řádky se stejným číslem (kusovník + seznam komponent) se spojí; každé číslo = jeden prvek.
 */
export function extractComponents(pages: readonly (readonly string[])[]): ExtractedComponent[] {
  const found = new Map<string, { manufacturer: string; texts: string[]; page: number }>();
  pages.forEach((lines, pageIndex) => {
    for (const line of lines) {
      for (const { manufacturer, pattern } of ARTICLE_PATTERNS) {
        for (const match of line.matchAll(pattern)) {
          const article = match[0];
          const entry = found.get(article) ?? { manufacturer, texts: [], page: pageIndex + 1 };
          if (!entry.texts.includes(line)) entry.texts.push(line);
          found.set(article, entry);
        }
      }
    }
  });
  return [...found].map(([article, { manufacturer, texts, page }]) => {
    // Nejdelší řádek nese popis (seznam komponent); typ chybí-li v něm, doplní nejkratší (kusovník).
    const ordered = [...texts].sort((a, b) => b.length - a.length);
    const primary = ordered[0];
    const hasType = TYPE_PATTERNS.some(({ pattern }) => pattern.test(primary));
    return parseComponent(article, manufacturer, hasType || ordered.length === 1 ? primary : `${ordered[ordered.length - 1]} ${primary}`, page);
  });
}
