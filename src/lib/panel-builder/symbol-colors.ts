import type { PaletteItem } from "./floorplan-editor";

// Fáze 109: viditelnost schématických značek na plátně 2D půdorysu – silnější čáry (+35 %, na obrazovce aspoň 2,4 px),
// tmavý podkladový štítek pod značkou i popiskem a přepínač „🎨 Barva značek“: 🌈 dle typu (výchozí, syté barvy
// kategorií – žádná tmavá šedá), 🔴 červená pro závěrečnou kontrolu (ztlumí podklad), 🟡 neon žlutá, 🔵 cyan a vlastní
// barva. Volba platí pro plátno editoru (uloží se v prohlížeči); tiskový výkres a export zůstávají černobílé podle ČSN.

export type SymbolCategory = "socket" | "data" | "switch" | "control" | "light" | "panel" | "appliance" | "other";

/** Barvy kategorií – `dark` nad tmavým podkladem / CADem, `paper` nad bílým výkresem (dost tmavé pro kontrast). */
export const CATEGORY_COLORS: Record<SymbolCategory, { dark: string; paper: string; label: string }> = {
  socket: { dark: "#38bdf8", paper: "#0369a1", label: "Zásuvky" },
  data: { dark: "#a78bfa", paper: "#6d28d9", label: "Datové zásuvky" },
  switch: { dark: "#10b981", paper: "#047857", label: "Vypínače" },
  control: { dark: "#06b6d4", paper: "#0e7490", label: "Ovladače a čidla" },
  light: { dark: "#fde047", paper: "#a16207", label: "Svítidla" },
  panel: { dark: "#d946ef", paper: "#a21caf", label: "Rozváděče" },
  appliance: { dark: "#f43f5e", paper: "#be123c", label: "Spotřebiče" },
  other: { dark: "#e2e8f0", paper: "#334155", label: "Ostatní" },
};

/** Kategorie značky: vypínač řídící světla / žaluzie = vypínač, čidla, termostaty a panely bez párování = ovladač. */
export function symbolCategory(item: Pick<PaletteItem, "kind" | "control">): SymbolCategory {
  switch (item.kind) {
    case "single_socket":
    case "double_socket":
      return "socket";
    case "data_socket":
      return "data";
    case "switch":
      return item.control === "none" || item.control === "thermostat" ? "control" : "switch";
    case "light":
      return "light";
    case "panel":
      return "panel";
    case "appliance":
    case "blind_motor":
      return "appliance";
    default:
      return "other";
  }
}

export type SymbolColorMode = "type" | "red" | "yellow" | "cyan" | "custom";

export const SYMBOL_COLOR_MODES: readonly { id: SymbolColorMode; emoji: string; label: string; color: string | null }[] = [
  { id: "type", emoji: "🌈", label: "Dle typu (Výchozí kontrastní)", color: null },
  { id: "red", emoji: "🔴", label: "Červená (Kontrola)", color: "#ff2e2e" },
  { id: "yellow", emoji: "🟡", label: "Neon žlutá", color: "#facc15" },
  { id: "cyan", emoji: "🔵", label: "Jasně modrá / Cyan", color: "#00f0ff" },
  { id: "custom", emoji: "🎨", label: "Vlastní barva", color: null },
];

export interface SymbolColorSetting {
  mode: SymbolColorMode;
  /** Vlastní barva `#rrggbb` (input type="color"). */
  custom: string;
}

export const DEFAULT_SYMBOL_COLOR: SymbolColorSetting = { mode: "type", custom: "#ff2e2e" };
export const SYMBOL_COLOR_KEY = "eldock-floorplan-symbol-color";

const HEX = /^#[0-9a-f]{6}$/i;

/** Uložená volba z prohlížeče (`"red"`, `"custom:#ff8800"`); neplatná = výchozí. */
export function parseSymbolColor(raw: string | null | undefined): SymbolColorSetting {
  if (!raw) return DEFAULT_SYMBOL_COLOR;
  const [mode, custom] = raw.split(":");
  if (!SYMBOL_COLOR_MODES.some((entry) => entry.id === mode)) return DEFAULT_SYMBOL_COLOR;
  return { mode: mode as SymbolColorMode, custom: custom && HEX.test(custom) ? custom.toLowerCase() : DEFAULT_SYMBOL_COLOR.custom };
}

export const serializeSymbolColor = (setting: SymbolColorSetting) => (setting.mode === "custom" ? `custom:${setting.custom}` : setting.mode);

/** Jednotná barva všech značek, popisků a vazeb (kontrolní režimy), u „dle typu“ `null`. */
export function uniformColor(setting: SymbolColorSetting): string | null {
  if (setting.mode === "type") return null;
  if (setting.mode === "custom") return HEX.test(setting.custom) ? setting.custom : DEFAULT_SYMBOL_COLOR.custom;
  return SYMBOL_COLOR_MODES.find((entry) => entry.id === setting.mode)?.color ?? null;
}

/** Barva kresby značky na plátně. */
export function symbolInk(setting: SymbolColorSetting, item: Pick<PaletteItem, "kind" | "control">, onPaper: boolean): string {
  const uniform = uniformColor(setting);
  if (uniform) return uniform;
  const colors = CATEGORY_COLORS[symbolCategory(item)];
  return onPaper ? colors.paper : colors.dark;
}

/** Červená kontrola ztlumí podklad (výkres, místnosti, poznámky), aby žádná značka nezanikla. */
export const dimsUnderlay = (setting: SymbolColorSetting) => setting.mode === "red";
export const UNDERLAY_DIM_OPACITY = 0.42;

/** Zesílení čar značek na plátně a minimální tloušťka na obrazovce (2,2–2,8 px). */
export const SYMBOL_STROKE_FACTOR = 1.35;
export const MIN_SYMBOL_STROKE_PX = 2.4;
/** Tmavý podkladový štítek pod značkou a popiskem. */
export const SYMBOL_PLATE = "rgba(9, 13, 22, 0.92)";
export const SYMBOL_PLATE_PX = 4.5;

/** Tloušťka čáry značky v mm plánu: +35 % oproti tiskové, ale aspoň `MIN_SYMBOL_STROKE_PX` na obrazovce. */
export const canvasStroke = (size: number, mmPerScreenPx: number) => Math.max((size / 22) * SYMBOL_STROKE_FACTOR, MIN_SYMBOL_STROKE_PX * mmPerScreenPx);
