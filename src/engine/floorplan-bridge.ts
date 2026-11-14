// Most „půdorys → rozváděč“ (fáze 44): deterministický výpočetní modul, který z 2D půdorysu domovní
// elektroinstalace (zásuvky, světla, spotřebiče, ovládací místa) vytvoří okruhy dle ČSN 33 2130 ed. 4,
// rozdělí je na fáze a pod proudové chrániče, sestaví přístroje na DIN lišty a vybere skříň rozváděče.
// Čisté funkce bez Prismy a bez UI – specifikace v FLOORPLAN_SPEC.md, testy v floorplan-bridge.test.ts.

import type { ComponentCategory } from "@/generated/prisma/enums";
import { estimatePowerLoss } from "@/lib/panel-builder/catalog";
import type { ItemConfig } from "@/lib/panel-builder/configurator";
import type { EnclosureLike } from "@/lib/panel-builder/enclosures";
import { CONCEPT_INFO, SINGLE_LAYOUT, fillRailsToEnclosure, fitsLayout, layoutNeed, layoutOptions, matchLayoutEnclosures, packRails, planLayout, planTwoBoards, type LayoutConcept, type PackGroup, type PlannedRail, type RailLayout } from "@/lib/panel-builder/rail-layout";
import { constructionDetails } from "@/lib/panel-builder/environments";
import { HDO_CONTROL, hdoContactorFor, hdoContactorLabel, hdoEnabled, isHdoTag } from "@/lib/panel-builder/hdo";
import { CENTRAL_STOP_LABEL, MEDICAL_CIRCUIT, MID_METER_LABEL, isCommercial, isMedical, isMedicalRoom, midMeterConfig, shuntTripConfig, type MedicalCircuit, type OccupancyId } from "@/lib/panel-builder/occupancy";

import { planSocketGroups, type SocketGrouping } from "./socket-zones";

// ===========================================================================
//  1. Kalibrace měřítka půdorysu a délky kabelů
// ===========================================================================

export type Point = readonly [x: number, y: number];

/** Referenční stěna na podkladu: úsečka v pixelech a její skutečná délka v mm. */
export interface ReferenceWall {
  px: readonly [x1: number, y1: number, x2: number, y2: number];
  lengthMm: number;
}

/** Montážní výšky a instalační zóny (ČSN 33 2130 ed. 4) v mm. */
export const INSTALLATION_ZONES = {
  /** Vodorovná trasa v horní instalační zóně: 300 mm pod stropem. */
  ceilingTraceBelowCeilingMm: 300,
  /** Osa zásuvky nad podlahou. */
  socketHeightMm: 300,
  /** Osa spínače nad podlahou. */
  switchHeightMm: 1050,
  /** Výchozí světlá výška místnosti. */
  ceilingHeightMm: 2600,
  /** Výška přívodu do rozváděče (vstup kabelů nad lištami). */
  panelEntryHeightMm: 1700,
} as const;

/** Fáze 77: `blind_motor` = vývod pro motor žaluzie / rolety u okna (230 V AC na žaluziovém okruhu B10). */
export type NodeKind = "single_socket" | "double_socket" | "light" | "switch" | "appliance" | "data_socket" | "blind_motor";

/** Upřesnění prvku (fáze 49): zásuvka nad linkou, IP44, nástěnné svítidlo, tlačítko. */
/** Fáze 91: „usb“ = zásuvka s USB nabíječkou, „surge“ = zásuvka s přepěťovou ochranou T3 (výška běžné zásuvky). */
/** Fáze 101: `tv` = anténní zásuvka TV / SAT (koaxiální kabel z rozváděče / multipřepínače, ne UTP). */
export type NodeVariant = "worktop" | "ip44" | "wall" | "button" | "usb" | "surge" | "tv";

/** Bod půdorysu (zásuvka, svítidlo, spínač nebo pevně připojený spotřebič). */
export interface FloorNode {
  id: string;
  room: string;
  kind: NodeKind;
  px: Point;
  /** Spotřebič / vyhrazená zásuvka (oven, dishwasher, fridge, cooktop_3p, ev_charger …). */
  tag?: ApplianceTag;
  /** Příkon [W]; bez údaje výchozí hodnota podle druhu / štítku. */
  powerW?: number;
  /** Fáze 49: vlastní montážní výška osy krabice od čisté podlahy [mm]; jinak výchozí podle druhu (`mountHeight`). */
  mountHeightMm?: number;
  variant?: NodeVariant;
  /** Společný vícenásobný rámeček (1R–5R): prvky se stejným `frame` se propojují přímo v krabici. */
  frame?: string;
  /** Fáze 59: podlaží (vícepodlažní dům) – okruhy zásuvek a světel se nemíchají mezi podlažími. */
  floor?: string;
  /** Fáze 59: délka trasy z rozváděče předpočítaná měřidlem tras (stoupací vedení, fáze 60 podél stěn) [mm]. */
  lengthMm?: number;
  /** Fáze 63: upravený / vlastní samostatný spotřebič – vlastní okruh přesně podle zadání (jistič, chránič, kabel). */
  appliance?: ApplianceOverride;
  /** Fáze 65: ruční zásuvkový okruh („Z1“, „Z2“ …) – zásuvky se stejným klíčem tvoří jeden okruh; bez = automaticky. */
  socketCircuit?: string | null;
  /**
   * Fáze 82: zásuvka na světelném okruhu své místnosti (výjimečně – stojací lampa, digestoř, ventilátor); okruh se jistí
   * 10 A nebo 13 A (`DesignOptions.lightingSocketA`), nikdy 16 A. Podlaží bez světel ji vrátí na zásuvkový okruh.
   */
  onLighting?: boolean;
  /**
   * Fáze 77: svítidlo – technologie řízení. `dali` = světelný okruh kabelem 5×1,5 (L, N, PE, DA+, DA−), `pwm` = LED 24 V DC
   * ze zdroje v rozváděči (není na okruhu 230 V – zdroj má vlastní jistič). Bez údaje fázové / spínané 230 V.
   */
  lightControl?: "phase" | "dali" | "pwm";
  /** Fáze 77: pohon žaluzie – 230 V AC na žaluziovém okruhu, 24 V DC / sběrnicový ze zdroje a řadiče v rozváděči. */
  blindDrive?: "ac230" | "dc24" | "bus";
  /**
   * Fáze 93: zásuvka lůžkové rampy LUZ – pevný okruh A (zelené / bílé) nebo B (oranžové / zálohované) zdravotnického
   * prostoru Skupiny 1; ostatní zásuvky lékařské místnosti se střídají A / B automaticky.
   */
  medicalCircuit?: MedicalCircuit;
  /** Fáze 93: nouzové únikové svítidlo NO_SV (s vlastním akumulátorem, nespínaný přívod světelného okruhu). */
  emergency?: boolean;
  /**
   * Fáze 112: řízení nízkého tarifu (HDO) – bojler, tepelné čerpadlo, akumulační vytápění (výchozí ano) a wallbox (výchozí
   * ne); okruh dostane instalační stykač spínaný kontaktem přijímače HDO přes ovládací jistič B6.
   */
  hdo?: boolean;
}

/** Fáze 63: zadání samostatného spotřebiče z knihovny spotřebičů (`lib/panel-builder/appliances.ts`). */
export interface ApplianceOverride {
  label: string;
  powerW: number;
  poles: 1 | 3;
  ratedA: number;
  curve: "B" | "C";
  /** A = pod společný chránič typ A, F / B = vlastní chránič daného typu, RCBO = jistič s chráničem (1f). */
  rcd: "A" | "F" | "B" | "RCBO";
  /** Výchozí průřez kabelu [mm²] – výpočet ho zvětší při úbytku napětí nebo nesplněné koordinaci. */
  mm2: number;
  simultaneity: number;
}

export interface Calibration {
  /** Přepočet pixel → mm zvlášť pro osu X a Y (kompenzace zkosených skenů). */
  pxToMm: { x: number; y: number };
  /** Hlavní rozváděč v mm od počátku podkladu. */
  panelMm: { x: number; y: number };
  /** Ortogonální (Manhattan) délka kabelu z rozváděče k bodu včetně svislých úseků [mm]. */
  calculateCableLength: (node: Pick<FloorNode, "px" | "kind"> & Partial<Pick<FloorNode, "mountHeightMm" | "variant" | "tag">>) => number;
}

const segment = (wall: ReferenceWall) => ({ dx: Math.abs(wall.px[2] - wall.px[0]), dy: Math.abs(wall.px[3] - wall.px[1]) });

/**
 * Měřítko z 1 nebo 2 referenčních stěn. Jedna stěna = stejné měřítko v obou osách. Dvě stěny
 * (ideálně vodorovná a svislá) = řešení soustavy dx²·sx² + dy²·sy² = L² pro každou stěnu, takže
 * sken natažený jen v jedné ose se vyrovná. Nesmyslné řešení → průměrné jednotné měřítko.
 */
export function calibrateFloorplanScale(input: {
  walls: readonly ReferenceWall[];
  panelPx: Point;
  ceilingHeightMm?: number;
  panelEntryHeightMm?: number;
  /** Fáze 49: 3D výškový profil – délka kabelu podle montážních výšek a režimu vedení (jinak instalační zóny fáze 44). */
  elevation?: Partial<ElevationProfile>;
  routing?: CableRoutingMode;
}): Calibration {
  const walls = input.walls.filter((wall) => wall.lengthMm > 0 && Math.hypot(segment(wall).dx, segment(wall).dy) > 0);
  if (!walls.length || walls.length > 2) throw new Error("Kalibrace potřebuje 1 nebo 2 referenční stěny s nenulovou délkou.");
  const uniform = walls.reduce((sum, wall) => sum + wall.lengthMm / Math.hypot(segment(wall).dx, segment(wall).dy), 0) / walls.length;
  let x = uniform;
  let y = uniform;
  if (walls.length === 2) {
    const [a, b] = walls.map(segment);
    const det = a.dx ** 2 * b.dy ** 2 - a.dy ** 2 * b.dx ** 2;
    if (Math.abs(det) > 1e-9) {
      const sx2 = (walls[0].lengthMm ** 2 * b.dy ** 2 - walls[1].lengthMm ** 2 * a.dy ** 2) / det;
      const sy2 = (a.dx ** 2 * walls[1].lengthMm ** 2 - b.dx ** 2 * walls[0].lengthMm ** 2) / det;
      if (sx2 > 0 && sy2 > 0) {
        x = Math.sqrt(sx2);
        y = Math.sqrt(sy2);
      }
    }
  }
  const zones = { ...INSTALLATION_ZONES, ceilingHeightMm: input.ceilingHeightMm ?? INSTALLATION_ZONES.ceilingHeightMm, panelEntryHeightMm: input.panelEntryHeightMm ?? INSTALLATION_ZONES.panelEntryHeightMm };
  const trace = zones.ceilingHeightMm - zones.ceilingTraceBelowCeilingMm;
  const panelMm = { x: input.panelPx[0] * x, y: input.panelPx[1] * y };
  /** Svislý úsek u bodu: ze stropní trasy dolů ke spínači / zásuvce, nebo nahoru ke svítidlu na stropě. */
  const drop = (kind: NodeKind) =>
    kind === "light" ? zones.ceilingTraceBelowCeilingMm : kind === "switch" ? trace - zones.switchHeightMm : kind === "appliance" ? trace - zones.socketHeightMm : trace - zones.socketHeightMm;
  return {
    pxToMm: { x, y },
    panelMm,
    calculateCableLength: (node) => {
      if (input.elevation) {
        const profile = elevationProfile(input.elevation);
        const point = { x: node.px[0] * x, y: node.px[1] * y };
        return homeRunLength(panelMm, point, mountHeight(node, profile), input.routing ?? "OPTIMIZED", profile);
      }
      const horizontal = Math.abs(node.px[0] * x - panelMm.x) + Math.abs(node.px[1] * y - panelMm.y);
      return Math.round(horizontal + Math.max(0, trace - zones.panelEntryHeightMm) + drop(node.kind));
    },
  };
}

// ---------------------------------------------------------------------------
//  1b. 3D výškový model a režimy vedení kabelů (fáze 49)
// ---------------------------------------------------------------------------

/** Výškové parametry podlaží v mm od čisté podlahy. */
export interface ElevationProfile {
  /** Světlá výška stropu / podhledu – vedení vrchem. */
  ceilingHeightMm: number;
  /** Hloubka uložení kabelu v podlaze / mazanině – vedení spodem. */
  floorDepthMm: number;
  /** Výška středu / vstupu rozváděče. */
  switchboardHeightMm: number;
  defaultSocketHeightMm: number;
  /** Zásuvky nad kuchyňskou linkou a v koupelně. */
  worktopSocketHeightMm: number;
  defaultSwitchHeightMm: number;
  /** Technologická rezerva na ohyby a nepřesnost trasy [%]. */
  slackPercent: number;
  /** Pevný přídavek na zapojení v rozváděči a v každé krabici KU68 [mm]. */
  panelAllowanceMm: number;
  boxAllowanceMm: number;
}

export const DEFAULT_ELEVATION: ElevationProfile = {
  ceilingHeightMm: 2600,
  floorDepthMm: 50,
  switchboardHeightMm: 1500,
  defaultSocketHeightMm: 300,
  worktopSocketHeightMm: 1150,
  defaultSwitchHeightMm: 1050,
  slackPercent: 10,
  panelAllowanceMm: 600,
  boxAllowanceMm: 150,
};

export const elevationProfile = (partial: Partial<ElevationProfile> = {}): ElevationProfile => ({ ...DEFAULT_ELEVATION, ...Object.fromEntries(Object.entries(partial).filter(([, value]) => typeof value === "number" && Number.isFinite(value))) });

/** "BOTTOM" = spodem v podlaze, "TOP" = vrchem v podhledu, "OPTIMIZED" = pro každý okruh kratší z obou. */
export type CableRoutingMode = "BOTTOM" | "TOP" | "OPTIMIZED";
export const ROUTING_MODES: readonly CableRoutingMode[] = ["BOTTOM", "TOP", "OPTIMIZED"];

/** Fáze 77: výška vývodu motoru žaluzie / rolety – horní kastlík okna [mm]. */
export const BLIND_MOTOR_HEIGHT_MM = 2450;

/** Pevné výšky spotřebičů (vývod / přípojka) – ostatní spotřebiče jako běžná zásuvka. */
const APPLIANCE_HEIGHT_MM: Partial<Record<ApplianceTag, number>> = { boiler: 1800, ev_charger: 1200, microwave_builtin: 1150 };

/** Montážní výška prvku: vlastní `mountHeightMm`, jinak výchozí podle druhu a varianty. */
export function mountHeight(node: Pick<FloorNode, "kind"> & Partial<Pick<FloorNode, "mountHeightMm" | "variant" | "tag">>, profile: ElevationProfile = DEFAULT_ELEVATION): number {
  if (typeof node.mountHeightMm === "number" && Number.isFinite(node.mountHeightMm)) return Math.min(Math.max(0, node.mountHeightMm), profile.ceilingHeightMm);
  switch (node.kind) {
    case "light":
      return node.variant === "wall" ? Math.min(2000, profile.ceilingHeightMm) : profile.ceilingHeightMm;
    case "switch":
      return profile.defaultSwitchHeightMm;
    case "appliance":
      return (node.tag && APPLIANCE_HEIGHT_MM[node.tag]) ?? profile.defaultSocketHeightMm;
    case "blind_motor":
      // Fáze 77: horní kastlík okna
      return Math.min(BLIND_MOTOR_HEIGHT_MM, profile.ceilingHeightMm);
    default:
      return node.variant === "worktop" || node.variant === "ip44" ? profile.worktopSocketHeightMm : profile.defaultSocketHeightMm;
  }
}

