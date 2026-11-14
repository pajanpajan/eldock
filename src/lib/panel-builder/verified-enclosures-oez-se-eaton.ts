// Fáze 113: ověřené rozvodnice OEZ DistriTon (RZA, RZB, RZG, RZI), Schneider Electric (Pragma, Resi9 MP = Mini Pragma)
// a Eaton (xComfort KLV, xBoard / xEnergy Basic BF) z oficiálních stránek výrobců – oez.cz, se.com/cz a eaton.com/cz,
// ověřeno 14. 11. 2026. Objednací číslo, EAN (OEZ, Eaton), řady × moduly v řadě, V × Š × H, krytí, montáž, materiál
// a P_max: OEZ „rozptyl ztrátového výkonu“, Eaton „heat dissipation … ΔT 35 K (IEC 60890)“; Schneider ho neuvádí.
// Ceníkové ceny výrobci veřejně neuvádějí (ceník OEZ jen po přihlášení) – zůstávají prázdné, nic se nedopočítává.
// Mimo: OEZ RZG-N-2T40 (rozměry rozporné s RZG-N-2S40), díly „project delivery form“ KLV (vana / rám / dveře zvlášť),
// rámečky a příslušenství BFZ. Eaton u části typů uvádí výšku a hloubku prohozeně – hloubka je menší z obou hodnot.
// Názvy „RN / RNP“ ze zadání OEZ nevede – plastové rozvodnice OEZ jsou RZG (IP40) a RZI (IP65).
// Čistá data; seed `seedVerifiedEnclosures` (`server/services/catalog-sync.ts`).

import type { VerifiedEnclosure } from "./verified-enclosures";

const VERIFIED_ON = "2026-11-14";
const SOURCE = "MANUFACTURER_CATALOG" as const;
const rowsWord = (rows: number) => (rows === 1 ? "řada" : rows <= 4 ? "řady" : "řad");
const INSTALL_TEXT = { SURFACE: "na omítku", FLUSH: "pod omítku", HOLLOW_WALL: "do dutých stěn" } as const;

type Installation = "SURFACE" | "FLUSH" | "HOLLOW_WALL";

function row(input: {
  manufacturer: VerifiedEnclosure["manufacturer"];
  series: string;
  model: string;
  articleNumber: string;
  rows: number;
  perRow: number;
  w: number;
  h: number;
  d: number;
  ip: string;
  installation: Installation;
  material: VerifiedEnclosure["material"];
  pMaxW: number | null;
  ean: string | null;
  about: string;
  url: string;
}): VerifiedEnclosure {
  return {
    manufacturer: input.manufacturer,
    series: input.series,
    model: input.model,
    articleNumber: input.articleNumber,
    rows: input.rows,
    modulesPerRow: input.perRow,
    totalModules: input.rows * input.perRow,
    widthMm: input.w,
    heightMm: input.h,
    depthMm: input.d,
    ipRating: input.ip,
    installation: input.installation,
    material: input.material,
    pMaxW: input.pMaxW,
    ean: input.ean,
    listPriceCzk: null,
    dataSource: SOURCE,
    description: `${input.about} – ${input.rows} ${rowsWord(input.rows)} × ${input.perRow} M, ${input.ip}, ${INSTALL_TEXT[input.installation]}${input.ean ? `, EAN ${input.ean}` : ""}. Zdroj: ${input.url} (ověřeno ${VERIFIED_ON})`,
    sourceUrl: input.url,
  };
}

// ---------------------------------------------------------------------------
//  OEZ DistriTon (oez.cz): [typ, objednací číslo, EAN, P_max W, řady, moduly v řadě, Š, V, H, montáž]
// ---------------------------------------------------------------------------

type OezRow = [string, string, string, number, number, number, number, number, number, Installation];

