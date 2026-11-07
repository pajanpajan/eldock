// Fáze 63: „🌐 Prohlédnout řadu na webu výrobce ↗“ – oficiální stránky výrobců (adresy ověřené 2026-11-07).
// ABB nemá na nizke-napeti.cz.abb.com samostatné stránky jednotlivých designových řad: odkaz otevře oficiální Katalog
// ABB 2026 (Domovní elektroinstalační materiál, PDF) na straně řady, Zoni má vlastní prospekt, ABB-free@home a
// designové řady free@home vlastní stránky. Ostatní výrobci: stránka řady, kde existuje, jinak katalog výrobce.

import { designSeriesOf } from "./wiring-designs";

export interface SeriesLink {
  url: string;
  /** Co se otevře (stránka řady, katalog na straně …). */
  label: string;
}

export const ABB_CATALOG_2026_URL = "https://nizke-napeti.cz.abb.com/files/document/20641/files/Katalog-ABB_Domovni-elektroinstalacni-material.pdf";
export const ABB_ZONI_URL = "https://nizke-napeti.cz.abb.com/files/document/20206/files/ABB_Prospekt_Zoni.pdf";
export const ABB_SERIES_OVERVIEW_URL = "https://nizke-napeti.cz.abb.com/files/document/18190/files/Brozura-ABB_Prehled-designovych-rad.pdf";
export const ABB_FREEATHOME_URL = "https://new.abb.com/low-voltage/cs/nizke-napeti/produkty/automatizace-bytu-a-budov/produktove-rady/abb-free@home";
export const ABB_FREEATHOME_DESIGNS_URL = "https://new.abb.com/low-voltage/cs/nizke-napeti/produkty/automatizace-bytu-a-budov/produktove-rady/abb-free@home/produkty/designove-rady";
export const ABB_KNX_URL = "https://new.abb.com/low-voltage/products/building-automation/product-range/abb-i-bus-knx";
const SCHNEIDER_CATALOG = "https://www.se.com/cz/cs/download/document/S1873";
const HAGER_LUMINA = "https://hager.com/cz/reseni-a-reference/domovni-elektroinstalacni-pristroje/vypinace-a-zasuvky-lumina";
const HAGER_BERKER = "https://hager.com/cz/reseni-a-reference/domovni-elektroinstalacni-pristroje/spinaci-systemy-berker";
const LEGRAND = "https://www.legrand.cz/";
export const LOXONE_URL = "https://www.loxone.com/cscz/produkty/touch-pure-flex";
export const LOXONE_PRESENCE_URL = "https://www.loxone.com/cscz/?p=84271";
export const LOXONE_SHOP_URL = "https://shop.loxone.com/cscz/";
export const TAPHOME_URL = "https://taphome.com/";
export const TAPHOME_CONTROLLER_URL = "https://taphome.com/datasheets/controller_datasheet_cs.pdf";

/** Stránky řad ostatních výrobců (klíč = název řady v `DESIGN_BRANDS`). */
const OTHER: Record<string, SeriesLink> = {
  "Schneider|Nová Unica": { url: "https://www.se.com/cz/cs/product-range/1268", label: "Schneider Electric – řada Unica" },
  "Schneider|Asfora": { url: "https://www.se.com/cz/cs/product-range/61431-asfora", label: "Schneider Electric – řada Asfora" },
  "Schneider|Sedna Design & Elements": { url: SCHNEIDER_CATALOG, label: "Schneider Electric – katalog domovních přístrojů" },
  "Schneider|Mureva Styl (IP55)": { url: SCHNEIDER_CATALOG, label: "Schneider Electric – katalog domovních přístrojů" },
  "Hager|lumina": { url: HAGER_LUMINA, label: "Hager – vypínače a zásuvky lumina" },
  "Hager|berker S.1 / B.3 / Q.1 / Q.3": { url: HAGER_BERKER, label: "Hager – spínací systémy berker" },
};

/** Odkaz na řadu „výrobce|řada“ (null = řada bez odkazu). */
export function seriesLink(seriesKey: string | null | undefined): SeriesLink | null {
  const found = designSeriesOf(seriesKey);
  if (!found) return null;
  const key = `${found.brand.manufacturer}|${found.series.name}`;
  if (found.brand.manufacturer === "ABB") {
    if (found.series.name === "Zoni") return { url: ABB_ZONI_URL, label: "ABB – prospekt řady Zoni" };
    return found.series.page
      ? { url: `${ABB_CATALOG_2026_URL}#page=${found.series.page}`, label: `Katalog ABB 2026, str. ${found.series.page} (${found.series.name})` }
      : { url: ABB_SERIES_OVERVIEW_URL, label: "ABB – přehled designových řad" };
  }
  if (OTHER[key]) return OTHER[key];
  if (found.brand.manufacturer === "Legrand") return { url: LEGRAND, label: "Legrand ČR – web výrobce" };
  return null;
}

/** Odkaz na produktovou rodinu chytré domácnosti v liště výrobců. */
export function familyLink(familyId: string): SeriesLink | null {
  switch (familyId) {
    case "abb-design":
      return { url: ABB_SERIES_OVERVIEW_URL, label: "ABB – přehled designových řad" };
    case "abb-fah":
      return { url: ABB_FREEATHOME_URL, label: "ABB-free@home – chytrá domácnost" };
    case "abb-knx":
      return { url: ABB_KNX_URL, label: "ABB i-bus KNX" };
    case "loxone":
      return { url: LOXONE_URL, label: "Loxone – Touch Pure Flex a ovládání" };
    case "taphome":
      return { url: TAPHOME_URL, label: "TapHome – web výrobce" };
    default:
      return null;
  }
}