export const manhattan = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** Svislé úseky trasy rozváděč → prvek: spodem (svod do podlahy + výstup) nebo vrchem (výstup do stropu + spuštění). */
export function panelVertical(heightMm: number, mode: Exclude<CableRoutingMode, "OPTIMIZED">, profile: ElevationProfile): number {
  return mode === "BOTTOM"
    ? profile.switchboardHeightMm + profile.floorDepthMm + heightMm + profile.floorDepthMm
    : Math.max(0, profile.ceilingHeightMm - profile.switchboardHeightMm) + Math.max(0, profile.ceilingHeightMm - heightMm);
}

/** Délka samostatného přívodu rozváděč → prvek (bez rezerv); OPTIMIZED = kratší z obou režimů. */
export function homeRunLength(panel: { x: number; y: number }, point: { x: number; y: number }, heightMm: number, mode: CableRoutingMode, profile: ElevationProfile): number {
  const horizontal = manhattan(panel, point);
  const bottom = horizontal + panelVertical(heightMm, "BOTTOM", profile);
  const top = horizontal + panelVertical(heightMm, "TOP", profile);
  return Math.round(mode === "BOTTOM" ? bottom : mode === "TOP" ? top : Math.min(bottom, top));
}

/** Měrný odpor mědi při provozní teplotě 70 °C [Ω·mm²/m]. */
export const COPPER_RESISTIVITY = 0.0225;
/** Měrný odpor mědi při 20 °C [Ω·mm²/m] – impedance smyčky ve studeném stavu (měření při revizi). */
export const COPPER_RESISTIVITY_20 = 0.0178;
/** Max. úbytek napětí: světelné obvody 3 %, ostatní (zásuvky, spotřebiče) 5 %. */
export const VOLTAGE_DROP_LIMIT = { lighting: 3, other: 5 } as const;

/** Úbytek napětí v % (1f: 2·L·I·ρ/S/230, 3f: √3·L·I·ρ/S/400). */
export function voltageDropPercent(input: { lengthMm: number; currentA: number; crossSectionMm2: number; phases: 1 | 3 }): number {
  const meters = input.lengthMm / 1000;
  const volts = input.phases === 3 ? (Math.sqrt(3) * meters * input.currentA * COPPER_RESISTIVITY) / input.crossSectionMm2 : (2 * meters * input.currentA * COPPER_RESISTIVITY) / input.crossSectionMm2;
  return Math.round((volts / (input.phases === 3 ? 400 : 230)) * 10000) / 100;
}

// ---------------------------------------------------------------------------
//  1c. Dimenzování vodičů podle způsobu uložení a impedance smyčky (fáze 52)
// ---------------------------------------------------------------------------

/**
 * Referenční způsob uložení (ČSN 33 2000-5-52 ed. 2, ČSN 33 2130 ed. 4 tab. 9): C = přímo ve zdi pod
 * omítkou, B2 = v trubce / liště, A2 / A1 = v tepelně izolační stěně (dřevostavba, zateplený podhled).
 */
export type InstallMethod = "C" | "B2" | "A2" | "A1";
export const INSTALL_METHODS: readonly { id: InstallMethod; label: string }[] = [
  { id: "C", label: "C – ve zdi pod omítkou (zdivo)" },
  { id: "B2", label: "B2 – v trubce / liště ve zdi" },
  { id: "A2", label: "A2 – kabel v tepelné izolaci (dřevostavba)" },
  { id: "A1", label: "A1 – vodiče v trubce v tepelné izolaci" },
];
export const isInstallMethod = (value: unknown): value is InstallMethod => INSTALL_METHODS.some((method) => method.id === value);

/** Proudová zatížitelnost Cu / PVC při 30 °C [A]: 2 zatížené žíly (1f) a 3 zatížené žíly (3f). */
const AMPACITY: Record<InstallMethod, Record<1 | 3, Record<number, number>>> = {
  C: { 1: { 1.5: 19.5, 2.5: 27, 4: 36, 6: 46, 10: 63, 16: 85 }, 3: { 1.5: 17.5, 2.5: 24, 4: 32, 6: 41, 10: 57, 16: 76 } },
  B2: { 1: { 1.5: 16.5, 2.5: 23, 4: 30, 6: 38, 10: 52, 16: 69 }, 3: { 1.5: 15, 2.5: 20, 4: 27, 6: 34, 10: 46, 16: 62 } },
  A2: { 1: { 1.5: 14, 2.5: 18.5, 4: 25, 6: 32, 10: 43, 16: 57 }, 3: { 1.5: 13, 2.5: 17.5, 4: 23, 6: 29, 10: 39, 16: 52 } },
  A1: { 1: { 1.5: 14.5, 2.5: 18.5, 4: 26, 6: 34, 10: 46, 16: 61 }, 3: { 1.5: 13.5, 2.5: 18, 4: 24, 6: 31, 10: 42, 16: 56 } },
};
/** ČSN 33 2130 ed. 4 tab. 9: 1,5 mm² v trubce nebo v tepelné izolaci jistit nejvýš 10 A. */
const TAB9_MAX_BREAKER: Partial<Record<InstallMethod, Partial<Record<number, number>>>> = { B2: { 1.5: 10 }, A2: { 1.5: 10 }, A1: { 1.5: 10 } };

/** Součinitel seskupení kabelů ve svazku / v izolaci (ČSN 33 2000-5-52 tab. B.52.17, řádek 1). */
export function groupingFactor(cables: number): number {
  const count = Math.max(1, Math.round(cables));
  return ([1, 1, 0.8, 0.7, 0.65, 0.6, 0.57, 0.54, 0.52] as const)[count] ?? 0.5;
}

/** Skutečná zatížitelnost Iz [A] průřezu v daném uložení po korekci seskupením. */
export function cableAmpacity(input: { crossSectionMm2: number; method: InstallMethod; phases: 1 | 3; groupedCables?: number }): number {
  const base = AMPACITY[input.method][input.phases][input.crossSectionMm2] ?? 0;
  return Math.round(base * groupingFactor(input.groupedCables ?? 1) * 10) / 10;
}

const BREAKER_SERIES = [6, 10, 13, 16, 20, 25, 32, 40, 50, 63] as const;

/** Nejvyšší jmenovitý proud jističe pro průřez a uložení (In ≤ Iz a omezení tab. 9). */
export function maxBreakerFor(input: { crossSectionMm2: number; method: InstallMethod; phases: 1 | 3; groupedCables?: number }): number {
  const iz = cableAmpacity(input);
  const cap = TAB9_MAX_BREAKER[input.method]?.[input.crossSectionMm2] ?? Infinity;
  return [...BREAKER_SERIES].reverse().find((rating) => rating <= iz && rating <= cap) ?? 0;
}

/**
 * Koordinace vodiče a jističe (ČSN 33 2000-4-43 čl. 433.1): IB ≤ In ≤ Iz a I2 ≤ 1,45 · Iz, kde pro
 * jistič dle ČSN EN 60898 je I2 = 1,45 · In. Navíc omezení tab. 9 ČSN 33 2130 ed. 4.
 */
export function checkCoordination(input: { designCurrentA: number; ratedA: number; crossSectionMm2: number; method: InstallMethod; phases: 1 | 3; groupedCables?: number }) {
  const iz = cableAmpacity(input);
  const i2 = 1.45 * input.ratedA;
  const maxBreakerA = maxBreakerFor(input);
  const ok = input.designCurrentA <= input.ratedA && input.ratedA <= iz && i2 <= 1.45 * iz && input.ratedA <= maxBreakerA;
  return { izA: iz, i2A: Math.round(i2 * 10) / 10, maxBreakerA, ok };
}

/** Výchozí impedance smyčky přívodu (distribuční síť + přípojka) na svorkách rozváděče [Ω]. */
export const DEFAULT_SUPPLY_LOOP_OHM = 0.3;
export const NOMINAL_U0 = 230;

/**
 * Impedance poruchové smyčky (ČSN 33 2000-4-41, ČSN 33 2000-6 ed. 2): Zs = Z přívodu + R smyčky vedení
 * (fázový a ochranný vodič stejného průřezu, 20 °C). Teplý stav = 1,5 × Zs, pokles napětí na 0,8 · U0:
 * Ik,min = 0,8 · U0 / (1,5 · Zs) ≥ Ia a měřená hodnota Zsm ≤ 2 · U0 / (3 · Ia); Ia = 5 · In (B) / 10 · In (C).
 */
export function loopImpedanceCheck(input: { lengthMm: number; crossSectionMm2: number; ratedA: number; curve: "B" | "C"; supplyLoopOhm?: number }) {
  const loopOhm = (2 * (input.lengthMm / 1000) * COPPER_RESISTIVITY_20) / input.crossSectionMm2;
  const zs = (input.supplyLoopOhm ?? DEFAULT_SUPPLY_LOOP_OHM) + loopOhm;
  const ia = (input.curve === "C" ? 10 : 5) * input.ratedA;
  const ikMin = (0.8 * NOMINAL_U0) / (1.5 * zs);
  const zsMax = (2 * NOMINAL_U0) / (3 * ia);
  const round = (value: number, digits = 3) => Math.round(value * 10 ** digits) / 10 ** digits;
  return { zsOhm: round(zs), zsMaxOhm: round(zsMax), iaA: ia, ikMinA: Math.round(ikMin), ok: ikMin >= ia && zs <= zsMax };
}

// ===========================================================================
//  2. Ovládání světel – matice řazení vypínačů
// ===========================================================================

/**
 * Úroveň architektury instalace (fáze 52): klasika 230/400 V, plně sběrnicová Smart Home (hvězda
 * silnoproudu do rozváděče + sběrnice 24 V DC) a hybridní retrofit (moduly pod vypínač – v každé
 * krabici vypínače povinný N). `smart_relay` = chytrá relé v rozváděči (fáze 44, jen API / testy).
 */
export type InstallMode = "classic" | "smart_relay" | "bus_loxone" | "smart_retrofit";
export type InstallLevel = Exclude<InstallMode, "smart_relay">;
export const INSTALL_LEVELS: readonly { id: InstallLevel; label: string; description: string }[] = [
  { id: "classic", label: "1. Klasická instalace 230/400 V", description: "Okruhová / stromová topologie, lokální vypínače, CYKY-J / CYKY-O, krabice KU 68." },
  { id: "bus_loxone", label: "2. Plně sběrnicová Smart Home – Loxone / KNX / TapHome / ABB-free@home", description: "Každý spínaný vývod samostatným kabelem do rozváděče (hvězda), tlačítka a čidla na sběrnici 24 V DC." },
  { id: "smart_retrofit", label: "3. Hybridní / Retrofit – Zigbee / Matter / Home Assistant", description: "Klasická kabeláž, v každé krabici vypínače nulový vodič N (CYKY-J), hluboké krabice min. 65 mm a moduly pod vypínač." },
];
export const isInstallLevel = (value: unknown): value is InstallLevel => INSTALL_LEVELS.some((level) => level.id === value);

/** Prvky kusovníku podle úrovně instalace (fáze 52). */
export const RETROFIT_MODULE = "Lokální chytrý modul pod vypínač (Zigbee / Matter, s nulovým vodičem N)";
export const BOX_STANDARD = "Přístrojová krabice KU 68 (standardní)";
export const BOX_DEEP = "Hluboká přístrojová krabice KPR 68 / KU 68 hluboká (min. 65 mm)";
export const BUS_TERMINALS = "Vícepatrová instalační svorkovnice L / N / PE (hvězda do rozváděče)";
export const BUS_CABLE = "Sběrnicový kabel 24 V DC (CAT7 / KNX TP J-Y(St)Y 2×2×0,8)";
export const RS485_TERMINATOR = "Zakončovací rezistor 120 Ω (sběrnice RS-485)";
export const RS485_METER = "Elektroměr 3f Modbus RS-485 (např. Eastron SDM630)";

export interface WiringItem {
  /** Kde přístroj je: na stěně (krabice) nebo v rozváděči (DIN lišta). */
  place: "wall" | "panel";
  name: string;
  /** Řazení dle ČSN (1, 5, 6, 6+6 / 5B, 7, 1/0) – u tlačítek a chytrých prvků null. */
  razeni: string | null;
  count: number;
}

export interface SwitchWiring {
  items: WiringItem[];
  /** Požadavek na digitální vstupy / výstupy v rozváděči (chytré relé / Loxone). */
  io: { di: number; do: number };
  /** Impulzní (paměťová) relé na DIN lištu. */
  impulseRelays: number;
  /** Prvky Loxone Tree (Touch s termostatem) na sběrnici. */
  treeDevices: number;
  note: string;
}

/**
 * Matice řazení: G = nezávisle spínané větve v místě, S = ovládací místa. Klasika podle tabulky
 * zadání; od 4 míst tlačítka + impulzní relé. Chytré režimy = tlačítka / Loxone Touch Tree a počet
 * vstupů a výstupů v rozváděči (světla G výstupů, žaluzie 2 výstupy nahoru / dolů).
 */
export function resolveSwitchWiring(input: { groups: 1 | 2; switchCount: number; mode: InstallMode; blinds?: number }): SwitchWiring {
  const G = input.groups;
  const S = Math.max(1, Math.round(input.switchCount));
  const blinds = Math.max(0, Math.round(input.blinds ?? 0));
  if (input.mode === "smart_relay") {
    return {
      items: [
        { place: "wall", name: G === 2 ? "Dvojité tlačítko (řazení 1/0+1/0)" : "Tlačítko (řazení 1/0)", razeni: G === 2 ? "1/0+1/0" : "1/0", count: S },
        ...(blinds ? [{ place: "wall" as const, name: "Žaluziové tlačítko (nahoru / dolů)", razeni: "1/0+1/0", count: blinds }] : []),
      ],
      // Tlačítka stejné větve paralelně do jednoho vstupu
      io: { di: G + blinds * 2, do: G + blinds * 2 },
      impulseRelays: 0,
      treeDevices: 0,
      note: "Chytré relé (Shelly Pro / iNELS): tlačítka na vstupy DI, světla a žaluzie na výstupy DO v rozváděči.",
    };
  }
  if (input.mode === "bus_loxone") {
    return {
      items: [{ place: "wall", name: "Loxone Touch Tree (s integrovaným termostatem)", razeni: null, count: S }],
      io: { di: 0, do: G + blinds * 2 },
      impulseRelays: 0,
      treeDevices: S,
      note: "Loxone Tree: ovládání po sběrnici Tree, světla a žaluzie na reléové výstupy Miniserveru / Relay Extension.",
    };
  }
  const wall = (name: string, razeni: string, count: number): WiringItem => ({ place: "wall", name, razeni, count });
  if (input.mode === "smart_retrofit") {
    // Retrofit: klasické řazení, od 4 míst tlačítka na vstup modulu (bez impulzního relé); modul pod vypínač na každou větev
    const items =
      S >= 4 || (S === 3 && G === 2)
        ? [wall(G === 2 ? "Dvojité tlačítko" : "Tlačítko", G === 2 ? "1/0+1/0" : "1/0", S)]
        : S === 1
          ? [G === 1 ? wall("Jednopólový spínač", "1", 1) : wall("Sériový (lustrový) spínač", "5", 1)]
          : S === 2
            ? [G === 1 ? wall("Střídavý přepínač", "6", 2) : wall("Dvojitý střídavý přepínač", "6+6 / 5B", 2)]
            : [wall("Střídavý přepínač", "6", 2), wall("Křížový přepínač", "7", 1)];
    items.push({ place: "wall", name: RETROFIT_MODULE, razeni: null, count: G + blinds });
    if (blinds) items.push(wall("Žaluziové tlačítko (nahoru / dolů)", "1/0+1/0", blinds));
    return { items, io: { di: 0, do: 0 }, impulseRelays: 0, treeDevices: 0, note: "Retrofit: v každé krabici vypínače nulový vodič N (CYKY-J, ne CYKY-O), hluboká krabice min. 65 mm pro modul pod vypínač." };
  }
  // Klasická instalace
  let items: WiringItem[];
  let impulseRelays = 0;
  let note: string;
  if (S === 1) {
    items = [G === 1 ? wall("Jednopólový spínač", "1", 1) : wall("Sériový (lustrový) spínač", "5", 1)];
    note = G === 1 ? "Řazení 1." : "Řazení 5 – dvě větve z jednoho místa.";
  } else if (S === 2) {
    items = [G === 1 ? wall("Střídavý přepínač", "6", 2) : wall("Dvojitý střídavý přepínač", "6+6 / 5B", 2)];
    note = G === 1 ? "2× řazení 6 (schodišťové zapojení)." : "2× řazení 6+6 (5B).";
  } else if (S === 3 && G === 1) {
    items = [wall("Střídavý přepínač", "6", 2), wall("Křížový přepínač", "7", 1)];
    note = "2× řazení 6 + 1× řazení 7 (křížový mezi střídavými).";
  } else {
    items = [wall(G === 2 ? "Dvojité tlačítko" : "Tlačítko", G === 2 ? "1/0+1/0" : "1/0", S)];
    impulseRelays = G;
    note = `Doporučení: ${S} ovládacích míst → tlačítka řazení 1/0 paralelně + ${G}× impulzní paměťové relé na DIN lištu (např. ELKO MR-41 / CRM-91H).`;
  }
  if (blinds) items.push(wall("Žaluziový spínač", "1/0+1/0", blinds));
  return { items, io: { di: 0, do: 0 }, impulseRelays, treeDevices: 0, note };
}

