// Domovní vypínače, zásuvky, kryty a rámečky (fáze 47) z externí databáze „ai-panel-builder“
// (catalog/wiring/<značka>/facts.json, ETIM parametry z distributora). Čisté funkce.

import { normalizeSearch } from "./catalog";

export interface ExternalWiringDevice {
  brand: string;
  article: string;
  ean?: string | null;
  title: string;
  series?: string | null;
  category: string;
  product_url?: string | null;
  features?: Record<string, unknown> | null;
  in_a?: number | null;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
}

export const WIRING_CATEGORIES: Record<string, string> = {
  WD_SWITCH: "Vypínače a přepínače",
  WD_SOCKET: "Zásuvky",
  WD_FRAME: "Rámečky",
  WD_COVER: "Kryty a klapky",
  WD_DATA: "Datové a TV zásuvky",
  WD_BLIND: "Žaluziové ovladače",
  WD_DIMMER: "Stmívače",
  WD_SENSOR: "Senzory a detektory",
  WD_THERMOSTAT: "Termostaty",
  WD_BELL: "Zvonková tlačítka",
  WD_LIGHT: "Orientační světla",
  WD_OTHER: "Ostatní",
};

const BRAND: Record<string, string> = { ABB: "ABB", SCHNEIDER: "Schneider", LEGRAND: "Legrand" };

export interface MappedWiringDevice {
  articleNumber: string;
  manufacturer: string;
  series: string;
  category: string;
  role: string | null;
  title: string;
  ean: string | null;
  color: string | null;
  frameUnits: number | null;
  ipRating: string | null;
  ratedCurrentA: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  productUrl: string | null;
  featuresJson: string;
  searchText: string;
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Záznam externí databáze → WiringDevice (unikátní klíč „ABB:2CKA…“). */
export function mapWiringDevice(raw: ExternalWiringDevice): MappedWiringDevice | null {
  if (!raw.article || !raw.title || !raw.category) return null;
  const manufacturer = BRAND[raw.brand.toUpperCase()] ?? raw.brand;
  const features = raw.features ?? {};
  const series = text(raw.series) ?? "Ostatní";
  return {
    articleNumber: `${raw.brand.toUpperCase()}:${raw.article}`,
    manufacturer,
    series,
    category: raw.category in WIRING_CATEGORIES ? raw.category : "WD_OTHER",
    role: text(features.wd_role),
    title: raw.title.slice(0, 200),
    ean: text(raw.ean),
    color: text(features.wd_color_etim),
    frameUnits: num(features.wd_frame_units),
    ipRating: text(features.wd_ip),
    ratedCurrentA: num(raw.in_a),
    widthMm: num(raw.width_mm),
    heightMm: num(raw.height_mm),
    depthMm: num(raw.depth_mm),
    productUrl: text(raw.product_url),
    featuresJson: JSON.stringify(features),
    searchText: normalizeSearch(`${manufacturer} ${series} ${raw.title} ${raw.article} ${WIRING_CATEGORIES[raw.category] ?? ""}`),
  };
}

/** Rámeček „1R“ … „6R“ podle počtu míst. */
export const frameLabel = (units: number | null) => (units ? `${units}R` : null);
