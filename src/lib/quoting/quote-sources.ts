// Fáze 105: podklady cenové nabídky z 2D půdorysu (kusovník domovní instalace, výkaz kabeláže, okruhy) a z projektu
// rozváděče AI Panel Builderu (přístroje z katalogu, skříň) – položky materiálu a množství pro výpočet práce.

import type { WiringBomRow } from "@/lib/panel-builder/wiring-bom";
import { paletteItem, type EditorElement } from "@/lib/panel-builder/floorplan-editor";

import { EMPTY_WORK, type QuoteMaterial, type QuoteWork } from "./quote-engine";
import type { OrderLine } from "./wholesaler-export";

/** Silové kabely (5×2,5 až 5×10, 4× 10 a víc) – drážka 0,16 NH / m; ostatní do 3×2,5 a slaboproud 0,12 NH / m. */
export const isPowerCable = (cable: string) => /\b[45]\s*[x×]\s*(2,5|4|6|10|16|25)\b/.test(cable) || /\b3\s*[x×]\s*(4|6|10)\b/.test(cable);

/** Položka kusovníku 2D půdorysu → materiál nabídky (cena se dohledá na serveru). */
export function bomMaterials(rows: readonly WiringBomRow[]): QuoteMaterial[] {
  return rows.map((row, index) => ({
    key: `fp:${row.category}|${row.mpn ?? row.name}|${row.appearance}|${index}`,
    name: row.appearance && row.unit === "ks" ? `${row.name} (${row.appearance})` : row.name,
    code: row.mpn,
    quantity: row.quantity,
    unit: row.unit,
    section: "floorplan" as const,
    listPriceCzk: null,
    priceKind: row.unit === "m" ? ("cable" as const) : row.box ? ("box" as const) : ("device" as const),
    ean: row.ean ?? null,
    manufacturer: row.box?.maker ?? null,
  }));
}

/** Přístroje rozváděče z výpočtu okruhů 2D půdorysu (kusovník návrhu bez objednacích čísel – cenu doplní elektrikář). */
export function circuitBomMaterials(bom: readonly { item: string; count: number }[]): QuoteMaterial[] {
  return bom.filter((entry) => entry.count > 0).map((entry) => ({ key: `sb:${entry.item}`, name: entry.item, code: null, quantity: entry.count, unit: "ks" as const, section: "switchboard" as const, listPriceCzk: null, priceKind: "device" as const }));
}

interface CircuitLike {
  protection: { device: string; poles: string };
  rcd?: string | null;
}

/** Přístroje rozváděče pro práci (1pólové 0,25 NH, vícepólové / RCD / RCBO / SPD 0,45 NH, chytré moduly 0,65 NH). */
export function switchboardWork(circuits: readonly CircuitLike[], extras: { rcdGroups?: number; smartModules?: number; spd?: boolean; mainSwitch?: boolean } = {}) {
  let din1p = 0;
  let din3p = 0;
  for (const circuit of circuits) {
    const multi = /3P|4P|2P/.test(circuit.protection.poles) || circuit.protection.device === "RCBO";
    if (multi) din3p += 1;
    else din1p += 1;
  }
  din3p += (extras.rcdGroups ?? 0) + (extras.spd ? 1 : 0) + (extras.mainSwitch ? 1 : 0);
  // Skříň: moduly přístrojů + 20 % rezerva, nejmenší 12 M
  const modules = Math.max(12, Math.ceil((din1p + din3p * 2 + (extras.smartModules ?? 0) * 4) * 1.2));
  return { din1p, din3p, dinSmart: extras.smartModules ?? 0, enclosureModules: [modules] };
}

/** Podklady nabídky z 2D půdorysu: materiál z kusovníku, práce z výkazu kabeláže, prvků a okruhů. */
export function floorplanQuoteWork(input: { elements: readonly EditorElement[]; bom: readonly WiringBomRow[]; byCable: readonly { cable: string; meters: number }[]; circuits: readonly CircuitLike[]; smartModules?: number }): QuoteWork {
  let devices = 0;
  let dataDevices = 0;
  let lights = 0;
  let lightStrips = 0;
  let appliances = 0;
  for (const element of input.elements) {
    const item = paletteItem(element.item);
    if (!item) continue;
    if (item.kind === "light") {
      if (item.lightForm === "strip") lightStrips += 1;
      else lights += 1;
    } else if (item.kind === "appliance") appliances += 1;
    else if (item.kind === "data_socket" || item.bus) dataDevices += 1;
    else if (item.kind === "single_socket" || item.kind === "double_socket" || item.kind === "switch") devices += 1;
  }
  const boxes = input.bom.filter((row) => row.box);
  const deepBoxes = boxes.filter((row) => (row.box?.depthMm ?? 0) >= 60).reduce((sum, row) => sum + row.quantity, 0);
  const allBoxes = boxes.reduce((sum, row) => sum + row.quantity, 0);
  const powerCableM = input.byCable.filter((row) => isPowerCable(row.cable)).reduce((sum, row) => sum + row.meters, 0);
  const cableM = input.byCable.reduce((sum, row) => sum + row.meters, 0);
  const board = switchboardWork(input.circuits, { rcdGroups: Math.max(1, Math.ceil(input.circuits.length / 6)), spd: true, mainSwitch: true, smartModules: input.smartModules });
  return { ...EMPTY_WORK, lightCableM: Math.round((cableM - powerCableM) * 10) / 10, powerCableM: Math.round(powerCableM * 10) / 10, boxes: allBoxes - deepBoxes, deepBoxes, devices, dataDevices, lights, lightStrips, appliances, ...board, circuits: input.circuits.length };
}

/** Řádky poptávky do velkoobchodu z materiálu nabídky (EAN / objednací číslo a množství). */
export function orderLinesOf(materials: readonly QuoteMaterial[]): OrderLine[] {
  return materials.map((item) => ({ code: item.code ?? null, ean: item.ean ?? null, name: item.name, manufacturer: item.manufacturer ?? null, quantity: item.quantity, unit: item.unit }));
}