// ===========================================================================
//  3. Normativní shlukovač okruhů (ČSN 33 2130 ed. 4)
// ===========================================================================

export type ApplianceTag = "oven" | "dishwasher" | "washer" | "dryer" | "boiler" | "microwave_builtin" | "cooktop_3p" | "fridge" | "ev_charger" | "heat_pump" | "pv_inverter" | "storage_heater";
/** Spotřebiče s výkonovou elektronikou (DC složka) – proudový chránič typ B (příp. F), nikdy A / AC. */
export const RCD_TYPE_B_TAGS: readonly ApplianceTag[] = ["ev_charger", "heat_pump", "pv_inverter"];

/** Výchozí příkon [W] a součinitel soudobosti podle štítku. */
export const APPLIANCES: Record<ApplianceTag, { label: string; powerW: number; simultaneity: number }> = {
  oven: { label: "Trouba", powerW: 3500, simultaneity: 0.7 },
  dishwasher: { label: "Myčka", powerW: 2200, simultaneity: 0.6 },
  washer: { label: "Pračka", powerW: 2200, simultaneity: 0.6 },
  dryer: { label: "Sušička", powerW: 2500, simultaneity: 0.6 },
  boiler: { label: "Bojler", powerW: 2000, simultaneity: 1 },
  microwave_builtin: { label: "Vestavná mikrovlnná trouba", powerW: 2500, simultaneity: 0.5 },
  cooktop_3p: { label: "Varná deska", powerW: 7200, simultaneity: 0.6 },
  fridge: { label: "Lednice", powerW: 300, simultaneity: 1 },
  ev_charger: { label: "Nabíječka elektromobilu", powerW: 11000, simultaneity: 1 },
  heat_pump: { label: "Tepelné čerpadlo", powerW: 6000, simultaneity: 1 },
  pv_inverter: { label: "Střídač FVE", powerW: 10000, simultaneity: 1 },
  // Fáze 112: akumulační kamna / akumulační vytápění 3f 400 V spínané signálem HDO (sazba D45d / D56d)
  storage_heater: { label: "Akumulační vytápění", powerW: 6000, simultaneity: 1 },
};

/** Spotřebiče s vlastním 1f okruhem B16A (od 2 000 W, mikrovlnka jen vestavná ≥ 2 000 W). */
const DEDICATED_1P = new Set<ApplianceTag>(["oven", "dishwasher", "washer", "dryer", "boiler", "microwave_builtin"]);
const DEDICATED_MIN_W = 2000;
/** Max. zásuvek na zásuvkový okruh B16A (ČSN 33 2130 ed. 4: skutečné zásuvky, dvojzásuvka = 2). */
export const MAX_OUTLETS_PER_CIRCUIT = 10;
/** Max. světelných bodů na světelný okruh. */
export const MAX_LIGHTS_PER_CIRCUIT = 10;
/** Fáze 77: nejvýš motorů žaluzií na jeden žaluziový okruh B10 a výpočtový příkon motoru [W]. */
export const MAX_BLINDS_PER_CIRCUIT = 8;
export const BLIND_MOTOR_W = 150;
/** Fáze 77: rezerva napájecího zdroje 24 V DC pro LED pásky (příkon pásků + 20 %). */
export const LED_PSU_RESERVE = 1.2;
const LIGHT_POWER_W = 60;
const OUTLET_POWER_W = 200;
const SOCKET_SIMULTANEITY = 0.3;
const LIGHT_SIMULTANEITY = 0.8;

/** Fáze 74: `feeder` = přívod hlavní → podružný rozváděč (bez chrániče 30 mA – chrániče má podružný rozváděč). */
/** Fáze 77: `blinds` = žaluziový okruh B10 (motory 230 V u oken, u sběrnice napájení žaluziových aktorů v rozváděči). */
export type CircuitKind = "lighting" | "sockets" | "dedicated" | "cooktop" | "fridge" | "three_phase_rcd_b" | "feeder" | "blinds";

/** Fáze 74: hlavní rozváděč – výchozí rozváděč okruhu bez `board`. */
export const MAIN_BOARD = "RH";

export interface Protection {
  device: "MCB" | "RCBO";
  poles: "1P" | "1P+N" | "3P";
  curve: "B" | "C";
  ratedA: number;
  /** RCBO: typ a citlivost vlastní proudové ochrany. */
  rcd?: { type: "A" | "B"; sensitivityMa: number };
}

export interface Circuit {
  id: string;
  label: string;
  kind: CircuitKind;
  phases: 1 | 3;
  protection: Protection;
  cable: string;
  crossSectionMm2: number;
  rooms: string[];
  nodeIds: string[];
  /** Zásuvky okruhu (dvojzásuvka = 2 dle ČSN 33 2130 ed. 4, nebo 1 při vypnutém přepínači). */
  outlets: number;
  /** Instalovaný a soudobý příkon [W]. */
  installedW: number;
  designW: number;
  /** Nejdelší kabel okruhu [mm] a úbytek napětí při In [%]. */
  lengthMm: number;
  voltageDropPct: number;
  /**
   * Pod jakou proudovou ochranu okruh patří: společný chránič 30 mA typ A (zásuvky, spotřebiče),
   * chránič typ A vyhrazený jen pro světla (`A30L`), vlastní typ B (EV / TČ / FVE), nebo vlastní RCBO.
   */
  rcd: "A30" | "A30L" | "B30" | "F30" | "own" | "none";
  /** Spotřebič vyhrazeného okruhu (fáze 52 – synergický energetický management). */
  tag?: ApplianceTag;
  /** Fáze 112: okruh spínaný signálem HDO (stykač + ovládací jistič v rozváděči). */
  hdo?: boolean;
  /** Fáze 74: rozváděč okruhu (bez údaje hlavní `MAIN_BOARD`); přívod podružného rozváděče nese jeho kód v `feeds`. */
  board?: string;
  feeds?: string;
  /** Fáze 74: úbytek napětí na přívodu podružného rozváděče [%] – přičítá se k úbytku okruhu ve výkazu kabeláže. */
  upstreamDropPct?: number;
  /** Fáze 52: zatížitelnost Iz [A] v zadaném uložení a impedance smyčky. */
  izA: number;
  loop: { zsOhm: number; zsMaxOhm: number; iaA: number; ikMinA: number; ok: boolean };
}

/** Volby návrhu dle metodiky ČSN 33 2130 ed. 4 (fáze 52). */
export interface DesignOptions {
  /** Způsob uložení kabelů v budově (výchozí C – ve zdi pod omítkou). */
  installMethod?: InstallMethod;
  /** Počet souběžně uložených kabelů (svazek v izolaci / liště) – korekce seskupením. */
  groupedCables?: number;
  /** Počítat dvojzásuvku jako 2 zásuvky (výchozí ano). */
  countDoubleAsTwo?: boolean;
  /** Doplňková ochrana světel: RCBO 1P+N typ A na každý okruh (výchozí), nebo chránič typ A jen pro světla. */
  lightingProtection?: "rcbo" | "rcd_group";
  /** Impedance smyčky přívodu na svorkách rozváděče [Ω]. */
  supplyLoopOhm?: number;
  /** Prostředí instalace (`environments.ts`) – stavební detaily do kusovníku. */
  environment?: string | null;
  /** Fáze 65: rozdělení běžných zásuvek do okruhů (`socket-zones.ts`); výchozí dosavadní „distance“, půdorys posílá svou volbu. */
  socketGrouping?: SocketGrouping;
  /** Fáze 74: nejmenší počet světelných okruhů (byt = 2; podružný rozváděč 1 – dva okruhy už má hlavní rozváděč). */
  minLightingCircuits?: number;
  /** Fáze 74: úbytek napětí na přívodu podružného rozváděče [%] – koncovým okruhům zbude limit mínus tato hodnota. */
  upstreamDropPct?: number;
  /** Fáze 82: jištění světelného okruhu se zásuvkami – 10 A (výchozí) nebo 13 A. */
  lightingSocketA?: LightingSocketA;
  /**
   * Fáze 93: typ objektu – zdravotnický prostor Skupiny 1 rozdělí zásuvky lékařských místností do okruhů A / B (každý
   * s vlastním RCBO 1P+N B16 30 mA typ A) a světla místnosti na 2 okruhy; obchodní centrum (BD4) mění jen kabely.
   */
  occupancy?: OccupancyId;
}

/** Fáze 82: jistič světelného okruhu, na kterém jsou i zásuvky (10 A, nebo 13 A – nikdy 16 A). */
export type LightingSocketA = 10 | 13;
export const LIGHTING_SOCKET_RATINGS: readonly LightingSocketA[] = [10, 13];
export const isLightingSocketA = (value: unknown): value is LightingSocketA => value === 10 || value === 13;

export interface BomItem {
  item: string;
  count: number;
}

export interface Room {
  id: string;
  name: string;
  /** Fáze 59: podlaží místnosti (vícepodlažní dům). */
  floor?: string;
  /** Ovládání světel v místnosti (větve, ovládací místa, žaluzie). */
  lighting?: { groups: 1 | 2; switchCount: number; blinds?: number };
}

export interface Floorplan {
  rooms: Room[];
  nodes: FloorNode[];
  mode: InstallMode;
}

export interface CircuitPlan {
  circuits: Circuit[];
  /** Přesné typy koncových prvků do kusovníku (jedno- a dvojzásuvky zvlášť, spínače dle řazení). */
  bom: BomItem[];
  /** Ovládání světel po místnostech a souhrnný požadavek na DI / DO, impulzní relé a prvky Tree. */
  switching: { room: string; wiring: SwitchWiring }[];
  io: { di: number; do: number; impulseRelays: number; treeDevices: number };
  warnings: string[];
}

const STANDARD_RATINGS = [10, 13, 16, 20, 25, 32, 40, 50, 63] as const;
const cableFor = (phases: 1 | 3, mm2: number) => `CYKY-J ${phases === 3 ? 5 : 3}x${String(mm2).replace(".", ",")}`;
const nextSize = (mm2: number) => ({ 1.5: 2.5, 2.5: 4, 4: 6, 6: 10 })[mm2] ?? mm2;

function addBom(bom: Map<string, number>, item: string, count = 1) {
  if (count > 0) bom.set(item, (bom.get(item) ?? 0) + count);
}

/** Jmenovitý proud 3f vývodu podle příkonu: nejbližší vyšší řada ≥ Ib (min. 16 A). */
const threePhaseRating = (powerW: number) => STANDARD_RATINGS.find((rating) => rating >= Math.max(16, powerW / (Math.sqrt(3) * 400))) ?? 63;
const threePhaseSection = (ratedA: number) => (ratedA <= 16 ? 2.5 : ratedA <= 25 ? 4 : ratedA <= 32 ? 6 : 10);

/**
 * Okruhy z půdorysu: vyhrazené spotřebiče na samostatné jističe, varná deska 3P, lednice na RCBO,
 * EV / TČ na 3f jistič + chránič typ B, běžné zásuvky po max. 10 vývodech podle místností (od
 * rozváděče nejbližší první) a světla po místnostech do min. 2 nezávislých okruhů. Délka kabelu
 * a úbytek napětí z kalibrace; při překročení se průřez zvětší.
 */
