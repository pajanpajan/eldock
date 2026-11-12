// 3D výpočet kabeláže (fáze 49): trasy okruhů jako řetěz rozváděč → nejbližší prvek → další prvek,
// tři režimy vedení (spodem v podlaze, vrchem v podhledu, optimalizovaně po okruzích), rezervy,
// rozpis metráže podle typu kabelu a úbytek napětí na nejdelší větvi. Čisté funkce bez UI.

import { lightingTopology, routeBreakdown, type LightingBreakdown, type LightingPart, type SwitchNo } from "./lighting-topology";
import { optimalOrder, pathCost } from "./route-order";
import { polylineLength, reanchor } from "./route-geometry";
import {
  DEFAULT_ELEVATION,
  VOLTAGE_DROP_LIMIT,
  manhattan,
  panelVertical,
  voltageDropPercent,
  type CableRoutingMode,
  type Circuit,
  type ElevationProfile,
  type InstallMode,
} from "./floorplan-bridge";

/** Bod trasy v mm půdorysu; `floor` = podlaží (fáze 59), bez něj jediné podlaží. */
export interface RoutePoint {
  x: number;
  y: number;
  floor?: string;
}

/** Prvek trasy v mm půdorysu (osa krabice). */
export interface RouteNode extends RoutePoint {
  id: string;
  heightMm: number;
  room: string;
  /** Společný vícenásobný rámeček – propojení přímo v krabici. */
  frame?: string;
  /** Fáze 74: rozváděč prvku (hlavní `RH` / podružný `RP1` …) – datové a ovládací vedení vedou z něj. */
  board?: string;
}

/** Fáze 74: klíč výchozího bodu tras rozváděče v ručních úpravách („panel“ = hlavní, „panel-RP1“ = podružný). */
export const panelKey = (board?: string | null) => (!board || board === "RH" ? "panel" : `panel-${board}`);
/** Kód rozváděče z klíče výchozího bodu („panel“ → RH, „panel-RP1“ → RP1); jiný klíč (prvek) = null. */
export const boardOfPanelKey = (key: string) => (key === "panel" ? "RH" : key.startsWith("panel-") ? key.slice(6) : null);

export interface RouteSegment {
  from: string | "panel";
  to: string;
  horizontalMm: number;
  verticalMm: number;
  /** Přímé vodorovné propojení ve zdi ve stejné výšce (zásuvky nad linkou). */
  wall: boolean;
  /** Fáze 59: lomená čára trasy pro výkres (body s podlažím) – doplní `summarizeCabling` pro zvolený režim. */
  points?: RoutePoint[];
  /** Fáze 63: úsek s ručně upravenou trasou (délka z upravené lomené čáry). */
  edited?: boolean;
  /** Fáze 76: lomená čára už leží v obvodové dráze místnosti – výkres ji neodsazuje od stěn. */
  final?: boolean;
}

/** Fáze 76: úsek stromu trasy okruhu (obvodový router) – rozváděč („panel“) / prvek → prvek. */
export interface TreeLeg {
  from: string;
  to: string;
  horizontalMm: number;
  points: RoutePoint[];
  /** Lomená čára je už v obvodové dráze (výkres ji neodsazuje). */
  final: boolean;
}

/**
 * Fáze 76: trasování okruhu jako strom (obvodový router 2D půdorysu) – úseky v pořadí od rozváděče (rodič před
 * potomkem); null = řetěz podle `optimalOrder`.
 */
export type CircuitTreeRouter = (nodes: readonly RouteNode[], origin: RoutePoint) => TreeLeg[] | null;

/**
 * Fáze 59: měřidlo tras – vodorovná délka a lomená čára mezi dvěma body. Výchozí je pravoúhlé (Manhattan);
 * `floorMetric` přidá stoupací vedení mezi podlažími, fáze 60 vedení podél stěn.
 */
export interface RouteMetric {
  distance(a: RoutePoint, b: RoutePoint): number;
  path(a: RoutePoint, b: RoutePoint): RoutePoint[];
}

export const MANHATTAN: RouteMetric = {
  distance: manhattan,
  path: (a, b) => [a, { x: b.x, y: a.y, floor: a.floor }, b],
};

/** Podlaží domu s místem stoupacího vedení (průchod kabelů) a výškou podlahy [mm]. */
export interface FloorLink {
  id: string;
  levelMm: number;
  riser: { x: number; y: number };
}

/**
 * Trasa mezi podlažími: na výchozím podlaží k průchodu stoupacího vedení, svisle o rozdíl výšek podlaží a na cílovém
 * podlaží od průchodu k prvku. `bases` = měřidlo vodorovných tras každého podlaží (výchozí pravoúhlé).
 */
export function floorMetric(floors: readonly FloorLink[], bases: ReadonlyMap<string, RouteMetric> = new Map()): RouteMetric {
  const byId = new Map(floors.map((floor) => [floor.id, floor]));
  const base = (floor: string | undefined) => (floor ? bases.get(floor) : undefined) ?? MANHATTAN;
  const across = (a: RoutePoint, b: RoutePoint) => a.floor !== undefined && b.floor !== undefined && a.floor !== b.floor && byId.has(a.floor) && byId.has(b.floor);
  return {
    distance(a, b) {
      if (!across(a, b)) return base(a.floor).distance(a, b);
      const from = byId.get(a.floor!)!;
      const to = byId.get(b.floor!)!;
      return base(from.id).distance(a, { ...from.riser, floor: from.id }) + Math.abs(from.levelMm - to.levelMm) + base(to.id).distance({ ...to.riser, floor: to.id }, b);
    },
    path(a, b) {
      if (!across(a, b)) return base(a.floor).path(a, b);
      const from = byId.get(a.floor!)!;
      const to = byId.get(b.floor!)!;
      return [...base(from.id).path(a, { ...from.riser, floor: from.id }), ...base(to.id).path({ ...to.riser, floor: to.id }, b)];
    },
  };
}

