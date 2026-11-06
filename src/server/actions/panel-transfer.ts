"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { actionFailure, guardProject } from "@/server/panel-guards";
import { transferManufacturer, type TransferResult } from "@/server/services/panel-transfer";

import type { ActionResult } from "./workflow";

const input = z.object({ projectId: z.string().min(1).max(64), manufacturer: z.string().trim().min(1).max(60), apply: z.boolean() });

/** Fáze 60: náhled / provedení převodu rozváděče na jiného výrobce (hodnoty, značení, popisy a strom zůstanou). */
export async function transferManufacturerAction(raw: z.input<typeof input>): Promise<ActionResult<TransferResult>> {
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neplatný převod výrobce." };
  try {
    await guardProject(parsed.data.projectId);
    const result = await transferManufacturer(prisma, parsed.data.projectId, parsed.data.manufacturer, { apply: parsed.data.apply });
    if (result.applied) revalidatePath(`/panel-builder/${parsed.data.projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Převod na jiného výrobce se nepodařil.");
  }
}