export function generateCircuitsFromFloorplan(plan: Floorplan, calibration: Calibration, options: DesignOptions = {}): CircuitPlan {
  const warnings: string[] = [];
  const method: InstallMethod = options.installMethod ?? "C";
  const grouped = Math.max(1, Math.round(options.groupedCables ?? 1));
  const countDoubleAsTwo = options.countDoubleAsTwo ?? true;
  const lightingProtection = options.lightingProtection ?? "rcbo";
  const bom = new Map<string, number>();
  const circuits: Circuit[] = [];
  const roomName = new Map(plan.rooms.map((room) => [room.id, room.name]));
  const roomOrder = new Map(plan.rooms.map((room, index) => [room.id, index]));
  const length = (node: FloorNode) => node.lengthMm ?? calibration.calculateCableLength(node);
  const counters = new Map<CircuitKind, number>();
  const nextId = (kind: CircuitKind) => {
    const value = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, value);
    return `${kind}-${value}`;
  };

  /**
   * Průřez okruhu (fáze 52): nejmenší od výchozího, který splní úbytek napětí (příloha A / E ČSN 33 2130
   * ed. 4: světla ≤ 3 %, ostatní ≤ 5 %), koordinaci IB ≤ In ≤ Iz a I2 ≤ 1,45 · Iz v zadaném uložení
   * se seskupením (tab. 9) a impedanci smyčky v teplém stavu. Nejvýš 3 stupně, každý důvod = varování.
   */
  function sized(protection: Protection, phases: 1 | 3, designA: number, startMm2: number, lengthMm: number, limit: number, label: string) {
    const ratedA = protection.ratedA;
    const evaluate = (mm2: number) => ({
      drop: voltageDropPercent({ lengthMm, currentA: ratedA, crossSectionMm2: mm2, phases }),
      coordination: checkCoordination({ designCurrentA: designA, ratedA, crossSectionMm2: mm2, method, phases, groupedCables: grouped }),
      loop: loopImpedanceCheck({ lengthMm, crossSectionMm2: mm2, ratedA, curve: protection.curve, supplyLoopOhm: options.supplyLoopOhm }),
    });
    let mm2 = startMm2;
    let result = evaluate(mm2);
    const first = result;
    for (let step = 0; step < 3 && (result.drop > limit || !result.coordination.ok || !result.loop.ok) && nextSize(mm2) !== mm2; step++) {
      mm2 = nextSize(mm2);
      result = evaluate(mm2);
    }
    const size = (value: number) => String(value).replace(".", ",");
    if (mm2 !== startMm2) {
      const reasons = [
        first.drop > limit ? `úbytek napětí nad ${limit} %` : null,
        !first.coordination.ok ? `Iz ${size(first.coordination.izA)} A v uložení ${method}${grouped > 1 ? ` (souběh ${grouped} kabelů)` : ""} < In ${ratedA} A – alternativa: jistič ${first.coordination.maxBreakerA || "–"} A` : null,
        !first.loop.ok ? `impedance smyčky ${size(first.loop.zsOhm)} Ω > ${size(Math.min(first.loop.zsMaxOhm, (0.8 * NOMINAL_U0) / (1.5 * first.loop.iaA)))} Ω (Ia ${first.loop.iaA} A)` : null,
      ].filter(Boolean);
      warnings.push(`${label}: ${reasons.join("; ")} – průřez zvětšen na ${size(mm2)} mm².`);
    }
    if (result.drop > limit) warnings.push(`${label}: úbytek napětí ${size(result.drop)} % překračuje ${limit} % i po zvětšení průřezu – zkraťte trasu.`);
    if (!result.coordination.ok) warnings.push(`${label}: nesplněna podmínka IB ≤ In ≤ Iz (Iz ${size(result.coordination.izA)} A) – snižte jištění nebo změňte uložení.`);
    if (!result.loop.ok) warnings.push(`${label}: impedance smyčky ${size(result.loop.zsOhm)} Ω nevyhoví samočinnému odpojení (Ik,min ${result.loop.ikMinA} A < Ia ${result.loop.iaA} A) – zkraťte trasu.`);
    return { mm2, drop: result.drop, izA: result.coordination.izA, loop: result.loop };
  }

  // Fáze 74: okruh podružného rozváděče má k dispozici limit úbytku mínus úbytek na jeho přívodu
  const upstream = Math.max(0, options.upstreamDropPct ?? 0);
  /** `cores` = vlastní počet žil kabelu (fáze 77: DALI 5 žil L, N, PE, DA+, DA−). */
  function push(base: Omit<Circuit, "id" | "cable" | "crossSectionMm2" | "voltageDropPct" | "lengthMm" | "izA" | "loop">, nodes: readonly FloorNode[], startMm2: number, cores?: number) {
    const lengthMm = Math.max(0, ...nodes.map(length));
    const limit = Math.max(0.5, (base.kind === "lighting" ? VOLTAGE_DROP_LIMIT.lighting : VOLTAGE_DROP_LIMIT.other) - upstream);
    const designA = base.phases === 3 ? base.designW / (Math.sqrt(3) * 400) : base.designW / NOMINAL_U0;
    const { mm2, drop, izA, loop } = sized(base.protection, base.phases, Math.min(designA, base.protection.ratedA), startMm2, lengthMm, limit, base.label);
    const cable = cores ? `CYKY-J ${cores}x${String(mm2).replace(".", ",")}` : cableFor(base.phases, mm2);
    // Fáze 112: bojler, TČ, akumulace a wallbox s řízením HDO (volba u prvku, jinak výchozí podle spotřebiče)
    const hdo = base.tag && isHdoTag(base.tag) && nodes.some((node) => hdoEnabled(base.tag, node.hdo)) ? { hdo: true } : {};
    circuits.push({ ...base, ...hdo, id: nextId(base.kind), cable, crossSectionMm2: mm2, lengthMm, voltageDropPct: drop, izA, loop });
  }

  const sockets: FloorNode[] = [];
  const lights: FloorNode[] = [];
  // Fáze 82: zásuvky, které mají být na světelném okruhu své místnosti
  const lightingSockets: FloorNode[] = [];
  // Fáze 77: LED 24 V DC (PWM) ze zdroje v rozváděči a vývody motorů žaluzií
  const pwmLights: FloorNode[] = [];
  const blindMotors: FloorNode[] = [];
  for (const node of plan.nodes) {
    const tag = node.tag;
    const appliance = tag ? APPLIANCES[tag] : null;
    const powerW = node.powerW ?? appliance?.powerW ?? 0;
    const room = roomName.get(node.room) ?? node.room;
    if (node.kind === "single_socket") addBom(bom, "Zásuvka jednonásobná 230 V / 16 A");
    if (node.kind === "double_socket") addBom(bom, "Zásuvka dvojnásobná (dvojzásuvka) 230 V / 16 A");
    if (node.kind === "light") addBom(bom, node.lightControl === "pwm" ? "Vývod LED 24 V DC (pásek / svítidlo ze zdroje v rozváděči)" : "Svítidlový vývod (stropní)");
    if (node.kind === "light") {
      if (node.lightControl === "pwm") pwmLights.push(node);
      else lights.push(node);
      continue;
    }
    if (node.kind === "blind_motor") {
      addBom(bom, "Vývod pro motor žaluzie / rolety (kastlík okna)");
      blindMotors.push(node);
      continue;
    }
    if (node.kind === "switch") continue; // spínače vyplývají z ovládání místností (bod 2)
    if (node.kind === "data_socket") {
      // Datová zásuvka RJ45 = slaboproud (UTP Cat6 z rozváděče / racku), žádný silový okruh
      addBom(bom, "Datová zásuvka RJ45 (UTP Cat6)");
      continue;
    }

    // Fáze 63: upravený nebo vlastní spotřebič – vlastní okruh přesně podle zadání v knihovně spotřebičů
    if (node.appliance) {
      const spec = node.appliance;
      const phases = spec.poles;
      const rcbo = spec.rcd === "RCBO" && phases === 1;
      const kind: CircuitKind = phases === 3 ? (spec.rcd === "B" ? "three_phase_rcd_b" : "cooktop") : "dedicated";
      push(
        {
          label: `${spec.label} – ${room}`,
          kind,
          phases,
          protection: rcbo ? { device: "RCBO", poles: "1P+N", curve: spec.curve, ratedA: spec.ratedA, rcd: { type: "A", sensitivityMa: 30 } } : { device: "MCB", poles: phases === 3 ? "3P" : "1P", curve: spec.curve, ratedA: spec.ratedA },
          rooms: [node.room],
          nodeIds: [node.id],
          outlets: 1,
          installedW: spec.powerW,
          designW: spec.powerW * spec.simultaneity,
          rcd: rcbo ? "own" : spec.rcd === "B" ? "B30" : spec.rcd === "F" ? "F30" : "A30",
          ...(tag ? { tag } : {}),
        },
        [node],
        spec.mm2,
      );
      continue;
    }
    if (tag && DEDICATED_1P.has(tag) && powerW >= DEDICATED_MIN_W) {
      push(
        { label: `${appliance!.label} – ${room}`, kind: "dedicated", phases: 1, protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 16 }, rooms: [node.room], nodeIds: [node.id], outlets: 1, installedW: powerW, designW: powerW * appliance!.simultaneity, rcd: "A30", tag },
        [node],
        2.5,
      );
      continue;
    }
    // Fáze 112: akumulační vytápění 3f 400 V (jistič podle příkonu, kabel CYKY-J 5×2,5 a víc)
    if (tag === "storage_heater") {
      const ratedA = threePhaseRating(powerW);
      push(
        { label: `${appliance!.label} – ${room}`, kind: "cooktop", phases: 3, protection: { device: "MCB", poles: "3P", curve: "B", ratedA }, rooms: [node.room], nodeIds: [node.id], outlets: 1, installedW: powerW, designW: powerW * appliance!.simultaneity, rcd: "A30", tag },
        [node],
        threePhaseSection(ratedA),
      );
      continue;
    }
    if (tag === "cooktop_3p") {
      push(
        { label: `${appliance!.label} – ${room}`, kind: "cooktop", phases: 3, protection: { device: "MCB", poles: "3P", curve: "B", ratedA: 16 }, rooms: [node.room], nodeIds: [node.id], outlets: 1, installedW: powerW, designW: powerW * appliance!.simultaneity, rcd: "A30" },
        [node],
        2.5,
      );
      continue;
    }
    if (tag === "fridge") {
      push(
        {
          label: `${appliance!.label} – ${room} (nevypínaná větev)`,
          kind: "fridge",
          phases: 1,
          protection: { device: "RCBO", poles: "1P+N", curve: "B", ratedA: 16, rcd: { type: "A", sensitivityMa: 30 } },
          rooms: [node.room],
          nodeIds: [node.id],
          outlets: 1,
          installedW: powerW,
          designW: powerW,
          rcd: "own",
        },
        [node],
        2.5,
      );
      continue;
    }
    if (tag && RCD_TYPE_B_TAGS.includes(tag)) {
      const ratedA = threePhaseRating(powerW);
      push(
        {
          label: `${appliance!.label} – ${room}`,
          kind: "three_phase_rcd_b",
          phases: 3,
          protection: { device: "MCB", poles: "3P", curve: tag === "heat_pump" ? "C" : "B", ratedA },
          rooms: [node.room],
          nodeIds: [node.id],
          outlets: 1,
          installedW: powerW,
          designW: powerW * appliance!.simultaneity,
          rcd: "B30",
          tag,
        },
        [node],
        threePhaseSection(ratedA),
      );
      continue;
    }
    // Fáze 82: zásuvka na světelném okruhu (přiřadí se po sestavení světelných okruhů)
    if ((node.kind === "single_socket" || node.kind === "double_socket") && node.onLighting) {
      lightingSockets.push(node);
      continue;
    }
    // Běžná zásuvka (i spotřebič se štítkem pod 2 000 W)
    if (node.kind === "single_socket" || node.kind === "double_socket" || node.kind === "appliance") sockets.push(node);
  }
  // Fáze 82: podlaží bez světel (230 V) nemá světelný okruh – zásuvka zůstane na zásuvkovém okruhu
  const litFloors = new Set(lights.map((node) => node.floor ?? ""));
  const stranded = lightingSockets.filter((node) => !litFloors.has(node.floor ?? ""));
  if (stranded.length) {
    warnings.push(`${stranded.length}× zásuvka na světelném okruhu, ale na podlaží není světlo – zůstává na zásuvkovém okruhu.`);
    sockets.push(...stranded);
  }
  const socketsOnLighting = lightingSockets.filter((node) => litFloors.has(node.floor ?? ""));

  // Místnosti od rozváděče nejbližší, uvnitř místnosti podle vzdálenosti (světla)
  const byRoom = (nodes: readonly FloorNode[]) => {
    const groups = new Map<string, FloorNode[]>();
    for (const node of [...nodes].sort((a, b) => length(a) - length(b))) groups.set(node.room, [...(groups.get(node.room) ?? []), node]);
    return [...groups.entries()].sort((a, b) => Math.min(...a[1].map(length)) - Math.min(...b[1].map(length)) || (roomOrder.get(a[0]) ?? 0) - (roomOrder.get(b[0]) ?? 0));
  };
  // ČSN 33 2130 ed. 4: limit 10 platí pro skutečné zásuvky – dvojzásuvka = 2 (přepínač `countDoubleAsTwo`)
  const outletsOf = (node: FloorNode) => (node.kind === "double_socket" && countDoubleAsTwo ? 2 : 1);
  const weight = (nodes: readonly FloorNode[]) => nodes.reduce((sum, node) => sum + outletsOf(node), 0);
  // Fáze 93: zdravotnický prostor Skupiny 1 – zásuvky lékařských místností a lůžkových ramp mimo zóny (okruhy A / B níže)
  const medical = isMedical(options.occupancy);
  const medicalSockets = medical ? sockets.filter((node) => node.medicalCircuit || isMedicalRoom(roomName.get(node.room) ?? node.room)) : [];
  const medicalIds = new Set(medicalSockets.map((node) => node.id));
  const zoneSockets = medicalIds.size ? sockets.filter((node) => !medicalIds.has(node.id)) : sockets;
  // Fáze 65: běžné zásuvky – ruční okruhy, pak kompaktní zóny / po místnostech / podle vzdálenosti (`socket-zones.ts`);
  // fáze 59: zásuvkový okruh nikdy nespojuje dvě podlaží
  const socketById = new Map(zoneSockets.map((node) => [node.id, node]));
  const zones = planSocketGroups(
    zoneSockets.map((node) => ({
      id: node.id,
      room: node.room,
      floor: node.floor ?? "",
      x: node.px[0] * calibration.pxToMm.x,
      y: node.px[1] * calibration.pxToMm.y,
      home: length(node),
      weight: outletsOf(node),
      manual: node.socketCircuit ?? null,
      roomOrder: roomOrder.get(node.room) ?? 0,
      frame: node.frame ?? null,
    })),
    { grouping: options.socketGrouping ?? "distance", maxOutlets: MAX_OUTLETS_PER_CIRCUIT },
  );
  warnings.push(...zones.warnings);
  for (const zone of zones.groups) {
    const group = zone.ids.map((id) => socketById.get(id)!);
    const rooms = [...new Set(group.map((node) => node.room))];
    const installedW = group.reduce((sum, node) => sum + (node.powerW ?? OUTLET_POWER_W), 0);
    push(
      {
        label: `Zásuvky – ${rooms.map((room) => roomName.get(room) ?? room).join(", ")}${zone.manual ? ` (ruční okruh ${zone.manual})` : ""}`,
        kind: "sockets",
        phases: 1,
        protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 16 },
        rooms,
        nodeIds: group.map((node) => node.id),
        outlets: weight(group),
        installedW,
        designW: Math.min(installedW * SOCKET_SIMULTANEITY + OUTLET_POWER_W, 3680),
        rcd: "A30",
      },
      group,
      2.5,
    );
  }

  // Fáze 93: ČSN 33 2000-7-710 ed. 2 (čl. 710.53 / 710.55) – zásuvky lékařské místnosti alespoň ze 2 samostatných obvodů
  // (Okruh A zelené / bílé, Okruh B oranžové / zálohované), každý pod vlastním RCBO 1P+N B16 30 mA typ A
  for (const [, roomNodes] of byRoom(medicalSockets)) {
    const room = roomName.get(roomNodes[0].room) ?? roomNodes[0].room;
    const sides: Record<MedicalCircuit, FloorNode[]> = { A: [], B: [] };
    for (const node of roomNodes.filter((candidate) => candidate.medicalCircuit)) sides[node.medicalCircuit!].push(node);
    for (const node of roomNodes.filter((candidate) => !candidate.medicalCircuit)) sides[weight(sides.A) <= weight(sides.B) ? "A" : "B"].push(node);
    if (!sides.B.length && sides.A.length > 1) sides.B.push(sides.A.pop()!);
    if (!sides.B.length) warnings.push(`${room}: zdravotnický prostor Skupiny 1 má jen 1 zásuvkový vývod – druhý samostatný obvod (Okruh B) nelze vytvořit; doplňte zásuvku okruhu B nebo lůžkovou rampu LUZ (ČSN 33 2000-7-710 ed. 2).`);
    for (const side of ["A", "B"] as const) {
      const nodes = sides[side];
      const chunks: FloorNode[][] = [];
      for (const node of nodes) {
        const last = chunks[chunks.length - 1];
        if (last && weight(last) + outletsOf(node) <= MAX_OUTLETS_PER_CIRCUIT) last.push(node);
        else chunks.push([node]);
      }
      chunks.forEach((chunk, index) => {
        const installedW = chunk.reduce((sum, node) => sum + (node.powerW ?? OUTLET_POWER_W), 0);
        const circuit = MEDICAL_CIRCUIT[side];
        push(
          {
            label: `Zásuvky – ${room} – ${circuit.label}${chunks.length > 1 ? ` (${index + 1})` : ""} (${circuit.colors})`,
            kind: "sockets",
            phases: 1,
            protection: { device: "RCBO", poles: "1P+N", curve: "B", ratedA: 16, rcd: { type: "A", sensitivityMa: 30 } },
            rooms: [chunk[0].room],
            nodeIds: chunk.map((node) => node.id),
            outlets: weight(chunk),
            installedW,
            designW: Math.min(installedW * SOCKET_SIMULTANEITY + OUTLET_POWER_W, 3680),
            rcd: "own",
          },
          chunk,
          2.5,
        );
      });
    }
  }

  // Světla: místnosti střídavě do min. 2 nezávislých okruhů, max. 10 bodů na okruh; fáze 59 – po podlažích
  // (každé podlaží s vlastními světelnými okruhy, jediné podlaží se světly = min. 2 okruhy)
  const lightFloors = [...new Set(lights.map((node) => node.floor ?? ""))];
  const lightGroups: FloorNode[][] = [];
  const minLighting = Math.max(1, Math.round(options.minLightingCircuits ?? 2));
  for (const floor of lightFloors) {
    const floorLights = lights.filter((node) => (node.floor ?? "") === floor);
    const lightRooms = byRoom(floorLights);
    const lightCount = Math.min(Math.max(floorLights.length, 1), Math.max(lightFloors.length === 1 ? minLighting : 1, Math.ceil(floorLights.length / MAX_LIGHTS_PER_CIRCUIT)));
    const groups: FloorNode[][] = Array.from({ length: Math.max(1, lightCount) }, () => []);
    if (lightRooms.length === 1) floorLights.forEach((node, index) => groups[index % groups.length].push(node));
    else
      for (const [roomId, nodes] of lightRooms) {
        // Fáze 93: lékařská místnost se 2 a více svítidly – světla střídavě do 2 nezávislých okruhů (výpadek ≠ tma)
        if (medical && nodes.length >= 2 && isMedicalRoom(roomName.get(roomId) ?? roomId)) {
          if (groups.length < 2) groups.push([]);
          const [first, second] = [...groups].sort((a, b) => a.length - b.length);
          nodes.forEach((node, index) => (index % 2 ? second : first).push(node));
          continue;
        }
        const target = groups.reduce((best, group) => (group.length < best.length ? group : best), groups[0]);
        target.push(...nodes);
      }
    lightGroups.push(...groups);
  }
  // Fáze 82: zásuvka na světelném okruhu – okruh se světlem její místnosti, jinak nejméně obsazený okruh podlaží
  const socketsOf = new Map<FloorNode[], FloorNode[]>();
  const points = (group: FloorNode[]) => group.length + weight(socketsOf.get(group) ?? []);
  for (const socket of [...socketsOnLighting].sort((a, b) => length(a) - length(b))) {
    const floorGroups = lightGroups.filter((group) => group.length && (group[0].floor ?? "") === (socket.floor ?? ""));
    const target = floorGroups.find((group) => group.some((node) => node.room === socket.room)) ?? floorGroups.reduce((best, group) => (points(group) < points(best) ? group : best), floorGroups[0]);
    socketsOf.set(target, [...(socketsOf.get(target) ?? []), socket]);
  }
  const socketA: LightingSocketA = isLightingSocketA(options.lightingSocketA) ? options.lightingSocketA : 10;
  for (const group of lightGroups.filter((nodes) => nodes.length)) {
    const outletsOnLight = socketsOf.get(group) ?? [];
    const nodes = [...group, ...outletsOnLight];
    const rooms = [...new Set(nodes.map((node) => node.room))];
    const lightW = group.reduce((sum, node) => sum + (node.powerW ?? LIGHT_POWER_W), 0);
    const socketW = outletsOnLight.reduce((sum, node) => sum + (node.powerW ?? OUTLET_POWER_W), 0);
    // Fáze 77: okruh se svítidly DALI vede kabelem 5×1,5 (L, N, PE, DA+, DA−)
    const dali = group.some((node) => node.lightControl === "dali");
    // Fáze 82: se zásuvkami jistič 10 / 13 A (nikdy 16 A); soudobý příkon světel + zásuvek nejvýš In · 230 V
    const ratedA = outletsOnLight.length ? socketA : 10;
    const label = `${outletsOnLight.length ? "Světla + zásuvky" : "Světla"} – ${rooms.map((room) => roomName.get(room) ?? room).join(", ")}${dali ? " (DALI)" : ""}`;
    const outletPoints = group.length + weight(outletsOnLight);
    if (outletsOnLight.length && outletPoints > MAX_LIGHTS_PER_CIRCUIT) warnings.push(`${label}: ${outletPoints} vývodů (světla a zásuvky) – nad ${MAX_LIGHTS_PER_CIRCUIT} na světelný okruh; přesuňte část zásuvek na zásuvkový okruh.`);
    push(
      {
        label,
        kind: "lighting",
        phases: 1,
        protection: lightingProtection === "rcbo" ? { device: "RCBO", poles: "1P+N", curve: "B", ratedA, rcd: { type: "A", sensitivityMa: 30 } } : { device: "MCB", poles: "1P", curve: "B", ratedA },
        rooms,
        nodeIds: nodes.map((node) => node.id),
        outlets: weight(outletsOnLight),
        installedW: lightW + socketW,
        designW: Math.min(lightW * LIGHT_SIMULTANEITY + (outletsOnLight.length ? socketW * SOCKET_SIMULTANEITY + OUTLET_POWER_W : 0), ratedA * NOMINAL_U0),
        rcd: lightingProtection === "rcbo" ? "own" : "A30L",
      },
      nodes,
      1.5,
      dali ? 5 : undefined,
    );
  }
  if (lights.length && minLighting >= 2 && circuits.filter((circuit) => circuit.kind === "lighting").length < 2) warnings.push("Jen jeden světelný bod – druhý nezávislý světelný okruh nelze vytvořit.");

  // Fáze 77: LED 24 V DC (PWM) – napájecí zdroj na DIN liště má vlastní světelný okruh B10 (pásky vedou ze zdroje / řadiče)
  if (pwmLights.length) {
    const rooms = [...new Set(pwmLights.map((node) => node.room))];
    const ledW = pwmLights.reduce((sum, node) => sum + (node.powerW ?? LIGHT_POWER_W), 0);
    push(
      {
        label: `Zdroj 24 V DC – LED osvětlení (${rooms.map((room) => roomName.get(room) ?? room).join(", ")})`,
        kind: "lighting",
        phases: 1,
        protection: lightingProtection === "rcbo" ? { device: "RCBO", poles: "1P+N", curve: "B", ratedA: 10, rcd: { type: "A", sensitivityMa: 30 } } : { device: "MCB", poles: "1P", curve: "B", ratedA: 10 },
        rooms,
        nodeIds: [],
        outlets: 0,
        installedW: Math.round(ledW * LED_PSU_RESERVE),
        designW: Math.round(ledW * LED_PSU_RESERVE),
        rcd: lightingProtection === "rcbo" ? "own" : "A30L",
      },
      [],
      1.5,
    );
  }

  // Fáze 77: žaluziové okruhy B10 – motory 230 V AC po podlažích (max. 8 na okruh); u sběrnicové instalace jeden okruh
  // napájí žaluziové akční členy v rozváděči (motory hvězdou z aktorů). Pohony 24 V DC / sběrnicové napájí zdroj systému.
  const acMotors = blindMotors.filter((node) => (node.blindDrive ?? "ac230") === "ac230");
  if (blindMotors.length > acMotors.length) warnings.push(`${blindMotors.length - acMotors.length}× pohon žaluzie 24 V DC / sběrnicový – napájí ho zdroj 24 V řídicího systému v rozváděči (ověřte rozběhový proud pohonů).`);
  const blindCircuit = (group: readonly FloorNode[], label: string, inBoard: boolean) =>
    push(
      {
        label,
        kind: "blinds",
        phases: 1,
        protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 10 },
        rooms: [...new Set(group.map((node) => node.room))],
        nodeIds: inBoard ? [] : group.map((node) => node.id),
        outlets: 0,
        installedW: group.length * BLIND_MOTOR_W,
        designW: group.length * BLIND_MOTOR_W,
        rcd: "A30",
      },
      inBoard ? [] : group,
      1.5,
    );
  if (acMotors.length && plan.mode === "bus_loxone") blindCircuit(acMotors, `Žaluzie – napájení žaluziových akčních členů (${acMotors.length} motorů)`, true);
  else if (acMotors.length) {
    for (const floor of [...new Set(acMotors.map((node) => node.floor ?? ""))]) {
      const floorMotors = byRoom(acMotors.filter((node) => (node.floor ?? "") === floor)).flatMap(([, nodes]) => nodes);
      for (let start = 0; start < floorMotors.length; start += MAX_BLINDS_PER_CIRCUIT) {
        const group = floorMotors.slice(start, start + MAX_BLINDS_PER_CIRCUIT);
        blindCircuit(group, `Žaluzie – ${[...new Set(group.map((node) => roomName.get(node.room) ?? node.room))].join(", ")}`, false);
      }
    }
  }

  // Ovládání světel po místnostech (bod 2)
  const switching = plan.rooms.filter((room) => room.lighting).map((room) => ({ room: room.id, wiring: resolveSwitchWiring({ ...room.lighting!, mode: plan.mode }) }));
  const io = { di: 0, do: 0, impulseRelays: 0, treeDevices: 0 };
  for (const { wiring } of switching) {
    io.di += wiring.io.di;
    io.do += wiring.io.do;
    io.impulseRelays += wiring.impulseRelays;
    io.treeDevices += wiring.treeDevices;
    for (const item of wiring.items) addBom(bom, item.razeni ? `${item.name} (řazení ${item.razeni})` : item.name, item.count);
  }

  // Fáze 52: krabice a prvky podle úrovně instalace
  const switchPlaces = plan.rooms.reduce((sum, room) => sum + (room.lighting ? room.lighting.switchCount + (room.lighting.blinds ?? 0) : 0), 0);
  const socketBoxes = plan.nodes.filter((node) => node.kind === "single_socket" || node.kind === "double_socket" || node.kind === "data_socket").length;
  addBom(bom, BOX_STANDARD, socketBoxes + (plan.mode === "smart_retrofit" ? 0 : switchPlaces));
  if (plan.mode === "smart_retrofit") addBom(bom, BOX_DEEP, switchPlaces);
  if (plan.mode === "bus_loxone") {
    // Hvězda: každý spínaný vývod (světelná větev, žaluzie) na vlastní patro svorkovnice v rozváděči
    addBom(bom, BUS_TERMINALS, Math.max(io.do, lights.length));
    addBom(bom, BUS_CABLE, switchPlaces ? 1 : 0);
    if (circuits.some((circuit) => circuit.tag && RCD_TYPE_B_TAGS.includes(circuit.tag))) {
      addBom(bom, RS485_METER);
      addBom(bom, RS485_TERMINATOR, 2);
    }
  }
  for (const item of constructionDetails(options.environment)) addBom(bom, item);

  return { circuits, bom: [...bom.entries()].map(([item, count]) => ({ item, count })), switching, io, warnings };
}