export interface CircuitRoute {
  mode: "BOTTOM" | "TOP";
  segments: RouteSegment[];
  /** Délka bez rezerv [mm]. */
  rawMm: number;
  /** Délka k nákupu: + rezerva % + přídavek v rozváděči + krabice KU68 [mm]. */
  totalMm: number;
  /** Nejdelší větev (rozváděč → poslední prvek řetězu) s rezervou – pro úbytek napětí [mm]. */
  longestMm: number;
  /** Fáze 60: o kolik je optimální pořadí kratší než pořadí, v jakém byly prvky nakresleny [mm, s rezervou]. */
  orderSavingMm?: number;
}

/** Pořadí prvků v řetězu: od rozváděče vždy k nejbližšímu dalšímu prvku. */
export function chainOrder(nodes: readonly RouteNode[], panel: RoutePoint, metric: RouteMetric = MANHATTAN): RouteNode[] {
  const left = [...nodes];
  const order: RouteNode[] = [];
  let at: RoutePoint = panel;
  while (left.length) {
    let best = 0;
    for (let i = 1; i < left.length; i++) {
      const di = metric.distance(at, left[i]);
      const db = metric.distance(at, left[best]);
      if (di < db || (di === db && left[i].id < left[best].id)) best = i;
    }
    const [next] = left.splice(best, 1);
    order.push(next);
    at = next;
  }
  return order;
}

/** Vodorovné propojení ve zdi: sousední prvky ve stejné místnosti a výšce ≥ 900 mm (linka, koupelna). */
const wallLink = (a: RouteNode, b: RouteNode) => a.room === b.room && (a.floor ?? "") === (b.floor ?? "") && Math.abs(a.heightMm - b.heightMm) <= 50 && Math.min(a.heightMm, b.heightMm) >= 900;

/**
 * Trasa okruhu v jednom režimu. Spodem: svod z rozváděče do podlahy, trasa v podlaze, výstup ke krabici;
 * mezi zásuvkami dolů do podlahy a zpět nahoru (2 × (výška + hloubka)), pokud nejsou ve společném rámečku.
 * Vrchem: výstup do stropu, trasa v podhledu, spuštění k prvku. `allowWall` = povolit přímé propojení ve zdi.
 */
/** Fáze 60: vodorovné délky rozváděč → prvek a prvek → prvek jedním měřidlem (sdílí je všechny varianty vedení). */
export interface DistanceMatrix {
  fromPanel: number[];
  between: number[][];
}

export function distanceMatrix(nodes: readonly RouteNode[], panel: RoutePoint, metric: RouteMetric = MANHATTAN): DistanceMatrix {
  const between = nodes.map(() => nodes.map(() => 0));
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) between[i][j] = between[j][i] = metric.distance(nodes[i], nodes[j]);
  return { fromPanel: nodes.map((node) => metric.distance(panel, node)), between };
}

/**
 * Trasa okruhu v jednom režimu. Fáze 60: pořadí prvků je nejkratší otevřená cesta z rozváděče (`optimalOrder` –
 * přesně do 11 prvků), ne pořadí kreslení; ceny přechodů obsahují i svislé úseky režimu (spodem / vrchem, propojení
 * v krabici víceramečku, ve zdi). `orderSavingMm` = rozdíl proti pořadí, v jakém byly prvky nakresleny.
 */
export function routeCircuit(nodes: readonly RouteNode[], panel: RoutePoint, mode: "BOTTOM" | "TOP", profile: ElevationProfile = DEFAULT_ELEVATION, allowWall = false, metric: RouteMetric = MANHATTAN, matrix: DistanceMatrix = distanceMatrix(nodes, panel, metric)): CircuitRoute {
  const step = (from: number, to: number): Omit<RouteSegment, "from" | "to"> => {
    const node = nodes[to];
    if (from < 0) return { horizontalMm: matrix.fromPanel[to], verticalMm: panelVertical(node.heightMm, mode, profile), wall: false };
    const previous = nodes[from];
    const horizontalMm = matrix.between[from][to];
    if ((previous.frame && previous.frame === node.frame) || (allowWall && wallLink(previous, node))) return { horizontalMm, verticalMm: Math.abs(previous.heightMm - node.heightMm), wall: true };
    const vertical = mode === "BOTTOM" ? previous.heightMm + profile.floorDepthMm + node.heightMm + profile.floorDepthMm : Math.max(0, profile.ceilingHeightMm - previous.heightMm) + Math.max(0, profile.ceilingHeightMm - node.heightMm);
    return { horizontalMm, verticalMm: vertical, wall: false };
  };
  const cost = (from: number, to: number) => {
    const segment = step(from, to);
    return segment.horizontalMm + segment.verticalMm;
  };
  const indices = optimalOrder(nodes.length, cost);
  const segments: RouteSegment[] = indices.map((index, k) => ({ from: k === 0 ? "panel" : nodes[indices[k - 1]].id, to: nodes[index].id, ...step(k === 0 ? -1 : indices[k - 1], index) }));
  const rawMm = segments.reduce((sum, segment) => sum + segment.horizontalMm + segment.verticalMm, 0);
  const slack = 1 + profile.slackPercent / 100;
  const boxes = nodes.length ? new Set(nodes.map((node) => node.frame ?? node.id)).size : 0;
  const totalMm = Math.round(rawMm * slack + (nodes.length ? profile.panelAllowanceMm : 0) + boxes * profile.boxAllowanceMm);
  const drawn = pathCost(
    nodes.map((_, index) => index),
    cost,
  );
  return { mode, segments, rawMm: Math.round(rawMm), totalMm, longestMm: Math.round(rawMm * slack + (nodes.length ? profile.panelAllowanceMm : 0)), orderSavingMm: Math.max(0, Math.round((drawn - rawMm) * slack)) };
}