const OEZ_RZA: OezRow[] = [
  ["RZA-Z-1S14", "42599", "8590125425991", 16, 1, 14, 362, 327, 95, "FLUSH"],
  ["RZA-Z-2S28", "42600", "8590125426004", 22, 2, 14, 362, 462, 95, "FLUSH"],
  ["RZA-Z-3S42", "42601", "8590125426011", 29, 3, 14, 362, 643, 95, "FLUSH"],
  ["RZA-Z-4S56", "42602", "8590125426028", 34, 4, 14, 362, 778, 95, "FLUSH"],
  ["RZA-Z-1S14-H", "42603", "8590125426035", 16, 1, 14, 362, 327, 95, "HOLLOW_WALL"],
  ["RZA-Z-2S28-H", "42604", "8590125426042", 22, 2, 14, 362, 462, 95, "HOLLOW_WALL"],
  ["RZA-Z-3S42-H", "42605", "8590125426059", 29, 3, 14, 362, 643, 95, "HOLLOW_WALL"],
  ["RZA-Z-4S56-H", "42606", "8590125426066", 34, 4, 14, 362, 778, 95, "HOLLOW_WALL"],
];

const OEZ_RZB: OezRow[] = [
  ["RZB-Z-3S72", "44451", "8590125444510", 80, 3, 24, 572, 642, 147, "FLUSH"],
  ["RZB-Z-4S96", "44452", "8590125444527", 92, 4, 24, 572, 792, 147, "FLUSH"],
  ["RZB-Z-5S120", "44453", "8590125444534", 107, 5, 24, 572, 942, 147, "FLUSH"],
  ["RZB-Z-6S144", "44454", "8590125444541", 121, 6, 24, 572, 1092, 147, "FLUSH"],
  ["RZB-Z-4S132", "44455", "8590125444558", 117, 4, 33, 734, 792, 147, "FLUSH"],
  ["RZB-Z-5S165", "44456", "8590125444565", 133, 5, 33, 734, 942, 147, "FLUSH"],
  ["RZB-Z-6S198", "44457", "8590125444572", 140, 6, 33, 734, 1092, 147, "FLUSH"],
  ["RZB-N-3S72", "44458", "8590125444589", 86, 3, 24, 542, 605, 156, "SURFACE"],
  ["RZB-N-4S96", "44459", "8590125444596", 101, 4, 24, 542, 755, 156, "SURFACE"],
  ["RZB-N-5S120", "44460", "8590125444602", 115, 5, 24, 542, 905, 156, "SURFACE"],
  ["RZB-N-6S144", "44461", "8590125444619", 130, 6, 24, 542, 1055, 156, "SURFACE"],
  ["RZB-N-4S132", "44462", "8590125444626", 127, 4, 33, 704, 755, 156, "SURFACE"],
  ["RZB-N-5S165", "44463", "8590125444633", 137, 5, 33, 704, 905, 156, "SURFACE"],
  ["RZB-N-6S198", "44464", "8590125444640", 153, 6, 33, 704, 1055, 156, "SURFACE"],
];

