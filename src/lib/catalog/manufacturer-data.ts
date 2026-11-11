// Fáze 97: datové balíčky výrobců (ETIM / BMEcat / XLSX / CSV) a stránky výrobků – čisté funkce sdílené skriptem
// vyhledání a stažení (`scripts/discover-and-download-etim.mjs`) a univerzálním parserem (`scripts/parse-etim-packages.mjs`):
// pravidla robots.txt, druh a zaheslování staženého souboru, kontrola kvality obrázku před uložením (HTTP 200, `image/*`,
// víc než 1,5 kB a platná hlavička JPEG / PNG / WebP / GIF – nikdy chybová stránka HTML), rozpoznání sloupců tabulek
// (objednací číslo, EAN, název, fotka …) a čtení stránek výrobků KOPOS (e-shop) a OEZ (katalog).

// ---------------------------------------------------------------------------------------------------------------------
//  robots.txt
// ---------------------------------------------------------------------------------------------------------------------

export interface RobotsRules {
  allow: string[];
  disallow: string[];
}

/**
 * Pravidla robots.txt pro robota `agent` (skupina s jeho jménem, jinak `*`). Víc skupin `*` (některé weby je opakují) se
 * sloučí. Prázdný `Disallow:` nic nezakazuje.
 */
export function parseRobots(text: string, agent = "*"): RobotsRules {
  const groups: { agents: string[]; allow: string[]; disallow: string[] }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (field === "allow" && value) current.allow.push(value);
    if (field === "disallow" && value) current.disallow.push(value);
  }
  const own = groups.filter((group) => agent !== "*" && group.agents.some((name) => name !== "*" && agent.toLowerCase().includes(name)));
  const chosen = own.length ? own : groups.filter((group) => group.agents.includes("*"));
  return { allow: chosen.flatMap((group) => group.allow), disallow: chosen.flatMap((group) => group.disallow) };
}

