// Standardizované mechanické vektorové symboly přístrojů (fáze 42): data přístroje pro 2D vektorový
// rozváděč a dynamické texty uvnitř symbolu (IEC značení, výrobce, klíčová hodnota, typ, funkce obvodu).
// Čisté funkce – sdílí krok 1 (konfigurátor), krok 2 (zapojení) i testy.

import type { ComponentCategory, RecognitionStatus } from "@/generated/prisma/enums";

import { catalogCategory, parseConfig, type ItemConfig } from "./configurator";
import { ROLE_COLOR, profileLabel, smartDinProfile, type SmartDinProfile } from "./smart-din-catalog";
import type { SmartRole, SmartSystemId } from "./smart-home";

/** Přístroj na vektorové DIN liště. */
export interface VectorDevice {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  category: ComponentCategory | null;
  poles: string | null;
  manufacturer: string | null;
  typeCode: string | null;
  articleNumber: string | null;
  ratedCurrentA: number | null;
  curve: string | null;
  rcdType: string | null;
  rcdSensitivityMa: number | null;
  spdType: string | null;
  contactConfig: string | null;
  power: string | null;
  powerLossWatts: number | null;
  /** Funkce / popis obvodu (spodní štítek). */
  label: string;
  status: RecognitionStatus;
  /** Fáze 81: profil kusu chytré domácnosti (funkce, kanály, barevný štítek) – jinak se dopočte z typu (`smartProfileOf`). */
  smart?: SmartDinProfile | null;
  /** Fáze 112: přiřazená fáze („L1“, „L1,L2,L3,N“) – odznak fáze na plátně. */
  phaseAssignment?: string | null;
}

/** Fáze 81: profil aktoru chytré domácnosti na DIN liště (z konfigurace, jinak z výrobce a typu kusu). */
export function smartProfileOf(device: Pick<VectorDevice, "smart" | "category" | "manufacturer" | "typeCode" | "articleNumber">): SmartDinProfile | null {
  if (device.smart !== undefined && device.smart !== null) return device.smart;
  return device.category === "PLC" || device.category === "PSU" ? smartDinProfile(device) : null;
}

/** Počet svorek v pásu aktoru: aspoň jedna na modul, u vícekanálových aktorů po kanálu (vejde-li se 9 px na svorku). */
export function smartTerminalCount(modules: number, channels: number, widthPx: number): number {
  return Math.max(screwCount(modules), Math.min(channels, Math.floor((widthPx - 2) / 9)));
}

/** Texty uvnitř symbolu. */
export interface SymbolTexts {
  manufacturer: string;
  /** Výrazná klíčová hodnota („B16“, „AC 25A 0,03A“, „40A“). */
  value: string;
  /** Drobný typ pod hodnotou („S201-B16“). */
  detail: string;
}

const num = (value: number) => String(value).replace(".", ",");
/** 30 mA → „0,03A“ (zápis z čela chrániče). */
export const sensitivityAmps = (ma: number) => `${num(Math.round((ma / 1000) * 1000) / 1000)}A`;

/** Dynamické texty symbolu podle kategorie (zadání fáze 42, bod 2). */
export function symbolTexts(device: Pick<VectorDevice, "category" | "manufacturer" | "typeCode" | "ratedCurrentA" | "curve" | "rcdType" | "rcdSensitivityMa" | "spdType" | "contactConfig" | "power" | "status">): SymbolTexts {
  const manufacturer = device.manufacturer ?? "";
  const detail = device.typeCode ?? "";
  const amps = device.ratedCurrentA ? `${num(device.ratedCurrentA)}A` : "";
  switch (device.category) {
    case "MCB":
      return { manufacturer, value: `${device.curve ?? ""}${device.ratedCurrentA ? num(device.ratedCurrentA) : ""}` || "?", detail };
    case "RCD":
      return { manufacturer, value: [device.rcdType, amps, device.rcdSensitivityMa ? sensitivityAmps(device.rcdSensitivityMa) : ""].filter(Boolean).join(" "), detail };
    case "RCBO":
      return { manufacturer, value: [`${device.curve ?? ""}${device.ratedCurrentA ? num(device.ratedCurrentA) : ""}`, device.rcdSensitivityMa ? sensitivityAmps(device.rcdSensitivityMa) : ""].filter(Boolean).join(" "), detail };
    case "MAIN_SWITCH":
      return { manufacturer, value: amps ? `(${amps})` : "", detail };
    case "SPD":
      return { manufacturer, value: device.spdType ?? "SPD", detail };
    case "CONTACTOR":
      return { manufacturer, value: [amps, device.contactConfig].filter(Boolean).join(" "), detail };
    case "RELAY":
      return { manufacturer, value: amps, detail };
    case "PSU":
    case "PLC":
    case "TERMINAL":
    case "OTHER":
      return { manufacturer, value: device.power ?? amps, detail };
    default:
      return { manufacturer, value: device.status === "UNRECOGNIZED" ? "?" : "", detail };
  }
}