// ---------------------------------------------------------------------------
//  3b. Fáze 74: přívod podružného rozváděče
// ---------------------------------------------------------------------------

/** Průřezy přívodu podružného rozváděče (CYKY-J) [mm²]. */
const FEEDER_SECTIONS = [2.5, 4, 6, 10, 16] as const;
/** Cílový úbytek napětí na přívodu podružného rozváděče [%] – zbytek limitu (3 / 5 %) zůstane koncovým okruhům. */
export const FEEDER_DROP_LIMIT = 1.5;

/**
 * Přívod hlavní rozváděč → podružný rozváděč: výpočtový proud = nejzatíženější fáze soudobých příkonů okruhů
 * podružného rozváděče (3f přívod, rozložení fází jako v rozváděči), jistič 3P / 1P+N nejbližší vyšší řady (min. 16 A),
 * nejmenší průřez CYKY-J, který splní koordinaci IB ≤ In ≤ Iz, úbytek do `FEEDER_DROP_LIMIT` a impedanci smyčky.
 * Přívod není pod chráničem 30 mA (`rcd: "none"`) – doplňkovou ochranu mají okruhy podružného rozváděče.
 */
export function subBoardFeeder(input: {
  board: string;
  /** Uzel trasy podružného rozváděče (cíl přívodu) a místnost, ve které visí. */
  nodeId: string;
  room: string;
  roomName?: string;
  circuits: readonly Pick<Circuit, "id" | "designW" | "installedW" | "phases">[];
  supplyPhases: 1 | 3;
  lengthMm: number;
  method?: InstallMethod;
  groupedCables?: number;
  supplyLoopOhm?: number;
}): { circuit: Circuit; warnings: string[] } {
  const warnings: string[] = [];
  const phases: 1 | 3 = input.supplyPhases === 1 ? 1 : 3;
  const method = input.method ?? "C";
  const designW = Math.round(input.circuits.reduce((sum, circuit) => sum + circuit.designW, 0));
  const installedW = Math.round(input.circuits.reduce((sum, circuit) => sum + circuit.installedW, 0));
  const phaseLoad = phases === 3 ? Math.max(0, ...Object.values(balancePhases(input.circuits).load)) : designW;
  const designA = phaseLoad / NOMINAL_U0;
  const ratedA = STANDARD_RATINGS.find((rating) => rating >= Math.max(16, designA)) ?? 63;
  if (designA > 63) warnings.push(`Přívod ${input.board}: výpočtový proud ${Math.round(designA)} A překračuje jistič 63 A – rozdělte podružný rozváděč nebo zvolte pojistkový odpínač.`);
  const protection: Protection = { device: "MCB", poles: phases === 3 ? "3P" : "1P+N", curve: "B", ratedA };
  const evaluate = (mm2: number) => ({
    mm2,
    drop: voltageDropPercent({ lengthMm: input.lengthMm, currentA: ratedA, crossSectionMm2: mm2, phases }),
    coordination: checkCoordination({ designCurrentA: Math.min(designA, ratedA), ratedA, crossSectionMm2: mm2, method, phases, groupedCables: input.groupedCables }),
    loop: loopImpedanceCheck({ lengthMm: input.lengthMm, crossSectionMm2: mm2, ratedA, curve: protection.curve, supplyLoopOhm: input.supplyLoopOhm }),
  });
  const start = ratedA <= 16 ? 2.5 : ratedA <= 25 ? 4 : ratedA <= 32 ? 6 : 10;
  const options = FEEDER_SECTIONS.filter((mm2) => mm2 >= start).map(evaluate);
  const pick = options.find((option) => option.drop <= FEEDER_DROP_LIMIT && option.coordination.ok && option.loop.ok) ?? options[options.length - 1];
  if (pick.drop > FEEDER_DROP_LIMIT) warnings.push(`Přívod ${input.board}: úbytek napětí ${String(pick.drop).replace(".", ",")} % i při ${String(pick.mm2).replace(".", ",")} mm² – zkraťte trasu nebo rozváděč přesuňte.`);
  if (!pick.coordination.ok) warnings.push(`Přívod ${input.board}: nesplněna podmínka IB ≤ In ≤ Iz (Iz ${String(pick.coordination.izA).replace(".", ",")} A) – změňte uložení nebo jištění.`);
  if (!pick.loop.ok) warnings.push(`Přívod ${input.board}: impedance smyčky ${String(pick.loop.zsOhm).replace(".", ",")} Ω nevyhoví samočinnému odpojení – zvětšete průřez nebo zkraťte trasu.`);
  const where = input.roomName ? ` (${input.roomName})` : "";
  return {
    circuit: {
      id: `feeder-${input.board}`,
      label: `Přívod podružného rozváděče ${input.board}${where}`,
      kind: "feeder",
      phases,
      protection,
      cable: cableFor(phases, pick.mm2),
      crossSectionMm2: pick.mm2,
      rooms: [input.room],
      nodeIds: [input.nodeId],
      outlets: 0,
      installedW,
      designW,
      lengthMm: input.lengthMm,
      voltageDropPct: pick.drop,
      rcd: "none",
      izA: pick.coordination.izA,
      loop: pick.loop,
      board: MAIN_BOARD,
      feeds: input.board,
    },
    warnings,
  };
}

