import type { BuildingType, ComplianceCategory, EquipmentType, InspectionType } from "@/generated/prisma/enums";

// Formátování pro české UI. Pevné časové pásmo, aby server i klient vykreslily totéž.

const TIME_ZONE = "Europe/Prague";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const shortDateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});
const dateTimeFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});
const relativeFormat = new Intl.RelativeTimeFormat("cs-CZ", { numeric: "auto" });

export const formatDate = (date: Date | string | number) => dateFormat.format(new Date(date));
/** „28.12.2027“ – pevný tvar DD.MM.RRRR (štítky, odznaky, dokumenty). */
export const formatDateShort = (date: Date | string | number) => shortDateFormat.format(new Date(date)).replace(/\s/g, "");
export const formatDateTime = (date: Date | string | number) => dateTimeFormat.format(new Date(date));

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** „před 3 hodinami“, „včera“, … Pod minutu = „právě teď“. */
export function formatRelative(date: Date | string | number, now: Date | number = new Date()): string {
  const diffSeconds = Math.round((new Date(date).getTime() - new Date(now).getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  for (const [unit, seconds] of RELATIVE_UNITS) {
    if (abs >= seconds) return relativeFormat.format(Math.round(diffSeconds / seconds), unit);
  }
  return "právě teď";
}

/** České skloňování podle počtu: `plural(1, ["změna", "změny", "změn"])` → „změna“. */
export function plural(count: number, forms: readonly [one: string, few: string, many: string]): string {
  const n = Math.abs(count);
  if (n === 1) return forms[0];
  if (n >= 2 && n <= 4) return forms[1];
  return forms[2];
}

/** „5 změn“ */
export const formatCount = (count: number, forms: readonly [string, string, string]) =>
  `${count} ${plural(count, forms)}`;

export const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  SWITCHBOARD: "Rozváděč",
  TRANSFORMER: "Transformátor",
  PRODUCTION_LINE: "Výrobní linka",
  MACHINE: "Pevný stroj",
  CNC_MACHINE: "CNC stroj",
  ROBOT_CELL: "Robotické pracoviště",
  HVAC_UNIT: "Vzduchotechnika",
  COMPRESSOR: "Kompresor",
  POWER_TOOL: "Ruční elektrické nářadí",
  APPLIANCE: "Spotřebič",
  EXTENSION_CORD: "Prodlužovací přívod",
  WELDER: "Svářečka",
  LIGHTNING_ROD: "Hromosvod (LPS)",
  EMERGENCY_LIGHTING: "Nouzové osvětlení",
  OTHER: "Ostatní",
};

export const BUILDING_TYPE_LABELS: Record<BuildingType, string> = {
  PRODUCTION: "Výrobní hala",
  ASSEMBLY: "Montáž",
  ENERGY: "Energetika",
  WAREHOUSE: "Sklad",
  OFFICE: "Administrativa",
  OTHER: "Ostatní",
};

/** Iniciály bez titulů („Ing. Tomáš Král“ → „TK“). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => !part.endsWith("."))
    .map((part) => part[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  INITIAL: "Výchozí revize",
  PERIODIC: "Pravidelná revize",
  EXTRAORDINARY: "Mimořádná revize",
  THERMOVISION: "Termovize",
};

export const COMPLIANCE_CATEGORY_LABELS: Record<ComplianceCategory, { label: string; hint: string }> = {
  SINGLE_LINE_DIAGRAM: { label: "Liniové schéma", hint: "Jednopólové schéma rozvodu a vývodů" },
  CONFORMITY_DECLARATION: { label: "EU prohlášení o shodě", hint: "ČSN EN 61439-1/-2, nařízení vlády 117/2016 Sb." },
  ROUTINE_VERIFICATION: { label: "Kusová zkouška", hint: "Kusové ověření dle čl. 11 ČSN EN 61439-1" },
  THERMAL_CALCULATION: { label: "Výpočet oteplení", hint: "Ověření oteplení výpočtem, čl. 10.10.4" },
  EXTERNAL_INFLUENCES: { label: "Vnější vlivy", hint: "Protokol o určení vnějších vlivů (ČSN 33 2000-5-51)" },
};

/** Pořadí karet v záložce Pasport & Shoda. */
export const COMPLIANCE_CATEGORY_ORDER: ComplianceCategory[] = [
  "SINGLE_LINE_DIAGRAM",
  "CONFORMITY_DECLARATION",
  "ROUTINE_VERIFICATION",
  "THERMAL_CALCULATION",
  "EXTERNAL_INFLUENCES",
];
