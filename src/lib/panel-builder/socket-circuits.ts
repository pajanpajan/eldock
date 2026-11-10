// Fáze 65: ruční změna zásuvkových okruhů v nákresu – přesun zásuvky do jiného okruhu (i do automatického – ten se tím
// zafixuje jako ruční), spojení výběru do jednoho okruhu, návrat na automatické rozdělení a „Optimalizovat zásuvkové
// okruhy“ (kompaktní zóny, bez ručních okruhů a bez ručně upravených tras zásuvek). Čisté funkce nad `FloorplanDraft`.
// Fáze 82: zásuvka na světelném okruhu své místnosti (`onLighting`, jištění 10 / 13 A) – přesun na světelný okruh a zpět.

import { circuitDesignations, type Circuit } from "@/engine/floorplan-bridge";
import type { SocketGrouping } from "@/engine/socket-zones";

import { SOCKET_CIRCUIT, allElements, mapAllElements, paletteItem, type EditorElement, type FloorplanDraft } from "./floorplan-editor";

export const SOCKET_GROUPING_LABEL: Record<SocketGrouping, { label: string; detail: string }> = {
  compact: { label: "✨ Optimalizované zóny", detail: "Zásuvky po nejkratší trase, sousední místnosti spolu, velká místnost na souvislé úseky – okruh nepřebíhá přes celý byt." },
  rooms: { label: "Každá místnost zvlášť", detail: "Každá místnost má vlastní okruh (velká místnost víc souvislých okruhů) – přehledné jištění po místnostech." },
  distance: { label: "Podle vzdálenosti od rozváděče", detail: "Dosavadní rozdělení (do fáze 64): místnosti podle vzdálenosti, velká místnost po 10 zásuvkách od rozváděče." },
};

/** Běžná zásuvka (jedno- / dvojzásuvka) – jen ty mají ruční okruh. */
export const isSocketElement = (element: Pick<EditorElement, "item">) => {
  const kind = paletteItem(element.item)?.kind;
  return kind === "single_socket" || kind === "double_socket";
};

