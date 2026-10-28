// Lhůtník revizí: zápis revizní zprávy / termovize k zařízení, hromadná revize více zařízení
// a rychlá revize spotřebiče s měřením. Služby dostávají `prisma` jako parametr (testovatelné
// bez cookies). Platnost se počítá z lhůty zařízení (`inspection-rules`). Záměrně bez `server-only`.

import type { EquipmentType, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { formatDateShort } from "@/lib/format";
import { computeValidUntil, daysUntil, defaultValidityMonths, pragueToday } from "@/lib/inspection";
import { evaluateMeasurements, inspectionRuleFor, isPortable } from "@/lib/inspection-rules";
import { renderBatchProtocolSvg, renderInspectionReportSvg } from "@/lib/mock-graphics/compliance";
import { WorkflowError } from "@/lib/workflow/state-machine";

export interface MeasurementFields {
  measuringInstrument?: string | null;
  /** R_PE [Ω] */
  protectiveConductorResistance?: number | null;
  /** R_iso [MΩ] */
  insulationResistance?: number | null;
}

export interface RecordInspectionInput extends MeasurementFields {
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

const equipmentSelect = {
  id: true,
  tag: true,
  name: true,
  type: true,
  usageGroup: true,
  protectionClass: true,
  ratedVoltage: true,
  ratedCurrent: true,
  inspectionIntervalMonths: true,
  floor: { select: { name: true, building: { select: { name: true } } } },
} as const;

async function loadEquipment(prisma: PrismaClient, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: equipmentSelect });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  return equipment;
}

type LoadedEquipment = Awaited<ReturnType<typeof loadEquipment>>;

const standardOf = (equipment: { type: EquipmentType; usageGroup?: string | null; protectionClass?: string | null }) =>
  inspectionRuleFor(equipment).standard;

function cleanMeasurements(input: MeasurementFields) {
  const value = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const rpe = value(input.protectiveConductorResistance);
  const riso = value(input.insulationResistance);
  if ((rpe !== null && (rpe < 0 || rpe > 100)) || (riso !== null && (riso < 0 || riso > 100_000))) {
    throw new WorkflowError("VALIDATION", "Naměřené hodnoty jsou mimo rozsah přístroje.");
  }
  return { measuringInstrument: input.measuringInstrument?.trim() || null, protectiveConductorResistance: rpe, insulationResistance: riso };
}

function requireInspector(input: { inspectorName: string; inspectorLicense: string }) {
  const inspectorName = input.inspectorName.trim();
  const inspectorLicense = input.inspectorLicense.trim();
  if (!inspectorName || !inspectorLicense) throw new WorkflowError("VALIDATION", "Vyplňte revizního technika a číslo osvědčení.");
  return { inspectorName, inspectorLicense };
}

function requireDefects(result: InspectionResult, defectsSummary: string | null | undefined) {
  const defects = defectsSummary?.trim() || null;
  if (result !== "CAPABLE" && !defects) {
    throw new WorkflowError("VALIDATION", "U posudku s výhradou nebo neschopného provozu vypište zjištěné závady.");
  }
  return defects;
}

function parsePastDate(value: string, now: Date) {
  const date = parseInspectionDate(value);
  if (daysUntil(date, now) > 0) throw new WorkflowError("VALIDATION", "Datum revize nemůže být v budoucnosti.");
  return date;
}

/** Platnost: neschopné zařízení nemá platnou revizi (platí jen do dne revize), jinak datum + lhůta. */
const validUntilFor = (date: Date, months: number, result: InspectionResult) => (result === "INCAPABLE" ? date : computeValidUntil(date, months));

/** Ověří vstup a spočítá datum a platnost; sdílí ho zápis i generování zprávy. */
function prepare(input: RecordInspectionInput, intervalMonths: number, now: Date) {
  const inspectionDate = parsePastDate(input.inspectionDate, now);
  const months = input.validityMonths ?? defaultValidityMonths(input.type, intervalMonths);
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new WorkflowError("VALIDATION", "Platnost revize musí být 1–120 měsíců.");
  }
  const defects = requireDefects(input.result, input.defectsSummary);
  const reportNumber = input.reportNumber.trim();
  if (!reportNumber) throw new WorkflowError("VALIDATION", "Vyplňte číslo zprávy, revizního technika a číslo osvědčení.");
  return {
    inspectionDate,
    validUntil: validUntilFor(inspectionDate, months, input.result),
    defects,
    reportNumber,
    ...requireInspector(input),
    ...cleanMeasurements(input),
  };
}

