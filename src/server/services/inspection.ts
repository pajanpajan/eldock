// Lhůtník revizí: zápis revizní zprávy / termovize / vizuální kontroly LPS k zařízení, hromadná revize více zařízení
// a rychlá revize spotřebiče s měřením. Služby dostávají `prisma` jako parametr (testovatelné bez cookies).
// Platnost se počítá z lhůty zařízení – u VTZ a LPS nejvýš zákonná (NV 190/2022 Sb., příloha č. 4). Fáze 66:
// osvědčení revizního technika (zákon 250/2021 Sb., § 11 a § 17) a náležitosti zprávy (NV 190/2022 Sb., § 10).
// Záměrně bez `server-only`.

import type { DefectSeverity, InspectionResult, InspectionType } from "@/generated/prisma/enums";
import type { PrismaClient } from "@/generated/prisma/client";
import { defectDeadline, severityForResult, splitDefects, splitProvision } from "@/lib/defects";
import { formatDateShort } from "@/lib/format";
import { DEADLINE_TYPES, computeValidUntil, daysUntil, defaultValidityMonths, pragueToday } from "@/lib/inspection";
import { isReportType, reportDefaults, type ReportContext, type ReportDefaults } from "@/lib/inspection-report";
import {
  BUILDING_RULE_FIELDS,
  RULE_FIELDS,
  effectiveIntervalMonths,
  evaluateMeasurements,
  inspectionRuleFor,
  isPortable,
  requiresCertificate,
  ruleInputFrom,
  type InspectionRule,
} from "@/lib/inspection-rules";
import { certificateIssues, normalizeScope, scopeFromLicense } from "@/lib/inspector-certificate";
import { renderBatchProtocolSvg, renderInspectionReportSvg } from "@/lib/mock-graphics/compliance";
import { sanitizeRcdTest, type RcdTest } from "@/lib/rcd-test";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { Actor } from "./workflow";

export interface MeasurementFields {
  /** Měřicí přístroje (typ, výrobní číslo, kalibrace) – § 10 odst. 1 písm. g. */
  measuringInstrument?: string | null;
  /** R_PE [Ω] */
  protectiveConductorResistance?: number | null;
  /** R_iso [MΩ] */
  insulationResistance?: number | null;
  /** I_PE / I_Δ [mA] */
  leakageCurrent?: number | null;
  /** Funkční zkouška vyhověla (null = neprováděla se). */
  functionalTest?: boolean | null;
  /** Fáze 52: zkoušky proudového chrániče (ČSN EN 61557-6 ed. 2). */
  rcdTest?: Partial<RcdTest> | null;
}

export interface ThermalFields {
  /** Nejvyšší naměřená teplota [°C] (termovize). */
  maxTempC?: number | null;
  /** ΔT vůči okolí [K]. */
  deltaTempC?: number | null;
}

export interface CertificateFields {
  /** Rozsah osvědčení „E2A“ (NV 190/2022 Sb., příloha č. 5); bez něj se vyčte z čísla osvědčení „… (E2A)“. */
  inspectorScope?: string | null;
  /** Platnost osvědčení `YYYY-MM-DD` (zákon 250/2021 Sb., § 11 – 5 let). */
  inspectorValidUntil?: string | null;
}

/** Náležitosti zprávy o revizi VTZ (NV 190/2022 Sb., § 10 odst. 1); chybějící texty doplní server. */
export interface ReportFields {
  /** c) vymezení rozsahu revize */
  scopeNote?: string | null;
  /** e) důvod mimořádné revize (u mimořádné povinný) */
  extraordinaryReason?: string | null;
  /** f) zahájení revize `YYYY-MM-DD` (ukončení = `inspectionDate`) */
  startedAt?: string | null;
  /** f) vypracování zprávy `YYYY-MM-DD` */
  reportedAt?: string | null;
  /** f) předání zprávy `YYYY-MM-DD` */
  handedOverAt?: string | null;
  /** h) podklady a jejich vyhodnocení */
  documentsUsed?: string | null;
  /** i) soupis provedených úkonů */
  actsPerformed?: string | null;
  /** m) vyhodnocení záznamů z předchozí revize, provozu a údržby */
  previousEvaluation?: string | null;
}

