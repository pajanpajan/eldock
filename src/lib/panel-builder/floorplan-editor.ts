// 2D editor půdorysu elektroinstalace (fáze 49): paleta značek, stav nákresu (v mm půdorysu) a převod
// na vstup mostu „půdorys → rozváděč“ (`src/engine/floorplan-bridge.ts`) a 3D výpočtu kabeláže.
// Čisté funkce – bezpečné pro klient i server.

import { summarizeCabling, type RouteNode } from "@/engine/cable-routing";
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
  { id: "switch-1", group: "lights", label: "Vypínač č. 1", symbol: "S1", kind: "switch", switchNo: "1" },
  { id: "switch-5", group: "lights", label: "Sériový č. 5", symbol: "S5", kind: "switch", switchNo: "5" },
  { id: "switch-6", group: "lights", label: "Střídavý č. 6", symbol: "S6", kind: "switch", switchNo: "6" },
  { id: "switch-7", group: "lights", label: "Křížový č. 7", symbol: "S7", kind: "switch", switchNo: "7" },
  { id: "button", group: "lights", label: "Tlačítko", symbol: "T", kind: "switch", variant: "button", switchNo: "1/0" },
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
  /** Výchozí designová řada („ABB|Levit“). */
  series: string | null;
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
        controls: Array.isArray(element.controls) ? element.controls.filter((id): id is string => typeof id === "string").slice(0, 20) : [],
      })),
    profile: elevationProfile(draft.profile ?? {}),
    mode: draft.mode === "BOTTOM" || draft.mode === "TOP" || draft.mode === "OPTIMIZED" ? draft.mode : "OPTIMIZED",
    series: typeof draft.series === "string" ? draft.series.slice(0, 80) : null,
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
  switchLinks: { switchId: string; lightId: string }[];
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
        ...(element.mountHeightMm !== null ? { mountHeightMm: element.mountHeightMm } : {}),
        ...(units > 1 ? { frame: element.id } : {}),
      };
      nodes.push(node);
      elementOf.set(id, element);
      routeNodes.push({ id, x: node.px[0], y: node.px[1], heightMm: mountHeight(node, profile), room: node.room, ...(units > 1 ? { frame: element.id } : {}) });
      if (item.kind === "data_socket") dataNodeIds.push(id);
    }
  }
  // Ovládání světel po místnostech: počet ovládacích míst = vypínače spárované se světly místnosti
  const switchLinks = draft.elements.flatMap((element) => (paletteItem(element.item)?.kind === "switch" ? element.controls.filter((lightId) => draft.elements.some((light) => light.id === lightId)).map((lightId) => ({ switchId: element.id, lightId })) : []));
  const rooms = [...roomIds.entries()].map(([name, id]) => {
    const lights = draft.elements.filter((element) => element.room === name && paletteItem(element.item)?.kind === "light");
    const switches = new Set(switchLinks.filter((link) => lights.some((light) => light.id === link.lightId)).map((link) => link.switchId));
    return { id, name, ...(lights.length && switches.size ? { lighting: { groups: 1 as const, switchCount: Math.min(6, switches.size) } } : {}) };
  });
  const panel = { x: panelElement.x, y: panelElement.y };
  const calibration = calibrateFloorplanScale({ walls: [{ px: [0, 0, 1000, 0], lengthMm: 1000 }], panelPx: [panel.x, panel.y], elevation: profile, routing: draft.mode });
  return { plan: { rooms, nodes, mode: "classic" }, calibration, panel, routeNodes, switchLinks, dataNodeIds, elementOf };
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
  const summary = summarizeCabling({ circuits: circuits.circuits, nodes: build.routeNodes, panel: build.panel, profile: draft.profile, selected: draft.mode, switchLinks: build.switchLinks, dataNodeIds: build.dataNodeIds });
  return { build, circuits, summary };
}
