// Most „půdorys → rozváděč“ (fáze 44): deterministický výpočetní modul, který z 2D půdorysu domovní
// elektroinstalace (zásuvky, světla, spotřebiče, ovládací místa) vytvoří okruhy dle ČSN 33 2130 ed. 4,
// rozdělí je na fáze a pod proudové chrániče, sestaví přístroje na DIN lišty a vybere skříň rozváděče.
// Čisté funkce bez Prismy a bez UI – specifikace v FLOORPLAN_SPEC.md, testy v floorplan-bridge.test.ts.

import type { ComponentCategory } from "@/generated/prisma/enums";
import { estimatePowerLoss } from "@/lib/panel-builder/catalog";
import type { ItemConfig } from "@/lib/panel-builder/configurator";
import type { EnclosureLike } from "@/lib/panel-builder/enclosures";

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

export type NodeKind = "single_socket" | "double_socket" | "light" | "switch" | "appliance" | "data_socket";

/** Upřesnění prvku (fáze 49): zásuvka nad linkou, IP44, nástěnné svítidlo, tlačítko. */
export type NodeVariant = "worktop" | "ip44" | "wall" | "button";

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
/** Max. úbytek napětí: světelné obvody 3 %, ostatní (zásuvky, spotřebiče) 5 %. */
export const VOLTAGE_DROP_LIMIT = { lighting: 3, other: 5 } as const;

/** Úbytek napětí v % (1f: 2·L·I·ρ/S/230, 3f: √3·L·I·ρ/S/400). */
export function voltageDropPercent(input: { lengthMm: number; currentA: number; crossSectionMm2: number; phases: 1 | 3 }): number {
  const meters = input.lengthMm / 1000;
  const volts = input.phases === 3 ? (Math.sqrt(3) * meters * input.currentA * COPPER_RESISTIVITY) / input.crossSectionMm2 : (2 * meters * input.currentA * COPPER_RESISTIVITY) / input.crossSectionMm2;
  return Math.round((volts / (input.phases === 3 ? 400 : 230)) * 10000) / 100;
}

// ===========================================================================
//  2. Ovládání světel – matice řazení vypínačů
// ===========================================================================

export type InstallMode = "classic" | "smart_relay" | "bus_loxone";

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
  // Klasická instalace
  const wall = (name: string, razeni: string, count: number): WiringItem => ({ place: "wall", name, razeni, count });
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

export type ApplianceTag = "oven" | "dishwasher" | "washer" | "dryer" | "boiler" | "microwave_builtin" | "cooktop_3p" | "fridge" | "ev_charger" | "heat_pump";

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
};

/** Spotřebiče s vlastním 1f okruhem B16A (od 2 000 W, mikrovlnka jen vestavná ≥ 2 000 W). */
const DEDICATED_1P = new Set<ApplianceTag>(["oven", "dishwasher", "washer", "dryer", "boiler", "microwave_builtin"]);
const DEDICATED_MIN_W = 2000;
/** Max. zásuvkových vývodů na okruh (dvojzásuvka = 1 vývod). */
export const MAX_OUTLETS_PER_CIRCUIT = 10;
/** Max. světelných bodů na světelný okruh. */
export const MAX_LIGHTS_PER_CIRCUIT = 10;
const LIGHT_POWER_W = 60;
const OUTLET_POWER_W = 200;
const SOCKET_SIMULTANEITY = 0.3;
const LIGHT_SIMULTANEITY = 0.8;

export type CircuitKind = "lighting" | "sockets" | "dedicated" | "cooktop" | "fridge" | "three_phase_rcd_b";

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
  /** Zásuvkové vývody (dvojzásuvka = 1). */
  outlets: number;
  /** Instalovaný a soudobý příkon [W]. */
  installedW: number;
  designW: number;
  /** Nejdelší kabel okruhu [mm] a úbytek napětí při In [%]. */
  lengthMm: number;
  voltageDropPct: number;
  /** Pod jakou proudovou ochranu okruh patří: společný chránič 30 mA typ A, vlastní typ B, nebo vlastní RCBO. */
  rcd: "A30" | "B30" | "own";
}

export interface BomItem {
  item: string;
  count: number;
}

