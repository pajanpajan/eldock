// Fáze 61–63 / 74: vzhled designové řady pro náhledy – tvar rámečku, styl řady (Levit, Zoni, Tango, Time …), barvy
// rámečku a krytu a povrch. Sdílí ho kreslený náhled v galerii (`DeviceMockup`) i generátor renderů do
// `public/catalog-images/` (fáze 80, `series-render.ts`). Čisté funkce.

import type { SeriesColor, SeriesMaterial, SeriesShape } from "./abb-catalog-2026";
import { designSeriesOf } from "./wiring-designs";

export type Look = { frame: string; insert: string; material: SeriesMaterial };
export const SHAPE: Record<SeriesShape, { radius: number; border: number; insetRadius: number }> = {
  thin: { radius: 12, border: 9, insetRadius: 6 },
  rounded: { radius: 28, border: 12, insetRadius: 18 },
  layered: { radius: 8, border: 14, insetRadius: 4 },
  metal: { radius: 8, border: 12, insetRadius: 4 },
  wood: { radius: 9, border: 16, insetRadius: 4 },
  square: { radius: 5, border: 12, insetRadius: 3 },
  soft: { radius: 18, border: 13, insetRadius: 10 },
  classic: { radius: 4, border: 16, insetRadius: 3 },
  porcelain: { radius: 46, border: 12, insetRadius: 40 },
  flat: { radius: 3, border: 8, insetRadius: 2 },
  solo: { radius: 34, border: 11, insetRadius: 24 },
  thick: { radius: 7, border: 18, insetRadius: 4 },
  surface: { radius: 16, border: 10, insetRadius: 10 },
};

export function lookOf(color: Pick<SeriesColor, "swatch" | "frame" | "insert" | "material"> | null | undefined, shape: SeriesShape): Look {
  const swatch = color?.swatch ?? "#f8fafc";
  return { frame: color?.frame ?? swatch, insert: color?.insert ?? swatch, material: color?.material ?? (shape === "porcelain" ? "porcelain" : shape === "wood" ? "wood" : shape === "metal" ? "metal" : "gloss") };
}

/** Světlost barvy (0–1) – tmavé provedení dostane světlejší kresbu otvorů a klapky. */
export function lightness(hex: string) {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(value)) return 1;
  return (((value >> 16) & 255) * 0.299 + ((value >> 8) & 255) * 0.587 + (value & 255) * 0.114) / 255;
}

/**
 * Fáze 63: věrný tvar řady pro náhled – zaoblení a šířka rámečku, tvar kolébky a typické prvky řady: Levit (ostrý
 * čtverec na barevné podložce viditelné v horní a spodní spáře, vodorovný proužek indikace), Zoni (plochý matný rámeček
 * s tenkým okrajem, dvoubarevně barevný rámeček a bílá klapka), Tango (vypouklý zaoblený rámeček a kolébka s vodorovným
 * průzorem doutnavky), Time / Time Arbo (rovný rámeček s tenkou kovovou linkou kolem klapky, dřevo a kovová klapka),
 * Decento (kulatý porcelánový rámeček s páčkou a kulatou zásuvkou), Céliane (obdélník s kruhovým výřezem a kruhovou
 * klapkou), Schneider Nová Unica / Sedna / Asfora a další řady podle tvaru.
 */
export interface MockStyle {
  radius: number;
  border: number;
  insetRadius: number;
  rocker: "flat" | "rounded" | "lever" | "circle";
  /** Levit: barevná podložka v horní a spodní spáře + proužek indikace. */
  base?: boolean;
  /** Tango: vypouklý rámeček a průzor doutnavky. */
  convex?: boolean;
  lamp?: boolean;
  /** Time: tenká kovová linka kolem klapky. */
  metalLine?: boolean;
  /** Decento: kulatý rámeček (1R kruh, víceramček ovál). */
  round?: boolean;
  /** Céliane: kruhový výřez s kruhovou klapkou. */
  circle?: boolean;
  /** Fáze 90: nástěnný monoblok – zaoblený (Garant), hranatý (Praktik), robustní průmyslový (Variant+). */
  monoblock?: "rounded" | "square" | "industrial";
}