export interface RecordInspectionInput extends MeasurementFields, ThermalFields, CertificateFields, ReportFields {
  equipmentId: string;
  type: InspectionType;
  /** Den ukončení revize `YYYY-MM-DD`. */
  inspectionDate: string;
  /** Platnost v měsících; bez ní lhůta zařízení (termovize a vizuální kontrola 12 měsíců). */
  validityMonths?: number | null;
  reportNumber: string;
  inspectorName: string;
  inspectorLicense: string;
  result: InspectionResult;
  defectsSummary?: string | null;
  /** Závažnost zjištěných závad; výchozí podle posudku. */
  defectSeverity?: DefectSeverity | null;
}

/** `YYYY-MM-DD` → okamžik v poledne (stejně jako seed), ať datum nepřeskočí přes časová pásma. */
function parseDay(value: string, message: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 10)) : new Date(NaN);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new WorkflowError("VALIDATION", message);
  return date;
}

export const parseInspectionDate = (value: string): Date => parseDay(value, "Neplatné datum revize.");

const equipmentSelect = {
  id: true,
  tag: true,
  name: true,
  ...RULE_FIELDS,
  ratedVoltage: true,
  ratedCurrent: true,
  floor: { select: { name: true, building: { select: { name: true, ...BUILDING_RULE_FIELDS } } } },
  // Podklady náležitostí zprávy (§ 10 písm. h, m): předchozí revize, platná dokumentace, protokol vnějších vlivů, provizoria
  inspections: {
    orderBy: { inspectionDate: "desc" },
    take: 12,
    select: { type: true, reportNumber: true, inspectionDate: true, result: true, defects: { select: { description: true, status: true } } },
  },
  revisions: { where: { status: "ACTIVE" }, take: 1, select: { version: true, approvedAt: true, createdAt: true } },
  complianceDocuments: { where: { category: "EXTERNAL_INFLUENCES" }, orderBy: { issuedAt: "desc" }, take: 1, select: { documentNumber: true, issuedAt: true } },
  temporaryMods: { where: { status: "ACTIVE" }, select: { id: true } },
} as const;

async function loadEquipment(prisma: PrismaClient, equipmentId: string) {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: equipmentSelect });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  return equipment;
}

type LoadedEquipment = Awaited<ReturnType<typeof loadEquipment>>;

const ruleOf = (equipment: LoadedEquipment): InspectionRule => inspectionRuleFor(ruleInputFrom(equipment, equipment.floor.building));

/** Podklady pro výchozí náležitosti zprávy: předchozí výchozí / pravidelná revize před tímto datem, dokumentace, provizoria. */
function reportContext(equipment: LoadedEquipment, rule: InspectionRule, type: InspectionType, inspectionDate: Date): ReportContext {
  const previous = (equipment.inspections ?? []).find((record) => DEADLINE_TYPES.includes(record.type) && record.inspectionDate.getTime() < inspectionDate.getTime()) ?? null;
  return {
    equipment: { tag: equipment.tag, name: equipment.name, type: equipment.type },
    location: `${equipment.floor.building.name} › ${equipment.floor.name}`,
    kind: rule.kind,
    type,
    previous,
    activeRevision: equipment.revisions?.[0] ?? null,
    influencesProtocol: equipment.complianceDocuments?.[0] ?? null,
    activeTemporaryMods: equipment.temporaryMods ? equipment.temporaryMods.length : null,
  };
}

function cleanMeasurements(input: MeasurementFields) {
  const value = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const rpe = value(input.protectiveConductorResistance);
  const riso = value(input.insulationResistance);
  const leakage = value(input.leakageCurrent);
  if ((rpe !== null && (rpe < 0 || rpe > 100)) || (riso !== null && (riso < 0 || riso > 100_000)) || (leakage !== null && (leakage < 0 || leakage > 100))) {
    throw new WorkflowError("VALIDATION", "Naměřené hodnoty jsou mimo rozsah přístroje.");
  }
  return {
    measuringInstrument: input.measuringInstrument?.trim() || null,
    protectiveConductorResistance: rpe,
    insulationResistance: riso,
    leakageCurrent: leakage,
    functionalTest: typeof input.functionalTest === "boolean" ? input.functionalTest : null,
    rcdTestJson: (() => {
      const test = sanitizeRcdTest(input.rcdTest);
      return test ? JSON.stringify(test) : null;
    })(),
  };
}

