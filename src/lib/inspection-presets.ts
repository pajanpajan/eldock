import type { EquipmentType } from "@/generated/prisma/enums";

// Fáze 93: předvolby Knihy revizí podle typu provozu – výrobní závod (SÚIP / TIČR), obchodní centrum (BD4, nouzové
// osvětlení, CENTRAL STOP – HZS) a zdravotnictví (Skupina 1 / 2, ČSN EN 62353 ed. 2, ZIS IT – akreditační komise MZ).
// Předvolba filtruje přehled revizí i auditní report a dává souhrnný tisk (PDF) pro dozorový orgán. Čisté funkce.

export type InspectionPresetId = "INDUSTRY" | "RETAIL" | "HEALTH";

export interface InspectionPreset {
  id: InspectionPresetId;
  icon: string;
  /** Text tlačítka („🛍️ Obchodní centrum (BD4 + Nouzové osv. + Central Stop)“ bez ikony). */
  label: string;
  /** Pro koho je souhrnný tisk. */
  authority: string;
  types: readonly EquipmentType[];
  /** Předpisy a normy do záhlaví souhrnu. */
  norms: string;
}

export const INSPECTION_PRESETS: readonly InspectionPreset[] = [
  {
    id: "INDUSTRY",
    icon: "🏭",
    label: "Průmyslový závod",
    authority: "SÚIP / TIČR",
    types: ["SWITCHBOARD", "TRANSFORMER", "PRODUCTION_LINE", "MACHINE", "CNC_MACHINE", "ROBOT_CELL", "HVAC_UNIT", "COMPRESSOR", "POWER_TOOL", "APPLIANCE", "EXTENSION_CORD", "WELDER", "LIGHTNING_ROD", "WIRING_DEVICE", "OTHER"],
    norms: "zákon 250/2021 Sb., NV 190/2022 Sb. (příloha č. 4), NV 378/2001 Sb., ČSN 33 1600 ed. 2",
  },
  {
    id: "RETAIL",
    icon: "🛍️",
    label: "Obchodní centrum (BD4 + Nouzové osv. + Central Stop)",
    authority: "HZS",
    types: ["SWITCHBOARD", "TRANSFORMER", "WIRING_DEVICE", "EMERGENCY_LIGHTING", "FIRE_SHUTDOWN", "LIGHTNING_ROD", "HVAC_UNIT"],
    norms: "ČSN 33 2000-7-718, vyhláška č. 23/2008 Sb., vyhláška č. 246/2001 Sb., ČSN EN 50172, ČSN EN 1838, NV 190/2022 Sb.",
  },
  {
    id: "HEALTH",
    icon: "🏥",
    label: "Zdravotnictví (Skupina 1/2 + ČSN EN 62353 + ZIS IT)",
    authority: "akreditační komise MZ",
    types: ["MEDICAL_DEVICE", "MEDICAL_ROOM", "SWITCHBOARD", "TRANSFORMER", "EMERGENCY_LIGHTING", "FIRE_SHUTDOWN"],
    norms: "ČSN 33 2000-7-710 ed. 2, ČSN EN 62353 ed. 2, zákon č. 375/2022 Sb., ČSN EN 50172, NV 190/2022 Sb.",
  },
];

export const isInspectionPreset = (value: unknown): value is InspectionPresetId => INSPECTION_PRESETS.some((preset) => preset.id === value);
export const presetById = (value: unknown): InspectionPreset | null => INSPECTION_PRESETS.find((preset) => preset.id === value) ?? null;
export const inPreset = (type: EquipmentType, preset: InspectionPreset | null) => !preset || preset.types.includes(type);
/** Text tlačítka předvolby („[ 🏥 Zdravotnictví (…) ]“). */
export const presetButton = (preset: InspectionPreset) => `${preset.icon} ${preset.label}`;