const SERIES_STYLE: Record<string, MockStyle> = {
  "ABB|Levit": { radius: 3, border: 14, insetRadius: 2, rocker: "flat", base: true },
  "ABB|Levit M": { radius: 3, border: 15, insetRadius: 2, rocker: "flat", base: true },
  "ABB|Zoni": { radius: 9, border: 9, insetRadius: 6, rocker: "flat" },
  // Fáze 74: Tango – měkký čtverec (ne „pilulka“ u víceramečku), běžný spínač bez průzoru doutnavky
  "ABB|Tango": { radius: 17, border: 13, insetRadius: 11, rocker: "rounded", convex: true },
  "ABB|Time": { radius: 6, border: 15, insetRadius: 3, rocker: "flat", metalLine: true },
  "ABB|Time Arbo": { radius: 6, border: 17, insetRadius: 3, rocker: "flat", metalLine: true },
  "ABB|Decento": { radius: 46, border: 15, insetRadius: 30, rocker: "lever", round: true },
  // Fáze 90: nástěnné monobloky s horní kabelovou vývodkou a odklápěcím víčkem zásuvky
  "ABB|Garant (IP44)": { radius: 24, border: 10, insetRadius: 16, rocker: "rounded", monoblock: "rounded" },
  "ABB|Praktik (IP44)": { radius: 5, border: 10, insetRadius: 4, rocker: "flat", monoblock: "square" },
  "ABB|Variant+ (IP54)": { radius: 11, border: 13, insetRadius: 6, rocker: "flat", monoblock: "industrial" },
  "ABB|Swing": { radius: 13, border: 13, insetRadius: 8, rocker: "rounded" },
  "ABB|Swing L": { radius: 13, border: 11, insetRadius: 8, rocker: "rounded" },
  "ABB|Classic": { radius: 4, border: 16, insetRadius: 3, rocker: "flat" },
  "ABB|future linear": { radius: 3, border: 8, insetRadius: 2, rocker: "flat" },
  "ABB|solo": { radius: 22, border: 11, insetRadius: 14, rocker: "rounded" },
  "ABB|solo carat": { radius: 20, border: 12, insetRadius: 13, rocker: "rounded" },
  "ABB|Busch-axcent": { radius: 7, border: 19, insetRadius: 4, rocker: "flat" },
  "Legrand|Céliane": { radius: 10, border: 11, insetRadius: 8, rocker: "circle", circle: true },
  "Legrand|Valena Life": { radius: 16, border: 12, insetRadius: 10, rocker: "rounded" },
  "Legrand|Valena Allure": { radius: 7, border: 13, insetRadius: 5, rocker: "flat" },
  "Legrand|Niloé": { radius: 20, border: 12, insetRadius: 12, rocker: "rounded" },
  "Legrand|Mosaic": { radius: 3, border: 10, insetRadius: 2, rocker: "flat" },
  "Schneider|Nová Unica": { radius: 11, border: 13, insetRadius: 7, rocker: "flat" },
  "Schneider|Sedna Design & Elements": { radius: 15, border: 9, insetRadius: 10, rocker: "rounded" },
  "Schneider|Asfora": { radius: 6, border: 11, insetRadius: 5, rocker: "flat" },
  "Hager|lumina": { radius: 12, border: 12, insetRadius: 8, rocker: "flat" },
  "Hager|berker S.1 / B.3 / Q.1 / Q.3": { radius: 5, border: 13, insetRadius: 4, rocker: "flat" },
};

/**
 * Fáze 90: obrys víceramečku Decento – spojené kruhy s vykrojeným pasem (tvar piškotu / osmičky), ne obdélník se
 * zaoblenými rohy. `count` kruhů o poloměru `r` po `pitch` se středy na ose y = `cy` (první v x = pitch / 2); kruh se
 * napojí na pas pod úhlem `theta` [°], pas je vysoký `waist` × poloměr. Jeden kruh = celý kruh.
 */
export function decentoFramePath(count: number, r = 44, pitch = 100, cy = 50, theta = 50, waist = 0.55): string {
  const f = (value: number) => Math.round(value * 10) / 10;
  const cx = (index: number) => pitch / 2 + index * pitch;
  if (count <= 1) return `M${f(cx(0) - r)} ${f(cy)} A${r} ${r} 0 1 1 ${f(cx(0) + r)} ${f(cy)} A${r} ${r} 0 1 1 ${f(cx(0) - r)} ${f(cy)} Z`;
  const rad = (theta * Math.PI) / 180;
  const dx = r * Math.cos(rad);
  const dy = r * Math.sin(rad);
  const h = r * waist;
  // Řídicí bod kvadratické křivky pasu: vrchol křivky leží ve výšce h od osy
  const top = cy - 2 * h + dy;
  const bottom = cy + 2 * h - dy;
  const arcTo = (large: 0 | 1, x: number, y: number) => `A${r} ${r} 0 ${large} 1 ${f(x)} ${f(y)}`;
  const parts = [`M${f(cx(0) - r)} ${f(cy)}`, arcTo(0, cx(0) + dx, cy - dy)];
  for (let index = 1; index < count; index++) {
    parts.push(`Q${f(cx(index) - pitch / 2)} ${f(top)} ${f(cx(index) - dx)} ${f(cy - dy)}`);
    parts.push(index < count - 1 ? arcTo(0, cx(index) + dx, cy - dy) : arcTo(1, cx(index) - dx, cy + dy));
  }
  for (let index = count - 2; index >= 0; index--) {
    parts.push(`Q${f(cx(index) + pitch / 2)} ${f(bottom)} ${f(cx(index) + dx)} ${f(cy + dy)}`);
    parts.push(index > 0 ? arcTo(0, cx(index) - dx, cy + dy) : arcTo(0, cx(0) - r, cy));
  }
  return `${parts.join(" ")} Z`;
}

/** Styl náhledu řady (podle klíče řady, jinak podle tvaru). */
export function mockStyle(seriesKey: string | null | undefined, shape: SeriesShape): MockStyle {
  const found = seriesKey ? designSeriesOf(seriesKey) : null;
  const key = found ? `${found.brand.manufacturer}|${found.series.name}` : "";
  if (SERIES_STYLE[key]) return SERIES_STYLE[key];
  const geometry = SHAPE[shape];
  return { radius: geometry.radius, border: geometry.border, insetRadius: geometry.insetRadius, rocker: shape === "rounded" || shape === "soft" || shape === "solo" ? "rounded" : "flat", round: shape === "porcelain" };
}
