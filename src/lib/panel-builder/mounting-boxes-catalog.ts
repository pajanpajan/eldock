// Fáze 91: instalační (přístrojové) krabice – katalog výrobců (KOPOS Kolín, Kaiser, Schneider Electric, OBO Bettermann,
// SEZ Dolný Kubín) podle konstrukce stěny / prostředí, potřebná hloubka krabice u každého prvku půdorysu, hlídač hloubky
// (ruční volba mělčí krabice, než přístroj a svorkování potřebují) a souhrn krabic do kusovníku.
// Typová označení, objednací kódy a hloubky jen z oficiálních stránek výrobců (ověřeno 2026-11-11, odkaz `source`);
// typ, který výrobce nevede, se nevymýšlí – kusovník pak ukáže „doplnit“. Čisté funkce.
// Fáze 94: vestavná hloubka přístroje z oficiálních dat výrobce (ABB ETIM 9.0, EF012278 / EF000218) – přístroj hlubší, než
// zaručuje mělká krabice (40 mm), chce hlubokou; u zvolené krabice se počítá volné místo za přístrojem.

import { ETIM_DEVICE_DEPTHS } from "./abb-etim.generated";
import { BOX_MAKERS, DEFAULT_BOX_MAKER, DEFAULT_WALL_TYPE, WALL_TYPES, type BoxChoice, type BoxDepthClass, type BoxMaker, type WallType } from "./box-options";
import { allElements, floorsOf, paletteItem, type EditorElement, type EditorRoom, type FloorplanDraft } from "./floorplan-editor";
import { gangsOf } from "./floorplan-frames";
import { frameRulesOf, isSurfaceMountedSeries } from "./residential-series-catalog";
import { isCommercial } from "./occupancy";
import { productById } from "./smart-catalog";

export { BOX_CHOICES, BOX_MAKERS, DEFAULT_BOX_MAKER, DEFAULT_WALL_TYPE, WALL_TYPES, isBoxChoice, isBoxMaker, isWallType } from "./box-options";
export type { BoxChoice, BoxDepthClass, BoxMaker, WallType } from "./box-options";

/** Nejmenší hloubka krabice podle třídy [mm] – hluboká a s prostorem pro elektroniku min. 66 mm. */
export const MIN_DEPTH_MM: Record<BoxDepthClass, number> = { shallow: 40, deep: 66, electronics: 66 };
const CLASS_ORDER: Record<BoxDepthClass, number> = { shallow: 0, deep: 1, electronics: 2 };

export interface MountingBox {
  maker: BoxMaker;
  /** Typové označení výrobce („KPR 68“). */
  type: string;
  /** Objednací kód / katalogové číslo („KPR 68_KA“, Art.-Nr. „1555-05“); null = výrobce ho na webu neuvádí. */
  code: string | null;
  /** Hloubka [mm]; u krabic do zateplení tloušťka izolace (null = výrobce neuvádí). */
  depthMm: number | null;
  /** Počet pozic (vícenásobná krabice pro sdružené rámečky). */
  gangs: number;
  walls: readonly WallType[];
  role: BoxDepthClass | "etics-box" | "etics-plate";
  airtight?: boolean;
  halogenFree?: boolean;
  /** Spojování do řady s roztečí 71 mm (víceramček z jednotlivých krabic). */
  pitch71?: boolean;
  /** Určení podle výrobce. */
  purpose: string;
  source: string;
}

const KOPOS = "https://www.kopos.cz/cs/produkt/";
const KAISER = "https://www.kaisergroup.com/de-KAISER/";
const OBO = "https://www.obo.de/de-de/produkte/";

const box = (entry: MountingBox): MountingBox => entry;
const MASONRY: readonly WallType[] = ["masonry"];
const HOLLOW: readonly WallType[] = ["drywall"];
const AIRTIGHT: readonly WallType[] = ["timber"];
const HOLLOW_AIRTIGHT: readonly WallType[] = ["drywall", "timber"];

