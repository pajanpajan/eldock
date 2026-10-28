// Lhůtník revizí: zápis nové revizní zprávy / termovize k zařízení. Služba dostává
// `prisma` jako parametr (testovatelné bez cookies). Záměrně bez `server-only`.

import type { InspectionResult, InspectionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatDateShort } from "@/lib/format";
import { computeValidUntil, daysUntil, defaultValidityMonths } from "@/lib/inspection";
import { renderInspectionReportSvg } from "@/lib/mock-graphics/compliance";
import { WorkflowError } from "@/lib/workflow/state-machine";

export interface RecordInspectionInput {
  equipmentId: string;
  type: InspectionType;
  /** Den provedení revize `YYYY-MM-DD`. */
  inspectionDate: string;
  /** Platnost v měsících; bez ní lhůta zařízení (termovize 12 měsíců). */
  validityMonths?: number | null;
  reportNumber: string;
  inspectorName: string;
  inspectorLicense: string;
  result: InspectionResult;
  defectsSummary?: string | null;
}

/** `YYYY-MM-DD` → okamžik v poledne (stejně jako seed), ať datum nepřeskočí přes časová pásma. */
export function parseInspectionDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 10)) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new WorkflowError("VALIDATION", "Neplatné datum revize.");
  }
  return date;
}

async function loadEquipment(prisma: PrismaClient, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: {
      id: true,
      tag: true,
      name: true,
      ratedVoltage: true,
      ratedCurrent: true,
      inspectionIntervalMonths: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
    },
  });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  return equipment;
}

/** Ověří vstup a spočítá datum a platnost; sdílí ho zápis i generování zprávy. */
function prepare(input: RecordInspectionInput, intervalMonths: number, now: Date) {
  const inspectionDate = parseInspectionDate(input.inspectionDate);
  if (daysUntil(inspectionDate, now) > 0) throw new WorkflowError("VALIDATION", "Datum revize nemůže být v budoucnosti.");
  const months = input.validityMonths ?? defaultValidityMonths(input.type, intervalMonths);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new WorkflowError("VALIDATION", "Platnost revize musí být 1–120 měsíců.");
  }
  const defects = input.defectsSummary?.trim() || null;
  if (input.result !== "CAPABLE" && !defects) {
    throw new WorkflowError("VALIDATION", "U posudku s výhradou nebo neschopného provozu vypište zjištěné závady.");
  }
  const required = { reportNumber: input.reportNumber.trim(), inspectorName: input.inspectorName.trim(), inspectorLicense: input.inspectorLicense.trim() };
  if (!required.reportNumber || !required.inspectorName || !required.inspectorLicense) {
    throw new WorkflowError("VALIDATION", "Vyplňte číslo zprávy, revizního technika a číslo osvědčení.");
  }
  return { inspectionDate, validUntil: computeValidUntil(inspectionDate, months), defects, ...required };
}

/** Vygeneruje SVG revizní zprávy z formuláře (když technik nenahraje vlastní soubor). */
export async function renderInspectionReport(prisma: PrismaClient, input: RecordInspectionInput, now: Date = new Date()) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  const data = prepare(input, equipment.inspectionIntervalMonths, now);
  return renderInspectionReportSvg({
    tag: equipment.tag,
    name: equipment.name,
    location: `${equipment.floor.building.name} › ${equipment.floor.name}`,
    ratedVoltage: equipment.ratedVoltage,
    ratedCurrent: equipment.ratedCurrent,
    type: input.type,
    reportNumber: data.reportNumber,
    inspectionDate: formatDateShort(data.inspectionDate),
    validUntil: formatDateShort(data.validUntil),
    inspectorName: data.inspectorName,
    inspectorLicense: data.inspectorLicense,
    result: input.result,
    defectsSummary: data.defects,
  });
}

/** Zapíše revizní zprávu; platnost = datum + lhůta. Stav lhůtníku se odvozuje při čtení. */
export async function recordInspection(prisma: PrismaClient, input: RecordInspectionInput & { reportUrl: string }, now: Date = new Date()) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  const data = prepare(input, equipment.inspectionIntervalMonths, now);
  return prisma.inspectionRecord.create({
    data: {
      equipmentId: equipment.id,
      type: input.type,
      inspectionDate: data.inspectionDate,
      validUntil: data.validUntil,
      reportNumber: data.reportNumber,
      inspectorName: data.inspectorName,
      inspectorLicense: data.inspectorLicense,
      result: input.result,
      defectsSummary: data.defects,
      reportUrl: input.reportUrl,
    },
  });
}