/** Vzor robots.txt (`*` = cokoli, `$` = konec) → regulární výraz od začátku cesty. */
function robotsPattern(rule: string): RegExp {
  const anchored = rule.endsWith("$");
  const body = (anchored ? rule.slice(0, -1) : rule)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/** Smí robot na cestu (cesta + dotaz)? Rozhoduje nejdelší shodné pravidlo, při shodě délky `Allow`. */
export function robotsAllows(rules: RobotsRules, pathWithQuery: string): boolean {
  let best: { length: number; allow: boolean } | null = null;
  for (const [list, allow] of [
    [rules.disallow, false],
    [rules.allow, true],
  ] as const) {
    for (const rule of list) {
      if (!robotsPattern(rule).test(pathWithQuery)) continue;
      const length = rule.replace(/[*$]/g, "").length;
      if (!best || length > best.length || (length === best.length && allow)) best = { length, allow };
    }
  }
  return best ? best.allow : true;
}

// ---------------------------------------------------------------------------------------------------------------------
//  Druh staženého souboru
// ---------------------------------------------------------------------------------------------------------------------

export type PackageKind = "zip" | "xlsx" | "xml" | "csv" | "json" | "encrypted-office" | "html" | "pdf" | "unknown";

const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((value, index) => bytes[index] === value);

/**
 * Druh souboru podle prvních bajtů a přípony: ZIP (i BMEcat v ZIPu) / XLSX (také ZIP), XML, CSV, JSON, HTML (chybová
 * stránka místo souboru), PDF, zaheslovaný soubor Office (XLSX s heslem je kontejner OLE `D0 CF 11 E0`).
 */
export function packageKind(name: string, head: Uint8Array): PackageKind {
  const lower = name.toLowerCase().replace(/[?#].*$/, "");
  if (startsWith(head, [0x50, 0x4b, 0x03, 0x04]) || startsWith(head, [0x50, 0x4b, 0x05, 0x06])) return /\.xlsx?$|\.xlsm$/.test(lower) ? "xlsx" : "zip";
  if (startsWith(head, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "encrypted-office";
  if (startsWith(head, [0x25, 0x50, 0x44, 0x46])) return "pdf";
  const text = new TextDecoder("utf-8").decode(head.slice(0, 512)).replace(/^﻿/, "").trimStart().toLowerCase();
  if (text.startsWith("<!doctype html") || text.startsWith("<html")) return "html";
  if (text.startsWith("<?xml") || text.startsWith("<bmecat")) return "xml";
  if (text.startsWith("{") || text.startsWith("[")) return "json";
  if (/\.csv$|\.txt$/.test(lower)) return "csv";
  return "unknown";
}

/** Je položka ZIPu zašifrovaná (bit 0 příznaků lokální hlavičky – archiv chce heslo)? */
export const zipEntryEncrypted = (localHeader: Uint8Array) => localHeader.length >= 8 && (localHeader[6] & 1) === 1;

// ---------------------------------------------------------------------------------------------------------------------
//  Kontrola kvality obrázku
// ---------------------------------------------------------------------------------------------------------------------

export type ImageFormat = "jpeg" | "png" | "webp" | "gif" | "avif";

/** Nejmenší přijatá fotka [B] – menší soubory bývají zástupné ikony („obrázek není k dispozici“) nebo chybové odpovědi. */
export const MIN_IMAGE_BYTES = 1536;

/** Formát obrázku podle hlavičky (magic bytes); null = není obrázek (HTML, JSON, prázdný soubor …). */
export function imageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes.slice(8), [0x57, 0x45, 0x42, 0x50])) return "webp";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (bytes.length > 12 && new TextDecoder().decode(bytes.slice(4, 12)).startsWith("ftypavi")) return "avif";
  return null;
}

/**
 * Proč obrázek nepřijmout (null = v pořádku): stav HTTP 200, `Content-Type: image/*` (u položky archivu bez hlavičky
 * se typ nekontroluje), velikost nad 1,5 kB a platná hlavička obrázku.
 */
export function imageProblem(input: { status?: number; contentType?: string | null; bytes: Uint8Array }): string | null {
  if (input.status !== undefined && input.status !== 200) return `HTTP ${input.status}`;
  if (input.contentType !== undefined && !/^image\//i.test(input.contentType ?? "")) return `Content-Type ${input.contentType || "chybí"}`;
  if (input.bytes.length <= MIN_IMAGE_BYTES) return `jen ${input.bytes.length} B (zástupná ikona / prázdná odpověď)`;
  if (!imageFormat(input.bytes)) return "neplatná hlavička obrázku (např. chybová stránka HTML)";
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
//  Tabulky XLSX / CSV – rozpoznání sloupců
// ---------------------------------------------------------------------------------------------------------------------

export type ColumnRole = "mpn" | "ean" | "name" | "description" | "series" | "image" | "datasheet" | "price" | "etimClass" | "page";

const COLUMN_PATTERNS: readonly [ColumnRole, RegExp][] = [
  ["mpn", /^(položka|objednací (číslo|kód)|obj\.? ?č(íslo)?\.?|supplier_pid|mpn|artikl|article( ?number)?|comrefname|kód( zboží| výrobku)?|reference|ref\.?|typ(ové)? ?(označení)?)$/i],
  ["ean", /^(ean( kód)?|gtin|ean\/gtin|packtypel0ean|čárový kód)$/i],
  ["name", /^(název( položky| výrobku| zboží)?|shortdescription|description_short|krátký popis|name)$/i],
  ["description", /^(popis|longdescription|description_long|dlouhý popis|popis výrobku)$/i],
  ["series", /^(řada|design|series|product_series|produktová řada)$/i],
  ["image", /(obrázek|fotka|image|picture|mainpicture|mime_source|foto)/i],
  ["datasheet", /(datasheet|datový list|technický list|katalogový list)/i],
  ["page", /^(product page|odkaz|url|stránka výrobku)$/i],
  ["price", /(cena|price|ceník)/i],
  ["etimClass", /^(etim ?class|třída etim|etim)$/i],
];

/** Sloupce záhlaví → role (první shoda vyhrává; obrázek a technický list jen se zjevným názvem). */
export function detectColumns(header: readonly string[]): Partial<Record<ColumnRole, number>> {
  const result: Partial<Record<ColumnRole, number>> = {};
  header.forEach((raw, index) => {
    const cell = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!cell) return;
    for (const [role, pattern] of COLUMN_PATTERNS) {
      if (result[role] === undefined && pattern.test(cell)) {
        result[role] = index;
        break;
      }
    }
  });
  return result;
}

/** Řádek záhlaví tabulky – první řádek se sloupcem objednacího čísla a aspoň jedním dalším známým sloupcem. */
export function findHeaderRow(rows: readonly (readonly string[])[], maxScan = 40): number {
  for (let index = 0; index < Math.min(rows.length, maxScan); index++) {
    const columns = detectColumns(rows[index] ?? []);
    if (columns.mpn !== undefined && Object.keys(columns).length >= 2) return index;
  }
  return -1;
}

/** Platný EAN / GTIN (8, 12, 13 nebo 14 číslic s kontrolní číslicí). */
export function validGtin(value: string | null | undefined): boolean {
  const digits = String(value ?? "").trim();
  if (!/^(\d{8}|\d{12,14})$/.test(digits)) return false;
  const body = digits.slice(0, -1).split("").reverse();
  const sum = body.reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(digits.at(-1));
}

// ---------------------------------------------------------------------------------------------------------------------
//  Stránky výrobků
// ---------------------------------------------------------------------------------------------------------------------

const decodeEntities = (text: string) =>
  text
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&([a-z]+);/gi, (entity: string, name: string) => NAMED_ENTITIES[name] ?? entity)
    .replace(/&amp;/g, "&");

const NAMED_ENTITIES: Record<string, string> = {
  aacute: "á", Aacute: "Á", eacute: "é", Eacute: "É", iacute: "í", Iacute: "Í", oacute: "ó", Oacute: "Ó", uacute: "ú", Uacute: "Ú", yacute: "ý", Yacute: "Ý",
  ecaron: "ě", Ecaron: "Ě", scaron: "š", Scaron: "Š", ccaron: "č", Ccaron: "Č", rcaron: "ř", Rcaron: "Ř", zcaron: "ž", Zcaron: "Ž", ncaron: "ň", Ncaron: "Ň",
  dcaron: "ď", Dcaron: "Ď", tcaron: "ť", Tcaron: "Ť", uring: "ů", Uring: "Ů", laquo: "«", raquo: "»", ndash: "–", mdash: "—", times: "×", deg: "°", reg: "®",
};

/** Text buňky HTML (bez značek, entity převedené, mezery sloučené). */
export const cellText = (html: string) => decodeEntities(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** Dvojice popisek → hodnota z řádků tabulek `<tr><td>Popisek</td><td>Hodnota</td></tr>` (první výskyt popisku). */
export function tableParams(html: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const row of html.matchAll(/<tr\b[^>]*>\s*<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>\s*<td\b[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)) {
    const label = cellText(row[1]).replace(/:$/, "");
    const value = cellText(row[2]);
    if (label && label.length <= 80 && !(label in params)) params[label] = value;
  }
  return params;
}

/** Číslo v milimetrech („45 mm“, „79,7 mm“, „0,045 m“); null = neuvedeno. */
export function millimetres(value: string | null | undefined): number | null {
  const match = /(-?\d+(?:[.,]\d+)?)\s*(mm|cm|m)\b/i.exec(String(value ?? ""));
  if (!match) return null;
  const number = Number(match[1].replace(",", "."));
  const factor = match[2].toLowerCase() === "m" ? 1000 : match[2].toLowerCase() === "cm" ? 10 : 1;
  return Number.isFinite(number) ? Math.round(number * factor * 10) / 10 : null;
}

const absolute = (href: string, base: string) => {
  try {
    return new URL(decodeEntities(href), base).toString();
  } catch {
    return null;
  }
};

/** Bezhalogenové provedení podle objednacího kódu KOPOS („KU 68-45/HF_HA“, „KPL 64-50/2LD HF_KA“, „5316EHF_FBP“). */
export const halogenFreeCode = (code: string) => /(^|[\s/-]|\d)E?HF($|[\s_/-])/.test(code);

export interface KoposProduct {
  /** Objednací kód („KU 68-45_KA“). */
  code: string;
  /** Typ bez kódu barvy / balení („KU 68-45“). */
  type: string;
  name: string;
  ean: string | null;
  params: Record<string, string>;
  depthMm: number | null;
  diameterMm: number | null;
  material: string | null;
  /** Bezhalogenová (HF v označení nebo v parametrech). */
  halogenFree: boolean;
  /** Hlavní fotka výrobku (plné rozlišení), výkres zvlášť. */
  image: string | null;
  drawing: string | null;
  datasheet: string | null;
  page: string;
}

/** Stránka výrobku e-shopu KOPOS (`/cs/produkt/<id>-<název>`) → záznam; null = není stránka výrobku. */
export function parseKoposProductPage(html: string, url: string): KoposProduct | null {
  const code = cellText(/<div class="undertitle">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "") || cellText(/<title>([^<|]+)/.exec(html)?.[1] ?? "");
  if (!code || !/<td>EAN kód<\/td>/.test(html)) return null;
  const name = cellText(/<h1[^>]*id="page-title"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  const params = tableParams(html);
  const images = [...html.matchAll(/href="(https?:\/\/www\.kopos\.cz\/sites\/default\/files\/product\/[^"]+\.(?:jpe?g|png|webp))"/gi)].map((match) => match[1]);
  const photo = images.find((src) => !/vykres|_vyk|drawing|rozmer/i.test(src)) ?? null;
  const drawing = images.find((src) => /vykres|_vyk|rozmer/i.test(src)) ?? null;
  const datasheetBlock = /<caption>Datový list<\/caption>([\s\S]*?)<\/table>/.exec(html)?.[1] ?? "";
  const datasheets = [...datasheetBlock.matchAll(/href="([^"]+\.pdf)"/gi)].map((match) => match[1]);
  const ean = (params["EAN kód"] ?? "").replace(/\s+/g, "");
  const material = params["Materiál"] || null;
  const halogenFree = halogenFreeCode(code) || /bezhalogen/i.test(`${name} ${material ?? ""} ${params["Bezhalogenový materiál"] ?? ""}`) || /^ano$/i.test(params["Bezhalogenový materiál"] ?? "");
  return {
    code,
    type: code.replace(/_[A-Z]{2}$/, "").trim(),
    name,
    ean: validGtin(ean) ? ean : null,
    params,
    depthMm: millimetres(params["Hloubka"] ?? params["Vnitřní hloubka"] ?? params["Instalační hloubka"]),
    diameterMm: millimetres(params["Průměr"] ?? params["Vnitřní průměr"]),
    material,
    halogenFree,
    image: photo,
    drawing,
    datasheet: datasheets.find((href) => /_cz\.pdf$/i.test(href)) ?? datasheets[0] ?? null,
    page: url,
  };
}

export interface OezProduct {
  /** Typové označení („LTN-16B-1“). */
  type: string;
  /** Objednací kód bez předpony („46634“). */
  orderCode: string | null;
  ean: string | null;
  description: string | null;
  params: Record<string, string>;
  modules: number | null;
  poles: number | null;
  widthMm: number | null;
  heightMm: number | null;
  depthMm: number | null;
  ip: string | null;
  image: string | null;
  page: string;
}

/** Stránka výrobku katalogu OEZ (`https://www.oez.cz/<typ>`) → záznam; null = není stránka výrobku. */
export function parseOezProductPage(html: string, url: string): OezProduct | null {
  const type = cellText(/<h1 itemprop="name">([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? "");
  if (!type) return null;
  const cells = [...html.matchAll(/<td class="td_katalog_detail_polozka">([\s\S]*?)<\/td>/g)].map((match) => cellText(match[1]));
  const orderCode = cells.map((cell) => /^OEZ:(\S+)$/.exec(cell)?.[1]).find(Boolean) ?? null;
  const ean = cells.find((cell) => validGtin(cell)) ?? null;
  const params = tableParams(html);
  const number = (label: string) => {
    const value = Number((params[label] ?? "").replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  };
  const href = /<a href="([^"]+)"[^>]*id="det-img-a"/.exec(html)?.[1] ?? /<a href="(pic_zbozi\/[^"]+)"/.exec(html)?.[1] ?? null;
  return {
    type,
    orderCode,
    ean,
    description: cellText(/<div class="kratky_popis"><div class="popis_label">[^<]*<\/div>([\s\S]*?)<\/div>/.exec(html)?.[1] ?? "") || null,
    params,
    modules: number("Počet modulů"),
    poles: number("Počet pólů"),
    widthMm: millimetres(params["Šířka (netto)"] ?? params["Šířka"]),
    heightMm: millimetres(params["Výška (netto)"] ?? params["Výška"]),
    depthMm: millimetres(params["Hloubka (netto)"] ?? params["Hloubka"]),
    ip: /^IP\d{2}[A-Z]?$/.test(params["Krytí"] ?? "") ? params["Krytí"] : null,
    image: href ? absolute(href, "https://www.oez.cz/") : null,
    page: url,
  };
}

/** Slug stránky výrobku OEZ z typového označení („LTN-1,6B-1“ i „LTN-16B-1“ → „ltn-16b-1“ – rozliší až stránka). */
export const oezSlug = (type: string) =>
  type
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[,.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
