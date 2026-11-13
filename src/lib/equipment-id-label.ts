// Fáze 111: přehledný identifikační štítek zařízení ELDOCK (kotouč Zebra ZD421t 30 × 15 mm / 50 × 25 mm) – unikátní QR
// kód EL-xxxxxx z registru štítků, tučný název, výrobce a model, výrobní číslo S/N, místnost / budova, třída ochrany
// a skupina dle ČSN 33 1600 ed. 2 a termín příští revize. Čisté funkce (server, klient, testy).

import { qrUrl } from "./qr-label-registry";

export const ID_LABEL_SIZES = [
  { id: "50x25", widthMm: 50, heightMm: 25, title: "50 × 25 mm" },
  { id: "30x15", widthMm: 30, heightMm: 15, title: "30 × 15 mm" },
] as const;
export type IdLabelSize = (typeof ID_LABEL_SIZES)[number]["id"];
export const idLabelSize = (value: unknown) => ID_LABEL_SIZES.find((size) => size.id === value) ?? ID_LABEL_SIZES[0];

export interface IdLabelData {
  /** EL-000042 (null = štítek se přidělí při tisku). */
  serial: string | null;
  qrUrl: string | null;
  tag: string;
  title: string;
  brandModel: string | null;
  serialNumber: string | null;
  location: string;
  classGroup: string | null;
  nextRevision: string;
}

const czDate = (date: Date) => `${date.getDate()}. ${date.getMonth() + 1}. ${date.getFullYear()}`;

/** Název bez tagu („SP-0201 - Rychlovarná konvice“ → „Rychlovarná konvice“). */
export const titleWithoutTag = (name: string, tag: string) => (name.toUpperCase().startsWith(`${tag.toUpperCase()} - `) ? name.slice(tag.length + 3) : name).trim() || tag;

export function idLabelData(
  equipment: { tag: string; name: string; manufacturer: string | null; model: string | null; serialNumber: string | null; protectionClass: string | null; usageGroup: string | null; assignedZone: string | null },
  context: { serial: string | null; building: string; floor: string; validUntil: Date | null },
): IdLabelData {
  const brandModel = [equipment.manufacturer, equipment.model].filter(Boolean).join(" ") || null;
  const classGroup = equipment.protectionClass || equipment.usageGroup ? [equipment.protectionClass ? `Tř. ${equipment.protectionClass}` : null, equipment.usageGroup ? `sk. ${equipment.usageGroup}` : null].filter(Boolean).join(" · ") + " (ČSN 33 1600)" : null;
  return {
    serial: context.serial,
    qrUrl: context.serial ? qrUrl(context.serial) : null,
    tag: equipment.tag,
    title: titleWithoutTag(equipment.name, equipment.tag),
    brandModel,
    serialNumber: equipment.serialNumber,
    location: [equipment.assignedZone, context.floor, context.building].filter(Boolean).join(" · "),
    classGroup,
    nextRevision: context.validUntil ? `Revize do ${czDate(context.validUntil)}` : "Revize: zatím neprovedena",
  };
}