function reportSvg(equipment: LoadedEquipment, input: { type: InspectionType; result: InspectionResult }, data: ReturnType<typeof prepare>) {
  return renderInspectionReportSvg({
    tag: equipment.tag,
    name: equipment.name,
    location: `${equipment.floor.building.name} › ${equipment.floor.name}`,
    ratedVoltage: equipment.ratedVoltage,
    ratedCurrent: equipment.ratedCurrent,
    type: input.type,
    reportNumber: data.reportNumber,
    inspectionDate: formatDateShort(data.inspectionDate),
    validUntil: input.result === "INCAPABLE" ? "vyřazeno z provozu" : formatDateShort(data.validUntil),
    inspectorName: data.inspectorName,
    inspectorLicense: data.inspectorLicense,
    result: input.result,
    defectsSummary: data.defects,
    standard: standardOf(equipment),
    measurements: data.measuringInstrument
      ? { instrument: data.measuringInstrument, rpe: data.protectiveConductorResistance, riso: data.insulationResistance }
      : null,
  });
}

/** Vygeneruje SVG revizní zprávy z formuláře (když technik nenahraje vlastní soubor). */
export async function renderInspectionReport(prisma: PrismaClient, input: RecordInspectionInput, now: Date = new Date()) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  return reportSvg(equipment, input, prepare(input, equipment.inspectionIntervalMonths, now));
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
      measuringInstrument: data.measuringInstrument,
      protectiveConductorResistance: data.protectiveConductorResistance,
      insulationResistance: data.insulationResistance,
    },
  });
}

// ---------------------------------------------------------------------------
//  Hromadná revize
// ---------------------------------------------------------------------------

export const MAX_BATCH = 200;

export interface BatchInspectionInput {
  equipmentIds: string[];
  inspectionDate: string;
  inspectorName: string;
  inspectorLicense: string;
  measuringInstrument?: string | null;
  result: InspectionResult;
  defectsSummary?: string | null;
}

/** Ověří hromadnou revizi a spočítá každému zařízení platnost podle jeho lhůty. */
async function prepareBatch(prisma: PrismaClient, input: BatchInspectionInput, now: Date) {
  const ids = [...new Set(input.equipmentIds)];
  if (ids.length === 0) throw new WorkflowError("VALIDATION", "Vyberte alespoň jedno zařízení.");
  if (ids.length > MAX_BATCH) throw new WorkflowError("VALIDATION", `Najednou lze zapsat nejvýše ${MAX_BATCH} zařízení.`);
  const inspectionDate = parsePastDate(input.inspectionDate, now);
  const inspector = requireInspector(input);
  const defects = requireDefects(input.result, input.defectsSummary);
  const equipment = await prisma.equipment.findMany({ where: { id: { in: ids } }, orderBy: { tag: "asc" }, select: equipmentSelect });
  if (equipment.length !== ids.length) throw new WorkflowError("NOT_FOUND", "Některé z vybraných zařízení už neexistuje.");
  const protocolNumber = `HR-${input.inspectionDate.replace(/-/g, "")}-${String(now.getTime()).slice(-5)}`;
  const items = equipment.map((item) => ({
    equipment: item,
    validUntil: validUntilFor(inspectionDate, item.inspectionIntervalMonths, input.result),
  }));
  return { inspectionDate, inspector, defects, items, protocolNumber, instrument: input.measuringInstrument?.trim() || null };
}

/** Společný protokol hromadné revize (SVG). */
export async function renderBatchProtocol(prisma: PrismaClient, input: BatchInspectionInput, now: Date = new Date()) {
  const batch = await prepareBatch(prisma, input, now);
  const svg = renderBatchProtocolSvg({
    protocolNumber: batch.protocolNumber,
    inspectionDate: formatDateShort(batch.inspectionDate),
    ...batch.inspector,
    instrument: batch.instrument,
    result: input.result,
    defectsSummary: batch.defects,
    items: batch.items.map(({ equipment, validUntil }) => ({
      tag: equipment.tag,
      name: equipment.name,
      standard: standardOf(equipment),
      validUntil: input.result === "INCAPABLE" ? "vyřazeno" : formatDateShort(validUntil),
    })),
  });
  return { svg, protocolNumber: batch.protocolNumber };
}

