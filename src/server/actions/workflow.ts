"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { generateRevisionSchematic } from "@/server/services/schematic";
import * as workflow from "@/server/services/workflow";
import { assertPermission } from "@/server/permissions";
import { saveUpload } from "@/server/storage";
import { getCurrentRole, getCurrentUser } from "@/server/session";

// Tenké Server Actions: role z cookie → validace zod → služba → revalidace.

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const id = z.string().min(1).max(64);
const text = (max: number) => z.string().max(max).optional().nullable();
/** Soubory jen z našeho úložiště (přes POST /api/uploads). */
const fileUrl = z.string().regex(/^\/api\/files\/(photos|revisions|markups|voice)\/[\w./-]+$/, "Neplatná adresa souboru.");

const attachment = z.object({
  url: fileUrl,
  type: z.enum(["PHOTO", "VOICE_NOTE", "MARKUP_IMAGE", "OTHER"]).optional(),
  fileName: text(255),
  mimeType: text(100),
  sizeBytes: z.number().int().nonnegative().optional().nullable(),
  caption: text(200),
});

const submitSchema = z.object({
  equipmentId: id,
  priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional(),
  markupData: z.string().max(500_000).optional().nullable(),
  markupSheet: z.number().int().positive().optional(),
  markupImageUrl: fileUrl.optional().nullable(),
  voiceTranscript: text(4000),
  note: text(4000),
  attachments: z.array(attachment).max(20).optional(),
});

const commentSchema = z.object({ changeRequestId: id, comment: text(4000), attachments: z.array(attachment).max(20).optional() });
const crSchema = z.object({ changeRequestId: id, comment: text(4000) });
const rejectSchema = z.object({ changeRequestId: id, comment: z.string().max(4000) });

const bomItem = z.object({
  designation: z.string().min(1).max(40),
  description: z.string().min(1).max(300),
  manufacturer: text(100),
  partNumber: text(100),
  quantity: z.number().positive().max(100_000),
  unit: z.string().max(10).optional(),
  note: text(300),
});

const uploadSchema = z.object({
  changeRequestId: id,
  schematicUrl: fileUrl,
  schematicFormat: z.enum(["PDF", "SVG", "IMAGE"]),
  summary: z.string().max(4000),
  bump: z.enum(["minor", "major"]).optional(),
  title: text(200),
  sheetCount: z.number().int().positive().max(200).optional(),
  bom: z.array(bomItem).max(500).optional(),
});

const generateSchema = z.object({
  changeRequestId: id,
  bump: z.enum(["minor", "major"]).optional(),
  summary: text(4000),
  bom: z.array(bomItem).max(500).optional(),
});

async function run<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  service: (actor: workflow.Actor, input: z.infer<S>) => Promise<T>,
  revalidate = true,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    const [role, user] = await Promise.all([getCurrentRole(), getCurrentUser()]);
    const data = await service({ id: user.id, role }, parsed.data);
    // Mění se barvy pinů, počty v areálu, detail i CAE dashboard → celý layout.
    if (revalidate) revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }
}

export async function submitChangeRequestAction(input: z.input<typeof submitSchema>) {
  return run(submitSchema, input, async (actor, data) => {
    await assertPermission("submitChange");
    const changeRequest = await workflow.submitChangeRequest(prisma, actor, data);
    return { id: changeRequest.id, number: changeRequest.number, equipmentId: changeRequest.equipmentId };
  });
}

export async function addCommentAction(input: z.input<typeof commentSchema>) {
  return run(commentSchema, input, async (actor, data) => {
    const changeRequest = await workflow.addComment(prisma, actor, data);
    return { id: changeRequest.id, number: changeRequest.number };
  });
}

export async function assignChangeRequestAction(input: { changeRequestId: string }) {
  return run(crSchema, input, async (actor, data) => {
    const changeRequest = await workflow.assignChangeRequest(prisma, actor, data);
    return { id: changeRequest.id, number: changeRequest.number };
  });
}

export async function uploadRevisionAction(input: z.input<typeof uploadSchema>) {
  return run(uploadSchema, input, async (actor, data) => {
    const revision = await workflow.uploadRevision(prisma, actor, data);
    return { id: revision.id, version: revision.version };
  });
}

export async function cancelChangeRequestAction(input: z.input<typeof crSchema>) {
  return run(crSchema, input, async (actor, data) => {
    const changeRequest = await workflow.cancelChangeRequest(prisma, actor, data);
    return { id: changeRequest.id, number: changeRequest.number };
  });
}

export async function approveRevisionAction(input: z.input<typeof crSchema>) {
  return run(crSchema, input, async (actor, data) => {
    await assertPermission("approveRevision");
    const revision = await workflow.approveRevision(prisma, actor, data);
    return { id: revision.id, version: revision.version };
  });
}

export async function rejectRevisionAction(input: z.input<typeof rejectSchema>) {
  return run(rejectSchema, input, async (actor, data) => {
    await assertPermission("approveRevision");
    const revision = await workflow.rejectRevision(prisma, actor, data);
    return { id: revision.id, version: revision.version };
  });
}

/** Demo: vygeneruje upravené schéma další revize a uloží ho do úložiště (bez změny stavu). */
export async function generateSchematicAction(input: z.input<typeof generateSchema>) {
  return run(
    generateSchema,
    input,
    async (actor, data) => {
      const { svg, version, changed } = await generateRevisionSchematic(prisma, actor, data);
      const { url } = await saveUpload("revisions", ".svg", svg);
      return { url, version, changed, fileName: `schema-${version}.svg`, sizeBytes: Buffer.byteLength(svg) };
    },
    false,
  );
}
