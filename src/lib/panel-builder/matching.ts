// Párování detekcí z fotky s katalogem, filtr Smart Fallback Pickeru a IEC značení prvků.
// Čisté funkce – sdílí služba analýzy fotky, seed i klientský picker.

import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";

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

const byPreference = (dominant: string | null) => (a: MatchableComponent, b: MatchableComponent) =>
  Number(b.manufacturer === dominant) - Number(a.manufacturer === dominant) || a.typeCode.localeCompare(b.typeCode);

/**
 * Detekce → katalog: přečtené objednací číslo nebo typ = VERIFIED; shoda parametrů (kategorie,
 * póly, proud, charakteristika) = PARTIAL k potvrzení; jinak UNRECOGNIZED.
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
          (!detection.manufacturer || component.manufacturer === detection.manufacturer || component.manufacturer === dominantManufacturer),
      )
      .sort(byPreference(detection.manufacturer ?? dominantManufacturer));
    if (candidates[0]) return { componentId: candidates[0].id, status: "PARTIAL", confidence: Math.min(detection.confidence, 0.7) };
  }
  return { componentId: null, status: "UNRECOGNIZED", confidence: Math.min(detection.confidence, 0.3) };
}

/** Nejčastější výrobce mezi detekcemi (předvolba pickeru). */
export function dominantManufacturer(detections: readonly { manufacturer: string | null }[], fallback = "ABB"): string {
  const counts = new Map<string, number>();
  for (const { manufacturer } of detections) if (manufacturer) counts.set(manufacturer, (counts.get(manufacturer) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
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

// ---------------------------------------------------------------------------
//  Smart Fallback Picker
// ---------------------------------------------------------------------------

export interface PickerSelection {
  category: ComponentCategory | null;
  poles: string | null;
  curve: string | null;
  current: number | null;
  manufacturer: string | null;
  modules: number | null;
}

/** Dlaždice kroku 1 (velké, pro prsty). */
export const PICKER_CATEGORIES: { value: ComponentCategory; label: string }[] = [
  { value: "MCB", label: "Jistič" },
  { value: "RCD", label: "Chránič" },
  { value: "RCBO", label: "Jističochránič" },
  { value: "MAIN_SWITCH", label: "Odpínač" },
  { value: "SPD", label: "SPD" },
  { value: "CONTACTOR", label: "Stykač" },
  { value: "OTHER", label: "Jiné" },
];
export const PICKER_POLES = ["1P", "1P+N", "3P", "3P+N", "4P"] as const;
export const PICKER_CURVES = ["B", "C", "D"] as const;
export const PICKER_CURRENTS = [6, 10, 16, 20, 25, 32, 40, 63] as const;

/** Kusy z katalogu pro výběr v pickeru: dominantní výrobce a stejná šířka napřed. */
export function pickerCandidates<T extends MatchableComponent & { powerLossWatts: number }>(catalog: readonly T[], selection: PickerSelection): T[] {
  if (!selection.category) return [];
  const others = selection.category === "OTHER";
  return catalog
    .filter(
      (component) =>
        (others ? !["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "ENCLOSURE"].includes(component.category) : component.category === selection.category) &&
        (!selection.poles || component.poles === selection.poles) &&
        (!selection.curve || !component.trippingCurve || component.trippingCurve === selection.curve) &&
        (!selection.current || component.ratedCurrentA === selection.current),
    )
    .sort(
      (a, b) =>
        Number(b.manufacturer === selection.manufacturer) - Number(a.manufacturer === selection.manufacturer) ||
        Number(b.modulesCount === selection.modules) - Number(a.modulesCount === selection.modules) ||
        a.ratedCurrentA - b.ratedCurrentA ||
        a.typeCode.localeCompare(b.typeCode),
    );
}

/** Výchozí výběr pickeru z odhadu analýzy (detectedJson) a dominantního výrobce. */
export function initialSelection(detected: Partial<PickerSelection & { ratedCurrentA: number | null; trippingCurve: string | null }> | null, dominant: string, modules: number): PickerSelection {
  return {
    category: detected?.category ?? null,
    poles: detected?.poles ?? null,
    curve: detected?.trippingCurve ?? null,
    current: detected?.ratedCurrentA ?? null,
    manufacturer: dominant,
    modules,
  };
}
