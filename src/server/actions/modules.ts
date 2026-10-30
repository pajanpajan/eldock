"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ADDON_MODULES, type ModuleState } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { setModuleEnabled } from "@/server/services/modules";
import { getCurrentUser } from "@/server/session";

import type { ActionResult } from "./workflow";

const schema = z.object({ key: z.enum(ADDON_MODULES), enabled: z.boolean() });

/** Zapne / vypne licenční modul (jen technický ředitel – správa účtů závodu). */
export async function setModuleEnabledAction(input: z.input<typeof schema>): Promise<ActionResult<ModuleState>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neznámý modul." };
  try {
    await assertPermission("manageUsers");
    const user = await getCurrentUser();
    const state = await setModuleEnabled(prisma, parsed.data.key, parsed.data.enabled, user.id);
    // Navigace, stránky i detail zařízení se mění podle modulů → celé rozhraní.
    revalidatePath("/", "layout");
    return { ok: true, data: state };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Nastavení modulu se nepodařilo uložit." };
  }
}