/** Katalog krabic (pořadí = přednost při výběru). */
export const MOUNTING_BOXES: readonly MountingBox[] = [
  // ── KOPOS Kolín ─────────────────────────────────────────────────────────────────────────────────────────
  box({ maker: "kopos", type: "KU 68-45", code: "KU 68-45_KA", depthMm: 45, gangs: 1, walls: MASONRY, role: "shallow", pitch71: true, purpose: "Do zdiva – univerzální krabice 45 mm pro vypínače a zásuvky i dvojzásuvku (přímá náhrada KU 68-1901)", source: `${KOPOS}12902-krabice-univerzalni` }),
  box({ maker: "kopos", type: "KPR 68", code: "KPR 68_KA", depthMm: 66, gangs: 1, walls: MASONRY, role: "deep", pitch71: true, purpose: "Do zdiva – hluboká 66 mm pro svorkování pod přístrojem, stmívače, termostaty a zásuvky Cat6A / Cat7", source: `${KOPOS}1677-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPR 68-70", code: "KPR 68-70_KA", depthMm: 70, gangs: 1, walls: MASONRY, role: "electronics", pitch71: true, purpose: "Do zdiva – hluboká 70 mm, víc prostoru pro aktor / modul pod vypínač (krabici s boční kapsou KOPOS nevede)", source: `${KOPOS}12903-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KP 64/2", code: "KP 64/2_KA", depthMm: 45, gangs: 2, walls: MASONRY, role: "shallow", purpose: "Do zdiva – dvojnásobná krabice pro sdružené rámečky (rozteč 71 mm)", source: `${KOPOS}1188-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KP 64/3", code: "KP 64/3_KA", depthMm: 45, gangs: 3, walls: MASONRY, role: "shallow", purpose: "Do zdiva – trojnásobná krabice pro sdružené rámečky (rozteč 71 mm)", source: `${KOPOS}1189-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KP 64/4", code: "KP 64/4_KA", depthMm: 45, gangs: 4, walls: MASONRY, role: "shallow", purpose: "Do zdiva – čtyřnásobná krabice pro sdružené rámečky (rozteč 71 mm)", source: `${KOPOS}1743-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KP 64/5", code: "KP 64/5_KA", depthMm: 45, gangs: 5, walls: MASONRY, role: "shallow", purpose: "Do zdiva – pětinásobná krabice pro sdružené rámečky (rozteč 71 mm)", source: `${KOPOS}2346-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPL 64-45/LD", code: "KPL 64-45/LD_NA", depthMm: 45, gangs: 1, walls: HOLLOW, role: "shallow", airtight: true, purpose: "Do sádrokartonu / dutých stěn – 45 mm, membránové vstupy, bez zahlubování okraje SDK", source: `${KOPOS}9395-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPR 68/71L", code: "KPR 68/71L_NA", depthMm: 70, gangs: 1, walls: HOLLOW, role: "deep", pitch71: true, purpose: "Do sádrokartonu / dutých stěn – hluboká 70 mm pro přístroje s velkou hloubkou a svorkovnici", source: `${KOPOS}2351-krabice-pristrojova` }),
  // Fáze 93: výrobce ji řadí do dutých stěn (šrouby do sádrokartonu) – i do SDK, nejen do dřevostavby
  box({ maker: "kopos", type: "KU 68 LD/1HF", code: "KU 68 LD/1HF_HA", depthMm: 45, gangs: 1, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, halogenFree: true, purpose: "Do dutých stěn, dřevostavby a pasivního domu – bezhalogenová 45 mm s membránou", source: `${KOPOS}2885-krabice-univerzalni-bezhalogenova` }),
  box({ maker: "kopos", type: "KPRL 68-70/LD", code: "KPRL 68-70/LD_NA", depthMm: 70, gangs: 1, walls: HOLLOW_AIRTIGHT, role: "deep", airtight: true, pitch71: true, purpose: "Do dřevostavby / pasivního domu i zvukotěsné SDK stěny – vzduchotěsná hluboká 70 mm", source: `${KOPOS}3048-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPL 64-50/2LD", code: "KPL 64-50/2LD_NA", depthMm: 50, gangs: 2, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – dvojnásobná vzduchotěsná 50 mm pro sdružené rámečky", source: `${KOPOS}3073-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPL 64-50/3LD", code: "KPL 64-50/3LD_NA", depthMm: 50, gangs: 3, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – trojnásobná vzduchotěsná 50 mm pro sdružené rámečky", source: `${KOPOS}3081-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPL 64-50/4LD", code: "KPL 64-50/4LD_NA", depthMm: 50, gangs: 4, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – čtyřnásobná vzduchotěsná 50 mm pro sdružené rámečky", source: `${KOPOS}10103-krabice-pristrojova` }),
  box({ maker: "kopos", type: "KPL 64-50/5LD", code: "KPL 64-50/5LD_NA", depthMm: 50, gangs: 5, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – pětinásobná vzduchotěsná 50 mm pro sdružené rámečky", source: `${KOPOS}11719-krabice-pristrojova` }),
  box({ maker: "kopos", type: "SB-KP 68-50/M", code: "SB-KP 68-50/M_AB", depthMm: 50, gangs: 1, walls: ["concrete"], role: "shallow", halogenFree: true, purpose: "Do litého betonu – na bednění (magnet fix), instalační hloubka 50 mm", source: `${KOPOS}13779-krabice-pristrojova-beton-magnet-fix` }),
  box({ maker: "kopos", type: "SB-KP 68-70/M", code: "SB-KP 68-70/M_AB", depthMm: 70, gangs: 1, walls: ["concrete"], role: "deep", halogenFree: true, purpose: "Do litého betonu – na bednění (magnet fix), instalační hloubka 70 mm", source: `${KOPOS}13787-krabice-pristrojova-beton-magnet-fix` }),
  box({ maker: "kopos", type: "KEZ", code: "KEZ_KB", depthMm: 200, gangs: 1, walls: ["etics"], role: "etics-box", purpose: "Do zateplené fasády 50–200 mm – krabice s izolační trubkou, bez tepelného mostu", source: `${KOPOS}2348-krabice-elektroinstalacni-do-zatepleni` }),
  box({ maker: "kopos", type: "KEZ-3", code: "KEZ-3_KB", depthMm: 250, gangs: 3, walls: ["etics"], role: "etics-box", purpose: "Do zateplené fasády 100–250 mm – 2 až 3 přístroje s roztečí 71 mm", source: `${KOPOS}2882-krabice-elektroinstalacni-vicenasobna-do-zatepleni` }),
  box({ maker: "kopos", type: "MDZ", code: "MDZ_KB", depthMm: 200, gangs: 1, walls: ["etics"], role: "etics-plate", purpose: "Montážní deska do zateplení 50–200 mm – venkovní svítidla, pohybová čidla, kamery a zásuvky 400 V", source: `${KOPOS}2349-montazni-deska-do-zatepleni` }),
  // Fáze 93: bezhalogenové krabice HF pro prostory pro veřejnost (BD4) – kategorie „bezhalogenové“ na kopos.cz (2026-11-11)
  box({ maker: "kopos", type: "KU 68-45/HF", code: "KU 68-45/HF_HA", depthMm: 45, gangs: 1, walls: MASONRY, role: "shallow", halogenFree: true, purpose: "Do zdiva / pod omítku – bezhalogenová univerzální krabice 45 mm (BD4, prostory pro veřejnost)", source: `${KOPOS}12905-krabice-univerzalni-bezhalogenova` }),
  box({ maker: "kopos", type: "KPR 68-70/HF", code: "KPR 68-70/HF_HA", depthMm: 70, gangs: 1, walls: MASONRY, role: "electronics", halogenFree: true, purpose: "Pod omítku – bezhalogenová přístrojová krabice 70 mm pro hluboké přístroje a svorkování (BD4)", source: `${KOPOS}12906-krabice-pristrojova-bezhalogenova` }),
  box({ maker: "kopos", type: "KPL 64-50/2LD HF", code: "KPL 64-50/2LD HF_KA", depthMm: 50, gangs: 2, walls: HOLLOW, role: "shallow", halogenFree: true, purpose: "Do dutých stěn – bezhalogenová dvojnásobná krabice 50 mm pro sdružené rámečky (BD4)", source: `${KOPOS}13519-krabice-pristrojova-bezhalogenova` }),
  // ── Kaiser ──────────────────────────────────────────────────────────────────────────────────────────────
  box({ maker: "kaiser", type: "Gerätedose UP¹", code: "1055-05", depthMm: 46, gangs: 1, walls: MASONRY, role: "shallow", pitch71: true, purpose: "Do zdiva – přístrojová krabice 46 mm (osazení do sádry)", source: `${KAISER}p/Geraetedose-UP1/1055-05` }),
  box({ maker: "kaiser", type: "Geräte-Verbindungsdose UP¹", code: "1555-05", depthMm: 66, gangs: 1, walls: MASONRY, role: "deep", pitch71: true, purpose: "Do zdiva – přístrojová a rozbočovací krabice 66 mm", source: `${KAISER}p/Geraete-Verbindungsdose-UP1/1555-05` }),
  box({ maker: "kaiser", type: "Electronic-Dose UP¹", code: "1068-05", depthMm: 67, gangs: 1, walls: MASONRY, role: "electronics", pitch71: true, purpose: "Do zdiva – s bočním prostorem pro svorky a elektroniku (aktor), přepážka pro dvě napětí", source: `${KAISER}p/Electronic-Dose-UP1/1068-05` }),
  box({ maker: "kaiser", type: "Gerätedose O-range® Evo", code: "9063-03", depthMm: 49, gangs: 1, walls: HOLLOW, role: "shallow", pitch71: true, purpose: "Do sádrokartonu / dutých stěn – přístrojová krabice 49 mm", source: `${KAISER}c/Produkte/Elektroinstallation/Hohlwand/Geraetedosen-Geraete-Verbindungsdosen-Zubehoer/` }),
  box({ maker: "kaiser", type: "Electronic-Dose O-range® ECON® Flex", code: "9268-94", depthMm: 75, gangs: 1, walls: HOLLOW_AIRTIGHT, role: "electronics", airtight: true, purpose: "Do dutých stěn – vzduchotěsná 75 mm pro přístroje a elektronické komponenty", source: `${KAISER}c/Produkte/Elektroinstallation/Hohlwand/Luftdichte-Geraetedosen-Geraete-Verbindungsdosen-Zubehoer/` }),
  box({ maker: "kaiser", type: "Gerätedose O-range® ECON® Evo, luftdicht", code: "9263-23", depthMm: 49, gangs: 1, walls: AIRTIGHT, role: "shallow", airtight: true, pitch71: true, purpose: "Do dřevostavby / pasivního domu – vzduchotěsná 49 mm s těsnicími membránami", source: `${KAISER}c/Produkte/Elektroinstallation/Hohlwand/Luftdichte-Geraetedosen-Geraete-Verbindungsdosen-Zubehoer/` }),
  box({ maker: "kaiser", type: "Geräte-Verbindungsdose ECON® Iso+", code: "1159-55", depthMm: null, gangs: 1, walls: ["etics"], role: "etics-box", purpose: "Do zateplené fasády (WDVS s dřevovláknitou / minerální izolací od 60 mm)", source: `${KAISER}c/Produkte/Elektroinstallation/Unterputz/Installationssysteme-fuer-gedaemmte-Aussenfassaden/` }),
  box({ maker: "kaiser", type: "Universal-Geräteträger", code: "1159-24", depthMm: null, gangs: 1, walls: ["etics"], role: "etics-plate", purpose: "Nosič přístrojů a svítidel při vnějším zateplení stěn", source: `${KAISER}c/Produkte/Elektroinstallation/Unterputz/Installationssysteme-fuer-gedaemmte-Aussenfassaden/` }),
  // ── Schneider Electric (Multifix Air) ──────────────────────────────────────────────────────────────────
  box({ maker: "schneider", type: "Multifix Air 67 × 47 mm", code: "IMT35032", depthMm: 47, gangs: 1, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – vzduchotěsná montážní krabice 1-násobná 47 mm", source: "https://www.se.com/ua/uk/product/IMT35032/" }),
  box({ maker: "schneider", type: "Multifix Air 2-násobná 67 × 40 mm", code: "IMT35000", depthMm: 40, gangs: 2, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – vzduchotěsná 2-násobná 40 mm", source: "https://www.se.com/ua/uk/product/IMT35001/" }),
  box({ maker: "schneider", type: "Multifix Air 3-násobná 67 × 40 mm", code: "IMT35031", depthMm: 40, gangs: 3, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – vzduchotěsná 3-násobná 40 mm", source: "https://www.se.com/ua/uk/product/IMT35001/" }),
  box({ maker: "schneider", type: "Multifix Air 4-násobná 67 × 47 mm", code: "IMT35033", depthMm: 47, gangs: 4, walls: HOLLOW_AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dutých stěn – vzduchotěsná 4-násobná 47 mm", source: "https://www.se.com/ua/uk/product/IMT35032/" }),
  // ── OBO Bettermann ─────────────────────────────────────────────────────────────────────────────────────
  box({ maker: "obo", type: "UG 46", code: "2003700", depthMm: 46, gangs: 1, walls: MASONRY, role: "shallow", purpose: "Do zdiva – přístrojová krabice 46 mm", source: `${OBO}up-unterputz-geraetedose-46-46-60-20-25-mm-7-2003700.html` }),
  box({ maker: "obo", type: "UG 66", code: "2003702", depthMm: 66, gangs: 1, walls: MASONRY, role: "deep", purpose: "Do zdiva – přístrojová a rozbočovací krabice 66 mm (krabici pro elektroniku OBO nevede)", source: "https://obo.de/produkte/up-unterputz-geraete-verbindungsdose-66-66-60-20-25-mm-13-2003702.html" }),
  box({ maker: "obo", type: "HG 60", code: "2003414", depthMm: 45, gangs: 1, walls: HOLLOW, role: "shallow", purpose: "Do sádrokartonu / dutých stěn – přístrojová krabice 45 mm", source: "https://www.obo.de/out/media/VBS-HG_60-2003414-de.pdf" }),
  box({ maker: "obo", type: "HG 61-L", code: "2003808", depthMm: 61, gangs: 1, walls: AIRTIGHT, role: "shallow", airtight: true, purpose: "Do dřevostavby / pasivního domu – vzduchotěsná přístrojová a rozbočovací krabice 61 mm", source: `${OBO}hw-hohlwand-geraete-verbindungsdose-61-luftdicht-61-68-68-20-25-mm-10-2003808.html` }),
  // ── SEZ Dolný Kubín ────────────────────────────────────────────────────────────────────────────────────
  box({ maker: "sez", type: "Univerzálna krabica 6400-201/3", code: "400100", depthMm: 43, gangs: 1, walls: MASONRY, role: "shallow", purpose: "Do zdiva – univerzální krabice 71 × 43 mm", source: "https://www.sez.sk/produkty/univerzalna-krabica-71-x-43-mm-6400-201-3/" }),
  box({ maker: "sez", type: "Univerzálna krabica 6400H-201/3 (71 × 73 mm)", code: null, depthMm: 73, gangs: 1, walls: MASONRY, role: "deep", purpose: "Do zdiva – hluboká univerzální krabice 71 × 73 mm", source: "https://www.sez.sk/kategoria/instalacne-skatule-a-vyvodky/" }),
  box({ maker: "sez", type: "Univerzálna krabica KUP 68 LP/SK", code: "400211", depthMm: 45, gangs: 1, walls: HOLLOW, role: "shallow", purpose: "Do dutých příček – univerzální krabice 45 mm", source: "https://www.sez.sk/produkty/univerzalna-krabica-kup-68-lp-sk/" }),
  box({ maker: "sez", type: "Univerzálna hlboká krabica KUP 68H-201/3 LP SK (71 × 73 mm)", code: null, depthMm: 73, gangs: 1, walls: HOLLOW, role: "deep", purpose: "Do dutých příček – hluboká univerzální krabice 71 × 73 mm", source: "https://www.sez.sk/produkty/univerzalna-hlboka-krabica-71-x-73-mm-kup-68h-201-3-lp-sk/" }),
];

export const boxMakerLabel = (maker: BoxMaker) => BOX_MAKERS.find((entry) => entry.id === maker)?.label ?? maker;

/** Fáze 94: vestavná hloubka přístroje podle oficiálních dat výrobce. */
export interface DeviceDepth {
  /** Vestavná hloubka nejhlubšího dílu přístroje [mm]. */
  depthMm: number;
  /** Objednací číslo dílu (strojek, zásuvka), jehož hloubku data výrobce uvádějí. */
  mpn: string;
}

/** Zdroj vestavných hloubek přístrojů (detail prvku, hlášení kontroly). */
export const DEVICE_DEPTH_SOURCE = "ABB ETIM 9.0";

/** Fáze 94: vestavná hloubka přístroje řady („ABB|Tango“ + „socket“) z dat ETIM; null = výrobce ji v datech neuvádí. */
export function deviceDepthOf(series: string | null | undefined, item: string): DeviceDepth | null {
  return series ? (ETIM_DEVICE_DEPTHS[`${series}|${item}`] ?? null) : null;
}

/** Milimetry s desetinnou čárkou („24,6“). */
export const formatMm = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");
export const wallTypeOf = (wall: WallType) => WALL_TYPES.find((entry) => entry.id === wall)!;

/** Fáze 93: volby výběru krabice – v BD4 (obchodní centrum) jen bezhalogenové krabice HF. */
export interface BoxPickOptions {
  halogenFree?: boolean;
}

/** Fáze 93: volby výběru krabic podle režimu objektu nákresu. */
export const boxPickOptionsOf = (draft: Partial<Pick<FloorplanDraft, "occupancy">>): BoxPickOptions => (isCommercial(draft.occupancy) ? { halogenFree: true } : {});

/** Krabice výrobce podle stěny a třídy (hlubší vyhoví i mělčí potřebě); null = výrobce takovou krabici nevede. */
export function pickBox(maker: BoxMaker, wall: WallType, need: BoxDepthClass, gangs = 1, options: BoxPickOptions = {}): MountingBox | null {
  const candidates = MOUNTING_BOXES.filter((entry) => entry.maker === maker && entry.walls.includes(wall) && entry.gangs === gangs && entry.role !== "etics-box" && entry.role !== "etics-plate" && (!options.halogenFree || entry.halogenFree));
  const fits = (entry: MountingBox) => (entry.depthMm ?? 0) >= MIN_DEPTH_MM[need] && CLASS_ORDER[entry.role as BoxDepthClass] >= (need === "electronics" ? CLASS_ORDER.deep : CLASS_ORDER[need]);
  // Přednost: přesně požadovaná třída, pak nejbližší hlubší (s prostorem pro elektroniku → hluboká 66 mm, když ji výrobce nevede)
  const order: BoxDepthClass[] = need === "shallow" ? ["shallow", "deep", "electronics"] : need === "deep" ? ["deep", "electronics"] : ["electronics", "deep"];
  for (const role of order) {
    const found = candidates.find((entry) => entry.role === role && fits(entry));
    if (found) return found;
  }
  return null;
}

/** Krabice / deska do zateplené fasády (přístroj, nebo montážní deska pro svítidlo a čidlo). */
export function pickEticsBox(maker: BoxMaker, role: "etics-box" | "etics-plate", gangs = 1, options: BoxPickOptions = {}): MountingBox | null {
  const candidates = MOUNTING_BOXES.filter((entry) => entry.maker === maker && entry.role === role && (!options.halogenFree || entry.halogenFree));
  return candidates.find((entry) => entry.gangs === gangs) ?? candidates.find((entry) => entry.gangs >= gangs) ?? null;
}

// ---------------------------------------------------------------------------
//  Potřebná hloubka krabice prvku
// ---------------------------------------------------------------------------

export interface BoxNeed {
  /**
   * Co prvek potřebuje: přístrojová krabice dané třídy, `surface` = nástěnná montáž (0 krabic), `panel` = originální
   * montážní krabice výrobce panelu, `etics-plate` = montážní deska do zateplení, `none` = bez krabice.
   */
  kind: BoxDepthClass | "surface" | "panel" | "etics-plate" | "none";
  minDepthMm: number;
  /** Proč (stmívač, WAGO svorky …); prázdné u běžné mělké krabice. */
  reasons: string[];
  /** Fáze 94: vestavná hloubka přístroje z dat výrobce (ABB ETIM 9.0), když ji výrobce uvádí. */
  device?: DeviceDepth;
}

export interface BoxContext {
  /** Počet kabelů, které končí v krabici prvku (úseky tras od / do prvku); bez údaje se nehodnotí. */
  cableEnds?: number;
}

const NONE: BoxNeed = { kind: "none", minDepthMm: 0, reasons: [] };

/** Konstrukce stěny místnosti prvku (vlastní u místnosti, jinak nákresu). */
export function wallTypeFor(draft: Pick<FloorplanDraft, "wallType" | "rooms" | "otherFloors">, roomName: string): WallType {
  const rooms: EditorRoom[] = [...draft.rooms, ...draft.otherFloors.flatMap((floor) => floor.rooms)];
  return rooms.find((room) => room.name === roomName)?.wallType ?? draft.wallType ?? DEFAULT_WALL_TYPE;
}

/** Přístroj pod omítku (vypínač, zásuvka, datová zásuvka, sběrnicové tlačítko). */
const isWallDevice = (kind: string | undefined) => kind === "switch" || kind === "single_socket" || kind === "double_socket" || kind === "data_socket";

/** Potřebná krabice prvku podle přístroje, úrovně instalace, řady a konstrukce stěny. */
export function boxNeed(draft: FloorplanDraft, element: EditorElement, context: BoxContext = {}): BoxNeed {
  const item = paletteItem(element.item);
  if (!item) return NONE;
  const wall = wallTypeFor(draft, element.room);
  // Sporáková přípojka (varná deska 3f) – svorkovnice v hluboké krabici
  if (item.kind === "appliance") return item.tag === "cooktop_3p" ? { kind: wall === "surface" ? "surface" : "deep", minDepthMm: MIN_DEPTH_MM.deep, reasons: ["přípojka varné desky / sporáku (svorkovnice 400 V)"] } : NONE;
  // Venkovní svítidlo a pohybové čidlo na zateplené fasádě – montážní deska do zateplení
  if (wall === "etics" && ((item.kind === "light" && item.variant === "wall") || item.wiringCategory === "WD_SENSOR")) return { kind: "etics-plate", minDepthMm: 0, reasons: ["svítidlo / čidlo na zateplené fasádě"] };
  if (!isWallDevice(item.kind) || item.wireless || item.heatingHead) return NONE;
  if (item.bus?.role === "presence") return NONE;
  // Fáze 81: panel chytré domácnosti s vlastní montážní krabicí výrobce (IP TOUCH, SmartTouch …)
  const product = productById(element.product);
  if (product?.panel || item.bus?.role === "display") return { kind: "panel", minDepthMm: 0, reasons: ["originální montážní krabice výrobce panelu"] };
  const series = element.series ?? draft.series;
  if (isSurfaceMountedSeries(series)) return { kind: "surface", minDepthMm: 0, reasons: ["nástěnný přístroj řady (bez podomítkové krabice)"] };
  if (wall === "surface") return { kind: "surface", minDepthMm: 0, reasons: ["nástěnná montáž IP44 / IP54 v místnosti"] };
  // Fáze 94: oficiální vestavná hloubka přístroje (ABB ETIM 9.0)
  const device = deviceDepthOf(series, element.item);
  const withDevice = (need: BoxNeed): BoxNeed => (device ? { ...need, minDepthMm: Math.max(need.minDepthMm, Math.ceil(device.depthMm)), device } : need);
  // Elektronika v krabici: akční člen / flexTronics pod rámečkem, modul pod vypínač (retrofit)
  const reasons: string[] = [];
  if (product?.kind === "inbox") reasons.push(`${product.label.replace(/ \(.*\)$/, "")} v krabici`);
  if (product?.wiring === "flextronics") reasons.push("elektronická vložka ABB-flexTronics® pod rámečkem");
  if (draft.installation === "smart_retrofit" && item.kind === "switch" && !item.bus && (element.controls.length > 0 || item.control === "blind")) reasons.push(item.control === "blind" ? "žaluziový modul pod vypínač" : "chytrý modul pod vypínač (retrofit)");
  // Přístroj hlubší, než zaručuje i hluboká krabice (66 mm) → nejhlubší třída (KOPOS KPR 68-70)
  if (device && device.depthMm > MIN_DEPTH_MM.deep) reasons.push(`vestavná hloubka přístroje ${formatMm(device.depthMm)} mm (${DEVICE_DEPTH_SOURCE})`);
  if (reasons.length) return withDevice({ kind: "electronics", minDepthMm: MIN_DEPTH_MM.electronics, reasons });
  // Hluboký strojek a svorkování
  if (item.wiringCategory === "WD_DIMMER") reasons.push("stmívač 230 V (hluboký strojek)");
  if (item.control === "thermostat") reasons.push("prostorový termostat (hluboký strojek)");
  if (item.kind === "data_socket") reasons.push("datová zásuvka RJ45 – poloměr ohybu kabelu Cat6A / Cat7");
  if (item.variant === "usb") reasons.push("zásuvka s USB-A / USB-C nabíječkou (hluboký strojek)");
  if (item.variant === "surge") reasons.push("zásuvka s přepěťovou ochranou T3 (hluboký strojek)");
  if (draft.installation === "classic" && item.kind === "switch" && !item.bus && !item.sensor) reasons.push("WAGO svorky pro rozbočení ke svítidlům za strojkem");
  if ((item.kind === "single_socket" || item.kind === "double_socket") && (context.cableEnds ?? 0) > 2) reasons.push(`rozbočení – v krabici končí ${context.cableEnds} kabely`);
  // Fáze 94: přístroj hlubší než 40 mm (nejmenší hloubka mělké krabice) se do mělké krabice nevejde
  if (device && device.depthMm > MIN_DEPTH_MM.shallow) reasons.push(`vestavná hloubka přístroje ${formatMm(device.depthMm)} mm (${DEVICE_DEPTH_SOURCE}) – víc než ${MIN_DEPTH_MM.shallow} mm mělké krabice`);
  if (reasons.length) return withDevice({ kind: "deep", minDepthMm: MIN_DEPTH_MM.deep, reasons });
  return withDevice({ kind: "shallow", minDepthMm: MIN_DEPTH_MM.shallow, reasons: [] });
}

export interface ResolvedBox {
  need: BoxNeed;
  choice: BoxChoice;
  /** Skutečně použitá třída / způsob montáže. */
  kind: BoxNeed["kind"];
  wall: WallType;
  box: MountingBox | null;
  /** Ruční volba je mělčí, než přístroj potřebuje (nebo se přístroj podle dat výrobce do krabice nevejde). */
  tooShallow: boolean;
  /** Fáze 94: volné místo za přístrojem ve zvolené krabici [mm] (hloubka krabice − vestavná hloubka přístroje z ETIM). */
  freeDepthMm?: number;
  /** Fáze 93: obchodní centrum (BD4) – jen bezhalogenové krabice HF. */
  halogenFree?: boolean;
}

/** Krabice prvku: automaticky podle potřeby, nebo ruční volba z detailu prvku. */
export function resolveBox(draft: FloorplanDraft, element: EditorElement, context: BoxContext = {}): ResolvedBox {
  const need = boxNeed(draft, element, context);
  const choice: BoxChoice = element.box ?? "auto";
  const wall = wallTypeFor(draft, element.room);
  const maker = draft.boxMaker ?? DEFAULT_BOX_MAKER;
  const device = need.kind === "shallow" || need.kind === "deep" || need.kind === "electronics";
  // Ruční volba platí jen u přístrojů do krabice (nástěnná montáž i u nich)
  const kind: BoxNeed["kind"] = device && choice !== "auto" ? choice : need.kind;
  const shallower = device && (kind === "shallow" || kind === "deep" || kind === "electronics") && kind !== need.kind && CLASS_ORDER[kind] < CLASS_ORDER[need.kind as BoxDepthClass];
  const options = boxPickOptionsOf(draft);
  const chosenBox = wall === "etics" && device ? pickEticsBox(maker, "etics-box", 1, options) : kind === "etics-plate" ? pickEticsBox(maker, "etics-plate", 1, options) : kind === "shallow" || kind === "deep" || kind === "electronics" ? pickBox(maker, wall, kind, 1, options) : null;
  // Fáze 94: volné místo za přístrojem podle vestavné hloubky z dat výrobce (jen u přístrojových krabic se známou hloubkou)
  const boxDepth = chosenBox && (chosenBox.role === "shallow" || chosenBox.role === "deep" || chosenBox.role === "electronics") ? chosenBox.depthMm : null;
  const freeDepthMm = need.device && boxDepth ? Math.round((boxDepth - need.device.depthMm) * 10) / 10 : undefined;
  const tooShallow = Boolean(shallower) || (freeDepthMm !== undefined && freeDepthMm < 0);
  return { need, choice, kind, wall, box: chosenBox, tooShallow, ...(freeDepthMm !== undefined ? { freeDepthMm } : {}), ...(options.halogenFree ? { halogenFree: true } : {}) };
}

/** Popis krabice do detailu prvku: „Hluboká 66 mm – KOPOS KPR 68 (stmívač 230 V)“. */
export function boxSummary(resolved: ResolvedBox, maker: BoxMaker): string {
  const { kind, box: own, need } = resolved;
  if (kind === "none") return "bez instalační krabice";
  if (kind === "surface") return "bez podomítkové krabice – nástěnná montáž";
  if (kind === "panel") return "originální montážní krabice výrobce panelu";
  const why = need.reasons.length ? ` (${need.reasons.join(", ")})` : "";
  if (!own) return `${kind === "etics-plate" ? "Montážní deska do zateplení" : CLASS_LABEL[kind as BoxDepthClass]}${resolved.halogenFree ? " bezhalogenová (HF)" : ""} – ${boxMakerLabel(maker)} tento typ nevede, doplňte ručně${why}`;
  const depth = own.depthMm ? (own.role === "etics-box" || own.role === "etics-plate" ? ` (izolace do ${own.depthMm} mm)` : ` ${own.depthMm} mm`) : "";
  const label = own.role === "etics-box" ? "Do zateplení" : own.role === "etics-plate" ? "Montážní deska do zateplení" : CLASS_LABEL[own.role as BoxDepthClass];
  return `${label}${depth} – ${boxMakerLabel(own.maker)} ${own.type}${why}`;
}

const CLASS_LABEL: Record<BoxDepthClass, string> = { shallow: "Mělká", deep: "Hluboká", electronics: "S prostorem pro elektroniku" };

// ---------------------------------------------------------------------------
//  Souhrn do kusovníku
// ---------------------------------------------------------------------------

export interface BoxBomLine {
  box: MountingBox | null;
  /** Bez krabice z katalogu: popis potřeby (výrobce typ nevede). */
  missing?: string;
  maker: BoxMaker;
  quantity: number;
}

/**
 * Krabice pro skupinu pozic (víceramček nebo prvek s N kusy v rámečku): vícenásobná krabice, když všechny pozice stačí
 * mělká a výrobce ji pro stěnu vede, jinak spojovatelné krabice po jedné pozici (rozteč 71 mm) podle potřeby každé pozice.
 */
export function boxesForPositions(maker: BoxMaker, wall: WallType, positions: readonly BoxDepthClass[], options: BoxPickOptions = {}): BoxBomLine[] {
  const lines: BoxBomLine[] = [];
  const add = (entry: MountingBox | null, missing: string | undefined, quantity: number) => {
    const same = lines.find((line) => line.box === entry && line.missing === missing);
    if (same) same.quantity += quantity;
    else lines.push({ box: entry, ...(missing ? { missing } : {}), maker, quantity });
  };
  if (positions.length >= 2 && positions.every((position) => position === "shallow")) {
    const multi = pickBox(maker, wall, "shallow", positions.length, options);
    if (multi && multi.gangs === positions.length) {
      add(multi, undefined, 1);
      return lines;
    }
  }
  for (const position of positions) {
    const own = pickBox(maker, wall, position, 1, options);
    add(own, own ? undefined : `${CLASS_LABEL[position]} krabice${options.halogenFree ? " bezhalogenová (HF)" : ""} ${wallTypeOf(wall).short}`, 1);
  }
  return lines;
}

/** Kusy krabice podle prvku nebo víceramečku (pro tabulku krabic a kusovník). */
export interface BoxUsage extends BoxBomLine {
  wall: WallType;
}

/**
 * Fáze 91: všechny instalační krabice domu – víceramček = vícenásobná krabice nebo spojované krabice po pozicích
 * (dvojzásuvka v rámečku = 2 pozice), Decento = samostatné krabice (rozteč min. 90 mm), zateplená fasáda = krabice /
 * deska do zateplení, nástěnné řady a místnosti s nástěnnou montáží = bez krabice. Panely chytré domácnosti mají vlastní
 * krabici výrobce (řádky panelu v kusovníku).
 */
export function compileBoxUsage(draft: FloorplanDraft, cableEnds: Readonly<Record<string, number>> = {}): BoxUsage[] {
  const maker = draft.boxMaker ?? DEFAULT_BOX_MAKER;
  // Fáze 93: obchodní centrum (BD4) – jen bezhalogenové krabice HF
  const options = boxPickOptionsOf(draft);
  const usage: BoxUsage[] = [];
  const push = (wall: WallType, lines: BoxBomLine[]) => {
    for (const line of lines) {
      const same = usage.find((entry) => entry.box === line.box && entry.missing === line.missing && entry.wall === wall);
      if (same) same.quantity += line.quantity;
      else usage.push({ ...line, wall });
    }
  };
  const everything = allElements(draft);
  const byId = new Map(everything.map((element) => [element.id, element]));
  const framed = new Set<string>();
  for (const floor of floorsOf(draft)) {
    for (const group of floor.frames) {
      const members = group.members.map((id) => byId.get(id)).filter((element): element is EditorElement => Boolean(element));
      if (members.length < 2) continue;
      for (const member of members) framed.add(member.id);
      const resolved = members.map((member) => ({ member, own: resolveBox(draft, member, { cableEnds: cableEnds[member.id] }) }));
      const wall = resolved[0].own.wall;
      if (resolved.every(({ own }) => own.kind === "surface" || own.kind === "none")) continue;
      const positions = resolved.flatMap(({ member, own }) => (own.kind === "shallow" || own.kind === "deep" || own.kind === "electronics" ? Array.from({ length: gangsOf(member) }, () => own.kind as BoxDepthClass) : []));
      if (wall === "etics") {
        const multi = positions.length >= 2 && positions.length <= 3 ? pickEticsBox(maker, "etics-box", 3, options) : null;
        const single = pickEticsBox(maker, "etics-box", 1, options);
        push(wall, multi && multi.gangs >= positions.length ? [{ box: multi, maker, quantity: 1 }] : [{ box: single, ...(single ? {} : { missing: "Krabice do zateplené fasády" }), maker, quantity: positions.length }]);
        continue;
      }
      // Decento nejde do vícenásobných rámečků – každý přístroj ve vlastní krabici
      const separate = frameRulesOf(members[0].series ?? draft.series).separateDevices;
      if (separate) {
        for (const position of positions) push(wall, boxesForPositions(maker, wall, [position], options));
        continue;
      }
      push(wall, boxesForPositions(maker, wall, positions, options));
    }
  }
  for (const element of everything) {
    if (framed.has(element.id)) continue;
    const own = resolveBox(draft, element, { cableEnds: cableEnds[element.id] });
    const units = Math.max(1, element.frameUnits);
    if (own.kind === "etics-plate") {
      push(own.wall, [{ box: own.box, ...(own.box ? {} : { missing: "Montážní deska do zateplené fasády" }), maker, quantity: 1 }]);
      continue;
    }
    if (own.kind !== "shallow" && own.kind !== "deep" && own.kind !== "electronics") continue;
    if (own.wall === "etics") {
      const single = pickEticsBox(maker, "etics-box", 1, options);
      push(own.wall, [{ box: single, ...(single ? {} : { missing: `Krabice do zateplené fasády${options.halogenFree ? " bezhalogenová (HF)" : ""}` }), maker, quantity: units }]);
      continue;
    }
    // N stejných kusů v jednom rámečku (frameUnits) = N pozic; Decento vždy samostatně
    const separate = frameRulesOf(element.series ?? draft.series).separateDevices;
    const positions = Array.from({ length: units }, () => own.kind as BoxDepthClass);
    if (separate || units === 1) for (const position of positions) push(own.wall, boxesForPositions(maker, own.wall, [position], options));
    else push(own.wall, boxesForPositions(maker, own.wall, positions, options));
  }
  return usage;
}
