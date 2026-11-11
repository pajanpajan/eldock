// Fáze 80: produktové náhledy designových řad jako vlastní vektorové rendery (SVG) – studiové pozadí, měkký stín pod
// rámečkem, plastický rámeček a klapka s odlesky podle povrchu, tvar a typické prvky řady ze `series-look.ts` a skutečné
// barvy rámečku a krytu z Katalogu ABB 2026 (`abb-catalog-2026.ts`). Soubory generuje `npm run catalog:renders` do
// `public/catalog-images/abb/<řada>/<barva>-<díl>.svg` – žádné fotografie výrobce. Čisté funkce (stejný vstup = stejný
// soubor; test hlídá, že soubory odpovídají kódu).
// Fáze 91: jeden kreslicí engine pro soubory i živý náhled v galerii (`DeviceMockup` – id s předponou, aby se náhledy na
// stránce nepletly) pro všechny řady ABB: Decento jako samostatné kulaté porcelánové / dřevěné přístroje (Ø 87 mm po 91 mm)
// s odleskem glazury, úzkou retro páčkou a zásuvkou s hlubokou dutinou, kovovým zemnicím kolíkem, zdířkami L / N
// a středovým šroubkem; nástěnné Garant (oblý, kouřové víčko u šedé), Praktik (hranatý, velká kolébka) a Variant+ (dvoubarevné
// tělo se zkosenými hranami, pružinový pant víčka, boční žebrování, ABB / IP54); Busch-axcent s vnitřním nosným rámečkem
// a texturou materiálu (sklo s diagonálním odleskem, zrnitý beton, vrstvená břidlice, lisovaný papír, kartáčovaný kov);
// Zoni s plochým prolisem, Tango vypouklé, Time s kovovými lištami nad a pod klapkou, solo s lištami rámečku.

import type { SeriesColor, SeriesMaterial, SeriesShape } from "./abb-catalog-2026";
import { catalogSlug } from "./catalog-images";
import { decentoCircles, lightness, lookOf, mockStyle, type Look, type LookColor, type MockStyle } from "./series-look";
import type { SeriesPhotoPart } from "./series-photos";
import { designSeriesOf, resolveFrameColor } from "./wiring-designs";

/**
 * Řady ABB s renderem do souborů (fáze 80); ostatní řady kreslí galerie živě stejným enginem (`renderDeviceSvg`) – vypadají
 * stejně, jen bez souboru v repozitáři.
 */
export const RENDER_SERIES = ["ABB|Zoni", "ABB|Tango", "ABB|Levit", "ABB|Levit M", "ABB|Time", "ABB|future linear"] as const;
export const RENDER_PARTS: readonly SeriesPhotoPart[] = ["switch", "socket", "set"];
/** Zdroj a podmínky užití (zapisují se do `zdroj.json` složky řady a galerie je vypíše pod náhledem). */
export const RENDER_SOURCE = { source: "Eldock – vektorový render podle Katalogu ABB 2026 (tvar řady a barvy)", license: "vlastní dílo Eldock, bez fotografií výrobce" } as const;

export type RenderGang = "switch" | "socket" | "double" | "blank";

const U = 2; // měřítko proti náhledu v galerii (100 jednotek na pozici → 200 px)
const GANG = 100 * U;
const MARGIN = 64;
const HEIGHT = GANG + MARGIN * 2;

type Box = { x: number; y: number; w: number; h: number; rx: number };
const n = (value: number) => String(Math.round(value * 10) / 10);
const rect = (box: Box, extra: string) => `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" rx="${n(box.rx)}" ${extra}/>`;
const circle = (cx: number, cy: number, r: number, extra: string) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${extra}/>`;
const grow = (box: Box, by: number, rx = box.rx + by): Box => ({ x: box.x - by, y: box.y - by, w: box.w + by * 2, h: box.h + by * 2, rx: Math.max(0, rx) });

/** Barva posunutá ke světlé (> 0) / tmavé (< 0). */
function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(value)) return hex;
  const channel = (offset: number) => {
    const c = (value >> offset) & 255;
    return Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("")}`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface Ctx {
  /** Předpona id (živý náhled – víc náhledů na stránce); soubory bez předpony. */
  p: string;
  look: Look;
  style: MockStyle;
}
const url = (ctx: Ctx, name: string) => `url(#${ctx.p}${name})`;

