"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { createReference, deleteReference, updateReference } from "@/server/services/schematic-references";
import { getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

// Úprava interaktivních referencí ve výkresu: CAE projektant nebo správce závodu (Studio).

const id = z.string().min(1).max(64);
const referenceSchema = z.object({
  revisionId: id,
  page: z.number().int().min(1).max(999),
  designation: z.string().min(1).max(12),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  linkedEquipmentId: id.nullable().optional(),
});

async function run<T>(action: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const account = await getCurrentAccount();
    if (!account.can("caeOffice") && !account.can("studio")) {
      throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.caeOffice} nebo ${PERMISSION_LABELS.studio}.`);
    }
    await assertFeature("cae.hotspots");
    const data = await action();
    revalidatePath("/equipment/[id]", "page");
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Referenci se nepodařilo uložit." };
  }
}

export async function saveReferenceAction(input: z.input<typeof referenceSchema> & { id?: string | null }) {
  const parsed = referenceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné údaje reference." } as const;
  return run(async () => {
    const saved = input.id ? await updateReference(prisma, input.id, parsed.data) : await createReference(prisma, parsed.data);
    return { id: saved.id, designation: saved.designation };
  });
}

export async function deleteReferenceAction(input: { id: string }) {
  const parsed = z.object({ id }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná reference." } as const;
  return run(async () => {
    await deleteReference(prisma, parsed.data.id);
    return null;
  });
}
