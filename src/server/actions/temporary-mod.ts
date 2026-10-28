"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { resolveDefect } from "@/server/services/inspection";
import { createTemporaryMod, resolveAndConvertToChangeRequest, resolveAsOneToOne } from "@/server/services/temporary-mod";
import type { Actor } from "@/server/services/workflow";
import { getCurrentRole, getCurrentUser } from "@/server/session";

import type { ActionResult } from "./workflow";

// Tenké Server Actions provizorií a revizních závad: role z cookie → zod → služba → revalidace.

const id = z.string().min(1).max(64);
/** Fotky jen z našeho úložiště (POST /api/uploads, druh `photo`). */
const photoUrl = z
  .string()
  .regex(/^\/api\/files\/photos\/[\w./-]+$/, "Neplatná adresa souboru.")
  .optional()
  .nullable();

const createSchema = z.object({
  equipmentId: id,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  days: z.union([z.literal(7), z.literal(14)]),
  photoUrl,
  createdByRole: z.string().max(60).optional().nullable(),
});
const oneToOneSchema = z.object({ id, note: z.string().max(4000).optional().nullable() });
const convertSchema = z.object({ id, note: z.string().min(1).max(4000), photoUrl, priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]).optional() });
const defectSchema = z.object({ defectId: id, note: z.string().min(1).max(4000), photoUrl });

async function run<S extends z.ZodType, T>(schema: S, raw: unknown, action: (actor: Actor, input: z.infer<S>) => Promise<T>): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    const [role, user] = await Promise.all([getCurrentRole(), getCurrentUser()]);
    const data = await action({ id: user.id, role }, parsed.data);
    // Banner v detailu, audit, případně nový ticket v CAE a stav pinu.
    revalidatePath("/", "layout");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu." };
  }
}

export async function createTemporaryModAction(input: z.input<typeof createSchema>) {
  return run(createSchema, input, async (actor, data) => {
    const mod = await createTemporaryMod(prisma, actor, data);
    return { id: mod.id, number: mod.number, expiresAt: mod.expiresAt };
  });
}

export async function resolveTemporaryModOneToOneAction(input: z.input<typeof oneToOneSchema>) {
  return run(oneToOneSchema, input, async (actor, data) => {
    const mod = await resolveAsOneToOne(prisma, actor, data);
    return { number: mod.number };
  });
}

export async function convertTemporaryModAction(input: z.input<typeof convertSchema>) {
  return run(convertSchema, input, async (actor, data) => {
    const result = await resolveAndConvertToChangeRequest(prisma, actor, data);
    return { number: result.temporaryMod.number, changeRequestNumber: result.changeRequest.number, appended: result.appended };
  });
}

export async function resolveDefectAction(input: z.input<typeof defectSchema>) {
  return run(defectSchema, input, async (actor, data) => {
    const defect = await resolveDefect(prisma, actor, data);
    return { id: defect.id };
  });
}