function defs(ctx: Ctx): string {
  const { p, look } = ctx;
  const dark = lightness(look.frame) < 0.4;
  return [
    "<defs>",
    // Studiové pozadí: světlá stěna s měkkým bodovým světlem shora
    `<linearGradient id="${p}bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fafaf9"/><stop offset="1" stop-color="#e7e5e2"/></linearGradient>`,
    `<radialGradient id="${p}spot" cx="0.5" cy="0.28" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>`,
    // Stíny: široký měkký a kontaktní u stěny
    `<filter id="${p}soft" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="14"/></filter>`,
    `<filter id="${p}contact" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="3.5"/></filter>`,
    `<filter id="${p}lip" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="1.6"/></filter>`,
    // Plastika rámečku a klapky: světlo shora, stín dole
    `<linearGradient id="${p}relief" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.38" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="0.7" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/></linearGradient>`,
    `<linearGradient id="${p}edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${dark ? 0.35 : 0.85}"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${dark ? 0.55 : 0.28}"/></linearGradient>`,
    `<linearGradient id="${p}rocker" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="0.52" stop-color="#000000" stop-opacity="0.03"/><stop offset="1" stop-color="#000000" stop-opacity="0.16"/></linearGradient>`,
    // Povrchy
    `<linearGradient id="${p}gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.32" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="0.34" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="1" stop-color="#000000" stop-opacity="0.08"/></linearGradient>`,
    // Sklo: hluboký lesk s ostrým diagonálním odleskem
    `<linearGradient id="${p}glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.24" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="0.25" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.31" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.32" stop-color="#ffffff" stop-opacity="0.05"/><stop offset="0.6" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="1" stop-color="#000000" stop-opacity="0.24"/></linearGradient>`,
    `<linearGradient id="${p}metal" x1="0" y1="0" x2="1" y2="0">${[0, 0.15, 0.32, 0.5, 0.68, 0.85, 1].map((offset, index) => `<stop offset="${offset}" stop-color="${index % 2 ? "#ffffff" : "#000000"}" stop-opacity="${index % 2 ? 0.32 : 0.14}"/>`).join("")}</linearGradient>`,
    `<pattern id="${p}brushed" width="6" height="3" patternUnits="userSpaceOnUse"><path d="M0 1.5 H6" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.6"/></pattern>`,
    `<radialGradient id="${p}soft-touch" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="1" stop-color="#000000" stop-opacity="0.1"/></radialGradient>`,
    // Skutečné materiály rámečku: zrnitý beton, vrstvená břidlice, lisovaný papír, dřevo
    `<filter id="${p}grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise"/><feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 -0.12"/></filter>`,
    `<pattern id="${p}pores" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1.1" fill="#000000" fill-opacity="0.22"/><circle cx="12" cy="9" r="0.8" fill="#000000" fill-opacity="0.18"/><circle cx="7" cy="15" r="1.3" fill="#000000" fill-opacity="0.14"/><circle cx="15" cy="2" r="0.6" fill="#ffffff" fill-opacity="0.3"/></pattern>`,
    `<pattern id="${p}slate" width="220" height="26" patternUnits="userSpaceOnUse"><path d="M0 5 C50 2 120 9 220 4" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2.2"/><path d="M0 13 C70 16 140 10 220 14" fill="none" stroke="#000000" stroke-opacity="0.22" stroke-width="3.2"/><path d="M0 21 C60 19 150 24 220 20" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1.6"/></pattern>`,
    `<pattern id="${p}paper" width="14" height="10" patternUnits="userSpaceOnUse"><path d="M0 2 L9 3.5 M3 7 L13 6 M1 9.5 L6 8.6" stroke="#000000" stroke-opacity="0.16" stroke-width="0.7"/><path d="M5 1 L12 2.2" stroke="#ffffff" stroke-opacity="0.14" stroke-width="0.6"/></pattern>`,
    `<pattern id="${p}wood" width="80" height="22" patternUnits="userSpaceOnUse"><path d="M0 5 C20 1 40 9 80 4 M0 13 C24 10 52 17 80 12 M0 19 C30 17 50 22 80 18" fill="none" stroke="#000000" stroke-opacity="0.24" stroke-width="1.4"/><path d="M0 9 C26 6 46 12 80 8" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/></pattern>`,
    // Porcelán: glazura s měkkým světlem
    `<radialGradient id="${p}porcelain" cx="0.34" cy="0.28" r="0.85"><stop offset="0" stop-color="#ffffff" stop-opacity="0.75"/><stop offset="0.45" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/></radialGradient>`,
    // Zásuvka: hluboká kruhová jamka a kovový ochranný kolík
    `<radialGradient id="${p}well" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#000000" stop-opacity="0.04"/><stop offset="0.75" stop-color="#000000" stop-opacity="0.14"/><stop offset="1" stop-color="#000000" stop-opacity="0.34"/></radialGradient>`,
    `<radialGradient id="${p}cavity" cx="0.5" cy="0.36" r="0.62"><stop offset="0" stop-color="#000000" stop-opacity="0.08"/><stop offset="0.6" stop-color="#000000" stop-opacity="0.22"/><stop offset="1" stop-color="#000000" stop-opacity="0.55"/></radialGradient>`,
    `<linearGradient id="${p}pin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b8f96"/><stop offset="0.45" stop-color="#f1f3f5"/><stop offset="1" stop-color="#6b7078"/></linearGradient>`,
    `<linearGradient id="${p}chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f5"/><stop offset="0.5" stop-color="#9ca3af"/><stop offset="1" stop-color="#e4e4e7"/></linearGradient>`,
    `<radialGradient id="${p}convex" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="0.65" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></radialGradient>`,
    // Kouřové (průhledné) víčko zásuvky nástěnného přístroje
    `<linearGradient id="${p}smoke" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#52525b" stop-opacity="0.55"/><stop offset="1" stop-color="#18181b" stop-opacity="0.72"/></linearGradient>`,
    "</defs>",
  ].join("");
}

