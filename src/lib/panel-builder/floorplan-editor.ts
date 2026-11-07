// 2D editor půdorysu elektroinstalace (fáze 49): paleta značek, stav nákresu (v mm půdorysu) a převod
// na vstup mostu „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`) a 3D výpočtu kabeláže.
// Čisté funkce – bezpečné pro klient i server.

import { DOUBLE_TWO_WAY_CABLE, MANHATTAN, floorMetric, summarizeCabling, type FloorLink, type RouteMetric, type RouteNode, type RoutePoint } from "@/engine/cable-routing";
import { buildWallGraph, wallMetric, wallSegments } from "@/engine/wall-routing";
import { isSocketGrouping, type SocketGrouping } from "@/engine/socket-zones";
import {
  DEFAULT_ELEVATION,
  calibrateFloorplanScale,
  elevationProfile,
  generateCircuitsFromFloorplan,
  homeRunLength,
  isInstallLevel,
  isInstallMethod,
  mountHeight,
  type DesignOptions,
  type InstallLevel,
  type InstallMethod,
  type ApplianceTag,
  type CableRoutingMode,
  type Calibration,
  type ElevationProfile,
  type FloorNode,
  type Floorplan,
  type NodeKind,
  type NodeVariant,
} from "@/engine/floorplan-bridge";

import { DEFAULT_COLOR, appearanceLabel, designColor } from "./wiring-designs";
import { CUSTOM_APPLIANCE_ITEM, applianceOverride, applianceSpecFor, parseApplianceList, type ApplianceSpec } from "./appliances";
import { clampFixture, fixtureSpecOf } from "./fixtures";
import { isPolygonRoom, nearestWall, pointInRoom, polygonBounds, roomArea, translatePolygon } from "./room-geometry";
import { productById } from "./smart-catalog";
import { DEFAULT_SUPPLY, supplyById, type SupplySystem } from "./supply";
import { isEnvironmentId, type EnvironmentId } from "./environments";
import { CALIBRATION_TOLERANCE_PCT, emptyCalibration, isRotation, planExtent, rotatedSize, type CalibrationRecord, type FloorplanBackground, type Rotation } from "./floorplan-pdf";

export type PaletteGroup = "panel" | "sockets" | "lights" | "controls" | "appliances" | "fixtures";

/** Fáze 57: role sběrnicového prvku (KNX / Loxone Tree / free@home) – kreslí se v rámečku „sběrnice“. */
export type BusRole = "button" | "presence" | "room_unit" | "sensor" | "display" | "blind";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  /** Krátká značka v půdorysu. */
  symbol: string;
  /** "riser" = stoupací vedení mezi podlažími (fáze 59), "fixture" = zařizovací předmět pro koupelnové zóny (fáze 61) – nejsou elektrické vývody. */
  kind: NodeKind | "panel" | "riser" | "fixture";
  variant?: NodeVariant;
  tag?: ApplianceTag;
  /** Číslo řazení vypínače (1 / 5 / 6 / 7) – jen informativně, skutečné řazení určí párování. */
  switchNo?: string;
  /** Fáze 51 – co ovladač řídí: světla (párování), pohon žaluzie nebo topný okruh; „none“ = čidlo / panel bez párování. */
  control?: "light" | "blind" | "thermostat" | "none";
  /** Fáze 57: úrovně instalace, ve kterých se prvek nabízí v paletě (bez = všechny). */
  levels?: readonly InstallLevel[];
  /** Fáze 57: sběrnicový prvek – počet kanálů (tlačítek) a role. */
  bus?: { channels: number; role: BusRole };
  /** Fáze 57: bezdrátové tlačítko / čidlo na baterii – bez kabelu a bez krabice (retrofit). */
  wireless?: boolean;
  /** Pevné řazení / typ přístroje pro výběr z katalogu (S5, S6+6, tlačítka). */
  fixedSwitchNo?: string;
  /** Kategorie katalogu domovních přístrojů mimo vypínače. */
  wiringCategory?: "WD_BLIND" | "WD_DIMMER" | "WD_SENSOR" | "WD_THERMOSTAT" | "WD_BELL";
  /** Vypínač s orientační doutnavkou / LED (řazení 1S / 6S). */
  led?: boolean;
  /** Provedení do vlhka IP44. */
  ip44?: boolean;
  /** Výchozí montážní výška [mm] (termostat, PIR), jinak podle druhu a výškového profilu. */
  heightMm?: number;
  /** Fáze 63: položka mimo seznam palety (vlastní spotřebič – v paletě jako jednotlivé spotřebiče knihovny). */
  hidden?: boolean;
}

export const PALETTE_GROUPS: { id: PaletteGroup; label: string }[] = [
  { id: "panel", label: "⚡ Rozváděč" },
  { id: "sockets", label: "🔌 Zásuvky" },
  { id: "lights", label: "💡 Světla" },
  { id: "controls", label: "🎛️ Ovládání" },
  { id: "appliances", label: "🔥 Samostatné spotřebiče (vlastní jisticí okruh)" },
  { id: "fixtures", label: "🛁 Zařizovací předměty (koupelnové zóny ČSN 33 2000-7-701)" },
];

/** Nadpis skupiny ovládání podle úrovně instalace (fáze 57). */
export const CONTROLS_LABEL: Record<InstallLevel, string> = {
  classic: "🎛️ Vypínače a ovladače 230 V (řazení dle ČSN)",
  bus_loxone: "🎛️ Sběrnicové ovládání 24 V DC (KNX / Loxone Tree / free@home)",
  smart_retrofit: "🎛️ Vypínače s chytrým modulem a bezdrátová tlačítka (Zigbee / Matter)",
};

const CLASSIC: readonly InstallLevel[] = ["classic", "smart_retrofit"];
const BUS: readonly InstallLevel[] = ["bus_loxone"];
const RETROFIT: readonly InstallLevel[] = ["smart_retrofit"];

