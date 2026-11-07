// Loga výrobců (fáze 51): soubory ve `public/brands/<slug>.(svg|png|webp)` – oficiální vektorová loga
// stažená skriptem `npm run brands:fetch` (Wikimedia Commons), u značek bez veřejného SVG vektorový
// wordmark generovaný kódem. Vlastní soubor nahraný do `public/brands/` má přednost (PNG / WebP před SVG).
// Čisté funkce – bezpečné pro klient, server i skript.

import { brandOf } from "./brands";
import { normalizeSearch } from "./catalog";

/** Značka katalogu → název souboru v `public/brands/` (bez přípony). */
export const BRAND_SLUGS: Record<string, string> = {
  ABB: "abb",
  Noark: "noark",
  OEZ: "oez",
  Schneider: "schneider",
  Eaton: "eaton",
  Legrand: "legrand",
  ETI: "eti",
  Hakel: "hakel",
  Hager: "hager",
  Bonega: "bonega",
  Siemens: "siemens",
  Schrack: "schrack",
  Loxone: "loxone",
  Rittal: "rittal",
  Hensel: "hensel",
  Saltek: "saltek",
  SEZ: "sez",
  Wago: "wago",
};

/** Výrobce → slug souboru loga („Schneider Electric“ → „schneider“, neznámý → „phoenix-contact“). */
export function brandSlug(manufacturer: string): string {
  const key = brandOf(manufacturer)?.value ?? manufacturer;
  return BRAND_SLUGS[key] ?? (normalizeSearch(manufacturer).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "vyrobce");
}

export const BRAND_LOGO_EXTENSIONS = ["webp", "png", "svg"] as const;
export type BrandLogoExtension = (typeof BRAND_LOGO_EXTENSIONS)[number];
export const LOGO_CONTENT_TYPE: Record<BrandLogoExtension, string> = { webp: "image/webp", png: "image/png", svg: "image/svg+xml" };
export const isBrandSlug = (value: string) => /^[a-z0-9][a-z0-9-]{0,39}$/.test(value);

/**
 * Oficiální loga na Wikimedia Commons (soubory `Special:FilePath/<název>`). Značky bez veřejného
 * vektorového loga (Noark, OEZ, ETI, Hakel, Bonega, Saltek, SEZ) dostanou generovaný wordmark.
 */
export const LOGO_SOURCES: Record<string, string[]> = {
  abb: ["ABB_logo.svg"],
  siemens: ["Siemens_AG_logo.svg"],
  schneider: ["Schneider_Electric_2007.svg"],
  eaton: ["Eaton_Corporation_logo.svg"],
  legrand: ["Logo_Legrand_SA.svg"],
  wago: ["Logo_WAGO_2020.svg", "WAGO_Logo.svg"],
  schrack: ["Schrack_Technik_logo.svg"],
  rittal: ["Rittal-Logo_2010.svg"],
  // Fáze 65: Loxone bez staženého loga (obkreslený obrázek s černým podkladem) – čistý zelený wordmark public/brands/loxone.svg
  hensel: ["Hensel.svg"],
};

/**
 * Bezpečnostní kontrola staženého SVG: musí to být SVG bez skriptů, obsluh událostí, `foreignObject`
 * a externích odkazů. Vrací text bez XML deklarace / komentářů, nebo null (nevyhovuje).
 */
