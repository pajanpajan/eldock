// Fáze 112: rychlý import ze staré revizní zprávy a z měřicích přístrojů (Metrel ES Manager, Sonel, Fluke DMS, Chauvin
// Arnoux, Illko / PC Revize). Tabulka (CSV / TSV / XLSX / XML, text z PDF nebo Wordu, přepis fotky) → rozpoznání hlavičky
// a sloupců (označení, název / místnost, jištění, kabel, Riso, Zs, RPE, tA, S/N, výsledek, datum) → záznamy s naměřenými
// hodnotami v základních jednotkách (MΩ, Ω, ms). Z okruhů vznikne rozváděč v AI Panel Builderu, ze spotřebičů budova
// v Hlídači revizí. Čisté funkce – prohlížeč, server i testy.

export type RevisionField = "designation" | "name" | "location" | "protection" | "cable" | "riso" | "zs" | "rpe" | "ta" | "serial" | "result" | "date" | "instrument";

export const REVISION_FIELDS: readonly { id: RevisionField; label: string }[] = [
  { id: "designation", label: "Označení okruhu / spotřebiče" },
  { id: "name", label: "Název" },
  { id: "location", label: "Místnost / umístění" },
  { id: "protection", label: "Jistič / typ (B16, C16, RCD 30mA)" },
  { id: "cable", label: "Kabel (CYKY 3×2,5)" },
  { id: "riso", label: "Izolační odpor Riso [MΩ]" },
  { id: "zs", label: "Impedance smyčky Zs [Ω]" },
  { id: "rpe", label: "Spojitost PE / RPE [Ω]" },
  { id: "ta", label: "Vybavovací čas chrániče tA [ms]" },
  { id: "serial", label: "Výrobní číslo S/N" },
  { id: "result", label: "Výsledek" },
  { id: "date", label: "Datum měření" },
  { id: "instrument", label: "Měřicí přístroj" },
];

export type RevisionMapping = Partial<Record<RevisionField, number>>;