function requireInspector(input: { inspectorName: string; inspectorLicense: string }) {
  const inspectorName = input.inspectorName.trim();
  const inspectorLicense = input.inspectorLicense.trim();
  if (!inspectorName || !inspectorLicense) throw new WorkflowError("VALIDATION", "Vyplňte revizního technika a číslo osvědčení.");
  return { inspectorName, inspectorLicense };
}

/** Rozsah a platnost osvědčení; u revizí VTZ a LPS kontrola podle § 17 zákona 250/2021 Sb. (jinak jen uloží). */
function certificateOf(
  input: CertificateFields & { inspectorLicense: string },
  rule: InspectionRule,
  equipment: Pick<LoadedEquipment, "tag" | "type" | "ratedVoltage" | "externalInfluences">,
  inspectionDate: Date,
  type: InspectionType,
  prefix = "",
) {
  const inspectorScope = normalizeScope(input.inspectorScope) ?? scopeFromLicense(input.inspectorLicense);
  const inspectorValidUntil = input.inspectorValidUntil ? parseDay(input.inspectorValidUntil, "Neplatné datum platnosti osvědčení.") : null;
  if (isReportType(type)) {
    const issues = certificateIssues({ scope: inspectorScope, validUntil: inspectorValidUntil, inspectionDate, rule, equipment });
    if (issues.length) throw new WorkflowError("VALIDATION", `${prefix}${issues[0]}`);
  }
  return { inspectorScope, inspectorValidUntil };
}

function requireDefects(result: InspectionResult, defectsSummary: string | null | undefined) {
  const defects = defectsSummary?.trim() || null;
  if (result !== "CAPABLE" && !defects) {
    throw new WorkflowError("VALIDATION", "U posudku s výhradou nebo neschopného provozu vypište zjištěné závady.");
  }
  return defects;
}

const defectItems = (defects: string) => {
  const items = splitDefects(defects);
  return items.length ? items : [defects];
};

/** U zprávy o revizi VTZ a LPS musí mít každá závada porušené ustanovení (NV 190/2022 Sb., § 10 odst. 1 písm. k). */
function requireProvisions(rule: InspectionRule, type: InspectionType, result: InspectionResult, defects: string | null, prefix = "") {
  if (!requiresCertificate(rule) || !isReportType(type) || result === "CAPABLE" || !defects) return;
  const missing = defectItems(defects).find((item) => !splitProvision(item).provision);
  if (missing) {
    throw new WorkflowError(
      "VALIDATION",
      `${prefix}U revize VTZ uveďte u každé závady porušené ustanovení v hranatých závorkách, např. „Chybí kryt svorek [ČSN 33 2000-4-41 ed. 3, čl. 411.2]“ (NV 190/2022 Sb., § 10 odst. 1 písm. k). Bez ustanovení: „${missing}“.`,
    );
  }
}

function parsePastDate(value: string, now: Date) {
  const date = parseInspectionDate(value);
  if (daysUntil(date, now) > 0) throw new WorkflowError("VALIDATION", "Datum revize nemůže být v budoucnosti.");
  return date;
}

function cleanThermal(input: ThermalFields) {
  const value = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n : null);
  const maxTempC = value(input.maxTempC);
  const deltaTempC = value(input.deltaTempC);
  if ((maxTempC !== null && (maxTempC < -50 || maxTempC > 500)) || (deltaTempC !== null && (deltaTempC < 0 || deltaTempC > 300))) {
    throw new WorkflowError("VALIDATION", "Naměřené teploty jsou mimo rozsah termokamery.");
  }
  return { maxTempC, deltaTempC };
}

