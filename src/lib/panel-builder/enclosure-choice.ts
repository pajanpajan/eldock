// Fáze 85: volitelný výběr konkrétní skříně / rozvodnice při zakládání projektu (výrobce → řada → model) a karta
// „Zvolená rozvodnice a skříň“ v dokumentaci. Objednací číslo (MPN) jen z katalogu výrobce – skříň z orientační matice
// Eldocku (`STD-…`) ho nemá („ověřte“), nic se nevymýšlí. Rozložení lišt podle skříně, limity lišt u zvolené skříně,
// popis, dvířka náhledu a objednací údaje ke zkopírování. Čisté funkce.

import { INSTALLATION_LABELS, enclosureFields, type EnclosureInstallation, type EnclosureLike } from "./enclosures";
import { MAX_RAILS, MAX_RAIL_MODULES, MIN_RAIL_MODULES } from "./rails";
import { VERIFIED_ENCLOSURE_SOURCE, VERIFIED_ON, enclosureSourceUrl } from "./verified-enclosures";

/** Výrobci kaskády v dialogu nového projektu (hodnota = výrobce v katalogu skříní). */
export const ENCLOSURE_CHOICE_BRANDS = [
  { value: "ABB", label: "ABB" },
  { value: "Eaton", label: "Eaton" },
  { value: "Hager", label: "Hager" },
  { value: "Rittal", label: "Rittal" },
  { value: "Schneider", label: "Schneider Electric" },
  { value: "Schrack", label: "Schrack" },
] as const;
export type EnclosureChoiceBrand = (typeof ENCLOSURE_CHOICE_BRANDS)[number]["value"];

export const isEnclosureChoiceBrand = (value: string): value is EnclosureChoiceBrand => ENCLOSURE_CHOICE_BRANDS.some((brand) => brand.value === value);

/** Obchodní název výrobce („Schneider“ → „Schneider Electric“). */
export const brandLabel = (manufacturer: string) => ENCLOSURE_CHOICE_BRANDS.find((brand) => brand.value.toLowerCase() === manufacturer.toLowerCase())?.label ?? manufacturer;

type Source = Pick<EnclosureLike, "articleNumber" | "dataSource">;

/** Skříň z orientační matice Eldocku (`STD-…`) – rozměry, typ i objednací číslo je nutné ověřit u výrobce. */
export const isOrientational = (enclosure: Source) => enclosure.dataSource === "STANDARD_MATRIX" || /^STD-/i.test(enclosure.articleNumber);

/** Objednací číslo výrobce (MPN) bez prefixu katalogu („SCHNEIDER:13396“ → „13396“); orientační skříň = null. */
export function enclosureMpn(enclosure: Source): string | null {
  if (isOrientational(enclosure)) return null;
  return enclosure.articleNumber.replace(/^[A-Z][A-Z0-9&.-]*:/, "").trim() || null;
}

export interface SeriesOption {
  key: string;
  label: string;
  count: number;
  /** Řada z orientační matice (bez objednacích čísel). */
  orientational: boolean;
}

const seriesKey = (enclosure: Pick<EnclosureLike, "series"> & Source) => `${enclosure.series.trim().toLowerCase()}|${isOrientational(enclosure) ? "std" : "cat"}`;

/** Řady výrobce – „Golf“ a „golf“ je jedna řada; katalogové řady (s MPN) před orientačními, pak podle názvu. */
export function enclosureSeries(list: readonly EnclosureLike[]): SeriesOption[] {
  const map = new Map<string, SeriesOption>();
  for (const row of list) {
    const key = seriesKey(row);
    const current = map.get(key);
    if (current) current.count++;
    else map.set(key, { key, label: isOrientational(row) ? `${row.series.trim()} (orientační)` : row.series.trim(), count: 1, orientational: isOrientational(row) });
  }
  return [...map.values()].sort((a, b) => Number(a.orientational) - Number(b.orientational) || a.label.localeCompare(b.label, "cs"));
}

/** Modely řady od nejmenší (moduly, řady, výška). */
export const modelsOfSeries = <T extends EnclosureLike>(list: readonly T[], key: string): T[] =>
  list.filter((row) => seriesKey(row) === key).sort((a, b) => a.totalModules - b.totalModules || a.rows - b.rows || a.heightMm - b.heightMm || a.model.localeCompare(b.model, "cs"));