export interface Room {
  id: string;
  name: string;
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
export function generateCircuitsFromFloorplan(plan: Floorplan, calibration: Calibration): CircuitPlan {
  const warnings: string[] = [];
  const bom = new Map<string, number>();
  const circuits: Circuit[] = [];
  const roomName = new Map(plan.rooms.map((room) => [room.id, room.name]));
  const roomOrder = new Map(plan.rooms.map((room, index) => [room.id, index]));
  const length = (node: FloorNode) => calibration.calculateCableLength(node);
  const counters = new Map<CircuitKind, number>();
  const nextId = (kind: CircuitKind) => {
    const value = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, value);
    return `${kind}-${value}`;
  };

  /** Úbytek napětí při In; při překročení limitu větší průřez (max. 2 kroky). */
  function sized(phases: 1 | 3, ratedA: number, startMm2: number, lengthMm: number, limit: number, label: string) {
    let mm2 = startMm2;
    let drop = voltageDropPercent({ lengthMm, currentA: ratedA, crossSectionMm2: mm2, phases });
    for (let step = 0; step < 2 && drop > limit; step++) {
      mm2 = nextSize(mm2);
      drop = voltageDropPercent({ lengthMm, currentA: ratedA, crossSectionMm2: mm2, phases });
    }
    if (mm2 !== startMm2) warnings.push(`${label}: úbytek napětí nad ${limit} % – průřez zvětšen na ${String(mm2).replace(".", ",")} mm².`);
    if (drop > limit) warnings.push(`${label}: úbytek napětí ${String(drop).replace(".", ",")} % překračuje ${limit} % i po zvětšení průřezu – zkraťte trasu.`);
    return { mm2, drop };
  }

  function push(base: Omit<Circuit, "id" | "cable" | "crossSectionMm2" | "voltageDropPct" | "lengthMm">, nodes: readonly FloorNode[], startMm2: number) {
    const lengthMm = Math.max(0, ...nodes.map(length));
    const limit = base.kind === "lighting" ? VOLTAGE_DROP_LIMIT.lighting : VOLTAGE_DROP_LIMIT.other;
    const { mm2, drop } = sized(base.phases, base.protection.ratedA, startMm2, lengthMm, limit, base.label);
    circuits.push({ ...base, id: nextId(base.kind), cable: cableFor(base.phases, mm2), crossSectionMm2: mm2, lengthMm, voltageDropPct: drop });
  }