export const PALETTE: PaletteItem[] = [
  { id: "panel", group: "panel", label: "Hlavní domovní / bytový rozváděč", symbol: "RH", kind: "panel" },
  // Fáze 59: průchod kabelů mezi podlažími (jedno na podlaží) – bez něj vede trasa svisle nad / pod rozváděčem
  { id: "riser", group: "panel", label: "Stoupací vedení (průchod do jiného podlaží)", symbol: "↕", kind: "riser" },
  { id: "socket", group: "sockets", label: "Jednozásuvka", symbol: "Z", kind: "single_socket" },
  { id: "double-socket", group: "sockets", label: "Dvojzásuvka", symbol: "2Z", kind: "double_socket" },
  { id: "worktop-socket", group: "sockets", label: "Zásuvka nad linkou", symbol: "ZL", kind: "double_socket", variant: "worktop" },
  { id: "ip44-socket", group: "sockets", label: "Zásuvka IP44 koupelna / venek", symbol: "Z44", kind: "single_socket", variant: "ip44" },
  { id: "data-socket", group: "sockets", label: "Datová zásuvka RJ45", symbol: "RJ", kind: "data_socket" },
  { id: "ceiling-light", group: "lights", label: "Stropní svítidlo", symbol: "⊗", kind: "light" },
  { id: "wall-light", group: "lights", label: "Nástěnné svítidlo", symbol: "◐", kind: "light", variant: "wall" },
  { id: "switch-1", group: "controls", levels: CLASSIC, label: "Vypínač č. 1 (jednopólový)", symbol: "S1", kind: "switch", switchNo: "1" },
  { id: "switch-5", group: "controls", levels: CLASSIC, label: "Sériový přepínač č. 5 (lustrový – 2 klapky)", symbol: "S5", kind: "switch", switchNo: "5", fixedSwitchNo: "5" },
  { id: "switch-6", group: "controls", levels: CLASSIC, label: "Střídavý přepínač č. 6 (schodový)", symbol: "S6", kind: "switch", switchNo: "6" },
  { id: "switch-6-6", group: "controls", levels: CLASSIC, label: "Dvojitý střídavý přepínač č. 6+6 (řazení 5B – 2 klapky)", symbol: "S6+6", kind: "switch", switchNo: "6+6", fixedSwitchNo: "6+6" },
  { id: "switch-7", group: "controls", levels: CLASSIC, label: "Křížový přepínač č. 7", symbol: "S7", kind: "switch", switchNo: "7" },
  { id: "button", group: "controls", levels: CLASSIC, label: "Tlačítko č. 1/0 (impulzní / zvonkové)", symbol: "T1", kind: "switch", variant: "button", switchNo: "1/0", fixedSwitchNo: "1/0" },
  { id: "button-2", group: "controls", levels: CLASSIC, label: "Dvojtlačítko č. 1/0+1/0 (2 klapky)", symbol: "T2", kind: "switch", variant: "button", switchNo: "1/0+1/0", fixedSwitchNo: "1/0+1/0" },
  { id: "blind", group: "controls", levels: CLASSIC, label: "Žaluziový spínač / tlačítko (nahoru / dolů)", symbol: "ZAL", kind: "switch", control: "blind", wiringCategory: "WD_BLIND" },
  { id: "dimmer", group: "controls", levels: CLASSIC, label: "Stmívač (otočný / tlačítkový LED)", symbol: "STM", kind: "switch", wiringCategory: "WD_DIMMER" },
  { id: "pir", group: "controls", levels: CLASSIC, label: "Pohybové čidlo (PIR nástěnné / stropní)", symbol: "PIR", kind: "switch", wiringCategory: "WD_SENSOR", heightMm: 2200 },
  { id: "switch-led", group: "controls", levels: CLASSIC, label: "Vypínač s orientační doutnavkou / LED (řazení 1So / 6So)", symbol: "S1S", kind: "switch", switchNo: "1So", led: true },
  { id: "switch-ip44", group: "controls", levels: CLASSIC, label: "Vypínač IP44 (do vlhka / venkovní)", symbol: "S44", kind: "switch", switchNo: "1", ip44: true },
  // Fáze 52: přesná katalogová řazení ABB (Tango / Levit / Time)
  { id: "abb-1so", group: "controls", levels: CLASSIC, label: "ABB řazení 1So – jednopólový s orientační doutnavkou", symbol: "1So", kind: "switch", switchNo: "1So", fixedSwitchNo: "1So", led: true },
  { id: "abb-1s", group: "controls", levels: CLASSIC, label: "ABB řazení 1S – jednopólový se signalizační doutnavkou", symbol: "1S", kind: "switch", switchNo: "1S", fixedSwitchNo: "1S", led: true },
  { id: "abb-1sso", group: "controls", levels: CLASSIC, label: "ABB řazení 1SSo – signalizační + orientační doutnavka", symbol: "1SSo", kind: "switch", switchNo: "1SSo", fixedSwitchNo: "1SSo", led: true },
  { id: "abb-1-1", group: "controls", levels: CLASSIC, label: "ABB řazení 1+1 – dvojitý s blokováním proti současnému stisku", symbol: "1+1", kind: "switch", switchNo: "1+1", fixedSwitchNo: "1+1" },
  { id: "abb-6-6-0", group: "controls", levels: CLASSIC, label: "ABB řazení 6+6/0 – dvojitý střídavý s nulovou polohou", symbol: "6+6/0", kind: "switch", switchNo: "6+6/0", fixedSwitchNo: "6+6/0" },
  { id: "abb-7so", group: "controls", levels: CLASSIC, label: "ABB řazení 7So – křížový s orientační doutnavkou", symbol: "7So", kind: "switch", switchNo: "7So", fixedSwitchNo: "7So", led: true },
  { id: "abb-10so", group: "controls", levels: CLASSIC, label: "ABB řazení 1/0So – zapínací tlačítko s orientační doutnavkou", symbol: "1/0So", kind: "switch", variant: "button", switchNo: "1/0So", fixedSwitchNo: "1/0So", led: true },
  { id: "thermostat", group: "controls", levels: CLASSIC, label: "Pokojový termostat", symbol: "TER", kind: "switch", control: "thermostat", wiringCategory: "WD_THERMOSTAT", heightMm: 1500 },
  // Fáze 57: sběrnicová instalace – tlačítka a čidla na sběrnici 24 V DC, světla hvězdou z aktorů v rozváděči
  { id: "bus-1", group: "controls", levels: BUS, label: "Sběrnicové tlačítko 1násobné", symbol: "B1", kind: "switch", variant: "button", bus: { channels: 1, role: "button" } },
  { id: "bus-2", group: "controls", levels: BUS, label: "Sběrnicové tlačítko 2násobné", symbol: "B2", kind: "switch", variant: "button", bus: { channels: 2, role: "button" } },
  { id: "bus-4", group: "controls", levels: BUS, label: "Sběrnicové tlačítko 4násobné", symbol: "B4", kind: "switch", variant: "button", bus: { channels: 4, role: "button" } },
  { id: "bus-6", group: "controls", levels: BUS, label: "Sběrnicové tlačítko 6násobné", symbol: "B6", kind: "switch", variant: "button", bus: { channels: 6, role: "button" } },
  { id: "bus-blind", group: "controls", levels: BUS, label: "Sběrnicové žaluziové tlačítko (nahoru / dolů)", symbol: "BŽ", kind: "switch", variant: "button", control: "blind", bus: { channels: 2, role: "blind" } },
  { id: "bus-presence", group: "controls", levels: BUS, label: "Detektor přítomnosti stropní (sběrnice)", symbol: "DP", kind: "switch", bus: { channels: 1, role: "presence" }, heightMm: 2600 },
  { id: "bus-room", group: "controls", levels: BUS, label: "Prostorová jednotka s termostatem (sběrnice)", symbol: "PJ", kind: "switch", control: "thermostat", bus: { channels: 1, role: "room_unit" }, heightMm: 1500 },
  { id: "bus-sensor", group: "controls", levels: BUS, label: "Čidlo teploty a vlhkosti (sběrnice)", symbol: "ČT", kind: "switch", control: "none", bus: { channels: 1, role: "sensor" }, heightMm: 1500 },
  { id: "bus-display", group: "controls", levels: BUS, label: "Dotykový panel / vizualizace (sběrnice)", symbol: "DTP", kind: "switch", control: "none", bus: { channels: 1, role: "display" }, heightMm: 1500 },
  // Fáze 57: hybridní retrofit – klasická kabeláž s modulem pod vypínač (výše) a bezdrátová tlačítka bez kabelu
  { id: "wireless-1", group: "controls", levels: RETROFIT, label: "Bezdrátové tlačítko 1násobné (baterie, bez kabelu)", symbol: "BT1", kind: "switch", variant: "button", wireless: true },
  { id: "wireless-2", group: "controls", levels: RETROFIT, label: "Bezdrátové tlačítko 2násobné (baterie, bez kabelu)", symbol: "BT2", kind: "switch", variant: "button", wireless: true },
  { id: "wireless-pir", group: "controls", levels: RETROFIT, label: "Bezdrátové pohybové čidlo (baterie)", symbol: "BPIR", kind: "switch", wireless: true, heightMm: 2200 },
  { id: "cooktop", group: "appliances", label: "Varná deska 3f (400 V)", symbol: "VD", kind: "appliance", tag: "cooktop_3p" },
  { id: "oven", group: "appliances", label: "Trouba", symbol: "TR", kind: "appliance", tag: "oven" },
  { id: "dishwasher", group: "appliances", label: "Myčka", symbol: "MY", kind: "appliance", tag: "dishwasher" },
  { id: "washer", group: "appliances", label: "Pračka", symbol: "PR", kind: "appliance", tag: "washer" },
  { id: "dryer", group: "appliances", label: "Sušička", symbol: "SU", kind: "appliance", tag: "dryer" },
  { id: "fridge", group: "appliances", label: "Chladnička (RCBO)", symbol: "CH", kind: "appliance", tag: "fridge" },
  { id: "boiler", group: "appliances", label: "Bojler", symbol: "BO", kind: "appliance", tag: "boiler" },
  { id: "heat-pump", group: "appliances", label: "Tepelné čerpadlo", symbol: "TČ", kind: "appliance", tag: "heat_pump" },
  { id: "wallbox", group: "appliances", label: "Wallbox EV", symbol: "EV", kind: "appliance", tag: "ev_charger" },
  { id: "pv-inverter", group: "appliances", label: "Střídač FVE (chránič typ B)", symbol: "FVE", kind: "appliance", tag: "pv_inverter" },
  // Fáze 63: vlastní spotřebič z knihovny spotřebičů (prvek nese id spotřebiče v `appliance`)
  { id: CUSTOM_APPLIANCE_ITEM, group: "appliances", label: "Vlastní spotřebič", symbol: "SP", kind: "appliance", hidden: true },
  // Fáze 61: vana a sprchový kout – normový hlídač ověří zóny 0–2 (zásuvky a spínače dál než 0,6 m)
  { id: "bath", group: "fixtures", label: "Vana (1700 × 750 mm)", symbol: "VANA", kind: "fixture" },
  { id: "shower", group: "fixtures", label: "Sprchový kout (900 × 900 mm)", symbol: "SPR", kind: "fixture" },
  // Fáze 63: umyvadla – pás nad a pod umyvadlem (ČSN 33 2130 ed. 4); rozměr X × Y a natočení jdou měnit
  { id: "basin", group: "fixtures", label: "Umyvadlo (600 × 450 mm)", symbol: "UMY", kind: "fixture" },
  { id: "double-basin", group: "fixtures", label: "Dvojumyvadlo (1200 × 450 mm)", symbol: "DUM", kind: "fixture" },
];

export const paletteItem = (id: string) => PALETTE.find((item) => item.id === id) ?? null;

/** Paleta pro úroveň instalace (fáze 57): ovládání se mění, zásuvky / světla / spotřebiče zůstávají. */
export const paletteFor = (level: InstallLevel) => PALETTE.filter((item) => !item.hidden && (!item.levels || item.levels.includes(level)));
export const availableIn = (item: PaletteItem, level: InstallLevel) => !item.levels || item.levels.includes(level);

/** Ovladač, který se páruje se světly (ne žaluzie ani termostat). */
export const controlsLights = (item: PaletteItem | null | undefined) => item?.kind === "switch" && (item.control ?? "light") === "light";

/** Osazený prvek – souřadnice v mm půdorysu (počátek vlevo nahoře). */
export interface EditorElement {
  id: string;
  item: string;
  x: number;
  y: number;
  room: string;
  /** Vlastní montážní výška [mm]; null = výchozí podle druhu a výškového profilu. */
  mountHeightMm: number | null;
  /** Počet kusů ve společném rámečku 1R–5R. */
  frameUnits: number;
  /** Designová řada domovních přístrojů („ABB|Levit“); null = řada celého nákresu. */
  series: string | null;
  /** Barva přístrojů (`DESIGN_COLORS`, fáze 51); null = barva celého nákresu. */
  color: string | null;
  /** Vypínač: světla, která ovládá. */
  controls: string[];
  /**
   * Fáze 57: otočení značky (zásuvka „nožičkou“ ke stěně) a vlastní měřítko značky (null = měřítko nákresu).
   * Fáze 63: libovolný úhel ve stupních 0–360 (prvek u šikmé stěny, zařizovací předmět po 45°).
   */
  rotation: number;
  scale: number | null;
  /** Fáze 61: svítidlo – stmívání, příkon a druh zátěže (výběr spínacího / stmívacího akčního členu). */
  light?: LightSpec;
  /** Fáze 63: zařizovací předmět – skutečná šířka X a hloubka Y [mm] (bez údaje výchozí rozměr předmětu). */
  sizeMm?: { w: number; d: number };
  /** Fáze 63: vlastní spotřebič – id v knihovně spotřebičů nákresu (`appliances`). */
  appliance?: string;
  /** Fáze 63: konkrétní výrobek z lišty výrobců (ABB-free@home, ABB i-bus KNX, Loxone, TapHome) – popis a sběrnice. */
  product?: string;
  /** Fáze 65: ruční zásuvkový okruh („Z1“ … „Z99“) – zásuvky se stejným okruhem jdou na jeden jistič; bez = automaticky. */
  socketCircuit?: string;
}

/** Fáze 61: zátěž svítidla pro chytrou domácnost. */
export type LightLoad = "led" | "led_driver" | "halogen" | "dali";
export interface LightSpec {
  dimmable: boolean;
  /** Příkon svítidla [W]. */
  powerW: number;
  load: LightLoad;
}
export const DEFAULT_LIGHT: LightSpec = { dimmable: false, powerW: 20, load: "led" };
export const LIGHT_LOADS: readonly { id: LightLoad; label: string }[] = [
  { id: "led", label: "LED (retrofit / stmívatelné LED)" },
  { id: "led_driver", label: "LED zdroj s předřadníkem (kapacitní zátěž)" },
  { id: "halogen", label: "Žárovka / halogen 230 V" },
  { id: "dali", label: "DALI předřadník (digitální stmívání)" },
];
export const lightSpecOf = (element: Pick<EditorElement, "light">): LightSpec => element.light ?? DEFAULT_LIGHT;

function parseLightSpec(value: unknown, num: (input: unknown, fallback: number, min: number, max: number) => number): LightSpec {
  const raw = (value && typeof value === "object" ? value : {}) as Partial<LightSpec>;
  return { dimmable: raw.dimmable === true, powerW: Math.round(num(raw.powerW, DEFAULT_LIGHT.powerW, 1, 3000)), load: LIGHT_LOADS.some((load) => load.id === raw.load) ? raw.load! : DEFAULT_LIGHT.load };
}

