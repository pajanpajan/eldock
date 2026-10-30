// Hromadný import spotřebičů a zařízení z CSV / Excelu (vložení ze schránky = tabulátory).
// Čisté funkce: parsování, kategorie → typ zařízení, data a automatické spárování lokality.

import type { EquipmentType } from "@/generated/prisma/enums";

export type ImportCategory = "VTZ" | "APPLIANCE" | "TOOL";

export const IMPORT_CATEGORY_LABELS: Record<ImportCategory, string> = { VTZ: "VTZ", APPLIANCE: "Spotřebič", TOOL: "Nářadí" };

export interface ImportRow {
  /** Číslo řádku ve zdroji (od 1, bez hlavičky) – pro chybové hlášky. */
  line: number;
  name: string;
  tag: string;
  category: ImportCategory | null;
  type: EquipmentType | null;
  intervalMonths: number | null;
  lastInspection: Date | null;
  location: string;
  errors: string[];
}

export const IMPORT_COLUMNS = ["Název", "Evidenční číslo", "Kategorie", "Interval revize (měsíce)", "Poslední revize", "Lokace"] as const;

/** Vzorová šablona (středník + BOM, aby ji český Excel otevřel správně). */
export const IMPORT_TEMPLATE_CSV =
  "﻿" +
  [
    IMPORT_COLUMNS.join(";"),
    "Rychlovarná konvice ETA;SP-0401;Spotřebič;24;12.03.2026;Administrativa 2. NP kuchyňka",
    "Mikrovlnná trouba Samsung;SP-0402;Spotřebič;24;12.03.2026;Administrativa 2. NP kuchyňka",
    "Úhlová bruska Makita 125;NR-0201;Nářadí;6;02.09.2026;Hala A 1. NP dílna údržby",
    "Prodlužovací přívod 230 V 25 m;PP-0201;Nářadí;6;02.09.2026;Hala A 1. NP dílna",
    "Rozváděč osvětlení RO2;RO2;VTZ;48;15.01.2024;Hala B 1. NP",
  ].join("\r\n") +
  "\r\n";

/** Bez diakritiky, malými písmeny, jen písmena a číslice oddělené mezerou. */
export function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Rozdělí text CSV na řádky a buňky (uvozovky, zdvojené uvozovky, nové řádky v buňce). */
export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^﻿/, "");
  const firstLine = source.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"' && cell === "") quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((cells) => cells.map((value) => value.trim())).filter((cells) => cells.some((value) => value !== ""));
}

type Field = "name" | "tag" | "category" | "interval" | "last" | "location";

const HEADER_ALIASES: Record<Field, string[]> = {
  name: ["nazev", "nazev zarizeni", "name", "popis"],
  tag: ["evidencni cislo", "ev cislo", "inventarni cislo", "tag", "oznaceni", "cislo"],
  category: ["kategorie", "druh", "category"],
  interval: ["interval revize", "interval revize mesice", "interval", "lhuta", "lhuta mesice"],
  last: ["posledni revize", "datum posledni revize", "revize", "last inspection"],
  location: ["lokace", "umisteni", "lokalita", "misto", "location"],
};

function headerField(cell: string): Field | null {
  const value = normalize(cell);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, string[]][]) {
    if (aliases.some((alias) => value === alias || value.startsWith(`${alias} `))) return field;
  }
  return null;
}

/** Kategorie ze souboru → kategorie importu a konkrétní typ zařízení (podle názvu). */
export function categorize(categoryText: string, name: string): { category: ImportCategory; type: EquipmentType } | null {
  const category = normalize(categoryText);
  const title = normalize(name);
  const isCord = /prodluz|privod|buben/.test(title);
  if (/^(vtz|vyhrazen|rozvad|stroj|pevn)/.test(category)) {
    return { category: "VTZ", type: /stroj|motor|pohon|lis|linka/.test(title) ? "MACHINE" : "SWITCHBOARD" };
  }
  if (/^(spotrebic|appliance|elektrospotrebic)/.test(category)) return { category: "APPLIANCE", type: isCord ? "EXTENSION_CORD" : "APPLIANCE" };
  if (/^(naradi|tool|rucni)/.test(category)) {
    return { category: "TOOL", type: isCord ? "EXTENSION_CORD" : /svarec|svarovac/.test(title) ? "WELDER" : "POWER_TOOL" };
  }
  return null;
}

