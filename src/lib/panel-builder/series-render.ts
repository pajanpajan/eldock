// Fáze 80: produktové náhledy designových řad ABB jako vlastní vektorové rendery (SVG) – studiové pozadí, měkký stín
// pod rámečkem, plastický rámeček a klapka s odlesky podle povrchu (lesk, kov, sklo, softtouch), tvar a typické prvky
// řady ze `series-look.ts` (Levit s podložkou v druhé barvě, Tango vypouklé, Time s kovovou linkou, future linear tenké)
// a skutečné barvy rámečku a krytu z Katalogu ABB 2026 (`abb-catalog-2026.ts`). Soubory generuje
// `npm run catalog:renders` do `public/catalog-images/abb/<řada>/<barva>-<díl>.svg` – žádné fotografie výrobce.
// Čisté funkce (stejný vstup = stejný soubor; test hlídá, že soubory odpovídají kódu).

import type { SeriesColor } from "./abb-catalog-2026";
import { catalogSlug } from "./catalog-images";
import { lightness, lookOf, mockStyle, type Look, type MockStyle } from "./series-look";
import type { SeriesPhotoPart } from "./series-photos";
import { designSeriesOf } from "./wiring-designs";

/** Klíčové řady ABB s renderem (ostatní řady kreslí galerie vektorovým náhledem). */
export const RENDER_SERIES = ["ABB|Zoni", "ABB|Tango", "ABB|Levit", "ABB|Levit M", "ABB|Time", "ABB|future linear"] as const;
export const RENDER_PARTS: readonly SeriesPhotoPart[] = ["switch", "socket", "set"];
/** Zdroj a podmínky užití (zapisují se do `zdroj.json` složky řady a galerie je vypíše pod náhledem). */
export const RENDER_SOURCE = { source: "Eldock – vektorový render podle Katalogu ABB 2026 (tvar řady a barvy)", license: "vlastní dílo Eldock, bez fotografií výrobce" } as const;

const U = 2; // měřítko proti náhledu v galerii (100 jednotek na pozici → 200 px)
const GANG = 100 * U;
const MARGIN = 64;
const HEIGHT = GANG + MARGIN * 2;

type Gang = "switch" | "socket";
const PART_GANGS: Record<SeriesPhotoPart, Gang[]> = { switch: ["switch"], socket: ["socket"], set: ["switch", "socket", "socket"] };

const n = (value: number) => String(Math.round(value * 10) / 10);
const rect = (attrs: { x: number; y: number; w: number; h: number; rx: number }, extra: string) => `<rect x="${n(attrs.x)}" y="${n(attrs.y)}" width="${n(attrs.w)}" height="${n(attrs.h)}" rx="${n(attrs.rx)}" ${extra}/>`;

/** Barva posunutá ke světlé (> 0) / tmavé (< 0). */
function shade(hex: string, amount: number): string {
  const value = Number.parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(value)) return hex;
  const channel = (shift: number) => {
    const c = (value >> shift) & 255;
    return Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  };
  return `#${[channel(16), channel(8), channel(0)].map((c) => Math.min(255, Math.max(0, c)).toString(16).padStart(2, "0")).join("")}`;
}