/** Fáze 74: odpor smyčky přívodu podružného rozváděče [Ω] (fázový + ochranný vodič, 20 °C) – přičte se k impedanci přívodu RH. */
export const feederLoopOhm = (circuit: Pick<Circuit, "lengthMm" | "crossSectionMm2">) => (2 * (circuit.lengthMm / 1000) * COPPER_RESISTIVITY_20) / circuit.crossSectionMm2;

// ===========================================================================
//  4. Generátor rozváděče, vyvažování fází a výběr skříně
// ===========================================================================

export type Phase = "L1" | "L2" | "L3";

export interface PanelDevice {
  designation: string;
  label: string;
  category: ComponentCategory;
  poles: string;
  modules: number;
  ratedA: number | null;
  /** Konfigurace pro konfigurátor / `placeComponents` AI Panel Builderu. */
  config: ItemConfig;
  powerLossW: number;
  phase: Phase | "L1,L2,L3" | "L1,N" | null;
  /** Okruh, který přístroj jistí (null = hlavní vypínač, SPD, chránič, svorkovnice, chytré moduly). */
  circuitId: string | null;
  /** Fáze 60: stabilní klíč přístroje a klíč nadřazeného přístroje ve stromu zapojení (null = hlavní vstupní prvek). */
  key: string;
  parentKey: string | null;
  /**
   * Fáze 61: přesný katalogový kus (akční členy chytré domácnosti) – přednost před výběrem podle konfigurace. Fáze 81:
   * klíč v katalogu prvků (`catalogArticle` – „LOXONE:100335“, „TAPHOME:6DO“) a ztrátový výkon Pv modulu.
   */
  article?: { manufacturer: string; series?: string; typeCode: string; articleNumber: string | null; description: string; catalogArticle?: string | null; powerLossW?: number | null; lossVerified?: boolean };
}

/** Fáze 61: modul chytré domácnosti pro generátor rozváděče (z `planSmartHome`). */
export interface SmartBoardModule {
  role: string;
  label: string;
  manufacturer: string;
  /** Systém jako řada katalogu („ABB-free@home“, „ABB i-bus KNX“, „Loxone“). */
  series?: string;
  typeCode: string;
  articleNumber: string | null;
  modules: number;
  /** Fáze 81: klíč kusu v katalogu prvků a ztrátový výkon Pv (null = odhad dle IEC); `lossVerified` = Pv z podkladů výrobce. */
  catalogArticle?: string | null;
  powerLossW?: number | null;
  lossVerified?: boolean;
}

export interface RcdGroup {
  designation: string;
  type: "A" | "B" | "F";
  circuitIds: string[];
  /** Fáze 52: chránič vyhrazený jen pro světelné okruhy. */
  lightingOnly?: boolean;
}

export interface Switchboard {
  devices: PanelDevice[];
  rails: { index: number; capacity: number; devices: PanelDevice[]; used: number }[];
  phaseLoadW: Record<Phase, number>;
  phaseOf: Record<string, Phase | "L1,L2,L3">;
  rcdGroups: RcdGroup[];
  bom: BomItem[];
  totalModules: number;
  /** Moduly + 25 % rezerva (zaokrouhleno nahoru). */
  requiredModules: number;
  totalPowerLossW: number;
  enclosure: EnclosureLike | null;
  warnings: string[];
  /** Fáze 111: uspořádání lišt – dvě pole vedle sebe (Silnoproud | Slaboproud), přepážka, koncepce. */
  layout: RailLayout;
  /** Fáze 111: dva samostatné rozváděče – RH2 (slaboproud / Smart Home) s vlastními lištami a skříní. */
  second: { rails: { index: number; capacity: number; devices: PanelDevice[]; used: number }[]; devices: PanelDevice[]; enclosure: EnclosureLike | null; totalPowerLossW: number } | null;
  /** Fáze 111: skupiny přístrojů (chránič s jističi, slaboproud …) pro průvodce uspořádáním skříně a lišt. */
  packGroups: PackGroup<PanelDevice>[];
}

/** Max. okruhů pod jedním 4P chráničem 30 mA (zadání: 5 až 6). */
export const MAX_CIRCUITS_PER_RCD = 6;
export const MODULE_RESERVE = 0.25;

/** Moduly chytré instalace (šířky orientační). */
export const SMART_MODULES = {
  loxoneMiniserver: { label: "Loxone Miniserver", modules: 9, outputs: 8, inputs: 8 },
  loxoneRelayExtension: { label: "Loxone Relay Extension", modules: 9, outputs: 14, inputs: 0 },
  loxoneTreeExtension: { label: "Loxone Tree Extension", modules: 2, outputs: 0, inputs: 0, treePerBranch: 50 },
  psu24: { label: "Napájecí zdroj 24 V DC", modules: 3, outputs: 0, inputs: 0 },
  shellyPro4pm: { label: "Shelly Pro 4PM", modules: 2, outputs: 4, inputs: 4 },
} as const;

/**
 * Hladové vyvažování fází: 1f okruhy od největšího soudobého příkonu vždy na nejméně zatíženou fázi,
 * 3f okruhy rovnoměrně na všechny tři.
 */
export function balancePhases(circuits: readonly Pick<Circuit, "id" | "phases" | "designW">[]): { phaseOf: Record<string, Phase | "L1,L2,L3">; load: Record<Phase, number> } {
  const load: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  const phaseOf: Record<string, Phase | "L1,L2,L3"> = {};
  for (const circuit of circuits.filter((c) => c.phases === 3)) {
    phaseOf[circuit.id] = "L1,L2,L3";
    for (const phase of ["L1", "L2", "L3"] as const) load[phase] += circuit.designW / 3;
  }
  for (const circuit of [...circuits].filter((c) => c.phases === 1).sort((a, b) => b.designW - a.designW || a.id.localeCompare(b.id))) {
    const phase = (["L1", "L2", "L3"] as const).reduce((best, candidate) => (load[candidate] < load[best] ? candidate : best), "L1" as Phase);
    phaseOf[circuit.id] = phase;
    load[phase] += circuit.designW;
  }
  for (const phase of ["L1", "L2", "L3"] as const) load[phase] = Math.round(load[phase]);
  return { phaseOf, load };
}

const PHASES: readonly Phase[] = ["L1", "L2", "L3"];
/** Fáze 75: náročnost součtu jističů pod chráničem v domácnosti – jmenovitý proud chrániče ≥ 0,7 × Σ In na fázi. */
export const RCD_DIVERSITY = 0.7;

/** Fáze 75: součet jmenovitých proudů jističů na nejzatíženější fázi chrániče × náročnost [A]. */
export function rcdDemandA(circuits: readonly Pick<Circuit, "id" | "protection" | "phases">[], phaseOf: Readonly<Record<string, Phase | "L1,L2,L3">>): number {
  const sum: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  for (const circuit of circuits) {
    const phase = phaseOf[circuit.id];
    if (circuit.phases === 3 || phase === "L1,L2,L3") for (const p of PHASES) sum[p] += circuit.protection.ratedA;
    else sum[(phase as Phase | undefined) ?? "L1"] += circuit.protection.ratedA;
  }
  return Math.round(Math.max(...PHASES.map((p) => sum[p])) * RCD_DIVERSITY * 10) / 10;
}

/** Fáze 75: jmenovitý proud chrániče 40 A, při větším součtu 63 A; nad 63 A vrací 64 (rozdělit skupinu – upozornění). */
export function rcdRating(circuits: readonly Pick<Circuit, "id" | "protection" | "phases">[], phaseOf: Readonly<Record<string, Phase | "L1,L2,L3">>): number {
  const demand = rcdDemandA(circuits, phaseOf);
  return demand <= 40 ? 40 : demand <= 63 ? 63 : 64;
}

/**
 * Fáze 75: fáze jističů podle pozice na hřebenové propojovací liště 3P pod 4P chráničem (a ve skupině RCBO): pozice
 * po sobě L1, L2, L3, L1 … Pro každou skupinu se zvolí natočení napájení lišty (první pozice L1 / L2 / L3) a pořadí
 * okruhů tak, aby byl soudobý příkon fází co nejvyrovnanější (nejtěžší okruh na nejméně zatíženou volnou fázi). 3f okruhy
 * (a přívody `direct`) zatíží všechny fáze rovnoměrně a stojí ve skupině první. Vrací fáze, zatížení a pořadí skupin.
 */
export function combPhases(groups: readonly { key: string; circuits: readonly Circuit[] }[], direct: readonly Circuit[] = []): { phaseOf: Record<string, Phase | "L1,L2,L3">; load: Record<Phase, number>; order: Map<string, Circuit[]> } {
  const load: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
  const phaseOf: Record<string, Phase | "L1,L2,L3"> = {};
  for (const circuit of [...groups.flatMap((group) => group.circuits), ...direct].filter((c) => c.phases === 3)) {
    phaseOf[circuit.id] = "L1,L2,L3";
    for (const p of PHASES) load[p] += circuit.designW / 3;
  }
  // Přívod 1P+N (1f přívod podružného rozváděče) jako samostatný okruh na nejméně zatíženou fázi
  for (const circuit of direct.filter((c) => c.phases === 1)) {
    const phase = [...PHASES].sort((a, b) => load[a] - load[b])[0];
    phaseOf[circuit.id] = phase;
    load[phase] += circuit.designW;
  }
  const order = new Map<string, Circuit[]>();
  for (const group of groups) {
    const triples = group.circuits.filter((c) => c.phases === 3);
    const singles = [...group.circuits.filter((c) => c.phases === 1)].sort((a, b) => b.designW - a.designW || a.id.localeCompare(b.id));
    let best: { offset: number; assign: Map<string, Phase>; trial: Record<Phase, number>; spread: number } | null = null;
    for (const offset of [0, 1, 2]) {
      const slots: Record<Phase, number> = { L1: 0, L2: 0, L3: 0 };
      for (let i = 0; i < singles.length; i++) slots[PHASES[(offset + i) % 3]] += 1;
      const trial = { ...load };
      const assign = new Map<string, Phase>();
      for (const circuit of singles) {
        const phase = PHASES.filter((p) => slots[p] > 0).sort((a, b) => trial[a] - trial[b] || PHASES.indexOf(a) - PHASES.indexOf(b))[0];
        slots[phase] -= 1;
        trial[phase] += circuit.designW;
        assign.set(circuit.id, phase);
      }
      const spread = Math.max(...PHASES.map((p) => trial[p])) - Math.min(...PHASES.map((p) => trial[p]));
      if (!best || spread < best.spread - 1e-6) best = { offset, assign, trial, spread };
    }
    const queues: Record<Phase, Circuit[]> = { L1: [], L2: [], L3: [] };
    for (const circuit of singles) queues[best!.assign.get(circuit.id)!].push(circuit);
    const ordered: Circuit[] = [];
    for (let i = 0; i < singles.length; i++) {
      const phase = PHASES[(best!.offset + i) % 3];
      const circuit = queues[phase].shift()!;
      ordered.push(circuit);
      phaseOf[circuit.id] = phase;
    }
    Object.assign(load, best!.trial);
    order.set(group.key, [...triples, ...ordered]);
  }
  for (const p of PHASES) load[p] = Math.round(load[p]);
  return { phaseOf, load, order };
}

/**
 * Okruhy pod chrániče 30 mA typ A (nikdy AC): nejvýš 6 na chránič. Fáze 52 (ČSN 33 2130 ed. 4): světla
 * nikdy na společném chrániči se zásuvkami – buď RCBO na každém světelném okruhu (mimo chrániče), nebo
 * vyhrazené chrániče jen pro světla (`A30L`). EV / TČ / FVE dostanou každý vlastní chránič typ B.
 */
export function groupUnderRcds(circuits: readonly Circuit[]): RcdGroup[] {
  const result: RcdGroup[] = [];
  const pool = (rcd: "A30" | "A30L") => groupPool(circuits.filter((circuit) => circuit.rcd === rcd));
  for (const group of pool("A30")) result.push({ designation: `-FI${result.length + 1}`, type: "A", circuitIds: group.map((c) => c.id) });
  for (const group of pool("A30L")) result.push({ designation: `-FI${result.length + 1}`, type: "A", circuitIds: group.map((c) => c.id), lightingOnly: true });
  for (const circuit of circuits.filter((c) => c.rcd === "B30")) result.push({ designation: `-FI${result.length + 1}`, type: "B", circuitIds: [circuit.id] });
  // Fáze 63: spotřebič s vlastním chráničem typ F (měniče frekvence, pračky, tepelná čerpadla)
  for (const circuit of circuits.filter((c) => c.rcd === "F30")) result.push({ designation: `-FI${result.length + 1}`, type: "F", circuitIds: [circuit.id] });
  return result;
}

/**
 * Fáze 63: označení jističů okruhů tak, jak je očísluje rozváděč z půdorysu (`buildSwitchboardFromCircuits`): jističe
 * pod chrániči v pořadí skupin, pak okruhy s vlastní ochranou; jistič s chráničem (RCBO) má řadu -FA. Pro štítky tras.
 */
export function circuitDesignations(circuits: readonly Circuit[]): Record<string, string> {
  const result: Record<string, string> = {};
  // Fáze 74: každý rozváděč (hlavní, podružné) čísluje své jističe zvlášť – jako jeho vygenerovaný projekt
  const boards = [...new Set(circuits.map((circuit) => circuit.board ?? MAIN_BOARD))];
  for (const board of boards) {
    const own = circuits.filter((circuit) => (circuit.board ?? MAIN_BOARD) === board);
    const counters = { F: 0, FA: 0 };
    const assign = (circuit: Circuit) => {
      const prefix = circuit.protection.device === "RCBO" ? "FA" : "F";
      counters[prefix] += 1;
      result[circuit.id] = `-${prefix}${counters[prefix]}`;
    };
    const byId = new Map(own.map((circuit) => [circuit.id, circuit]));
    for (const group of groupUnderRcds(own)) for (const id of group.circuitIds) assign(byId.get(id)!);
    for (const circuit of own.filter((c) => c.rcd === "own")) assign(circuit);
    // Přívody podružných rozváděčů (bez chrániče) za jističi s vlastní ochranou
    for (const circuit of own.filter((c) => c.rcd === "none")) assign(circuit);
  }
  return result;
}