/** Hlavičky revizních programů a přístrojů (bez diakritiky, malá písmena). Pořadí = priorita při shodě. */
const HEADER_PATTERNS: Record<RevisionField, RegExp[]> = {
  designation: [/^(oznaceni|oznac\.?|cislo okruhu|okruh c\.?|c\. okruhu|obvod|okruh|circuit( no\.?| number)?|repere|ozn\.?|id|tag|evidencni cislo|ev\. ?c\.?|inventarni cislo|numer|nr obwodu|object|objekt)$/, /(oznaceni|cislo okruhu|evidencni|inventarni)/],
  name: [/^(nazev|popis|description|designation|name|nazwa|libelle|spotrebic|zarizeni|appliance|nazev spotrebice|nazev zarizeni|funkce)$/, /(nazev|popis|description|designation)/],
  location: [/^(mistnost|umisteni|lokace|location|room|pomieszczenie|lokal|emplacement|misto)$/, /(mistnost|umisteni|location)/],
  protection: [/^(jisteni|jistic|jisteni okruhu|ochrana|protection|ocpd|fuse|fuse type|pojistka|zabezpieczenie|disjoncteur|typ jistice|jistic \/ typ)$/, /(jisten|jistic|ocpd|fuse|zabezpiecz|disjonct)/],
  cable: [/^(kabel|vodic|cable|conductor|przewod|cable type|typ kabelu|prurez)$/, /(kabel|vodic|cable|przewod)/],
  riso: [/^(riso|r iso|r_iso|r ?iso ?\[?m?ω?\]?|izolacni odpor|insulation|insulation resistance|rins?ul?|rizo)/, /(riso|izolac|insulation|r iso)/],
  zs: [/^(zs|z s|zsm|zloop|z loop|loop impedance|impedance smycky|impedance poruchove smycky|zs \(l-pe\)|zl-pe|z l-pe)/, /(zs|smyck|loop)/],
  rpe: [/^(rpe|r pe|r_pe|r low|rlow|r lo|r1\+r2|spojitost|spojitost pe|odpor ochranneho vodice|continuity|ciaglosc)/, /(rpe|r pe|spojitost|continuity|r1\+r2|r ?low)/],
  ta: [/^(ta|t a|t_a|tδn|tdn|t\(iδn\)|t\(idn\)|vybavovaci cas|doba vybaveni|trip time|rcd trip time|czas zadzialania|t vyb\.?)/, /(vybavovac|trip time|czas zadzial|t\(i)/],
  serial: [/^(s\/n|sn|s\.n\.|serial|serial no\.?|serial number|vyrobni cislo|vyr\. ?c\.?|nr fabryczny|numero de serie|n° serie|n° de serie)$/, /(vyrobni cislo|serial|s\/n|fabryczny|de serie)/],
  result: [/^(vysledek|zaver|hodnoceni|vyhovuje|result|pass\/fail|status|wynik|resultat|ok)$/, /(vysledek|zaver|hodnoceni|result|wynik)/],
  date: [/^(datum|datum mereni|datum revize|date|data|date de mesure)$/, /(datum|date)/],
  instrument: [/^(pristroj|meridlo|instrument|meter|przyrzad|appareil)$/, /(pristroj|instrument|przyrzad|appareil)/],
};

const strip = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Pole sloupce podle textu hlavičky (null = neznámý sloupec). */
export function fieldOfHeader(header: string): RevisionField | null {
  const text = strip(header).replace(/[[\]()]/g, (char) => (char === "(" || char === ")" ? char : " ")).trim();
  if (!text) return null;
  for (const pass of [0, 1]) {
    for (const [field, patterns] of Object.entries(HEADER_PATTERNS) as [RevisionField, RegExp[]][]) {
      if (patterns[pass]?.test(text)) return field;
    }
  }
  return null;
}

/** Mapování sloupců: první sloupec pro každé pole. */
export function mapColumns(headers: readonly string[]): RevisionMapping {
  const mapping: RevisionMapping = {};
  headers.forEach((header, index) => {
    const field = fieldOfHeader(header);
    if (field && mapping[field] === undefined) mapping[field] = index;
  });
  return mapping;
}

/** Řádek s hlavičkou: v prvních 15 řádcích ten s nejvíc rozpoznanými sloupci (aspoň 2). */
export function detectHeaderRow(rows: readonly (readonly string[])[]): number {
  let best = -1;
  let score = 1;
  rows.slice(0, 15).forEach((row, index) => {
    const found = new Set(row.map(fieldOfHeader).filter(Boolean)).size;
    if (found > score) {
      best = index;
      score = found;
    }
  });
  return best;
}

export interface Measurement {
  value: number | null;
  /** „> 299,9 MΩ“ = mimo rozsah přístroje nahoru, „< 0,01 Ω“ dolů. */
  bound: "above" | "below" | null;
}

/**
 * Naměřená hodnota z buňky v základní jednotce pole: Riso MΩ (kΩ, GΩ), Zs a RPE Ω (mΩ), tA ms (s). „OL“, „∞“, „> 299,9“
 * = nad rozsahem; „---“, prázdné = nenaměřeno.
 */
export function parseMeasurement(raw: string | number | null | undefined, unit: "MΩ" | "Ω" | "ms"): Measurement {
  if (typeof raw === "number") return { value: Number.isFinite(raw) ? raw : null, bound: null };
  const text = (raw ?? "").trim();
  if (!text || /^[-–—/]+$/.test(text) || /^n\/?a$/i.test(text)) return { value: null, bound: null };
  if (/^(ol|∞|inf|over|>\s*rozsah)$/i.test(text)) return { value: null, bound: "above" };
  const bound = text.startsWith(">") || text.startsWith("≥") ? "above" : text.startsWith("<") || text.startsWith("≤") ? "below" : null;
  const match = /(-?\d+(?:[  ]\d{3})*(?:[.,]\d+)?)(?:\s*([kKmMGgµu]?)\s*(Ω|ohm|Ohm|s\b|ms\b)?)?/.exec(text.replace(/\s+(?=\d{3}\b)/g, ""));
  if (!match) return { value: null, bound };
  let value = Number(match[1].replace(/[  ]/g, "").replace(",", "."));
  const prefix = match[2] ?? "";
  const base = match[3] ?? "";
  if (unit === "MΩ") {
    if (prefix === "k" || prefix === "K") value /= 1000;
    else if (prefix === "G" || prefix === "g") value *= 1000;
  } else if (unit === "Ω") {
    if (prefix === "m" && /Ω|ohm/i.test(base)) value /= 1000;
    else if (prefix === "k" || prefix === "K") value *= 1000;
    else if (prefix === "M") value *= 1e6;
  } else if (unit === "ms") {
    if (base === "s" && prefix !== "m") value *= 1000;
    else if ((prefix === "µ" || prefix === "u") && base === "s") value /= 1000;
  }
  return { value: Number.isFinite(value) ? Math.round(value * 10000) / 10000 : null, bound };
}

/** Výsledek z textu buňky (VYHOVUJE / NEVYHOVUJE, OK / NOK, PASS / FAIL, ✓ / ✗). */
export function parseResult(raw: string | null | undefined): "PASS" | "FAIL" | null {
  const text = strip(raw ?? "");
  if (!text) return null;
  if (/^(nevyhovuje|nevyhov\.?|nok|n\.?ok|fail(ed)?|ne|x|✗|✘|negatywny|non conforme|nc|neschopn)/.test(text)) return "FAIL";
  if (/^(vyhovuje|vyhov\.?|ok|pass(ed)?|ano|✓|✔|pozytywny|conforme|schopn)/.test(text)) return "PASS";
  return null;
}

/** Datum z buňky (d. m. rrrr, d.m.rr, rrrr-mm-dd, mm/dd/rrrr u anglických exportů) → poledne UTC. */
export function parseDate(raw: string | null | undefined): Date | null {
  const text = (raw ?? "").trim();
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return safeDate(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2,4})/.exec(text);
  if (match) return safeDate(year(Number(match[3])), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(text);
  if (match) return safeDate(year(Number(match[3])), Number(match[1]), Number(match[2]));
  return null;
}
const year = (value: number) => (value < 100 ? 2000 + value : value);
function safeDate(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d, 12));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d ? date : null;
}

