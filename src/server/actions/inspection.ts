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
import { assertPermission } from "@/server/permissions";
import { saveUpload } from "@/server/storage";

import type { ActionResult } from "./workflow";

// Tenké Server Actions lhůtníku: validace zod → (vygenerování zprávy) → služba → revalidace.

const id = z.string().min(1).max(64);
const inspector = { inspectorName: z.string().min(1).max(120), inspectorLicense: z.string().min(1).max(120) };
const result = z.enum(["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"]);
const measurements = {
  measuringInstrument: z.string().max(120).optional().nullable(),
  protectiveConductorResistance: z.number().min(0).max(100).optional().nullable(),
  insulationResistance: z.number().min(0).max(100_000).optional().nullable(),
  leakageCurrent: z.number().min(0).max(100).optional().nullable(),
  functionalTest: z.boolean().optional().nullable(),
};
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const defects = z.string().max(4000).optional().nullable();

const recordSchema = z.object({
  equipmentId: id,
  type: z.enum(["INITIAL", "PERIODIC", "EXTRAORDINARY", "THERMOVISION"]),
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
  ...inspector,
  ...measurements,
  passed: z.boolean(),
  defectsSummary: defects,
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

const saveReport = async (svg: string) => (await saveUpload("documents", ".svg", svg)).url;

export async function recordInspectionAction(input: z.input<typeof recordSchema>) {
  return run(
    recordSchema,
    input,
    async ({ reportUrl, ...data }) => {
      await assertPermission("recordInspection");
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
      const { svg, protocolNumber } = await renderBatchProtocol(prisma, data);
      return recordBatchInspection(prisma, { ...data, reportUrl: await saveReport(svg), protocolNumber });
    },
    "Hromadnou revizi se nepodařilo zapsat. Zkuste to prosím znovu.",
  );
}

/** Rychlá revize spotřebiče (VYHOVUJE / NEVYHOVUJE) s měřením R_PE a R_iso. */
export async function recordQuickInspectionAction(input: z.input<typeof quickSchema>) {
  return run(
    quickSchema,
    input,
    async (data) => {
      await assertPermission("recordInspection");
      const reportUrl = await saveReport(await renderQuickReport(prisma, data));
      const record = await recordQuickInspection(prisma, { ...data, reportUrl });
      return { id: record.id, validUntil: record.validUntil, result: record.result };
    },
    "Revizi se nepodařilo uložit. Zkuste to prosím znovu.",
  );
}