  const sockets: FloorNode[] = [];
  const lights: FloorNode[] = [];
  for (const node of plan.nodes) {
    const tag = node.tag;
    const appliance = tag ? APPLIANCES[tag] : null;
    const powerW = node.powerW ?? appliance?.powerW ?? 0;
    const room = roomName.get(node.room) ?? node.room;
    if (node.kind === "single_socket") addBom(bom, "Zásuvka jednonásobná 230 V / 16 A");
    if (node.kind === "double_socket") addBom(bom, "Zásuvka dvojnásobná (dvojzásuvka) 230 V / 16 A");
    if (node.kind === "light") addBom(bom, "Svítidlový vývod (stropní)");
    if (node.kind === "light") {
      lights.push(node);
      continue;
    }
    if (node.kind === "switch") continue; // spínače vyplývají z ovládání místností (bod 2)
    if (node.kind === "data_socket") {
      // Datová zásuvka RJ45 = slaboproud (UTP Cat6 z rozváděče / racku), žádný silový okruh
      addBom(bom, "Datová zásuvka RJ45 (UTP Cat6)");
      continue;
    }

    if (tag && DEDICATED_1P.has(tag) && powerW >= DEDICATED_MIN_W) {
      push(
        { label: `${appliance!.label} – ${room}`, kind: "dedicated", phases: 1, protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 16 }, rooms: [node.room], nodeIds: [node.id], outlets: 1, installedW: powerW, designW: powerW * appliance!.simultaneity, rcd: "A30" },
        [node],
        2.5,
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
    if (tag === "ev_charger" || tag === "heat_pump") {
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
        },
        [node],
        threePhaseSection(ratedA),
      );
      continue;
    }
    // Běžná zásuvka (i spotřebič se štítkem pod 2 000 W)
    if (node.kind === "single_socket" || node.kind === "double_socket" || node.kind === "appliance") sockets.push(node);
  }

  // Běžné zásuvky: místnosti od rozváděče nejbližší, uvnitř místnosti podle vzdálenosti; místnost se nedělí, pokud se vejde
  const byRoom = (nodes: readonly FloorNode[]) => {
    const groups = new Map<string, FloorNode[]>();
    for (const node of [...nodes].sort((a, b) => length(a) - length(b))) groups.set(node.room, [...(groups.get(node.room) ?? []), node]);
    return [...groups.entries()].sort((a, b) => Math.min(...a[1].map(length)) - Math.min(...b[1].map(length)) || (roomOrder.get(a[0]) ?? 0) - (roomOrder.get(b[0]) ?? 0));
  };
  const socketGroups: FloorNode[][] = [];
  for (const [, nodes] of byRoom(sockets)) {
    let current = socketGroups[socketGroups.length - 1];
    if (!current || current.length + nodes.length > MAX_OUTLETS_PER_CIRCUIT) {
      current = [];
      socketGroups.push(current);
    }
    for (const node of nodes) {
      if (current.length >= MAX_OUTLETS_PER_CIRCUIT) {
        current = [];
        socketGroups.push(current);
      }
      current.push(node);
    }
  }
  for (const group of socketGroups) {
    const rooms = [...new Set(group.map((node) => node.room))];
    const installedW = group.reduce((sum, node) => sum + (node.powerW ?? OUTLET_POWER_W), 0);
    push(
      {
        label: `Zásuvky – ${rooms.map((room) => roomName.get(room) ?? room).join(", ")}`,
        kind: "sockets",
        phases: 1,
        protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 16 },
        rooms,
        nodeIds: group.map((node) => node.id),
        outlets: group.length,
        installedW,
        designW: Math.min(installedW * SOCKET_SIMULTANEITY + OUTLET_POWER_W, 3680),
        rcd: "A30",
      },
      group,
      2.5,
    );
  }

  // Světla: místnosti střídavě do min. 2 nezávislých okruhů, max. 10 bodů na okruh
  const lightRooms = byRoom(lights);
  const lightCount = Math.max(2, Math.ceil(lights.length / MAX_LIGHTS_PER_CIRCUIT));
  const lightGroups: FloorNode[][] = Array.from({ length: lightCount }, () => []);
  if (lightRooms.length === 1) lights.forEach((node, index) => lightGroups[index % lightCount].push(node));
  else
    for (const [, nodes] of lightRooms) {
      const target = lightGroups.reduce((best, group) => (group.length < best.length ? group : best), lightGroups[0]);
      target.push(...nodes);
    }
  for (const group of lightGroups.filter((nodes) => nodes.length)) {
    const rooms = [...new Set(group.map((node) => node.room))];
    const installedW = group.reduce((sum, node) => sum + (node.powerW ?? LIGHT_POWER_W), 0);
    push(
      {
        label: `Světla – ${rooms.map((room) => roomName.get(room) ?? room).join(", ")}`,
        kind: "lighting",
        phases: 1,
        protection: { device: "MCB", poles: "1P", curve: "B", ratedA: 10 },
        rooms,
        nodeIds: group.map((node) => node.id),
        outlets: 0,
        installedW,
        designW: installedW * LIGHT_SIMULTANEITY,
        rcd: "A30",
      },
      group,
      1.5,
    );
  }
  if (lights.length && circuits.filter((circuit) => circuit.kind === "lighting").length < 2) warnings.push("Jen jeden světelný bod – druhý nezávislý světelný okruh nelze vytvořit.");

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

  return { circuits, bom: [...bom.entries()].map(([item, count]) => ({ item, count })), switching, io, warnings };
}

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
  phase: Phase | "L1,L2,L3" | null;
  /** Okruh, který přístroj jistí (null = hlavní vypínač, SPD, chránič, svorkovnice, chytré moduly). */
  circuitId: string | null;
}

