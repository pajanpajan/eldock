// Párování detekcí z fotky s katalogem, filtr Smart Fallback Pickeru a IEC značení prvků.
// Čisté funkce – sdílí služba analýzy fotky, seed i klientský picker.

import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";

import { normalizeManufacturer } from "./catalog";
import { slotBoxes, type BoundingBox, type EnclosureDims } from "./layout";
import { REFERENCE_DEVICES, withPositions } from "./reference";

/** Jeden modul rozpoznaný na fotce (z Gemini nebo z demo režimu). */
export interface Detection {
  dinRailIndex: number;
  positionOnRail: number;
  modules: number;
  box: BoundingBox | null;
  rawOcrText: string;
  category: ComponentCategory | null;
  poles: string | null;
  ratedCurrentA: number | null;
  trippingCurve: string | null;
  manufacturer: string | null;
  confidence: number;
  /** Ručně psaný popis pod přístrojem (je-li čitelný). */
  circuitLabel?: string;
  designation?: string;
}

export interface MatchableComponent {
  id: string;
  manufacturer: string;
  typeCode: string;
  articleNumber: string;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve: string | null;
  modulesCount: number;
}

export interface MatchResult {
  componentId: string | null;
  status: RecognitionStatus;
  confidence: number;
}

/** Jen písmena a číslice malými – „S201-B16“ i „s201 b16“ → „s201b16“. */
export const compact = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Stejný výrobce bez ohledu na zápis („EATON“ = „Eaton“, „Schneider Electric“ = „Schneider“). */
export const sameManufacturer = (a: string | null | undefined, b: string | null | undefined) => {
  const left = normalizeManufacturer(a);
  return left !== null && left === normalizeManufacturer(b);
};

const byPreference = (preferred: string | null) => (a: MatchableComponent, b: MatchableComponent) =>
  Number(sameManufacturer(b.manufacturer, preferred)) - Number(sameManufacturer(a.manufacturer, preferred)) || a.typeCode.localeCompare(b.typeCode);

/**
 * Detekce → katalog: přečtené objednací číslo nebo typ = VERIFIED; shoda parametrů (kategorie,
 * póly, proud, charakteristika) = PARTIAL k potvrzení; jinak UNRECOGNIZED. Hledá se napříč všemi
 * výrobci; výrobce přečtený u modulu má přednost před převažujícím výrobcem rozváděče
 * (`dominantManufacturer` null = „Různí výrobci“, bez preference).
 */
export function matchDetection(detection: Detection, catalog: readonly MatchableComponent[], dominantManufacturer: string | null): MatchResult {
  const ocr = compact(detection.rawOcrText);
  if (ocr.length >= 5) {
    const exact = catalog
      .filter((component) => ocr.includes(compact(component.articleNumber)) || (compact(component.typeCode).length >= 5 && ocr.includes(compact(component.typeCode))))
      // Nejdelší shoda vyhrává (DS201 B16 A30 nesmí skončit jako S201-B16), pak dominantní výrobce.
      .sort((a, b) => compact(b.typeCode).length - compact(a.typeCode).length || byPreference(dominantManufacturer)(a, b));
    if (exact[0]) return { componentId: exact[0].id, status: "VERIFIED", confidence: Math.max(detection.confidence, 0.9) };
  }
  if (detection.category && detection.ratedCurrentA) {
    const candidates = catalog
      .filter(
        (component) =>
          component.category === detection.category &&
          component.ratedCurrentA === detection.ratedCurrentA &&
          (!detection.poles || component.poles === detection.poles) &&
          (!detection.trippingCurve || component.trippingCurve === detection.trippingCurve) &&
          (!detection.manufacturer || sameManufacturer(component.manufacturer, detection.manufacturer)),
      )
      .sort(byPreference(detection.manufacturer ?? dominantManufacturer));
    if (candidates[0]) return { componentId: candidates[0].id, status: "PARTIAL", confidence: Math.min(detection.confidence, 0.7) };
  }
  return { componentId: null, status: "UNRECOGNIZED", confidence: Math.min(detection.confidence, 0.3) };
}

// ---------------------------------------------------------------------------
//  IEC značení (ČSN EN 81346): Q odpínače, F jisticí a ochranné přístroje, K stykače a relé …
// ---------------------------------------------------------------------------

export const DESIGNATION_PREFIX: Record<ComponentCategory, string> = {
  MAIN_SWITCH: "Q",
  MCB: "F",
  RCD: "F",
  RCBO: "F",
  SPD: "F",
  CONTACTOR: "K",
  RELAY: "K",
  PSU: "T",
  PLC: "A",
  TERMINAL: "X",
  ENCLOSURE: "A",
  OTHER: "F",
};

/** Značení v pořadí čtení (lišta shora, zleva): -Q1, -F1, -F2 … (nerozpoznané = jistič). */
export function designationsInOrder(categories: readonly (ComponentCategory | null)[]): string[] {
  const counters = new Map<string, number>();
  return categories.map((category) => {
    const prefix = DESIGNATION_PREFIX[category ?? "MCB"];
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    return `-${prefix}${next}`;
  });
}

// ---------------------------------------------------------------------------
//  Demo režim (bez GEMINI_API_KEY): deterministická detekce referenčního rozváděče
// ---------------------------------------------------------------------------

/** Simulovaná detekce: 13 přístrojů referenčního rozváděče s rámečky v geometrii skříně. */
export function demoDetections(dims: EnclosureDims): Detection[] {
  const placed = withPositions(REFERENCE_DEVICES).map((device) => ({ ...device, dinRailIndex: Math.min(device.rail, dims.dinRailsCount), modulesWidth: device.modules }));
  const boxes = slotBoxes(dims, placed);
  return placed.map((device) => {
    const unreadable = device.status === "UNRECOGNIZED";
    const partial = device.status === "PARTIAL";
    return {
      dinRailIndex: device.dinRailIndex,
      positionOnRail: device.positionOnRail,
      modules: device.modules,
      box: boxes.get(device) ?? null,
      rawOcrText: device.ocr,
      category: device.category,
      poles: unreadable ? null : device.poles,
      ratedCurrentA: unreadable ? null : device.ratedCurrentA,
      trippingCurve: unreadable ? null : device.trippingCurve,
      manufacturer: unreadable || partial ? null : device.manufacturer,
      confidence: device.confidence,
      circuitLabel: device.label,
      designation: device.designation,
    };
  });
}