/** Základní velikost značky v půdorysu [mm] (≈ 6 mm na výkresu 1 : 50); násobí ji měřítko značek. */
export const SYMBOL_MM = 300;
export const SYMBOL_SCALE_MIN = 0.4;
export const SYMBOL_SCALE_MAX = 4;
export const clampSymbolScale = (value: number) => Math.min(SYMBOL_SCALE_MAX, Math.max(SYMBOL_SCALE_MIN, Math.round(value * 100) / 100));
/** Velikost značky prvku [mm]. */
export const symbolSizeOf = (draft: Pick<FloorplanDraft, "symbolScale">, element: Pick<EditorElement, "scale">) => SYMBOL_MM * draft.symbolScale * (element.scale ?? 1);

export interface EditorRoom {
  id: string;
  name: string;
  /** Obálka místnosti (u obdélníku přímo místnost). */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fáze 63: polygonální místnost se šikmými stěnami – rohy po obvodu (3–40); bez nich obdélník. */
  points?: { x: number; y: number }[];
}

/**
 * Fáze 59: vícenásobný rámeček (víceramček 2R–5R) z různých přístrojů – např. 2 zásuvky + vypínač. Pořadí `members`
 * = pořadí v rámečku; první přístroj je kotva (poloha, natočení, výška, řada a barva rámečku).
 */
export interface FrameGroup {
  id: string;
  members: string[];
}

/** Fáze 59: zakreslení změny do podkladu – nová příčka, bouraná konstrukce, šrafovaná oblast, textové pole. */
export type AnnotationKind = "wall" | "demolish" | "zone" | "text";
export type HatchId = "none" | "diagonal" | "cross" | "horizontal" | "dots" | "solid";
export const HATCHES: readonly { id: HatchId; label: string }[] = [
  { id: "diagonal", label: "Šikmá šrafa" },
  { id: "cross", label: "Křížová šrafa" },
  { id: "horizontal", label: "Vodorovná šrafa" },
  { id: "dots", label: "Tečky" },
  { id: "solid", label: "Plná výplň" },
  { id: "none", label: "Bez výplně" },
];
export const isHatch = (value: unknown): value is HatchId => HATCHES.some((hatch) => hatch.id === value);

export interface Annotation {
  id: string;
  kind: AnnotationKind;
  /** Příčka / bouraná konstrukce: osa úsečky (x, y) → (x2, y2); oblast: protilehlé rohy; text: kotva vlevo nahoře (x, y). */
  x: number;
  y: number;
  x2: number;
  y2: number;
  /** Barva čáry, šrafy a textu (#rrggbb). */
  color: string;
  hatch: HatchId;
  /** Tloušťka příčky / bourané konstrukce [mm] (u textu a oblasti se nepoužije). */
  thicknessMm: number;
  text: string;
  /** Výška písma [mm v půdorysu] – na výkresu 1 : 50 odpovídá 250 mm písmu 5 mm. */
  fontMm: number;
  bold: boolean;
  /** Text na bílém podkladu (čitelnost nad výkresem). */
  background: boolean;
}

/** Fáze 59: podlaží domu – vlastní podklad, kalibrace, místnosti, prvky, rámečky a zakreslené změny. */
export interface FloorSheet {
  id: string;
  /** „1. NP“, „2. NP“, „1. PP“, „Podkroví“ … */
  name: string;
  /** Výška čisté podlahy podlaží nad podlažím rozváděče ±0 [mm] (2. NP při konstrukční výšce 3 m = 3000). */
  levelMm: number;
  background: FloorplanBackground | null;
  calibration: CalibrationRecord;
  mmPerPx: number;
  widthMm: number;
  heightMm: number;
  rooms: EditorRoom[];
  elements: EditorElement[];
  frames: FrameGroup[];
  annotations: Annotation[];
}

/** Výchozí konstrukční výška podlaží (podlaha → podlaha) [mm]. */
export const DEFAULT_STOREY_MM = 3000;
export const FLOOR_NAME_CHIPS = ["1. PP", "1. NP", "2. NP", "3. NP", "Podkroví"];

export interface FloorplanDraft {
  version: 1;
  /** Podklad: nahraný obrázek / PDF převedený na obrázek (otočení a ořez fáze 57); null = čistý rastr. */
  background: FloorplanBackground | null;
  /** Fáze 57: kalibrace měřítka a její ověření druhou kótou / měřítkem výkresu. */
  calibration: CalibrationRecord;
  /** Fáze 57: měřítko značek (1 = 300 mm v půdorysu). */
  symbolScale: number;
  /** Fáze 57: prostředí instalace dle ČSN 33 2000-5-51 ed. 3 – povinná volba před generováním; null = nezvoleno. */
  environment: EnvironmentId | null;
  /** Měřítko podkladu [mm / px] po kalibraci. */
  mmPerPx: number;
  /** Velikost plochy v mm (rastr bez podkladu). */
  widthMm: number;
  heightMm: number;
  rooms: EditorRoom[];
  elements: EditorElement[];
  /** Fáze 59: víceramečky a zakreslené změny aktivního podlaží. */
  frames: FrameGroup[];
  annotations: Annotation[];
  /**
   * Fáze 59: vícepodlažní dům. Kořen nákresu = aktivní podlaží (podklad, kalibrace, místnosti, prvky …), ostatní podlaží
   * leží v `otherFloors`; přepnutí = `switchFloor`. Výpočty pro celý dům vždy přes `floorsOf` / `allElements`.
   */
  floorId: string;
  floorName: string;
  floorLevelMm: number;
  otherFloors: FloorSheet[];
  profile: ElevationProfile;
  mode: CableRoutingMode;
  /** Výchozí designová řada („ABB|Levit“) – platí pro nově vkládané prvky. */
  series: string | null;
  /** Výchozí barva přístrojů (fáze 51). */
  color: string;
  /** Fáze 52: úroveň instalace, způsob uložení kabelů, souběh kabelů a počítání dvojzásuvky. */
  installation: InstallLevel;
  installMethod: InstallMethod;
  groupedCables: number;
  countDoubleAsTwo: boolean;
  /** Fáze 55: soustava přívodu rozváděče (1f / 3f, TN-C-S / TN-S / TT). */
  supplySystem: SupplySystem["id"];
  /** Fáze 61: systém chytré domácnosti na sběrnicové úrovni (abb_freeathome / abb_knx / loxone; fáze 63 taphome). */
  smartSystem: string;
  /** Fáze 63: knihovna spotřebičů nákresu – upravené vestavěné a vlastní spotřebiče (výpočet okruhů i na serveru). */
  appliances: ApplianceSpec[];
  /** Fáze 63: ručně upravené trasy úseků („od>do“, rozváděč = `panel`) – lomená čára v mm půdorysu. */
  routeEdits: Record<string, { x: number; y: number }[]>;
  /** Fáze 63: zobrazení kabelů – barevně podle okruhů, nebo normové CAD značení (rysky žil, štítky okruhů). */
  cableView: "color" | "cad";
  /** Fáze 65: rozdělení běžných zásuvek do okruhů – kompaktní zóny (nový nákres), po místnostech, podle vzdálenosti (nákres do fáze 64). */
  socketGrouping: SocketGrouping;
  /** Fáze 65: ručně přidané moduly chytré domácnosti na DIN lištu nad výpočet (id modulu → kusy). */
  smartExtras: Record<string, number>;
  updatedAt: number;
}

export const emptyDraft = (): FloorplanDraft => ({
  version: 1,
  background: null,
  calibration: emptyCalibration(),
  symbolScale: 1,
  environment: null,
  mmPerPx: 10,
  widthMm: 14_000,
  heightMm: 10_000,
  rooms: [],
  elements: [],
  frames: [],
  annotations: [],
  floorId: "f1",
  floorName: "1. NP",
  floorLevelMm: 0,
  otherFloors: [],
  profile: { ...DEFAULT_ELEVATION },
  mode: "OPTIMIZED",
  series: "ABB|Levit",
  color: DEFAULT_COLOR,
  installation: "classic",
  installMethod: "C",
  groupedCables: 1,
  countDoubleAsTwo: true,
  supplySystem: DEFAULT_SUPPLY.id,
  smartSystem: "abb_freeathome",
  appliances: [],
  routeEdits: {},
  cableView: "color",
  socketGrouping: "compact",
  smartExtras: {},
  updatedAt: 0,
});

/** Načtení uloženého nákresu (localStorage / akce) s kontrolou tvaru; neplatný → null. */
export function parseDraft(value: unknown): FloorplanDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<FloorplanDraft>;
  if (draft.version !== 1 || !Array.isArray(draft.elements) || !Array.isArray(draft.rooms)) return null;
  const base = emptyDraft();
  const num: Num = (input, fallback, min, max) => (typeof input === "number" && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : fallback);
  const sheet = parseSheet(draft, num, { id: base.floorId, name: base.floorName, levelMm: 0 });
  // Fáze 59: ostatní podlaží (starší nákresy = jedno podlaží 1. NP)
  const seen = new Set([sheet.id]);
  const otherFloors = (Array.isArray(draft.otherFloors) ? draft.otherFloors : [])
    .filter((floor): floor is FloorSheet => Boolean(floor) && typeof floor === "object" && Array.isArray(floor.elements) && Array.isArray(floor.rooms))
    .slice(0, MAX_FLOORS - 1)
    .map((floor, index) => parseSheet(floor, num, { id: `f${index + 2}`, name: `${index + 2}. NP`, levelMm: (index + 1) * DEFAULT_STOREY_MM }))
    .filter((floor) => !seen.has(floor.id) && seen.add(floor.id));
  return {
    ...base,
    background: sheet.background,
    calibration: sheet.calibration,
    symbolScale: clampSymbolScale(num(draft.symbolScale, 1, SYMBOL_SCALE_MIN, SYMBOL_SCALE_MAX)),
    environment: isEnvironmentId(draft.environment) ? draft.environment : null,
    mmPerPx: sheet.mmPerPx,
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
    rooms: sheet.rooms,
    elements: sheet.elements,
    frames: sheet.frames,
    annotations: sheet.annotations,
    floorId: sheet.id,
    floorName: sheet.name,
    floorLevelMm: sheet.levelMm,
    otherFloors,
    profile: elevationProfile(draft.profile ?? {}),
    mode: draft.mode === "BOTTOM" || draft.mode === "TOP" || draft.mode === "OPTIMIZED" ? draft.mode : "OPTIMIZED",
    series: typeof draft.series === "string" ? draft.series.slice(0, 80) : null,
    color: typeof draft.color === "string" && designColor(draft.color) ? draft.color : DEFAULT_COLOR,
    installation: isInstallLevel(draft.installation) ? draft.installation : base.installation,
    installMethod: isInstallMethod(draft.installMethod) ? draft.installMethod : base.installMethod,
    groupedCables: Math.round(num(draft.groupedCables, 1, 1, 20)),
    countDoubleAsTwo: typeof draft.countDoubleAsTwo === "boolean" ? draft.countDoubleAsTwo : true,
    supplySystem: supplyById(draft.supplySystem).id,
    smartSystem: SMART_SYSTEM_IDS.includes(draft.smartSystem as string) ? (draft.smartSystem as string) : base.smartSystem,
    appliances: parseApplianceList(draft.appliances),
    routeEdits: parseRouteEdits(draft.routeEdits, num),
    cableView: draft.cableView === "cad" ? "cad" : "color",
    // Fáze 65: nákres z doby před volbou rozdělení zůstane u dosavadního rozdělení (stejné okruhy jako vygenerovaný rozváděč)
    socketGrouping: isSocketGrouping(draft.socketGrouping) ? draft.socketGrouping : "distance",
    smartExtras: parseSmartExtras(draft.smartExtras),
    updatedAt: num(draft.updatedAt, 0, 0, 1e15),
  };
}