/** Povrch přes tvar (box) podle materiálu a textury. */
function surface(ctx: Ctx, box: Box, material: SeriesMaterial, texture?: Look["texture"]): string {
  const layer = (fill: string, extra = "") => rect(box, `fill="${fill}" ${extra}`);
  switch (material) {
    case "gloss":
    case "porcelain":
      return layer(url(ctx, "gloss"));
    case "glass":
      return layer(url(ctx, "glass"));
    case "metal":
      return layer(url(ctx, "metal")) + layer(url(ctx, "brushed"));
    case "wood":
      return layer(url(ctx, "wood")) + layer(url(ctx, "gloss"), 'opacity="0.45"');
    case "stone":
      if (texture === "slate") return layer(url(ctx, "slate")) + layer("#000000", `opacity="0.35" filter="${url(ctx, "grain")}"`) + layer(url(ctx, "soft-touch"));
      return layer(url(ctx, "pores")) + layer("#000000", `opacity="0.5" filter="${url(ctx, "grain")}"`) + layer(url(ctx, "soft-touch"));
    case "paper":
      return layer(url(ctx, "paper")) + layer("#000000", `opacity="0.3" filter="${url(ctx, "grain")}"`) + layer(url(ctx, "soft-touch"));
    case "softtouch":
    case "matte":
      return layer(url(ctx, "soft-touch"));
  }
}

/** Zásuvka 230 V (typ E – ČSN): jamka, zdířky L / N a ochranný kolík nahoře. */
function socketParts(ctx: Ctx, cx: number, cy: number, r: number, insert: string): string {
  const dark = lightness(insert) < 0.45;
  const ring = dark ? shade(insert, 0.22) : shade(insert, -0.12);
  const parts = [
    circle(cx, cy, r + 3, `fill="${ring}" opacity="0.65"`),
    circle(cx, cy, r, `fill="${shade(insert, dark ? 0.05 : -0.04)}"`),
    circle(cx, cy, r, `fill="${url(ctx, "well")}"`),
  ];
  for (const dx of [-0.39, 0.39]) {
    parts.push(circle(cx + r * dx, cy + 2, r * 0.14, 'fill="#0b0b0c"'));
    parts.push(circle(cx + r * dx, cy + 2 - r * 0.04, r * 0.14, `fill="none" stroke="#ffffff" stroke-opacity="${dark ? 0.18 : 0.35}" stroke-width="1"`));
  }
  const pin = { x: cx - 4.5, y: cy - r + 4, w: 9, h: r * 0.42, rx: 4.5 };
  parts.push(rect(pin, `fill="${url(ctx, "pin")}"`), rect(pin, 'fill="none" stroke="#000000" stroke-opacity="0.25" stroke-width="0.8"'));
  return parts.join("");
}

/** Jedna pozice obdélníkového rámečku: klapka spínače nebo zásuvka (dvojzásuvka = dvě menší pod sebou). */
function gang(ctx: Ctx, kind: RenderGang, index: number, top: number): string {
  const { look, style } = ctx;
  if (kind === "blank") return "";
  const left = MARGIN + index * GANG;
  const inset = Math.min(27, Math.max(14, 7 + style.border)) * U;
  const cover: Box = { x: left + inset, y: top + inset, w: GANG - inset * 2, h: GANG - inset * 2, rx: (style.rocker === "rounded" ? 14 : style.insetRadius) * U };
  const dark = lightness(look.insert) < 0.45;
  const cx = left + GANG / 2;
  const cy = top + GANG / 2;
  const parts: string[] = [`<g data-part="${kind === "double" ? "socket" : kind}">`];
  if (style.circle) {
    // Céliane: kruhový výřez v rámečku, uvnitř kruhová klapka / zásuvka
    parts.push(circle(cx, cy, 58, 'fill="#000000" opacity="0.18"'), circle(cx, cy, 54, `fill="${look.insert}" stroke="#000000" stroke-opacity="0.15" stroke-width="1.4"`));
    if (kind === "switch") parts.push(circle(cx, cy, 44, 'fill="none" stroke="#52525b" stroke-opacity="0.3" stroke-width="1.4"'), rect({ x: cx - 10, y: cy - 38, w: 20, h: 4.4, rx: 2.2 }, 'fill="#f59e0b" opacity="0.85"'));
    else parts.push(socketParts(ctx, cx, cy, 36, look.insert));
    parts.push("</g>");
    return parts.join("");
  }
  if (style.recess) {
    // Zoni: plochý sametový prolis kolem klapky
    const recess = grow(cover, 4 * U);
    parts.push(rect(recess, `fill="${shade(look.frame, lightness(look.frame) > 0.5 ? -0.07 : 0.1)}"`), rect(recess, 'fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="1.2"'), rect({ ...recess, y: recess.y + 1.5 }, 'fill="none" stroke="#000000" stroke-opacity="0.12" stroke-width="2" filter="' + url(ctx, "lip") + '" data-part="recess"'));
  }
  if (style.carrier) {
    // Busch-axcent: tenký nosný rámeček v barvě krytu (studio bílý / černý) kolem čtvercové klapky
    const carrier = grow(cover, 5 * U, 2);
    parts.push(rect({ ...carrier, y: carrier.y + 2 }, `fill="#000000" opacity="0.3" filter="${url(ctx, "lip")}"`), rect(carrier, `fill="${dark ? "#18181b" : "#f4f4f2"}" data-part="carrier"`), rect(carrier, `fill="${url(ctx, "relief")}"`));
  }
  if (style.strips) {
    // Time: kovové vodorovné lišty nad a pod klapkou
    for (const y of [cover.y - 9 * U, cover.y + cover.h + 5 * U]) {
      const strip = { x: cover.x, y, w: cover.w, h: 4 * U, rx: 2 * U };
      parts.push(rect(strip, `fill="${url(ctx, "chrome")}" data-part="strip"`), rect(strip, 'fill="none" stroke="#71717a" stroke-opacity="0.6" stroke-width="1"'));
    }
  }
  // Klapka vrhá drobný stín do rámečku (spára) a má vlastní plastiku
  parts.push(rect({ ...cover, y: cover.y + 2.5 }, `fill="#000000" opacity="0.28" filter="${url(ctx, "lip")}"`));
  parts.push(rect(cover, `fill="${look.insert}"`));
  // solo: kov patří lištám rámečku, klapka je lesklá; dřevo / kámen / papír jen na rámečku
  parts.push(surface(ctx, cover, style.bars || look.material === "wood" || look.material === "stone" || look.material === "paper" ? "gloss" : look.material));
  if (kind === "switch") {
    parts.push(rect(cover, `fill="${url(ctx, "rocker")}"`));
    if (style.convex) parts.push(rect(grow(cover, -3 * U), `fill="${url(ctx, "convex")}"`));
    if (style.base) {
      // Levit: vodorovný proužek indikace u spodní hrany klapky
      parts.push(rect({ x: cover.x + 20, y: cover.y + cover.h - 18, w: cover.w - 40, h: 4, rx: 2 }, `fill="${dark ? "#d4d4d8" : "#52525b"}" opacity="0.55"`));
    } else {
      parts.push(rect({ x: cover.x + 12, y: cover.y + cover.h - 10, w: cover.w - 24, h: 2, rx: 1 }, `fill="${dark ? "#ffffff" : "#000000"}" opacity="${dark ? 0.12 : 0.14}"`));
    }
  } else if (kind === "double") {
    const r = Math.min(cover.w, cover.h) * 0.22;
    parts.push(socketParts(ctx, cx, cy - r * 1.15, r, look.insert), socketParts(ctx, cx, cy + r * 1.15, r, look.insert));
  } else {
    // Jamka zásuvky ≈ 36 % klapky (Ø 39 mm na krytu ~ 55 mm)
    parts.push(socketParts(ctx, cx, cy, Math.min(cover.w, cover.h) * 0.36, look.insert));
  }
  parts.push(rect(cover, `fill="none" stroke="${url(ctx, "edge")}" stroke-width="1.4"`));
  parts.push(rect(cover, 'fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="0.8"'));
  parts.push("</g>");
  return parts.join("");
}

