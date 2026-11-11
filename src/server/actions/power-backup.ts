"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { updatePowerBackup } from "@/server/services/power-backup";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 93: zálohování napájení a nájemní jednotka / oddělení na kartě rozváděče – údržba, revizní technik a Studio.

const schema = z.object({
  equipmentId: z.string().min(1).max(64),
  tier: z.enum(["GRID_STANDARD", "BACKUP_GENERATOR_DA", "CRITICAL_UPS_ZIS"]),
  capacityKva: z.number().min(0).max(100_000).nullable(),
  tenantUnit: z.string().max(200).nullable(),
});

export async function updatePowerBackupAction(input: z.input<typeof schema>): Promise<ActionResult<{ tier: string; tenantUnit: string | null }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte zadané hodnoty." };
  try {
    const account = await getCurrentAccount();
    if (!account.can("submitChange") && !account.can("recordInspection") && !account.can("studio")) {
      throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.submitChange}, ${PERMISSION_LABELS.recordInspection} nebo ${PERMISSION_LABELS.studio}.`);
    }
    await assertTenantAccess(parsed.data);
    const saved = await updatePowerBackup(prisma, { ...parsed.data, capacityKva: parsed.data.capacityKva || null });
    revalidatePath(equipmentHref(parsed.data.equipmentId));
    return { ok: true, data: { tier: saved.powerBackupTier, tenantUnit: saved.tenantUnit } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Zálohování napájení se nepodařilo uložit. Zkuste to prosím znovu." };
  }
}
