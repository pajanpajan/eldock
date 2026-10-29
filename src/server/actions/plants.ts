"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE } from "@/lib/roles";
import { plantHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { createPlant } from "@/server/services/plants";

import type { ActionResult } from "./workflow";

const schema = z.object({ name: z.string().min(1).max(120), code: z.string().min(1).max(6), location: z.string().max(200).optional().nullable() });

/** Založí nový čistý areál (oprávnění Studia) a zapamatuje si ho jako aktuální závod. */
export async function createPlantAction(input: z.input<typeof schema>): Promise<ActionResult<{ id: string; href: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data formuláře. Zkontrolujte vyplněné údaje." };
  try {
    await assertPermission("studio");
    const plant = await createPlant(prisma, parsed.data);
    const store = await cookies();
    store.set(PLANT_COOKIE, plant.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
    revalidatePath("/", "layout");
    return { ok: true, data: { id: plant.id, href: plantHref(plant.id) } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Areál se nepodařilo založit. Zkuste to prosím znovu." };
  }
}
