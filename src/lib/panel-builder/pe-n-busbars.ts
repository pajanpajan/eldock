// Fáze 55: deterministický návrh svorkovnic PE a N v rozváděči podle soustavy přívodu (supply.ts) a stromu zapojení.
// - PE (zeleno-žlutá): přívod PE/PEN + uzemnění / MET + SPD + koncové vývody, rezerva 20 %, velikost 12 / 18 / 24 / 36 otvorů,
// - bod rozdělení PEN → PE + N (jen TN-C-S): propojka PE ↔ N0 (ČSN 33 2000-5-54 ed. 3), u TN-S / TT jsou PE a N0 izolované,
// - N0 (modrá, před chrániči): přívod N, N póly proudových chráničů, RCBO 1P+N a okruhy mimo skupinové chrániče,
// - N-FIx (modrá, za každým proudovým chráničem): N vodiče jen vývodů, jejichž nejbližší nadřazený chránič je -FIx.
// Čisté funkce bez I/O; vykresluje se na vektorovém rozváděči, na Listu 2 dokumentace a přidává do kusovníku (List 4).

import type { ComponentCategory } from "@/generated/prisma/enums";

import type { PartsRow } from "./documentation";
import type { SupplySystem } from "./supply";

export const PE_BAR_SIZES = [12, 18, 24, 36] as const;
export const N_BAR_SIZES = [7, 10, 14, 18, 24, 36] as const;
export const BAR_RESERVE = 0.2;
export const PEN_SPLIT_LABEL = "Bod rozdělení PEN → PE + N (ČSN 33 2000-5-54 ed. 3)";

export interface BusbarItem {
  id: string;
  designation: string;
  category: ComponentCategory | null;
  poles: string | null;
  parentItemId: string | null;
  circuitLabel: string;
}

export interface Busbar {
  id: string;
  kind: "PE" | "N";
  label: string;
  /** Počet otvorů / svorek zvolené sběrnice (u více kusů součet). */
  size: number;
  /** Počet kusů (nad 36 otvorů se sběrnice skládá z více kusů). */
  pieces: number;
  used: number;
  /** Co je na svorkách: přívod, uzemnění, SPD, vývody (značení a funkce). */
  connections: { designation: string; label: string }[];
  /** Skupinový můstek za chráničem: značení chrániče (-FI1 …). */
  rcd?: string;
}

export interface BusbarPlan {
  pe: Busbar;
  n0: Busbar;
  groups: Busbar[];
  penBridge: boolean;
}

const FINAL = new Set<ComponentCategory>(["MCB", "RCBO"]);
const isFinal = (item: BusbarItem) => !!item.category && FINAL.has(item.category);
const threePhaseOnly = (item: BusbarItem) => /^3P$/i.test(item.poles?.trim() ?? "");
const hasNeutral = (item: BusbarItem) => /N|2P|4P/i.test(item.poles ?? "");

/** Nejmenší sběrnice s počtem svorek ≥ potřeba × 1,2; nad největší velikost se skládá z více kusů. */
export function pickBar(needed: number, sizes: readonly number[]): { size: number; pieces: number } {
  const required = Math.ceil(needed * (1 + BAR_RESERVE));
  const largest = sizes[sizes.length - 1];
  const single = sizes.find((size) => size >= required);
  if (single) return { size: single, pieces: 1 };
  const pieces = Math.ceil(required / largest);
  return { size: pieces * largest, pieces };
}

/** Nejbližší nadřazený proudový chránič (RCD) vývodu, nebo null (vývod mimo skupinový chránič). */
function nearestRcd(item: BusbarItem, byId: ReadonlyMap<string, BusbarItem>): BusbarItem | null {
  const seen = new Set<string>();
  let parent = item.parentItemId ? byId.get(item.parentItemId) : undefined;
  while (parent && !seen.has(parent.id)) {
    if (parent.category === "RCD") return parent;
    seen.add(parent.id);
    parent = parent.parentItemId ? byId.get(parent.parentItemId) : undefined;
  }
  return null;
}

const natural = (a: string, b: string) => a.localeCompare(b, "cs", { numeric: true });

