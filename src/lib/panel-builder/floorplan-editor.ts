// 2D editor půdorysu elektroinstalace (fáze 49): paleta značek, stav nákresu (v mm půdorysu) a převod
// na vstup mostu „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`) a 3D výpočtu kabeláže.
// Čisté funkce – bezpečné pro klient i server.

import { DOUBLE_TWO_WAY_CABLE, summarizeCabling, type RouteNode } from "@/engine/cable-routing";
import {
  DEFAULT_ELEVATION,
  calibrateFloorplanScale,
  elevationProfile,
  generateCircuitsFromFloorplan,
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
import { DEFAULT_SUPPLY, supplyById, type SupplySystem } from "./supply";
import { isEnvironmentId, type EnvironmentId } from "./environments";
import { CALIBRATION_TOLERANCE_PCT, emptyCalibration, isRotation, planExtent, rotatedSize, type CalibrationRecord, type FloorplanBackground, type Rotation } from "./floorplan-pdf";

export type PaletteGroup = "panel" | "sockets" | "lights" | "controls" | "appliances";

/** Fáze 57: role sběrnicového prvku (KNX / Loxone Tree / free@home) – kreslí se v rámečku „sběrnice“. */
export type BusRole = "button" | "presence" | "room_unit" | "sensor" | "display" | "blind";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  /** Krátká značka v půdorysu. */
  symbol: string;
  kind: NodeKind | "panel";
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
}

export const PALETTE_GROUPS: { id: PaletteGroup; label: string }[] = [
  { id: "panel", label: "⚡ Rozváděč" },
  { id: "sockets", label: "🔌 Zásuvky" },
  { id: "lights", label: "💡 Světla" },
  { id: "controls", label: "🎛️ Ovládání" },
  { id: "appliances", label: "🔥 Samostatné spotřebiče (vlastní jisticí okruh)" },
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
];

export const paletteItem = (id: string) => PALETTE.find((item) => item.id === id) ?? null;

/** Paleta pro úroveň instalace (fáze 57): ovládání se mění, zásuvky / světla / spotřebiče zůstávají. */
export const paletteFor = (level: InstallLevel) => PALETTE.filter((item) => !item.levels || item.levels.includes(level));
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
  /** Fáze 57: otočení značky (zásuvka „nožičkou“ ke stěně) a vlastní měřítko značky (null = měřítko nákresu). */
  rotation: Rotation;
  scale: number | null;
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
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  profile: { ...DEFAULT_ELEVATION },
  mode: "OPTIMIZED",
  series: "ABB|Levit",
  color: DEFAULT_COLOR,
  installation: "classic",
  installMethod: "C",
  groupedCables: 1,
  countDoubleAsTwo: true,
  supplySystem: DEFAULT_SUPPLY.id,
  updatedAt: 0,
});

/** Načtení uloženého nákresu (localStorage / akce) s kontrolou tvaru; neplatný → null. */
export function parseDraft(value: unknown): FloorplanDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<FloorplanDraft>;
  if (draft.version !== 1 || !Array.isArray(draft.elements) || !Array.isArray(draft.rooms)) return null;
  const base = emptyDraft();
  const num = (input: unknown, fallback: number, min: number, max: number) => (typeof input === "number" && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : fallback);
  const background = parseBackground(draft.background, num);
  const mmPerPx = num(draft.mmPerPx, base.mmPerPx, 0.01, 1000);
  // S podkladem plyne plocha výkresu z ořezu a měřítka (fáze 57), jinak z uloženého rastru
  const extent = background ? planExtent(background, mmPerPx) : null;
  return {
    ...base,
    background,
    calibration: parseCalibration(draft.calibration, num),
    symbolScale: clampSymbolScale(num(draft.symbolScale, 1, SYMBOL_SCALE_MIN, SYMBOL_SCALE_MAX)),
    environment: isEnvironmentId(draft.environment) ? draft.environment : null,
    mmPerPx,
    widthMm: extent ? Math.max(100, extent.widthMm) : num(draft.widthMm, base.widthMm, 1000, 200_000),
    heightMm: extent ? Math.max(100, extent.heightMm) : num(draft.heightMm, base.heightMm, 1000, 200_000),
    rooms: draft.rooms
      .filter((room) => room && typeof room.id === "string" && typeof room.name === "string")
      .slice(0, 60)
      .map((room) => ({ id: room.id.slice(0, 40), name: room.name.slice(0, 40), x: num(room.x, 0, -1e6, 1e6), y: num(room.y, 0, -1e6, 1e6), w: num(room.w, 1000, 100, 1e6), h: num(room.h, 1000, 100, 1e6) })),
    elements: draft.elements
      .filter((element) => element && typeof element.id === "string" && paletteItem(element.item))
      .slice(0, 400)
      .map((element) => ({
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
        rotation: isRotation(element.rotation) ? element.rotation : 0,
        scale: typeof element.scale === "number" && Number.isFinite(element.scale) ? clampSymbolScale(element.scale) : null,
      })),
    profile: elevationProfile(draft.profile ?? {}),
    mode: draft.mode === "BOTTOM" || draft.mode === "TOP" || draft.mode === "OPTIMIZED" ? draft.mode : "OPTIMIZED",
    series: typeof draft.series === "string" ? draft.series.slice(0, 80) : null,
    color: typeof draft.color === "string" && designColor(draft.color) ? draft.color : DEFAULT_COLOR,
    installation: isInstallLevel(draft.installation) ? draft.installation : base.installation,
    installMethod: isInstallMethod(draft.installMethod) ? draft.installMethod : base.installMethod,
    groupedCables: Math.round(num(draft.groupedCables, 1, 1, 20)),
    countDoubleAsTwo: typeof draft.countDoubleAsTwo === "boolean" ? draft.countDoubleAsTwo : true,
    supplySystem: supplyById(draft.supplySystem).id,
    updatedAt: num(draft.updatedAt, 0, 0, 1e15),
  };
}