const NO_REPORT_FIELDS = {
  scopeNote: null,
  extraordinaryReason: null,
  startedAt: null,
  reportedAt: null,
  handedOverAt: null,
  documentsUsed: null,
  actsPerformed: null,
  previousEvaluation: null,
};

/** Náležitosti zprávy (§ 10 odst. 1 písm. c, e, f, h, i, m): kontrola dat a doplnění výchozích textů. */
function reportFields(input: ReportFields & { type: InspectionType }, inspectionDate: Date, now: Date, defaults: ReportDefaults) {
  if (!isReportType(input.type)) return NO_REPORT_FIELDS;
  const text = (value: string | null | undefined) => value?.trim().slice(0, 4000) || null;
  const startedAt = input.startedAt ? parseDay(input.startedAt, "Neplatné datum zahájení revize.") : inspectionDate;
  const reportedAt = input.reportedAt ? parseDay(input.reportedAt, "Neplatné datum vypracování zprávy.") : inspectionDate;
  const handedOverAt = input.handedOverAt ? parseDay(input.handedOverAt, "Neplatné datum předání zprávy.") : null;
  if (startedAt.getTime() > inspectionDate.getTime()) throw new WorkflowError("VALIDATION", "Zahájení revize nemůže být po jejím ukončení.");
  if (reportedAt.getTime() < inspectionDate.getTime()) throw new WorkflowError("VALIDATION", "Zprávu nelze vypracovat před ukončením revize.");
  if (handedOverAt && handedOverAt.getTime() < reportedAt.getTime()) throw new WorkflowError("VALIDATION", "Zprávu nelze předat před jejím vypracováním.");
  if (daysUntil(reportedAt, now) > 0 || (handedOverAt && daysUntil(handedOverAt, now) > 0)) {
    throw new WorkflowError("VALIDATION", "Vypracování ani předání zprávy nemůže být v budoucnosti.");
  }
  const extraordinaryReason = input.type === "EXTRAORDINARY" ? text(input.extraordinaryReason) : null;
  if (input.type === "EXTRAORDINARY" && (!extraordinaryReason || extraordinaryReason.length < 3)) {
    throw new WorkflowError("VALIDATION", "U mimořádné revize uveďte důvod jejího provedení (NV 190/2022 Sb., § 10 odst. 1 písm. e).");
  }
  return {
    scopeNote: text(input.scopeNote) ?? defaults.scopeNote,
    extraordinaryReason,
    startedAt,
    reportedAt,
    handedOverAt,
    documentsUsed: text(input.documentsUsed) ?? defaults.documentsUsed,
    actsPerformed: text(input.actsPerformed) ?? defaults.actsPerformed,
    previousEvaluation: text(input.previousEvaluation) ?? defaults.previousEvaluation,
  };
}

/** Řádky `InspectionDefect` ze soupisu závad: porušené ustanovení z „[…]“, lhůta odstranění podle závažnosti. */
export function defectRows(
  equipmentId: string,
  inspectionDate: Date,
  result: InspectionResult,
  defects: string | null,
  severity?: DefectSeverity | null,
) {
  if (!defects || result === "CAPABLE") return [];
  const level = severity ?? severityForResult(result);
  return defectItems(defects).map((item) => ({
    equipmentId,
    ...splitProvision(item),
    severity: level,
    deadline: defectDeadline(inspectionDate, level),
  }));
}

/** Platnost: neschopné zařízení nemá platnou revizi (platí jen do dne revize), jinak datum + lhůta. */
const validUntilFor = (date: Date, months: number, result: InspectionResult) => (result === "INCAPABLE" ? date : computeValidUntil(date, months));