const OEZ_RZG: OezRow[] = [
  ["RZG-N-1S4", "40577", "8590125405771", 9.7, 1, 4, 148, 222, 95, "SURFACE"],
  ["RZG-N-1S8", "40578", "8590125405788", 18.8, 1, 8, 245, 250, 104, "SURFACE"],
  ["RZG-N-1S14", "40579", "8590125405795", 28.9, 1, 14, 362, 250, 104, "SURFACE"],
  ["RZG-N-1S18", "40580", "8590125405801", 37.5, 1, 18, 407, 246, 104, "SURFACE"],
  ["RZG-N-2S28", "40581", "8590125405818", 50.3, 2, 14, 362, 436, 104, "SURFACE"],
  ["RZG-N-2S40", "40582", "8590125405825", 47.1, 2, 20, 436, 362, 104, "SURFACE"],
  ["RZG-N-3S42", "40583", "8590125405832", 68.7, 3, 14, 362, 543, 117, "SURFACE"],
  ["RZG-N-4S56", "40584", "8590125405849", 76.8, 4, 14, 363, 687, 104, "SURFACE"],
  ["RZG-N-1T4", "40585", "8590125405856", 9.7, 1, 4, 148, 222, 95, "SURFACE"],
  ["RZG-N-1T8", "40586", "8590125405863", 18.8, 1, 8, 245, 250, 104, "SURFACE"],
  ["RZG-N-1T14", "40587", "8590125405870", 28.9, 1, 14, 362, 250, 104, "SURFACE"],
  ["RZG-N-1T18", "40588", "8590125405887", 37.5, 1, 18, 407, 246, 104, "SURFACE"],
  ["RZG-N-2T28", "40589", "8590125405894", 50.3, 2, 14, 362, 436, 104, "SURFACE"],
  ["RZG-N-3T42", "40591", "8590125405917", 68.7, 3, 14, 362, 543, 117, "SURFACE"],
  ["RZG-N-4T56", "40592", "8590125405924", 76.8, 4, 14, 363, 687, 104, "SURFACE"],
  ["RZG-Z-1S4", "40553", "8590125405535", 7.8, 1, 4, 148, 222, 101, "FLUSH"],
  ["RZG-Z-1S8", "40554", "8590125405542", 15.3, 1, 8, 245, 250, 100, "FLUSH"],
  ["RZG-Z-1S14", "40555", "8590125405559", 23.9, 1, 14, 362, 250, 102, "FLUSH"],
  ["RZG-Z-1S18", "40556", "8590125405566", 31.5, 1, 18, 407, 246, 95, "FLUSH"],
  ["RZG-Z-2S28", "40557", "8590125405573", 43, 2, 14, 362, 436, 102, "FLUSH"],
  ["RZG-Z-2S40", "40558", "8590125405580", 41, 2, 20, 424, 352, 95, "FLUSH"],
  ["RZG-Z-3S42", "40559", "8590125405597", 60.8, 3, 14, 362, 543, 113, "FLUSH"],
  ["RZG-Z-4S56", "40560", "8590125405603", 68, 4, 14, 362, 687, 102, "FLUSH"],
  ["RZG-Z-1T4", "40561", "8590125405610", 7.8, 1, 4, 148, 222, 101, "FLUSH"],
  ["RZG-Z-1T8", "40562", "8590125405627", 15.3, 1, 8, 245, 250, 100, "FLUSH"],
  ["RZG-Z-1T14", "40563", "8590125405634", 23.9, 1, 14, 362, 250, 102, "FLUSH"],
  ["RZG-Z-1T18", "40564", "8590125405641", 31.5, 1, 18, 407, 246, 95, "FLUSH"],
  ["RZG-Z-2T28", "40565", "8590125405658", 43, 2, 14, 362, 436, 102, "FLUSH"],
  ["RZG-Z-2T40", "40566", "8590125405665", 41, 2, 20, 424, 352, 95, "FLUSH"],
  ["RZG-Z-3T42", "40567", "8590125405672", 60.8, 3, 14, 362, 543, 113, "FLUSH"],
  ["RZG-Z-4T56", "40568", "8590125405689", 68, 4, 14, 362, 687, 102, "FLUSH"],
  ["RZG-Z-1S14-H", "40569", "8590125405696", 23.9, 1, 14, 362, 250, 102, "HOLLOW_WALL"],
  ["RZG-Z-2S28-H", "40570", "8590125405702", 43, 2, 14, 362, 436, 102, "HOLLOW_WALL"],
  ["RZG-Z-3S42-H", "40571", "8590125405719", 60.8, 3, 14, 362, 543, 113, "HOLLOW_WALL"],
  ["RZG-Z-4S56-H", "40572", "8590125405726", 68, 4, 14, 362, 687, 102, "HOLLOW_WALL"],
  ["RZG-Z-1T14-H", "40573", "8590125405733", 23.9, 1, 14, 362, 250, 102, "HOLLOW_WALL"],
  ["RZG-Z-2T28-H", "40574", "8590125405740", 43, 2, 14, 362, 436, 102, "HOLLOW_WALL"],
  ["RZG-Z-3T42-H", "40575", "8590125405757", 60.8, 3, 14, 362, 543, 113, "HOLLOW_WALL"],
  ["RZG-Z-4T56-H", "40576", "8590125405764", 68, 4, 14, 362, 687, 102, "HOLLOW_WALL"],
];