export interface ParsedProtection {
  device: "MCB" | "RCD" | "RCBO" | "FUSE" | null;
  curve: "B" | "C" | "D" | null;
  ratedA: number | null;
  poles: "1P" | "3P" | null;
  sensitivityMa: number | null;
}

/** Jištění z textu („B16“, „C 10 A“, „LSN 16B/1“, „3×B25“, „RCD 40/0,03“, „FI 30mA“, „OLE 16B/0,03“, „PV 25 gG“). */
export function parseProtection(raw: string | null | undefined): ParsedProtection {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  const upper = text.toUpperCase();
  const sensitivity = /(\d+)\s*MA\b/.exec(upper) ?? /\/\s*0[,.](\d{2,3})\b/.exec(upper);
  const sensitivityMa = sensitivity ? (sensitivity[0].includes("MA") ? Number(sensitivity[1]) : Math.round(Number(`0.${sensitivity[1]}`) * 1000)) : null;
  const curveFirst = /\b([BCD])\s*(\d{1,3})\s*A?\b/.exec(upper);
  const curveLast = /\b(\d{1,3})\s*([BCD])\b/.exec(upper);
  // „40/0,03“ = In / IΔn chrániče; jinak „25 A“ (ne desetinná část citlivosti „0,03 A“)
  const ratedPlain = /\b(\d{2,3})\s*\/\s*0[,.]\d{1,3}/.exec(upper) ?? /(?<![,.\d])(\d{1,3})\s*A\b/.exec(upper);
  const curve = (curveFirst?.[1] ?? curveLast?.[2] ?? null) as ParsedProtection["curve"];
  const ratedA = Number(curveFirst?.[2] ?? curveLast?.[1] ?? ratedPlain?.[1] ?? NaN);
  const rcdWord = /\b(RCD|FI|PROUDOV|CHRANIC|CHRÁNIČ|IΔN|IDN)/.test(upper) || sensitivityMa !== null;
  const rcbo = /\b(RCBO|OLE|LSN.*\/0|JISTICOCHRANIC|JISTIČOCHRÁNIČ|FI\/LS)/.test(upper) || (rcdWord && curve !== null);
  const fuse = /\b(GG|GL|PV|POJISTK|FUSE)/.test(upper) && !curve;
  const device: ParsedProtection["device"] = rcbo ? "RCBO" : rcdWord ? "RCD" : fuse ? "FUSE" : curve || Number.isFinite(ratedA) ? "MCB" : null;
  const poles = /\b(3\s*[×X*]|3P\b|3F\b|4P\b|3\/N)/.test(upper) ? "3P" : device ? "1P" : null;
  return { device, curve, ratedA: Number.isFinite(ratedA) && ratedA > 0 && ratedA <= 630 ? ratedA : null, poles, sensitivityMa };
}