/** Rozdělení okruhů jednoho druhu chráničů: max. 6 na chránič, světla rozprostřít, bez konfliktu místností. */
function groupPool(shared: readonly Circuit[]): Circuit[][] {
  const order: Record<CircuitKind, number> = { lighting: 0, sockets: 1, blinds: 2, dedicated: 2, cooktop: 3, fridge: 9, three_phase_rcd_b: 9, feeder: 9 };
  const sorted = [...shared].sort((a, b) => order[a.kind] - order[b.kind] || a.id.localeCompare(b.id));
  const minimum = Math.max(shared.some((c) => c.kind === "lighting") && shared.some((c) => c.kind !== "lighting") ? 2 : 1, Math.ceil(shared.length / MAX_CIRCUITS_PER_RCD));
  const groups: { circuits: Circuit[] }[] = Array.from({ length: shared.length ? minimum : 0 }, () => ({ circuits: [] }));
  const conflict = (group: { circuits: Circuit[] }, circuit: Circuit) => {
    if (circuit.kind !== "lighting" && circuit.kind !== "sockets") return false;
    const opposite = circuit.kind === "lighting" ? "sockets" : "lighting";
    return group.circuits.some((other) => other.kind === opposite && other.rooms.some((room) => circuit.rooms.includes(room)));
  };
  for (const circuit of sorted) {
    const candidates = groups.filter((group) => group.circuits.length < MAX_CIRCUITS_PER_RCD && !conflict(group, circuit));
    // Světla co nejvíc rozprostřít, ostatní na nejméně obsazený chránič
    const pick = candidates.sort((a, b) => (circuit.kind === "lighting" ? a.circuits.filter((c) => c.kind === "lighting").length - b.circuits.filter((c) => c.kind === "lighting").length : 0) || a.circuits.length - b.circuits.length)[0];
    if (pick) pick.circuits.push(circuit);
    else groups.push({ circuits: [circuit] });
  }
  return groups.filter((group) => group.circuits.length).map((group) => group.circuits);
}

const config = (partial: Partial<ItemConfig> & Pick<ItemConfig, "category" | "poles" | "modules">): ItemConfig => ({ manufacturer: null, ratedCurrentA: null, ...partial });

