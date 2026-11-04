// Elektrotechnická pravidla pro detekce Vision Analyzeru (fáze 47, rozbor 144M skříně ABB CA35R).
// Deterministická oprava toho, co AI z fotky typicky splete – podle textu z čela přístroje (typový kód)
// a šířky. Čisté funkce, testy v detection-rules.test.ts.

import type { Detection } from "./matching";

const n = (value: string | undefined) => (value ? Number(value.replace(",", ".")) : null);

/**
 * PRAVIDLA B–E:
 * - ABB DS301C / DSN201 = kompaktní jističochránič 1P+N v JEDNOM modulu (2 šroubky nahoře ≠ 2 jističe).
 * - EN20/25/40-xxN, ESB = instalační stykač (číslo za EN/ESB je proud AC-1, ne jistič 25 A).
 * - FH204 / F204 = 4P chránič 4M (čte se 40A vs 25A), S203 = 3P jistič 3M, S201 = 1P jistič.
 * - KNX / free@home / Loxone aktory = jeden široký řídicí modul (4/8/12M), ne řada jističů.
 * - Řadové svorky = TERMINAL (-X).
 */
export function normalizeDetection(detection: Detection): Detection {
  const text = detection.rawOcrText.toUpperCase().replace(/\s+/g, " ");
  const compact = text.replace(/[\s-]/g, "");

  // Kompaktní 1M jističochránič ABB DS301C / DSN201
  const rcbo = /(DS301C|DSN201)/.exec(compact);
  if (rcbo) {
    const curve = /(?:DS301C|DSN201)[^A-Z0-9]*([BCK])(\d{1,2})/.exec(compact);
    const ma = /A?(\d{2,3})MA|A(30|10|100|300)\b/.exec(text);
    return {
      ...detection,
      category: "RCBO",
      poles: "1P+N",
      modules: 1,
      trippingCurve: curve?.[1] === "C" ? "C" : "B",
      ratedCurrentA: curve ? Number(curve[2]) : detection.ratedCurrentA,
      rcdType: detection.rcdType ?? "A",
      rcdSensitivityMa: ma ? Number(ma[1] ?? ma[2]) : (detection.rcdSensitivityMa ?? 30),
      manufacturer: detection.manufacturer ?? "ABB",
    };
  }

  // Instalační stykač ABB EN20-20N / EN25-40N / EN40-40N, ESB
  const contactor = /\b(EN|ESB)\s?(\d{2})-(\d)(\d)N?\b/.exec(text) ?? /\b(EN|ESB)(\d{2})(\d)(\d)N\b/.exec(compact);
  if (contactor) {
    const current = Number(contactor[2]);
    const no = Number(contactor[3]);
    return {
      ...detection,
      category: "CONTACTOR",
      poles: no >= 4 ? "4P" : "2P",
      ratedCurrentA: current,
      trippingCurve: null,
      modules: contactor[1] === "EN" ? (current >= 40 ? 3 : no >= 4 ? 2 : 1) : Math.max(detection.modules, 1),
      manufacturer: detection.manufacturer ?? "ABB",
    };
  }

  // 4P proudový chránič FH204 / F204 (40A vs 25A, IΔn 0,03A)
  if (/FH?204/.test(compact)) {
    const current = /(?:\D|^)(25|40|63)A?\b|-(25|40|63)\//.exec(text);
    const ma = /0[,.](03|1|3)\b|(\d{2,3})\s?MA/.exec(text);
    return {
      ...detection,
      category: "RCD",
      poles: "4P",
      modules: 4,
      trippingCurve: null,
      ratedCurrentA: current ? Number(current[1] ?? current[2]) : detection.ratedCurrentA,
      rcdType: /\bAC\b/.test(text) ? "AC" : "A",
      rcdSensitivityMa: ma ? (ma[1] ? Math.round(Number(`0.${ma[1]}`) * 1000) : Number(ma[2])) : (detection.rcdSensitivityMa ?? 30),
    };
  }

  // Jističe ABB S201 / S203 – charakteristika a proud z kódu (B2, B10, B16, B20)
  const mcb = /S20([13])M?[^A-Z0-9]*([BCDKZ])\s?(\d{1,2})\b/.exec(text) ?? /S20([13])M?([BCDKZ])(\d{1,2})/.exec(compact);
  if (mcb) {
    const three = mcb[1] === "3";
    return { ...detection, category: "MCB", poles: three ? "3P" : "1P", modules: three ? 3 : 1, trippingCurve: mcb[2], ratedCurrentA: Number(mcb[3]), manufacturer: detection.manufacturer ?? "ABB" };
  }

  // Řídicí moduly chytré elektroinstalace (KNX, free@home, Loxone) – jeden široký modul
  if (/(SA\/S|SA-M|BA-M|FREE@HOME|KNX|LOXONE|MINISERVER|RELAY EXTENSION)/.test(text)) {
    const channels = n(/(?:SA\/S|SA-M-?)\s?(\d{1,2})\./.exec(text)?.[1]);
    return { ...detection, category: "PLC", poles: null, ratedCurrentA: null, trippingCurve: null, modules: channels && channels >= 4 ? channels : Math.max(detection.modules, 4) };
  }

  // Řadové svorky
  if (/(SVORK|WDU|PT ?2[.,]5|PT ?4|UT ?2[.,]5|TERMINAL)/.test(text)) {
    return { ...detection, category: "TERMINAL", poles: null, trippingCurve: null, ratedCurrentA: null };
  }
  return detection;
}

/** Součet osazených modulů lišty (pravidlo A: volná lišta se nedoplňuje smyšlenými moduly). */
export const occupiedModules = (detections: readonly Pick<Detection, "modules">[]) => detections.reduce((sum, detection) => sum + detection.modules, 0);
