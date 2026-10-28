"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { recordInspection, renderInspectionReport } from "@/server/services/inspection";
import { saveUpload } from "@/server/storage";

import type { ActionResult } from "./workflow";

// Tenká Server Action lhůtníku: validace zod → (vygenerování zprávy) → služba → revalidace.

const recordSchema = z.object({
  equipmentId: z.string().min(1).max(64),
  type: z.enum(["INITIAL", "PERIODIC", "EXTRAORDINARY", "THERMOVISION"]),
  inspectionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validityMonths: z.number().int().min(1).max(120).optional().nullable(),
  reportNumber: z.string().min(1).max(60),
  inspectorName: z.string().min(1).max(120),
  inspectorLicense: z.string().min(1).max(120),
  result: z.enum(["CAPABLE", "CAPABLE_WITH_DEFECTS", "INCAPABLE"]),
  defectsSummary: z.string().max(4000).optional().nullable(),
  /** Nahraná zpráva (POST /api/uploads, druh `document`); bez ní se zpráva vygeneruje. */
  reportUrl: z
    .string()
    .regex(/^\/api\/files\/documents\/[\w./-]+$/, "Neplatná adresa souboru.")
    .optional()
    .nullable(),
});

export async function recordInspectionAction(
  input: z.input<typeof recordSchema>,
): Promise<ActionResult<{ id: string; validUntil: Date; generated: boolean }>> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    const { reportUrl, ...data } = parsed.data;
    let url = reportUrl ?? null;
    if (!url) {
      const svg = await renderInspectionReport(prisma, data);
      url = (await saveUpload("documents", ".svg", svg)).url;
    }
    const record = await recordInspection(prisma, { ...data, reportUrl: url });
    // Mění se odznak v detailu, výstraha na pinu i hlídač na areálu a v CAE.
    revalidatePath("/", "layout");
    return { ok: true, data: { id: record.id, validUntil: record.validUntil, generated: !reportUrl } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Revizi se nepodařilo zapsat. Zkuste to prosím znovu." };
  }
}
