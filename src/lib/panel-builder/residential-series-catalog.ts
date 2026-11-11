// Fáze 91: pravidla rámečků designových řad podle katalogů výrobců 2026 – nejvyšší vícenásobný rámeček (`maxFrameGang`),
// limit podle orientace (vodorovně / svisle), nástěnné řady bez podomítkových krabic a víceramečků a rozdělení víceramečku,
// který v řadě neexistuje, na skutečně vyráběné rámečky (kusovník nikdy nenabídne vymyšlenou položku).
// ABB ověřeno v „Katalog: Domovní elektroinstalační materiál 2026“ (rámečky po řadách str. 54–166, Decento str. 144, 147
// a 548); Schneider Electric, Legrand a Hager podle zadání fáze 91. Barva rámečku řady s vlastními objednacími čísly
// (Busch-Jaeger) rozsah zúží: rámeček bez objednacího čísla v té barvě neexistuje. Čisté funkce.

import { designSeriesOf, resolveFrameColor } from "./wiring-designs";

export type FrameOrientation = "horizontal" | "vertical";

export interface SeriesFrameRules {
  /** Nejvyšší vícenásobný rámeček (1 = jen jednonásobné rámečky nebo kompletní přístroje). */
  maxFrameGang: number;
  /** Limit podle orientace víceramečku (Asfora: vodorovně 5, svisle 3). */
  orientations: Record<FrameOrientation, number>;
  /** Nástěnný (krabicový) přístroj – bez podomítkové krabice a bez podomítkového víceramečku. */
  isSurfaceMounted?: boolean;
  /**
   * Decento: přístroje nejdou do vícenásobných rámečků – víc kusů jen jako samostatné přístroje vedle sebe / nad sebou
   * s roztečí středů krabic aspoň `minPitchMm`.
   */
  separateDevices?: { minPitchMm: number };
  /** Zdroj údaje (strana katalogu výrobce / zadání). */
  source: string;
}

/** Víceramček v editoru pojme nejvýš 5 pozic (rámečky 1R–5R). */
export const EDITOR_MAX_GANGS = 5;

const rules = (maxFrameGang: number, source: string, extra: Partial<Omit<SeriesFrameRules, "maxFrameGang" | "source">> = {}): SeriesFrameRules => ({
  maxFrameGang,
  orientations: { horizontal: maxFrameGang, vertical: maxFrameGang, ...extra.orientations },
  ...(extra.isSurfaceMounted ? { isSurfaceMounted: true } : {}),
  ...(extra.separateDevices ? { separateDevices: extra.separateDevices } : {}),
  source,
});

const ABB = "Katalog ABB 2026";
const SPEC = "zadání fáze 91 (katalog výrobce 2026)";

/** Pravidla podle klíče „výrobce|řada“ (názvy řad z `DESIGN_BRANDS`). */
export const SERIES_FRAME_RULES: Record<string, SeriesFrameRules> = {
  "ABB|Zoni": rules(5, `${ABB}, str. 81`),
  "ABB|Tango": rules(5, `${ABB}, str. 96–97`),
  "ABB|Levit": rules(5, `${ABB}, str. 119–120`),
  "ABB|Levit M": rules(5, `${ABB}, str. 119–120 (rámečky Levit v barvách 63 / 68 / 69 / 70)`),
  "ABB|Time": rules(5, `${ABB}, str. 136–137`),
  "ABB|Time Arbo": rules(4, `${ABB}, str. 138 (dřevěné rámečky jen 1R–4R)`),
  "ABB|Swing": rules(5, `${ABB}, str. 68–69`),
  "ABB|Swing L": rules(5, `${ABB}, str. 69 (3901J-A00010 … A00050)`),
  "ABB|Classic": rules(1, `${ABB}, str. 54 (jen jednonásobný rámeček)`),
  "ABB|Decento": rules(1, `${ABB}, str. 147 a 548`, { separateDevices: { minPitchMm: 90 } }),
  "ABB|future linear": rules(5, `${ABB}, str. 152`),
  "ABB|solo": rules(5, `${ABB}, str. 160`),
  "ABB|solo carat": rules(4, `${ABB}, str. 161 (bílé sklo, ušlechtilá ocel, černé sklo 1R–4R)`),
  "ABB|Busch-axcent": rules(5, `${ABB}, str. 166 (8 materiálů 1R–5R)`),
  "ABB|Garant (IP44)": rules(1, `${ABB}, str. 498 (nástěnný přístroj)`, { isSurfaceMounted: true }),
  "ABB|Variant+ (IP54)": rules(1, `${ABB}, str. 506 (nástěnný přístroj)`, { isSurfaceMounted: true }),
  "ABB|Praktik (IP44)": rules(1, `${ABB}, str. 502 (nástěnný přístroj)`, { isSurfaceMounted: true }),
  "Schneider|Nová Unica": rules(5, SPEC),
  "Schneider|Sedna Design & Elements": rules(5, SPEC),
  // Asfora: vodorovně až 6R (editor pojme 5 pozic), svisle 3R
  "Schneider|Asfora": rules(5, `${SPEC}; vodorovně až 6R, svisle 3R`, { orientations: { horizontal: 5, vertical: 3 } }),
  "Schneider|Mureva Styl (IP55)": rules(1, `${SPEC}; nástěnná řada`, { isSurfaceMounted: true }),
  "Legrand|Valena Life": rules(5, SPEC),
  "Legrand|Valena Allure": rules(5, SPEC),
  "Legrand|Céliane": rules(5, SPEC),
  "Legrand|Plexo (IP55)": rules(3, `${SPEC}; nástěnná řada`, { isSurfaceMounted: true }),
  "Hager|lumina": rules(5, SPEC),
  "Hager|berker S.1 / B.3 / Q.1 / Q.3": rules(5, SPEC),
};