/** Ověří vstup a spočítá datum, platnost a náležitosti zprávy; sdílí ho zápis i generování zprávy. */
function prepare(input: RecordInspectionInput, equipment: LoadedEquipment, now: Date) {
  const rule = ruleOf(equipment);
  if (input.type === "VISUAL_CHECK" && equipment.type !== "LIGHTNING_ROD") {
    throw new WorkflowError("VALIDATION", "Vizuální kontrola se zapisuje jen u hromosvodů (LPS).");
  }
  const inspectionDate = parsePastDate(input.inspectionDate, now);
  const months = input.validityMonths ?? defaultValidityMonths(input.type, effectiveIntervalMonths(equipment.inspectionIntervalMonths, rule));
  if (!Number.isInteger(months) || months < 1 || months > 120) {
    throw new WorkflowError("VALIDATION", "Platnost revize musí být 1–120 měsíců.");
  }
  if (rule.binding && DEADLINE_TYPES.includes(input.type) && months > rule.maxMonths) {
    throw new WorkflowError("VALIDATION", `Platnost ${months} měsíců překračuje nejdelší zákonnou lhůtu ${rule.maxMonths} měsíců. ${rule.basis}`);
  }
  const defects = requireDefects(input.result, input.defectsSummary);
  requireProvisions(rule, input.type, input.result, defects);
  const reportNumber = input.reportNumber.trim();
  if (!reportNumber) throw new WorkflowError("VALIDATION", "Vyplňte číslo zprávy, revizního technika a číslo osvědčení.");
  const inspector = requireInspector(input);
  return {
    rule,
    inspectionDate,
    validUntil: validUntilFor(inspectionDate, months, input.result),
    defects,
    reportNumber,
    ...inspector,
    ...certificateOf({ ...input, inspectorLicense: inspector.inspectorLicense }, rule, equipment, inspectionDate, input.type),
    ...reportFields(input, inspectionDate, now, reportDefaults(reportContext(equipment, rule, input.type, inspectionDate))),
    ...cleanMeasurements(input),
    ...cleanThermal(input),
  };
}

type Prepared = ReturnType<typeof prepare>;

function reportSvg(equipment: LoadedEquipment, input: { type: InspectionType; result: InspectionResult }, data: Prepared) {
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
    inspectorLicense: data.inspectorScope && !data.inspectorLicense.includes(data.inspectorScope) ? `${data.inspectorLicense} (${data.inspectorScope})` : data.inspectorLicense,
    result: input.result,
    defectsSummary: data.defects,
    standard: data.rule.standard,
    thermal: data.deltaTempC !== null || data.maxTempC !== null ? { maxTempC: data.maxTempC, deltaTempC: data.deltaTempC } : null,
    measurements: data.measuringInstrument
      ? { instrument: data.measuringInstrument, rpe: data.protectiveConductorResistance, riso: data.insulationResistance }
      : null,
  });
}

/** Vygeneruje SVG revizní zprávy z formuláře (když technik nenahraje vlastní soubor). */
export async function renderInspectionReport(prisma: PrismaClient, input: RecordInspectionInput, now: Date = new Date()) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  return reportSvg(equipment, input, prepare(input, equipment, now));
}

/** Sloupce záznamu z připraveného vstupu (bez vazeb). */
function recordColumns(data: Prepared) {
  return {
    inspectionDate: data.inspectionDate,
    validUntil: data.validUntil,
    reportNumber: data.reportNumber,
    inspectorName: data.inspectorName,
    inspectorLicense: data.inspectorLicense,
    inspectorScope: data.inspectorScope,
    inspectorValidUntil: data.inspectorValidUntil,
    defectsSummary: data.defects,
    measuringInstrument: data.measuringInstrument,
    protectiveConductorResistance: data.protectiveConductorResistance,
    insulationResistance: data.insulationResistance,
    leakageCurrent: data.leakageCurrent,
    functionalTest: data.functionalTest,
    rcdTestJson: data.rcdTestJson,
    scopeNote: data.scopeNote,
    extraordinaryReason: data.extraordinaryReason,
    startedAt: data.startedAt,
    reportedAt: data.reportedAt,
    handedOverAt: data.handedOverAt,
    documentsUsed: data.documentsUsed,
    actsPerformed: data.actsPerformed,
    previousEvaluation: data.previousEvaluation,
  };
}