const OEZ_RZI: OezRow[] = [
  ["RZI-N-1T4", "44382", "8590125443827", 11.1, 1, 4, 166, 231, 113, "SURFACE"],
  ["RZI-N-1T6", "44383", "8590125443834", 12.5, 1, 6, 202, 231, 113, "SURFACE"],
  ["RZI-N-1T8", "44384", "8590125443841", 14.2, 1, 8, 238, 231, 118, "SURFACE"],
  ["RZI-N-1T12", "44385", "8590125443858", 19.7, 1, 12, 310, 246, 148, "SURFACE"],
  ["RZI-N-1T18", "44386", "8590125443865", 26.7, 1, 18, 418, 286, 148, "SURFACE"],
  ["RZI-N-2T24", "44387", "8590125443872", 29.6, 2, 12, 310, 436, 148, "SURFACE"],
  ["RZI-N-2T36", "44388", "8590125443889", 36, 2, 18, 418, 436, 148, "SURFACE"],
  ["RZI-N-3T36", "44389", "8590125443896", 37.3, 3, 12, 310, 586, 148, "SURFACE"],
  ["RZI-N-3T54", "44390", "8590125443902", 45.2, 3, 18, 418, 586, 148, "SURFACE"],
  ["RZI-N-4T72", "47812", "8590125478126", 65, 4, 18, 418, 872, 148, "SURFACE"],
];

const oez = (series: string, ip: string, material: VerifiedEnclosure["material"], about: (type: string) => string) => (rows: OezRow[]) =>
  rows.map(([type, order, ean, pMax, rowCount, perRow, w, h, d, installation]) =>
    row({ manufacturer: "OEZ", series, model: `DistriTon ${type}`, articleNumber: order, rows: rowCount, perRow, w, h, d, ip, installation, material, pMaxW: pMax, ean, about: `OEZ ${type} – ${about(type)}`, url: `https://www.oez.cz/${type.toLowerCase()}` }),
  );

const doorOf = (type: string) => (/-\d+T\d+/.test(type) ? "průhledné dveře" : "neprůhledné dveře");

export const OEZ_ENCLOSURES: readonly VerifiedEnclosure[] = [
  ...oez("RZA", "IP30", "PLASTIC", () => "oceloplastová rozvodnicová skříň, neprůhledné plechové dveře, PE + N, 63 A")(OEZ_RZA),
  ...oez("RZB", "IP30", "PAINTED_STEEL", () => "oceloplechová rozvodnicová skříň, neprůhledné dveře, 125 A, IK09")(OEZ_RZB),
  ...oez("RZG", "IP40", "PLASTIC", (type) => `plastová rozvodnicová skříň, ${doorOf(type)}, 63 A, IK08`)(OEZ_RZG),
  ...oez("RZI", "IP65", "PLASTIC", () => "plastová skříň s vyšším krytím, průhledné dveře, šedá, 63 A, IK08")(OEZ_RZI),
];

// ---------------------------------------------------------------------------
//  Schneider Electric (se.com/cz): [reference, řady, moduly v řadě, Š, V, H, krytí, montáž, dveře]
//  Pragma PRA20 = bez dveří, PRA30 = plné dveře (povrch), PRA21 = průhledné dveře IP40, PRA31 = zapuštěná s dveřmi;
//  rozměry „venkovní“ (u zapuštěných rámeček), hloubka zapuštěných = ve zdi + nad zdí.
// ---------------------------------------------------------------------------

type SeRow = [string, number, number, number, number, number, string, Installation, string];