/** Zapíše pravidelnou revizi všem vybraným zařízením v jedné transakci (společný protokol). */
export async function recordBatchInspection(
  prisma: PrismaClient,
  input: BatchInspectionInput & { reportUrl: string; protocolNumber?: string },
  now: Date = new Date(),
) {
  const batch = await prepareBatch(prisma, input, now);
  const reportNumber = input.protocolNumber ?? batch.protocolNumber;
  const records = await prisma.$transaction(
    batch.items.map(({ equipment, validUntil }) =>
      prisma.inspectionRecord.create({
        data: {
          equipmentId: equipment.id,
          type: "PERIODIC",
          inspectionDate: batch.inspectionDate,
          validUntil,
          reportNumber,
          ...batch.inspector,
          result: input.result,
          defectsSummary: batch.defects,
          reportUrl: input.reportUrl,
          measuringInstrument: batch.instrument,
        },
      }),
    ),
  );
  return { count: records.length, reportNumber, items: batch.items.map(({ equipment, validUntil }) => ({ id: equipment.id, tag: equipment.tag, validUntil })) };
}

// ---------------------------------------------------------------------------
//  Rychlá revize spotřebiče (1 klik)
// ---------------------------------------------------------------------------

export interface QuickInspectionInput extends MeasurementFields {
  equipmentId: string;
  inspectorName: string;
  inspectorLicense: string;
  /** VYHOVUJE → schopno provozu; NEVYHOVUJE → neschopno, vyřadit z provozu. */
  passed: boolean;
  defectsSummary?: string | null;
}

/** Připraví záznam rychlé revize: dnešní datum, číslo zprávy, posudek a kontrolu mezí měření. */
async function prepareQuick(prisma: PrismaClient, input: QuickInspectionInput, now: Date) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  if (!isPortable(equipment.type)) throw new WorkflowError("VALIDATION", "Rychlá revize je určena pro spotřebiče, nářadí a svářečky.");
  const today = pragueToday(now);
  const record: RecordInspectionInput = {
    ...input,
    type: "PERIODIC",
    inspectionDate: today,
    reportNumber: `RS-${today.replace(/-/g, "")}-${equipment.tag}`,
    result: input.passed ? "CAPABLE" : "INCAPABLE",
  };
  const data = prepare(record, equipment.inspectionIntervalMonths, now);
  if (input.passed) {
    const check = evaluateMeasurements(equipment.protectionClass, {
      rpe: data.protectiveConductorResistance,
      riso: data.insulationResistance,
    });
    if (!check.ok) throw new WorkflowError("VALIDATION", `Měření nevyhovuje: ${check.failures.join(" ")}`);
  }
  return { equipment, record, data };
}

export async function renderQuickReport(prisma: PrismaClient, input: QuickInspectionInput, now: Date = new Date()) {
  const { equipment, record, data } = await prepareQuick(prisma, input, now);
  return reportSvg(equipment, record, data);
}

/** Zapíše rychlou revizi s měřením; VYHOVUJE = nová platnost dle normy, NEVYHOVUJE = vyřazeno 🔴. */
export async function recordQuickInspection(prisma: PrismaClient, input: QuickInspectionInput & { reportUrl: string }, now: Date = new Date()) {
  const { equipment, record, data } = await prepareQuick(prisma, input, now);
  return prisma.inspectionRecord.create({
    data: {
      equipmentId: equipment.id,
      type: record.type,
      inspectionDate: data.inspectionDate,
      validUntil: data.validUntil,
      reportNumber: data.reportNumber,
      inspectorName: data.inspectorName,
      inspectorLicense: data.inspectorLicense,
      result: record.result,
      defectsSummary: data.defects,
      reportUrl: input.reportUrl,
      measuringInstrument: data.measuringInstrument,
      protectiveConductorResistance: data.protectiveConductorResistance,
      insulationResistance: data.insulationResistance,
    },
  });
}
