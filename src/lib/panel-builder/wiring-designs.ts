// Kaskáda domovních přístrojů 2D půdorysu (fáze 51): výrobce (s logem) → designová řada → barva.
// Řady jsou pojmenované podle katalogů výrobců; `dbSeries` = názvy řad v databázi `WiringDevice`
// (externí katalog), barvy = skupiny `wd_color_family`. Čisté funkce.

export interface DesignSeries {
  /** Název v kaskádě (a v klíči „výrobce|řada“). */
  name: string;
  /** Názvy řady v katalogu domovních přístrojů (prázdné = v databázi zatím chybí). */
  dbSeries: string[];
  /** Řada pro vlhké prostory (IP44 / IP55). */
  ip?: string;
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
    series: [
      { name: "Tango", dbSeries: ["Tango"] },
      { name: "Levit", dbSeries: ["Levit"] },
      { name: "Zoni", dbSeries: ["Zoni"] },
      { name: "Time", dbSeries: ["Time", "Element/Time"] },
      { name: "Element", dbSeries: ["Element", "Element/Time"] },
      { name: "Swing / Swing L", dbSeries: ["Swing", "Swing L"] },
      { name: "Future Linear", dbSeries: ["Future Linear"] },
      { name: "Busch-axcent", dbSeries: ["Busch-axcent"] },
      { name: "Decento", dbSeries: ["Decento"] },
      { name: "Solo", dbSeries: ["Solo"] },
      { name: "Basic55", dbSeries: ["Basic55", "Basic 55"] },
      { name: "Garant (IP44)", dbSeries: ["Garant"], ip: "IP44" },
    ],
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
export const designColor = (id: string | null | undefined) => DESIGN_COLORS.find((color) => color.id === id) ?? null;

/** Řada podle klíče „výrobce|řada“ – i starší klíče z databáze („ABB|Swing L“ → „Swing / Swing L“). */
export function designSeriesOf(key: string | null | undefined): { brand: DesignBrand; series: DesignSeries } | null {
  const [manufacturer, name] = (key ?? "").split("|");
  const brand = designBrand(manufacturer);
  if (!brand || !name) return null;
  const series = brand.series.find((row) => row.name === name) ?? brand.series.find((row) => row.dbSeries.includes(name));
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
