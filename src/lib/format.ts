import type { BuildingType, EquipmentType } from "@/generated/prisma/enums";

// Formátování pro české UI. Pevné časové pásmo, aby server i klient vykreslily totéž.

const TIME_ZONE = "Europe/Prague";

const dateFormat = new Intl.DateTimeFormat("cs-CZ", {
  day: "numeric",
  month: "numeric",
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
  CNC_MACHINE: "CNC stroj",
  PRODUCTION_LINE: "Výrobní linka",
  ROBOT_CELL: "Robotické pracoviště",
  HVAC_UNIT: "Vzduchotechnika",
  COMPRESSOR: "Kompresor",
  TRANSFORMER: "Transformátor",
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