const SE_PRAGMA: SeRow[] = [
  ["PRA20124", 1, 24, 550, 300, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA20213", 2, 13, 336, 450, 123, "IP30", "SURFACE", "bez dveří"],
  ["PRA20218", 2, 18, 426, 450, 125, "IP30", "SURFACE", "bez dveří"],
  ["PRA20224", 2, 24, 550, 450, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA20313", 3, 13, 336, 600, 123, "IP30", "SURFACE", "bez dveří"],
  ["PRA20318", 3, 18, 426, 600, 125, "IP30", "SURFACE", "bez dveří"],
  ["PRA20324", 3, 24, 550, 600, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA20418", 4, 18, 426, 750, 125, "IP30", "SURFACE", "bez dveří"],
  ["PRA20424", 4, 24, 550, 750, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA20524", 5, 24, 550, 900, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA20624", 6, 24, 550, 1050, 148, "IP30", "SURFACE", "bez dveří"],
  ["PRA30113", 1, 13, 336, 300, 143, "IP30", "SURFACE", "plné dveře"],
  ["PRA30118", 1, 18, 426, 300, 145, "IP30", "SURFACE", "plné dveře"],
  ["PRA30213", 2, 13, 336, 450, 143, "IP30", "SURFACE", "plné dveře"],
  ["PRA30218", 2, 18, 426, 450, 145, "IP30", "SURFACE", "plné dveře"],
  ["PRA30313", 3, 13, 336, 600, 143, "IP30", "SURFACE", "plné dveře"],
  ["PRA30318", 3, 18, 426, 600, 145, "IP30", "SURFACE", "plné dveře"],
  ["PRA30413", 4, 13, 336, 750, 143, "IP30", "SURFACE", "plné dveře"],
  ["PRA30418", 4, 18, 426, 750, 145, "IP30", "SURFACE", "plné dveře"],
  ["PRA21313", 3, 13, 336, 600, 143, "IP40", "SURFACE", "průhledné (kouřové) dveře"],
  ["PRA21413", 4, 13, 336, 750, 143, "IP40", "SURFACE", "průhledné (kouřové) dveře"],
  ["PRA31113", 1, 13, 396, 360, 127, "IP40", "FLUSH", "plné dveře"],
  ["PRA31118", 1, 18, 486, 360, 129, "IP40", "FLUSH", "plné dveře"],
  ["PRA31213", 2, 13, 396, 510, 127, "IP40", "FLUSH", "plné dveře"],
  ["PRA31218", 2, 18, 486, 510, 129, "IP40", "FLUSH", "plné dveře"],
  ["PRA31224", 2, 24, 610, 510, 150, "IP40", "FLUSH", "plné dveře"],
  ["PRA31313", 3, 13, 396, 660, 127, "IP40", "FLUSH", "plné dveře"],
  ["PRA31318", 3, 18, 486, 660, 129, "IP40", "FLUSH", "plné dveře"],
  ["PRA31413", 4, 13, 396, 810, 127, "IP40", "FLUSH", "plné dveře"],
  ["PRA31418", 4, 18, 486, 810, 129, "IP40", "FLUSH", "plné dveře"],
];

const SE_MINI_PRAGMA: SeRow[] = [
  ["MIP12104", 1, 4, 124, 198, 95, "IP40", "SURFACE", "plné dveře"],
  ["MIP12106", 1, 6, 160, 198, 95, "IP40", "SURFACE", "plné dveře"],
  ["MIP12108", 1, 8, 196, 198, 102, "IP40", "SURFACE", "plné dveře"],
  ["MIP12112", 1, 12, 268, 228, 102, "IP40", "SURFACE", "plné dveře"],
  ["MIP12118", 1, 18, 376, 228, 102, "IP40", "SURFACE", "plné dveře"],
  ["MIP12212", 2, 12, 268, 353, 102, "IP40", "SURFACE", "plné dveře"],
  ["MIP12312", 3, 12, 268, 478, 102, "IP40", "SURFACE", "plné dveře"],
  ["MIP22104", 1, 4, 150, 252, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22106", 1, 6, 186, 252, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22108", 1, 8, 222, 252, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22112", 1, 12, 294, 252, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22118", 1, 18, 402, 252, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22212", 2, 12, 294, 377, 98, "IP40", "FLUSH", "plné dveře"],
  ["MIP22312", 3, 12, 294, 502, 98, "IP40", "FLUSH", "plné dveře"],
];

const schneider = (series: string, label: string) => (rows: SeRow[]) =>
  rows.map(([reference, rowCount, perRow, w, h, d, ip, installation, door]) =>
    row({
      manufacturer: "Schneider",
      series,
      model: `${label} ${reference} ${rowCount}×${perRow} M${door === "bez dveří" ? " (bez dveří)" : ""}`,
      articleNumber: reference,
      rows: rowCount,
      perRow,
      w,
      h,
      d,
      ip,
      installation,
      material: "PLASTIC",
      pMaxW: null,
      ean: null,
      about: `Schneider Electric ${label} – modulární rozvodnice z technoplastu, ${door}`,
      url: `https://www.se.com/cz/cs/product/${reference}/`,
    }),
  );

export const SCHNEIDER_ENCLOSURES: readonly VerifiedEnclosure[] = [...schneider("Pragma", "Pragma")(SE_PRAGMA), ...schneider("Mini Pragma", "Mini Pragma (Resi9 MP)")(SE_MINI_PRAGMA)];

// ---------------------------------------------------------------------------
//  Eaton (eaton.com/cz, karta výrobku): [typ, katalogové číslo, EAN, řady, moduly v řadě, Š, V, H, montáž, P_max W]
//  P_max = „Heat dissipation, ambient 35 °C, ΔT 35 K, individual enclosure (IEC 60890)“.
// ---------------------------------------------------------------------------

type EatonRow = [string, string, string, number, number, number, number, number, Installation, number];

const EATON_KLV: EatonRow[] = [
  ["KLV-12UPP-F", "178798", "4015081741274", 1, 12, 360, 340, 100, "FLUSH", 21],
  ["KLV-12UPP-SF", "178799", "4015081741281", 1, 12, 360, 340, 100, "FLUSH", 21],
  ["KLV-24UPP-F", "178800", "4015081741298", 2, 12, 360, 465, 100, "FLUSH", 34],
  ["KLV-24UPP-SF", "178801", "4015081741304", 2, 12, 360, 465, 100, "FLUSH", 34],
  ["KLV-36UPP-F", "178802", "4015081741311", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-36UPP-SF", "178803", "4015081741328", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-48UPP-F", "178804", "4015081741335", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-48UPP-SF", "178805", "4015081741342", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-12HWP-F", "178806", "4015081741359", 1, 12, 360, 340, 100, "HOLLOW_WALL", 21],
  ["KLV-12HWP-SF", "178807", "4015081741366", 1, 12, 360, 340, 100, "HOLLOW_WALL", 21],
  ["KLV-24HWP-F", "178808", "4015081741373", 2, 12, 360, 465, 100, "HOLLOW_WALL", 34],
  ["KLV-24HWP-SF", "178809", "4015081741380", 2, 12, 360, 465, 100, "HOLLOW_WALL", 34],
  ["KLV-36HWP-F", "178810", "4015081741397", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-36HWP-SF", "178811", "4015081741403", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-48HWP-F", "178812", "4015081741410", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
  ["KLV-48HWP-SF", "178813", "4015081741427", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
  ["KLV-12UPS-F", "178814", "4015081741434", 1, 12, 360, 340, 100, "FLUSH", 21],
  ["KLV-12UPS-SF", "178815", "4015081741441", 1, 12, 360, 340, 100, "FLUSH", 21],
  ["KLV-24UPS-F", "178816", "4015081741458", 2, 12, 360, 465, 100, "FLUSH", 34],
  ["KLV-24UPS-SF", "178817", "4015081741465", 2, 12, 360, 465, 100, "FLUSH", 34],
  ["KLV-36UPS-F", "178818", "4015081741472", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-36UPS-SF", "178819", "4015081741489", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-48UPS-F", "178820", "4015081741496", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-48UPS-SF", "178821", "4015081741502", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-12HWS-F", "178822", "4015081741519", 1, 12, 360, 340, 100, "HOLLOW_WALL", 21],
  ["KLV-12HWS-SF", "178823", "4015081741526", 1, 12, 360, 340, 100, "HOLLOW_WALL", 21],
  ["KLV-24HWS-F", "178824", "4015081741533", 2, 12, 360, 465, 100, "HOLLOW_WALL", 34],
  ["KLV-24HWS-SF", "178825", "4015081741540", 2, 12, 360, 465, 100, "HOLLOW_WALL", 34],
  ["KLV-36HWS-F", "178826", "4015081741557", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-36HWS-SF", "178827", "4015081741564", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-48HWS-F", "178828", "4015081741571", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
  ["KLV-48HWS-SF", "178829", "4015081741588", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
];

/** KLV multimediální (Smart Home) – prostor pro síťové a datové prvky. */
const EATON_KLV_MULTIMEDIA: EatonRow[] = [
  ["KLV-36UPM-F", "178830", "4015081741595", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-36UPM-SF", "178831", "4015081741601", 3, 12, 360, 590, 100, "FLUSH", 43],
  ["KLV-48UPM-F", "178832", "4015081741618", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-48UPM-SF", "178833", "4015081741625", 4, 12, 360, 715, 100, "FLUSH", 48],
  ["KLV-36HWM-F", "178834", "4015081741632", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-36HWM-SF", "178835", "4015081741649", 3, 12, 360, 590, 100, "HOLLOW_WALL", 43],
  ["KLV-48HWM-F", "178836", "4015081741656", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
  ["KLV-48HWM-SF", "178837", "4015081741663", 4, 12, 360, 715, 100, "HOLLOW_WALL", 48],
];

const EATON_BF: EatonRow[] = [
  ["BF-O-2/48-C", "113685", "4015081132133", 2, 24, 555, 460, 150, "SURFACE", 75],
  ["BF-O-2/48-G-C", "113686", "4015081132140", 2, 24, 555, 460, 150, "SURFACE", 75],
  ["BF-O-2/48-E", "283040", "4015082830403", 2, 24, 555, 460, 150, "SURFACE", 75],
  ["BF-O-3/72-C", "283031", "4015082830311", 3, 24, 565, 620, 145, "SURFACE", 89],
  ["BF-O-3/72-E", "283041", "4015082830410", 3, 24, 555, 610, 150, "SURFACE", 89],
  ["BF-O-3/72-G-C", "283044", "4015082830441", 3, 24, 555, 610, 150, "SURFACE", 89],
  ["BF-O-4/96-C", "283032", "4015082830328", 4, 24, 565, 775, 150, "SURFACE", 103],
  ["BF-O-4/96-E", "283042", "4015082830427", 4, 24, 555, 760, 150, "SURFACE", 103],
  ["BF-O-4/96-G-C", "283045", "4015082830458", 4, 24, 550, 760, 150, "SURFACE", 103],
  ["BF-O-5/120-C", "283033", "4015082830335", 5, 24, 555, 910, 150, "SURFACE", 118],
  ["BF-O-5/120-E", "283043", "4015082830434", 5, 24, 555, 910, 150, "SURFACE", 118],
  ["BF-O-5/120-G-C", "283046", "4015082830465", 5, 24, 555, 910, 150, "SURFACE", 118],
  ["BF-O-6/144-C", "283034", "4015082830342", 6, 24, 565, 1065, 155, "SURFACE", 132],
  ["BF-O-6/144-G-C", "283047", "4015082830472", 6, 24, 555, 1060, 150, "SURFACE", 132],
  ["BF-O-4/132-C", "103091", "4015081029303", 4, 33, 715, 760, 150, "SURFACE", 129],
  ["BF-O-4/132-G-C", "103094", "4015081029334", 4, 33, 715, 760, 150, "SURFACE", 129],
  ["BF-O-5/165-C", "103092", "4015081029310", 5, 33, 715, 910, 150, "SURFACE", 111],
  ["BF-O-5/165-G-C", "103095", "4015081029341", 5, 33, 715, 910, 150, "SURFACE", 111],
  ["BF-O-6/198-C", "103093", "4015081029327", 6, 33, 715, 1060, 150, "SURFACE", 118],
  ["BF-O-6/198-G-C", "103096", "4015081029358", 6, 33, 715, 1060, 150, "SURFACE", 118],
  ["BF-OT-2/48-C", "113687", "4015081132157", 2, 24, 555, 460, 150, "SURFACE", 75],
  ["BF-OT-2/48-G-C", "113688", "4015081132164", 2, 24, 555, 460, 150, "SURFACE", 75],
  ["BF-OT-3/72-C", "103103", "4015081029426", 3, 24, 565, 630, 150, "SURFACE", 89],
  ["BF-OT-3/72-G-C", "103110", "4015081029495", 3, 24, 570, 630, 160, "SURFACE", 89],
  ["BF-OT-4/96-C", "103104", "4015081029433", 4, 24, 560, 770, 150, "SURFACE", 103],
  ["BF-OT-5/120-C", "103105", "4015081029440", 5, 24, 555, 910, 150, "SURFACE", 118],
  ["BF-OT-6/144-C", "103106", "4015081029457", 6, 24, 555, 1060, 150, "SURFACE", 132],
  ["BF-OT-4/132-C", "103107", "4015081029464", 4, 33, 715, 760, 150, "SURFACE", 129],
  ["BF-OT-5/165-C", "103108", "4015081029471", 5, 33, 715, 910, 150, "SURFACE", 111],
  ["BF-OT-6/198-C", "103109", "4015081029488", 6, 33, 715, 1060, 150, "SURFACE", 118],
  ["BF-U-2/48-C", "113689", "4015081132171", 2, 24, 600, 480, 140, "FLUSH", 69],
  ["BF-U-2/48-G-C", "113690", "4015081132188", 2, 24, 600, 480, 140, "FLUSH", 69],
  ["BF-U-2/48-E", "283052", "4015082830526", 2, 24, 600, 480, 140, "FLUSH", 69],
  ["BF-U-3/72-C", "283048", "4015082830489", 3, 24, 620, 640, 150, "FLUSH", 82],
  ["BF-U-3/72-E", "283053", "4015082830533", 3, 24, 600, 630, 140, "FLUSH", 82],
  ["BF-U-3/72-G-C", "283056", "4015082830564", 3, 24, 600, 630, 140, "FLUSH", 82],
  ["BF-U-4/96-C", "283049", "4015082830496", 4, 24, 620, 790, 160, "FLUSH", 96],
  ["BF-U-4/96-E", "283054", "4015082830540", 4, 24, 600, 780, 140, "FLUSH", 96],
  ["BF-U-4/96-G-C", "283057", "4015082830571", 4, 24, 600, 780, 140, "FLUSH", 96],
  ["BF-U-5/120-C", "283050", "4015082830502", 5, 24, 600, 930, 140, "FLUSH", 110],
  ["BF-U-5/120-E", "283055", "4015082830557", 5, 24, 600, 930, 140, "FLUSH", 110],
  ["BF-U-5/120-G-C", "283058", "4015082830588", 5, 24, 600, 930, 140, "FLUSH", 110],
  ["BF-U-6/144-C", "283051", "4015082830519", 6, 24, 605, 1100, 160, "FLUSH", 124],
  ["BF-U-6/144-G-C", "283059", "4015082830595", 6, 24, 600, 1080, 140, "FLUSH", 124],
  ["BF-U-4/132-C", "103097", "4015081029365", 4, 33, 760, 780, 140, "FLUSH", 120],
  ["BF-U-4/132-G-C", "103100", "4015081029396", 4, 33, 760, 780, 140, "FLUSH", 120],
  ["BF-U-5/165-C", "103098", "4015081029372", 5, 33, 760, 930, 140, "FLUSH", 136],
  ["BF-U-5/165-G-C", "103101", "4015081029402", 5, 33, 760, 930, 140, "FLUSH", 136],
  ["BF-U-6/198-C", "103099", "4015081029389", 6, 33, 760, 1080, 140, "FLUSH", 114],
  ["BF-U-6/198-G-C", "103102", "4015081029419", 6, 33, 760, 1080, 140, "FLUSH", 114],
  ["BF-UT-2/48-C", "113691", "4015081132195", 2, 24, 600, 480, 140, "FLUSH", 69],
  ["BF-UT-2/48-G-C", "113692", "4015081132201", 2, 24, 600, 480, 140, "FLUSH", 69],
];

const eaton = (series: string, material: VerifiedEnclosure["material"], about: string) => (rows: EatonRow[]) =>
  rows.map(([type, catalog, ean, rowCount, perRow, w, h, d, installation, pMax]) =>
    row({ manufacturer: "Eaton", series, model: type, articleNumber: catalog, rows: rowCount, perRow, w, h, d, ip: "IP30", installation, material, pMaxW: pMax, ean, about: `Eaton ${type} – ${about}`, url: `https://www.eaton.com/cz/cs-cz/skuPage.${catalog}.html` }),
  );

export const EATON_ENCLOSURES: readonly VerifiedEnclosure[] = [
  ...eaton("KLV", "PLASTIC", "xComfort KLV domovní rozvodnice (plastová vana, dveře, svorkovnice PE + N)")(EATON_KLV),
  ...eaton("KLV Multimedia", "PLASTIC", "xComfort KLV multimediální rozvodnice (Smart Home, prostor pro datové a síťové prvky)")(EATON_KLV_MULTIMEDIA),
  ...eaton("xEnergy Basic BF", "PAINTED_STEEL", "xComfort / xEnergy Basic BF malá oceloplechová rozvodnice (práškový lak, dveře s otočným zámkem)")(EATON_BF),
];
