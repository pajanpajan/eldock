// 2D editor půdorysu elektroinstalace (fáze 49): paleta značek, stav nákresu (v mm půdorysu) a převod
// na vstup mostu „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`) a 3D výpočtu kabeláže.
// Čisté funkce – bezpečné pro klient i server.

import { DOUBLE_TWO_WAY_CABLE, summarizeCabling, type RouteNode } from "@/engine/cable-routing";
import {
  DEFAULT_ELEVATION,
  calibrateFloorplanScale,
  elevationProfile,
  generateCircuitsFromFloorplan,
  mountHeight,
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

export type PaletteGroup = "panel" | "sockets" | "lights" | "appliances";

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
  /** Fáze 51 – co ovladač řídí: světla (párování), pohon žaluzie nebo topný okruh. Výchozí u vypínačů = světla. */
  control?: "light" | "blind" | "thermostat";
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
  { id: "lights", label: "💡 Světla a vypínače" },
  { id: "appliances", label: "🔥 Samostatné spotřebiče (vlastní jisticí okruh)" },
];

export const PALETTE: PaletteItem[] = [
  { id: "panel", group: "panel", label: "Hlavní domovní / bytový rozváděč", symbol: "RH", kind: "panel" },
  { id: "socket", group: "sockets", label: "Jednozásuvka", symbol: "Z", kind: "single_socket" },
  { id: "double-socket", group: "sockets", label: "Dvojzásuvka", symbol: "2Z", kind: "double_socket" },
  { id: "worktop-socket", group: "sockets", label: "Zásuvka nad linkou", symbol: "ZL", kind: "double_socket", variant: "worktop" },
  { id: "ip44-socket", group: "sockets", label: "Zásuvka IP44 koupelna / venek", symbol: "Z44", kind: "single_socket", variant: "ip44" },
  { id: "data-socket", group: "sockets", label: "Datová zásuvka RJ45", symbol: "RJ", kind: "data_socket" },
  { id: "ceiling-light", group: "lights", label: "Stropní svítidlo", symbol: "⊗", kind: "light" },
  { id: "wall-light", group: "lights", label: "Nástěnné svítidlo", symbol: "◐", kind: "light", variant: "wall" },
  { id: "switch-1", group: "lights", label: "Vypínač č. 1 (jednopólový)", symbol: "S1", kind: "switch", switchNo: "1" },
  { id: "switch-5", group: "lights", label: "Sériový přepínač č. 5 (lustrový – 2 klapky)", symbol: "S5", kind: "switch", switchNo: "5", fixedSwitchNo: "5" },
  { id: "switch-6", group: "lights", label: "Střídavý přepínač č. 6 (schodový)", symbol: "S6", kind: "switch", switchNo: "6" },
  { id: "switch-6-6", group: "lights", label: "Dvojitý střídavý přepínač č. 6+6 (řazení 5B – 2 klapky)", symbol: "S6+6", kind: "switch", switchNo: "6+6", fixedSwitchNo: "6+6" },
  { id: "switch-7", group: "lights", label: "Křížový přepínač č. 7", symbol: "S7", kind: "switch", switchNo: "7" },
  { id: "button", group: "lights", label: "Tlačítko č. 1/0 (impulzní / zvonkové)", symbol: "T1", kind: "switch", variant: "button", switchNo: "1/0", fixedSwitchNo: "1/0" },
  { id: "button-2", group: "lights", label: "Dvojtlačítko č. 1/0+1/0 (2 klapky)", symbol: "T2", kind: "switch", variant: "button", switchNo: "1/0+1/0", fixedSwitchNo: "1/0+1/0" },
  { id: "blind", group: "lights", label: "Žaluziový spínač / tlačítko (nahoru / dolů)", symbol: "ZAL", kind: "switch", control: "blind", wiringCategory: "WD_BLIND" },
  { id: "dimmer", group: "lights", label: "Stmívač (otočný / tlačítkový LED)", symbol: "STM", kind: "switch", wiringCategory: "WD_DIMMER" },
  { id: "pir", group: "lights", label: "Pohybové čidlo (PIR nástěnné / stropní)", symbol: "PIR", kind: "switch", wiringCategory: "WD_SENSOR", heightMm: 2200 },
  { id: "switch-led", group: "lights", label: "Vypínač s orientační doutnavkou / LED (řazení 1S / 6S)", symbol: "S1S", kind: "switch", switchNo: "1S", led: true },
  { id: "switch-ip44", group: "lights", label: "Vypínač IP44 (do vlhka / venkovní)", symbol: "S44", kind: "switch", switchNo: "1", ip44: true },
  { id: "thermostat", group: "lights", label: "Pokojový termostat", symbol: "TER", kind: "switch", control: "thermostat", wiringCategory: "WD_THERMOSTAT", heightMm: 1500 },
  { id: "cooktop", group: "appliances", label: "Varná deska 3f (400 V)", symbol: "VD", kind: "appliance", tag: "cooktop_3p" },
  { id: "oven", group: "appliances", label: "Trouba", symbol: "TR", kind: "appliance", tag: "oven" },
  { id: "dishwasher", group: "appliances", label: "Myčka", symbol: "MY", kind: "appliance", tag: "dishwasher" },
  { id: "washer", group: "appliances", label: "Pračka", symbol: "PR", kind: "appliance", tag: "washer" },
  { id: "dryer", group: "appliances", label: "Sušička", symbol: "SU", kind: "appliance", tag: "dryer" },
  { id: "fridge", group: "appliances", label: "Chladnička (RCBO)", symbol: "CH", kind: "appliance", tag: "fridge" },
  { id: "boiler", group: "appliances", label: "Bojler", symbol: "BO", kind: "appliance", tag: "boiler" },
  { id: "heat-pump", group: "appliances", label: "Tepelné čerpadlo", symbol: "TČ", kind: "appliance", tag: "heat_pump" },
  { id: "wallbox", group: "appliances", label: "Wallbox EV", symbol: "EV", kind: "appliance", tag: "ev_charger" },
];

