"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 103: Nastavení závodu – firemní (interní nebo smluvní) projektant pro překreslení Červenek (cesta A).

const schema = z.object({
  plantId: z.string().min(1).max(64),
  designerName: z.string().trim().max(80),
  designerEmail: z.string().trim().max(160),
});

export async function savePlantDesignerAction(input: z.input<typeof schema>): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte jméno a e-mail projektanta." };
  const { plantId, designerName, designerEmail } = parsed.data;
  if (designerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(designerEmail)) return { ok: false, error: "Zadejte platný e-mail projektanta." };
  try {
    await assertPermission("manageModules");
    await assertTenantAccess({ plantId });
    await prisma.plant.update({ where: { id: plantId }, data: { designerName: designerName || null, designerEmail: designerEmail.toLowerCase() || null } });
    revalidatePath("/", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Nastavení se nepodařilo uložit." };
  }
}
