// Fáze 106: výrobní podklady rozváděče na klíč – mechanické provedení skříně (kabelové vývodky podle okruhů, DIN lišty,
// kabelové žlaby, PE / N sběrnice, výřezy ve dveřích), CNC vrtací a frézovací plán 1 : 1 (DXF + CSV pro Perforex /
// Steinhauer), nářezový a drátovací list vnitřních vodičů (Odkud → Kam, průřez, barva, délka po žlabech, dutinky, TWIN
// u smyček, propojovací hřebeny) a nářezový list lišt, žlabů a hřebenů. Deterministické čisté funkce (prohlížeč i server).

export const MODULE_MM = 17.5;
/** Rezerva vodiče na ohyb do svorky (na vodič). */
export const BEND_RESERVE_MM = 90;
/** Výška modulového přístroje na liště a vzdálenost svorky od osy lišty [mm]. */
const DEVICE_HEIGHT_MM = 90;
const TERMINAL_OFFSET_MM = 38;

export type EntryDirection = "top" | "bottom" | "both";
export type MountingType = "flush" | "surface";

export const ENTRY_LABELS: Record<EntryDirection, string> = { top: "⬆️ Shora", bottom: "⬇️ Zespodu", both: "↕️ Shora i zespodu" };
export const MOUNTING_LABELS: Record<MountingType, string> = { flush: "Pod omítku / Do SDK", surface: "Nástěnná / Stojanová s vývodkami" };

/** Přístroj na DIN liště (strom zapojení AI Panel Builderu). */
export interface CncDevice {
  id: string;
  designation: string;
  category: string;
  poles: string;
  modules: number;
  ratedCurrentA: number;
  /** DIN lišta 1… (shora). */
  rail: number;
  /** Pozice na liště v modulech od levého okraje. */
  position: number;
  /** Napájecí přístroj (strom zapojení); null = z přívodních svorek / hlavního vypínače. */
  parentId: string | null;
  label?: string | null;
  /** Vývodový kabel okruhu (z půdorysu / zadaný), např. „CYKY-J 3×1,5“. */
  cable?: string | null;
}

export interface CncEnclosure {
  manufacturer: string;
  model: string;
  rows: number;
  modulesPerRow: number;
  widthMm: number;
  heightMm: number;
  depthMm: number;
  installation?: string | null;
  material?: string | null;
}

export interface DoorOptions {
  centralStop: boolean;
  phaseLamps: boolean;
  meter: boolean;
  /** Ventilační mřížka s filtrem 120 × 120 (výpočet oteplení v kroku 3). */
  ventilation: boolean;
}

export interface CncInput {
  name: string;
  enclosure: CncEnclosure;
  devices: readonly CncDevice[];
  /** Přívodní kabel rozváděče („CYKY-J 5×10“). */
  supplyCable: string;
  /** Sběrnicové / datové kabely vstupující do skříně (počet). */
  busCables?: number;
  entry: EntryDirection;
  mounting: MountingType;
  door: DoorOptions;
}

// ---------------------------------------------------------------------------------------------------------------------
//  Kabelové vývodky
// ---------------------------------------------------------------------------------------------------------------------

export type GlandSize = "M16" | "M20" | "M25" | "M32" | "M40";
export const GLAND_HOLE_MM: Record<GlandSize, number> = { M16: 16.5, M20: 20.5, M25: 25.5, M32: 32.5, M40: 40.5 };

/** Vnější průměr kabelů CYKY-J / CYKY-O [mm] podle katalogů výrobců (střední hodnota, počet žil × průřez). */
const CYKY_DIAMETER_MM: Record<string, number> = {
  "2x1,5": 8.5,
  "3x1,5": 9.2,
  "3x2,5": 10.5,
  "3x4": 12,
  "3x6": 13.5,
  "4x10": 18.5,
  "4x16": 21.5,
  "4x25": 26,
  "5x1,5": 10.8,
  "5x2,5": 12.4,
  "5x4": 14.8,
  "5x6": 16.5,
  "5x10": 20.5,
  "5x16": 23.5,
  "5x25": 28,
  "7x1,5": 11.5,
};