/** Obdélníkový rámeček (1R–5R) s přístroji. */
function framed(ctx: Ctx, items: readonly RenderGang[]): string {
  const { look, style } = ctx;
  const frame: Box = { x: MARGIN + 12, y: MARGIN + 12, w: items.length * GANG - 24, h: GANG - 24, rx: style.radius * U };
  const frameMaterial = look.frameMaterial ?? look.material;
  const body: string[] = [
    // Stín na stěně: široký měkký posunutý dolů a kontaktní těsně kolem rámečku
    rect({ ...frame, x: frame.x + 6, y: frame.y + 18, w: frame.w - 12 }, `fill="#000000" opacity="0.2" filter="${url(ctx, "soft")}"`),
    rect({ ...frame, y: frame.y + 3 }, `fill="#000000" opacity="0.3" filter="${url(ctx, "contact")}"`),
  ];
  if (style.base) {
    // Levit / Levit M: podložka v barvě krytu vyčnívá v horní a spodní spáře
    const base = { x: frame.x + 6, y: frame.y - 7, w: frame.w - 12, h: frame.h + 14, rx: 3 };
    body.push(rect(base, `fill="${look.insert}" data-part="base"`), rect(base, `fill="${url(ctx, "relief")}"`));
  }
  // solo: tělo rámečku v barvě krytu, kovové / barevné lišty nahoře a dole
  body.push(rect(frame, `fill="${style.bars && look.frame !== look.insert ? look.insert : look.frame}"`));
  body.push(surface(ctx, frame, style.bars ? "gloss" : frameMaterial, look.texture));
  if (style.bars) {
    const clip = `${ctx.p}bars`;
    body.push(`<clipPath id="${clip}">${rect(frame, "")}</clipPath>`);
    for (const y of [frame.y, frame.y + frame.h - 13 * U]) {
      const bar = { x: frame.x, y, w: frame.w, h: 13 * U, rx: 0 };
      // Chromová lišta (světle šedý rámeček) leskem chromu, barevná lišta s kovovým odleskem
      const chrome = lightness(look.frame) > 0.8 && look.frame !== look.insert;
      body.push(`<g clip-path="url(#${clip})">${rect(bar, `fill="${chrome ? url(ctx, "chrome") : look.frame}" data-part="bar"`)}${rect(bar, `fill="${url(ctx, "metal")}"`)}${rect(bar, `fill="${url(ctx, "brushed")}"`)}${rect({ ...bar, y: y === frame.y ? bar.y + bar.h - 1.5 : bar.y, h: 1.5 }, 'fill="#000000" opacity="0.25"')}</g>`);
    }
  }
  body.push(rect(frame, `fill="${url(ctx, "relief")}"`));
  if (style.convex) body.push(rect(frame, `fill="${url(ctx, "convex")}"`));
  body.push(rect(frame, `fill="none" stroke="${url(ctx, "edge")}" stroke-width="2"`));
  body.push(rect(frame, 'fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="1"'));
  items.forEach((kind, index) => body.push(gang(ctx, kind, index, MARGIN)));
  return body.join("");
}

