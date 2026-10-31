// Vizuální styl videa = styl aplikace: černé pozadí s jemnou mřížkou, jantarové akcenty,
// technická typografie. Video je čisté SVG/CSS generované kódem (žádné externí obrázky).

import { interpolate, spring } from "remotion";

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;
export const DURATION = 45 * FPS; // 1350 snímků

/** Rozpis scén (začátek a délka ve snímcích). */
export const SCENES = {
  problem: { from: 0, duration: 240 },
  qr: { from: 240, duration: 270 },
  redline: { from: 510, duration: 270 },
  diff: { from: 780, duration: 270 },
  finale: { from: 1050, duration: 300 },
} as const;

export const COLORS = {
  bg: "#09090b",
  panel: "#18181b",
  panelBorder: "#27272a",
  text: "#fafafa",
  muted: "#a1a1aa",
  amber: "#eab308",
  amberSoft: "rgba(234, 179, 8, 0.16)",
  red: "#ef4444",
  green: "#22c55e",
  sky: "#38bdf8",
} as const;

// V přehrávači na webu dědí Geist z aplikace, ve studiu / renderu systémové písmo. Záložní písma musí
// být uvnitř var() – nedefinovaná proměnná by jinak zneplatnila celou deklaraci (patkové písmo).
export const FONT = "var(--font-sans, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif)";
export const MONO = "var(--font-geist-mono, 'Cascadia Mono', Consolas, 'Courier New', monospace)";

/** Pružný nástup od snímku `start` (0 → 1). */
export const pop = (frame: number, start: number, fps = FPS, damping = 14) => spring({ frame: frame - start, fps, config: { damping, mass: 0.7 } });

/** Lineární průběh mezi snímky (ořezaný na 0–1). */
export const progress = (frame: number, start: number, end: number) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** Plynulé prolnutí scény na začátku a konci (kvůli navazování scén). */
export const sceneFade = (frame: number, duration: number, edge = 12) =>
  interpolate(frame, [0, edge, duration - edge, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

/** SVG řetězec → data URI pro <Img>. */
export const svgUri = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