/** Datum „12.03.2026“, „12. 3. 2026“ nebo „2026-03-12“ (UTC poledne – bez posunu dne). */
export function parseCzechDate(value: string): Date | null {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const cz = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})$/.exec(text);
  const [year, month, day] = iso ? [iso[1], iso[2], iso[3]] : cz ? [cz[3], cz[2], cz[1]] : [];
  if (!year) return null;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  return date.getUTCMonth() === Number(month) - 1 && date.getUTCDate() === Number(day) ? date : null;
}

/** Načte řádky importu; hlavička je nepovinná (bez ní platí pořadí sloupců šablony). */
export function parseImport(text: string, now: Date = new Date()): ImportRow[] {
  const table = parseDelimited(text);
  if (!table.length) return [];
  const headerFields = table[0].map(headerField);
  const hasHeader = headerFields.filter(Boolean).length >= 2;
  const order: (Field | null)[] = hasHeader ? headerFields : ["name", "tag", "category", "interval", "last", "location"];
  const body = hasHeader ? table.slice(1) : table;

  return body.map((cells, index) => {
    const get = (field: Field) => cells[order.indexOf(field)] ?? "";
    const errors: string[] = [];
    const name = get("name");
    const tag = get("tag").toUpperCase();
    if (!name) errors.push("Chybí název.");
    if (!tag) errors.push("Chybí evidenční číslo.");
    const categorized = categorize(get("category"), name);
    if (!categorized) errors.push(`Neznámá kategorie „${get("category")}“ (VTZ / Spotřebič / Nářadí).`);
    const intervalText = get("interval");
    const interval = intervalText ? Number(intervalText.replace(",", ".")) : null;
    if (interval !== null && (!Number.isInteger(interval) || interval < 1 || interval > 120)) errors.push(`Neplatný interval „${intervalText}“ (1–120 měsíců).`);
    const lastText = get("last");
    const last = lastText ? parseCzechDate(lastText) : null;
    if (lastText && !last) errors.push(`Neplatné datum revize „${lastText}“.`);
    if (last && last > now) errors.push("Datum poslední revize je v budoucnosti.");
    return {
      line: index + 1,
      name,
      tag,
      category: categorized?.category ?? null,
      type: categorized?.type ?? null,
      intervalMonths: interval !== null && Number.isInteger(interval) ? interval : null,
      lastInspection: last && last <= now ? last : null,
      location: get("location"),
      errors,
    };
  });
}

export interface FloorOption {
  id: string;
  plantName: string;
  buildingName: string;
  buildingCode: string;
  buildingShortName: string | null;
  floorName: string;
  floorCode: string;
  level: number;
}

const floorTokens = (floor: FloorOption) => {
  const code = normalize(floor.floorCode).replace(/\s/g, ""); // "1np"
  const named = normalize(floor.floorName).match(/^(\d+)\s*(np|pp)/);
  return new Set([code, named ? `${named[1]}${named[2]}` : code]);
};

/**
 * Automatické spárování textové lokace („Hala A 1. NP dílna“) s patrem: budova podle názvu,
 * zkratky nebo kódu, patro podle „1. NP“ / „1NP“. Jednopodlažní budova stačí sama.
 */
export function matchFloor(location: string, floors: readonly FloorOption[]): string | null {
  const text = ` ${normalize(location)} `;
  if (!text.trim()) return null;
  const compact = text.replace(/(\d+)\s+(np|pp)\b/g, "$1$2");
  let best: { id: string; score: number } | null = null;
  const buildings = new Map<string, FloorOption[]>();
  for (const floor of floors) buildings.set(floor.buildingName, [...(buildings.get(floor.buildingName) ?? []), floor]);

  for (const [buildingName, list] of buildings) {
    const sample = list[0];
    const names = [buildingName, sample.buildingShortName ?? "", buildingName.split(/\s+-\s+/)[0]].map(normalize).filter((name) => name.length >= 3);
    const codeHit = new RegExp(`\\b(hala|budova|objekt)\\s+${normalize(sample.buildingCode)}\\b`).test(text);
    const buildingScore = names.some((name) => text.includes(` ${name} `) || text.includes(` ${name}`)) ? 2 : codeHit ? 2 : 0;
    if (!buildingScore) continue;
    for (const floor of list) {
      const floorHit = [...floorTokens(floor)].some((token) => compact.includes(` ${token} `) || compact.includes(` ${token}`));
      if (!floorHit && list.length > 1) continue;
      const score = buildingScore + (floorHit ? 1 : 0) + normalize(sample.buildingName).length / 1000;
      if (!best || score > best.score) best = { id: floor.id, score };
    }
  }
  return best?.id ?? null;
}