const rowsWord = (rows: number) => (rows === 1 ? "řada" : rows <= 4 ? "řady" : "řad");
const MATERIAL_LABELS: Record<string, string> = { PLASTIC: "plast", PAINTED_STEEL: "lakovaná ocel", STAINLESS_STEEL: "nerez" };
const MATERIAL_ADJECTIVES: Record<string, string> = { PLASTIC: "Plastová", PAINTED_STEEL: "Ocelová lakovaná", STAINLESS_STEEL: "Nerezová" };
const INSTALLATION_PHRASES: Record<string, string> = { SURFACE: "nástěnná (na omítku)", FLUSH: "podomítková", HOLLOW_WALL: "do dutých stěn", FLOOR: "stojanová" };

/** Popisek modelu v nabídce: rozložení, rozměry, krytí a MPN / orientační. */
export const modelLabel = (enclosure: EnclosureLike) =>
  `${enclosure.model} · ${enclosure.rows}× ${enclosure.modulesPerRow} M · ${enclosure.widthMm} × ${enclosure.heightMm} × ${enclosure.depthMm} mm · ${enclosure.ipRating} · ${enclosureMpn(enclosure) ?? "orientační"}`;

export type DoorKind = "transparent" | "opaque";

/** Dvířka náhledu (orientační): ocelová a zapuštěná skříň plná, plastová na omítku kouřová průhledná. */
export function doorOf(enclosure: Pick<EnclosureLike, "series" | "model" | "material" | "installation"> & { description?: string | null }): DoorKind {
  const text = `${enclosure.series} ${enclosure.model} ${enclosure.description ?? ""}`;
  // Fáze 88: ABB uvádí „plná dvířka“ (Mistral41), Schrack „plné dveře“
  if (/neprůhledn|plné dv|plná dv/i.test(text)) return "opaque";
  if (/průhledn|kouřov|transparent/i.test(text)) return "transparent";
  return enclosure.material === "PLASTIC" && enclosure.installation === "SURFACE" ? "transparent" : "opaque";
}

export interface EnclosureSummary {
  title: string;
  manufacturer: string;
  series: string;
  typeDesignation: string;
  /** Technický popis jednou větou (materiál, montáž, krytí, kapacita, rozměry) – bez dvířek, katalog je nevede. */
  description: string;
  /** Objednací číslo výrobce; null = orientační typ (ověřte). */
  mpn: string | null;
  orientational: boolean;
  layout: string;
  dimensions: string;
  execution: string;
  source: string;
  /** Fáze 86: stránka výrobce, ze které jsou údaje ověřené rozvodnice; jinak null. */
  sourceUrl: string | null;
  door: DoorKind;
}

/** „2026-11-10“ → „10. 11. 2026“. */
const czechDate = (iso: string) => iso.split("-").reverse().map(Number).join(". ");

function sourceText(enclosure: Pick<EnclosureLike, "dataSource">, orientational: boolean) {
  if (orientational) return "Orientační rozměry Eldocku – typ i objednací číslo ověřte v katalogu výrobce.";
  if (enclosure.dataSource === VERIFIED_ENCLOSURE_SOURCE) return `Údaje z oficiálního katalogu výrobce (ověřeno ${czechDate(VERIFIED_ON)}).`;
  return "Údaje z katalogu výrobce (databáze prvků Eldocku).";
}

/** Technický popis zvolené skříně pro kartu dokumentace a objednací údaje. */
export function enclosureSummary(enclosure: EnclosureLike & { description?: string | null }): EnclosureSummary {
  const orientational = isOrientational(enclosure);
  const installation = INSTALLATION_LABELS[enclosure.installation as EnclosureInstallation] ?? enclosure.installation;
  return {
    title: `${brandLabel(enclosure.manufacturer)} ${enclosure.model}`,
    manufacturer: brandLabel(enclosure.manufacturer),
    series: enclosure.series,
    typeDesignation: enclosure.model,
    description: `${MATERIAL_ADJECTIVES[enclosure.material] ?? "Skříň –"} ${INSTALLATION_PHRASES[enclosure.installation] ?? installation.toLowerCase()} rozvodnice ${enclosure.model}, ${enclosure.ipRating}, kapacita ${enclosure.rows}× ${enclosure.modulesPerRow} modulů (${enclosure.totalModules} M), ${enclosure.heightMm} × ${enclosure.widthMm} × ${enclosure.depthMm} mm (V × Š × H)${enclosure.pMaxW ? `, P_max ${enclosure.pMaxW} W` : ""}.`,
    mpn: enclosureMpn(enclosure),
    orientational,
    layout: `${enclosure.rows} ${rowsWord(enclosure.rows)} × ${enclosure.modulesPerRow} M (celkem ${enclosure.totalModules} M)`,
    dimensions: `${enclosure.heightMm} × ${enclosure.widthMm} × ${enclosure.depthMm} mm (V × Š × H)`,
    execution: [installation, MATERIAL_LABELS[enclosure.material] ?? enclosure.material, enclosure.ipRating, enclosure.pMaxW ? `P_max ${enclosure.pMaxW} W` : null].filter(Boolean).join(" · "),
    source: sourceText(enclosure, orientational),
    sourceUrl: orientational ? null : enclosureSourceUrl(enclosure.description),
    door: doorOf(enclosure),
  };
}