export interface RevisionRecord {
  /** Řádek zdroje (od 1, bez hlavičky). */
  line: number;
  designation: string;
  name: string;
  location: string;
  protection: string;
  cable: string;
  risoMOhm: number | null;
  risoAbove: boolean;
  zsOhm: number | null;
  rpeOhm: number | null;
  taMs: number | null;
  serialNumber: string;
  result: "PASS" | "FAIL" | null;
  date: Date | null;
  instrument: string;
}

export type RevisionKind = "circuits" | "appliances";

export interface RevisionTable {
  headers: string[];
  mapping: RevisionMapping;
  records: RevisionRecord[];
  kind: RevisionKind;
  /** Rozpoznaný program / přístroj podle hlaviček (jen informace). */
  source: string | null;
  warnings: string[];
}

const cell = (row: readonly string[], index: number | undefined) => (index === undefined ? "" : String(row[index] ?? "").trim());

/** Program / přístroj podle podpisu hlaviček a obsahu. */
export function detectSource(headers: readonly string[], text = ""): string | null {
  const all = strip([...headers, text].join(" "));
  if (/metrel|es manager|eurotest|mi 3[0-9]{3}/.test(all)) return "Metrel ES Manager";
  if (/sonel|nazwa|zabezpieczenie|czas zadzial|nr fabryczny/.test(all)) return "Sonel";
  if (/fluke|dms|ocpd|r1\+r2/.test(all)) return "Fluke DMS";
  if (/chauvin|repere|disjoncteur|libelle|appareil/.test(all)) return "Chauvin Arnoux";
  if (/illko|pc revize|revize/.test(all)) return "Illko / PC Revize";
  return null;
}

const DESIGNATION_CIRCUIT = /^-?(F|FA|FI|Q|QF|FU)\s?\d{1,3}$|^\d{1,3}(\.\d{1,2})?$/i;

/** Okruhy rozváděče (jištění / značení -F) nebo spotřebiče (S/N, bez jištění). */
export function detectKind(records: readonly RevisionRecord[]): RevisionKind {
  if (!records.length) return "appliances";
  const circuits = records.filter((record) => parseProtection(record.protection).device || (DESIGNATION_CIRCUIT.test(record.designation) && !record.serialNumber)).length;
  const appliances = records.filter((record) => record.serialNumber || (record.rpeOhm !== null && !record.protection)).length;
  return circuits > appliances ? "circuits" : "appliances";
}

/**
 * Tabulka → záznamy. Hlavička se najde sama (nebo `mapping` z ruční volby), prázdné a součtové řádky se přeskočí.
 * Záznam bez označení i názvu se nezapočítá.
 */