type Num = (input: unknown, fallback: number, min: number, max: number) => number;

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

/** Kalibrace ověřená (druhá kóta v toleranci) nebo podklad bez měřítka (čistý rastr) – podmínka generování. */
export const calibrationConfirmed = (draft: Pick<FloorplanDraft, "background" | "calibration">) => !draft.background || draft.calibration.state === "verified";

/** Kontrolní seznam před generováním rozváděče a dokumentace (fáze 57). */
export function generationChecklist(draft: Pick<FloorplanDraft, "background" | "calibration" | "environment">) {
  const items = [
    {
      id: "calibration",
      ok: calibrationConfirmed(draft),
      label: !draft.background
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

/** Počet vypínačů ovládajících dané světlo. */
export const controllersOf = (draft: Pick<FloorplanDraft, "elements">, lightId: string) => draft.elements.filter((element) => element.controls.includes(lightId)).length;

/**
 * Skutečné řazení klasického vypínače v nákresu (fáze 57 – podle něj se kreslí značka): pevné řazení palety
 * (S5, S6+6, tlačítka), jinak z párování – jediné ovládací místo světla = č. 1, dvě = č. 6, třetí a další = č. 7.
 */
export function effectiveSwitchNo(draft: Pick<FloorplanDraft, "elements">, element: Pick<EditorElement, "id" | "item">): string {
  const item = paletteItem(element.item);
  if (item?.fixedSwitchNo) return item.fixedSwitchNo;
  const light = draft.elements.find((candidate) => draft.elements.some((other) => other.id === element.id && other.controls.includes(candidate.id)));
  if (!light) return item?.switchNo ?? "1";
  const controllers = draft.elements.filter((other) => other.controls.includes(light.id) && !paletteItem(other.item)?.wireless && !paletteItem(other.item)?.bus);
  const index = controllers.findIndex((other) => other.id === element.id);
  const base = controllers.length <= 1 ? "1" : index < 2 ? "6" : "7";
  return item?.led && base !== "1" ? `${base}So` : item?.led ? (item.switchNo ?? "1So") : base;
}

/** Ovladač s kabelem 230 V k vypínači (ne sběrnice, ne bezdrátový). */
export const isWiredSwitch = (item: PaletteItem | null | undefined) => item?.kind === "switch" && !item.bus && !item.wireless;

/** Značka, která se natáčí „nožičkou“ ke stěně: zásuvky, datové zásuvky a nástěnná svítidla. */
export const isWallMounted = (item: PaletteItem | null | undefined) => item?.kind === "single_socket" || item?.kind === "double_socket" || item?.kind === "data_socket" || (item?.kind === "light" && item.variant === "wall");

/** Otočení ke nejbližší stěně místnosti (0 = stěna nahoře, 90 = vpravo, 180 = dole, 270 = vlevo). */
export function wallRotation(room: Pick<EditorRoom, "x" | "y" | "w" | "h"> | null, x: number, y: number): Rotation {
  if (!room) return 0;
  const distances: [Rotation, number][] = [
    [0, Math.abs(y - room.y)],
    [90, Math.abs(room.x + room.w - x)],
    [180, Math.abs(room.y + room.h - y)],
    [270, Math.abs(x - room.x)],
  ];
  return distances.sort((a, b) => a[1] - b[1])[0][0];
}

/** Bod na nejbližší stěně místnosti (zásuvka se „přicvakne“ ke stěně, je-li blíž než `snapMm`). */
export function snapToWall(room: Pick<EditorRoom, "x" | "y" | "w" | "h"> | null, x: number, y: number, snapMm = 600): { x: number; y: number } {
  if (!room) return { x, y };
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
  const elements = draft.elements.flatMap((element): EditorElement[] => {
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
    return [{ ...element, item: next.id, controls: controlsLights(next) ? element.controls : [] }];
  });
  return {
    draft: { ...draft, installation: level, elements: elements.map((element) => ({ ...element, controls: element.controls.filter((id) => !removedIds.has(id)) })) },
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
  return [...rooms].filter((room) => x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h).sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null;
}

/** Rozteč krabic ve vícenásobném rámečku [mm]. */
export const FRAME_PITCH_MM = 71;

export interface PlanBuild {
  plan: Floorplan;
  calibration: Calibration;
  panel: { x: number; y: number };
  routeNodes: RouteNode[];
  switchLinks: { switchId: string; lightId: string; cable?: string }[];
  /** Žaluziové ovladače a termostaty (fáze 51). */
  controlRuns: { id: string; kind: "blind" | "thermostat"; targetId: string | null }[];
  dataNodeIds: string[];
  /** Fáze 57: sběrnicové prvky (tlačítka, čidla, jednotky) – jedna sběrnicová linka z rozváděče. */
  busNodeIds: string[];
  /** Uzel výpočtu → prvek nákresu (vícenásobný rámeček = víc uzlů). */
  elementOf: Map<string, EditorElement>;
}

/** Nákres → vstup mostu půdorys → rozváděč (1 px = 1 mm) a 3D kabeláže; bez rozváděče → chyba. */
export function buildPlan(draft: FloorplanDraft): PlanBuild {
  const panelElement = draft.elements.find((element) => element.item === "panel");
  if (!panelElement) throw new Error("Umístěte do půdorysu rozváděč (⚡ Rozváděč) – z něj vedou všechny trasy.");
  const profile = draft.profile;
  const roomIds = new Map<string, string>();
  const roomId = (name: string) => {
    if (!roomIds.has(name)) roomIds.set(name, `m${roomIds.size + 1}`);
    return roomIds.get(name)!;
  };
  const nodes: FloorNode[] = [];
  const routeNodes: RouteNode[] = [];
  const elementOf = new Map<string, EditorElement>();
  const dataNodeIds: string[] = [];
  const busNodeIds: string[] = [];
  for (const element of draft.elements) {
    const item = paletteItem(element.item);
    if (!item || item.kind === "panel") continue;
    const units = item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "data_socket" || item.kind === "switch" ? element.frameUnits : 1;
    for (let unit = 0; unit < units; unit++) {
      const id = units > 1 ? `${element.id}#${unit + 1}` : element.id;
      const node: FloorNode = {
        id,
        room: roomId(element.room),
        kind: item.kind,
        px: [element.x + unit * FRAME_PITCH_MM, element.y],
        ...(item.tag ? { tag: item.tag } : {}),
        ...(item.variant ? { variant: item.variant } : {}),
        ...(element.mountHeightMm !== null ? { mountHeightMm: element.mountHeightMm } : item.heightMm ? { mountHeightMm: item.heightMm } : {}),
        ...(units > 1 ? { frame: element.id } : {}),
      };
      nodes.push(node);
      elementOf.set(id, element);
      routeNodes.push({ id, x: node.px[0], y: node.px[1], heightMm: mountHeight(node, profile), room: node.room, ...(units > 1 ? { frame: element.id } : {}) });
      if (item.kind === "data_socket") dataNodeIds.push(id);
      if (item.bus && draft.installation === "bus_loxone") busNodeIds.push(id);
    }
  }
  // Ovládání světel po místnostech: počet ovládacích míst = vypínače spárované se světly místnosti
  const switchLinks = draft.elements.flatMap((element) => {
    const item = paletteItem(element.item);
    // Bezdrátové tlačítko nemá kabel ani ovládací místo v zapojení (spíná modul u svítidla)
    if (!controlsLights(item) || item?.wireless) return [];
    // Dvojitý střídavý č. 6+6: korespondenční pár pro obě větve (L + 2 × 2 žíly)
    const cable = item?.fixedSwitchNo === "6+6" ? { cable: DOUBLE_TWO_WAY_CABLE } : {};
    return element.controls.filter((lightId) => draft.elements.some((light) => light.id === lightId)).map((lightId) => ({ switchId: element.id, lightId, ...cable }));
  });
  // Termostat → nejbližší zdroj tepla (tepelné čerpadlo / bojler), jinak topný okruh v rozváděči
  const heating = routeNodes.filter((node) => {
    const tag = paletteItem(elementOf.get(node.id)?.item ?? "")?.tag;
    return tag === "heat_pump" || tag === "boiler";
  });
  const distance = (a: RouteNode, b: RouteNode) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const controlRuns = routeNodes.flatMap((node) => {
    const control = paletteItem(elementOf.get(node.id)?.item ?? "")?.control;
    if (control !== "blind" && control !== "thermostat") return [];
    const target = control === "thermostat" ? ([...heating].sort((a, b) => distance(a, node) - distance(b, node))[0] ?? null) : null;
    return [{ id: node.id, kind: control, targetId: target?.id ?? null }];
  });
  const rooms = [...roomIds.entries()].map(([name, id]) => {
    const lights = draft.elements.filter((element) => element.room === name && paletteItem(element.item)?.kind === "light");
    const switches = new Set(switchLinks.filter((link) => lights.some((light) => light.id === link.lightId)).map((link) => link.switchId));
    return { id, name, ...(lights.length && switches.size ? { lighting: { groups: 1 as const, switchCount: Math.min(6, switches.size) } } : {}) };
  });
  const panel = { x: panelElement.x, y: panelElement.y };
  const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 1000 }], panelPx: [panel.x, panel.y], elevation: profile, routing: draft.mode });
  return { plan: { rooms, nodes, mode: draft.installation }, calibration, panel, routeNodes, switchLinks, controlRuns, dataNodeIds, busNodeIds, elementOf };
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
    rooms: draft.rooms.map((room) => ({ ...room, x: scale(room.x), y: scale(room.y), w: scale(room.w), h: scale(room.h) })),
    elements: draft.elements.map((element) => ({ ...element, x: scale(element.x), y: scale(element.y) })),
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

/** Volby návrhu dle ČSN 33 2130 ed. 4 z nákresu (fáze 52). */
export const designOptionsOf = (draft: Pick<FloorplanDraft, "installMethod" | "groupedCables" | "countDoubleAsTwo"> & Partial<Pick<FloorplanDraft, "environment">>): DesignOptions => ({ installMethod: draft.installMethod, groupedCables: draft.groupedCables, countDoubleAsTwo: draft.countDoubleAsTwo, environment: draft.environment ?? null });

/** Živý výpočet nad nákresem (klient i server): okruhy dle ČSN 33 2130 ed. 4 a výkaz kabeláže ve 3 režimech. */
export function analyzeDraft(draft: FloorplanDraft) {
  const build = buildPlan(draft);
  const circuits = generateCircuitsFromFloorplan(build.plan, build.calibration, designOptionsOf(draft));
  const summary = summarizeCabling({ circuits: circuits.circuits, nodes: build.routeNodes, panel: build.panel, profile: draft.profile, selected: draft.mode, switchLinks: build.switchLinks, controlRuns: build.controlRuns, dataNodeIds: build.dataNodeIds, busNodeIds: build.busNodeIds, installation: draft.installation });
  return { build, circuits, summary };
}

// ---------------------------------------------------------------------------
//  Fáze 51: úpravy místností a vzhled domovních přístrojů
// ---------------------------------------------------------------------------

/** Nejmenší rozměr místnosti [mm]. */
export const MIN_ROOM_MM = 500;

const insideRoom = (room: EditorRoom, x: number, y: number) => x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h;

/** Posun místnosti o dx / dy – prvky uvnitř místnosti se posouvají s ní. */
export function moveRoom(draft: FloorplanDraft, roomId: string, dx: number, dy: number): FloorplanDraft {
  const room = draft.rooms.find((candidate) => candidate.id === roomId);
  if (!room || (!dx && !dy)) return draft;
  return {
    ...draft,
    rooms: draft.rooms.map((candidate) => (candidate.id === roomId ? { ...candidate, x: candidate.x + dx, y: candidate.y + dy } : candidate)),
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
  const next = { ...room, ...patch, name, w: Math.max(MIN_ROOM_MM, patch.w ?? room.w), h: Math.max(MIN_ROOM_MM, patch.h ?? room.h) };
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

/** „🔄 Použít na celý půdorys“ / „Použít na vybranou místnost“: řada a barva výchozího nastavení. */
export function applyAppearance(draft: FloorplanDraft, scope: { room?: string } = {}): FloorplanDraft {
  return {
    ...draft,
    elements: draft.elements.map((element) => (hasWiringDevice(element) && (scope.room === undefined || element.room === scope.room) ? { ...element, series: draft.series, color: draft.color } : element)),
  };
}

/** Soupis domovní instalace: druh prvku × vzhled (výrobce, řada, barva) → počet kusů. */
export function wiringInventory(draft: FloorplanDraft): { label: string; appearance: string; seriesKey: string | null; color: string; count: number }[] {
  const rows = new Map<string, { label: string; appearance: string; seriesKey: string | null; color: string; count: number }>();
  for (const element of draft.elements) {
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