export function planBusbars(items: readonly BusbarItem[], supply: SupplySystem): BusbarPlan {
  const byId = new Map(items.map((item) => [item.id, item]));
  const finals = items.filter(isFinal).sort((a, b) => natural(a.designation, b.designation));
  const spd = items.filter((item) => item.category === "SPD");
  const circuit = (item: BusbarItem) => ({ designation: item.designation, label: item.circuitLabel || "vývod" });

  // PE: přívod + uzemnění / MET + SPD + každý koncový vývod
  const peConnections = [
    { designation: "přívod", label: supply.penSplit ? "PEN přívodu" : "PE přívodu" },
    { designation: "MET", label: "uzemnění / hlavní ochranná přípojnice" },
    ...spd.map((item) => ({ designation: item.designation, label: "přepěťová ochrana" })),
    ...finals.map(circuit),
  ];
  const peBar = pickBar(peConnections.length, PE_BAR_SIZES);
  const pe: Busbar = { id: "PE", kind: "PE", label: "PE", size: peBar.size, pieces: peBar.pieces, used: peConnections.length, connections: peConnections };

  // Skupinové můstky N-FIx (za každým chráničem) a N0 (před chrániči)
  const rcds = items.filter((item) => item.category === "RCD").sort((a, b) => natural(a.designation, b.designation));
  const groups: Busbar[] = rcds.map((rcd, index) => {
    const connections = finals.filter((item) => !threePhaseOnly(item) && item.category !== "RCBO" && nearestRcd(item, byId)?.id === rcd.id).map(circuit);
    const bar = pickBar(Math.max(connections.length, 1), N_BAR_SIZES);
    return { id: `N${index + 1}`, kind: "N", label: `N${index + 1} (za ${rcd.designation})`, size: bar.size, pieces: bar.pieces, used: connections.length, connections, rcd: rcd.designation };
  });
  const n0Connections = [
    { designation: "přívod", label: supply.penSplit ? "N z bodu rozdělení PEN" : "N přívodu" },
    ...rcds.filter(hasNeutral).map((rcd) => ({ designation: rcd.designation, label: "N pól chrániče" })),
    ...spd.filter(hasNeutral).map((item) => ({ designation: item.designation, label: "N přepěťové ochrany" })),
    ...finals.filter((item) => !threePhaseOnly(item) && (item.category === "RCBO" || !nearestRcd(item, byId))).map(circuit),
  ];
  const n0Bar = pickBar(n0Connections.length, N_BAR_SIZES);
  const n0: Busbar = { id: "N0", kind: "N", label: "N0 (před chrániči)", size: n0Bar.size, pieces: n0Bar.pieces, used: n0Connections.length, connections: n0Connections };
  return { pe, n0, groups, penBridge: supply.penSplit };
}

/** Řádky kusovníku (List 4): sběrnice PE, N0, skupinové můstky a propojka PEN – bez objednacího čísla (podle výrobce skříně). */
export function busbarPartsRows(plan: BusbarPlan): PartsRow[] {
  const row = (typeCode: string, description: string, quantity: number): PartsRow => ({ articleNumber: "–", typeCode, manufacturer: "dle výrobce skříně", description, quantity });
  const rows = [
    row(`PE sběrnice ${plan.pe.size / plan.pe.pieces} otvorů`, `Ochranná sběrnice PE (zeleno-žlutá), obsazeno ${plan.pe.used} / ${plan.pe.size}`, plan.pe.pieces),
    row(`N sběrnice ${plan.n0.size / plan.n0.pieces} svorek`, `Hlavní nulová sběrnice N0 (před chrániči), obsazeno ${plan.n0.used} / ${plan.n0.size}`, plan.n0.pieces),
    ...plan.groups.map((group) => row(`N můstek ${group.size / group.pieces} svorek`, `Izolovaný nulový můstek ${group.label}, obsazeno ${group.used} / ${group.size}`, group.pieces)),
  ];
  if (plan.penBridge) rows.push(row("Propojka PE–N0", PEN_SPLIT_LABEL, 1));
  return rows;
}

/** Krátký popis obsazenosti (např. „Můstek N1 (za -FI1): 7 / 10 svorek“). */
export const busbarSummary = (bar: Busbar) => `${bar.kind === "PE" ? "Sběrnice" : bar.id === "N0" ? "Sběrnice" : "Můstek"} ${bar.label}: ${bar.used} / ${bar.size} ${bar.kind === "PE" ? "otvorů" : "svorek"}`;
