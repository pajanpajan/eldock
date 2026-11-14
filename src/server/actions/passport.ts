"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { CONFORMITY_DIRECTIVES, CONFORMITY_STANDARDS, INFLUENCE_CLASSES, ROUTINE_ITEMS, type PassportPayload } from "@/lib/passport-docs";
import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { generatePassportDocument, updateLotoResponsible, uploadPassportDocument } from "@/server/services/passport";
import { getCurrentAccount, getCurrentUser } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 116: doplnění pasportu rozváděče (vygenerovat v ELDOCKu / nahrát PDF) a odpovědné osoby LOTO.
// Smí údržba (zadává změny), CAE projektant a správce závodu (Studio).

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().trim().max(max);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const codes = new Set(INFLUENCE_CLASSES.flatMap((entry) => entry.values.map((value) => value.code)));

const payloadSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("CONFORMITY_DECLARATION"),
    manufacturer: text(160).min(2),
    manufacturerAddress: text(240),
    product: text(160).min(2),
    typeDesignation: text(120),
    serialNumber: text(80),
    directives: z.array(z.string().refine((value) => (CONFORMITY_DIRECTIVES as readonly string[]).includes(value), "Neznámý předpis.")).min(1).max(5),
    standards: z.array(z.string().refine((value) => (CONFORMITY_STANDARDS as readonly string[]).includes(value), "Neznámá norma.")).min(1).max(5),
    place: text(80),
    date: day,
    signatory: text(80).min(3),
    signatoryRole: text(80),
  }),
  z.object({
    kind: z.literal("ROUTINE_VERIFICATION"),
    items: z.array(z.object({ clause: z.enum(ROUTINE_ITEMS.map((item) => item.clause) as [string, ...string[]]), label: text(120), result: z.enum(["OK", "FAIL", "NA"]) })).length(ROUTINE_ITEMS.length),
    testVoltageV: z.number().min(0).max(10_000).nullable(),
    insulationMOhm: z.number().min(0).max(1_000_000).nullable(),
    instrument: text(160),
    performedBy: text(120).min(3),
    date: day,
  }),
  z.object({ kind: z.literal("SINGLE_LINE_DIAGRAM"), revisionId: id, version: text(20), schematicUrl: text(500), sheetCount: z.number().int().min(1).max(500) }),
  z.object({
    kind: z.literal("THERMAL_CALCULATION"),
    enclosure: z.object({
      heightMm: z.number().min(100).max(4000),
      widthMm: z.number().min(100).max(4000),
      depthMm: z.number().min(100).max(4000),
      installation: z.enum(["WALL_MOUNTED", "FLUSH_MOUNTED", "FREE_STANDING"]),
      material: z.enum(["PAINTED_STEEL", "STAINLESS_STEEL", "PLASTIC"]),
    }),
    ambientTempC: z.number().min(-20).max(60),
    maxRiseK: z.number().min(1).max(70),
    losses: z.array(z.object({ designation: text(30), description: text(200), quantity: z.number().int().min(1).max(1000), lossW: z.number().min(0).max(10_000).nullable(), source: text(160) })).max(500),
    wiringLossW: z.number().min(0).max(10_000),
    result: z.any().optional(),
    date: day,
    author: text(120),
  }),
  z.object({
    kind: z.literal("EXTERNAL_INFLUENCES"),
    space: text(160).min(2),
    codes: z.array(z.string().refine((code) => codes.has(code), "Neznámý kód vnějšího vlivu.")).min(5).max(20),
    conclusion: z.enum(["NORMAL", "DANGEROUS", "SPECIAL"]),
    chair: text(80).min(3),
    members: z.array(text(80)).max(6),
    basis: text(500),
    date: day,
  }),
]);

const generateSchema = z.object({ equipmentId: id, payload: payloadSchema });
const uploadSchema = z.object({
  equipmentId: id,
  category: z.enum(["SINGLE_LINE_DIAGRAM", "CONFORMITY_DECLARATION", "ROUTINE_VERIFICATION", "THERMAL_CALCULATION", "EXTERNAL_INFLUENCES"]),
  fileUrl: z.string().regex(/^\/api\/files\/documents\/[\w./-]+$/, "Neplatná adresa souboru."),
  documentNumber: text(80),
  issuer: text(160),
  issuedAt: day,
});
const person = z.object({ name: text(80), phone: text(30).nullable() }).nullable();
const lotoSchema = z.object({ equipmentId: id, ooez: person, oprpc: person });

async function run<S extends z.ZodType, T>(schema: S, raw: unknown, action: (input: z.infer<S>, author: string) => Promise<T>): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message && !parsed.error.issues[0].message.startsWith("Invalid") ? parsed.error.issues[0].message : "Zkontrolujte vyplněné údaje." };
  try {
    const [account, user] = await Promise.all([getCurrentAccount(), getCurrentUser()]);
    if (!account.can("submitChange") && !account.can("caeOffice") && !account.can("studio")) {
      throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.submitChange}.`);
    }
    await assertTenantAccess(parsed.data);
    const data = await action(parsed.data, user?.name ?? account.definition.label);
    revalidatePath(equipmentHref((parsed.data as { equipmentId: string }).equipmentId));
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Dokument se nepodařilo uložit. Zkuste to prosím znovu." };
  }
}

/** „⚡ Doplnit / Vygenerovat v ELDOCKu“ – potvrzené parametry → dokument v pasportu. */
export async function generatePassportDocumentAction(input: z.input<typeof generateSchema>) {
  return run(generateSchema, input, async (data, author) => {
    const document = await generatePassportDocument(prisma, { equipmentId: data.equipmentId, payload: data.payload as PassportPayload, author });
    return { id: document.id, fileUrl: document.fileUrl, documentNumber: document.documentNumber };
  });
}

/** „📤 Nahrát vlastní PDF“ – soubor nahraný přes /api/uploads (druh dokument). */
export async function uploadPassportDocumentAction(input: z.input<typeof uploadSchema>) {
  return run(uploadSchema, input, async (data) => {
    const document = await uploadPassportDocument(prisma, data);
    return { id: document.id };
  });
}

/** Odpovědné osoby OOEZ / OPŘPČ na kartě LOTO (ČSN EN 50110-1 ed. 4). */
export async function updateLotoResponsibleAction(input: z.input<typeof lotoSchema>) {
  return run(lotoSchema, input, async (data) => {
    const saved = await updateLotoResponsible(prisma, { equipmentId: data.equipmentId, persons: { ooez: data.ooez?.name ? { name: data.ooez.name, phone: data.ooez.phone || null } : null, oprpc: data.oprpc?.name ? { name: data.oprpc.name, phone: data.oprpc.phone || null } : null } });
    return { lotoResponsibleJson: saved.lotoResponsibleJson };
  });
}
