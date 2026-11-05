// Kaskáda domovních přístrojů 2D půdorysu (fáze 51): výrobce (s logem) → designová řada → barva.
// Řady jsou pojmenované podle katalogů výrobců; `dbSeries` = názvy řad v databázi `WiringDevice`
// (externí katalog), barvy = skupiny `wd_color_family`. Čisté funkce.

import { ABB_SERIES_2026, type SeriesColor, type SeriesShape } from "./abb-catalog-2026";

export interface DesignSeries {
  /** Název v kaskádě (a v klíči „výrobce|řada“). */
  name: string;
  /** Názvy řady v katalogu domovních přístrojů (prázdné = v databázi zatím chybí). */
  dbSeries: string[];
  /** Řada pro vlhké prostory (IP44 / IP55). */
  ip?: string;
  /** Fáze 55: skutečné barvy řady s kódem z katalogu (ABB 2026); bez nich obecné skupiny `DESIGN_COLORS`. */
  colors?: SeriesColor[];
  /** Tvar pro 2D náhled rámečku a klapky. */
  shape?: SeriesShape;
  /** Písmeno řady v objednacím čísle (ABB: T, A, H, E/F …). */
  letter?: string | null;
  /** Starší názvy řady (klíče uložených nákresů). */
  aliases?: string[];
}

export interface DesignBrand {
  /** Výrobce v katalogu (`WiringDevice.manufacturer`, logo). */
  manufacturer: string;
  label: string;
  series: DesignSeries[];
}

export const DESIGN_BRANDS: DesignBrand[] = [
  {
    manufacturer: "ABB",
    label: "ABB",
    // Fáze 55: 14 řad pro zapuštěnou montáž + 3 nástěnné IP44 / IP54 se skutečnými barvami (Katalog ABB 2026)
    series: ABB_SERIES_2026.map((series) => ({
      name: series.name,
      dbSeries: series.dbSeries,
      ip: series.ip,
      colors: series.colors,
      shape: series.shape,
      letter: series.letter,
      aliases: series.name === "Swing" ? ["Swing / Swing L"] : series.name === "future linear" ? ["Future Linear"] : series.name === "solo / solo carat" ? ["Solo"] : undefined,
    })),
  },
  {
    manufacturer: "Schneider",
    label: "Schneider Electric",
    series: [
      { name: "Nová Unica", dbSeries: ["Nová Unica"] },
      { name: "Sedna Design & Elements", dbSeries: ["Sedna"] },
      { name: "Asfora", dbSeries: ["Asfora"] },
      { name: "Mureva Styl (IP55)", dbSeries: ["Mureva Styl", "Mureva"], ip: "IP55" },
    ],
  },
  {
    manufacturer: "Legrand",
    label: "Legrand",
    series: [
      { name: "Valena Life", dbSeries: ["Valena Life", "Valena"] },
      { name: "Valena Allure", dbSeries: ["Valena Allure"] },
      { name: "Céliane", dbSeries: ["Celiane", "Mosaic/Celiane"] },
      { name: "Niloé", dbSeries: ["Niloe", "Niloé"] },
      { name: "Mosaic", dbSeries: ["Mosaic", "Mosaic/Celiane"] },
      { name: "Plexo (IP55)", dbSeries: ["Plexo"], ip: "IP55" },
    ],
  },
  {
    manufacturer: "Hager",
    label: "Hager",
    series: [
      { name: "lumina", dbSeries: ["lumina", "Lumina"] },
      { name: "berker S.1 / B.3 / Q.1 / Q.3", dbSeries: ["berker S.1", "berker B.3", "berker Q.1", "berker Q.3", "Berker S.1", "Berker B.3", "Berker Q.1", "Berker Q.3"] },
    ],
  },
];

export interface DesignColor {
  id: string;
  label: string;
  /** Kroužek v kaskádě. */
  swatch: string;
  /** Skupiny `wd_color_family` katalogu (pořadí = přednost). */
  families: string[];
}

