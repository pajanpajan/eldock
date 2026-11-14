// Výběr skříně rozváděče (fáze 43): nejdřív výrobce, pak jen skříně, které pojmou aktuální návrh
// (řady ≥ počet DIN lišt, moduly na řadu ≥ nejširší lišta, celkem ≥ obsazené moduly). Matice
// standardních rozvodnic 12–144M pro seed a převod vybrané skříně do parametrů oteplení.

import type { EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";

/** Výrobci skříní v modalu (karty s logy). */
export const ENCLOSURE_MANUFACTURERS = ["ABB", "Eaton", "Hager", "OEZ", "Noark", "Schrack", "Hensel", "Rittal"] as const;
/** Fáze 113: výrobci ve výběru skříně – navíc Schneider Electric (jen ověřené typy Pragma, bez orientační matice). */
export const ENCLOSURE_BRANDS = [...ENCLOSURE_MANUFACTURERS, "Schneider"] as const;

export type EnclosureInstallation = "FLUSH" | "SURFACE" | "HOLLOW_WALL" | "FLOOR";

export const INSTALLATION_LABELS: Record<EnclosureInstallation, string> = {
  FLUSH: "Pod omítku",
  SURFACE: "Na omítku",
  HOLLOW_WALL: "Do dutých stěn",
  FLOOR: "Stojanová",
};

/** Filtr montáže: Vše / Pod omítku / Na omítku / Krytí IP (od IP54 výše). */
export const MOUNTING_FILTERS = [
  { value: "ALL", label: "Vše" },
  { value: "FLUSH", label: "Pod omítku" },
  { value: "SURFACE", label: "Na omítku" },
  { value: "IP54", label: "Krytí IP54+" },
] as const;
export type MountingFilter = (typeof MOUNTING_FILTERS)[number]["value"];

export interface EnclosureLike {
  id: string;
  manufacturer: string;
  series: string;
  model: string;
  articleNumber: string;
  rows: number;
  modulesPerRow: number;
  totalModules: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ipRating: string;
  installation: string;
  material: string;
  pMaxW: number | null;
  dataSource: string;
}

/** Požadavek návrhu na skříň. */
export interface EnclosureNeed {
  /** Řady skříně (u dvou polí vedle sebe řady jednoho pole). */
  rails: number;
  /** Nejširší lišta (u dvou polí nejširší lišta pole). */
  maxModulesPerRail: number;
  usedModules: number;
  /** Fáze 111: dvě pole vedle sebe (Silnoproud | Slaboproud) – skříň musí mít aspoň 2 pole. */
  fields?: 1 | 2;
}

/** Fáze 111: pole skříně z názvu modelu („CA25V (2 pole po 12 M)“ → 2 pole po 12 M), jinak 1 pole na celou řadu. */
export interface EnclosureFields {
  fields: number;
  fieldWidth: number;
}

export function enclosureFields(enclosure: Pick<EnclosureLike, "model" | "modulesPerRow">): EnclosureFields {
  const match = /\((\d+)\s*pol[ea]\s*po\s*(\d+)\s*M\)/i.exec(enclosure.model);
  if (match) {
    const fields = Number(match[1]);
    const fieldWidth = Number(match[2]);
    if (fields >= 2 && fieldWidth >= 4 && fields * fieldWidth <= enclosure.modulesPerRow + 0.5) return { fields, fieldWidth };
  }
  return { fields: 1, fieldWidth: enclosure.modulesPerRow };
}

/**
 * Požadavek z lišt projektu. Fáze 111: u dvou polí vedle sebe (`layout.fields = 2`, lišty 1…n vlevo) jsou řady = víc lišt
 * z obou polí a šířka = nejširší lišta pole – skříň „2 pole po 12 M“ se 7 řadami pojme 2 × 7 lišt po 12 M.
 */
export function enclosureNeed(capacities: readonly number[], items: readonly { modulesWidth: number }[], layout?: { fields: number; fieldARails: number } | null): EnclosureNeed {
  const usedModules = Math.round(items.reduce((sum, item) => sum + item.modulesWidth, 0) * 10) / 10;
  if (layout?.fields === 2 && layout.fieldARails >= 1 && layout.fieldARails < capacities.length) {
    const left = capacities.slice(0, layout.fieldARails);
    const right = capacities.slice(layout.fieldARails);
    return { rails: Math.max(left.length, right.length), maxModulesPerRail: Math.max(1, ...capacities), usedModules, fields: 2 };
  }
  return { rails: capacities.length, maxModulesPerRail: Math.max(1, ...capacities), usedModules };
}

/**
 * Pravidlo zadání: skrin.rows ≥ lišty, modulesPerRow ≥ max. moduly na liště, totalModules ≥ obsazeno. Fáze 111: dvě pole
 * vedle sebe potřebují skříň s aspoň 2 poli, každé pole aspoň tak široké jako lišta.
 */
export const fitsEnclosure = (enclosure: Pick<EnclosureLike, "rows" | "modulesPerRow" | "totalModules"> & Partial<Pick<EnclosureLike, "model">>, need: EnclosureNeed) => {
  if (need.fields === 2) {
    const fields = enclosureFields({ model: enclosure.model ?? "", modulesPerRow: enclosure.modulesPerRow });
    return fields.fields >= 2 && fields.fieldWidth >= need.maxModulesPerRail && enclosure.rows >= need.rails && enclosure.totalModules >= need.usedModules;
  }
  return enclosure.rows >= need.rails && enclosure.modulesPerRow >= need.maxModulesPerRail && enclosure.totalModules >= need.usedModules;
};

/** Kolik % modulů zůstane ve skříni volných. */
export const reservePercent = (enclosure: Pick<EnclosureLike, "totalModules">, need: EnclosureNeed) =>
  enclosure.totalModules > 0 ? Math.max(0, Math.round(((enclosure.totalModules - need.usedModules) / enclosure.totalModules) * 100)) : 0;

/** Číslo krytí („IP41“ → 41, „IP4X“ → 40). */
export const ipNumber = (ip: string) => Number(/IP\s*(\d)(\d|X)/i.exec(ip)?.slice(1).map((digit) => (digit.toUpperCase() === "X" ? "0" : digit)).join("") ?? 0);

/** Vyhovující skříně vybraného výrobce: nejmenší nejdřív (nejméně zbytečné rezervy). Bez výrobce nic. */
export function fitEnclosures<T extends EnclosureLike>(list: readonly T[], need: EnclosureNeed, filter: { manufacturer: string | null; mounting: MountingFilter }): T[] {
  if (!filter.manufacturer) return [];
  const brand = filter.manufacturer.toLowerCase();
  return list
    .filter((enclosure) => enclosure.manufacturer.toLowerCase() === brand)
    .filter((enclosure) => (filter.mounting === "ALL" ? true : filter.mounting === "IP54" ? ipNumber(enclosure.ipRating) >= 54 : enclosure.installation === filter.mounting))
    .filter((enclosure) => fitsEnclosure(enclosure, need))
    .sort((a, b) => a.totalModules - b.totalModules || a.rows - b.rows || a.heightMm - b.heightMm || a.model.localeCompare(b.model));
}

/** Vybraná skříň → parametry projektu a výpočtu oteplení (rozměry, způsob instalace, materiál, krytí, P_max). */
export function enclosureProjectData(enclosure: EnclosureLike): {
  enclosureModel: string;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ipRating: string;
  enclosureType: EnclosureType;
  enclosureMaterial: EnclosureMaterial;
  enclosurePmaxW: number | null;
} {
  const material: EnclosureMaterial = enclosure.material === "PAINTED_STEEL" || enclosure.material === "STAINLESS_STEEL" ? enclosure.material : "PLASTIC";
  return {
    enclosureModel: `${enclosure.manufacturer} ${enclosure.model}`,
    widthMm: enclosure.widthMm,
    heightMm: enclosure.heightMm,
    depthMm: enclosure.depthMm,
    ipRating: enclosure.ipRating.replace(/^IP\s*/i, "IP "),
    enclosureType: enclosure.installation === "FLUSH" || enclosure.installation === "HOLLOW_WALL" ? "FLUSH_MOUNTED" : enclosure.installation === "FLOOR" ? "FREE_STANDING" : "WALL_MOUNTED",
    enclosureMaterial: material,
    enclosurePmaxW: enclosure.pMaxW,
  };
}

// ---------------------------------------------------------------------------
//  Matice standardních rozvodnic 12–144M (seed) – orientační rozměry řad výrobců
// ---------------------------------------------------------------------------

export const STANDARD_SIZES = [12, 14, 18, 24, 36, 48, 54, 60, 72, 96, 120, 144] as const;

/** Rozložení velikosti na řady × moduly (14M = 1 × 14, 54M = 3 × 18, 144M = 6 × 24). */
export function sizeLayout(size: number, wideRows = false): { rows: number; perRow: number } {
  if (size <= 18) return { rows: 1, perRow: size };
  if (size === 54) return { rows: 3, perRow: 18 };
  if (size === 72) return { rows: 4, perRow: 18 };
  if (size >= 96) return { rows: size / 24, perRow: 24 };
  return { rows: size / 12, perRow: wideRows ? 14 : 12 };
}

interface SeriesSpec {
  manufacturer: (typeof ENCLOSURE_MANUFACTURERS)[number];
  series: string;
  /** Název modelu podle velikosti. */
  name: (size: number, rows: number, perRow: number) => string;
  installation: EnclosureInstallation;
  material: EnclosureMaterial;
  ip: string;
  /** Řady 12/14 modulů (12 + 2 rezerva na hřeben / svorky). */
  wideRows?: boolean;
  sizes: readonly number[];
  w0: number;
  h0: number;
  rowH: number;
  depth: number;
}

const ALL = STANDARD_SIZES;
const UP_TO_72 = STANDARD_SIZES.filter((size) => size <= 72);
const grid = (rows: number, perRow: number) => `${rows}×${perRow}`;

export const ENCLOSURE_SERIES: readonly SeriesSpec[] = [
  { manufacturer: "ABB", series: "Mistral41W", name: (s, r, p) => `Mistral41W ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP41", sizes: ALL, w0: 100, h0: 110, rowH: 125, depth: 128 },
  { manufacturer: "ABB", series: "UK600", name: (s, r) => `UK600 ${s}M ${r}×12/14`, installation: "FLUSH", material: "PLASTIC", ip: "IP30", wideRows: true, sizes: UP_TO_72, w0: 90, h0: 120, rowH: 125, depth: 95 },
  { manufacturer: "Eaton", series: "KLV", name: (s, r) => `KLV-${s}UPS-F ${r}×12/14`, installation: "FLUSH", material: "PLASTIC", ip: "IP30", wideRows: true, sizes: UP_TO_72, w0: 100, h0: 130, rowH: 125, depth: 100 },
  { manufacturer: "Eaton", series: "BF-O", name: (s, r, p) => `BF-O ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PAINTED_STEEL", ip: "IP43", sizes: ALL, w0: 120, h0: 140, rowH: 125, depth: 105 },
  { manufacturer: "Hager", series: "Volta", name: (s, r) => `Volta VU${s}NC ${r}×12`, installation: "FLUSH", material: "PLASTIC", ip: "IP30", sizes: UP_TO_72, w0: 130, h0: 110, rowH: 125, depth: 95 },
  { manufacturer: "Hager", series: "Golf", name: (s, r, p) => `Golf VS ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP40", sizes: ALL, w0: 100, h0: 120, rowH: 125, depth: 110 },
  { manufacturer: "OEZ", series: "RZB", name: (s, r, p) => `RZB ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP41", sizes: ALL, w0: 95, h0: 115, rowH: 125, depth: 110 },
  { manufacturer: "OEZ", series: "RZA", name: (s, r, p) => `RZA ${s}M ${grid(r, p)}`, installation: "FLUSH", material: "PLASTIC", ip: "IP40", sizes: UP_TO_72, w0: 110, h0: 120, rowH: 125, depth: 95 },
  { manufacturer: "Noark", series: "PHS", name: (s, r, p) => `PHS ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP65", sizes: ALL, w0: 105, h0: 125, rowH: 130, depth: 115 },
  { manufacturer: "Noark", series: "PNF", name: (s, r, p) => `PNF ${s}M ${grid(r, p)}`, installation: "FLUSH", material: "PLASTIC", ip: "IP41", sizes: UP_TO_72, w0: 110, h0: 120, rowH: 125, depth: 95 },
  { manufacturer: "Schrack", series: "Amparo", name: (s, r, p) => `Amparo AP ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP41", sizes: ALL, w0: 100, h0: 120, rowH: 125, depth: 110 },
  { manufacturer: "Schrack", series: "Amparo UP", name: (s, r, p) => `Amparo UP ${s}M ${grid(r, p)}`, installation: "FLUSH", material: "PLASTIC", ip: "IP30", sizes: UP_TO_72, w0: 115, h0: 125, rowH: 125, depth: 95 },
  { manufacturer: "Hensel", series: "KV", name: (s, r, p) => `KV 93${String(s).padStart(2, "0")} ${grid(r, p)}`, installation: "SURFACE", material: "PLASTIC", ip: "IP65", sizes: ALL, w0: 110, h0: 140, rowH: 135, depth: 140 },
  { manufacturer: "Rittal", series: "AX", name: (s, r, p) => `AX ${s}M ${grid(r, p)}`, installation: "SURFACE", material: "PAINTED_STEEL", ip: "IP66", sizes: ALL, w0: 150, h0: 160, rowH: 150, depth: 155 },
];

/**
 * Orientační P_max [W] podle velikosti a materiálu (ΔT 35 K): plast ~ 10 + 0,55 W/modul + 5 W/řada,
 * ocel o 40 % víc. Přesné hodnoty nese externí databáze prvků (`catalog:sync`).
 */
export const typicalPmax = (total: number, rows: number, material: EnclosureMaterial) => Math.round((10 + total * 0.55 + rows * 5) * (material === "PLASTIC" ? 1 : 1.4));

/** Matice standardních rozvodnic pro seed (upsert podle `articleNumber`). */
export function standardEnclosureMatrix() {
  return ENCLOSURE_SERIES.flatMap((spec) =>
    spec.sizes.map((size) => {
      const { rows, perRow } = sizeLayout(size, spec.wideRows);
      return {
        manufacturer: spec.manufacturer,
        series: spec.series,
        model: spec.name(size, rows, perRow),
        articleNumber: `STD-${spec.manufacturer}-${spec.series}-${size}M`.toUpperCase().replace(/[^A-Z0-9-]+/g, ""),
        rows,
        modulesPerRow: perRow,
        totalModules: rows * perRow,
        widthMm: Math.round((spec.w0 + perRow * 18) / 5) * 5,
        heightMm: spec.h0 + rows * spec.rowH,
        depthMm: spec.depth,
        ipRating: spec.ip,
        installation: spec.installation,
        material: spec.material,
        pMaxW: typicalPmax(rows * perRow, rows, spec.material),
        dataSource: "STANDARD_MATRIX",
        description: `${INSTALLATION_LABELS[spec.installation]}, ${rows} ${rows === 1 ? "řada" : rows <= 4 ? "řady" : "řad"} × ${perRow} M – orientační rozměry, ověřte v katalogu výrobce`,
      };
    }),
  );
}
