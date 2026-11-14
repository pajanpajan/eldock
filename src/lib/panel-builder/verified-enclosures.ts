// Fáze 86: ověřené rozvodnice z oficiálních katalogů výrobců pro kaskádu výběru skříně (fáze 85) – ABB ComfortLine CA,
// Hager vector II a univers FWU, Schrack TOPO; fáze 88 přidala ABB Mistral41W / 41F, Mistral65 / 65H a ComfortLine CU. Každý typ má objednací číslo výrobce, řady × moduly v řadě, V × Š × H,
// krytí, montáž, materiál, P_max (jen kde ho výrobce uvádí) a odkaz na stránku výrobce, ze které údaje jsou (ověřeno
// 10. 11. 2026). Typ, u kterého výrobce údaje neuvádí nebo je uvádí rozporně, tu není – nic se nedopočítává.
// Mimo: ABB Unifix (připojovací systém, ne rozvodnice), ComfortLine CW a Eaton DBP / DBM (v katalozích výrobců nejsou),
// Rittal AX / KX (kompaktní skříně bez řad modulů – přístroje na DIN lištu jen přes samostatné moduly Ri4Power ISV).
// Čistá data; seed `seedVerifiedEnclosures` (`server/services/catalog-sync.ts`).

import { EATON_ENCLOSURES, OEZ_ENCLOSURES, SCHNEIDER_ENCLOSURES } from "./verified-enclosures-oez-se-eaton";

/** `PanelEnclosure.dataSource` ověřených rozvodnic – import externí databáze ani orientační matice je nepřepíše. */
export const VERIFIED_ENCLOSURE_SOURCE = "MANUFACTURER_CATALOG";
export const VERIFIED_ON = "2026-11-10";

export interface VerifiedEnclosure {
  /** Fáze 113: + OEZ, Schneider a Eaton (`verified-enclosures-oez-se-eaton.ts`). */
  manufacturer: "ABB" | "Hager" | "Schrack" | "OEZ" | "Schneider" | "Eaton";
  series: string;
  /** Typové označení výrobce (u vícepolových skříní s počtem polí). */
  model: string;
  /** Objednací číslo výrobce (MPN). */
  articleNumber: string;
  rows: number;
  /** Moduly v řadě přes celou šířku (u vícepolových skříní součet polí po 12 M). */
  modulesPerRow: number;
  totalModules: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  ipRating: string;
  installation: "SURFACE" | "FLUSH" | "HOLLOW_WALL";
  material: "PLASTIC" | "PAINTED_STEEL";
  /** Max. ztrátový výkon skříně podle výrobce; null = výrobce ho neuvádí. */
  pMaxW: number | null;
  /** Fáze 113: EAN / GTIN a ceníková cena bez DPH [Kč] – jen z oficiálních dat výrobce. */
  ean?: string | null;
  listPriceCzk?: number | null;
  dataSource: typeof VERIFIED_ENCLOSURE_SOURCE;
  /** Popis z údajů výrobce + „Zdroj: <adresa>“ (čte ho i náhled dvířek `doorOf`). */
  description: string;
  sourceUrl: string;
}

const rowsWord = (rows: number) => (rows === 1 ? "řada" : rows <= 4 ? "řady" : "řad");
const fieldsText = (fields: number) => (fields > 1 ? ` (${fields} pole po 12 M)` : "");
const sourceNote = (url: string) => `Zdroj: ${url} (ověřeno ${VERIFIED_ON})`;

function verified(spec: Omit<VerifiedEnclosure, "totalModules" | "dataSource" | "description"> & { about: string }): VerifiedEnclosure {
  const { about, ...rest } = spec;
  return { ...rest, totalModules: spec.rows * spec.modulesPerRow, dataSource: VERIFIED_ENCLOSURE_SOURCE, description: `${about}. ${sourceNote(spec.sourceUrl)}` };
}

// ---------------------------------------------------------------------------
//  ABB ComfortLine CA – nástěnné oceloplechové rozvodnice (nizke-napeti.cz.abb.com)
//  Údaje stránek: počet sloupců (polí po 12 M), řad a modulů, vnější rozměry š × v × h, IP 44, IK 07, RAL 9016, do 125 A.
// ---------------------------------------------------------------------------

/** [typ, objednací číslo, sloupce (pole po 12 M), řady, šířka, výška] – hloubka všech 160 mm. */
type AbbRow = [string, string, number, number, number, number];