type Num = (input: unknown, fallback: number, min: number, max: number) => number;

/** Fáze 61: systémy chytré domácnosti (`lib/panel-builder/smart-home.ts`) – kopie id bez importu (bez cyklu modulů). */
const SMART_SYSTEM_IDS = ["abb_freeathome", "abb_knx", "loxone", "taphome"];

/** Fáze 63: natočení ve stupních 0–360 (na 0,1°); neplatné = 0. */
export const normalizeRotation = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? ((Math.round(value * 10) / 10) % 360 + 360) % 360 : 0);

const ROUTE_KEY = /^[\w#-]{1,48}>[\w#-]{1,48}$/;

/** Fáze 63: ruční trasy z uložených dat – klíč „od>do“, 2–60 bodů, nejvýš 300 úseků. */
function parseRouteEdits(value: unknown, num: Num): Record<string, { x: number; y: number }[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, { x: number; y: number }[]> = {};
  for (const [key, points] of Object.entries(value as Record<string, unknown>).slice(0, 300)) {
    if (!ROUTE_KEY.test(key) || !Array.isArray(points)) continue;
    const parsed = points
      .filter((point): point is { x: number; y: number } => Boolean(point) && typeof point === "object" && typeof (point as { x: unknown }).x === "number" && typeof (point as { y: unknown }).y === "number")
      .slice(0, 60)
      .map((point) => ({ x: Math.round(num(point.x, 0, -1e6, 1e6) * 10) / 10, y: Math.round(num(point.y, 0, -1e6, 1e6) * 10) / 10 }));
    if (parsed.length >= 2) out[key] = parsed;
  }
  return out;
}

/** Nejvýš podlaží v jednom nákresu (suterén + 3 NP + podkroví …). */
export const MAX_FLOORS = 6;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

/** Jedno podlaží z uložených dat (kořen staršího nákresu nebo položka `otherFloors`). */
function parseSheet(raw: Partial<FloorSheet> & Partial<Pick<FloorplanDraft, "floorId" | "floorName" | "floorLevelMm">>, num: Num, fallback: { id: string; name: string; levelMm: number }): FloorSheet {
  const background = parseBackground(raw.background, num);
  const mmPerPx = num(raw.mmPerPx, 10, 0.01, 1000);
  // S podkladem plyne plocha výkresu z ořezu a měřítka (fáze 57), jinak z uloženého rastru
  const extent = background ? planExtent(background, mmPerPx) : null;
  const elements = (raw.elements ?? [])
    .filter((element) => element && typeof element.id === "string" && paletteItem(element.item))
    .slice(0, 400)
    .map((element): EditorElement => ({
      id: element.id.slice(0, 40),
      item: element.item,
      x: num(element.x, 0, -1e6, 1e6),
      y: num(element.y, 0, -1e6, 1e6),
      room: typeof element.room === "string" && element.room.trim() ? element.room.trim().slice(0, 40) : "Místnost",
      mountHeightMm: typeof element.mountHeightMm === "number" && Number.isFinite(element.mountHeightMm) ? Math.min(6000, Math.max(0, element.mountHeightMm)) : null,
      frameUnits: Math.round(num(element.frameUnits, 1, 1, 5)),
      series: typeof element.series === "string" ? element.series.slice(0, 80) : null,
      color: typeof element.color === "string" && designColor(element.color) ? element.color : null,
      controls: Array.isArray(element.controls) ? element.controls.filter((id): id is string => typeof id === "string").slice(0, 20) : [],
      rotation: normalizeRotation(element.rotation),
      scale: typeof element.scale === "number" && Number.isFinite(element.scale) ? clampSymbolScale(element.scale) : null,
      ...(element.light ? { light: parseLightSpec(element.light, num) } : {}),
      // Fáze 63: rozměr zařizovacího předmětu, vlastní spotřebič a výrobek z lišty výrobců
      ...parseExtras(element, num),
    }));
  const ids = new Set(elements.map((element) => element.id));
  const framed = new Set<string>();
  const frames = (Array.isArray(raw.frames) ? raw.frames : [])
    .filter((frame) => frame && typeof frame.id === "string" && Array.isArray(frame.members))
    .slice(0, 100)
    .map((frame) => ({ id: frame.id.slice(0, 40), members: frame.members.filter((id): id is string => typeof id === "string" && ids.has(id) && !framed.has(id) && Boolean(framed.add(id))).slice(0, 5) }))
    .filter((frame) => frame.members.length >= 2);
  const annotations = (Array.isArray(raw.annotations) ? raw.annotations : [])
    .filter((note) => note && typeof note.id === "string" && (note.kind === "wall" || note.kind === "demolish" || note.kind === "zone" || note.kind === "text"))
    .slice(0, 200)
    .map((note): Annotation => ({
      id: note.id.slice(0, 40),
      kind: note.kind,
      x: num(note.x, 0, -1e6, 1e6),
      y: num(note.y, 0, -1e6, 1e6),
      x2: num(note.x2, num(note.x, 0, -1e6, 1e6), -1e6, 1e6),
      y2: num(note.y2, num(note.y, 0, -1e6, 1e6), -1e6, 1e6),
      color: typeof note.color === "string" && COLOR_RE.test(note.color) ? note.color : ANNOTATION_DEFAULTS[note.kind].color,
      hatch: isHatch(note.hatch) ? note.hatch : ANNOTATION_DEFAULTS[note.kind].hatch,
      thicknessMm: Math.round(num(note.thicknessMm, ANNOTATION_DEFAULTS[note.kind].thicknessMm, 20, 1000)),
      text: typeof note.text === "string" ? note.text.slice(0, 500) : "",
      fontMm: Math.round(num(note.fontMm, 250, 40, 3000)),
      bold: note.bold === true,
      background: note.background !== false,
    }));
  const id = typeof raw.floorId === "string" ? raw.floorId : typeof raw.id === "string" ? raw.id : fallback.id;
  const name = typeof raw.floorName === "string" ? raw.floorName : typeof raw.name === "string" ? raw.name : fallback.name;
  const level = raw.floorLevelMm ?? raw.levelMm;
  return {
    id: id.slice(0, 20) || fallback.id,
    name: name.trim().slice(0, 30) || fallback.name,
    levelMm: Math.round(num(level, fallback.levelMm, -20_000, 60_000)),
    background,
    calibration: parseCalibration(raw.calibration, num),
    mmPerPx,
    widthMm: extent ? Math.max(100, extent.widthMm) : num(raw.widthMm, 14_000, 1000, 200_000),
    heightMm: extent ? Math.max(100, extent.heightMm) : num(raw.heightMm, 10_000, 1000, 200_000),
    rooms: (raw.rooms ?? [])
      .filter((room) => room && typeof room.id === "string" && typeof room.name === "string")
      .slice(0, 60)
      .map((room): EditorRoom => {
        const base = { id: room.id.slice(0, 40), name: room.name.slice(0, 40), x: num(room.x, 0, -1e6, 1e6), y: num(room.y, 0, -1e6, 1e6), w: num(room.w, 1000, 100, 1e6), h: num(room.h, 1000, 100, 1e6) };
        // Fáze 63: polygonální místnost – obálka se dopočítá z rohů
        const points = Array.isArray(room.points)
          ? room.points.filter((point) => point && typeof point.x === "number" && typeof point.y === "number").slice(0, 40).map((point) => ({ x: Math.round(num(point.x, 0, -1e6, 1e6)), y: Math.round(num(point.y, 0, -1e6, 1e6)) }))
          : [];
        if (points.length < 3) return base;
        const bounds = polygonBounds(points);
        return bounds.w >= 100 && bounds.h >= 100 ? { ...base, ...bounds, points } : base;
      }),
    elements,
    frames,
    annotations,
  };
}

/** Fáze 65: ruční zásuvkový okruh „Z1“ … „Z99“. */
export const SOCKET_CIRCUIT = /^Z[1-9]\d?$/;

/** Fáze 65: ručně přidané moduly chytré domácnosti (id modulu → 1 … 20 kusů). */
function parseSmartExtras(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key, count]) => /^[\w-]{1,40}$/.test(key) && typeof count === "number" && Number.isInteger(count) && count > 0)
      .slice(0, 40)
      .map(([key, count]) => [key, Math.min(20, count as number)]),
  );
}

/** Fáze 63: rozměr předmětu, vlastní spotřebič a výrobek prvku z uložených dat; fáze 65 ruční zásuvkový okruh. */
function parseExtras(element: Partial<EditorElement> & { item: string }, num: Num): Pick<EditorElement, "sizeMm" | "appliance" | "product" | "socketCircuit"> {
  const fixture = fixtureSpecOf(element.item);
  const size = element.sizeMm && typeof element.sizeMm === "object" ? element.sizeMm : null;
  return {
    ...(fixture && size ? { sizeMm: { w: clampFixture(num(size.w, fixture.w, 1, 1e5)), d: clampFixture(num(size.d, fixture.d, 1, 1e5)) } } : {}),
    ...(element.item === CUSTOM_APPLIANCE_ITEM && typeof element.appliance === "string" && /^[\w-]{1,40}$/.test(element.appliance) ? { appliance: element.appliance } : {}),
    ...(typeof element.product === "string" && productById(element.product) ? { product: element.product } : {}),
    ...(typeof element.socketCircuit === "string" && SOCKET_CIRCUIT.test(element.socketCircuit) ? { socketCircuit: element.socketCircuit } : {}),
  };
}