export const paletteItem = (id: string) => PALETTE.find((item) => item.id === id) ?? null;

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
}

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
  /** Podklad: nahraný obrázek / PDF převedený na PNG; null = čistý rastr. */
  background: { url: string; widthPx: number; heightPx: number } | null;
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
  updatedAt: number;
}

export const emptyDraft = (): FloorplanDraft => ({
  version: 1,
  background: null,
  mmPerPx: 10,
  widthMm: 14_000,
  heightMm: 10_000,
  rooms: [],
  elements: [],
  profile: { ...DEFAULT_ELEVATION },
  mode: "OPTIMIZED",
  series: "ABB|Levit",
  color: DEFAULT_COLOR,
  updatedAt: 0,
});

/** Načtení uloženého nákresu (localStorage / akce) s kontrolou tvaru; neplatný → null. */
export function parseDraft(value: unknown): FloorplanDraft | null {
  if (!value || typeof value !== "object") return null;
  const draft = value as Partial<FloorplanDraft>;
  if (draft.version !== 1 || !Array.isArray(draft.elements) || !Array.isArray(draft.rooms)) return null;
  const base = emptyDraft();
  const num = (input: unknown, fallback: number, min: number, max: number) => (typeof input === "number" && Number.isFinite(input) ? Math.min(max, Math.max(min, input)) : fallback);
  return {
    ...base,
    background: draft.background && typeof draft.background.url === "string" && /^\/api\/files\/photos\/[\w.-]+$/.test(draft.background.url) ? { url: draft.background.url, widthPx: num(draft.background.widthPx, 1000, 1, 20_000), heightPx: num(draft.background.heightPx, 1000, 1, 20_000) } : null,
    mmPerPx: num(draft.mmPerPx, base.mmPerPx, 0.01, 1000),
    widthMm: num(draft.widthMm, base.widthMm, 1000, 200_000),
    heightMm: num(draft.heightMm, base.heightMm, 1000, 200_000),
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
      })),
    profile: elevationProfile(draft.profile ?? {}),
    mode: draft.mode === "BOTTOM" || draft.mode === "TOP" || draft.mode === "OPTIMIZED" ? draft.mode : "OPTIMIZED",
    series: typeof draft.series === "string" ? draft.series.slice(0, 80) : null,
    color: typeof draft.color === "string" && designColor(draft.color) ? draft.color : DEFAULT_COLOR,
    updatedAt: num(draft.updatedAt, 0, 0, 1e15),
  };
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
    }
  }
  // Ovládání světel po místnostech: počet ovládacích míst = vypínače spárované se světly místnosti
  const switchLinks = draft.elements.flatMap((element) => {
    const item = paletteItem(element.item);
    if (!controlsLights(item)) return [];
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
  return { plan: { rooms, nodes, mode: "classic" }, calibration, panel, routeNodes, switchLinks, controlRuns, dataNodeIds, elementOf };
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

/** Živý výpočet nad nákresem (klient i server): okruhy dle ČSN 33 2130 ed. 4 a výkaz kabeláže ve 3 režimech. */
export function analyzeDraft(draft: FloorplanDraft) {
  const build = buildPlan(draft);
  const circuits = generateCircuitsFromFloorplan(build.plan, build.calibration);
  const summary = summarizeCabling({ circuits: circuits.circuits, nodes: build.routeNodes, panel: build.panel, profile: draft.profile, selected: draft.mode, switchLinks: build.switchLinks, controlRuns: build.controlRuns, dataNodeIds: build.dataNodeIds });
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