function defs(look: Look): string {
  const dark = lightness(look.frame) < 0.4;
  return [
    "<defs>",
    // Studiové pozadí: světlá stěna s měkkým bodovým světlem shora
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fafaf9"/><stop offset="1" stop-color="#e7e5e2"/></linearGradient>',
    '<radialGradient id="spot" cx="0.5" cy="0.28" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.95"/><stop offset="0.55" stop-color="#ffffff" stop-opacity="0.25"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>',
    // Stíny: široký měkký a kontaktní u stěny
    '<filter id="soft" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur stdDeviation="14"/></filter>',
    '<filter id="contact" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur stdDeviation="3.5"/></filter>',
    '<filter id="lip" x="-10%" y="-10%" width="120%" height="130%"><feGaussianBlur stdDeviation="1.6"/></filter>',
    // Plastika rámečku a klapky: světlo shora, stín dole
    '<linearGradient id="relief" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.42"/><stop offset="0.38" stop-color="#ffffff" stop-opacity="0.04"/><stop offset="0.7" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.2"/></linearGradient>',
    `<linearGradient id="edge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="${dark ? 0.35 : 0.85}"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="${dark ? 0.55 : 0.28}"/></linearGradient>`,
    '<linearGradient id="rocker" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.34"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="0.52" stop-color="#000000" stop-opacity="0.03"/><stop offset="1" stop-color="#000000" stop-opacity="0.16"/></linearGradient>',
    // Povrchy
    '<linearGradient id="gloss" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.32" stop-color="#ffffff" stop-opacity="0.08"/><stop offset="0.34" stop-color="#ffffff" stop-opacity="0.22"/><stop offset="0.5" stop-color="#ffffff" stop-opacity="0.02"/><stop offset="1" stop-color="#000000" stop-opacity="0.08"/></linearGradient>',
    '<linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="0.3" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="0.31" stop-color="#ffffff" stop-opacity="0.32"/><stop offset="0.48" stop-color="#ffffff" stop-opacity="0.03"/><stop offset="1" stop-color="#000000" stop-opacity="0.22"/></linearGradient>',
    `<linearGradient id="metal" x1="0" y1="0" x2="1" y2="0">${[0, 0.15, 0.32, 0.5, 0.68, 0.85, 1].map((offset, index) => `<stop offset="${offset}" stop-color="${index % 2 ? "#ffffff" : "#000000"}" stop-opacity="${index % 2 ? 0.32 : 0.14}"/>`).join("")}</linearGradient>`,
    '<pattern id="brushed" width="6" height="3" patternUnits="userSpaceOnUse"><path d="M0 1.5 H6" stroke="#ffffff" stroke-opacity="0.18" stroke-width="0.6"/></pattern>',
    '<radialGradient id="soft-touch" cx="0.5" cy="0.4" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.1"/><stop offset="1" stop-color="#000000" stop-opacity="0.1"/></radialGradient>',
    // Zásuvka: hluboká kruhová jamka a kovový ochranný kolík
    '<radialGradient id="well" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#000000" stop-opacity="0.04"/><stop offset="0.75" stop-color="#000000" stop-opacity="0.14"/><stop offset="1" stop-color="#000000" stop-opacity="0.34"/></radialGradient>',
    '<linearGradient id="pin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8b8f96"/><stop offset="0.45" stop-color="#f1f3f5"/><stop offset="1" stop-color="#6b7078"/></linearGradient>',
    '<linearGradient id="chrome" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4f4f5"/><stop offset="0.5" stop-color="#9ca3af"/><stop offset="1" stop-color="#e4e4e7"/></linearGradient>',
    '<radialGradient id="convex" cx="0.5" cy="0.3" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.4"/><stop offset="0.65" stop-color="#ffffff" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity="0.18"/></radialGradient>',
    "</defs>",
  ].join("");
}

/** Překryv povrchu přes tvar podle materiálu řady. */
function surface(box: { x: number; y: number; w: number; h: number; rx: number }, material: Look["material"]): string {
  switch (material) {
    case "gloss":
    case "porcelain":
      return rect(box, 'fill="url(#gloss)"');
    case "glass":
      return rect(box, 'fill="url(#glass)"');
    case "metal":
      return rect(box, 'fill="url(#metal)"') + rect(box, 'fill="url(#brushed)"');
    case "softtouch":
    case "matte":
    case "paper":
    case "stone":
      return rect(box, 'fill="url(#soft-touch)"');
    case "wood":
      return rect(box, 'fill="url(#gloss)" opacity="0.5"');
  }
}

/** Jedna pozice rámečku: klapka spínače nebo zásuvka s ochranným kolíkem. */
function gang(kind: Gang, index: number, look: Look, style: MockStyle, top: number): string {
  const left = MARGIN + index * GANG;
  const inset = Math.min(27, Math.max(14, 7 + style.border)) * U;
  const cover = { x: left + inset, y: top + inset, w: GANG - inset * 2, h: GANG - inset * 2, rx: (style.rocker === "rounded" ? 14 : style.insetRadius) * U };
  const dark = lightness(look.insert) < 0.45;
  const parts: string[] = [`<g data-part="${kind}">`];
  if (style.metalLine) {
    const line = { x: cover.x - 6, y: cover.y - 6, w: cover.w + 12, h: cover.h + 12, rx: cover.rx + 2 };
    parts.push(rect(line, 'fill="none" stroke="url(#chrome)" stroke-width="5"'), rect(line, 'fill="none" stroke="#71717a" stroke-opacity="0.6" stroke-width="1"'));
  }
  // Klapka vrhá drobný stín do rámečku (spára) a má vlastní plastiku
  parts.push(rect({ ...cover, y: cover.y + 2.5 }, 'fill="#000000" opacity="0.28" filter="url(#lip)"'));
  parts.push(rect(cover, `fill="${look.insert}"`));
  parts.push(surface(cover, look.material === "wood" ? "gloss" : look.material));
  const cx = left + GANG / 2;
  const cy = top + GANG / 2;
  if (kind === "switch") {
    parts.push(rect(cover, 'fill="url(#rocker)"'));
    if (style.base) {
      // Levit: vodorovný proužek indikace u spodní hrany klapky
      parts.push(rect({ x: cover.x + 20, y: cover.y + cover.h - 18, w: cover.w - 40, h: 4, rx: 2 }, `fill="${dark ? "#d4d4d8" : "#52525b"}" opacity="0.55"`));
    } else {
      // Jemná spára kolébky u spodní hrany
      parts.push(rect({ x: cover.x + 12, y: cover.y + cover.h - 10, w: cover.w - 24, h: 2, rx: 1 }, `fill="${dark ? "#ffffff" : "#000000"}" opacity="${dark ? 0.12 : 0.14}"`));
    }
  } else {
    // Jamka zásuvky ≈ 36 % klapky (Ø 39 mm na krytu ~ 55 mm)
    const r = Math.min(cover.w, cover.h) * 0.36;
    const ring = dark ? shade(look.insert, 0.22) : shade(look.insert, -0.12);
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r + 3)}" fill="${ring}" opacity="0.65"/>`);
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${shade(look.insert, dark ? 0.05 : -0.04)}"/>`);
    parts.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#well)"/>`);
    // Otvory kolíků a ochranný kolík (zásuvka typu E – ČSN)
    for (const dx of [-0.39, 0.39]) {
      parts.push(`<circle cx="${n(cx + r * dx)}" cy="${n(cy + 2)}" r="${n(r * 0.14)}" fill="#0b0b0c"/>`);
      parts.push(`<circle cx="${n(cx + r * dx)}" cy="${n(cy + 2 - r * 0.04)}" r="${n(r * 0.14)}" fill="none" stroke="#ffffff" stroke-opacity="${dark ? 0.18 : 0.35}" stroke-width="1"/>`);
    }
    parts.push(rect({ x: cx - 4.5, y: cy - r + 4, w: 9, h: r * 0.42, rx: 4.5 }, 'fill="url(#pin)"'));
    parts.push(rect({ x: cx - 4.5, y: cy - r + 4, w: 9, h: r * 0.42, rx: 4.5 }, 'fill="none" stroke="#000000" stroke-opacity="0.25" stroke-width="0.8"'));
  }
  parts.push(rect(cover, 'fill="none" stroke="url(#edge)" stroke-width="1.4"'));
  parts.push(rect(cover, 'fill="none" stroke="#000000" stroke-opacity="0.16" stroke-width="0.8"'));
  parts.push("</g>");
  return parts.join("");
}