/** Uzel okruhu → prvek nákresu (zásuvky víceramečku mají uzly `id#1`, `id#2`). */
export const elementIdOf = (nodeId: string) => nodeId.replace(/#\d+$/, "");

/** Ruční okruhy použité v nákresu (všechna podlaží), seřazené Z1, Z2 … Z10. */
export function usedSocketCircuits(draft: FloorplanDraft): string[] {
  return [...new Set(allElements(draft).flatMap((element) => (element.socketCircuit ? [element.socketCircuit] : [])))].sort((a, b) => a.localeCompare(b, "cs", { numeric: true }));
}

/** První volný ruční okruh (Z1 … Z99); null = vše obsazeno. */
export function nextSocketCircuit(draft: FloorplanDraft): string | null {
  const used = new Set(usedSocketCircuits(draft));
  for (let index = 1; index <= 99; index++) if (!used.has(`Z${index}`)) return `Z${index}`;
  return null;
}

/**
 * Nastavení / zrušení ručního okruhu u zásuvek (`key` null = automaticky). Ostatní prvky beze změny. Fáze 82: zásuvka
 * ze světelného okruhu se tím vrátí na zásuvkový okruh.
 */
export function assignSocketCircuit(draft: FloorplanDraft, elementIds: readonly string[], key: string | null): FloorplanDraft {
  if (key !== null && !SOCKET_CIRCUIT.test(key)) return draft;
  const ids = new Set(elementIds);
  let changed = false;
  const next = mapAllElements(draft, (element) => {
    if (!ids.has(element.id) || !isSocketElement(element) || ((element.socketCircuit ?? null) === key && !element.onLighting)) return element;
    changed = true;
    const rest = { ...element };
    delete rest.onLighting;
    if (key === null) {
      delete rest.socketCircuit;
      return rest;
    }
    return { ...rest, socketCircuit: key };
  });
  return changed ? next : draft;
}

/** Fáze 82: zásuvky na světelný okruh své místnosti (`on` false = zpět na automatický zásuvkový okruh). */
export function assignLightingCircuit(draft: FloorplanDraft, elementIds: readonly string[], on = true): FloorplanDraft {
  if (!on) return assignSocketCircuit(draft, elementIds, null);
  const ids = new Set(elementIds);
  let changed = false;
  const next = mapAllElements(draft, (element) => {
    if (!ids.has(element.id) || !isSocketElement(element) || element.onLighting) return element;
    changed = true;
    const rest = { ...element, onLighting: true };
    delete rest.socketCircuit;
    return rest;
  });
  return changed ? next : draft;
}

/** Fáze 82: zásuvky na světelných okruzích (všechna podlaží). */
export const lightingSocketIds = (draft: FloorplanDraft) => allElements(draft).filter((element) => element.onLighting && isSocketElement(element)).map((element) => element.id);

/**
 * Přesun zásuvek do okruhu `circuit` (okruh z výpočtu): ruční okruh převezme jeho klíč, automatický okruh se zafixuje
 * jako nový ruční okruh i se svými zásuvkami – zůstane pohromadě a přibudou k němu přesouvané zásuvky.
 */
export function moveSocketsToCircuit(draft: FloorplanDraft, elementIds: readonly string[], circuit: Pick<Circuit, "nodeIds">): FloorplanDraft {
  const members = [...new Set(circuit.nodeIds.map(elementIdOf))];
  const byId = new Map(allElements(draft).map((element) => [element.id, element]));
  const existing = members.map((id) => byId.get(id)?.socketCircuit).find((key): key is string => Boolean(key));
  const key = existing ?? nextSocketCircuit(draft);
  if (!key) return draft;
  return assignSocketCircuit(draft, [...members, ...elementIds], key);
}

/** Spojení vybraných zásuvek do jednoho nového ručního okruhu. */
export function joinSocketsToNewCircuit(draft: FloorplanDraft, elementIds: readonly string[]): { draft: FloorplanDraft; key: string | null } {
  const key = nextSocketCircuit(draft);
  return key ? { draft: assignSocketCircuit(draft, elementIds, key), key } : { draft, key: null };
}

/**
 * „✨ Optimalizovat zásuvkové okruhy“: kompaktní zóny, zrušené ruční okruhy a ručně upravené trasy zásuvek (úseky
 * končící v zásuvce). Trasy světel a spotřebičů zůstanou.
 */
export function optimizeSocketCircuits(draft: FloorplanDraft): { draft: FloorplanDraft; manual: number; routes: number } {
  const sockets = allElements(draft).filter(isSocketElement);
  const socketIds = new Set(sockets.map((element) => element.id));
  const manual = sockets.filter((element) => element.socketCircuit).length;
  const cleared = assignSocketCircuit(draft, [...socketIds], null);
  const entries = Object.entries(draft.routeEdits);
  const kept = entries.filter(([key]) => !socketIds.has(elementIdOf(key.split(">")[1] ?? "")));
  return { draft: { ...cleared, socketGrouping: "compact", routeEdits: Object.fromEntries(kept) }, manual, routes: entries.length - kept.length };
}

export interface SocketCircuitRow {
  id: string;
  designation: string;
  label: string;
  outlets: number;
  lengthM: number;
  manual: string | null;
  elementIds: string[];
}

/**
 * Fáze 82: světelné okruhy se zásuvkami (označení jističe jako v rozváděči, jistič 10 / 13 A, zásuvky na plátně) – detail
 * zásuvky, plovoucí nabídka a přehled zásuvkových okruhů.
 */
export interface LightingSocketRow {
  id: string;
  designation: string;
  label: string;
  outlets: number;
  ratedA: number;
  elementIds: string[];
}

export function lightingSocketRows(circuits: readonly Circuit[]): LightingSocketRow[] {
  const designations = circuitDesignations(circuits);
  return circuits
    .filter((circuit) => circuit.kind === "lighting" && circuit.outlets > 0)
    .map((circuit) => ({ id: circuit.id, designation: designations[circuit.id] ?? "", label: circuit.label, outlets: circuit.outlets, ratedA: circuit.protection.ratedA, elementIds: [...new Set(circuit.nodeIds.map(elementIdOf))] }));
}

/**
 * Zásuvkové okruhy z výpočtu pro panel (označení -F jako v rozváděči, ruční okruh, zásuvky na plátně). `lengthOf` =
 * délka kabelu okruhu z výkazu tras [m]; bez ní nejdelší přívod okruhu.
 */
export function socketCircuitRows(circuits: readonly Circuit[], lengthOf: (id: string) => number | undefined = () => undefined): SocketCircuitRow[] {
  const designations = circuitDesignations(circuits);
  return circuits
    .filter((circuit) => circuit.kind === "sockets")
    .map((circuit) => ({
      id: circuit.id,
      designation: designations[circuit.id] ?? "",
      label: circuit.label.replace(/\s*\(ruční okruh Z\d+\)$/, ""),
      outlets: circuit.outlets,
      lengthM: lengthOf(circuit.id) ?? Math.round(circuit.lengthMm / 100) / 10,
      manual: /\(ruční okruh (Z\d+)\)$/.exec(circuit.label)?.[1] ?? null,
      elementIds: [...new Set(circuit.nodeIds.map(elementIdOf))],
    }));
}
