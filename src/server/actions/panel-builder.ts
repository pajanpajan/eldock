"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { importDatasheet, type ImportedComponent } from "@/server/services/panel-builder";
import { getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

async function guard() {
  const account = await getCurrentAccount();
  if (!account.can("panelBuilder")) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.panelBuilder}.`);
  await assertFeature("enterprise.ai_panel_builder");
  return account;
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

const datasheetSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  pages: z.array(z.array(z.string().max(2000)).max(400)).min(1).max(80),
});

/** Atomizace PDF datasheetu do katalogu prvků. */
export async function importDatasheetAction(input: z.input<typeof datasheetSchema>): Promise<ActionResult<{ mode: "GEMINI" | "DEMO"; components: ImportedComponent[] }>> {
  const parsed = datasheetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "PDF se nepodařilo přečíst (příliš velký nebo prázdný soubor)." };
  try {
    await guard();
    const result = await importDatasheet(prisma, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Import datasheetu se nepodařil. Zkuste to prosím znovu.");
  }
}
