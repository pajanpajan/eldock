"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { createSubAccount } from "@/server/services/accounts";

import type { ActionResult } from "./workflow";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().min(3).max(200),
  title: z.string().max(120).optional().nullable(),
  accountType: z.enum(["PLANT_ADMIN", "MAINTENANCE_LEAD", "MAINTENANCE_TECH", "INSPECTOR_VTZ", "INSPECTOR_APPLIANCES", "CAE_ENGINEER"]),
  layers: z.array(z.enum(["ENERGY", "MACHINES", "TOOLS", "APPLIANCES", "SAFETY"])).max(5).optional(),
});

/** Přidá podúčet (jen technický ředitel). */
export async function createSubAccountAction(input: z.input<typeof schema>): Promise<ActionResult<{ id: string; name: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    await assertPermission("manageUsers");
    const user = await createSubAccount(prisma, parsed.data);
    revalidatePath("/", "layout");
    return { ok: true, data: { id: user.id, name: user.name } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Podúčet se nepodařilo založit. Zkuste to prosím znovu." };
  }
}
