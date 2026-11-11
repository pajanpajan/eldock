// Fáze 97: které objednací číslo vyfotit pro galerii „Designové řady a barvy“ u řad Schneider Electric a Legrand – z katalogu
// domovních přístrojů (`prisma/external-catalog/wiring.json`, objednací čísla a EAN výrobce): spínač č. 1 (jednoduchý
// kompletní přístroj nebo kryt), zásuvka 1R, rámeček 1R a vícerámeček 2R (jinak 3R) v každé obecné barvě galerie
// (bílá, slonová kost, černá, šedá, hliník, dřevo). Řada / barva bez výrobku v katalogu se přeskočí – nic se nevymýšlí.
// Čisté funkce (sdílí je skript stažení `scripts/discover-and-download-etim.mjs` a parser `scripts/parse-etim-packages.mjs`).

import { DESIGN_BRANDS, DESIGN_COLORS, type DesignBrand } from "../panel-builder/wiring-designs";

export type SeriesPhotoSlot = "switch" | "socket" | "frame" | "set";

export interface WiringRecord {
  brand: string;
  article: string;
  ean: string | null;
  title: string;
  series: string;
  category: string;
  features?: Record<string, unknown>;
}

export interface SeriesPhotoPick {
  /** Klíč řady „Schneider|Asfora“. */
  seriesKey: string;
  /** Obecná barva galerie (`DESIGN_COLORS`). */
  colorId: string;
  part: SeriesPhotoSlot;
  mpn: string;
  ean: string | null;
  title: string;
}

const feature = (record: WiringRecord, name: string) => record.features?.[name];
const text = (record: WiringRecord) => record.title.toLowerCase();

/** Sady, balení po více kusech, IP44 / IP55 varianty a zvláštní provedení se k fotce řady nehodí. */
function plain(record: WiringRecord, ip: string | undefined): boolean {
  if (/^KIT_/i.test(record.article) || /balení|sada|\+ ?poukázka|zdarma/i.test(record.title)) return false;
  const recordIp = String(feature(record, "wd_ip") ?? "");
  if (!ip && /IP4[4-9]|IP5\d|IP6\d/.test(recordIp)) return false;
  return true;
}

/** Pořadí vhodnosti kandidáta (menší = lepší). */
function rank(record: WiringRecord, part: SeriesPhotoSlot): number {
  const role = String(feature(record, "wd_role") ?? "");
  let score = role === "complete" ? 0 : role === "cover" ? 1 : 2;
  const title = text(record);
  // Chytré varianty (with Netatmo, bezdrátové) a zvláštní zásuvky (ploché vidlice Euro) nejsou typický díl řady
  if (/netatmo|bezdrát|wiser|zigbee|euro|ploché vidl/.test(title)) score += 6;
  if (part === "switch") {
    if (/podsvětl|signaliz|doutnav|led|kartov|tlačítk|žaluz|stmív/.test(title)) score += 5;
    if (/bezšroub/.test(title)) score += 0.5;
  }
  if (part === "socket") {
    if (/usb|dvoj|2x|2 ×|ip44|víčk|přepěť|hdmi|data|tv|rj45|nabíj/.test(title)) score += 5;
    if (/bezšroub/.test(title)) score += 0.5;
  }
  if (part === "frame" || part === "set") {
    if (/svisl/.test(title)) score += 0.5;
    if (/ip44|ip55|víčk|dvojzás/.test(title)) score += 5;
  }
  return score;
}

function candidates(records: readonly WiringRecord[], part: SeriesPhotoSlot, ip: string | undefined): WiringRecord[] {
  return records.filter((record) => {
    if (!plain(record, ip)) return false;
    if (part === "switch") return record.category === "WD_SWITCH" && String(feature(record, "wd_switch_no") ?? "") === "1" && Number(feature(record, "wd_rockers") ?? 1) === 1;
    if (part === "socket") return record.category === "WD_SOCKET" && String(feature(record, "wd_cover_kind") ?? "socket") === "socket" && Number(feature(record, "wd_slots") ?? 1) === 1;
    const units = Number(feature(record, "wd_frame_units") ?? 0);
    if (record.category !== "WD_FRAME") return false;
    return part === "frame" ? units === 1 : units === 2 || units === 3;
  });
}

/**
 * Výběr fotek řad výrobců bez vlastních barev řady (Schneider Electric, Legrand): pro každou řadu, obecnou barvu a díl
 * první vhodný výrobek z katalogu domovních přístrojů (vícerámeček přednostně 2R vodorovný).
 */
export function wiringPhotoPicks(records: readonly WiringRecord[], brands: readonly DesignBrand[] = DESIGN_BRANDS, manufacturers: readonly string[] = ["Schneider", "Legrand"]): SeriesPhotoPick[] {
  const picks: SeriesPhotoPick[] = [];
  for (const brand of brands.filter((entry) => manufacturers.includes(entry.manufacturer))) {
    for (const series of brand.series) {
      const own = records.filter((record) => record.brand.toUpperCase() === brand.manufacturer.toUpperCase() && series.dbSeries.includes(record.series));
      if (!own.length) continue;
      for (const color of DESIGN_COLORS) {
        const colored = own.filter((record) => color.families.includes(String(feature(record, "wd_color_family") ?? "")));
        for (const part of ["switch", "socket", "frame", "set"] as const) {
          // Vlastní řada (první název v katalogu, „Valena Life“) před starší řadou se stejným aliasem („Valena“)
          const own = (record: WiringRecord) => (record.series === series.dbSeries[0] ? 0 : 1);
          const list = candidates(colored, part, series.ip).sort((a, b) => own(a) - own(b) || rank(a, part) - rank(b, part) || (part === "set" ? Number(feature(a, "wd_frame_units")) - Number(feature(b, "wd_frame_units")) : 0) || a.article.localeCompare(b.article));
          const best = list[0];
          if (best) picks.push({ seriesKey: `${brand.manufacturer}|${series.name}`, colorId: color.id, part, mpn: best.article, ean: best.ean, title: best.title });
        }
      }
    }
  }
  return picks;
}