/**
 * Fáze 76: okruh jako strom úseků (obvodový router) ve všech režimech – vodorovné délky a lomené čáry ze stromu, svislé
 * úseky na koncích každého úseku (rozváděč, krabice prvku; víceramček a propojení ve zdi jen rozdíl výšek). Nejdelší
 * větev = nejdelší cesta od rozváděče po stromu (úbytek napětí). `orderSavingMm` = rozdíl proti řetězu v pořadí kreslení.
 */
export function treeRoutes(nodes: readonly RouteNode[], legs: readonly TreeLeg[], panel: RoutePoint, profile: ElevationProfile = DEFAULT_ELEVATION, metric: RouteMetric = MANHATTAN): Record<CableRoutingMode, CircuitRoute> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const part = (node: RouteNode, mode: "BOTTOM" | "TOP") => (mode === "BOTTOM" ? node.heightMm + profile.floorDepthMm : Math.max(0, profile.ceilingHeightMm - node.heightMm));
  const slack = 1 + profile.slackPercent / 100;
  const boxes = nodes.length ? new Set(nodes.map((node) => node.frame ?? node.id)).size : 0;
  const matrix = distanceMatrix(nodes, panel, metric);
  const build = (mode: "BOTTOM" | "TOP", allowWall: boolean): CircuitRoute => {
    const segments: RouteSegment[] = legs.flatMap((leg) => {
      const to = byId.get(leg.to);
      if (!to) return [];
      const base = { from: leg.from, to: leg.to, horizontalMm: leg.horizontalMm, points: leg.points, ...(leg.final ? { final: true } : {}) };
      const from = byId.get(leg.from);
      if (!from) return [{ ...base, verticalMm: panelVertical(to.heightMm, mode, profile), wall: false }];
      const linked = Boolean(from.frame && from.frame === to.frame) || (allowWall && wallLink(from, to));
      return [{ ...base, verticalMm: linked ? Math.abs(from.heightMm - to.heightMm) : part(from, mode) + part(to, mode), wall: linked }];
    });
    const rawMm = segments.reduce((sum, segment) => sum + segment.horizontalMm + segment.verticalMm, 0);
    const reach = new Map<string, number>();
    for (const segment of segments) reach.set(segment.to, (reach.get(segment.from) ?? 0) + segment.horizontalMm + segment.verticalMm);
    const longest = Math.max(0, ...reach.values());
    const allowance = nodes.length ? profile.panelAllowanceMm : 0;
    const drawn = pathCost(
      nodes.map((_, index) => index),
      chainStep(nodes, matrix, mode, profile, allowWall),
    );
    return { mode, segments, rawMm: Math.round(rawMm), totalMm: Math.round(rawMm * slack + allowance + boxes * profile.boxAllowanceMm), longestMm: Math.round(longest * slack + allowance), orderSavingMm: Math.max(0, Math.round((drawn - rawMm) * slack)) };
  };
  const candidates = [build("BOTTOM", true), build("TOP", true)];
  return { BOTTOM: build("BOTTOM", false), TOP: build("TOP", false), OPTIMIZED: candidates.reduce((best, route) => (route.totalMm < best.totalMm ? route : best)) };
}

/** Cena přechodu řetězu (vodorovně + svislé úseky režimu) – sdílí řetěz okruhu i porovnání s pořadím kreslení. */
function chainStep(nodes: readonly RouteNode[], matrix: DistanceMatrix, mode: "BOTTOM" | "TOP", profile: ElevationProfile, allowWall: boolean) {
  return (from: number, to: number) => {
    const node = nodes[to];
    if (from < 0) return matrix.fromPanel[to] + panelVertical(node.heightMm, mode, profile);
    const previous = nodes[from];
    const horizontal = matrix.between[from][to];
    if ((previous.frame && previous.frame === node.frame) || (allowWall && wallLink(previous, node))) return horizontal + Math.abs(previous.heightMm - node.heightMm);
    const vertical = mode === "BOTTOM" ? previous.heightMm + profile.floorDepthMm + node.heightMm + profile.floorDepthMm : Math.max(0, profile.ceilingHeightMm - previous.heightMm) + Math.max(0, profile.ceilingHeightMm - node.heightMm);
    return horizontal + vertical;
  };
}