/** Render jednoho dílu řady v barvě (spínač 1R, zásuvka 1R nebo víceramček 3R vypínač + 2 zásuvky). */
export function renderSeriesSvg(seriesKey: string, color: SeriesColor, part: SeriesPhotoPart): string {
  const found = designSeriesOf(seriesKey);
  const shape = found?.series.shape ?? "square";
  const look = lookOf(color, shape);
  const style = mockStyle(seriesKey, shape);
  const gangs = PART_GANGS[part];
  const width = gangs.length * GANG + MARGIN * 2;
  const frame = { x: MARGIN + 12, y: MARGIN + 12, w: gangs.length * GANG - 24, h: GANG - 24, rx: style.radius * U };
  const body: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${HEIGHT}" width="${width}" height="${HEIGHT}" role="img" aria-label="${escapeXml(`${found?.series.name ?? seriesKey} – ${color.label}`)}" data-series="${escapeXml(seriesKey)}" data-color="${escapeXml(color.id)}" data-part="${part}">`,
    defs(look),
    `<rect width="${width}" height="${HEIGHT}" fill="url(#bg)"/>`,
    `<rect width="${width}" height="${HEIGHT}" fill="url(#spot)"/>`,
    // Stín na stěně: široký měkký posunutý dolů a kontaktní těsně kolem rámečku
    rect({ ...frame, x: frame.x + 6, y: frame.y + 18, w: frame.w - 12 }, 'fill="#000000" opacity="0.2" filter="url(#soft)"'),
    rect({ ...frame, y: frame.y + 3 }, 'fill="#000000" opacity="0.3" filter="url(#contact)"'),
  ];
  if (style.base) {
    // Levit / Levit M: podložka v barvě krytu vyčnívá v horní a spodní spáře
    body.push(rect({ x: frame.x + 6, y: frame.y - 7, w: frame.w - 12, h: frame.h + 14, rx: 3 }, `fill="${look.insert}" data-part="base"`));
    body.push(rect({ x: frame.x + 6, y: frame.y - 7, w: frame.w - 12, h: frame.h + 14, rx: 3 }, 'fill="url(#relief)"'));
  }
  body.push(rect(frame, `fill="${look.frame}"`));
  body.push(surface(frame, look.material));
  body.push(rect(frame, 'fill="url(#relief)"'));
  if (style.convex) {
    // Tango: vypouklý rámeček
    body.push(rect(frame, 'fill="url(#convex)"'));
  }
  body.push(rect(frame, 'fill="none" stroke="url(#edge)" stroke-width="2"'));
  body.push(rect(frame, 'fill="none" stroke="#000000" stroke-opacity="0.18" stroke-width="1"'));
  gangs.forEach((kind, index) => body.push(gang(kind, index, look, style, MARGIN)));
  body.push("</svg>");
  return `${body.join("\n")}\n`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
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