const ABB_CA_125: AbbRow[] = [
  ["CA13V", "2CPX052180R9999", 1, 3, 300, 500],
  ["CA14V", "2CPX052181R9999", 1, 4, 300, 650],
  ["CA15V", "2CPX052182R9999", 1, 5, 300, 800],
  ["CA16V", "2CPX052183R9999", 1, 6, 300, 950],
  ["CA23V", "2CPX052184R9999", 2, 3, 550, 500],
  ["CA24V", "2CPX052185R9999", 2, 4, 550, 650],
  ["CA25V", "2CPX052186R9999", 2, 5, 550, 800],
  ["CA26V", "2CPX052187R9999", 2, 6, 550, 950],
  ["CA27V", "2CPX052188R9999", 2, 7, 550, 1100],
  ["CA28V", "2CPX052189R9999", 2, 8, 550, 1250],
  ["CA34V", "2CPX052190R9999", 3, 4, 800, 650],
  ["CA35V", "2CPX052191R9999", 3, 5, 800, 800],
  ["CA36V", "2CPX052192R9999", 3, 6, 800, 950],
  ["CA37V", "2CPX052193R9999", 3, 7, 800, 1100],
  ["CA38V", "2CPX052194R9999", 3, 8, 800, 1250],
  ["CA45V", "2CPX052195R9999", 4, 5, 1050, 800],
];

const ABB_CA_150: AbbRow[] = [
  ["CA14R", "2CPX052229R9999", 1, 3, 300, 650],
  ["CA15R", "2CPX052230R9999", 1, 4, 300, 800],
  ["CA16R", "2CPX052231R9999", 1, 5, 300, 950],
  ["CA17R", "2CPX052232R9999", 1, 6, 300, 1100],
  ["CA23R", "2CPX052234R9999", 2, 2, 550, 500],
  ["CA24R", "2CPX052235R9999", 2, 3, 550, 650],
  ["CA25R", "2CPX052236R9999", 2, 4, 550, 800],
  ["CA26R", "2CPX052237R9999", 2, 5, 550, 950],
  ["CA27R", "2CPX052238R9999", 2, 6, 550, 1100],
  ["CA28R", "2CPX052239R9999", 2, 7, 550, 1250],
  ["CA34R", "2CPX052240R9999", 3, 3, 800, 650],
  ["CA35R", "2CPX052241R9999", 3, 4, 800, 800],
  ["CA36R", "2CPX052242R9999", 3, 5, 800, 950],
  ["CA37R", "2CPX052243R9999", 3, 6, 800, 1100],
  ["CA38R", "2CPX052244R9999", 3, 7, 800, 1250],
];

const ABB_CATEGORY = {
  125: "https://nizke-napeti.cz.abb.com/rozvodnice-s-rozteci-125-mm-mezi-listami-din-nastenne-oceloplechove-19601/",
  150: "https://nizke-napeti.cz.abb.com/rozvodnice-s-rozteci-150-mm-mezi-listami-din-nastenne-oceloplechove-19965/",
} as const;

const abbComfortLine = (spacing: 125 | 150, rows: readonly AbbRow[]) =>
  rows.map(([type, mpn, columns, rowCount, width, height]) =>
    verified({
      manufacturer: "ABB",
      series: `ComfortLine CA (rozteč ${spacing} mm)`,
      model: `${type}${fieldsText(columns)}`,
      articleNumber: mpn,
      rows: rowCount,
      modulesPerRow: columns * 12,
      widthMm: width,
      heightMm: height,
      depthMm: 160,
      ipRating: "IP44",
      installation: "SURFACE",
      material: "PAINTED_STEEL",
      pMaxW: null,
      sourceUrl: `${ABB_CATEGORY[spacing]}${type.toLowerCase()}-rozvodnice-nastenna-s-dvirky-${mpn.toLowerCase()}`,
      about: `ABB ComfortLine ${type} – nástěnná oceloplechová rozvodnice s ocelovými dvířky, ${rowCount} ${rowsWord(rowCount)} × ${columns} ${columns === 1 ? "sloupec" : columns <= 4 ? "sloupce" : "sloupců"} po 12 M, rozteč lišt DIN ${spacing} mm, N/PE svorky, IK 07, RAL 9016, In do 125 A`,
    }),
  );

// ---------------------------------------------------------------------------
//  Fáze 88: ABB Mistral41 / Mistral65 / Mistral65H (plast) a ComfortLine CU (zapuštěné, ocel) – nizke-napeti.cz.abb.com
//  Údaje stránek: typové a objednací číslo, počet sloupců, řad a modulů „(moduly v řadě × řady)“, vnější rozměry
//  š × v × h, stupeň krytí, jmenovitý proud. Vynechané: multimediální CU…VMW a svorkové CU…K (část skříně bez modulů).
// ---------------------------------------------------------------------------