/** Řada bez údaje výrobce – obecný limit editoru (rámečky 1R–5R). */
const FALLBACK = rules(EDITOR_MAX_GANGS, "bez údaje výrobce – obecný limit 1R–5R");

/** Kanonický klíč řady („ABB|Swing L“ i ze starších klíčů a aliasů). */
export function canonicalSeriesKey(seriesKey: string | null | undefined): string | null {
  const found = designSeriesOf(seriesKey);
  return found ? `${found.brand.manufacturer}|${found.series.name}` : null;
}

export function frameRulesOf(seriesKey: string | null | undefined): SeriesFrameRules {
  const key = canonicalSeriesKey(seriesKey);
  return (key ? SERIES_FRAME_RULES[key] : undefined) ?? FALLBACK;
}

export const isSurfaceMountedSeries = (seriesKey: string | null | undefined) => Boolean(frameRulesOf(seriesKey).isSurfaceMounted);

/**
 * Nejvyšší rámeček řady v barvě a orientaci: limit řady, zúžený na nejvyšší rámeček s objednacím číslem v barvě rámečku
 * (Busch-Jaeger: `frameMpn` – null = v té barvě se nevyrábí).
 */
export function maxFrameGang(seriesKey: string | null | undefined, look: { color?: string | null; frameColor?: string | null; orientation?: FrameOrientation } = {}): number {
  const own = frameRulesOf(seriesKey);
  const limit = Math.min(EDITOR_MAX_GANGS, own.orientations[look.orientation ?? "horizontal"] ?? own.maxFrameGang);
  const frame = resolveFrameColor(seriesKey, look.frameColor ?? look.color ?? null, look.color ?? null);
  if (!frame?.frameMpn?.length) return limit;
  let available = 0;
  for (const [index, mpn] of frame.frameMpn.entries()) if (mpn) available = index + 1;
  return Math.max(1, Math.min(limit, available || limit));
}

const ORDINAL = ["", "v jednonásobném rámečku", "ve dvojrámečku", "v trojrámečku", "ve čtyřrámečku", "v pětirámečku"];

/** Název řady pro hlášky („ABB Decento“). */
export function seriesTitle(seriesKey: string | null | undefined): string {
  const found = designSeriesOf(seriesKey);
  return found ? `${found.brand.label} ${found.series.name}` : "zvolená řada";
}

/**
 * Proč nejde větší víceramček: „Řada ABB Time Arbo se vyrábí nejvýš ve čtyřrámečku (1R–4R)“; Decento a nástěnné řady
 * vlastní větou. null = řada pojme víceramček až do 5R.
 */
export function frameLimitText(seriesKey: string | null | undefined, look: { color?: string | null; frameColor?: string | null } = {}): string | null {
  const own = frameRulesOf(seriesKey);
  const max = maxFrameGang(seriesKey, look);
  const title = seriesTitle(seriesKey);
  if (own.separateDevices) return `Přístroje ${title} nejdou do vícenásobných rámečků – víc kusů vedle sebe nebo nad sebou jen jako samostatné přístroje s roztečí krabic min. ${own.separateDevices.minPitchMm} mm (${own.source}).`;
  if (own.isSurfaceMounted && max === 1) return `${title} je nástěnná řada – jen samostatný přístroj nebo nástěnná dvojzásuvka, bez podomítkového víceramečku (${own.source}).`;
  if (max >= EDITOR_MAX_GANGS) return null;
  const narrowed = max < own.maxFrameGang ? " ve zvolené barvě rámečku" : "";
  return `Řada ${title} se${narrowed} vyrábí nejvýš ${ORDINAL[max]} (${max === 1 ? "1R" : `1R–${max}R`}) – ${own.source}.`;
}

/**
 * Rozdělení víceramečku na rámečky, které v řadě existují: 5 pozic při limitu 4 → [4, 1], při limitu 3 → [3, 2],
 * při limitu 1 → [1, 1, 1, 1, 1].
 */
export function splitFrameGangs(gangs: number, max: number): number[] {
  const limit = Math.max(1, Math.floor(max));
  const parts: number[] = [];
  let rest = Math.max(0, Math.round(gangs));
  while (rest > 0) {
    const part = Math.min(limit, rest);
    parts.push(part);
    rest -= part;
  }
  return parts;
}

/** Popis rozdělení do hlášek a kusovníku: „4R + 1R“. */
export const splitLabel = (parts: readonly number[]) => parts.map((part) => `${part}R`).join(" + ");