/** Vnější průměr kabelu [mm]: CYKY podle tabulky výrobců, sběrnicové a datové kabely 6,5 mm, jinak odhad z průřezu. */
export function cableDiameterMm(cable: string): number {
  if (/J-Y\(St\)Y|UTP|FTP|Cat|SYKFY|KNX/i.test(cable)) return 6.5;
  const match = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)/.exec(cable);
  if (!match) return 10;
  const known = CYKY_DIAMETER_MM[`${match[1]}x${match[2].replace(".", ",")}`];
  if (known) return known;
  const cores = Number(match[1]);
  const size = Number(match[2].replace(",", "."));
  return Math.round(((Math.sqrt((size * 4) / Math.PI) + 1.6) * (cores <= 3 ? 2.2 : cores <= 5 ? 2.75 : 3.3) + 3.4) * 10) / 10;
}

/** Vývodka podle průměru kabelu (rozsah těsnění M16 4,5–10, M20 6–13, M25 9–17, M32 13–21, M40 19–28 mm). */
export function glandFor(cable: string): GlandSize {
  const diameter = cableDiameterMm(cable);
  if (diameter <= 10) return "M16";
  if (diameter <= 13) return "M20";
  if (diameter <= 17) return "M25";
  if (diameter <= 21) return "M32";
  return "M40";
}

export interface Gland {
  id: string;
  size: GlandSize;
  holeMm: number;
  cable: string;
  label: string;
  side: "top" | "bottom";
  /** Střed otvoru od levého okraje čela [mm]. */
  x: number;
  role: "supply" | "power" | "final" | "bus";
}

// ---------------------------------------------------------------------------------------------------------------------
//  Geometrie montážní desky
// ---------------------------------------------------------------------------------------------------------------------

export interface Hole {
  x: number;
  y: number;
  /** Průměr vrtání [mm] (M5 = 4,2, M6 = 5,0). */
  diameterMm: number;
  thread: "M5" | "M6";
  part: "rail" | "duct" | "bar";
}

export interface Rail {
  index: number;
  y: number;
  x1: number;
  x2: number;
  lengthMm: number;
  holes: Hole[];
}

export interface Duct {
  kind: "horizontal" | "vertical";
  x: number;
  y: number;
  w: number;
  h: number;
  size: "40×60" | "25×60";
  lengthMm: number;
  holes: Hole[];
}

export interface Bar {
  name: string;
  x: number;
  y: number;
  lengthMm: number;
  terminals: number;
  holes: Hole[];
}

export interface DoorCutout {
  kind: "stop" | "lamp" | "meter" | "vent";
  label: string;
  x: number;
  y: number;
  diameterMm?: number;
  w?: number;
  h?: number;
}

