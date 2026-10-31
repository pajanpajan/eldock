// Referenční domovní / podružný rozváděč (public/demo-docs/domovni-rozvadec-rh1.pdf): osazení
// 3 DIN lišt. Z něj vychází seed projektu PB-001 i deterministická demo analýza fotky bez Gemini.

import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";

export interface ReferenceDevice {
  designation: string;
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  category: ComponentCategory;
  poles: string;
  ratedCurrentA: number;
  trippingCurve: string | null;
  modules: number;
  rail: number;
  label: string;
  /** Výsledek „rozpoznání“ – -F6 je pod odleskem, -F9 přečten jen částečně. */
  status: RecognitionStatus;
  confidence: number;
  ocr: string;
  glare?: boolean;
}

export const REFERENCE_DIMS = { widthMm: 292, heightMm: 507, depthMm: 120, dinRailsCount: 3, modulesPerRail: 12 } as const;

const mcb = (designation: string, poles: "1P" | "3P", current: number, label: string, rail: number, extra: Partial<ReferenceDevice> = {}): ReferenceDevice => {
  const typeCode = `S20${poles === "3P" ? 3 : 1}-B${current}`;
  return {
    designation,
    articleNumber: poles === "3P" ? "2CDS253001R0165" : current === 10 ? "2CDS251001R0105" : "2CDS251001R1165",
    typeCode,
    manufacturer: "ABB",
    category: "MCB",
    poles,
    ratedCurrentA: current,
    trippingCurve: "B",
    modules: poles === "3P" ? 3 : 1,
    rail,
    label,
    status: "VERIFIED",
    confidence: 0.94,
    ocr: `ABB ${typeCode} 6kA`,
    ...extra,
  };
};

export const REFERENCE_DEVICES: ReferenceDevice[] = [
  {
    designation: "-Q1",
    articleNumber: "2CDD283101R0040",
    typeCode: "SD203/40",
    manufacturer: "ABB",
    category: "MAIN_SWITCH",
    poles: "3P",
    ratedCurrentA: 40,
    trippingCurve: null,
    modules: 3,
    rail: 1,
    label: "Odpínač",
    status: "VERIFIED",
    confidence: 0.97,
    ocr: "ABB SD203/40 400V",
  },
  {
    designation: "-F1",
    articleNumber: "2CTB803973R1200",
    typeCode: "OVR T2-T3 3N 20-275 P QS",
    manufacturer: "ABB",
    category: "SPD",
    poles: "3P+N",
    ratedCurrentA: 40,
    trippingCurve: null,
    modules: 4,
    rail: 1,
    label: "Přepěťová ochrana (SPD)",
    status: "VERIFIED",
    confidence: 0.93,
    ocr: "ABB OVR T2-T3 3N 20-275 P QS",
  },
  {
    designation: "-F2",
    articleNumber: "2CSF204102R1400",
    typeCode: "FH204 A-40/0,03",
    manufacturer: "ABB",
    category: "RCD",
    poles: "4P",
    ratedCurrentA: 40,
    trippingCurve: null,
    modules: 4,
    rail: 1,
    label: "Proudový chránič (RCD)",
    status: "VERIFIED",
    confidence: 0.95,
    ocr: "ABB FH204 A-40/0,03 IΔn 30mA",
  },
  mcb("-F3", "3P", 16, "Tepelné čerpadlo", 2),
  mcb("-F4", "3P", 16, "Sporák", 2),
  mcb("-F5", "1P", 10, "Světla chodby", 2),
  mcb("-F6", "1P", 10, "Světla obytné místnosti", 2, { status: "UNRECOGNIZED", confidence: 0.18, ocr: "S2?? -B1?", glare: true }),
  mcb("-F7", "1P", 10, "Světla koupelny + venkovní", 2),
  mcb("-F8", "1P", 16, "Zásuvky kuchyně", 2),
  mcb("-F9", "1P", 16, "Zásuvky obývák", 2, { status: "PARTIAL", confidence: 0.64, ocr: "S201-B1б" }),
  mcb("-F10", "1P", 16, "Zásuvky obývák + chodba", 2),
  mcb("-F11", "1P", 16, "Zásuvky ložnice + koupelna", 3),
  mcb("-F12", "1P", 16, "Zásuvky pokoje + koupelna", 3),
];

/** Pozice na liště (1..N zleva) podle pořadí v seznamu. */
export function withPositions<T extends { rail: number }>(devices: readonly T[]): (T & { dinRailIndex: number; positionOnRail: number })[] {
  return devices.map((device, index) => ({
    ...device,
    dinRailIndex: device.rail,
    positionOnRail: devices.slice(0, index).filter((other) => other.rail === device.rail).length + 1,
  }));
}