/** Počet šroubů svorek v jednom pásu: 1M = 1, 2M = 2 … (min. 1, polovina modulu = 1). */
export const screwCount = (modules: number) => Math.max(1, Math.round(modules));

/** Počet ovládacích páček jističe podle pólů (kompaktní přístroj = podle šířky). */
export function leverCount(poles: string | null, modules: number): number {
  const byPoles = poles === "2x1P" ? 2 : poles === "4P" || poles === "3P+N" ? 4 : poles === "3P" ? 3 : poles === "2P" ? 2 : 1;
  return Math.max(1, Math.min(byPoles, Math.max(1, Math.round(modules))));
}

/** Řádek prvku z databáze (katalogový kus, uložená konfigurace) → přístroj vektorového rozváděče. */
export function vectorDeviceFrom(item: {
  id: string;
  designation: string;
  dinRailIndex: number;
  positionOnRail: number;
  modulesWidth: number;
  circuitLabel: string;
  customTypeCode: string | null;
  recognitionStatus: RecognitionStatus;
  rawOcrText: string | null;
  configJson: string | null;
  phaseAssignment?: string | null;
  catalogComponent: {
    category: ComponentCategory;
    manufacturer: string;
    typeCode: string;
    articleNumber: string;
    poles: string;
    ratedCurrentA: number;
    trippingCurve: string | null;
    rcdType: string | null;
    rcdSensitivityMa: number | null;
    spdType: string | null;
    contactConfig: string | null;
    powerLossWatts: number;
  } | null;
}): VectorDevice {
  const component = item.catalogComponent;
  const config = parseConfig(item.configJson);
  const base: VectorDevice = {
    id: item.id,
    designation: item.designation,
    dinRailIndex: item.dinRailIndex,
    positionOnRail: item.positionOnRail,
    modulesWidth: item.modulesWidth,
    category: component?.category ?? null,
    poles: component?.poles ?? null,
    manufacturer: component?.manufacturer ?? null,
    typeCode: item.customTypeCode ?? component?.typeCode ?? (item.recognitionStatus === "UNRECOGNIZED" ? null : item.rawOcrText),
    articleNumber: component?.articleNumber ?? null,
    ratedCurrentA: component?.ratedCurrentA || null,
    curve: component?.trippingCurve ?? null,
    rcdType: component?.rcdType ?? null,
    rcdSensitivityMa: component?.rcdSensitivityMa ?? null,
    spdType: component?.spdType ?? null,
    contactConfig: component?.contactConfig ?? null,
    power: config?.power ?? null,
    powerLossWatts: component?.powerLossWatts ?? null,
    label: item.circuitLabel,
    status: item.recognitionStatus,
    phaseAssignment: item.phaseAssignment ?? null,
  };
  return base;
}

/**
 * Optimistický náhled: rozklikaná konfigurace se hned propíše do textů symbolu (výrobce, In,
 * charakteristika, póly, šířka), než dorazí uložený katalogový kus.
 */
export function deviceWithConfig(device: VectorDevice, config: ItemConfig): VectorDevice {
  return {
    ...device,
    category: catalogCategory(config),
    poles: config.poles,
    manufacturer: config.manufacturer ?? device.manufacturer,
    ratedCurrentA: config.ratedCurrentA,
    curve: config.curve ?? null,
    rcdType: config.rcdType ?? null,
    rcdSensitivityMa: config.rcdSensitivityMa ?? null,
    spdType: config.spdType ?? null,
    contactConfig: config.contactConfig ?? null,
    power: config.power ?? null,
    // Typ a objednací číslo dorazí s uloženým katalogovým kusem (do té doby by byly zastaralé)
    typeCode: null,
    articleNumber: null,
    status: "VERIFIED",
    // Fáze 81: aktor chytré domácnosti z konfigurace (funkce a kanály) ještě před uloženým kusem
    smart: config.category === "SMART_HOME" && config.smartRole ? configProfile(config) : null,
  };
}

function configProfile(config: ItemConfig): SmartDinProfile {
  const role = (config.smartRole ?? "switch") as SmartRole;
  const channels = config.channels ?? 0;
  return { system: (config.smartSystem ?? "abb_freeathome") as SmartSystemId, role, channels, ratedA: null, label: profileLabel(role, channels, null), color: ROLE_COLOR[role] };
}
