"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import {
  MAX_BATCH,
  recordBatchInspection,
  recordInspection,
  recordQuickInspection,
  renderBatchProtocol,
  renderInspectionReport,
  renderQuickReport,
} from "@/server/services/inspection";
import { updateInspectionSettings } from "@/server/services/inspection-intervals";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { assertPlantFiles, storePlantFile } from "@/server/file-access";
import { canAccessEquipment } from "@/server/queries/plant";

import type { ActionResult } from "./workflow";

// Tenké Server Actions lhůtníku: validace zod → (vygenerování zprávy) → služba → revalidace.

const id = z.string().min(1).max(64);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDate = date.optional().nullable();
const longText = z.string().max(4000).optional().nullable();
const inspector = {
  inspectorName: z.string().min(1).max(120),
  inspectorLicense: z.string().min(1).max(120),
  // Fáze 66: rozsah a platnost osvědčení revizního technika (NV 190/2022 Sb., příloha č. 5; zákon 250/2021 Sb., § 11)
  inspectorScope: z.string().max(10).optional().nullable(),
  inspectorValidUntil: optionalDate,
};
const result = z.enum(["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"]);
const measurements = {
  measuringInstrument: z.string().max(500).optional().nullable(),
  protectiveConductorResistance: z.number().min(0).max(100).optional().nullable(),
  insulationResistance: z.number().min(0).max(100_000).optional().nullable(),
  leakageCurrent: z.number().min(0).max(100).optional().nullable(),
  functionalTest: z.boolean().optional().nullable(),
  rcdTest: z
    .object({
      ratedMa: z.number().min(6).max(1000),
      type: z.enum(["AC", "A", "F", "B"]),
      noTripAtHalf: z.boolean().nullable(),
      tripTimeMs: z.number().min(0).max(5000).nullable(),
      tripCurrentMa: z.number().min(0).max(5000).nullable(),
      loopOhm: z.number().min(0).max(100).nullable(),
      breakerA: z.number().min(1).max(630).nullable(),
      breakerCurve: z.enum(["B", "C"]),
    })
    .optional()
    .nullable(),
};
const defects = z.string().max(4000).optional().nullable();

const recordSchema = z.object({
  equipmentId: id,
  type: z.enum(["INITIAL", "PERIODIC", "EXTRAORDINARY", "THERMOVISION", "VISUAL_CHECK"]),
  inspectionDate: date,
  validityMonths: z.number().int().min(1).max(120).optional().nullable(),
  reportNumber: z.string().min(1).max(60),
  ...inspector,
  result,
  defectsSummary: defects,
  ...measurements,
  maxTempC: z.number().min(-50).max(500).optional().nullable(),
  deltaTempC: z.number().min(0).max(300).optional().nullable(),
  defectSeverity: z.enum(["MINOR", "MAJOR", "CRITICAL"]).optional().nullable(),
  // Náležitosti zprávy o revizi VTZ (NV 190/2022 Sb., § 10 odst. 1) – chybějící doplní služba
  scopeNote: longText,
  extraordinaryReason: z.string().max(500).optional().nullable(),
  startedAt: optionalDate,
  reportedAt: optionalDate,
  handedOverAt: optionalDate,
  documentsUsed: longText,
  actsPerformed: longText,
  previousEvaluation: longText,
  /** Nahraná zpráva (POST /api/uploads, druh `document`); bez ní se zpráva vygeneruje. */
  reportUrl: z
    .string()
    .regex(/^\/api\/files\/documents\/[\w./-]+$/, "Neplatná adresa souboru.")
    .optional()
    .nullable(),
});

const batchSchema = z.object({
  equipmentIds: z.array(id).min(1).max(MAX_BATCH),
  inspectionDate: date,
  ...inspector,
  measuringInstrument: measurements.measuringInstrument,
  result,
  defectsSummary: defects,
});

const quickSchema = z.object({
  equipmentId: id,
  inspectorName: inspector.inspectorName,
  inspectorLicense: inspector.inspectorLicense,
  ...measurements,
  passed: z.boolean(),
  defectsSummary: defects,
});

