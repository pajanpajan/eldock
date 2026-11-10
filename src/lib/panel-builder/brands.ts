// Výrobci přístrojů v kaskádovém menu (fáze 43, krok A): karty s barevným odznakem značky a
// hledáním. Hodnota = název výrobce v katalogu (párování přes `sameManufacturer`).

import { normalizeManufacturer, normalizeSearch } from "./catalog";

export interface Brand {
  value: string;
  label: string;
  /** Barva odznaku (logo se kreslí kódem – žádné externí obrázky). */
  color: string;
  /** Zkratka do odznaku. */
  mark: string;
}

export const DEVICE_BRANDS: readonly Brand[] = [
  { value: "ABB", label: "ABB", color: "#e30613", mark: "ABB" },
  { value: "Eaton", label: "Eaton", color: "#005eb8", mark: "E" },
  { value: "OEZ", label: "OEZ", color: "#009fe3", mark: "OEZ" },
  { value: "Schneider", label: "Schneider Electric", color: "#3dcd58", mark: "SE" },
  { value: "Hager", label: "Hager", color: "#00468b", mark: "H" },
  { value: "Noark", label: "Noark", color: "#d71920", mark: "N" },
  { value: "Bonega", label: "Bonega", color: "#f39200", mark: "B" },
  { value: "Schrack", label: "Schrack", color: "#c8102e", mark: "S" },
  { value: "Siemens", label: "Siemens", color: "#009999", mark: "SI" },
  { value: "ETI", label: "ETI", color: "#e2001a", mark: "ETI" },
  { value: "SEZ", label: "SEZ", color: "#004b93", mark: "SEZ" },
  { value: "Saltek", label: "Saltek", color: "#e30613", mark: "SAL" },
  { value: "Hakel", label: "Hakel", color: "#1c63b7", mark: "HK" },
  { value: "Legrand", label: "Legrand", color: "#e2231a", mark: "L" },
  { value: "Loxone", label: "Loxone", color: "#69c350", mark: "LX" },
  // Fáze 81: TapHome – Core a moduly na DIN lištu (logo public/brands/taphome.svg)
  { value: "TapHome", label: "TapHome", color: "#1f2937", mark: "TH" },
  { value: "Eastron", label: "Eastron", color: "#1b3e8b", mark: "EA" },
  { value: "Wago", label: "Wago", color: "#6ec800", mark: "W" },
  { value: "Phoenix Contact", label: "Phoenix Contact", color: "#008cd2", mark: "PC" },
  { value: "Omron", label: "Omron", color: "#005eb8", mark: "O" },
  { value: "Hensel", label: "Hensel", color: "#005ca9", mark: "HE" },
  { value: "Rittal", label: "Rittal", color: "#e2001a", mark: "R" },
];

/**
 * Značky vyřazené z AI Panel Builderu (fáze 47): skryté v konfigurátoru, katalogu, filtrech, AI párování
 * i importu. Řádky v databázi zůstávají (vazby starších projektů), jen se nenabízejí.
 */
export const HIDDEN_MANUFACTURERS = ["Finder", "Shelly", "Mean Well", "Dehn", "Relpol", "Pilz", "Weidmüller", "Elko EP", "Pollmann", "Orno", "Pollock", "Lovato"] as const;

/** Varianty zápisu skrytých značek v databázi (seed, externí import, AI). */
export const HIDDEN_MANUFACTURER_NAMES: string[] = [...HIDDEN_MANUFACTURERS, "FINDER", "SHELLY", "MEANWELL", "MEAN WELL", "MeanWell", "DEHN", "RELPOL", "PILZ", "WEIDMULLER", "Weidmuller", "ELKOEP", "ELKO EP", "Elko", "POLLMANN", "ORNO", "POLLOCK", "LOVATO", "Lovato Electric"];

const hiddenNormalized = new Set(HIDDEN_MANUFACTURERS.map((name) => normalizeSearch(name).replace(/[^a-z]/g, "")));
/** Je výrobce vyřazený? („Elko EP“, „ELKOEP“, „elko ep“ …) */
export const isHiddenManufacturer = (name: string | null | undefined) => {
  const key = normalizeSearch(name ?? "").replace(/[^a-z]/g, "");
  return !!key && (hiddenNormalized.has(key) || key === "elko" || key === "weidmuller" || key === "lovatoelectric");
};

/**
 * Výrobci samotných ventilátorů skříní (fáze 51): v rozcestníku katalogu ani v konfigurátoru nejsou,
 * nabízí je jen výběr ventilátoru v kroku 4 (Oteplení).
 */
export const FAN_ONLY_MANUFACTURERS = ["Pfannenberg", "STEGO"] as const;
export const isFanOnlyManufacturer = (name: string | null | undefined) => FAN_ONLY_MANUFACTURERS.some((brand) => normalizeSearch(brand) === normalizeSearch(name ?? "").trim());

/** Podmínka Prismy: jen nabízení výrobci (`where: { ...visibleManufacturers }`). */
export const visibleManufacturers = { manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } };


/** Karta značky podle názvu z katalogu (null = mimo seznam). */
export const brandOf = (manufacturer: string | null | undefined) => {
  const name = normalizeManufacturer(manufacturer);
  return name ? (DEVICE_BRANDS.find((brand) => normalizeManufacturer(brand.value) === name) ?? null) : null;
};

/** Hledání výrobce podle názvu (bez diakritiky, i uprostřed slova). */
export function filterBrands(brands: readonly Brand[], query: string): Brand[] {
  const q = normalizeSearch(query).trim();
  return q ? brands.filter((brand) => normalizeSearch(`${brand.label} ${brand.value}`).includes(q)) : [...brands];
}