/** Objednací údaje rozvodnice ke zkopírování (objednávka u velkoobchodu). */
export function enclosureOrderText(enclosure: EnclosureLike & { description?: string | null }, project?: { code: string; name: string }): string {
  const summary = enclosureSummary(enclosure);
  return [
    `Rozvodnice / skříň: ${summary.title}`,
    `Výrobce: ${summary.manufacturer}`,
    `Řada: ${summary.series}`,
    `Typové označení: ${summary.typeDesignation}`,
    `Popis: ${summary.description}`,
    `Objednací číslo (MPN): ${summary.mpn ?? "ověřte v katalogu výrobce (orientační typ Eldocku)"}`,
    `Rozložení: ${summary.layout}`,
    `Rozměry: ${summary.dimensions}`,
    `Provedení: ${summary.execution}`,
    "Množství: 1 ks",
    project ? `Projekt: ${project.code} – ${project.name}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const clampRail = (modules: number) => Math.min(MAX_RAIL_MODULES, Math.max(MIN_RAIL_MODULES, Math.round(modules)));

/** Fáze 111: dvoupolová skříň („2 pole po 12 M“) – dvě pole lišt vedle sebe. */
const twoFields = (enclosure: Pick<EnclosureLike, "rows" | "modulesPerRow"> & { model?: string }) => {
  const fields = enclosureFields({ model: enclosure.model ?? "", modulesPerRow: enclosure.modulesPerRow });
  return fields.fields === 2 ? fields : null;
};

/**
 * Lišty návrhu podle skříně: řady × moduly na řadu (rozsah editoru 4–48 M, nejvýš 16 lišt). Fáze 111: dvoupolová
 * skříň = řady × 2 lišty po šířce pole (levé pole lišty 1…n, pravé n+1…2n – `enclosureLayout`).
 */
export function enclosureRails(enclosure: Pick<EnclosureLike, "rows" | "modulesPerRow"> & { model?: string }): number[] {
  const fields = twoFields(enclosure);
  const rows = Math.max(1, enclosure.rows);
  if (fields) return Array.from({ length: Math.min(MAX_RAILS, rows * 2) }, () => clampRail(fields.fieldWidth));
  return Array.from({ length: Math.min(MAX_RAILS, rows) }, () => clampRail(enclosure.modulesPerRow));
}

/** Fáze 111: uspořádání lišt návrhu podle skříně – u dvoupolové skříně dvě pole vedle sebe, jinak null. */
export function enclosureLayout(enclosure: Pick<EnclosureLike, "rows" | "modulesPerRow"> & { model?: string }): { fields: 2; fieldARails: number } | null {
  const fields = twoFields(enclosure);
  const rails = enclosureRails(enclosure).length;
  return fields && rails >= 2 ? { fields: 2, fieldARails: Math.ceil(rails / 2) } : null;
}

/** Limity lišt: u zvolené skříně nejvýš její řady po nejvýš jejích modulech, jinak limity editoru (u 2 polí 2 × řady). */
export function railLimits(enclosure: (Pick<EnclosureLike, "rows" | "modulesPerRow"> & { model?: string }) | null): { maxRails: number; maxModules: number } {
  if (!enclosure) return { maxRails: MAX_RAILS, maxModules: MAX_RAIL_MODULES };
  const fields = twoFields(enclosure);
  if (fields) return { maxRails: Math.min(MAX_RAILS, Math.max(1, enclosure.rows) * 2), maxModules: clampRail(fields.fieldWidth) };
  return { maxRails: Math.min(MAX_RAILS, Math.max(1, enclosure.rows)), maxModules: clampRail(enclosure.modulesPerRow) };
}