/** [typové číslo, objednací číslo, řady, moduly v řadě, šířka, výška, hloubka, jmenovitý proud A]. */
type MistralRow = [string, string, number, number, number, number, number, number];

const ABB_CZ = "https://nizke-napeti.cz.abb.com/";

const MISTRAL41W_TRANSPARENT: MistralRow[] = [
  ["41P12X12A", "1SPE007717F0421", 1, 12, 297, 262, 119, 63],
  ["41P12X22A", "1SPE007717F0821", 1, 18, 387, 262, 119, 63],
  ["41P12X32A", "1SPE007717F0521", 2, 12, 297, 387, 119, 63],
  ["41P12X42A", "1SPE007717F0921", 2, 18, 387, 387, 119, 63],
  ["41P18X12A", "1SPE007717F0621", 3, 12, 297, 512, 119, 63],
  ["41P18X22A", "1SPE007717F0721", 4, 12, 297, 659, 119, 63],
  ["41P18X32A", "1SPE007717F1021", 3, 18, 387, 512, 119, 63],
  ["41P18X42A", "1SPE007717F1121", 4, 18, 387, 659, 119, 63],
];
const MISTRAL41W_SOLID: MistralRow[] = [
  ["41P12X11A", "1SLM004102A3103", 1, 12, 297, 262, 119, 63],
  ["41P12X21A", "1SLM004102A3104", 1, 18, 387, 262, 119, 63],
  ["41P12X31A", "1SLM004102A3105", 2, 12, 297, 387, 119, 63],
  ["41P12X41A", "1SLM004102A3106", 2, 18, 387, 387, 119, 63],
  ["41P18X11A", "1SLM004102A3107", 3, 12, 297, 512, 119, 63],
  ["41P18X21A", "1SLM004102A3108", 4, 12, 297, 659, 119, 63],
  ["41P18X31A", "1SLM004102A3109", 3, 18, 387, 512, 119, 63],
  ["41P18X41A", "1SLM004102A3110", 4, 18, 387, 659, 119, 63],
];
const MISTRAL41F_TRANSPARENT: MistralRow[] = [
  ["41A12X12A", "1SLM004101A1203", 1, 12, 320, 250, 107, 63],
  ["41A18X12A", "1SLM004101A1204", 1, 18, 430, 250, 107, 125],
  ["41A12X22A", "1SLM004101A1205", 2, 12, 320, 435, 107, 63],
  ["41A18X22A", "1SLM004101A1206", 2, 18, 430, 435, 107, 125],
  ["41A12X32A", "1SLM004101A1207", 3, 12, 320, 600, 107, 100],
  ["41A12X42A", "1SLM004101A1208", 4, 12, 320, 735, 107, 100],
  ["41A18X32A", "1SLM004101A1209", 3, 18, 430, 600, 127, 125],
  ["41A18X42A", "1SLM004101A1210", 4, 18, 430, 735, 127, 125],
];
const MISTRAL41F_SOLID: MistralRow[] = [
  ["41A12X11A", "1SLM004102A1103", 1, 12, 320, 250, 107, 63],
  ["41A18X11A", "1SLM004102A1104", 1, 18, 430, 250, 107, 125],
  ["41A12X21A", "1SLM004102A1105", 2, 12, 320, 435, 107, 63],
  ["41A18X21A", "1SLM004102A1106", 2, 18, 430, 435, 107, 125],
  ["41A12X31A", "1SLM004102A1107", 3, 12, 320, 600, 107, 100],
  ["41A12X41A", "1SLM004102A1108", 4, 12, 320, 735, 107, 100],
  ["41A18X31A", "1SLM004102A1109", 3, 18, 430, 600, 127, 125],
  ["41A18X41A", "1SLM004102A1110", 4, 18, 430, 735, 127, 125],
];
const MISTRAL65: MistralRow[] = [
  ["65P12X12A", "1SLM006501A1202", 1, 12, 320, 250, 155, 63],
  ["65P18X12A", "1SLM006502A1203", 1, 18, 430, 250, 155, 125],
  ["65P12X22A", "1SLM006502A1204", 2, 12, 320, 435, 155, 125],
  ["65P18X22A", "1SLM006501A1205", 2, 18, 430, 435, 155, 125],
  ["65P12X32A", "1SLM006501A1206", 3, 12, 320, 600, 155, 125],
  ["65P12X42A", "1SLM006501A1207", 4, 12, 320, 735, 155, 125],
  ["65P18X32A", "1SLM006501A1208", 3, 18, 430, 600, 155, 125],
  ["65P18X42A", "1SLM006501A1209", 4, 18, 430, 735, 155, 125],
];
const MISTRAL65H: MistralRow[] = [
  ["H65P04X120750", "1SLM006500A2210", 1, 4, 152, 202, 117, 63],
  ["H65P08X120750", "1SLM006500A2211", 1, 8, 232, 250, 154, 63],
  ["H65P12X120750", "1SLM006500A2212", 1, 12, 320, 250, 155, 63],
  ["H65P18X120750", "1SLM006500A2213", 1, 18, 430, 250, 155, 125],
  ["H65P12X220750", "1SLM006500A2214", 2, 12, 320, 435, 155, 125],
  ["H65P18X220750", "1SLM006500A2215", 2, 18, 430, 435, 155, 125],
  ["H65P12X320750", "1SLM006500A2216", 3, 12, 320, 600, 155, 125],
  ["H65P12X420750", "1SLM006500A2217", 4, 12, 320, 735, 155, 125],
  ["H65P18X320750", "1SLM006500A2218", 3, 18, 430, 600, 155, 125],
  ["H65P18X420750", "1SLM006500A2219", 4, 18, 430, 735, 155, 125],
];