/**
 * Decento: samostatné kulaté přístroje (Ø 87 mm, rozteč 91 mm) – glazovaný porcelán nebo dřevěný rámeček s bílým
 * porcelánovým středem, odlesk glazury, úzká retro páčka se zaoblenými konci a zásuvka s hlubokou dutinou.
 */
function decento(ctx: Ctx, items: readonly RenderGang[]): string {
  const { look } = ctx;
  const wood = (look.frameMaterial ?? look.material) === "wood";
  const cy = MARGIN + GANG / 2;
  const parts: string[] = [`<g data-part="decento"${items.length > 1 ? ' data-outline="decento" data-pitch-mm="91"' : ""}>`];
  decentoCircles(items.length, GANG).forEach(({ cx: offset, r }, index) => {
    const cx = MARGIN + offset;
    const kind = items[index];
    const clip = `${ctx.p}round${index}`;
    const centre = r * (wood ? 0.66 : 0.7);
    parts.push(circle(cx + 4, cy + 18, r - 6, `fill="#000000" opacity="0.22" filter="${url(ctx, "soft")}"`));
    parts.push(circle(cx, cy + 3, r, `fill="#000000" opacity="0.3" filter="${url(ctx, "contact")}"`));
    parts.push(`<clipPath id="${clip}">${circle(cx, cy, r, "")}</clipPath>`);
    parts.push(circle(cx, cy, r, `fill="${look.frame}" data-testid="mockup-frame"`));
    // Dřevěný rámeček: kresba dřeva, porcelánový rámeček: glazura
    parts.push(`<g clip-path="url(#${clip})">${rect({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, rx: 0 }, `fill="${wood ? url(ctx, "wood") : url(ctx, "porcelain")}"`)}</g>`);
    parts.push(circle(cx, cy, r, `fill="none" stroke="${url(ctx, "edge")}" stroke-width="2.4"`), circle(cx, cy, r, 'fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="1"'));
    // Porcelánový střed (u porcelánu jen jemná spára, u dřeva bílá glazura uvnitř)
    parts.push(circle(cx, cy + 2, centre, `fill="#000000" opacity="0.22" filter="${url(ctx, "lip")}"`));
    parts.push(circle(cx, cy, centre, `fill="${look.insert}"`), circle(cx, cy, centre, `fill="${url(ctx, "porcelain")}"`), circle(cx, cy, centre, `fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="1"`));
    parts.push(`<ellipse cx="${n(cx - r * 0.42)}" cy="${n(cy - r * 0.5)}" rx="${n(r * 0.26)}" ry="${n(r * 0.11)}" fill="#ffffff" opacity="${lightness(look.frame) > 0.5 ? 0.75 : 0.35}" transform="rotate(-32 ${n(cx - r * 0.42)} ${n(cy - r * 0.5)})" data-testid="mockup-glaze"/>`);
    const dark = lightness(look.insert) < 0.45;
    if (kind === "switch") {
      // Úzká retro páčka se zaoblenými konci z kulaté hlavice
      parts.push(circle(cx, cy, centre * 0.34, `fill="${shade(look.insert, dark ? 0.12 : -0.05)}" stroke="#000000" stroke-opacity="0.2" stroke-width="1"`));
      const lever = { x: cx - 5.5, y: cy - centre * 0.92, w: 11, h: centre * 0.92 + 6, rx: 5.5 };
      parts.push(rect({ ...lever, x: lever.x + 3, y: lever.y + 5 }, `fill="#000000" opacity="0.3" filter="${url(ctx, "lip")}"`));
      parts.push(rect(lever, `fill="${dark ? "#2a2a2e" : "#fafaf9"}" data-testid="mockup-lever"`), rect(lever, `fill="${url(ctx, "pin")}" opacity="0.35"`), rect(lever, 'fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="0.8"'));
      parts.push(circle(cx, cy, centre * 0.13, `fill="${url(ctx, "chrome")}"`));
    } else if (kind === "socket" || kind === "double") {
      // Hluboká kruhová dutina, kovový zemnicí kolík nahoře, zdířky L / N a středový upevňovací šroubek
      const cavity = centre * 0.78;
      parts.push(`<g data-testid="mockup-porcelain-socket">`);
      parts.push(circle(cx, cy, cavity, `fill="${shade(look.insert, dark ? 0.06 : -0.08)}"`), circle(cx, cy, cavity, `fill="${url(ctx, "cavity")}"`), circle(cx, cy, cavity, 'fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.2"'));
      const pin = { x: cx - 5, y: cy - cavity + 3, w: 10, h: cavity * 0.4, rx: 5 };
      parts.push(rect(pin, `fill="${url(ctx, "pin")}" data-testid="mockup-pin"`), rect(pin, 'fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="0.8"'));
      for (const dx of [-0.42, 0.42]) parts.push(circle(cx + cavity * dx, cy + cavity * 0.18, cavity * 0.13, 'fill="#0b0b0c"'));
      parts.push(`<g data-testid="mockup-screw">${circle(cx, cy + cavity * 0.18, cavity * 0.11, `fill="${url(ctx, "chrome")}" stroke="#3f3f46" stroke-width="0.8"`)}<line x1="${n(cx - cavity * 0.08)}" y1="${n(cy + cavity * 0.18 - cavity * 0.05)}" x2="${n(cx + cavity * 0.08)}" y2="${n(cy + cavity * 0.18 + cavity * 0.05)}" stroke="#3f3f46" stroke-width="1.4"/></g>`);
      parts.push("</g>");
    }
  });
  parts.push("</g>");
  return parts.join("");
}