/** Okruh ve všech režimech; OPTIMIZED = kratší z variant spodem / vrchem (s přímým propojením ve zdi). */
export function circuitRoutes(nodes: readonly RouteNode[], panel: RoutePoint, profile: ElevationProfile = DEFAULT_ELEVATION, metric: RouteMetric = MANHATTAN): Record<CableRoutingMode, CircuitRoute> {
  const matrix = distanceMatrix(nodes, panel, metric);
  const bottom = routeCircuit(nodes, panel, "BOTTOM", profile, false, metric, matrix);
  const top = routeCircuit(nodes, panel, "TOP", profile, false, metric, matrix);
  const candidates = [routeCircuit(nodes, panel, "BOTTOM", profile, true, metric, matrix), routeCircuit(nodes, panel, "TOP", profile, true, metric, matrix)];
  const optimized = candidates.reduce((best, route) => (route.totalMm < best.totalMm ? route : best));
  return { BOTTOM: bottom, TOP: top, OPTIMIZED: optimized };
}

/** „CYKY-J 3x2,5“ → „CYKY-J 3×2,5“. */
export const cableLabel = (cable: string) => cable.replace(/(\d)x(\d)/, "$1×$2");
export const SWITCH_LEG_CABLE = "CYKY-O 3×1,5";
export const DATA_CABLE = "UTP Cat6";
/** Fáze 101: anténní zásuvka TV / SAT – vlastní koaxiální kabel z rozváděče (multipřepínače), nikdy UTP. */
export const COAX_CABLE = "Koaxiální kabel 75 Ω (TV / SAT)";
/** Fáze 51: dvojitý střídavý přepínač č. 6+6 – L + korespondenční pár pro každou ze 2 větví. */
export const DOUBLE_TWO_WAY_CABLE = "CYKY-O 5×1,5";
/** Žaluziový ovladač → pohon žaluzie (L, N, PE, nahoru, dolů). */
export const BLIND_CABLE = "CYKY-J 5×1,5";
/** Pokojový termostat → topný okruh (spínaný vodič k tepelnému zdroji / relé v rozváděči). */
export const THERMOSTAT_CABLE = "CYKY-J 3×1,5";
/** Fáze 52 – sběrnicová Smart Home: tlačítka a čidla na sběrnici 24 V DC místo svodů 230 V. */
export const BUS_LEG_CABLE = "CAT7 / KNX J-Y(St)Y 2×2×0,8 (sběrnice 24 V DC)";
/** Fáze 52 – sběrnicová Smart Home: každý světelný vývod samostatně do rozváděče (hvězda). */
export const STAR_LIGHT_CABLE = "CYKY-J 3×1,5";
/** Fáze 77: čidlo na binární vstup (okenní / dveřní kontakt, záplavové čidlo). */
export const SENSOR_CABLE = "SYKFY 2×2×0,5 (binární vstup)";
/** Fáze 77: termostatická hlavice / servopohon → akční člen vytápění (sběrnice) nebo termostat místnosti (klasika). */
export const HEAD_CABLE = "CYSY 2×1 (termopohon hlavice)";
/** Fáze 77: pohon žaluzie 24 V DC / sběrnicový (Loxone, Somfy, KNX). */
export const BLIND_DC_CABLE = "SYKFY 3×2×0,5 / CAT7 (pohon 24 V DC / sběrnice)";
/** Fáze 77: LED 24 V DC ze zdroje / řadiče v rozváděči – žíly = kanály PWM + společný plus. */
export const ledCableLabel = (cores: number, variant = "") => `CYSY ${cores}×1,5 (LED 24 V DC${variant ? `, ${variant}` : ""})`;

/**
 * Svod k vypínači podle úrovně instalace (fáze 52): klasika CYKY-O (bez N), retrofit vždy CYKY-J
 * s průběžným N (modul pod vypínač), sběrnice = sběrnicový kabel 24 V DC.
 */
export function switchLegCable(installation: InstallMode | undefined, cable: string = SWITCH_LEG_CABLE): string {
  if (installation === "bus_loxone") return BUS_LEG_CABLE;
  if (installation === "smart_retrofit") return cable.replace("CYKY-O", "CYKY-J");
  return cable;
}

/** Výška nadpraží okna nad vypínačem + přívod k pohonu v překladu [mm]. */
export const BLIND_MOTOR_RUN_MM = 1000;

const meters = (mm: number) => Math.round(mm / 100) / 10;

export interface CircuitCabling {
  id: string;
  label: string;
  cable: string;
  /** Režim zvolený pro okruh ve vybraném režimu (u OPTIMIZED spodem / vrchem podle kratší trasy). */
  routing: "BOTTOM" | "TOP";
  lengthsM: Record<CableRoutingMode, number>;
  longestM: number;
  voltageDropPct: number;
  limitPct: number;
  ok: boolean;
  route: CircuitRoute;
  /** Fáze 105: světelný okruh – rozpad délky ve zvoleném režimu (vodorovně + svislé svody + rezerva = celkem). */
  breakdown?: LightingBreakdown;
  /** Fáze 105: úseky světelného okruhu podle kabelu (přívod, korespondence, svody ke světlům, větve hvězdy). */
  lightingParts?: LightingPart[];
}

/** Fáze 74: datová zásuvka – samostatný UTP z jejího rozváděče (s lomenou čarou pro výkres). */
export interface DataRun {
  id: string;
  nodeId: string;
  board: string;
  lengthsM: Record<CableRoutingMode, number>;
  routing: "BOTTOM" | "TOP";
  route: CircuitRoute;
}

