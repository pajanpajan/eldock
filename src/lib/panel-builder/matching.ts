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
  /** Chránič / jističochránič: typ AC/A/F/B a citlivost IΔn v mA (páruje se s katalogem). */
  rcdType?: string | null;
  rcdSensitivityMa?: number | null;
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
  rcdType?: string | null;
  rcdSensitivityMa?: number | null;
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

/** Řada z typového označení („S201-B16“ → „s201“, „PL7-B16/1“ → „pl7“, „MBN116“ → „mbn116“). */
export const seriesOf = (typeCode: string) => compact(typeCode.trim().split(/[\s/-]/)[0] ?? "");

/** Délka řady přístroje nalezené v textu z čela (0 = nenalezena); delší shoda = konkrétnější řada (DS201 > S201). */
export const seriesHit = (component: Pick<MatchableComponent, "typeCode">, ocr: string) => {
  const series = seriesOf(component.typeCode);
  return series.length >= 3 && ocr.includes(series) ? series.length : 0;
};

const byPreference = (preferred: string | null) => (a: MatchableComponent, b: MatchableComponent) =>
  Number(sameManufacturer(b.manufacturer, preferred)) - Number(sameManufacturer(a.manufacturer, preferred)) || a.typeCode.localeCompare(b.typeCode);

/**
 * Detekce → katalog (CatalogComponent): přečtené objednací číslo nebo typ = VERIFIED; shoda parametrů
 * (kategorie, póly, proud, charakteristika B/C/D, u chráničů typ AC/A a citlivost mA) = PARTIAL k potvrzení; jinak UNRECOGNIZED. Hledá se napříč všemi
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
          (!detection.rcdType || component.rcdType === undefined || component.rcdType === detection.rcdType) &&
          (!detection.rcdSensitivityMa || component.rcdSensitivityMa === undefined || component.rcdSensitivityMa === detection.rcdSensitivityMa) &&
          (!detection.manufacturer || sameManufacturer(component.manufacturer, detection.manufacturer)),
      )
      // Fáze 56: řada přečtená z čela (PL6 vs. PL7, SH201 vs. S201, LTN vs. LTE) má přednost před abecedou.
      .sort((a, b) => seriesHit(b, ocr) - seriesHit(a, ocr) || byPreference(detection.manufacturer ?? dominantManufacturer)(a, b));
    if (candidates[0]) return { componentId: candidates[0].id, status: "PARTIAL", confidence: Math.min(detection.confidence, seriesHit(candidates[0], ocr) ? 0.8 : 0.7) };
  }
  return { componentId: null, status: "UNRECOGNIZED", confidence: Math.min(detection.confidence, 0.3) };
}

// ---------------------------------------------------------------------------
//  IEC značení (ČSN EN 81346, praxe domovních a průmyslových rozváděčů): -Q odpínač, -FI chránič,
//  -FA jističochránič, -FV svodič přepětí, -F jistič, -K stykač, -KA relé, -T zdroj, -X ostatní …
// ---------------------------------------------------------------------------

export const DESIGNATION_PREFIX: Record<ComponentCategory, string> = {
  MAIN_SWITCH: "Q",
  MCB: "F",
  RCD: "FI",
  RCBO: "FA",
  SPD: "FV",
  CONTACTOR: "K",
  RELAY: "KA",
  PSU: "T",
  PLC: "A",
  TERMINAL: "X",
  ENCLOSURE: "A",
  OTHER: "X",
};

/** Značení v pořadí čtení (lišta shora, zleva): -Q1, -FI1, -F1, -F2 … (nerozpoznané = jistič). */
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