export interface PlacedDevice {
  id: string;
  designation: string;
  rail: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CncLayout {
  plate: { widthMm: number; heightMm: number };
  door: { widthMm: number; heightMm: number };
  face: { widthMm: number; depthMm: number };
  rails: Rail[];
  ducts: Duct[];
  bars: Bar[];
  glands: Gland[];
  doorCutouts: DoorCutout[];
  devices: PlacedDevice[];
  /** Membránová příruba místo vývodek (zapuštěná rozvodnice). */
  membrane: boolean;
}

const r1 = (value: number) => Math.round(value * 10) / 10;

/** Montážní deska / rám, lišty, žlaby, sběrnice, vývodky a výřezy dveří. */
export function cncLayout(input: CncInput): CncLayout {
  const { enclosure } = input;
  const plateW = Math.max(200, enclosure.widthMm - 50);
  const plateH = Math.max(200, enclosure.heightMm - 80);
  const sideDuct = 25;
  const rows = Math.max(1, enclosure.rows);
  const usedRails = Math.max(1, ...input.devices.map((device) => device.rail));
  const pitch = (plateH - 70) / (rows + 0.6);
  const railLength = Math.min(plateW - 2 * sideDuct - 10, enclosure.modulesPerRow * MODULE_MM + 20);
  const railX = (plateW - railLength) / 2;
  const rails: Rail[] = Array.from({ length: Math.max(rows, usedRails) }, (_, index) => {
    const y = r1(40 + pitch * (index + 0.75));
    const holes: Hole[] = [];
    for (let x = railX + 15; x <= railX + railLength - 15 + 0.01; x += 250) holes.push({ x: r1(x), y, diameterMm: 4.2, thread: "M5", part: "rail" });
    if (Math.abs(holes[holes.length - 1].x - (railX + railLength - 15)) > 1) holes.push({ x: r1(railX + railLength - 15), y, diameterMm: 4.2, thread: "M5", part: "rail" });
    return { index: index + 1, y, x1: r1(railX), x2: r1(railX + railLength), lengthMm: Math.round(railLength), holes };
  });
  const ducts: Duct[] = [];
  const ductHoles = (x1: number, x2: number, y1: number, y2: number): Hole[] => {
    const horizontal = x2 - x1 >= y2 - y1;
    const length = horizontal ? x2 - x1 : y2 - y1;
    const points: Hole[] = [];
    for (let offset = 30; offset <= length - 30 + 0.01; offset += 300) points.push({ x: r1(horizontal ? x1 + offset : (x1 + x2) / 2), y: r1(horizontal ? (y1 + y2) / 2 : y1 + offset), diameterMm: 4.2, thread: "M5", part: "duct" });
    points.push({ x: r1(horizontal ? x2 - 30 : (x1 + x2) / 2), y: r1(horizontal ? (y1 + y2) / 2 : y2 - 30), diameterMm: 4.2, thread: "M5", part: "duct" });
    return points;
  };
  // Svislé postranní žlaby 25 × 60 po celé výšce desky
  for (const x of [0, plateW - sideDuct]) ducts.push({ kind: "vertical", x: r1(x), y: 20, w: sideDuct, h: r1(plateH - 40), size: "25×60", lengthMm: Math.round(plateH - 40), holes: ductHoles(x, x + sideDuct, 20, plateH - 20) });
  // Vodorovné žlaby 40 × 60 nad první lištou, mezi řadami a pod poslední
  const ductYs = [rails[0].y - pitch / 2, ...rails.map((rail) => rail.y + pitch / 2)];
  for (const yCenter of ductYs) {
    const y = r1(Math.max(5, yCenter - 20));
    ducts.push({ kind: "horizontal", x: sideDuct, y, w: r1(plateW - 2 * sideDuct), h: 40, size: "40×60", lengthMm: Math.round(plateW - 2 * sideDuct), holes: ductHoles(sideDuct, plateW - sideDuct, y, y + 40) });
  }
  // PE / N sběrnice dole: PE, N hlavní a N1… za každým chráničem
  const rcds = input.devices.filter((device) => device.category === "RCD");
  const barNames = ["PE", "N", ...rcds.map((_, index) => `N${index + 1}`)];
  const barY = r1(Math.min(plateH - 15, ductYs[ductYs.length - 1] + 45));
  const barLength = 90;
  const bars: Bar[] = barNames.map((name, index) => {
    const x = r1(sideDuct + 15 + index * (barLength + 12));
    return { name, x, y: barY, lengthMm: barLength, terminals: name === "PE" || name === "N" ? 12 : 7, holes: [{ x: r1(x + 8), y: barY, diameterMm: 5, thread: "M6", part: "bar" }, { x: r1(x + barLength - 8), y: barY, diameterMm: 5, thread: "M6", part: "bar" }] };
  });
  const devices: PlacedDevice[] = input.devices.map((device) => {
    const rail = rails[Math.max(0, Math.min(rails.length - 1, device.rail - 1))];
    const x = r1(rail.x1 + 10 + device.position * MODULE_MM);
    return { id: device.id, designation: device.designation, rail: rail.index, x, y: r1(rail.y - DEVICE_HEIGHT_MM / 2), w: r1(Math.max(0.5, device.modules) * MODULE_MM), h: DEVICE_HEIGHT_MM };
  });
  // Vývodky podle kabelů: přívod, silové 3f vývody, koncové 1f okruhy a sběrnice
  const membrane = input.mounting === "flush";
  const cables: { cable: string; label: string; role: Gland["role"] }[] = [{ cable: input.supplyCable, label: "Hlavní přívod", role: "supply" }];
  for (const device of input.devices) {
    if (!device.cable) continue;
    const three = /^(3P|3P\+N|4P)$/.test(device.poles) || /5\s*[x×]/.test(device.cable);
    cables.push({ cable: device.cable, label: `${device.designation}${device.label ? ` ${device.label}` : ""}`, role: three ? "power" : "final" });
  }
  for (let index = 0; index < (input.busCables ?? 0); index += 1) cables.push({ cable: "J-Y(St)Y 2×2×0,8", label: `Sběrnice ${index + 1}`, role: "bus" });
  const order: Record<Gland["role"], number> = { supply: 0, power: 1, final: 2, bus: 3 };
  const sorted = [...cables].sort((a, b) => order[a.role] - order[b.role]);
  const faceW = enclosure.widthMm;
  const cursor = { top: 30, bottom: 30 };
  const glands: Gland[] = sorted.map((entry, index) => {
    const size = entry.role === "supply" ? (cableDiameterMm(entry.cable) > 21 ? "M40" : "M32") : glandFor(entry.cable);
    const side: Gland["side"] = input.entry === "both" ? (entry.role === "supply" ? "top" : "bottom") : input.entry === "top" ? "top" : "bottom";
    const hole = GLAND_HOLE_MM[size];
    let x = cursor[side] + hole / 2;
    // Další řada otvorů, když dojde čelo (rozteč = otvor + 12 mm)
    if (x + hole / 2 > faceW - 20) {
      cursor[side] = 30;
      x = cursor[side] + hole / 2;
    }
    cursor[side] = x + hole / 2 + 12;
    return { id: `G${String(index + 1).padStart(2, "0")}`, size, holeMm: hole, cable: entry.cable, label: entry.label, side, x: r1(x), role: entry.role };
  });
  // Výřezy dveří: návěstidla a tlačítko Ø 22,5 nahoře, měřidlo 92 × 92, ventilační mřížka 120 × 120 dole
  const doorW = enclosure.widthMm - 10;
  const doorH = enclosure.heightMm - 10;
  const doorCutouts: DoorCutout[] = [];
  let cx = doorW / 2 - (input.door.phaseLamps ? 45 : 0) - (input.door.centralStop ? 22 : 0);
  if (input.door.phaseLamps) {
    for (const phase of ["L1", "L2", "L3"]) {
      doorCutouts.push({ kind: "lamp", label: `Kontrolka ${phase}`, x: r1(cx), y: 60, diameterMm: 22.5 });
      cx += 45;
    }
  }
  if (input.door.centralStop) doorCutouts.push({ kind: "stop", label: "CENTRAL STOP", x: r1(cx + (input.door.phaseLamps ? 10 : 0)), y: 60, diameterMm: 22.5 });
  if (input.door.meter) doorCutouts.push({ kind: "meter", label: "Multimetr 92 × 92", x: r1(doorW / 2), y: 150, w: 92, h: 92 });
  if (input.door.ventilation) doorCutouts.push({ kind: "vent", label: "Ventilátor s filtrem 120 × 120", x: r1(doorW / 2), y: r1(doorH - 110), w: 120, h: 120 });
  return { plate: { widthMm: r1(plateW), heightMm: r1(plateH) }, door: { widthMm: r1(doorW), heightMm: r1(doorH) }, face: { widthMm: faceW, depthMm: enclosure.depthMm }, rails, ducts, bars, glands, doorCutouts, devices, membrane };
}

// ---------------------------------------------------------------------------------------------------------------------
//  Nářezový a drátovací list vodičů
// ---------------------------------------------------------------------------------------------------------------------

export type Conductor = "L" | "L1" | "L2" | "L3" | "N" | "PE";

export interface WireRow {
  no: string;
  from: string;
  to: string;
  conductor: Conductor;
  type: string;
  crossSectionMm2: number;
  color: string;
  lengthMm: number;
  endA: string;
  endB: string;
  kind: "wire" | "comb";
  /** Propojovací hřeben místo vodičů (vyřazený z drátování). */
  comb?: string;
}

const COLORS: Record<Conductor, string> = { L: "Černá / Hnědá (L)", L1: "Hnědá (L1)", L2: "Černá (L2)", L3: "Šedá (L3)", N: "Světle modrá (N)", PE: "Zelenožlutá (PE)" };

/** Průřez vnitřního vodiče podle jmenovitého proudu napájeného přístroje [mm²]. */
export function wireSection(ratedA: number): number {
  if (ratedA <= 10) return 1.5;
  if (ratedA <= 16) return 2.5;
  if (ratedA <= 25) return 4;
  if (ratedA <= 32) return 6;
  if (ratedA <= 40) return 10;
  if (ratedA <= 63) return 16;
  return 25;
}

const mm2 = (value: number) => String(value).replace(".", ",");
/** Délka dutinky podle průřezu (izolovaná, DIN 46228-4). */
const ferruleLength = (section: number) => (section <= 2.5 ? 10 : section <= 10 ? 12 : 18);
export const singleFerrule = (section: number) => `Dutinka ${mm2(section)} mm² / ${ferruleLength(section)} mm`;
export const twinFerrule = (section: number) => `Dvojitá TWIN dutinka 2×${mm2(section)} mm²`;

const isThreePole = (poles: string) => /^(3P|3P\+N|4P)$/.test(poles);
const hasNeutral = (poles: string) => /\+N|^2P$|^4P$/.test(poles);

interface Terminal {
  device: string;
  name: string;
  x: number;
  y: number;
  /** Svorka nahoře (vstup) / dole (výstup) přístroje, nebo na sběrnici. */
  edge: "top" | "bottom" | "bar";
}

/** Svorky přístroje: vstupy nahoře (1, 3, 5, N), výstupy dole (2, 4, 6, N). */
function terminalName(poles: string, conductor: Conductor, output: boolean): string {
  if (conductor === "N") return output ? "N-out" : "N";
  const phase = conductor === "L" || conductor === "L1" ? 0 : conductor === "L2" ? 1 : 2;
  const number = output ? 2 + phase * 2 : 1 + phase * 2;
  return `${number} (${conductor})`;
}

/** Délka vodiče po žlabech: od svorky svisle do žlabu nad / pod lištou, vodorovně, přes postranní žlab mezi lištami. */
function routeLength(layout: CncLayout, a: Terminal, b: Terminal): number {
  const ductAbove = (y: number) => {
    const candidates = layout.ducts.filter((duct) => duct.kind === "horizontal" && duct.y + duct.h / 2 <= y);
    return candidates.length ? candidates[candidates.length - 1].y + 20 : 20;
  };
  const ductBelow = (y: number) => layout.ducts.find((duct) => duct.kind === "horizontal" && duct.y + duct.h / 2 >= y)?.y ?? layout.plate.heightMm - 20;
  const ductY = (terminal: Terminal) => (terminal.edge === "top" ? ductAbove(terminal.y) + 20 : terminal.edge === "bottom" ? ductBelow(terminal.y) + 20 : terminal.y);
  const ya = ductY(a);
  const yb = ductY(b);
  let length = Math.abs(a.y - ya) + Math.abs(b.y - yb);
  if (Math.abs(ya - yb) < 1) length += Math.abs(a.x - b.x);
  else {
    // Mezi řadami přes bližší postranní svislý žlab
    const left = 12;
    const right = layout.plate.widthMm - 12;
    const viaLeft = Math.abs(a.x - left) + Math.abs(b.x - left);
    const viaRight = Math.abs(a.x - right) + Math.abs(b.x - right);
    length += Math.min(viaLeft, viaRight) + Math.abs(ya - yb);
  }
  return Math.round((length + BEND_RESERVE_MM) / 5) * 5;
}

/**
 * Drátovací list: napájecí přístroj → přístroje pod ním podle stromu zapojení. Přístroje jedné větve na stejné liště
 * vedle sebe (jističe za chráničem) propojí hřeben (vyřazeno z drátování), jinak smyčka od svorky ke svorce – svorka se
 * dvěma vodiči má dvojitou dutinku TWIN. N chráničů na sběrnice N1…, přepěťová ochrana na PE.
 */
export function wireHarnessList(input: CncInput, layout: CncLayout = cncLayout(input)): WireRow[] {
  const byId = new Map(input.devices.map((device) => [device.id, device]));
  const placed = new Map(layout.devices.map((device) => [device.id, device]));
  const rows: Omit<WireRow, "no">[] = [];
  const terminal = (device: CncDevice, conductor: Conductor, output: boolean): Terminal => {
    const box = placed.get(device.id)!;
    const name = terminalName(device.poles, conductor, output);
    const phase = conductor === "L2" ? 1 : conductor === "L3" ? 2 : conductor === "N" ? (isThreePole(device.poles) ? 3 : 1) : 0;
    const x = box.x + Math.min(box.w - 4, MODULE_MM / 2 + phase * MODULE_MM);
    return { device: device.designation, name, x: r1(x), y: r1(box.y + box.h / 2 + (output ? TERMINAL_OFFSET_MM : -TERMINAL_OFFSET_MM)), edge: output ? "bottom" : "top" };
  };
  const barTerminal = (name: string, index: number): Terminal => {
    const bar = layout.bars.find((candidate) => candidate.name === name) ?? layout.bars[0];
    return { device: `Sběrnice ${name}`, name: `Svorka ${index}`, x: r1(bar.x + 12 + (index - 1) * 6), y: bar.y, edge: "bar" };
  };
  const barCounters = new Map<string, number>();
  const nextBar = (name: string) => {
    const value = (barCounters.get(name) ?? 0) + 1;
    barCounters.set(name, value);
    return barTerminal(name, value);
  };
  const label = (point: Terminal) => (point.edge === "bar" ? `${point.device} : ${point.name}` : `${point.device} : ${point.name}`);
  const wire = (from: Terminal, to: Terminal, conductor: Conductor, section: number) => {
    rows.push({ from: label(from), to: label(to), conductor, type: `H07V-K (CYA) ${mm2(section)} mm²`, crossSectionMm2: section, color: COLORS[conductor], lengthMm: routeLength(layout, from, to), endA: singleFerrule(section), endB: singleFerrule(section), kind: "wire" });
    return rows.length - 1;
  };
  const conductorsOf = (device: CncDevice, phase: Conductor): Conductor[] => (isThreePole(device.poles) ? ["L1", "L2", "L3", ...(hasNeutral(device.poles) ? (["N"] as Conductor[]) : [])] : [phase, ...(hasNeutral(device.poles) || device.category === "RCD" ? (["N"] as Conductor[]) : [])]);

  // Kořen: hlavní vypínač (nebo přístroje bez napájecího přístroje)
  const roots = input.devices.filter((device) => !device.parentId || !byId.has(device.parentId));
  const childrenOf = (id: string) => input.devices.filter((device) => device.parentId === id).sort((a, b) => a.rail - b.rail || a.position - b.position);
  let phaseCursor = 0;
  const nextPhase = (): Conductor => (["L1", "L2", "L3"] as const)[phaseCursor++ % 3];
  const phaseOf = new Map<string, Conductor>();

  const feed = (parent: CncDevice) => {
    const children = childrenOf(parent.id).filter((child) => child.category !== "SPD");
    const parentPhase = phaseOf.get(parent.id) ?? "L1";
    // Hřeben: souvislá skupina 1P / 3P přístrojů na stejné liště (jističe za chráničem)
    const groups: CncDevice[][] = [];
    for (const child of children) {
      const last = groups[groups.length - 1];
      const previous = last?.[last.length - 1];
      const contiguous = previous && previous.rail === child.rail && Math.abs(previous.position + previous.modules - child.position) < 0.01 && isThreePole(previous.poles) === isThreePole(child.poles) && (child.category === "MCB" || child.category === "RCBO") && (previous.category === "MCB" || previous.category === "RCBO");
      if (contiguous) last.push(child);
      else groups.push([child]);
    }
    let loopFrom: { terminals: Map<Conductor, Terminal>; rows: Map<Conductor, number> } | null = null;
    for (const group of groups) {
      const head = group[0];
      if (!isThreePole(head.poles) && !phaseOf.has(head.id)) phaseOf.set(head.id, isThreePole(parent.poles) ? nextPhase() : parentPhase === "L" ? "L1" : parentPhase);
      const conductors = conductorsOf(head, phaseOf.get(head.id) ?? "L1").filter((conductor) => conductor !== "N" || hasNeutral(parent.poles) || parent.category === "RCD");
      const section = wireSection(Math.max(...group.map((device) => device.ratedCurrentA)) * (group.length > 1 ? 1.25 : 1));
      const terminals = new Map<Conductor, Terminal>();
      const created = new Map<Conductor, number>();
      for (const conductor of conductors) {
        const target = terminal(head, conductor, false);
        // Smyčka: druhý a další přístroj větve napájený ze vstupních svorek předchozího (TWIN dutinka na sdílené svorce)
        const source = loopFrom?.terminals.get(conductor) ?? terminal(parent, conductor === "L" ? "L1" : conductor, true);
        const index = wire(source, target, conductor, section);
        if (loopFrom?.terminals.has(conductor)) {
          const previousRow = loopFrom.rows.get(conductor)!;
          rows[previousRow].endB = twinFerrule(rows[previousRow].crossSectionMm2);
          rows[index].endA = twinFerrule(section);
        }
        terminals.set(conductor, target);
        created.set(conductor, index);
      }
      loopFrom = group.length === 1 && (head.category === "RCD" || head.category === "RCBO" || head.category === "MAIN_SWITCH") ? { terminals, rows: created } : null;
      if (group.length > 1) {
        for (const member of group.slice(1)) phaseOf.set(member.id, phaseOf.get(head.id) ?? "L1");
        const modules = group.reduce((sum, member) => sum + member.modules, 0);
        const poles = isThreePole(head.poles) ? "3P" : "1P";
        rows.push({ from: `${head.designation} … ${group[group.length - 1].designation}`, to: "propojovací hřeben", conductor: isThreePole(head.poles) ? "L1" : (phaseOf.get(head.id) ?? "L1"), type: `Hřebenová přípojnice ${poles} 10 mm²`, crossSectionMm2: 10, color: "–", lengthMm: Math.round(modules * MODULE_MM), endA: "–", endB: "–", kind: "comb", comb: `Hřebenová přípojnice ${poles} 10 mm² (${modules} modulů / ${Math.round(modules * MODULE_MM)} mm)` });
      }
      // N výstup chrániče na vlastní sběrnici N1…
      if (head.category === "RCD") wire(terminal(head, "N", true), nextBar(`N${input.devices.filter((device) => device.category === "RCD").indexOf(head) + 1}`), "N", wireSection(head.ratedCurrentA));
      for (const member of group) if (childrenOf(member.id).length) feed(member);
    }
    // Přepěťová ochrana: fáze z výstupu hlavního vypínače, PE na sběrnici PE
    for (const spd of childrenOf(parent.id).filter((child) => child.category === "SPD")) {
      for (const conductor of conductorsOf(spd, "L1").filter((conductor) => conductor !== "N")) wire(terminal(parent, conductor, true), terminal(spd, conductor, false), conductor, 16);
      wire(terminal(spd, "L1", true), nextBar("PE"), "PE", 16);
    }
  };
  for (const root of roots) {
    phaseOf.set(root.id, isThreePole(root.poles) ? "L1" : "L");
    // Hlavní N z přívodu na sběrnici N, PE přívodu na sběrnici PE
    if (hasNeutral(root.poles)) wire(terminal(root, "N", true), nextBar("N"), "N", wireSection(root.ratedCurrentA));
    feed(root);
  }
  return rows.map((row, index) => ({ ...row, no: row.kind === "comb" ? `H${String(index + 1).padStart(3, "0")}` : `W${String(index + 1).padStart(3, "0")}` }));
}

// ---------------------------------------------------------------------------------------------------------------------
//  Nářezový list lišt, žlabů a hřebenů
// ---------------------------------------------------------------------------------------------------------------------

export interface CutItem {
  item: string;
  lengthMm: number;
  pieces: number;
}

export function cutList(layout: CncLayout, wires: readonly WireRow[]): CutItem[] {
  const map = new Map<string, CutItem>();
  const add = (item: string, lengthMm: number) => {
    const key = `${item}|${lengthMm}`;
    const own = map.get(key);
    if (own) own.pieces += 1;
    else map.set(key, { item, lengthMm, pieces: 1 });
  };
  for (const rail of layout.rails) add("DIN lišta TS 35 × 7,5 mm (perforovaná)", rail.lengthMm);
  for (const duct of layout.ducts) add(`Kabelový žlab perforovaný ${duct.size} mm`, duct.lengthMm);
  for (const bar of layout.bars) add(`Sběrnice ${bar.name === "PE" ? "PE (zelenožlutý držák)" : `${bar.name} (modrý držák)`} ${bar.terminals} svorek`, bar.lengthMm);
  for (const row of wires) if (row.kind === "comb" && row.comb) add(row.comb.replace(/ \(.*\)$/, ""), row.lengthMm);
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item) || b.lengthMm - a.lengthMm);
}
