"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertModule } from "@/server/modules";
import { importEquipment } from "@/server/services/equipment-import";
import { saveUpload } from "@/server/storage";
import { getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

const schema = z.object({
  items: z
    .array(
      z.object({
        tag: z.string().trim().min(1).max(40),
        name: z.string().trim().min(1).max(200),
        type: z.enum(["SWITCHBOARD", "MACHINE", "APPLIANCE", "POWER_TOOL", "EXTENSION_CORD", "WELDER"]),
        floorId: z.string().min(1).max(64),
        intervalMonths: z.number().int().min(1).max(120).nullable(),
        lastInspection: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
        location: z.string().max(200),
      }),
    )
    .min(1)
    .max(500),
});

/** Krok 3 průvodce importem: uložení položek s QR kódy (revizní technik nebo správce závodu). */
export async function importEquipmentAction(input: z.input<typeof schema>): Promise<
  ActionResult<{ created: { id: string; tag: string; qrToken: string }[]; skipped: { tag: string; reason: string }[] }>
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data importu. Zkontrolujte tabulku." };
  try {
    const account = await getCurrentAccount();
    if (!account.can("recordInspection") && !account.can("studio")) {
      throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.recordInspection} nebo ${PERMISSION_LABELS.studio}.`);
    }
    await assertModule("ENTERPRISE_TOOLS");
    const result = await importEquipment(prisma, {
      items: parsed.data.items.map((item) => ({ ...item, tag: item.tag.toUpperCase(), lastInspection: item.lastInspection ? new Date(`${item.lastInspection}T12:00:00Z`) : null })),
      writeReport: async (svg) => (await saveUpload("documents", ".svg", svg)).url,
    });
    revalidatePath("/", "layout");
    return { ok: true, data: { created: result.created, skipped: result.skipped } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Import se nepodařil. Zkuste to prosím znovu." };
  }
}