export interface CableSummary {
  selected: CableRoutingMode;
  /** Fáze 74: datové zásuvky (každá vlastní UTP) s trasou ve zvoleném režimu. */
  dataRuns: DataRun[];
  /** Celková metráž všech kabelů v každém režimu [m]. */
  totals: Record<CableRoutingMode, number>;
  savingVsBottomM: number;
  savingVsTopM: number;
  /** Rozpis k nákupu ve vybraném režimu: typ kabelu → metry. */
  byCable: { cable: string; meters: number }[];
  circuits: CircuitCabling[];
  /** Fáze 57: trasa sběrnicové linky ve zvoleném režimu (pro vykreslení), jinak null. */
  busLine: CircuitRoute | null;
  /** Fáze 60: úspora optimálního pořadí prvků oproti pořadí kreslení ve zvoleném režimu [m]. */
  orderSavingM: number;
  warnings: string[];
}

export interface CablingInput {
  circuits: readonly (Pick<Circuit, "id" | "label" | "cable" | "nodeIds" | "kind" | "phases" | "crossSectionMm2" | "protection"> & Partial<Pick<Circuit, "board" | "upstreamDropPct">>)[];
  nodes: readonly RouteNode[];
  panel: RoutePoint;
  /** Fáze 74: rozváděče podle kódu (hlavní i podružné) – okruh vede z `panels[circuit.board]`, bez údaje z `panel`. */
  panels?: Readonly<Record<string, RoutePoint>>;
  profile?: ElevationProfile;
  selected: CableRoutingMode;
  /** Fáze 59: měřidlo tras (podlaží se stoupacím vedením, fáze 60 podél stěn); výchozí pravoúhlé. */
  metric?: RouteMetric;
  /** Vypínač → světlo, které ovládá (svod CYKY-O ze stropní krabice k vypínači). */
  switchLinks?: readonly { switchId: string; lightId: string; cable?: string }[];
  /** Fáze 51: žaluziové ovladače (kabel k pohonu) a termostaty (kabel k topnému okruhu / zdroji tepla). */
  controlRuns?: readonly { id: string; kind: "blind" | "thermostat"; targetId?: string | null }[];
  /** Datové zásuvky – každá samostatný UTP z rozváděče / racku. */
  dataNodeIds?: readonly string[];
  /** Fáze 101: anténní zásuvky TV / SAT – každá samostatný koaxiální kabel z rozváděče (multipřepínače). */
  coaxNodeIds?: readonly string[];
  /** Fáze 52: úroveň instalace – hvězda světel (sběrnice), CYKY-J ke každému vypínači (retrofit). */
  installation?: InstallMode;
  /**
   * Fáze 57: sběrnicové prvky (tlačítka, detektory, prostorové jednotky). Zadané = jedna sběrnicová linka z rozváděče
   * přes všechny prvky (KNX linie / Loxone Tree) místo svodů ze svítidel; žaluzie pak napájí aktor v rozváděči.
   */
  busNodeIds?: readonly string[];
  /**
   * Fáze 63: ručně upravené trasy úseků – klíč „od>do“ (rozváděč = `panel`), lomená čára v mm půdorysu. Pořadí prvků
   * se počítá z automatických tras (ruční úprava ho nepřehází), délka úseku se vezme z upravené čáry.
   */
  routeEdits?: Readonly<Record<string, readonly { x: number; y: number }[]>>;
  /**
   * Fáze 76: obvodový router 2D půdorysu – okruhy a sběrnicová linka jako strom po stěnách (vstupní prvek místnosti,
   * obvodové řazení bez vracení); bez něj řetěz v nejkratším pořadí.
   */
  treeRouter?: CircuitTreeRouter;
  /**
   * Fáze 77: samostatné kabely k prvkům (čidla na binární vstupy, hlavice, motory žaluzií, LED 24 V) – z rozváděče prvku,
   * nebo od `targetId` (hlavice od termostatu místnosti). Délka po trase + svislé úseky jako u ovládacích vedení.
   */
  starRuns?: readonly { id: string; cable: string; targetId?: string | null }[];
  /**
   * Fáze 105: řazení vypínačů (1 / 5 / 6 / 6+6 / 7) – zadané = přesná topologie světelných okruhů (přívod do krabic
   * vypínačů, korespondence, svody ke světlům; u sběrnice hvězda po skupinách světel), bez něj řetěz přes světla
   * a samostatné svody k vypínačům jako dřív.
   */
  switchNos?: Readonly<Record<string, SwitchNo>>;
  /** Fáze 105: světla s pětižilovým přívodem (DALI, RGB / RGBW) – u sběrnice větev CYKY-J 5×1,5. */
  fiveCoreLights?: readonly string[];
}

/** Hvězdicová topologie: každý prvek samostatným kabelem do rozváděče, trasy sečtené do jedné. */
function starRoutes(nodes: readonly RouteNode[], panel: RoutePoint, profile: ElevationProfile, metric: RouteMetric): Record<CableRoutingMode, CircuitRoute> {
  const merge = (routes: CircuitRoute[], mode: "BOTTOM" | "TOP"): CircuitRoute => ({
    mode,
    segments: routes.flatMap((route) => route.segments),
    rawMm: routes.reduce((sum, route) => sum + route.rawMm, 0),
    totalMm: routes.reduce((sum, route) => sum + route.totalMm, 0),
    longestMm: Math.max(0, ...routes.map((route) => route.longestMm)),
  });
  const per = nodes.map((node) => circuitRoutes([node], panel, profile, metric));
  const bottom = merge(per.map((routes) => routes.BOTTOM), "BOTTOM");
  const top = merge(per.map((routes) => routes.TOP), "TOP");
  const optimized = per.map((routes) => routes.OPTIMIZED);
  return { BOTTOM: bottom, TOP: top, OPTIMIZED: merge(optimized, optimized.filter((route) => route.mode === "TOP").length > optimized.length / 2 ? "TOP" : "BOTTOM") };
}