/** Přístroje rozváděče, rozložení na lišty (skupina chrániče se nedělí), 25% rezerva a výběr skříně. */
export function buildSwitchboardFromCircuits(
  plan: Pick<CircuitPlan, "circuits" | "io" | "bom">,
  options: {
    mode: InstallMode;
    enclosures: readonly EnclosureLike[];
    mainSwitchA?: number;
    railModules?: number;
    centralStop?: boolean;
    supplyPhases?: 1 | 3;
    /**
     * Fáze 61: akční členy, zdroj a rozhraní chytré domácnosti z výpočtu `planSmartHome` (zvolený systém a výrobce);
     * bez nich výchozí sestava Loxone podle počtu výstupů.
     */
    smart?: readonly SmartBoardModule[];
    /**
     * Fáze 77: moduly k prvkům půdorysu i bez sběrnice (řídicí jednotka DALI, zdroje a řadiče LED 24 V, hlídač zaplavení);
     * modul bez šířky (ventil) jde do kusovníku.
     */
    devices?: readonly SmartBoardModule[];
    /**
     * Fáze 93: typ objektu – obchodní centrum / prostor pro veřejnost (BD4, ČSN 33 2000-7-718): hlavní vypínač nájemní
     * jednotky s vypínací spouští CENTRAL STOP a podružný elektroměr MID s komunikací Modbus / M-Bus.
     */
    occupancy?: OccupancyId;
    /**
     * Fáze 111: koncepce uspořádání skříně a lišt z průvodce (dvoupolová skříň Silnoproud | Slaboproud, široké 24M
     * lišty, kompaktní 18M lišty, dva rozváděče) a zvolené skříně z databáze; bez ní lišty pod sebou a nejmenší skříň.
     */
    layout?: LayoutConcept;
    enclosureId?: string | null;
    secondEnclosureId?: string | null;
    /** Fáze 114: DIN lišty doplnit do řad zvolené skříně (větší rozvodnice s rezervou z průvodce). */
    fillRows?: boolean;
    /** Fáze 111: výrobce přístrojů – v koncepcích přednost skříním stejného výrobce. */
    manufacturer?: string | null;
  },
): Switchboard {
  const warnings: string[] = [];
  const bom = new Map(plan.bom.map((entry) => [entry.item, entry.count]));
  // Fáze 55: jednofázový přívod 1× 230 V – 2P hlavní vypínač, 1f svodič, 2P chrániče a všechny okruhy na L1
  const single = options.supplyPhases === 1;
  if (single) {
    for (const circuit of plan.circuits.filter((c) => c.phases === 3)) warnings.push(`${circuit.label}: třífázový spotřebič nelze napájet z 1f přívodu – zvolte 3f soustavu nebo jednofázovou variantu spotřebiče.`);
  }
  const rcdGroups = groupUnderRcds(plan.circuits);
  const byId = new Map(plan.circuits.map((circuit) => [circuit.id, circuit]));
  // Fáze 75: fáze jističů pod 4P chráničem (a skupiny RCBO) podle pozice na hřebenové propojovací liště 3P – po sobě
  // L1, L2, L3, L1 … Vyvažování fází se dělá pořadím okruhů ve skupině a natočením napájení lišty, ne libovolnou fází.
  const ownGroup = plan.circuits.filter((circuit) => circuit.rcd === "own");
  const placed = single
    ? { phaseOf: Object.fromEntries(plan.circuits.map((circuit) => [circuit.id, "L1" as Phase])) as Record<string, Phase | "L1,L2,L3">, load: { L1: Math.round(plan.circuits.reduce((sum, circuit) => sum + circuit.designW, 0)), L2: 0, L3: 0 }, order: new Map<string, Circuit[]>() }
    : combPhases([...rcdGroups.map((group) => ({ key: group.designation, circuits: group.circuitIds.map((id) => byId.get(id)!) })), { key: "own", circuits: ownGroup }], plan.circuits.filter((circuit) => circuit.rcd === "none"));
  const phaseOf = placed.phaseOf;
  const load = placed.load;
  const orderOf = (key: string, circuits: Circuit[]) => placed.order.get(key) ?? circuits;
  const counters = new Map<string, number>();
  const designation = (prefix: string) => {
    const value = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, value);
    return `-${prefix}${value}`;
  };
  const device = (prefix: string, label: string, category: ComponentCategory, poles: string, modules: number, ratedA: number | null, cfg: ItemConfig, circuitId: string | null = null, phase: PanelDevice["phase"] = null): PanelDevice => {
    const designated = designation(prefix);
    return {
      designation: designated,
      label,
      category,
      poles,
      modules,
      ratedA,
      config: cfg,
      powerLossW: estimatePowerLoss(category, poles, ratedA ?? 0),
      phase,
      circuitId,
      // Fáze 60: strom podle hierarchie – výchozí rodič je hlavní vypínač (upřesní se níže)
      key: circuitId ? `circuit:${circuitId}` : designated,
      parentKey: "main",
    };
  };
  const tree = (item: PanelDevice, key: string, parentKey: string | null): PanelDevice => ({ ...item, key, parentKey });

  /** Skupiny přístrojů (na liště se nedělí). */
  const groups: PanelDevice[][] = [];
  /** Fáze 81: skupiny, které začínají na vlastní (vyhrazené) liště – akční členy chytré domácnosti. */
  const ownRail = new Set<PanelDevice[]>();
  /** Fáze 111: skupiny, které se na lištách nedělí (hlavní vypínač se svodičem, chránič se svými jističi). */
  const keep = new Set<PanelDevice[]>();
  /** Fáze 111: skupina řídicích obvodů (jistič, zdroje, moduly) – slaboproud, když nese PLC / zdroj. */
  let controlRef: PanelDevice[] | null = null;
  /** Fáze 81: přístroj modulu chytré domácnosti s přesným kusem katalogu a jeho Pv (jinak odhad dle IEC). */
  const smartDevice = (unit: SmartBoardModule, psu: boolean) => {
    const item = device(psu ? "T" : "A", unit.label, psu ? "PSU" : "PLC", "1P", unit.modules, null, config({ category: "OTHER", poles: "1P", modules: unit.modules, moduleSubtype: psu ? "PSU_DC" : "PLC", manufacturer: unit.manufacturer }));
    return {
      ...item,
      ...(unit.powerLossW !== null && unit.powerLossW !== undefined ? { powerLossW: unit.powerLossW } : {}),
      article: { manufacturer: unit.manufacturer, series: unit.series, typeCode: unit.typeCode, articleNumber: unit.articleNumber, description: unit.label, catalogArticle: unit.catalogArticle ?? null, powerLossW: unit.powerLossW ?? null, lossVerified: unit.lossVerified ?? false },
    };
  };
  const mainA = options.mainSwitchA ?? 40;
  // Hierarchie (fáze 60): hlavní vypínač = kořen stromu, SPD a svorkovnice za ním
  const head = single
    ? [
        device("Q", "Hlavní vypínač 2P (1× 230 V)", "MAIN_SWITCH", "2P", 2, mainA, config({ category: "MAIN_SWITCH", poles: "2P", modules: 2, ratedCurrentA: mainA }), null, "L1,N"),
        device("FV", "Svodič přepětí T1+T2 1f bez předjištění", "SPD", "1P+N", 2, null, config({ category: "SPD", poles: "1P+N", modules: 2, spdType: "T1+T2", surgeCurrentKa: 25 }), null, "L1,N"),
        device("X", "Rozbočovací svorkovnice (HLAK)", "TERMINAL", "2P", 2, null, config({ category: "ACCESSORY", poles: "2P", modules: 2, moduleSubtype: "TERMINAL_BLOCK" })),
      ]
    : [
        device("Q", "Hlavní vypínač", "MAIN_SWITCH", "3P", 3, mainA, config({ category: "MAIN_SWITCH", poles: "3P", modules: 3, ratedCurrentA: mainA }), null, "L1,L2,L3"),
        device("FV", "Svodič přepětí T1+T2 bez předjištění", "SPD", "3P+N", 4, null, config({ category: "SPD", poles: "3P+N", modules: 4, spdType: "T1+T2", surgeCurrentKa: 25 }), null, "L1,L2,L3"),
        device("X", "Rozbočovací svorkovnice (HLAK)", "TERMINAL", "4P", 4, null, config({ category: "ACCESSORY", poles: "4P", modules: 4, moduleSubtype: "TERMINAL_BLOCK" })),
      ];
  const headGroup = [tree(head[0], "main", null), tree(head[1], "spd", "main"), tree(head[2], "terminal", "main")];
  groups.push(headGroup);
  keep.add(headGroup);
  // Fáze 93: BD4 – vypínací spoušť CENTRAL STOP / TOTAL STOP na hlavním vypínači a podružný elektroměr MID nájemní jednotky
  if (isCommercial(options.occupancy)) {
    const shunt = shuntTripConfig(null);
    const meter = midMeterConfig(null, single ? 1 : 3);
    groups.push([
      tree(device("Y", CENTRAL_STOP_LABEL, "OTHER", shunt.poles, shunt.modules, null, shunt), "central-stop", "main"),
      tree({ ...device("P", MID_METER_LABEL, "OTHER", meter.poles, meter.modules, null, meter), phase: single ? "L1,N" : "L1,L2,L3" }, "mid-meter", "main"),
    ]);
    addBom(bom, "Tlačítko CENTRAL STOP / TOTAL STOP u vstupu do nájemní jednotky (vazba na EPS – vyhláška č. 23/2008 Sb.)");
  }

  const mcb = (circuit: Circuit) => {
    const { protection } = circuit;
    if (protection.device === "RCBO") {
      return device("FA", circuit.label, "RCBO", "1P+N", 2, protection.ratedA, config({ category: "RCBO", poles: "1P+N", modules: 2, ratedCurrentA: protection.ratedA, curve: protection.curve, rcdType: protection.rcd?.type ?? "A", rcdSensitivityMa: protection.rcd?.sensitivityMa ?? 30 }), circuit.id, phaseOf[circuit.id] ?? null);
    }
    const modules = protection.poles === "3P" ? 3 : 1;
    return device("F", circuit.label, "MCB", protection.poles, modules, protection.ratedA, config({ category: "MCB", poles: protection.poles, modules, ratedCurrentA: protection.ratedA, curve: protection.curve, breakingCapacityKa: 6 }), circuit.id, phaseOf[circuit.id] ?? null);
  };

  for (const group of rcdGroups) {
    const circuits = orderOf(group.designation, group.circuitIds.map((id) => byId.get(id)!));
    // Fáze 75: jmenovitý proud chrániče podle součtu jističů na nejzatíženější fázi s náročností (min. 40 A, jinak 63 A)
    const ratedA = rcdRating(circuits, phaseOf);
    if (ratedA > 63) warnings.push(`${group.designation}: součet jističů pod chráničem ${Math.round(rcdDemandA(circuits, phaseOf))} A na fázi překračuje chránič 63 A – rozdělte okruhy na víc chráničů.`);
    const rcdPoles = single ? "2P" : "4P";
    const rated = Math.min(63, ratedA);
    const rcd: PanelDevice = { ...device("FI", `Proudový chránič 30 mA typ ${group.type}${group.lightingOnly ? " – jen světla" : ""}`, "RCD", rcdPoles, single ? 2 : 4, rated, config({ category: "RCD", poles: rcdPoles, modules: single ? 2 : 4, ratedCurrentA: rated, rcdType: group.type, rcdSensitivityMa: 30 }), null, single ? "L1,N" : "L1,L2,L3"), key: `rcd:${group.designation}`, parentKey: "main" };
    rcd.designation = group.designation;
    // Jističe skupiny pod svým chráničem (strom podle hierarchie, i když se skupina rozdělí na dvě lišty)
    const rcdGroup = [rcd, ...circuits.map((circuit) => ({ ...mcb(circuit), parentKey: rcd.key }))];
    groups.push(rcdGroup);
    keep.add(rcdGroup);
    addBom(bom, "Izolovaný N-můstek (pod chránič)");
    addBom(bom, single ? "Hřebenová propojovací lišta 1P+N (pod chránič)" : "Hřebenová propojovací lišta 3P (pod chránič)");
  }
  const own = orderOf("own", ownGroup);
  if (own.length) groups.push(own.map(mcb));
  // Fáze 74: přívody podružných rozváděčů – jistič 3P / 1P+N přímo za hlavním vypínačem, bez chrániče
  const direct = plan.circuits.filter((circuit) => circuit.rcd === "none");
  if (direct.length) groups.push(direct.map(mcb));

  // Fáze 112: řízení HDO – instalační stykač hned za jističem okruhu (napájený z jeho výstupu) a ovládací jistič B6
  // cívek stykačů ve skupině řídicích obvodů; cívka spíná přes kontakt přijímače HDO v elektroměrovém rozváděči
  const hdoContactors: PanelDevice[] = [];
  for (const group of groups) {
    for (let index = group.length - 1; index >= 0; index--) {
      const breaker = group[index];
      const circuit = breaker.circuitId ? byId.get(breaker.circuitId) : undefined;
      if (!circuit?.hdo || (breaker.category !== "MCB" && breaker.category !== "RCBO")) continue;
      const choice = hdoContactorFor(circuit.phases, circuit.protection.ratedA);
      if (!choice) {
        warnings.push(`${circuit.label}: stykač HDO pro jistič ${circuit.protection.ratedA} A navrhne projektant (nad 63 A).`);
        continue;
      }
      const contactor: PanelDevice = {
        ...device("KM", hdoContactorLabel(circuit.label), "CONTACTOR", choice.poles, choice.modules, choice.ratedA, config({ category: "CONTACTOR", poles: choice.poles, modules: choice.modules, ratedCurrentA: choice.ratedA, contactConfig: choice.contactConfig, coilVoltage: "230V AC", manufacturer: choice.manufacturer }), null, breaker.phase),
        parentKey: breaker.key,
        ...(choice.articleNumber ? { article: { manufacturer: choice.manufacturer, series: choice.series, typeCode: choice.typeCode, articleNumber: choice.articleNumber, description: `Instalační stykač ${choice.ratedA} A, ${choice.contactConfig}, cívka 230 V AC`, catalogArticle: choice.articleNumber, powerLossW: null } } : {}),
      };
      contactor.key = `hdo:${circuit.id}`;
      group.splice(index + 1, 0, contactor);
      hdoContactors.push(contactor);
    }
  }

  // Ovládání světel: impulzní relé a chytrá instalace
  const relays = plan.io.impulseRelays;
  const control: PanelDevice[] = Array.from({ length: relays }, () => device("KA", "Impulzní paměťové relé (např. ELKO MR-41)", "RELAY", "1P", 1, 16, config({ category: "RELAY", poles: "1P", modules: 1, ratedCurrentA: 16, relaySubtype: "IMPULSE" })));
  if (options.mode === "bus_loxone" && options.smart?.length) {
    for (const unit of options.smart) {
      // Systémový modul bez šířky (nástěnný SysAP) jde do kusovníku, ne na lištu
      if (unit.modules <= 0) {
        addBom(bom, `${unit.label} – ${unit.manufacturer} ${unit.typeCode}${unit.articleNumber ? ` (${unit.articleNumber})` : ""}`);
        continue;
      }
      control.push(smartDevice(unit, unit.role === "psu" || unit.role === "psu_led"));
    }
  } else if (options.mode === "bus_loxone" && (plan.io.do > 0 || plan.io.treeDevices > 0)) {
    const mini = SMART_MODULES.loxoneMiniserver;
    control.push(device("A", mini.label, "PLC", "1P", mini.modules, null, config({ category: "OTHER", poles: "1P", modules: mini.modules, moduleSubtype: "PLC" })));
    for (let i = 0; i < Math.ceil(Math.max(0, plan.io.do - mini.outputs) / SMART_MODULES.loxoneRelayExtension.outputs); i++) {
      control.push(device("A", SMART_MODULES.loxoneRelayExtension.label, "PLC", "1P", SMART_MODULES.loxoneRelayExtension.modules, null, config({ category: "OTHER", poles: "1P", modules: SMART_MODULES.loxoneRelayExtension.modules, moduleSubtype: "PLC" })));
    }
    if (plan.io.treeDevices > SMART_MODULES.loxoneTreeExtension.treePerBranch * 2) {
      control.push(device("A", SMART_MODULES.loxoneTreeExtension.label, "PLC", "1P", SMART_MODULES.loxoneTreeExtension.modules, null, config({ category: "OTHER", poles: "1P", modules: 2, moduleSubtype: "PLC" })));
    }
    control.push(device("T", SMART_MODULES.psu24.label, "PSU", "1P", SMART_MODULES.psu24.modules, null, config({ category: "OTHER", poles: "1P", modules: SMART_MODULES.psu24.modules, moduleSubtype: "PSU_DC", power: "60W/24V" })));
  }
  // Fáze 77: moduly k prvkům půdorysu (klasická instalace) – na lištu s přesným katalogovým zápisem, bez šířky do kusovníku
  for (const unit of options.devices ?? []) {
    if (unit.modules <= 0) {
      addBom(bom, `${unit.label}${unit.typeCode ? ` – ${unit.typeCode}` : ""}`);
      continue;
    }
    control.push(smartDevice(unit, unit.role === "psu_led"));
  }
  if (options.mode === "smart_relay" && (plan.io.do > 0 || plan.io.di > 0)) {
    const shelly = SMART_MODULES.shellyPro4pm;
    const count = Math.ceil(Math.max(plan.io.do / shelly.outputs, plan.io.di / shelly.inputs));
    for (let i = 0; i < count; i++) control.push(device("A", shelly.label, "PLC", "1P", shelly.modules, null, config({ category: "OTHER", poles: "1P", modules: shelly.modules, moduleSubtype: "PLC" })));
  }
  // Fáze 52: synergický energetický management (FVE + TČ + EV, čl. 10 ČSN 33 2130 ed. 4)
  const tags = new Set(plan.circuits.map((circuit) => circuit.tag).filter(Boolean));
  if (tags.has("pv_inverter") && tags.has("heat_pump")) {
    control.push(device("KA", "SG Ready bezpotenciálové relé (FVE → TČ)", "RELAY", "1P", 1, 16, config({ category: "RELAY", poles: "1P", modules: 1, ratedCurrentA: 16, relaySubtype: "AUXILIARY" })));
  }
  if (tags.has("ev_charger") && (tags.has("pv_inverter") || tags.has("heat_pump"))) {
    control.push(device("P", "Elektroměr 3f pro dynamické řízení zátěže (DLM) wallboxu", "OTHER", "3P+N", 4, null, config({ category: "OTHER", poles: "3P+N", modules: 4, moduleSubtype: "METER" })));
    addBom(bom, "Měřicí transformátory proudu pro DLM (3×) / přímé měření do 65 A");
  }
  if (options.centralStop) {
    control.push(device("S", "Tlačítko TOTAL STOP / CENTRAL STOP", "OTHER", "1P", 1, null, config({ category: "OTHER", poles: "1P", modules: 1 })));
    addBom(bom, "Vypínací spoušť hlavního vypínače (pro TOTAL STOP)");
  }
  // Fáze 112: ovládací jistič B6 cívek stykačů HDO (L přes kontakt přijímače HDO na A1, A2 na N)
  const hdoSupply = hdoContactors.length ? tree(device("F", HDO_CONTROL.label, "MCB", "1P", 1, HDO_CONTROL.ratedA, config({ category: "MCB", poles: "1P", modules: 1, ratedCurrentA: HDO_CONTROL.ratedA, curve: HDO_CONTROL.curve, breakingCapacityKa: 6 }), null, "L1"), "hdo-control", "main") : null;
  if (hdoSupply) {
    for (const contactor of hdoContactors) contactor.config = { ...contactor.config, hdoControl: hdoSupply.designation };
    addBom(bom, "Přívod ovládání HDO z přijímače HDO v elektroměrovém rozváděči (CYKY-J 3×1,5 / 1×1,5 H07V-K)");
  }
  if (control.length) {
    // Fáze 60: řídicí obvody (zdroj sběrnice, moduly, relé SG Ready, TOTAL STOP) z vlastního jističe; impulzní relé
    // spíná světelný okruh, elektroměr DLM je za hlavním vypínačem
    const lighting = plan.circuits.find((circuit) => circuit.kind === "lighting");
    const needsSupply = control.some((item) => !(item.category === "RELAY" && item.config.relaySubtype === "IMPULSE") && item.config.moduleSubtype !== "METER");
    const supply = needsSupply ? tree(device("F", "Ovládání a řídicí obvody", "MCB", "1P", 1, 6, config({ category: "MCB", poles: "1P", modules: 1, ratedCurrentA: 6, curve: "B", breakingCapacityKa: 6 }), null, "L1"), "control", "main") : null;
    const parented = control.map((item) =>
      item.category === "RELAY" && item.config.relaySubtype === "IMPULSE" ? { ...item, parentKey: lighting ? `circuit:${lighting.id}` : supply ? "control" : "main" } : item.config.moduleSubtype === "METER" ? { ...item, parentKey: "main" } : { ...item, parentKey: supply ? "control" : "main" },
    );
    const controlGroup = supply ? [supply, ...parented] : parented;
    groups.push(controlGroup);
    controlRef = controlGroup;
    // Fáze 81: akční členy chytré domácnosti na vyhrazené liště (začínají na nové řadě rozváděče)
    if (options.mode === "bus_loxone" && options.smart?.some((unit) => unit.modules > 0)) ownRail.add(controlGroup);
  }
  // Fáze 112: ovládání HDO je silnoproudé (230 V) – vlastní skupina v silnoproudé části, ne mezi slaboproudem
  if (hdoSupply) groups.push([hdoSupply]);

  const devices = groups.flat();
  const totalModules = devices.reduce((sum, item) => sum + item.modules, 0);
  const requiredModules = Math.ceil(totalModules * (1 + MODULE_RESERVE));
  const totalPowerLossW = Math.round(devices.reduce((sum, item) => sum + item.powerLossW, 0) * 100) / 100;

  // Fáze 111: skupiny pro komprimaci lišt – chránič s jističi a hlavní vypínač se svodičem se nedělí, jističochrániče,
  // samostatné jističe a přívody vyplní mezery; řídicí obvody s PLC / zdrojem = slaboproud (pravé pole, spodní lišty,
  // RH2) s jističem řídicích obvodů na začátku (u dvou rozváděčů zůstává v RH1 jako přívod RH2)
  const lowDevice = (item: PanelDevice) => item.category === "PLC" || item.category === "PSU";
  const packGroups: PackGroup<PanelDevice>[] = groups.map((group) => {
    const low = group === controlRef && group.some(lowDevice);
    // Řídicí obvody (jistič, relé, elektroměr DLM, moduly) jsou funkční celek – pohromadě na liště
    return { devices: group, keepTogether: keep.has(group) || group === controlRef, low, ownRail: ownRail.has(group), powerLead: low && group[0]?.key === "control" ? 1 : 0 };
  });
  /** Lišty pod sebou: s rezervou ~15 % lišty, když se do řad skříně nevejdou, tak bez rezervy. */
  const singleRails = (capacity: number, rows = Infinity) => {
    const roomy = packRails(packGroups, capacity);
    return roomy.length <= rows ? roomy : packRails(packGroups, capacity, { reserve: false });
  };
  const toRails = (list: readonly { capacity: number; devices: PanelDevice[]; used: number }[]) => list.map((rail, index) => ({ index: index + 1, capacity: rail.capacity, devices: rail.devices, used: rail.used }));
  const lossOf = (list: readonly PanelDevice[]) => Math.round(list.reduce((sum, item) => sum + item.powerLossW, 0) * 100) / 100;

  // Skříň: pojme moduly + 25 % rezervu, rozložení skupin na její řady a ztráty ≤ P_max; nejmenší vyhovující
  const fits = (enclosure: EnclosureLike) => {
    if (enclosure.totalModules < requiredModules || enclosure.pMaxW === null || totalPowerLossW > enclosure.pMaxW) return false;
    return singleRails(enclosure.modulesPerRow, enclosure.rows).length <= enclosure.rows;
  };
  let enclosure: EnclosureLike | null = null;
  let rails: Switchboard["rails"];
  let layout: RailLayout = SINGLE_LAYOUT;
  let second: Switchboard["second"] = null;
  let boardDevices = devices;
  const concept = options.layout;
  if (concept === "two_boards") {
    // Fáze 111: RH1 silnoproud + RH2 slaboproud / Smart Home – každý s vlastní skříní (12M nebo 18M lišty)
    const boards = planTwoBoards(packGroups, options.enclosures, options.manufacturer ?? null);
    const main = (options.enclosureId ? boards.main.matches.find((match) => match.enclosure.id === options.enclosureId) : null) ?? boards.main.matches[0] ?? null;
    enclosure = main?.enclosure ?? null;
    // Fáze 114: zvolená větší rozvodnice z průvodce – tolik DIN lišt, kolik má řad
    rails = toRails(options.fillRows && enclosure ? fillRailsToEnclosure(boards.main.rails, SINGLE_LAYOUT, enclosure).rails : boards.main.rails);
    boardDevices = rails.flatMap((rail) => rail.devices);
    layout = { ...SINGLE_LAYOUT, concept };
    if (!enclosure) warnings.push(`RH1: žádná skříň z databáze nepojme ${boards.main.rails.length} × ${boards.main.rails[0]?.capacity ?? 12} M – vyberte skříň ručně.`);
    if (boards.second) {
      const pick = (options.secondEnclosureId ? boards.second.matches.find((match) => match.enclosure.id === options.secondEnclosureId) : null) ?? boards.second.matches[0] ?? null;
      const secondRails = toRails(options.fillRows && pick ? fillRailsToEnclosure(boards.second.rails, SINGLE_LAYOUT, pick.enclosure).rails : boards.second.rails);
      const secondDevices = secondRails.flatMap((rail) => rail.devices);
      second = { rails: secondRails, devices: secondDevices, enclosure: pick?.enclosure ?? null, totalPowerLossW: lossOf(secondDevices) };
      if (!pick) warnings.push(`RH2: žádná skříň z databáze nepojme ${boards.second.rails.length} × ${boards.second.rails[0]?.capacity ?? 12} M – vyberte skříň ručně.`);
    }
  } else if (concept) {
    const plan = planLayout(packGroups, concept);
    const need = layoutNeed(plan.rails as PlannedRail<PanelDevice>[], plan.layout.fields, totalPowerLossW);
    const exactWidth = concept !== "two_field";
    const chosen = options.enclosureId ? (options.enclosures.find((row) => row.id === options.enclosureId && fitsLayout(row, need, { exactWidth })) ?? null) : null;
    enclosure = chosen ?? matchLayoutEnclosures(options.enclosures, need, { manufacturer: options.manufacturer, exactWidth, limit: 1 })[0]?.enclosure ?? null;
    // Fáze 114: větší rozvodnice s rezervou z průvodce – prázdné DIN lišty do řad skříně
    const filled = options.fillRows && enclosure ? fillRailsToEnclosure(plan.rails as PlannedRail<PanelDevice>[], plan.layout, enclosure) : { rails: plan.rails as PlannedRail<PanelDevice>[], layout: plan.layout };
    rails = toRails(filled.rails);
    layout = filled.layout;
    if (!enclosure) warnings.push(`Žádná skříň z databáze nepojme uspořádání „${CONCEPT_INFO[concept].short}“ (${need.fields === 2 ? `2 pole × ${need.rows} řad` : `${need.rows} řad`} po ${need.fieldWidth} M, ${need.requiredModules} M s rezervou 25 %) – zvolte jinou koncepci nebo skříň ručně.`);
  } else {
    enclosure = [...options.enclosures].filter(fits).sort((a, b) => a.totalModules - b.totalModules || (a.pMaxW ?? 0) - (b.pMaxW ?? 0) || a.model.localeCompare(b.model))[0] ?? null;
    if (enclosure) rails = toRails(singleRails(enclosure.modulesPerRow, enclosure.rows));
    else {
      // Fáze 111: nevejde se do skříně s lištami pod sebou → dvoupolová skříň / široké či kompaktní lišty z databáze
      const option = layoutOptions(packGroups, options.enclosures, { manufacturer: options.manufacturer, limit: 1 })
        .filter((candidate) => candidate.concept !== "two_boards" && candidate.available)
        .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.main.matches[0].enclosure.totalModules - b.main.matches[0].enclosure.totalModules)[0];
      if (option) {
        enclosure = option.main.matches[0].enclosure;
        rails = toRails(option.plan.rails);
        layout = option.plan.layout;
        warnings.push(`Lišty pod sebou se nevejdou do žádné skříně – zvoleno uspořádání „${CONCEPT_INFO[option.concept].short}“ se skříní ${enclosure.manufacturer} ${enclosure.model} (změníte v „📐 Uspořádání skříně a lišt“).`);
      } else {
        warnings.push(`Žádná skříň z databáze nepojme ${requiredModules} M (${totalModules} M + 25 % rezerva) se ztrátami ${String(totalPowerLossW).replace(".", ",")} W – vyberte skříň ručně.`);
        rails = toRails(singleRails(options.railModules ?? 12));
      }
    }
  }

  const spread = Math.max(load.L1, load.L2, load.L3) - Math.min(load.L1, load.L2, load.L3);
  // Fáze 55: u 1f přívodu je vše na L1 – nesymetrie se nehodnotí
  if (!single && spread > 3680) warnings.push(`Nesymetrie fází ${spread} W – zvažte přesun spotřebičů.`);

  return {
    devices: boardDevices,
    rails,
    layout,
    second,
    packGroups,
    phaseLoadW: load,
    phaseOf,
    rcdGroups,
    bom: [...bom.entries()].map(([item, count]) => ({ item, count })),
    totalModules,
    requiredModules,
    totalPowerLossW,
    enclosure,
    warnings,
  };
}