const settingsSchema = z.object({
  equipmentId: id,
  intervalMonths: z.number().int().min(1).max(120).optional().nullable(),
  externalInfluences: z.string().max(300).optional().nullable(),
  installationKind: z.enum(["STANDARD", "CONSTRUCTION_SITE", "MOBILE"]).optional(),
  lpsCritical: z.boolean().optional(),
  preventiveMaintenance: z.boolean().optional(),
  usageGroup: z.enum(["A", "B", "C", "D", "E"]).optional().nullable(),
  protectionClass: z.enum(["I", "II", "III"]).optional().nullable(),
  handHeld: z.boolean().optional(),
  crowdOver200: z.boolean().optional(),
});

async function run<S extends z.ZodType, T>(schema: S, raw: unknown, action: (input: z.infer<S>) => Promise<T>, fallback: string): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    const data = await action(parsed.data);
    // Mění se odznak v detailu, výstraha na pinu, vrstvy i hlídač na areálu a v CAE.
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: fallback };
  }
}

const saveReport = async (svg: string) => (await storePlantFile("documents", ".svg", svg)).url;

/** Zápis jen k zařízení v závodu přihlášeného uživatele (registrovaná firma nevidí cizí závody). */
async function assertEquipment(ids: readonly string[]) {
  if (!(await canAccessEquipment(ids))) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
}

export async function recordInspectionAction(input: z.input<typeof recordSchema>) {
  return run(
    recordSchema,
    input,
    async ({ reportUrl, ...data }) => {
      await assertPermission("recordInspection");
      await assertEquipment([data.equipmentId]);
      // Fáze 68: nahraná zpráva jen ze souborů účtu
      await assertPlantFiles([reportUrl]);
      const url = reportUrl ?? (await saveReport(await renderInspectionReport(prisma, data)));
      const record = await recordInspection(prisma, { ...data, reportUrl: url });
      return { id: record.id, validUntil: record.validUntil, generated: !reportUrl };
    },
    "Revizi se nepodařilo zapsat. Zkuste to prosím znovu.",
  );
}

/** Hromadná revize: jeden technik a datum → platnost každému zařízení podle jeho lhůty, jedna transakce. */
export async function recordBatchInspectionAction(input: z.input<typeof batchSchema>) {
  return run(
    batchSchema,
    input,
    async (data) => {
      await assertPermission("recordInspection");
      await assertEquipment(data.equipmentIds);
      const { svg, protocolNumber } = await renderBatchProtocol(prisma, data);
      return recordBatchInspection(prisma, { ...data, reportUrl: await saveReport(svg), protocolNumber });
    },
    "Hromadnou revizi se nepodařilo zapsat. Zkuste to prosím znovu.",
  );
}

/** Fáze 66: podklady a lhůta pravidelné revize zařízení (NV 190/2022 Sb., příloha č. 4; ČSN 33 1600 ed. 2). */
export async function updateInspectionSettingsAction(input: z.input<typeof settingsSchema>) {
  return run(
    settingsSchema,
    input,
    async (data) => {
      await assertPermission("recordInspection");
      await assertEquipment([data.equipmentId]);
      const saved = await updateInspectionSettings(prisma, data);
      return { intervalMonths: saved.intervalMonths, warning: saved.warning, cappedRecords: saved.cappedRecords, cappedIntervals: saved.cappedIntervals };
    },
    "Lhůtu revize se nepodařilo uložit. Zkuste to prosím znovu.",
  );
}

/** Rychlá revize spotřebiče (VYHOVUJE / NEVYHOVUJE) s měřením R_PE a R_iso. */
export async function recordQuickInspectionAction(input: z.input<typeof quickSchema>) {
  return run(
    quickSchema,
    input,
    async (data) => {
      await assertPermission("recordInspection");
      await assertFeature("inspections.planner");
      await assertEquipment([data.equipmentId]);
      const reportUrl = await saveReport(await renderQuickReport(prisma, data));
      const record = await recordQuickInspection(prisma, { ...data, reportUrl });
      return { id: record.id, validUntil: record.validUntil, result: record.result };
    },
    "Revizi se nepodařilo uložit. Zkuste to prosím znovu.",
  );
}