const abbMistral = (spec: { series: "Mistral41W" | "Mistral41F" | "Mistral65" | "Mistral65H"; category: string; slug: string; installation: "SURFACE" | "FLUSH"; ip: string; door: "průhledná" | "plná"; withDoorInModel: boolean }, rows: readonly MistralRow[]) =>
  rows.map(([type, mpn, rowCount, perRow, width, height, depth, current]) =>
    verified({
      manufacturer: "ABB",
      series: spec.series,
      model: `${spec.series} ${type}${spec.withDoorInModel ? ` (${spec.door} dvířka)` : ""}`,
      articleNumber: mpn,
      rows: rowCount,
      modulesPerRow: perRow,
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      ipRating: spec.ip,
      installation: spec.installation,
      material: "PLASTIC",
      pMaxW: null,
      sourceUrl: `${ABB_CZ}${spec.category}/${type.toLowerCase()}-${spec.slug}-${mpn.toLowerCase()}`,
      about: `ABB ${spec.series} ${type} – ${spec.installation === "SURFACE" ? "nástěnná" : "zapuštěná"} plastová rozvodnice, ${spec.door} dvířka, ${rowCount} ${rowsWord(rowCount)} × ${perRow} M, ${spec.ip.replace("IP", "IP ")}, In do ${current} A`,
    }),
  );

/** ComfortLine CU (zapuštěné, ocelová dvířka, IP 30, do 125 A): [typ, objednací číslo, sloupce po 12 M, řady, šířka, výška] – hloubka 125 mm. */
type CuRow = [string, string, number, number, number, number];

const ABB_CU_125: CuRow[] = [
  ["CU14V", "2CPX052607R9999", 1, 4, 365, 714],
  ["CU15V", "2CPX052608R9999", 1, 5, 365, 864],
  ["CU16V", "2CPX052609R9999", 1, 6, 365, 1014],
  ["CU17V", "2CPX052610R9999", 1, 7, 365, 1164],
  ["CU23V", "2CPX052612R9999", 2, 3, 615, 564],
  ["CU24V", "2CPX052613R9999", 2, 4, 615, 714],
  ["CU25V", "2CPX052614R9999", 2, 5, 615, 864],
  ["CU26V", "2CPX052615R9999", 2, 6, 615, 1014],
  ["CU27V", "2CPX052616R9999", 2, 7, 615, 1164],
  ["CU28V", "2CPX052617R9999", 2, 8, 615, 1314],
  ["CU34V", "2CPX052618R9999", 3, 4, 865, 714],
  ["CU35V", "2CPX052619R9999", 3, 5, 865, 864],
  ["CU36V", "2CPX052620R9999", 3, 6, 865, 1014],
  ["CU37V", "2CPX052621R9999", 3, 7, 865, 1164],
  ["CU45V", "2CPX052622R9999", 4, 5, 1115, 864],
];
const ABB_CU_150: CuRow[] = [
  ["CU24R", "2CPX052600R9999", 2, 3, 615, 714],
  ["CU25R", "2CPX052601R9999", 2, 4, 615, 864],
  ["CU26R", "2CPX052602R9999", 2, 5, 615, 1014],
  ["CU27R", "2CPX052603R9999", 2, 6, 615, 1164],
  ["CU28R", "2CPX052604R9999", 2, 7, 615, 1314],
  ["CU36R", "2CPX052605R9999", 3, 5, 865, 1014],
  ["CU37R", "2CPX052606R9999", 3, 6, 865, 1164],
];