/** Výchozí vzhled zakreslených změn (nová příčka červeně šrafovaná, bouraná konstrukce žlutě křížem). */
export const ANNOTATION_DEFAULTS: Record<AnnotationKind, Pick<Annotation, "color" | "hatch" | "thicknessMm">> = {
  wall: { color: "#dc2626", hatch: "diagonal", thicknessMm: 100 },
  demolish: { color: "#d97706", hatch: "cross", thicknessMm: 150 },
  zone: { color: "#2563eb", hatch: "diagonal", thicknessMm: 50 },
  text: { color: "#111827", hatch: "none", thicknessMm: 50 },
};

function parseBackground(value: unknown, num: Num): FloorplanBackground | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<FloorplanBackground>;
  if (typeof raw.url !== "string" || !/^\/api\/files\/photos\/[\w.-]+$/.test(raw.url)) return null;
  const background: FloorplanBackground = {
    url: raw.url,
    widthPx: num(raw.widthPx, 1000, 1, 20_000),
    heightPx: num(raw.heightPx, 1000, 1, 20_000),
    rotation: isRotation(raw.rotation) ? raw.rotation : 0,
    crop: null,
    pagePt: raw.pagePt && typeof raw.pagePt === "object" ? { width: num(raw.pagePt.width, 0, 1, 20_000), height: num(raw.pagePt.height, 0, 1, 20_000) } : null,
  };
  if (background.pagePt && (!background.pagePt.width || !background.pagePt.height)) background.pagePt = null;
  const size = rotatedSize(background);
  if (raw.crop && typeof raw.crop === "object") {
    const x = num(raw.crop.x, 0, 0, size.w - 1);
    const y = num(raw.crop.y, 0, 0, size.h - 1);
    const w = num(raw.crop.w, size.w, 1, size.w - x);
    const h = num(raw.crop.h, size.h, 1, size.h - y);
    background.crop = { x, y, w, h };
  }
  return background;
}

function parseCalibration(value: unknown, num: Num): CalibrationRecord {
  if (!value || typeof value !== "object") return emptyCalibration();
  const raw = value as Partial<CalibrationRecord>;
  const state = raw.state === "set" || raw.state === "verified" ? raw.state : "none";
  const check = raw.check && typeof raw.check === "object" && typeof raw.check.measuredMm === "number" && typeof raw.check.expectedMm === "number" ? { measuredMm: num(raw.check.measuredMm, 0, 0, 1e7), expectedMm: num(raw.check.expectedMm, 0, 0, 1e7), deviationPct: num(raw.check.deviationPct, 0, -1000, 1000) } : null;
  return {
    state,
    referenceMm: typeof raw.referenceMm === "number" ? num(raw.referenceMm, 0, 0, 1e7) : null,
    check,
    drawingScale: typeof raw.drawingScale === "number" ? num(raw.drawingScale, 0, 1, 10_000) : null,
    scaleDeviationPct: typeof raw.scaleDeviationPct === "number" ? num(raw.scaleDeviationPct, 0, -1000, 1000) : null,
    at: typeof raw.at === "number" ? num(raw.at, 0, 0, 1e15) : null,
  };
}

// ---------------------------------------------------------------------------
//  Fáze 59: podlaží domu
// ---------------------------------------------------------------------------

type FloorsLike = Pick<FloorplanDraft, "elements"> & Partial<Pick<FloorplanDraft, "otherFloors">>;

/** Aktivní podlaží jako samostatný list. */
export function activeSheet(draft: FloorplanDraft): FloorSheet {
  return {
    id: draft.floorId,
    name: draft.floorName,
    levelMm: draft.floorLevelMm,
    background: draft.background,
    calibration: draft.calibration,
    mmPerPx: draft.mmPerPx,
    widthMm: draft.widthMm,
    heightMm: draft.heightMm,
    rooms: draft.rooms,
    elements: draft.elements,
    frames: draft.frames,
    annotations: draft.annotations,
  };
}

/** Všechna podlaží domu seřazená odspodu (aktivní podlaží z kořene nákresu). */
export const floorsOf = (draft: FloorplanDraft): FloorSheet[] => [activeSheet(draft), ...draft.otherFloors].sort((a, b) => a.levelMm - b.levelMm || a.name.localeCompare(b.name, "cs"));

/** Prvky všech podlaží (párování vypínač → světlo může vést i mezi podlažími – schodiště). */
export const allElements = (draft: FloorsLike): EditorElement[] => [...draft.elements, ...(draft.otherFloors ?? []).flatMap((floor) => floor.elements)];

/** Úprava prvků na všech podlažích (např. odpojení smazaného světla z párování). */
export function mapAllElements(draft: FloorplanDraft, map: (element: EditorElement) => EditorElement): FloorplanDraft {
  return { ...draft, elements: draft.elements.map(map), otherFloors: draft.otherFloors.map((floor) => ({ ...floor, elements: floor.elements.map(map) })) };
}

function loadSheet(draft: FloorplanDraft, sheet: FloorSheet): FloorplanDraft {
  return {
    ...draft,
    floorId: sheet.id,
    floorName: sheet.name,
    floorLevelMm: sheet.levelMm,
    background: sheet.background,
    calibration: sheet.calibration,
    mmPerPx: sheet.mmPerPx,
    widthMm: sheet.widthMm,
    heightMm: sheet.heightMm,
    rooms: sheet.rooms,
    elements: sheet.elements,
    frames: sheet.frames,
    annotations: sheet.annotations,
  };
}

/** Přepnutí na jiné podlaží: aktivní list se odloží do `otherFloors`, cílový se načte do kořene. */
export function switchFloor(draft: FloorplanDraft, floorId: string): FloorplanDraft {
  if (floorId === draft.floorId) return draft;
  const target = draft.otherFloors.find((floor) => floor.id === floorId);
  if (!target) return draft;
  return { ...loadSheet(draft, target), otherFloors: [...draft.otherFloors.filter((floor) => floor.id !== floorId), activeSheet(draft)] };
}

/**
 * Nové podlaží (prázdný rastr se stejnou plochou a měřítkem jako aktivní) – rovnou se na něj přepne. Výchozí výška =
 * o jednu konstrukční výšku nad nejvyšším podlažím; název „N. NP“.
 */
export function addFloor(draft: FloorplanDraft, input: { name?: string; levelMm?: number } = {}): FloorplanDraft {
  const floors = floorsOf(draft);
  if (floors.length >= MAX_FLOORS) return draft;
  const top = floors[floors.length - 1];
  const used = new Set(floors.map((floor) => floor.id));
  let index = floors.length + 1;
  while (used.has(`f${index}`)) index++;
  const levelMm = input.levelMm ?? top.levelMm + DEFAULT_STOREY_MM;
  const names = new Set(floors.map((floor) => floor.name));
  let name = input.name?.trim().slice(0, 30) || `${Math.round(levelMm / DEFAULT_STOREY_MM) + 1}. NP`;
  for (let n = 2; names.has(name); n++) name = `${input.name?.trim() || "Podlaží"} ${n}`;
  const sheet: FloorSheet = { id: `f${index}`, name, levelMm, background: null, calibration: emptyCalibration(), mmPerPx: draft.mmPerPx, widthMm: draft.widthMm, heightMm: draft.heightMm, rooms: [], elements: [], frames: [], annotations: [] };
  return switchFloor({ ...draft, otherFloors: [...draft.otherFloors, sheet] }, sheet.id);
}

/** Smazání podlaží i s prvky (poslední podlaží zůstane); vypínače jinde se od smazaných světel odpojí. */
export function removeFloor(draft: FloorplanDraft, floorId: string): FloorplanDraft {
  const floors = floorsOf(draft);
  if (floors.length <= 1) return draft;
  const removed = floors.find((floor) => floor.id === floorId);
  if (!removed) return draft;
  const gone = new Set(removed.elements.map((element) => element.id));
  const base = floorId === draft.floorId ? switchFloor(draft, floors.find((floor) => floor.id !== floorId)!.id) : draft;
  return mapAllElements({ ...base, otherFloors: base.otherFloors.filter((floor) => floor.id !== floorId) }, (element) => (element.controls.some((id) => gone.has(id)) ? { ...element, controls: element.controls.filter((id) => !gone.has(id)) } : element));
}

/** Název a výška podlaží. */
export function updateFloor(draft: FloorplanDraft, floorId: string, patch: { name?: string; levelMm?: number }): FloorplanDraft {
  const name = (value: string) => value.trim().slice(0, 30);
  const level = (value: number) => Math.round(Math.min(60_000, Math.max(-20_000, value)));
  if (floorId === draft.floorId) return { ...draft, ...(patch.name !== undefined && name(patch.name) ? { floorName: name(patch.name) } : {}), ...(patch.levelMm !== undefined && Number.isFinite(patch.levelMm) ? { floorLevelMm: level(patch.levelMm) } : {}) };
  return {
    ...draft,
    otherFloors: draft.otherFloors.map((floor) => (floor.id === floorId ? { ...floor, ...(patch.name !== undefined && name(patch.name) ? { name: name(patch.name) } : {}), ...(patch.levelMm !== undefined && Number.isFinite(patch.levelMm) ? { levelMm: level(patch.levelMm) } : {}) } : floor)),
  };
}

/** „±0,000“ / „+3,000“ / „−2,800“ – výškový údaj podlaží v metrech jako ve stavebních výkresech. */
export const levelLabel = (levelMm: number) => `${levelMm > 0 ? "+" : levelMm < 0 ? "−" : "±"}${(Math.abs(levelMm) / 1000).toLocaleString("cs-CZ", { minimumFractionDigits: 3, maximumFractionDigits: 3 })}`;

/** Kalibrace ověřená (druhá kóta v toleranci) nebo podklad bez měřítka (čistý rastr) – podmínka generování. */
export const calibrationConfirmed = (draft: Pick<FloorplanDraft, "background" | "calibration">) => !draft.background || draft.calibration.state === "verified";