export function parseRevisionRows(rows: readonly (readonly string[])[], options: { mapping?: RevisionMapping; kind?: RevisionKind } = {}): RevisionTable {
  const warnings: string[] = [];
  const headerIndex = detectHeaderRow(rows);
  const headers = headerIndex >= 0 ? rows[headerIndex].map((value) => String(value ?? "").trim()) : [];
  const mapping = options.mapping ?? mapColumns(headers);
  if (headerIndex < 0 && !options.mapping) warnings.push("Hlavičku tabulky se nepodařilo rozpoznat – přiřaďte sloupce ručně.");
  const body = rows.slice(headerIndex + 1);
  const records: RevisionRecord[] = [];
  body.forEach((row, index) => {
    if (!row.some((value) => String(value ?? "").trim())) return;
    const designation = cell(row, mapping.designation);
    const name = cell(row, mapping.name);
    if (!designation && !name) return;
    if (/^(celkem|soucet|součet|total|suma)\b/i.test(designation || name)) return;
    const riso = parseMeasurement(cell(row, mapping.riso), "MΩ");
    records.push({
      line: index + 1,
      designation,
      name,
      location: cell(row, mapping.location),
      protection: cell(row, mapping.protection),
      cable: cell(row, mapping.cable),
      risoMOhm: riso.value,
      risoAbove: riso.bound === "above",
      zsOhm: parseMeasurement(cell(row, mapping.zs), "Ω").value,
      rpeOhm: parseMeasurement(cell(row, mapping.rpe), "Ω").value,
      taMs: parseMeasurement(cell(row, mapping.ta), "ms").value,
      serialNumber: cell(row, mapping.serial).replace(/^(s\/n|sn)[:\s]*/i, ""),
      result: parseResult(cell(row, mapping.result)),
      date: parseDate(cell(row, mapping.date)),
      instrument: cell(row, mapping.instrument),
    });
  });
  if (!records.length) warnings.push("V tabulce nejsou žádné řádky s označením nebo názvem.");
  // Program / přístroj z hlavičky i z řádků nad ní (exporty ho uvádějí v záhlaví protokolu)
  const preamble = rows.slice(0, Math.max(0, headerIndex)).flat().join(" ");
  return { headers, mapping, records, kind: options.kind ?? detectKind(records), source: detectSource(headers, preamble), warnings };
}

// -----------------------------------------------------------------------------
//  Další vstupy: XML exporty přístrojů a text ze staré zprávy (PDF / Word)
// -----------------------------------------------------------------------------

const decodeXml = (value: string) =>
  value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .trim();

/**
 * XML export (Metrel / Sonel / Fluke / Chauvin Arnoux): nejčastěji opakovaný prvek s podprvky nebo atributy = řádek,
 * názvy podprvků / atributů = hlavička.
 */
export function parseXmlRecords(xml: string): string[][] {
  const counts = new Map<string, number>();
  for (const match of xml.matchAll(/<([A-Za-z_][\w.-]*)(\s[^>]*)?>/g)) counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  let best: { tag: string; rows: Record<string, string>[] } | null = null;
  for (const [tag, count] of counts) {
    if (count < 2) continue;
    const rows: Record<string, string>[] = [];
    const pattern = new RegExp(`<${tag}(\\s[^>]*)?(?:/>|>([\\s\\S]*?)</${tag}>)`, "g");
    for (const match of xml.matchAll(pattern)) {
      const record: Record<string, string> = {};
      for (const attribute of (match[1] ?? "").matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) record[attribute[1]] = decodeXml(attribute[2]);
      for (const child of (match[2] ?? "").matchAll(/<([\w.:-]+)(?:\s[^>]*)?>([^<]*)<\/\1>/g)) record[child[1]] = decodeXml(child[2]);
      if (Object.keys(record).length >= 2) rows.push(record);
    }
    const score = rows.length * new Set(rows.flatMap((row) => Object.keys(row).map(fieldOfHeader).filter(Boolean))).size;
    const bestScore = best ? best.rows.length * new Set(best.rows.flatMap((row) => Object.keys(row).map(fieldOfHeader).filter(Boolean))).size : 0;
    if (rows.length >= 1 && score > bestScore) best = { tag, rows };
  }
  if (!best) return [];
  const headers = [...new Set(best.rows.flatMap((row) => Object.keys(row)))];
  return [headers, ...best.rows.map((row) => headers.map((header) => row[header] ?? ""))];
}