const ABB_CU_CATEGORY = {
  125: "rozvodnice-s-rozteci-125-mm-mezi-listami-din-zapustene-oceloplechove-20908/",
  150: "rozvodnice-s-rozteci-150-mm-mezi-listami-din-zapustene-oceloplechove-20909/",
} as const;

const abbComfortLineCu = (spacing: 125 | 150, rows: readonly CuRow[]) =>
  rows.map(([type, mpn, columns, rowCount, width, height]) =>
    verified({
      manufacturer: "ABB",
      series: `ComfortLine CU (rozteč ${spacing} mm)`,
      model: `${type}${fieldsText(columns)}`,
      articleNumber: mpn,
      rows: rowCount,
      modulesPerRow: columns * 12,
      widthMm: width,
      heightMm: height,
      depthMm: 125,
      ipRating: "IP30",
      installation: "FLUSH",
      material: "PAINTED_STEEL",
      pMaxW: null,
      sourceUrl: `${ABB_CZ}${ABB_CU_CATEGORY[spacing]}${type.toLowerCase()}-rozvodnice-zapustena-s-dvirky-${mpn.toLowerCase()}`,
      about: `ABB ComfortLine ${type} – zapuštěná oceloplechová rozvodnice s ocelovými dvířky, ${rowCount} ${rowsWord(rowCount)} × ${columns} ${columns === 1 ? "sloupec" : "sloupce"} po 12 M, rozteč lišt DIN ${spacing} mm, IP 30, In do 125 A`,
    }),
  );

// ---------------------------------------------------------------------------
//  Hager (hager.com/cz) – technické vlastnosti stránky výrobku: montáž, počet řad, modulů a jednotek šířky, polí,
//  výška × šířka × hloubka, materiál, průhlednost dveří, stupeň krytí IP, jmenovitý proud.
// ---------------------------------------------------------------------------

const HAGER = "https://hager.com/cz/katalog/produkt/";

/** vector II UV-stabilní bez perforace: [reference, adresa stránky, řady, moduly v řadě, výška, šířka, hloubka]. */
const VECTOR_II: [string, string, number, number, number, number, number][] = [
  ["VE106SN", "ve106sn-rozvod-nasten-uv-vector-ii-ip65-6m", 1, 6, 190, 165, 113],
  ["VE110SN", "ve110sn-rozvod-nasten-uv-vector-ii-ip65-10m", 1, 10, 210, 237, 114],
  ["VE112SN", "ve112sn-rozvod-nasten-uv-vector-ii-ip65-12m", 1, 12, 302, 310, 151],
  ["VE118SN", "ve118sn-rozvod-nasten-uv-vector-ii-ip65-18m", 1, 18, 302, 418, 151],
  ["VE212SN", "ve212sn-rozvod-nasten-uv-vector-ii-ip65-24m", 2, 12, 427, 310, 151],
  ["VE218SN", "ve218sn-rozvod-nasten-uv-vector-ii-p65-36mod", 2, 18, 452, 418, 151],
  ["VE312SN", "ve312sn-rozvod-nasten-uv-vector-ii-ip65-36m", 3, 12, 552, 310, 151],
  ["VE318SN", "ve318sn-rozvod-nasten-uv-vector-ii-ip65-54m", 3, 18, 602, 418, 151],
  ["VE412SN", "ve412sn-rozvod-nasten-uv-vector-ii-ip65-48m", 4, 12, 677, 310, 151],
];

/**
 * univers FWU zapuštěné (i do duté příčky), třída izolace II: [reference, řady, pole po 12 M, výška, šířka] – hloubka 125 mm.
 * FWU73S chybí: výrobce u něj uvádí 21 řad (252 M = 7 řad × 36 M).
 */
const UNIVERS_FWU: [string, number, number, number, number][] = [
  ["FWU31S", 3, 1, 553, 353],
  ["FWU41S", 4, 1, 703, 353],
  ["FWU51S", 5, 1, 853, 353],
  ["FWU61S", 6, 1, 1003, 353],
  ["FWU71S", 7, 1, 1153, 353],
  ["FWU32S", 3, 2, 553, 603],
  ["FWU42S", 4, 2, 703, 603],
  ["FWU52S", 5, 2, 853, 603],
  ["FWU62S", 6, 2, 1003, 603],
  ["FWU72S", 7, 2, 1153, 603],
  ["FWU33S", 3, 3, 553, 853],
  ["FWU43S", 4, 3, 703, 853],
  ["FWU53S", 5, 3, 853, 853],
  ["FWU63S", 6, 3, 1003, 853],
];