/** Kontrolní seznam před generováním rozváděče a dokumentace (fáze 57, fáze 59: měřítko na každém podlaží). */
export function generationChecklist(draft: Pick<FloorplanDraft, "background" | "calibration" | "environment"> & Partial<FloorplanDraft>) {
  const sheets = draft.otherFloors?.length ? floorsOf(draft as FloorplanDraft) : [{ name: draft.floorName ?? "", background: draft.background, calibration: draft.calibration }];
  const pending = sheets.filter((sheet) => !calibrationConfirmed(sheet));
  const multi = sheets.length > 1;
  const items = [
    {
      id: "calibration",
      ok: pending.length === 0,
      label: multi
        ? pending.length
          ? `Ověřte měřítko podkladu podlaží ${pending.map((sheet) => sheet.name).join(", ")} (Úprava PDF → Kalibrovat / Ověřit měřítko)`
          : `Měřítko ověřeno na všech podlažích (${sheets.length})`
        : !draft.background
          ? "Měřítko: čistý rastr 1 dílek = 1 m"
          : draft.calibration.state === "verified"
            ? `Měřítko ověřeno${draft.calibration.check ? ` (odchylka ${Math.abs(draft.calibration.check.deviationPct).toLocaleString("cs-CZ")} % ≤ ${CALIBRATION_TOLERANCE_PCT} %)` : ""}`
            : draft.calibration.state === "set"
              ? "Měřítko nastaveno – ověřte ho druhou známou kótou (Úprava PDF → Ověřit měřítko)"
              : "Zkalibrujte měřítko podkladu (Úprava PDF → Kalibrovat měřítko)",
    },
    { id: "environment", ok: draft.environment !== null, label: draft.environment ? "Prostředí dle ČSN 33 2000-5-51 ed. 3 zvoleno" : "Zvolte prostředí instalace dle ČSN 33 2000-5-51 ed. 3" },
  ];
  return { items, ready: items.every((item) => item.ok) };
}

/** Řazení vypínače podle počtu ovládacích míst jednoho světla: 1 → č. 1, 2 → č. 6, 3+ → č. 6 + 7. */
export function switchingFor(count: number): string {
  if (count <= 0) return "–";
  if (count === 1) return "1";
  if (count === 2) return "6 + 6";
  return `6 + 6 + ${count - 2}× 7`;
}

/** Počet vypínačů ovládajících dané světlo (na všech podlažích). */
export const controllersOf = (draft: FloorsLike, lightId: string) => allElements(draft).filter((element) => element.controls.includes(lightId)).length;

/**
 * Skutečné řazení klasického vypínače v nákresu (fáze 57 – podle něj se kreslí značka): pevné řazení palety
 * (S5, S6+6, tlačítka), jinak z párování – jediné ovládací místo světla = č. 1, dvě = č. 6, třetí a další = č. 7.
 */
export function effectiveSwitchNo(draft: FloorsLike, element: Pick<EditorElement, "id" | "item">): string {
  const item = paletteItem(element.item);
  if (item?.fixedSwitchNo) return item.fixedSwitchNo;
  const everything = allElements(draft);
  const self = everything.find((other) => other.id === element.id);
  const light = self ? everything.find((candidate) => self.controls.includes(candidate.id)) : undefined;
  if (!light) return item?.switchNo ?? "1";
  const controllers = everything.filter((other) => other.controls.includes(light.id) && !paletteItem(other.item)?.wireless && !paletteItem(other.item)?.bus);
  const index = controllers.findIndex((other) => other.id === element.id);
  const base = controllers.length <= 1 ? "1" : index < 2 ? "6" : "7";
  return item?.led && base !== "1" ? `${base}So` : item?.led ? (item.switchNo ?? "1So") : base;
}

/** Ovladač s kabelem 230 V k vypínači (ne sběrnice, ne bezdrátový). */
export const isWiredSwitch = (item: PaletteItem | null | undefined) => item?.kind === "switch" && !item.bus && !item.wireless;

/** Značka, která se natáčí „nožičkou“ ke stěně: zásuvky, datové zásuvky a nástěnná svítidla. */
export const isWallMounted = (item: PaletteItem | null | undefined) => item?.kind === "single_socket" || item?.kind === "double_socket" || item?.kind === "data_socket" || (item?.kind === "light" && item.variant === "wall");