/** Fáze 74: výchozí úseky trasy z rozváděče okruhu – klíč „panel“ (hlavní) / „panel-RP1“ (podružný). */
function fromBoard(route: CircuitRoute, key: string): CircuitRoute {
  if (key === "panel") return route;
  return { ...route, segments: route.segments.map((segment) => (segment.from === "panel" ? { ...segment, from: key } : segment)) };
}

/** Lomené čáry úseků trasy (jen pro zvolený režim – výkres). Hvězda začíná každou větev znovu v rozváděči. */
function withPaths(route: CircuitRoute, byId: ReadonlyMap<string, RouteNode>, panel: RoutePoint, metric: RouteMetric): CircuitRoute {
  let last: RoutePoint = panel;
  const segments = route.segments.map((segment) => {
    const to = byId.get(segment.to);
    if (!to) return segment;
    const from = segment.from === "panel" || segment.from.startsWith("panel-") ? panel : (byId.get(segment.from) ?? last);
    last = to;
    // Fáze 63: ručně upravený úsek už lomenou čáru má
    return segment.points ? segment : { ...segment, points: metric.path(from, to) };
  });
  return { ...route, segments };
}

/** Výkaz kabeláže: porovnání 3 režimů, rozpis podle kabelů, ΔU na nejdelší větvi každého okruhu. */
export function summarizeCabling(input: CablingInput): CableSummary {
  const profile = input.profile ?? DEFAULT_ELEVATION;
  const metric = input.metric ?? MANHATTAN;
  const byId = new Map(input.nodes.map((node) => [node.id, node]));
  // Fáze 60: pořadí kreslení (pořadí prvků v nákresu) – optimální pořadí se s ním jen porovná
  const drawn = new Map(input.nodes.map((node, index) => [node.id, index]));
  const totals: Record<CableRoutingMode, number> = { BOTTOM: 0, TOP: 0, OPTIMIZED: 0 };
  const byCable = new Map<string, number>();
  const add = (cable: string, mm: number) => byCable.set(cable, (byCable.get(cable) ?? 0) + mm);
  const warnings: string[] = [];
  const slack = 1 + profile.slackPercent / 100;
  // Fáze 74: výchozí bod rozváděče podle kódu (podružné rozváděče), jinak hlavní rozváděč
  const originOf = (board: string | null | undefined): RoutePoint => (board ? input.panels?.[board] : undefined) ?? input.panel;
  const pointOf = (key: string): RoutePoint | undefined => {
    const board = boardOfPanelKey(key);
    return board ? originOf(board) : byId.get(key);
  };
  // Fáze 63: ruční úpravy tras – přichycené k aktuální poloze prvků, jen v rámci jednoho podlaží
  const edits = input.routeEdits ?? {};
  const editedPath = (segment: RouteSegment): RoutePoint[] | null => {
    const stored = edits[`${segment.from}>${segment.to}`];
    if (!stored || stored.length < 2) return null;
    const to = byId.get(segment.to);
    const from = pointOf(segment.from);
    if (!to || !from || (from.floor ?? "") !== (to.floor ?? "")) return null;
    return reanchor(stored, from, to).map((point) => ({ x: point.x, y: point.y, floor: from.floor }));
  };
  const applyEdits = (route: CircuitRoute): CircuitRoute => {
    let delta = 0;
    let changed = false;
    const segments = route.segments.map((segment) => {
      const path = editedPath(segment);
      if (!path) return segment;
      changed = true;
      const horizontalMm = Math.round(polylineLength(path));
      delta += horizontalMm - segment.horizontalMm;
      return { ...segment, horizontalMm, points: path, edited: true };
    });
    if (!changed) return route;
    return { ...route, segments, rawMm: route.rawMm + delta, totalMm: Math.round(route.totalMm + delta * slack), longestMm: Math.round(route.longestMm + delta * slack) };
  };
  const withEdits = (routes: Record<CableRoutingMode, CircuitRoute>, key = "panel") => {
    for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) routes[mode] = applyEdits(fromBoard(routes[mode], key));
    return routes;
  };

  // Fáze 105: světla okruhů s přesnou topologií – svody k nim už nejsou samostatné kabely ze stropní krabice
  const topologyLights = new Set<string>();
  const fiveCore = new Set(input.fiveCoreLights ?? []);
  const circuits: CircuitCabling[] = input.circuits
    .map((circuit): CircuitCabling | null => {
      const nodes = circuit.nodeIds
        .map((id) => byId.get(id))
        .filter((node): node is RouteNode => Boolean(node))
        .sort((a, b) => (drawn.get(a.id) ?? 0) - (drawn.get(b.id) ?? 0));
      if (!nodes.length) return null;
      const star = input.installation === "bus_loxone" && circuit.kind === "lighting";
      // Fáze 74: okruh vede ze svého rozváděče (podružný rozváděč, přívod podružného rozváděče z hlavního)
      const origin = originOf(circuit.board);
      // Fáze 76: obvodový router (strom po stěnách), jinak řetěz
      const chainRoutes = (chain: readonly RouteNode[]) => {
        const legs = input.treeRouter?.(chain, origin) ?? null;
        return legs ? treeRoutes(chain, legs, origin, profile, metric) : circuitRoutes(chain, origin, profile, metric);
      };
      // Fáze 105: světelný okruh s řazením vypínačů – přívod do krabic vypínačů, korespondence a svody ke světlům (klasika),
      // hvězda po skupinách světel (sběrnice)
      const topology =
        circuit.kind === "lighting" && input.switchNos
          ? lightingTopology({ installation: input.installation, circuitCable: cableLabel(circuit.cable), nodes, byId, switchLinks: input.switchLinks ?? [], switchNoOf: (id) => input.switchNos?.[id] ?? "1", fiveCore, origin, profile, metric, chainRoutes })
          : null;
      if (topology && !topology.star) for (const group of topology.groups) for (const light of group.lights) topologyLights.add(light.id);
      const raw = topology ? topology.routes : star ? starRoutes(nodes, origin, profile, metric) : chainRoutes(nodes);
      const planned = topology ? topology.routes[input.selected].totalMm : 0;
      const routes = withEdits({ ...raw }, panelKey(circuit.board));
      for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += routes[mode].totalMm;
      const route = withPaths(routes[input.selected], byId, origin, metric);
      const cable = topology ? topology.supplyCable : star ? STAR_LIGHT_CABLE : cableLabel(circuit.cable);
      if (topology) {
        // Rozpis podle kabelů úseků; ruční úprava trasy (rozdíl délky) jde na kabel přívodu
        for (const [name, mm] of topology.cableMm[input.selected]) add(name, mm);
        add(cable, route.totalMm - planned);
      } else add(cable, route.totalMm);
      const limitPct: number = circuit.kind === "lighting" ? VOLTAGE_DROP_LIMIT.lighting : VOLTAGE_DROP_LIMIT.other;
      // Fáze 74: u okruhu podružného rozváděče i úbytek na jeho přívodu
      const voltageDropPct = Math.round((voltageDropPercent({ lengthMm: route.longestMm, currentA: circuit.protection.ratedA, crossSectionMm2: circuit.crossSectionMm2, phases: circuit.phases }) + (circuit.upstreamDropPct ?? 0)) * 100) / 100;
      if (voltageDropPct > limitPct) warnings.push(`${circuit.label}: úbytek napětí ${String(voltageDropPct).replace(".", ",")} % > ${limitPct} % – zkraťte trasu nebo zvětšete průřez.`);
      return {
        id: circuit.id,
        label: circuit.label,
        cable,
        routing: route.mode,
        lengthsM: { BOTTOM: meters(routes.BOTTOM.totalMm), TOP: meters(routes.TOP.totalMm), OPTIMIZED: meters(routes.OPTIMIZED.totalMm) },
        longestM: meters(route.longestMm),
        voltageDropPct,
        limitPct,
        ok: voltageDropPct <= limitPct,
        route,
        ...(circuit.kind === "lighting" ? { breakdown: routeBreakdown(route) } : {}),
        ...(topology ? { lightingParts: topology.legs } : {}),
      };
    })
    .filter((row): row is CircuitCabling => row !== null);

  // Svody k vypínačům: ze stropní krabice světla dolů k vypínači (stejné ve všech režimech);
  // sběrnice = jeden sběrnicový kabel na ovládací místo
  const busSwitches = new Set<string>();
  const busLine = input.installation === "bus_loxone" && input.busNodeIds !== undefined;
  let busRoute: CircuitRoute | null = null;
  if (busLine) {
    const busNodes = (input.busNodeIds ?? []).map((id) => byId.get(id)).filter((node): node is RouteNode => Boolean(node));
    if (busNodes.length) {
      const tree = input.treeRouter?.(busNodes, input.panel) ?? null;
      const routes = withEdits(tree ? treeRoutes(busNodes, tree, input.panel, profile, metric) : circuitRoutes(busNodes, input.panel, profile, metric));
      for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += routes[mode].totalMm;
      busRoute = withPaths(routes[input.selected], byId, input.panel, metric);
      add(BUS_LEG_CABLE, busRoute.totalMm);
    }
  }
  for (const link of busLine ? [] : (input.switchLinks ?? [])) {
    const light = byId.get(link.lightId);
    const switchNode = byId.get(link.switchId);
    if (!light || !switchNode) continue;
    // Fáze 105: svod je součástí topologie světelného okruhu (přívod do krabice vypínače, svod ke světlům)
    if (topologyLights.has(link.lightId)) continue;
    if (input.installation === "bus_loxone") {
      if (busSwitches.has(link.switchId)) continue;
      busSwitches.add(link.switchId);
    }
    const mm = Math.round((metric.distance(light, switchNode) + Math.max(0, profile.ceilingHeightMm - switchNode.heightMm)) * slack + profile.boxAllowanceMm * 2);
    for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += mm;
    add(switchLegCable(input.installation, link.cable ?? SWITCH_LEG_CABLE), mm);
  }
  // Žaluzie: z ovladače vzhůru do nadpraží k pohonu; termostat: k tepelnému zdroji, jinak do rozváděče
  for (const run of input.controlRuns ?? []) {
    const node = byId.get(run.id);
    if (!node) continue;
    const runs = { BOTTOM: 0, TOP: 0, OPTIMIZED: 0 } as Record<CableRoutingMode, number>;
    // Sběrnice: termostat je prostorová jednotka na lince (ventily spíná aktor), žaluzii napájí aktor z rozváděče
    if (busLine && run.kind === "thermostat") continue;
    if (busLine && run.kind === "blind") {
      for (const mode of ["BOTTOM", "TOP"] as const) runs[mode] = Math.round((metric.distance(originOf(node.board), node) + panelVertical(Math.min(profile.ceilingHeightMm, node.heightMm + BLIND_MOTOR_RUN_MM), mode, profile)) * slack + profile.panelAllowanceMm + profile.boxAllowanceMm);
      runs.OPTIMIZED = Math.min(runs.BOTTOM, runs.TOP);
    } else if (run.kind === "blind") {
      // Fáze 77: zakreslený motor – od spínače vzhůru a ve zdi / v nadpraží k motoru; jinak motor v nadpraží nad spínačem
      const motor = run.targetId ? byId.get(run.targetId) : null;
      const mm = motor
        ? Math.round((metric.distance(node, motor) + Math.abs(motor.heightMm - node.heightMm)) * slack + profile.boxAllowanceMm * 2)
        : Math.round((Math.max(0, profile.ceilingHeightMm - node.heightMm) + BLIND_MOTOR_RUN_MM) * slack + profile.boxAllowanceMm * 2);
      runs.BOTTOM = runs.TOP = runs.OPTIMIZED = mm;
    } else {
      const target = run.targetId ? byId.get(run.targetId) : null;
      for (const mode of ["BOTTOM", "TOP"] as const) {
        const vertical = target
          ? mode === "BOTTOM"
            ? node.heightMm + target.heightMm + 2 * profile.floorDepthMm
            : Math.max(0, profile.ceilingHeightMm - node.heightMm) + Math.max(0, profile.ceilingHeightMm - target.heightMm)
          : panelVertical(node.heightMm, mode, profile);
        runs[mode] = Math.round((metric.distance(target ?? originOf(node.board), node) + vertical) * slack + (target ? profile.boxAllowanceMm : profile.panelAllowanceMm) + profile.boxAllowanceMm);
      }
      runs.OPTIMIZED = Math.min(runs.BOTTOM, runs.TOP);
    }
    for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += runs[mode];
    add(run.kind === "blind" ? BLIND_CABLE : THERMOSTAT_CABLE, runs[input.selected]);
  }
  // Fáze 77: samostatné kabely k čidlům, hlavicím, motorům a LED 24 V – z rozváděče (svisle jako přívod), od termostatu
  // místnosti ve zdi (rozdíl výšek)
  for (const run of input.starRuns ?? []) {
    const node = byId.get(run.id);
    if (!node) continue;
    const target = run.targetId ? byId.get(run.targetId) : null;
    const runs = { BOTTOM: 0, TOP: 0, OPTIMIZED: 0 } as Record<CableRoutingMode, number>;
    for (const mode of ["BOTTOM", "TOP"] as const) {
      const vertical = target ? Math.abs(target.heightMm - node.heightMm) : panelVertical(node.heightMm, mode, profile);
      runs[mode] = Math.round((metric.distance(target ?? originOf(node.board), node) + vertical) * slack + (target ? profile.boxAllowanceMm : profile.panelAllowanceMm) + profile.boxAllowanceMm);
    }
    runs.OPTIMIZED = Math.min(runs.BOTTOM, runs.TOP);
    for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += runs[mode];
    add(run.cable, runs[input.selected]);
  }
  // Datové zásuvky: samostatný UTP ze svého rozváděče, každá kratší cestou v režimu OPTIMIZED; fáze 74 s trasou na výkres
  const dataRuns: DataRun[] = [];
  const coax = new Set(input.coaxNodeIds ?? []);
  for (const id of [...(input.dataNodeIds ?? []), ...coax]) {
    const node = byId.get(id);
    if (!node) continue;
    const board = node.board ?? "RH";
    const origin = originOf(board);
    const routes = withEdits(circuitRoutes([node], origin, profile, metric), panelKey(board));
    for (const mode of ["BOTTOM", "TOP", "OPTIMIZED"] as const) totals[mode] += routes[mode].totalMm;
    const route = withPaths(routes[input.selected], byId, origin, metric);
    add(coax.has(id) ? COAX_CABLE : DATA_CABLE, route.totalMm);
    dataRuns.push({ id: `data-${id}`, nodeId: id, board, lengthsM: { BOTTOM: meters(routes.BOTTOM.totalMm), TOP: meters(routes.TOP.totalMm), OPTIMIZED: meters(routes.OPTIMIZED.totalMm) }, routing: route.mode, route });
  }

  const totalsM = { BOTTOM: meters(totals.BOTTOM), TOP: meters(totals.TOP), OPTIMIZED: meters(totals.OPTIMIZED) };
  return {
    selected: input.selected,
    dataRuns,
    totals: totalsM,
    savingVsBottomM: Math.max(0, Math.round((totalsM.BOTTOM - totalsM.OPTIMIZED) * 10) / 10),
    savingVsTopM: Math.max(0, Math.round((totalsM.TOP - totalsM.OPTIMIZED) * 10) / 10),
    byCable: [...byCable.entries()].map(([cable, mm]) => ({ cable, meters: Math.ceil(mm / 1000) })).sort((a, b) => b.meters - a.meters || a.cable.localeCompare(b.cable)),
    circuits,
    busLine: busRoute,
    orderSavingM: meters(circuits.reduce((sum, circuit) => sum + (circuit.route.orderSavingMm ?? 0), 0)),
    warnings,
  };
}