const hagerVector = VECTOR_II.map(([ref, slug, rows, perRow, height, width, depth]) =>
  verified({
    manufacturer: "Hager",
    series: "Vector II",
    model: `Vector II ${ref}`,
    articleNumber: ref,
    rows,
    modulesPerRow: perRow,
    widthMm: width,
    heightMm: height,
    depthMm: depth,
    ipRating: "IP65",
    installation: "SURFACE",
    material: "PLASTIC",
    pMaxW: null,
    sourceUrl: `${HAGER}${slug}`,
    about: `Hager vector II ${ref} – nástěnná UV-stabilní rozvodnice bez perforace, průhledné dveře, polykarbonát (PC), ${rows} ${rowsWord(rows)} × ${perRow} M, IP65, In 63 A`,
  }),
);

const hagerUnivers = UNIVERS_FWU.map(([ref, rows, fields, height, width]) =>
  verified({
    manufacturer: "Hager",
    series: "Univers FWU",
    model: `Univers ${ref}${fieldsText(fields)}`,
    articleNumber: ref,
    rows,
    modulesPerRow: fields * 12,
    widthMm: width,
    heightMm: height,
    depthMm: 125,
    ipRating: "IP30",
    installation: "FLUSH",
    material: "PAINTED_STEEL",
    pMaxW: null,
    sourceUrl: `${HAGER}${ref.toLowerCase()}`,
    about: `Hager univers ${ref} – zapuštěný rozvaděč FWU (zděná stěna i dutá příčka), ocel, neprůhledné dveře, třída izolace II, ${rows} ${rowsWord(rows)} × ${fields} pole po 12 M, IP30, In 125 A`,
  }),
);

// ---------------------------------------------------------------------------
//  Schrack TOPO IP40 – bytové rozvodnice z ABS (schrack.cz, „Bytové rozvodnice – série TOPO IP40“)
//  Údaje stránek výrobku: název, šířka / výška / hloubka (netto), řad, šířka modulu, stupeň krytí, montáž, ztrátový výkon.
//  Vynechané: BK080109 (název 1×24, údaje 2 řady), BK080113 a BK080163 (bez řad, modulů a krytí), BK080057 (bez krytí),
//  provedení „-H“ do dutých stěn (stejná skříň s montážní sadou).
// ---------------------------------------------------------------------------

const SCHRACK = "https://www.schrack.cz/eshop/skrine-pro-rozvadece-a-rozvodnice/male-bytove-a-multimedialni-rozvodnice/male-bytove-a-multimedialni-rozvodnice/bytove-rozvodnice-serie-topo-ip40/";

/** [objednací číslo, adresa stránky, řady, moduly v řadě, výška, šířka, hloubka, ztrátový výkon W, průhledné dveře]. */
type SchrackRow = [string, string, number, number, number, number, number, number, boolean];

const TOPO_SURFACE: SchrackRow[] = [
  ["BK080110--", "rozvodnice-nastenna-1x4-modulu-dvere-pruhledne-bk080110.html", 1, 4, 235, 143, 97, 13, true],
  ["BK080160--", "rozvodnice-nastenna-1x4-modulu-dvere-bile-bk080160.html", 1, 4, 235, 143, 97, 13, false],
  ["BK080100--", "rozvodnice-nastenna-1x8-modulu-dvere-pruhledne-1-rada-bk080100.html", 1, 8, 235, 215, 101, 18, true],
  ["BK080150--", "rozvodnice-nastenna-1x-8-modulu-1-rada-bk080150.html", 1, 8, 235, 215, 101, 18, false],
  ["BK080101--", "rozvodnice-nastenna-1x12-modulu-dvere-pruhledne-bk080101.html", 1, 12, 235, 287, 112, 23, true],
  ["BK080151--", "rozvodnice-nastenna-1x12-modulu-bk080151.html", 1, 12, 235, 287, 112, 23, false],
  ["BK080104--", "rozvodnice-nastenna-1x18-modulu-dvere-pruhledne-bk080104.html", 1, 18, 235, 395, 112, 29, true],
  ["BK080154--", "rozvodnice-nastenna-1x-18-modulu-1-rada-bk080154.html", 1, 18, 235, 395, 112, 29, false],
  ["BK080159--", "rozvodnice-nastenna-1x24-modulu-dvere-bile-bk080159.html", 1, 24, 235, 502, 112, 36, false],
  ["BK080102--", "rozvodnice-nastenna-2x12-modulu-dvere-pruhledne-bk080102.html", 2, 12, 361, 287, 112, 32, true],
  ["BK080152--", "rozvodnice-nastenna-2x12-modulu-bk080152.html", 2, 12, 361, 287, 112, 32, false],
  ["BK080106--", "rozvodnice-nastenna-2x18-modulu-dvere-pruhledne-ip-40-bk080106.html", 2, 18, 361, 395, 112, 41, true],
  ["BK080156--", "rozvodnice-nastenna-2x-18-modulu-dvere-plne-bila-2-rada-bk080156.html", 2, 18, 361, 395, 112, 41, false],
  ["BK080103--", "rozvodnice-nastenna-3x-12-modulu-dvere-pruhledne-3-rada-bk080103.html", 3, 12, 525, 287, 112, 44, true],
  ["BK080153--", "rozvodnice-nastenna-3x-12-modulu-36-te-bk080153.html", 3, 12, 482, 287, 112, 44, false],
  ["BK080107--", "rozvodnice-nastenna-3x18-modulu-dvere-pruhledne-ip-40-bk080107.html", 3, 18, 525, 395, 112, 56, true],
  ["BK080157--", "rozvodnice-nastenna-3x18-modulu-dvere-plne-bila-bk080157.html", 3, 18, 525, 395, 112, 56, false],
  ["BK080105--", "rozvodnice-nastenna-4x-12-modulu-dvere-pruhledne-4-rada-bk080105.html", 4, 12, 650, 287, 112, 54, true],
  ["BK080155--", "rozvodnice-nastenna-4x-12-modulu-4-rada-bk080155.html", 4, 12, 650, 287, 112, 54, false],
  ["BK080108--", "rozvodnice-nastenna-4x18-modulu-dvere-pruhledne-ip-40-bk080108.html", 4, 18, 654, 395, 112, 68, true],
  ["BK080158--", "rozvodnice-nastenna-4x18-modulu-dvere-bile-bk080158.html", 4, 18, 654, 395, 112, 68, false],
];