export function sanitizeSvg(text: string): string | null {
  const body = text
    .replace(/<\?xml[\s\S]*?\?>/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, "")
    .trim();
  if (!/^<svg[\s>]/i.test(body) || !/<\/svg>\s*$/i.test(body)) return null;
  if (/<script|<foreignObject|<iframe|<embed|<object|\son[a-z]+\s*=|javascript:/i.test(body)) return null;
  // jen vnitřní odkazy (#id), žádné externí obrázky ani styly
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(body) || /@import|url\(\s*["']?(?!#)/i.test(body)) return null;
  return `${body}\n`;
}

// ---------------------------------------------------------------------------
//  Generovaný vektorový wordmark (značky bez veřejného SVG a neznámí výrobci)
// ---------------------------------------------------------------------------

export interface WordmarkStyle {
  text: string;
  color: string;
  weight?: number;
  spacing?: number;
  italic?: boolean;
  /** Grafický prvek značky. */
  mark?: "square" | "swoosh" | "bolt" | "frame" | "bar" | "dot";
  sub?: string;
}

export const WORDMARKS: Record<string, WordmarkStyle> = {
  noark: { text: "NOARK", color: "#d71920", weight: 900, spacing: 2, italic: true, mark: "swoosh" },
  oez: { text: "OEZ", color: "#009fe3", weight: 900, spacing: 3, mark: "square" },
  eti: { text: "ETI", color: "#e2001a", weight: 900, spacing: 4, mark: "bar" },
  hakel: { text: "HAKEL", color: "#1c63b7", weight: 900, spacing: 2, mark: "bolt" },
  bonega: { text: "BONEGA", color: "#f39200", weight: 900, spacing: 1.5, mark: "bar" },
  saltek: { text: "SALTEK", color: "#e30613", weight: 800, spacing: 1.5, mark: "bolt" },
  sez: { text: "SEZ", color: "#004b93", weight: 900, spacing: 4, mark: "frame" },
  eastron: { text: "EASTRON", color: "#1b3e8b", weight: 800, spacing: 1.5 },
  "phoenix-contact": { text: "PHOENIX", color: "#008cd2", weight: 800, spacing: 1, sub: "CONTACT" },
  omron: { text: "OMRON", color: "#005eb8", weight: 800, spacing: 2 },
  pfannenberg: { text: "PFANNENBERG", color: "#00539f", weight: 800, spacing: 0.5 },
  stego: { text: "STEGO", color: "#004a8f", weight: 900, spacing: 2.5 },
  // Fáze 55: modrý wordmark „hager“ (#005CA9) místo šedého korporátního loga Hager Group
  hager: { text: "hager", color: "#005CA9", weight: 800, spacing: -0.5 },
  // Fáze 65: čisté wordmarky chytré automatizace (soubory v public/brands mají přednost)
  loxone: { text: "LOXONE", color: "#69C350", weight: 800, spacing: 1.5 },
  taphome: { text: "TapHome", color: "#1f2937", weight: 800, spacing: -0.5 },
};

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** Wordmark značky jako samostatné SVG (průhledné pozadí, šířka podle délky názvu). */
export function wordmarkSvg(slug: string, fallbackName = slug): string {
  const style = WORDMARKS[slug] ?? { text: fallbackName.toUpperCase().slice(0, 14), color: "#475569", weight: 800, spacing: 1 };
  const size = 40;
  const advance = size * 0.68 + (style.spacing ?? 0);
  const markWidth = style.mark === "square" || style.mark === "bolt" || style.mark === "dot" ? 46 : 0;
  const textWidth = Math.round(style.text.length * advance);
  const width = markWidth + textWidth + 16;
  const height = style.sub ? 64 : 56;
  const x0 = markWidth + 8;
  const font = "Arial, Helvetica, sans-serif";
  const color = style.color;
  const parts: string[] = [];
  if (style.mark === "square") parts.push(`<rect x="6" y="10" width="34" height="34" rx="4" fill="${color}"/><rect x="15" y="19" width="16" height="16" rx="2" fill="#fff"/>`);
  if (style.mark === "bolt") parts.push(`<path d="M27 6 L9 31 H22 L17 50 L38 22 H25 L31 6 Z" fill="${color}"/>`);
  if (style.mark === "dot") parts.push(`<circle cx="22" cy="27" r="16" fill="${color}"/><circle cx="22" cy="27" r="7" fill="#fff"/>`);
  if (style.mark === "frame") parts.push(`<rect x="3" y="5" width="${width - 6}" height="${height - 10}" rx="6" fill="none" stroke="${color}" stroke-width="4"/>`);
  parts.push(
    `<text x="${x0 + textWidth / 2}" y="${style.sub ? 36 : 42}" text-anchor="middle" font-family="${font}" font-size="${size}" font-weight="${style.weight ?? 800}" letter-spacing="${style.spacing ?? 0}"${style.italic ? ' font-style="italic"' : ""} fill="${color}">${escapeXml(style.text)}</text>`,
  );
  if (style.sub) parts.push(`<text x="${x0 + textWidth / 2}" y="58" text-anchor="middle" font-family="${font}" font-size="16" font-weight="700" letter-spacing="5" fill="${color}">${escapeXml(style.sub)}</text>`);
  if (style.mark === "swoosh") parts.push(`<path d="M${x0} 50 Q ${x0 + textWidth / 2} 42 ${x0 + textWidth} 47 L ${x0 + textWidth} 51 Q ${x0 + textWidth / 2} 47 ${x0} 54 Z" fill="${color}"/>`);
  if (style.mark === "bar") parts.push(`<rect x="${x0 + 4}" y="47" width="${textWidth - 8}" height="5" rx="1" fill="${color}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(style.text)}">${parts.join("")}</svg>\n`;
}
