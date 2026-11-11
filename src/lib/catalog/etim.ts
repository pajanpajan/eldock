// Fáze 94: oficiální data výrobce ve formátu BMEcat ETIM 9.0 (EDXF 5.0) – jeden produkt `<PRODUCT>…</PRODUCT>` →
// strukturovaný záznam: objednací číslo (SUPPLIER_PID), GTIN / EAN, popisy, třída ETIM (EC…), vlastnosti (EF… s jednotkou),
// řada a média `UDX.EDXF.MIME_INFO` (MD01 fotka výrobku, MD04 stránka výrobku, MD12 / MD14 technický list a návod).
// Proudové čtení celého souboru (ZIP, stovky MB) je ve skriptu `scripts/import-abb-etim9.mjs`; tady jen čisté funkce.

export interface EtimFeature {
  /** Hodnota (EV… u výčtu, číslo / true / false jako text); více hodnot = rozsah. */
  value: string | string[];
  /** Jednotka ETIM (EU570448 = mm, EU570459 = A, EU570079 = V …). */
  unit?: string;
  /** Čitelná hodnota výčtu („Flush-mounted“). */
  detail?: string;
}

export interface EtimMedia {
  /** Kód média EDXF (MD01 fotka výrobku, MD02 další fotka, MD04 stránka výrobku, MD12 technický list, MD14 návod …). */
  code: string | null;
  source: string | null;
  lang: string | null;
  file: string | null;
  designation: string | null;
}

export interface EtimProduct {
  /** Objednací číslo výrobce (u domovních přístrojů ABB pro ČR české číslo „3558A-A651 B“). */
  pid: string;
  gtin: string | null;
  typeCode: string | null;
  shortCze: string | null;
  longCze: string | null;
  shortEng: string | null;
  etimClass: string | null;
  series: string | null;
  features: Record<string, EtimFeature>;
  media: EtimMedia[];
}

/** Jednotky ETIM, které aplikace čte. */
export const ETIM_UNITS = { mm: "EU570448", ampere: "EU570459", volt: "EU570079" } as const;

/** Třídy ETIM 9.0, se kterými import pracuje. */
export const ETIM_CLASSES = {
  frame: "EC000007",
  socket: "EC000125",
  switchCover: "EC000018",
  mcb: "EC000042",
  rcd: "EC000003",
  rcbo: "EC000905",
  enclosure: "EC000214",
} as const;

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .trim();

function tag(block: string, name: string, lang?: string): string | null {
  const escaped = name.replace(/\./g, "\\.");
  const pattern = lang ? new RegExp(`<${escaped} lang="${lang}">([^<]*)</${escaped}>`) : new RegExp(`<${escaped}(?: [^>]*)?>([^<]*)</${escaped}>`);
  const match = pattern.exec(block);
  return match ? decode(match[1]) : null;
}

function features(block: string): Record<string, EtimFeature> {
  const result: Record<string, EtimFeature> = {};
  for (const match of block.matchAll(/<FEATURE>([\s\S]*?)<\/FEATURE>/g)) {
    const body = match[1];
    const name = /<FNAME>([^<]*)<\/FNAME>/.exec(body)?.[1];
    const values = [...body.matchAll(/<FVALUE>([^<]*)<\/FVALUE>/g)].map((value) => decode(value[1]));
    // „-“ = výrobce hodnotu neuvádí
    if (!name || !values.length || values.every((value) => value === "-")) continue;
    const unit = /<FUNIT>([^<]*)<\/FUNIT>/.exec(body)?.[1];
    const detail = /<FVALUE_DETAILS>([^<]*)<\/FVALUE_DETAILS>/.exec(body)?.[1];
    result[name] = { value: values.length > 1 ? values : values[0], ...(unit ? { unit } : {}), ...(detail ? { detail: decode(detail) } : {}) };
  }
  return result;
}