/** Zapíše revizní zprávu; platnost = datum + lhůta. Stav lhůtníku se odvozuje při čtení. */
export async function recordInspection(prisma: PrismaClient, input: RecordInspectionInput & { reportUrl: string }, now: Date = new Date()) {
  const equipment = await loadEquipment(prisma, input.equipmentId);
  const data = prepare(input, equipment, now);
  return prisma.inspectionRecord.create({
    data: {
      equipmentId: equipment.id,
      type: input.type,
      result: input.result,
      reportUrl: input.reportUrl,
      ...recordColumns(data),
      maxTempC: data.maxTempC,
      deltaTempC: data.deltaTempC,
      defects: { create: defectRows(equipment.id, data.inspectionDate, input.result, data.defects, input.defectSeverity) },
    },
  });
}

// ---------------------------------------------------------------------------
//  Hromadná revize
// ---------------------------------------------------------------------------

export const MAX_BATCH = 200;

export interface BatchInspectionInput extends CertificateFields {
  equipmentIds: string[];
  inspectionDate: string;
  inspectorName: string;
  inspectorLicense: string;
  measuringInstrument?: string | null;
  result: InspectionResult;
  defectsSummary?: string | null;
}

/** Ověří hromadnou revizi a spočítá každému zařízení platnost podle jeho lhůty (u VTZ nejvýš zákonné). */
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
  const items = equipment.map((item) => {
    const rule = ruleOf(item);
    requireProvisions(rule, "PERIODIC", input.result, defects, `${item.tag}: `);
    const certificate = certificateOf({ ...input, inspectorLicense: inspector.inspectorLicense }, rule, item, inspectionDate, "PERIODIC", `${item.tag}: `);
    const defaults = reportDefaults(reportContext(item, rule, "PERIODIC", inspectionDate));
    return {
      equipment: item,
      rule,
      certificate,
      report: reportFields({ type: "PERIODIC" }, inspectionDate, now, defaults),
      validUntil: validUntilFor(inspectionDate, effectiveIntervalMonths(item.inspectionIntervalMonths, rule), input.result),
    };
  });
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
    items: batch.items.map(({ equipment, rule, validUntil }) => ({
      tag: equipment.tag,
      name: equipment.name,
      standard: rule.standard,
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
    batch.items.map(({ equipment, certificate, report, validUntil }) =>
      prisma.inspectionRecord.create({
        data: {
          equipmentId: equipment.id,
          type: "PERIODIC",
          inspectionDate: batch.inspectionDate,
          validUntil,
          reportNumber,
          ...batch.inspector,
          ...certificate,
          ...report,
          result: input.result,
          defectsSummary: batch.defects,
          reportUrl: input.reportUrl,
          measuringInstrument: batch.instrument,
          defects: { create: defectRows(equipment.id, batch.inspectionDate, input.result, batch.defects) },
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
  const data = prepare(record, equipment, now);
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
      result: record.result,
      reportUrl: input.reportUrl,
      ...recordColumns(data),
      defects: { create: defectRows(equipment.id, data.inspectionDate, record.result, data.defects) },
    },
  });
}

// ---------------------------------------------------------------------------
//  Revizní závady
// ---------------------------------------------------------------------------

export interface ResolveDefectInput {
  defectId: string;
  /** Popis provedené opravy (povinný). */
  note: string;
  photoUrl?: string | null;
}

/** Potvrzení odstranění závady (údržba i revizní technik). */
export async function resolveDefect(prisma: PrismaClient, actor: Actor, input: ResolveDefectInput, now: Date = new Date()) {
  const note = input.note.trim();
  if (note.length < 3) throw new WorkflowError("VALIDATION", "Popište, jak byla závada odstraněna.");
  const defect = await prisma.inspectionDefect.findUnique({ where: { id: input.defectId } });
  if (!defect) throw new WorkflowError("NOT_FOUND", "Závada nebyla nalezena.");
  if (defect.status === "RESOLVED") throw new WorkflowError("INVALID_STATE", "Závada už je odstraněná.");
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { name: true } });
  return prisma.inspectionDefect.update({
    where: { id: defect.id },
    data: { status: "RESOLVED", resolvedAt: now, resolvedBy: user?.name ?? "Neznámý uživatel", resolutionNote: note, resolutionPhotoUrl: input.photoUrl?.trim() || null },
  });
}