export const DESIGN_COLORS: DesignColor[] = [
  { id: "white", label: "Bílá / Alpská bílá", swatch: "#f8fafc", families: ["white"] },
  { id: "ivory", label: "Slonová kost / Béžová", swatch: "#efe3c8", families: ["ivory", "beige"] },
  { id: "black", label: "Černá matná / Antracit", swatch: "#27272a", families: ["black", "anthracite"] },
  { id: "grey", label: "Šedá / Metalická", swatch: "#9ca3af", families: ["grey", "titanium", "silver"] },
  { id: "alu", label: "Hliník / Inox", swatch: "#cbd5e1", families: ["aluminium", "steel", "silver"] },
  { id: "wood", label: "Dřevo / Písková", swatch: "#a16207", families: ["wood", "brown", "bronze"] },
];

export const DEFAULT_COLOR = "white";

export const designBrand = (manufacturer: string | null | undefined) => DESIGN_BRANDS.find((brand) => brand.manufacturer === manufacturer) ?? null;

/** Fáze 55: barva řady jako obecná barva (výběr přístrojů z katalogu podle `wd_color_family`). */
const asDesignColor = (color: SeriesColor): DesignColor => ({ id: color.id, label: color.label, swatch: color.swatch, families: [color.family] });
const SERIES_COLORS = DESIGN_BRANDS.flatMap((brand) => brand.series.flatMap((series) => (series.colors ?? []).map(asDesignColor)));

/** Obecná barva (white, ivory …) nebo barva konkrétní řady (abb-zoni-500 …). */
export const designColor = (id: string | null | undefined) => DESIGN_COLORS.find((color) => color.id === id) ?? SERIES_COLORS.find((color) => color.id === id) ?? null;

/** Barvy nabízené pro řadu: skutečné barvy řady (ABB 2026), jinak obecné skupiny. */
export function seriesColors(seriesKey: string | null | undefined): DesignColor[] {
  const found = designSeriesOf(seriesKey);
  return found?.series.colors?.length ? found.series.colors.map(asDesignColor) : DESIGN_COLORS;
}

/**
 * Po přepnutí řady: barva zůstane, jen pokud v nové řadě existuje; jinak první (výchozí) barva nové řady.
 * Obecná barva (white …) se u řady se skutečnými barvami převede na první barvu stejné skupiny.
 */
export function colorForSeries(seriesKey: string | null | undefined, colorId: string | null | undefined): string {
  const colors = seriesColors(seriesKey);
  if (colors.some((color) => color.id === colorId)) return colorId!;
  const family = designColor(colorId)?.families[0];
  return (family ? colors.find((color) => color.families.includes(family)) : undefined)?.id ?? colors[0].id;
}

/** Řada podle klíče „výrobce|řada“ – i starší klíče z databáze („ABB|Swing L“ → „Swing / Swing L“). */
export function designSeriesOf(key: string | null | undefined): { brand: DesignBrand; series: DesignSeries } | null {
  const [manufacturer, name] = (key ?? "").split("|");
  const brand = designBrand(manufacturer);
  if (!brand || !name) return null;
  const series = brand.series.find((row) => row.name === name) ?? brand.series.find((row) => row.aliases?.includes(name)) ?? brand.series.find((row) => row.dbSeries.includes(name));
  return series ? { brand, series } : null;
}

/** Názvy řad v databázi pro klíč (neznámá řada → přímo název z klíče). */
export function dbSeriesFor(key: string | null | undefined): { manufacturer: string; series: string[] } | null {
  const found = designSeriesOf(key);
  if (found) return { manufacturer: found.brand.manufacturer, series: found.series.dbSeries };
  const [manufacturer, name] = (key ?? "").split("|");
  return manufacturer && name ? { manufacturer, series: [name] } : null;
}

/** „ABB Levit · Bílá / Alpská bílá“ – popis do kusovníku a soupisu domovní instalace. */
export function appearanceLabel(seriesKey: string | null | undefined, colorId: string | null | undefined): string {
  const found = designSeriesOf(seriesKey);
  if (!found) return "bez domovních přístrojů";
  const color = designColor(colorId) ?? designColor(DEFAULT_COLOR)!;
  return `${found.brand.label} ${found.series.name} · ${color.label}`;
}