const TOPO_FLUSH: SchrackRow[] = [
  ["BK080055--", "rozvodnice-zapustena-1x4-dvere-bile-bk080055.html", 1, 4, 230, 138, 100, 9, false],
  ["BK080050--", "rozvodnice-zapustena-1x8-modulu-dvere-plne-bk080050.html", 1, 8, 230, 210, 100, 13, false],
  ["BK080001--", "rozvodnice-zapustena-1x12-modulu-dvere-pruhledne-bk080001.html", 1, 12, 230, 282, 106, 17, true],
  ["BK080051--", "rozvodnice-zapustena-1x-12-modulu-dvere-plne-bk080051.html", 1, 12, 230, 282, 106, 17, false],
  ["BK080004--", "rozvodnice-zapustena-1x18-modulu-dvere-pruhledne-bk080004.html", 1, 18, 230, 391, 106, 22, true],
  ["BK080054--", "rozvodnice-zapustena-1x18modulu-dvere-plne-1-rada-bk080054.html", 1, 18, 230, 391, 106, 22, false],
  ["BK080008--", "rozvodnice-zapustena-1x24-dvere-pruhledne-bk080008.html", 1, 24, 254, 498, 106, 30, true],
  ["BK080058--", "rozvodnice-zapustena-1x24-dvere-bile-bk080058.html", 1, 24, 254, 498, 106, 30, false],
  ["BK080002--", "rozvodnice-zapustena-2x12-modulu-dvere-pruhledne-bk080002.html", 2, 12, 355, 282, 106, 24, true],
  ["BK080052--", "rozvodnice-zapustena-2x-12-modulu-dvere-plne-bk080052.html", 2, 12, 355, 282, 106, 24, false],
  ["BK080006--", "rozvodnice-zapustena-2x18modulu-pruhledne-dvere-bk080006.html", 2, 18, 355, 391, 106, 32, true],
  ["BK080056--", "rozvodnice-zapustena-2x-18-modulu-dvere-plne-2-rada-bk080056.html", 2, 18, 355, 391, 106, 32, false],
  ["BK080003--", "rozvodnice-zapustena-3x12-modulu-dvere-pruhledne-bk080003.html", 3, 12, 480, 282, 106, 32, true],
  ["BK080053--", "rozvodnice-zapustena-3x-12-modulu-dvere-plne-3-rada-bk080053.html", 3, 12, 480, 282, 106, 32, false],
  ["BK080007--", "rozvodnice-zapustena-3x18modulu-pruhledne-dvere-bk080007.html", 3, 18, 520, 391, 106, 45, true],
  ["BK080059--", "rozvodnice-zapustena-4x12-dvere-bile-bk080059.html", 4, 12, 674, 282, 108, 44, false],
];