export interface RcdGroup {
  designation: string;
  type: "A" | "B";
  circuitIds: string[];
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

/**
 * Okruhy pod chrániče 30 mA typ A: nejvýš 6 na chránič a světla a zásuvky stejné místnosti nikdy na
 * stejném chrániči (výpadek jednoho chrániče nezhasne místnost i bez zásuvek). Světelné okruhy se
 * rozkládají na různé chrániče. EV / TČ dostanou každý vlastní chránič typ B.
 */
export function groupUnderRcds(circuits: readonly Circuit[]): RcdGroup[] {
  const shared = circuits.filter((circuit) => circuit.rcd === "A30");
  const order: Record<CircuitKind, number> = { lighting: 0, sockets: 1, dedicated: 2, cooktop: 3, fridge: 9, three_phase_rcd_b: 9 };
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
  const result: RcdGroup[] = groups.filter((group) => group.circuits.length).map((group, index) => ({ designation: `-FI${index + 1}`, type: "A", circuitIds: group.circuits.map((c) => c.id) }));
  for (const circuit of circuits.filter((c) => c.rcd === "B30")) result.push({ designation: `-FI${result.length + 1}`, type: "B", circuitIds: [circuit.id] });
  return result;
}

const config = (partial: Partial<ItemConfig> & Pick<ItemConfig, "category" | "poles" | "modules">): ItemConfig => ({ manufacturer: null, ratedCurrentA: null, ...partial });

/** Přístroje rozváděče, rozložení na lišty (skupina chrániče se nedělí), 25% rezerva a výběr skříně. */
export function buildSwitchboardFromCircuits(
  plan: Pick<CircuitPlan, "circuits" | "io" | "bom">,
  options: { mode: InstallMode; enclosures: readonly EnclosureLike[]; mainSwitchA?: number; railModules?: number },
): Switchboard {
  const warnings: string[] = [];
  const bom = new Map(plan.bom.map((entry) => [entry.item, entry.count]));
  const { phaseOf, load } = balancePhases(plan.circuits);
  const rcdGroups = groupUnderRcds(plan.circuits);
  const byId = new Map(plan.circuits.map((circuit) => [circuit.id, circuit]));
  const counters = new Map<string, number>();
  const designation = (prefix: string) => {
    const value = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, value);
    return `-${prefix}${value}`;
  };
  const device = (prefix: string, label: string, category: ComponentCategory, poles: string, modules: number, ratedA: number | null, cfg: ItemConfig, circuitId: string | null = null, phase: PanelDevice["phase"] = null): PanelDevice => ({
    designation: designation(prefix),
    label,
    category,
    poles,
    modules,
    ratedA,
    config: cfg,
    powerLossW: estimatePowerLoss(category, poles, ratedA ?? 0),
    phase,
    circuitId,
  });

  /** Skupiny přístrojů (na liště se nedělí). */
  const groups: PanelDevice[][] = [];
  const mainA = options.mainSwitchA ?? 40;
  groups.push([
    device("Q", "Hlavní vypínač", "MAIN_SWITCH", "3P", 3, mainA, config({ category: "MAIN_SWITCH", poles: "3P", modules: 3, ratedCurrentA: mainA }), null, "L1,L2,L3"),
    device("FV", "Svodič přepětí T1+T2", "SPD", "3P+N", 4, null, config({ category: "SPD", poles: "3P+N", modules: 4, spdType: "T1+T2", surgeCurrentKa: 25 }), null, "L1,L2,L3"),
    device("X", "Rozbočovací svorkovnice (HLAK)", "TERMINAL", "4P", 4, null, config({ category: "ACCESSORY", poles: "4P", modules: 4, moduleSubtype: "TERMINAL_BLOCK" })),
  ]);

  const mcb = (circuit: Circuit) => {
    const { protection } = circuit;
    if (protection.device === "RCBO") {
      return device("FA", circuit.label, "RCBO", "1P+N", 2, protection.ratedA, config({ category: "RCBO", poles: "1P+N", modules: 2, ratedCurrentA: protection.ratedA, curve: protection.curve, rcdType: protection.rcd?.type ?? "A", rcdSensitivityMa: protection.rcd?.sensitivityMa ?? 30 }), circuit.id, phaseOf[circuit.id] ?? null);
    }
    const modules = protection.poles === "3P" ? 3 : 1;
    return device("F", circuit.label, "MCB", protection.poles, modules, protection.ratedA, config({ category: "MCB", poles: protection.poles, modules, ratedCurrentA: protection.ratedA, curve: protection.curve, breakingCapacityKa: 6 }), circuit.id, phaseOf[circuit.id] ?? null);
  };

