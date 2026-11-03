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
  { value: "Eaton", label: "Eaton", color: "#0057a6", mark: "E" },
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
  { value: "Dehn", label: "Dehn", color: "#e2001a", mark: "D" },
  { value: "Elko EP", label: "Elko EP", color: "#e4032e", mark: "EP" },
  { value: "Finder", label: "Finder", color: "#004f9f", mark: "F" },
  { value: "Relpol", label: "Relpol", color: "#d40f14", mark: "R" },
  { value: "Loxone", label: "Loxone", color: "#69c350", mark: "LX" },
  { value: "Shelly", label: "Shelly", color: "#4495d1", mark: "SH" },
  { value: "Eastron", label: "Eastron", color: "#1b3e8b", mark: "EA" },
  { value: "Wago", label: "Wago", color: "#6ec800", mark: "W" },
  { value: "Phoenix Contact", label: "Phoenix Contact", color: "#008cd2", mark: "PC" },
  { value: "Weidmüller", label: "Weidmüller", color: "#ef7d00", mark: "WM" },
  { value: "Pollmann", label: "Pollmann", color: "#00539f", mark: "P" },
  { value: "Mean Well", label: "Mean Well", color: "#0060a9", mark: "MW" },
  { value: "Pilz", label: "Pilz", color: "#f7a600", mark: "PZ" },
  { value: "Omron", label: "Omron", color: "#005eb8", mark: "O" },
];

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