function media(block: string): EtimMedia[] {
  return [...block.matchAll(/<UDX\.EDXF\.MIME>([\s\S]*?)<\/UDX\.EDXF\.MIME>/g)].map((match) => {
    const body = match[1];
    const source = /<UDX\.EDXF\.MIME_SOURCE(?: lang="([a-z]+)")?>([^<]*)</.exec(body);
    return {
      code: /<UDX\.EDXF\.MIME_CODE>([^<]*)</.exec(body)?.[1] ?? null,
      source: source ? decode(source[2]) : null,
      lang: source?.[1] ?? null,
      file: tag(body, "UDX.EDXF.MIME_FILENAME"),
      designation: tag(body, "UDX.EDXF.MIME_DESIGNATION"),
    };
  });
}

/** Blok produktu BMEcat → záznam; bez SUPPLIER_PID null. */
export function parseEtimProduct(block: string): EtimProduct | null {
  const pid = tag(block, "SUPPLIER_PID");
  if (!pid) return null;
  return {
    pid,
    gtin: /<INTERNATIONAL_PID type="gtin">([^<]*)</.exec(block)?.[1]?.trim() || null,
    typeCode: tag(block, "MANUFACTURER_TYPE_DESCR"),
    shortCze: tag(block, "DESCRIPTION_SHORT", "cze"),
    longCze: tag(block, "DESCRIPTION_LONG", "cze"),
    shortEng: tag(block, "DESCRIPTION_SHORT", "eng"),
    etimClass: /<REFERENCE_FEATURE_GROUP_ID>(EC\d+)</.exec(block)?.[1] ?? null,
    series: tag(block, "UDX.EDXF.PRODUCT_SERIES"),
    features: features(block),
    media: media(block),
  };
}

/** Objednací číslo pro porovnání (velká písmena, bez mezer a podtržítek – „3558A-A651 B“ = „3558A-A651_B“). */
export const normalizeMpn = (value: string) => value.toUpperCase().replace(/[\s_]+/g, "");

/** Číselná hodnota vlastnosti v dané jednotce (rozsah = první hodnota); null = neuvedeno. */
export function featureNumber(product: Pick<EtimProduct, "features">, name: string, unit?: string): number | null {
  const feature = product.features[name];
  if (!feature || (unit && feature.unit !== unit)) return null;
  const raw = Array.isArray(feature.value) ? feature.value[0] : feature.value;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/**
 * Fotka výrobku: MD01 (jinak MD02), přednostně 720 × 540 / 400 × 400 JPEG / PNG – animovaný „master“ GIF až nakonec.
 * Jen HTTPS adresy (žádné relativní cesty).
 */
export function productPhoto(product: Pick<EtimProduct, "media">): EtimMedia | null {
  const score = (item: EtimMedia) => (item.code === "MD01" ? 10 : item.code === "MD02" ? 5 : 0) + (/_720x540\./.test(item.source ?? "") ? 3 : /_400x400\./.test(item.source ?? "") ? 2 : 0) - (/\.gif(\?|$)/i.test(item.source ?? "") ? 4 : 0);
  const images = product.media.filter((item) => item.source && /^https:\/\//.test(item.source) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(item.source) && (item.code === "MD01" || item.code === "MD02"));
  return [...images].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/** Technický list / návod (MD12 / MD14, česky přednostně) a stránka výrobku (MD04). */
export function productDocuments(product: Pick<EtimProduct, "media">): { datasheet: string | null; page: string | null } {
  const https = (item: EtimMedia) => (item.source && /^https:\/\//.test(item.source) ? item.source : item.source ? `https://${item.source.replace(/^\/+/, "")}` : null);
  const doc = product.media.find((item) => (item.code === "MD12" || item.code === "MD14") && item.lang === "cze") ?? product.media.find((item) => item.code === "MD12" || item.code === "MD14") ?? null;
  const page = product.media.find((item) => item.code === "MD04" && item.lang === "cze") ?? product.media.find((item) => item.code === "MD04") ?? null;
  return { datasheet: doc ? https(doc) : null, page: page ? https(page) : null };
}