/** Text ze staré zprávy (PDF / Word): řádky tabulky = sloupce oddělené tabulátorem, „|“, „;“ nebo aspoň 2 mezerami. */
export function rowsFromText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/ /g, " ").trimEnd())
    .filter((line) => line.trim())
    .map((line) => (line.includes("\t") ? line.split("\t") : line.includes("|") ? line.split("|") : line.includes(";") ? line.split(";") : line.trim().split(/ {2,}/)).map((part) => part.trim()))
    .filter((row) => row.filter(Boolean).length >= 3);
}

// -----------------------------------------------------------------------------
//  Šablona pro hromadný import
// -----------------------------------------------------------------------------

export const REVISION_TEMPLATE_HEADERS = ["Označení", "Název", "Místnost", "Jistič / typ", "Kabel", "Riso [MΩ]", "Zs [Ω]", "RPE [Ω]", "tA [ms]", "S/N", "Výsledek", "Datum"] as const;

export const REVISION_TEMPLATE_ROWS: readonly (readonly string[])[] = [
  ["-F1", "Zásuvky kuchyň", "Kuchyň", "B16", "CYKY-J 3×2,5", ">299,9", "0,62", "", "", "", "Vyhovuje", "12.03.2026"],
  ["-F2", "Světla obývací pokoj", "Obývací pokoj", "B10", "CYKY-J 3×1,5", "250", "0,81", "", "", "", "Vyhovuje", "12.03.2026"],
  ["-FI1", "Proudový chránič 40/0,03 A typ A", "Rozváděč RH", "RCD 40A 30mA", "", "", "", "", "18", "", "Vyhovuje", "12.03.2026"],
  ["SP-0401", "Monitor Dell UltraSharp 27", "Kancelář 101", "", "", ">200", "", "0,08", "", "CN-0892K1-74210", "Vyhovuje", "12.03.2026"],
  ["SP-0402", "Prodlužovací přívod 5 zásuvek 3 m", "Kancelář 101", "", "", "150", "", "0,12", "", "PP-2026-0153", "Vyhovuje", "12.03.2026"],
];

/** Vzorová šablona CSV (středník + BOM, aby ji český Excel otevřel správně). */
export function revisionTemplateCsv(): string {
  const quote = (value: string) => (/[;"\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  return "﻿" + [REVISION_TEMPLATE_HEADERS, ...REVISION_TEMPLATE_ROWS].map((row) => row.map(quote).join(";")).join("\r\n") + "\r\n";
}

/** Krátký popis naměřených hodnot záznamu („Riso > 299,9 MΩ · Zs 0,62 Ω · RPE 0,08 Ω · tA 18 ms“). */
export function measurementSummary(record: Pick<RevisionRecord, "risoMOhm" | "risoAbove" | "zsOhm" | "rpeOhm" | "taMs">): string {
  const number = (value: number) => value.toLocaleString("cs-CZ", { maximumFractionDigits: 3 });
  return [
    record.risoMOhm !== null ? `Riso ${record.risoAbove ? "> " : ""}${number(record.risoMOhm)} MΩ` : record.risoAbove ? "Riso nad rozsahem" : null,
    record.zsOhm !== null ? `Zs ${number(record.zsOhm)} Ω` : null,
    record.rpeOhm !== null ? `RPE ${number(record.rpeOhm)} Ω` : null,
    record.taMs !== null ? `tA ${number(record.taMs)} ms` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