/** Otočení ke nejbližší stěně místnosti (0 = stěna nahoře, 90 = vpravo, 180 = dole, 270 = vlevo; fáze 63: šikmá stěna pod svým úhlem). */
export function wallRotation(room: Pick<EditorRoom, "x" | "y" | "w" | "h" | "points"> | null, x: number, y: number): number {
  if (!room) return 0;
  if (isPolygonRoom(room)) return nearestWall(room, x, y)?.rotation ?? 0;
  const distances: [Rotation, number][] = [
    [0, Math.abs(y - room.y)],
    [90, Math.abs(room.x + room.w - x)],
    [180, Math.abs(room.y + room.h - y)],
    [270, Math.abs(x - room.x)],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

/** Bod na nejbližší stěně místnosti (zásuvka se „přicvakne“ ke stěně, je-li blíž než `snapMm`). */
export function snapToWall(room: Pick<EditorRoom, "x" | "y" | "w" | "h" | "points"> | null, x: number, y: number, snapMm = 600): { x: number; y: number } {
  if (!room) return { x, y };
  // Fáze 63: šikmá stěna – kolmý průmět na nejbližší stěnu mnohoúhelníku
  if (isPolygonRoom(room)) {
    const wall = nearestWall(room, x, y);
    return wall && wall.distance <= snapMm ? { x: Math.round(wall.at.x), y: Math.round(wall.at.y) } : { x, y };
  }
  const rotation = wallRotation(room, x, y);
  const target = rotation === 0 ? { x, y: room.y } : rotation === 90 ? { x: room.x + room.w, y } : rotation === 180 ? { x, y: room.y + room.h } : { x: room.x, y };
  return Math.hypot(target.x - x, target.y - y) <= snapMm ? target : { x, y };
}

// ---------------------------------------------------------------------------
//  Fáze 57: převod ovládání při změně úrovně instalace
// ---------------------------------------------------------------------------

const TO_BUS: Record<string, string> = {
  "switch-1": "bus-1",
  "switch-6": "bus-1",
  "switch-7": "bus-1",
  "switch-led": "bus-1",
  "switch-ip44": "bus-1",
  "abb-1so": "bus-1",
  "abb-1s": "bus-1",
  "abb-1sso": "bus-1",
  "abb-7so": "bus-1",
  button: "bus-1",
  "abb-10so": "bus-1",
  "wireless-1": "bus-1",
  "switch-5": "bus-2",
  "switch-6-6": "bus-2",
  "button-2": "bus-2",
  "abb-1-1": "bus-2",
  "abb-6-6-0": "bus-2",
  dimmer: "bus-2",
  "wireless-2": "bus-2",
  blind: "bus-blind",
  pir: "bus-presence",
  "wireless-pir": "bus-presence",
  thermostat: "bus-room",
};

const TO_WIRED: Record<string, string> = {
  "bus-1": "switch-1",
  "bus-2": "switch-5",
  "bus-4": "button-2",
  "bus-6": "button-2",
  "bus-blind": "blind",
  "bus-presence": "pir",
  "bus-room": "thermostat",
  "wireless-1": "switch-1",
  "wireless-2": "switch-5",
  "wireless-pir": "pir",
};

export interface LevelConversion {
  draft: FloorplanDraft;
  /** Převedené ovladače („Vypínač č. 1 → Sběrnicové tlačítko 1násobné“ × počet). */
  changes: { from: string; to: string; count: number }[];
  /** Prvky bez ekvivalentu (dotykový panel, čidlo) – odstraněny. */
  removed: number;
}

/**
 * Změna úrovně instalace (fáze 57): ovladače se převedou na ekvivalent nové úrovně (klasický vypínač ↔ sběrnicové
 * tlačítko ↔ bezdrátové tlačítko), párování se světly zůstává. Prvky, které v nové úrovni nemají obdobu, se odstraní.
 */
export function convertForLevel(draft: FloorplanDraft, level: InstallLevel): LevelConversion {
  const changes = new Map<string, { from: string; to: string; count: number }>();
  const removedIds = new Set<string>();
  // Fáze 59: převod na všech podlažích
  const convert = (element: EditorElement): EditorElement[] => {
    const item = paletteItem(element.item);
    if (!item || availableIn(item, level)) return [element];
    const target = level === "bus_loxone" ? TO_BUS[item.id] : TO_WIRED[item.id];
    const next = target ? paletteItem(target) : null;
    if (!next) {
      removedIds.add(element.id);
      return [];
    }
    const key = `${item.id}>${next.id}`;
    const row = changes.get(key) ?? { from: item.label, to: next.label, count: 0 };
    row.count += 1;
    changes.set(key, row);
    // Fáze 63: výrobek z lišty výrobců patří jen ke sběrnicové úrovni
    return [{ ...element, item: next.id, controls: controlsLights(next) ? element.controls : [], product: undefined }];
  };
  const clean = (elements: EditorElement[]) => elements.map((element) => ({ ...element, controls: element.controls.filter((id) => !removedIds.has(id)) }));
  const active = draft.elements.flatMap(convert);
  const others = draft.otherFloors.map((floor) => ({ ...floor, elements: floor.elements.flatMap(convert) }));
  const frames = (list: FrameGroup[]) => list.map((frame) => ({ ...frame, members: frame.members.filter((id) => !removedIds.has(id)) })).filter((frame) => frame.members.length >= 2);
  return {
    draft: { ...draft, installation: level, elements: clean(active), frames: frames(draft.frames), otherFloors: others.map((floor) => ({ ...floor, elements: clean(floor.elements), frames: frames(floor.frames) })) },
    changes: [...changes.values()],
    removed: removedIds.size,
  };
}

/** Co změna úrovně udělá s nákresem (náhled pro potvrzení) – bez změny stavu. */
export const levelConversionPreview = (draft: FloorplanDraft, level: InstallLevel) => {
  const result = convertForLevel(draft, level);
  return { changes: result.changes, removed: result.removed, count: result.changes.reduce((sum, row) => sum + row.count, 0) };
};

/** Místnost podle obdélníku, do kterého bod padne (nejmenší vyhrává). */
export function roomAt(rooms: readonly EditorRoom[], x: number, y: number): EditorRoom | null {
  // Fáze 63: i polygonální místnosti (test bodu v mnohoúhelníku, nejmenší plocha vyhrává)
  return [...rooms].filter((room) => pointInRoom(room, x, y)).sort((a, b) => roomArea(a) - roomArea(b))[0] ?? null;
}

/** Rozteč krabic ve vícenásobném rámečku [mm]. */
export const FRAME_PITCH_MM = 71;

export interface PlanBuild {
  plan: Floorplan;
  calibration: Calibration;
  /** Rozváděč – výchozí bod všech tras (s podlažím, fáze 59). */
  panel: RoutePoint;
  routeNodes: RouteNode[];
  switchLinks: { switchId: string; lightId: string; cable?: string }[];
  /** Žaluziové ovladače a termostaty (fáze 51). */
  controlRuns: { id: string; kind: "blind" | "thermostat"; targetId: string | null }[];
  dataNodeIds: string[];
  /** Fáze 57: sběrnicové prvky (tlačítka, čidla, jednotky) – jedna sběrnicová linka z rozváděče. */
  busNodeIds: string[];
  /** Uzel výpočtu → prvek nákresu (vícenásobný rámeček = víc uzlů). */
  elementOf: Map<string, EditorElement>;
  /** Fáze 59: podlaží se stoupacím vedením a měřidlo tras (vodorovně na podlaží, svisle mezi podlažími). */
  floors: FloorLink[];
  metric: RouteMetric;
  /** Fáze 60: podlaží s trasami podél stěn (místnosti / nové příčky); ostatní pravoúhle. */
  wallFloors: string[];
}

/** Fáze 59: osa víceramečku podle natočení kotvy (stěna nahoře / dole = vodorovně, vlevo / vpravo = svisle). */
export const frameAxis = (rotation: number) => {
  // Fáze 63: rámeček u šikmé stěny leží v ose stěny
  const angle = ((Math.round(rotation * 10) / 10) % 180 + 180) % 180;
  if (angle === 0) return { x: 1, y: 0 };
  if (angle === 90) return { x: 0, y: 1 };
  return { x: Math.cos((angle * Math.PI) / 180), y: Math.sin((angle * Math.PI) / 180) };
};

/** Nákres → vstup mostu půdorys → rozváděč (1 px = 1 mm) a 3D kabeláže přes všechna podlaží; bez rozváděče → chyba. */
export function buildPlan(draft: FloorplanDraft): PlanBuild {
  const floors = floorsOf(draft);
  const panelFloor = floors.find((floor) => floor.elements.some((element) => element.item === "panel"));
  const panelElement = panelFloor?.elements.find((element) => element.item === "panel");
  if (!panelFloor || !panelElement) throw new Error("Umístěte do půdorysu rozváděč (⚡ Rozváděč) – z něj vedou všechny trasy.");
  const profile = draft.profile;
  const multi = floors.length > 1;
  const everything = floors.flatMap((floor) => floor.elements);
  const roomIds = new Map<string, { id: string; name: string; floor: string; source: string }>();
  const roomId = (floor: FloorSheet, name: string) => {
    const key = `${floor.id}|${name}`;
    if (!roomIds.has(key)) roomIds.set(key, { id: `m${roomIds.size + 1}`, name: multi ? `${name} (${floor.name})` : name, floor: floor.id, source: name });
    return roomIds.get(key)!.id;
  };
  // Stoupací vedení: značka „↕“ na podlaží, jinak stejné místo jako na jiném podlaží (svislá šachta – podlaží v jedné
  // poloze výkresu), jinak svisle nad / pod rozváděčem
  const riserOf = (floor: FloorSheet) => floor.elements.find((element) => element.item === "riser");
  const fallbackRiser = riserOf(panelFloor) ?? floors.map(riserOf).find((riser) => riser !== undefined) ?? panelElement;
  const links: FloorLink[] = floors.map((floor) => {
    const riser = riserOf(floor) ?? fallbackRiser;
    return { id: floor.id, levelMm: floor.levelMm, riser: { x: riser.x, y: riser.y } };
  });
  // Fáze 60: trasy podél stěn – graf ze stěn místností a nově zakreslených příček každého podlaží
  const bases = new Map<string, RouteMetric>();
  for (const floor of floors) {
    const partitions = floor.annotations.filter((note) => note.kind === "wall").map((note) => ({ x1: note.x, y1: note.y, x2: note.x2, y2: note.y2 }));
    const graph = buildWallGraph(wallSegments(floor.rooms, partitions));
    if (graph.edges.length) bases.set(floor.id, wallMetric(graph, MANHATTAN));
  }
  const metric = floorMetric(links, bases);
  const panel: RoutePoint = { x: panelElement.x, y: panelElement.y, floor: panelFloor.id };
  const nodes: FloorNode[] = [];
  const routeNodes: RouteNode[] = [];
  const elementOf = new Map<string, EditorElement>();
  const dataNodeIds: string[] = [];
  const busNodeIds: string[] = [];
  /** Výška krabice pro výpočet (vlastní, z palety, jinak podle druhu). */
  const heightOf = (element: EditorElement, item: PaletteItem) => (element.mountHeightMm !== null ? element.mountHeightMm : (item.heightMm ?? null));
  const homeRun = (point: RoutePoint, heightMm: number) => homeRunLength({ x: 0, y: 0 }, { x: metric.distance(panel, point), y: 0 }, heightMm, draft.mode, profile);
  for (const floor of floors) {
    // Fáze 59: víceramček = krabice vedle sebe v rozteči 71 mm od kotvy (propojení přímo v krabici)
    const frameSlot = new Map<string, { frame: string; origin: { x: number; y: number }; axis: { x: number; y: number }; start: number }>();
    for (const frame of floor.frames) {
      const anchor = floor.elements.find((element) => element.id === frame.members[0]);
      if (!anchor) continue;
      const axis = frameAxis(anchor.rotation);
      let start = 0;
      for (const memberId of frame.members) {
        const member = floor.elements.find((element) => element.id === memberId);
        if (!member) continue;
        frameSlot.set(memberId, { frame: frame.id, origin: { x: anchor.x, y: anchor.y }, axis, start });
        start += Math.max(1, member.frameUnits);
      }
    }
    for (const element of floor.elements) {
      const item = paletteItem(element.item);
      if (!item || item.kind === "panel" || item.kind === "riser" || item.kind === "fixture") continue;
      // Fáze 63: samostatný spotřebič z knihovny (upravený / vlastní) a výrobek z lišty výrobců
      const spec = item.kind === "appliance" ? applianceSpecFor(draft.appliances, element) : null;
      const override = applianceOverride(spec);
      const product = productById(element.product);
      const units = item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch" ? element.frameUnits : 1;
      const slot = frameSlot.get(element.id);
      const frame = slot?.frame ?? (units > 1 ? element.id : null);
      for (let unit = 0; unit < units; unit++) {
        const id = units > 1 ? `${element.id}#${unit + 1}` : element.id;
        const offset = ((slot?.start ?? 0) + unit) * FRAME_PITCH_MM;
        const px: [number, number] = slot ? [slot.origin.x + slot.axis.x * offset, slot.origin.y + slot.axis.y * offset] : [element.x + unit * FRAME_PITCH_MM, element.y];
        const height = heightOf(element, item) ?? spec?.heightMm ?? null;
        const node: FloorNode = {
          id,
          room: roomId(floor, element.room),
          kind: item.kind,
          px,
          ...(item.tag ? { tag: item.tag } : {}),
          ...(item.variant ? { variant: item.variant } : {}),
          ...(height !== null ? { mountHeightMm: height } : {}),
          ...(frame ? { frame } : {}),
          ...(multi ? { floor: floor.id } : {}),
          ...(override ? { appliance: override } : {}),
          // Fáze 65: ruční zásuvkový okruh (jen zásuvky)
          ...(element.socketCircuit && (item.kind === "single_socket" || item.kind === "double_socket") ? { socketCircuit: element.socketCircuit } : {}),
        };
        const heightMm = mountHeight(node, profile);
        node.lengthMm = homeRun({ x: px[0], y: px[1], floor: floor.id }, heightMm);
        nodes.push(node);
        elementOf.set(id, element);
        routeNodes.push({ id, x: px[0], y: px[1], heightMm, room: node.room, floor: floor.id, ...(frame ? { frame } : {}) });
        if (item.kind === "data_socket") dataNodeIds.push(id);
        // Bezdrátový výrobek / samostatný systém (videotelefon) nejde na sběrnicovou linku
        if (item.bus && draft.installation === "bus_loxone" && !product?.noBus) busNodeIds.push(id);
      }
    }
  }
  // Ovládání světel po místnostech: počet ovládacích míst = vypínače spárované se světly místnosti (i mezi podlažími)
  const switchLinks = everything.flatMap((element) => {
    const item = paletteItem(element.item);
    // Bezdrátové tlačítko nemá kabel ani ovládací místo v zapojení (spíná modul u svítidla)
    if (!controlsLights(item) || item?.wireless) return [];
    // Dvojitý střídavý č. 6+6: korespondenční pár pro obě větve (L + 2 × 2 žíly)
    const cable = item?.fixedSwitchNo === "6+6" ? { cable: DOUBLE_TWO_WAY_CABLE } : {};
    return element.controls.filter((lightId) => everything.some((light) => light.id === lightId)).map((lightId) => ({ switchId: element.id, lightId, ...cable }));
  });
  // Termostat → nejbližší zdroj tepla (tepelné čerpadlo / bojler), jinak topný okruh v rozváděči
  const heating = routeNodes.filter((node) => {
    const tag = paletteItem(elementOf.get(node.id)?.item ?? "")?.tag;
    return tag === "heat_pump" || tag === "boiler";
  });
  const controlRuns = routeNodes.flatMap((node) => {
    const control = paletteItem(elementOf.get(node.id)?.item ?? "")?.control;
    if (control !== "blind" && control !== "thermostat") return [];
    const target = control === "thermostat" ? ([...heating].sort((a, b) => metric.distance(a, node) - metric.distance(b, node))[0] ?? null) : null;
    return [{ id: node.id, kind: control, targetId: target?.id ?? null }];
  });
  const rooms = [...roomIds.values()].map((room) => {
    const floor = floors.find((candidate) => candidate.id === room.floor)!;
    const lights = floor.elements.filter((element) => element.room === room.source && paletteItem(element.item)?.kind === "light");
    const switches = new Set(switchLinks.filter((link) => lights.some((light) => light.id === link.lightId)).map((link) => link.switchId));
    return { id: room.id, name: room.name, ...(multi ? { floor: floor.id } : {}), ...(lights.length && switches.size ? { lighting: { groups: 1 as const, switchCount: Math.min(6, switches.size) } } : {}) };
  });
  const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 1000 }], panelPx: [panel.x, panel.y], elevation: profile, routing: draft.mode });
  return { plan: { rooms, nodes, mode: draft.installation }, calibration, panel, routeNodes, switchLinks, controlRuns, dataNodeIds, busNodeIds, elementOf, floors: links, metric, wallFloors: [...bases.keys()] };
}