  for (const group of rcdGroups) {
    const circuits = group.circuitIds.map((id) => byId.get(id)!);
    const ratedA = 40;
    const rcd: PanelDevice = { ...device("FI", `Proudový chránič 30 mA typ ${group.type}`, "RCD", "4P", 4, ratedA, config({ category: "RCD", poles: "4P", modules: 4, ratedCurrentA: ratedA, rcdType: group.type, rcdSensitivityMa: 30 }), null, "L1,L2,L3") };
    rcd.designation = group.designation;
    groups.push([rcd, ...circuits.map(mcb)]);
    addBom(bom, "Izolovaný N-můstek (pod chránič)");
    addBom(bom, "Hřebenová propojovací lišta 3P (pod chránič)");
  }
  const own = plan.circuits.filter((circuit) => circuit.rcd === "own");
  if (own.length) groups.push(own.map(mcb));

  // Ovládání světel: impulzní relé a chytrá instalace
  const relays = plan.io.impulseRelays;
  const control: PanelDevice[] = Array.from({ length: relays }, () => device("KA", "Impulzní paměťové relé (např. ELKO MR-41)", "RELAY", "1P", 1, 16, config({ category: "RELAY", poles: "1P", modules: 1, ratedCurrentA: 16, relaySubtype: "IMPULSE" })));
  if (options.mode === "bus_loxone" && (plan.io.do > 0 || plan.io.treeDevices > 0)) {
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
  if (options.mode === "smart_relay" && (plan.io.do > 0 || plan.io.di > 0)) {
    const shelly = SMART_MODULES.shellyPro4pm;
    const count = Math.ceil(Math.max(plan.io.do / shelly.outputs, plan.io.di / shelly.inputs));
    for (let i = 0; i < count; i++) control.push(device("A", shelly.label, "PLC", "1P", shelly.modules, null, config({ category: "OTHER", poles: "1P", modules: shelly.modules, moduleSubtype: "PLC" })));
  }
  if (control.length) groups.push(control);

  const devices = groups.flat();
  const totalModules = devices.reduce((sum, item) => sum + item.modules, 0);
  const requiredModules = Math.ceil(totalModules * (1 + MODULE_RESERVE));
  const totalPowerLossW = Math.round(devices.reduce((sum, item) => sum + item.powerLossW, 0) * 100) / 100;

  /** Rozložení skupin na lišty dané šířky (skupina širší než lišta se rozdělí). */
  const layout = (capacity: number) => {
    const rails: { index: number; capacity: number; devices: PanelDevice[]; used: number }[] = [];
    const open = () => rails.push({ index: rails.length + 1, capacity, devices: [], used: 0 });
    open();
    for (const group of groups) {
      const width = group.reduce((sum, item) => sum + item.modules, 0);
      let rail = rails[rails.length - 1];
      if (rail.used + width > capacity && width <= capacity) {
        open();
        rail = rails[rails.length - 1];
      }
      for (const item of group) {
        rail = rails[rails.length - 1];
        if (rail.used + item.modules > capacity) {
          open();
          rail = rails[rails.length - 1];
        }
        rail.devices.push(item);
        rail.used += item.modules;
      }
    }
    return rails;
  };

  // Skříň: pojme moduly + 25 % rezervu, rozložení skupin na její řady a ztráty ≤ P_max; nejmenší vyhovující
  const fits = (enclosure: EnclosureLike) => {
    if (enclosure.totalModules < requiredModules || enclosure.pMaxW === null || totalPowerLossW > enclosure.pMaxW) return false;
    return layout(enclosure.modulesPerRow).length <= enclosure.rows;
  };
  const enclosure = [...options.enclosures].filter(fits).sort((a, b) => a.totalModules - b.totalModules || (a.pMaxW ?? 0) - (b.pMaxW ?? 0) || a.model.localeCompare(b.model))[0] ?? null;
  if (!enclosure) warnings.push(`Žádná skříň z databáze nepojme ${requiredModules} M (${totalModules} M + 25 % rezerva) se ztrátami ${String(totalPowerLossW).replace(".", ",")} W – vyberte skříň ručně.`);
  const rails = layout(enclosure?.modulesPerRow ?? options.railModules ?? 12);

  const spread = Math.max(load.L1, load.L2, load.L3) - Math.min(load.L1, load.L2, load.L3);
  if (spread > 3680) warnings.push(`Nesymetrie fází ${spread} W – zvažte přesun spotřebičů.`);

  return {
    devices,
    rails,
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