const schrackTopo = (installation: "SURFACE" | "FLUSH", list: readonly SchrackRow[]) =>
  list.map(([mpn, slug, rows, perRow, height, width, depth, loss, transparent]) => {
    const layout = `${rows}×${perRow}${perRow === 8 && installation === "SURFACE" ? " (4+4)" : ""}`;
    const door = transparent ? "dveře průhledné" : "dveře bílé";
    const mounting = installation === "SURFACE" ? "nástěnná" : "zapuštěná";
    return verified({
      manufacturer: "Schrack",
      series: `TOPO ${mounting}`,
      model: `TOPO ${layout}, ${door}`,
      articleNumber: mpn,
      rows,
      modulesPerRow: perRow,
      widthMm: width,
      heightMm: height,
      depthMm: depth,
      ipRating: "IP40",
      installation,
      material: "PLASTIC",
      pMaxW: loss,
      sourceUrl: `${SCHRACK}${slug}`,
      about: `Schrack TOPO – rozvodnice ${mounting}, ${rows}× ${perRow} modulů, ${door}${!transparent && installation === "SURFACE" ? " (plné dveře)" : ""}, IP40, ztrátový výkon ${loss} W`,
    });
  });

/** Všechny ověřené rozvodnice (ABB 103 – z toho 72 od fáze 88, Hager 23, Schrack 37; fáze 113: OEZ 71, Schneider 44, Eaton 92). */
export const VERIFIED_ENCLOSURES: readonly VerifiedEnclosure[] = [
  ...abbComfortLine(125, ABB_CA_125),
  ...abbComfortLine(150, ABB_CA_150),
  ...abbMistral({ series: "Mistral41W", category: "rozvodnice-nastenne-ip-41-pruhledna-dvirka-16990", slug: "rozvodnice-nastenna-pruhledna-dvirka", installation: "SURFACE", ip: "IP41", door: "průhledná", withDoorInModel: true }, MISTRAL41W_TRANSPARENT),
  ...abbMistral({ series: "Mistral41W", category: "rozvodnice-nastenne-ip-41-plna-dvirka-16989", slug: "rozvodnice-nastenna-plna-dvirka", installation: "SURFACE", ip: "IP41", door: "plná", withDoorInModel: true }, MISTRAL41W_SOLID),
  ...abbMistral({ series: "Mistral41F", category: "rozvodnice-zapustene-ip-41-pruhledna-dvirka-16988", slug: "rozvodnice-zapustena-pruhledna-dvirka", installation: "FLUSH", ip: "IP41", door: "průhledná", withDoorInModel: true }, MISTRAL41F_TRANSPARENT),
  ...abbMistral({ series: "Mistral41F", category: "rozvodnice-zapustene-ip-41-plna-dvirka-16987", slug: "rozvodnice-zapustena-plna-dvirka", installation: "FLUSH", ip: "IP41", door: "plná", withDoorInModel: true }, MISTRAL41F_SOLID),
  ...abbMistral({ series: "Mistral65", category: "rozvodnice-nastenne-ip-65-pruhledna-dvirka-16992", slug: "rozvodnice-nastenna-pruhledna-dvirka", installation: "SURFACE", ip: "IP65", door: "průhledná", withDoorInModel: false }, MISTRAL65),
  ...abbMistral({ series: "Mistral65H", category: "rozvodnice-nastenne-pro-venkovni-pouziti-ip-65-pruhledna-dvirka-19564", slug: "rozvodnice-nastenna-pro-venkovni-pouziti-pruhledna-dvirka", installation: "SURFACE", ip: "IP65", door: "průhledná", withDoorInModel: false }, MISTRAL65H),
  ...abbComfortLineCu(125, ABB_CU_125),
  ...abbComfortLineCu(150, ABB_CU_150),
  ...hagerVector,
  ...hagerUnivers,
  ...schrackTopo("SURFACE", TOPO_SURFACE),
  ...schrackTopo("FLUSH", TOPO_FLUSH),
  ...OEZ_ENCLOSURES,
  ...SCHNEIDER_ENCLOSURES,
  ...EATON_ENCLOSURES,
];

/** Řádek pro `PanelEnclosure` (upsert podle objednacího čísla) – bez odkazu, ten je v popisu. */
export function verifiedEnclosureData(row: VerifiedEnclosure): Omit<VerifiedEnclosure, "sourceUrl"> {
  const data: Omit<VerifiedEnclosure, "sourceUrl"> & { sourceUrl?: string } = { ...row };
  delete data.sourceUrl;
  return data;
}

/** Odkaz na stránku výrobce z popisu ověřené skříně („Zdroj: https://…“); jinak null. */
export const enclosureSourceUrl = (description: string | null | undefined) => /Zdroj: (https:\/\/\S+)/.exec(description ?? "")?.[1] ?? null;