/**
 * Nástěnný přístroj IP44 / IP54 – krabicové tělo s horní kabelovou vývodkou: Garant oblý (u šedé kouřové víčko),
 * Praktik hranatý s velkou kolébkou, Variant+ dvoubarevný se zkosenými hranami, pružinovým pantem, žebrováním a ABB / IP54.
 */
function monoblock(ctx: Ctx, items: readonly RenderGang[], ip: string): string {
  const { look, style } = ctx;
  const kind = style.monoblock!;
  const width = items.length * GANG;
  const body: Box = { x: MARGIN + 8, y: MARGIN + 14, w: width - 16, h: GANG - 26, rx: kind === "rounded" ? 30 * U : kind === "square" ? 4 * U : 0 };
  const centre = MARGIN + width / 2;
  const darkBody = lightness(look.frame) < 0.5;
  const ink = lightness(look.insert) < 0.45 ? "#e4e4e7" : "#3f3f46";
  const chamfer = 16 * U;
  const outline = kind === "industrial"
    ? `<path d="M${n(body.x + chamfer)} ${n(body.y)} H${n(body.x + body.w - chamfer)} L${n(body.x + body.w)} ${n(body.y + chamfer)} V${n(body.y + body.h - chamfer)} L${n(body.x + body.w - chamfer)} ${n(body.y + body.h)} H${n(body.x + chamfer)} L${n(body.x)} ${n(body.y + body.h - chamfer)} V${n(body.y + chamfer)} Z"`
    : null;
  const shapeOf = (extra: string) => (outline ? `${outline} ${extra}/>` : rect(body, extra));
  const parts: string[] = ['<g data-testid="mockup-monoblock">'];
  parts.push(rect({ ...body, x: body.x + 6, y: body.y + 20, w: body.w - 12 }, `fill="#000000" opacity="0.22" filter="${url(ctx, "soft")}"`));
  // Horní kabelová vývodka (matice a kabel)
  parts.push(`<g data-testid="mockup-gland">${rect({ x: centre - 10, y: MARGIN - 40, w: 20, h: 40, rx: 2 }, 'fill="#3f3f46"')}${rect({ x: centre - 22, y: body.y - 18, w: 44, h: 22, rx: 5 }, `fill="${kind === "industrial" ? "#52525b" : shade(look.frame, -0.06)}" stroke="#000000" stroke-opacity="0.35" stroke-width="1"`)}${rect({ x: centre - 22, y: body.y - 18, w: 44, h: 22, rx: 5 }, `fill="${url(ctx, "relief")}"`)}</g>`);
  parts.push(shapeOf(`fill="${look.frame}"`), shapeOf(`fill="${url(ctx, "relief")}"`), shapeOf(`fill="${url(ctx, "gloss")}" opacity="0.6"`), shapeOf(`fill="none" stroke="#000000" stroke-opacity="${kind === "industrial" ? 0.45 : 0.28}" stroke-width="${kind === "industrial" ? 2.4 : 1.4}"`));
  if (kind === "industrial") {
    // Dvoubarevné tělo: vnitřní panel v tmavší barvě, šrouby v rozích
    const panel = { x: body.x + 12 * U, y: body.y + 8 * U, w: body.w - 24 * U, h: body.h - 16 * U, rx: 6 * U };
    parts.push(rect(panel, `fill="${look.insert}" data-part="panel"`), rect(panel, `fill="${url(ctx, "relief")}"`), rect(panel, 'fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1.2"'));
    for (const [x, y] of [[body.x + 7 * U, body.y + 22 * U], [body.x + body.w - 7 * U, body.y + 22 * U], [body.x + 7 * U, body.y + body.h - 22 * U], [body.x + body.w - 7 * U, body.y + body.h - 22 * U]]) {
      parts.push(circle(x, y, 5, `fill="${url(ctx, "chrome")}" stroke="#27272a" stroke-width="1"`), `<line x1="${n(x - 3)}" y1="${n(y)}" x2="${n(x + 3)}" y2="${n(y)}" stroke="#27272a" stroke-width="1.2"/>`);
    }
  }
  items.forEach((item, index) => {
    if (item === "blank") return;
    const left = MARGIN + index * GANG;
    const cx = left + GANG / 2;
    if (item === "switch") {
      const big = kind === "square" ? 16 : kind === "rounded" ? 22 : 24;
      const rocker: Box = { x: left + big * U, y: body.y + 12 * U, w: GANG - big * 2 * U, h: body.h - (kind === "industrial" ? 32 : 26) * U, rx: kind === "rounded" ? 18 * U : 4 * U };
      const fill = kind === "industrial" ? shade(look.insert, -0.35) : look.insert;
      parts.push(`<g data-gang="monoblock-switch">`);
      parts.push(rect({ ...rocker, y: rocker.y + 3 }, `fill="#000000" opacity="0.28" filter="${url(ctx, "lip")}"`), rect(rocker, `fill="${fill}"`), rect(rocker, `fill="${url(ctx, "rocker")}"`), rect(rocker, `fill="${url(ctx, "gloss")}" opacity="0.6"`));
      if (kind === "square") parts.push(rect({ x: rocker.x + 8, y: rocker.y + rocker.h / 2 - 1, w: rocker.w - 16, h: 2, rx: 1 }, 'fill="#000000" opacity="0.18"'));
      if (kind === "industrial") for (let rib = 0; rib < 4; rib++) parts.push(rect({ x: rocker.x + rocker.w * 0.28, y: rocker.y + rocker.h * 0.62 + rib * 7, w: rocker.w * 0.44, h: 2.4, rx: 1.2 }, 'fill="#000000" opacity="0.3"'));
      parts.push(rect(rocker, 'fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="1"'));
      // Variant+: nápis na tmavém vnitřním panelu, ostatní na těle přístroje
      const switchInk = kind === "industrial" ? (lightness(look.insert) < 0.5 ? "#e4e4e7" : "#3f3f46") : darkBody ? "#e4e4e7" : "#52525b";
      parts.push(`<text x="${n(cx)}" y="${n(body.y + body.h - (kind === "industrial" ? 10 : 6) * U)}" font-family="Arial, Helvetica, sans-serif" font-size="${n(7 * U)}" font-weight="700" text-anchor="middle" fill="${switchInk}" opacity="0.8" data-testid="mockup-ip">${escapeXml(ip)}</text>`);
      parts.push("</g>");
      return;
    }
    // Zásuvka pod odklápěcím víčkem: pant nahoře, prolis, krytí, západka (Garant šedý: kouřové víčko – zásuvka prosvítá)
    const lid: Box = { x: left + 13 * U, y: body.y + 12 * U, w: GANG - 26 * U, h: body.h - 22 * U, rx: kind === "rounded" ? 18 * U : kind === "square" ? 4 * U : 6 * U };
    const smoked = kind === "rounded" && darkBody;
    parts.push(`<g data-gang="monoblock-socket" data-testid="mockup-lid"${smoked ? ' data-lid="smoked"' : ""}>`);
    if (smoked) parts.push(rect(lid, `fill="${shade(look.insert, 0.1)}"`), socketParts(ctx, cx, lid.y + lid.h / 2, lid.w * 0.27, shade(look.insert, 0.1)));
    parts.push(rect({ ...lid, y: lid.y + 3 }, `fill="#000000" opacity="0.28" filter="${url(ctx, "lip")}"`));
    parts.push(rect(lid, smoked ? `fill="${url(ctx, "smoke")}"` : `fill="${kind === "industrial" ? look.frame : look.insert}"`), rect(lid, `fill="${url(ctx, smoked ? "glass" : "gloss")}" opacity="0.8"`));
    // Pant víčka (Variant+ pružinový válec)
    const hinge = { x: lid.x + lid.w * 0.18, y: lid.y - 5 * U, w: lid.w * 0.64, h: 8 * U, rx: 4 * U };
    parts.push(rect(hinge, `fill="${kind === "industrial" ? url(ctx, "chrome") : shade(look.insert, -0.08)}" data-testid="mockup-hinge"`), rect(hinge, 'fill="none" stroke="#000000" stroke-opacity="0.35" stroke-width="1"'));
    if (kind === "industrial") {
      for (const side of [0, 1]) for (let rib = 0; rib < 6; rib++) parts.push(rect({ x: side ? lid.x + lid.w - 7 * U : lid.x + 3 * U, y: lid.y + 14 * U + rib * 6 * U, w: 4 * U, h: 2 * U, rx: U }, 'fill="#000000" opacity="0.28"'));
    }
    parts.push(rect(grow(lid, -9 * U, lid.rx - 6 * U), 'fill="none" stroke="#000000" stroke-opacity="0.2" stroke-width="1.6"'));
    const labelInk = smoked ? "#e4e4e7" : kind === "industrial" ? (lightness(look.frame) < 0.5 ? "#e4e4e7" : "#3f3f46") : ink;
    if (kind === "industrial") parts.push(`<text x="${n(cx)}" y="${n(lid.y + lid.h - 22 * U)}" font-family="Arial, Helvetica, sans-serif" font-size="${n(9 * U)}" font-weight="800" letter-spacing="1" text-anchor="middle" fill="#dc2626" opacity="0.9" data-testid="mockup-brand">ABB</text>`);
    parts.push(`<text x="${n(cx)}" y="${n(kind === "industrial" ? lid.y + lid.h - 10 * U : lid.y + lid.h / 2 + 5 * U)}" font-family="Arial, Helvetica, sans-serif" font-size="${n((kind === "industrial" ? 8 : 11) * U)}" font-weight="800" text-anchor="middle" fill="${labelInk}" opacity="0.7" data-testid="mockup-ip">${escapeXml(ip)}</text>`);
    parts.push(rect({ x: cx - 9 * U, y: lid.y + lid.h - 3 * U, w: 18 * U, h: 6 * U, rx: 2 * U }, `fill="${kind === "industrial" ? look.frame : look.insert}" stroke="#000000" stroke-opacity="0.35" stroke-width="1"`));
    parts.push(rect(lid, 'fill="none" stroke="#000000" stroke-opacity="0.3" stroke-width="1"'));
    parts.push("</g>");
  });
  parts.push("</g>");
  return parts.join("");
}

export interface RenderInput {
  seriesKey: string | null;
  shape: SeriesShape;
  look: Look;
  items: readonly RenderGang[];
  /** Předpona id (živý náhled); soubory bez předpony. */
  id?: string;
  label?: string;
  /** Živý náhled roztažený na šířku rodiče (bez pevné velikosti). */
  fluid?: boolean;
}

/** SVG náhledu přístroje / rámečku řady v libovolné kombinaci krytu a rámečku. */
export function renderDeviceSvg({ seriesKey, shape, look, items, id = "", label, fluid = false }: RenderInput): string {
  const style = mockStyle(seriesKey, shape);
  const ctx: Ctx = { p: id, look, style };
  const width = items.length * GANG + MARGIN * 2;
  const ip = designSeriesOf(seriesKey)?.series.ip ?? "IP44";
  const size = fluid ? 'width="100%" style="display:block;height:auto"' : `width="${width}" height="${HEIGHT}"`;
  const attrs = [`viewBox="0 0 ${width} ${HEIGHT}"`, size, 'role="img"', `aria-label="${escapeXml(label ?? "Náhled designové řady")}"`, `data-shape="${shape}"`, `data-material="${look.material}"`];
  if (seriesKey) attrs.push(`data-series="${escapeXml(seriesKey)}"`);
  if (style.monoblock) attrs.push(`data-monoblock="${style.monoblock}"`);
  // Fáze 91: povrch a textura rámečku, liší-li se od krytu (Busch-axcent beton, břidlice …)
  if (look.frameMaterial) attrs.push(`data-frame-material="${look.frameMaterial}"`);
  if (look.texture) attrs.push(`data-texture="${look.texture}"`);
  const body = style.monoblock ? monoblock(ctx, items, ip) : style.round ? decento(ctx, items) : framed(ctx, items);
  return [`<svg xmlns="http://www.w3.org/2000/svg" ${attrs.join(" ")}>`, defs(ctx), `<rect width="${width}" height="${HEIGHT}" fill="${url(ctx, "bg")}"/>`, `<rect width="${width}" height="${HEIGHT}" fill="${url(ctx, "spot")}"/>`, body, "</svg>"].join("\n");
}

/** Díly náhledu: spínač 1R, zásuvka 1R, sestava (víceramček 3R; nástěnné řady dvojzásuvka pod víčky). */
export function partGangs(seriesKey: string | null, shape: SeriesShape, part: SeriesPhotoPart): RenderGang[] {
  if (part === "switch") return ["switch"];
  if (part === "socket") return ["socket"];
  return mockStyle(seriesKey, shape).monoblock ? ["socket", "socket"] : ["switch", "socket", "socket"];
}

/** Vzhled barvy řady pro render – u řad se samostatnou paletou rámečků výchozí rámeček ke krytu (katalog). */
export function seriesLook(seriesKey: string, color: SeriesColor): Look {
  const found = designSeriesOf(seriesKey);
  const shape = found?.series.shape ?? "square";
  if (!found?.series.frames?.length) return lookOf(color, shape);
  const frame = resolveFrameColor(seriesKey, null, color.id);
  const combined: LookColor = { swatch: color.swatch, insert: color.insert ?? color.swatch, frame: frame?.frame ?? frame?.swatch ?? color.swatch, material: color.material, ...(frame?.material ? { frameMaterial: frame.material } : {}), ...(frame?.texture ? { texture: frame.texture } : {}) };
  return lookOf(combined, shape);
}

/** Render jednoho dílu řady v barvě (spínač 1R, zásuvka 1R nebo sestava). */
export function renderSeriesSvg(seriesKey: string, color: SeriesColor, part: SeriesPhotoPart): string {
  const found = designSeriesOf(seriesKey);
  const shape = found?.series.shape ?? "square";
  const svg = renderDeviceSvg({ seriesKey, shape, look: seriesLook(seriesKey, color), items: partGangs(seriesKey, shape, part), label: `${found?.series.name ?? seriesKey} – ${color.label}` });
  return `${svg.replace("<svg ", `<svg data-color="${escapeXml(color.id)}" data-part="${part}" `)}\n`;
}

/** Všechny soubory renderů: cesta v `public/catalog-images/` → obsah (a `zdroj.json` každé složky řady). */
export function renderPlan(): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  for (const key of RENDER_SERIES) {
    const found = designSeriesOf(key);
    if (!found) continue;
    const dir = `${catalogSlug(found.brand.manufacturer)}/${catalogSlug(found.series.name)}`;
    files.push({ path: `${dir}/zdroj.json`, content: `${JSON.stringify(RENDER_SOURCE, null, 2)}\n` });
    for (const color of found.series.colors ?? []) {
      for (const part of RENDER_PARTS) files.push({ path: `${dir}/${color.id}-${part}.svg`, content: renderSeriesSvg(key, color, part) });
    }
  }
  return files;
}