/** Kalibrace na 2 kliky: úsečka v mm současného měřítka a skutečná délka → nové měřítko a přepočet prvků. */
export function recalibrate(draft: FloorplanDraft, segmentMm: number, realMm: number): FloorplanDraft {
  if (!(segmentMm > 0) || !(realMm > 0)) return draft;
  const ratio = realMm / segmentMm;
  const scale = (value: number) => Math.round(value * ratio);
  return {
    ...draft,
    mmPerPx: draft.mmPerPx * ratio,
    widthMm: scale(draft.widthMm),
    heightMm: scale(draft.heightMm),
    rooms: draft.rooms.map((room) => ({ ...room, x: scale(room.x), y: scale(room.y), w: scale(room.w), h: scale(room.h), ...(room.points ? { points: room.points.map((point) => ({ x: scale(point.x), y: scale(point.y) })) } : {}) })),
    elements: draft.elements.map((element) => ({ ...element, x: scale(element.x), y: scale(element.y) })),
    // Fáze 63: ruční trasy drží polohu na podkladu
    routeEdits: Object.fromEntries(Object.entries(draft.routeEdits ?? {}).map(([key, points]) => [key, points.map((point) => ({ x: scale(point.x), y: scale(point.y) }))])),
    // Fáze 59: zakreslené změny drží polohu na podkladu (tloušťka a písmo zůstávají ve skutečných mm)
    annotations: draft.annotations.map((note) => ({ ...note, x: scale(note.x), y: scale(note.y), x2: scale(note.x2), y2: scale(note.y2) })),
  };
}

/** „4,5 m“ / „4500 mm“ / „4500“ → mm (bez jednotky: < 100 = metry). */
export function parseLength(text: string): number | null {
  const match = /^\s*(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*$/i.exec(text);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  const unit = match[2]?.toLowerCase() ?? (value < 100 ? "m" : "mm");
  const mm = unit === "m" ? value * 1000 : unit === "cm" ? value * 10 : value;
  return mm > 0 ? Math.round(mm) : null;
}

// ---------------------------------------------------------------------------
//  Výkaz kabeláže uložený u projektu (dokumentace, list 4)
// ---------------------------------------------------------------------------

export const ROUTING_LABEL: Record<CableRoutingMode, string> = { BOTTOM: "Spodem (v podlaze)", TOP: "Vrchem (stropem / podhledem)", OPTIMIZED: "Optimalizovaně (Auto)" };

export interface CableReport {
  mode: CableRoutingMode;
  totals: Record<CableRoutingMode, number>;
  savingVsBottomM: number;
  savingVsTopM: number;
  byCable: { cable: string; meters: number }[];
  circuits: { label: string; cable: string; routing: "BOTTOM" | "TOP"; lengthM: number; longestM: number; voltageDropPct: number; limitPct: number; ok: boolean }[];
  profile: Pick<ElevationProfile, "ceilingHeightMm" | "switchboardHeightMm" | "defaultSocketHeightMm" | "worktopSocketHeightMm" | "defaultSwitchHeightMm" | "slackPercent">;
}

export function parseCableReport(json: string | null | undefined): CableReport | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as CableReport;
    return value && Array.isArray(value.byCable) && Array.isArray(value.circuits) && value.totals ? value : null;
  } catch {
    return null;
  }
}

/** Volby návrhu dle ČSN 33 2130 ed. 4 z nákresu (fáze 52; fáze 65 rozdělení zásuvek). */
export const designOptionsOf = (draft: Pick<FloorplanDraft, "installMethod" | "groupedCables" | "countDoubleAsTwo"> & Partial<Pick<FloorplanDraft, "environment" | "socketGrouping">>): DesignOptions => ({
  installMethod: draft.installMethod,
  groupedCables: draft.groupedCables,
  countDoubleAsTwo: draft.countDoubleAsTwo,
  environment: draft.environment ?? null,
  ...(draft.socketGrouping ? { socketGrouping: draft.socketGrouping } : {}),
});

/** Živý výpočet nad nákresem (klient i server): okruhy dle ČSN 33 2130 ed. 4 a výkaz kabeláže ve 3 režimech. */
export function analyzeDraft(draft: FloorplanDraft) {
  const build = buildPlan(draft);
  const circuits = generateCircuitsFromFloorplan(build.plan, build.calibration, designOptionsOf(draft));
  const summary = summarizeCabling({ circuits: circuits.circuits, nodes: build.routeNodes, panel: build.panel, profile: draft.profile, selected: draft.mode, switchLinks: build.switchLinks, controlRuns: build.controlRuns, dataNodeIds: build.dataNodeIds, busNodeIds: build.busNodeIds, installation: draft.installation, metric: build.metric, routeEdits: draft.routeEdits });
  return { build, circuits, summary };
}

// ---------------------------------------------------------------------------
//  Fáze 51: úpravy místností a vzhled domovních přístrojů
// ---------------------------------------------------------------------------

/** Nejmenší rozměr místnosti [mm]. */
export const MIN_ROOM_MM = 500;

const insideRoom = (room: EditorRoom, x: number, y: number) => pointInRoom(room, x, y);

/** Posun místnosti o dx / dy – prvky uvnitř místnosti se posouvají s ní. */
export function moveRoom(draft: FloorplanDraft, roomId: string, dx: number, dy: number): FloorplanDraft {
  const room = draft.rooms.find((candidate) => candidate.id === roomId);
  if (!room || (!dx && !dy)) return draft;
  return {
    ...draft,
    rooms: draft.rooms.map((candidate) => (candidate.id === roomId ? { ...candidate, x: candidate.x + dx, y: candidate.y + dy, ...(candidate.points ? { points: translatePolygon(candidate.points, dx, dy) } : {}) } : candidate)),
    elements: draft.elements.map((element) => (element.room === room.name && insideRoom(room, element.x, element.y) ? { ...element, x: element.x + dx, y: element.y + dy } : element)),
  };
}

export type RoomHandle = "n" | "s" | "e" | "w" | "se";

/** Změna rozměru tažením za stěnu / roh: nový obdélník (min. 0,5 m, stěny se nepřeklopí). */
export function resizeRect(rect: Pick<EditorRoom, "x" | "y" | "w" | "h">, handle: RoomHandle, point: { x: number; y: number }): Pick<EditorRoom, "x" | "y" | "w" | "h"> {
  let { x, y, w, h } = rect;
  if (handle === "e" || handle === "se") w = Math.max(MIN_ROOM_MM, point.x - x);
  if (handle === "s" || handle === "se") h = Math.max(MIN_ROOM_MM, point.y - y);
  if (handle === "w") {
    const right = x + w;
    x = Math.min(point.x, right - MIN_ROOM_MM);
    w = right - x;
  }
  if (handle === "n") {
    const bottom = y + h;
    y = Math.min(point.y, bottom - MIN_ROOM_MM);
    h = bottom - y;
  }
  return { x, y, w, h };
}

/** Úprava místnosti (název, rozměr); přejmenování se propíše do prvků místnosti. */
export function updateRoom(draft: FloorplanDraft, roomId: string, patch: Partial<Pick<EditorRoom, "name" | "x" | "y" | "w" | "h">>): FloorplanDraft {
  const room = draft.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return draft;
  const name = patch.name !== undefined ? patch.name.trim().slice(0, 40) || room.name : room.name;
  let next: EditorRoom = { ...room, ...patch, name, w: Math.max(MIN_ROOM_MM, patch.w ?? room.w), h: Math.max(MIN_ROOM_MM, patch.h ?? room.h) };
  // Fáze 63: polygonální místnost – nový rozměr obálky přepočítá rohy (posun obálky je posune)
  if (room.points?.length) {
    const kx = next.w / room.w;
    const ky = next.h / room.h;
    const origin = next;
    next = { ...next, points: room.points.map((point) => ({ x: Math.round(origin.x + (point.x - room.x) * kx), y: Math.round(origin.y + (point.y - room.y) * ky) })) };
  }
  return {
    ...draft,
    rooms: draft.rooms.map((candidate) => (candidate.id === roomId ? next : candidate)),
    elements: name !== room.name ? draft.elements.map((element) => (element.room === room.name ? { ...element, room: name } : element)) : draft.elements,
  };
}

/** Smazání místnosti – prvky zůstanou v půdorysu (přejdou do místnosti, ve které leží, jinak „Místnost“). */
export function deleteRoom(draft: FloorplanDraft, roomId: string): FloorplanDraft {
  const room = draft.rooms.find((candidate) => candidate.id === roomId);
  if (!room) return draft;
  const rooms = draft.rooms.filter((candidate) => candidate.id !== roomId);
  return {
    ...draft,
    rooms,
    elements: draft.elements.map((element) => (element.room === room.name ? { ...element, room: roomAt(rooms, element.x, element.y)?.name ?? "Místnost" } : element)),
  };
}

/** Rychlé názvy místností. */
export const ROOM_NAME_CHIPS = ["Obývací pokoj", "Kuchyně", "Ložnice", "Dětský pokoj", "Koupelna", "WC", "Chodba", "Technická místnost", "Garáž"];

/** Kóty obdélníku: „4,5 m“, „3 × 4,5 m (13,5 m²)“. */
export function roomDimensions(w: number, h: number) {
  const m = (mm: number) => (Math.abs(mm) / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 });
  const area = (Math.abs(w) * Math.abs(h)) / 1e6;
  return { x: `${m(w)} m`, y: `${m(h)} m`, label: `${m(w)} × ${m(h)} m (${area.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} m²)` };
}

/** Prvek s domovním přístrojem (zásuvky, ovladače, datové zásuvky) – má řadu a barvu. */
export const hasWiringDevice = (element: EditorElement) => {
  const kind = paletteItem(element.item)?.kind;
  return kind === "single_socket" || kind === "double_socket" || kind === "switch" || kind === "data_socket";
};

/** „🔄 Použít na celý půdorys“ (všechna podlaží) / „Použít na vybranou místnost“ (aktivní podlaží): řada a barva. */
export function applyAppearance(draft: FloorplanDraft, scope: { room?: string } = {}): FloorplanDraft {
  const apply = (element: EditorElement) => (hasWiringDevice(element) ? { ...element, series: draft.series, color: draft.color } : element);
  if (scope.room !== undefined) return { ...draft, elements: draft.elements.map((element) => (element.room === scope.room ? apply(element) : element)) };
  return mapAllElements(draft, apply);
}

/** Soupis domovní instalace: druh prvku × vzhled (výrobce, řada, barva) → počet kusů. */
export function wiringInventory(draft: FloorplanDraft): { label: string; appearance: string; seriesKey: string | null; color: string; count: number }[] {
  const rows = new Map<string, { label: string; appearance: string; seriesKey: string | null; color: string; count: number }>();
  for (const element of allElements(draft)) {
    if (!hasWiringDevice(element)) continue;
    const item = paletteItem(element.item)!;
    const seriesKey = element.series ?? draft.series;
    const color = element.color ?? draft.color;
    const key = `${item.id}|${seriesKey}|${color}`;
    const row = rows.get(key) ?? { label: item.label, appearance: appearanceLabel(seriesKey, color), seriesKey, color, count: 0 };
    row.count += element.frameUnits;
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) => a.appearance.localeCompare(b.appearance, "cs") || a.label.localeCompare(b.label, "cs"));
}
