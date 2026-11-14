"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { routeSchema, type RouteInput } from "@/lib/redline-marketplace";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { assertPermission } from "@/server/permissions";
import { requestOrigin } from "@/server/request-url";
import { notifyInternalDesigner, routeChangeRequest } from "@/server/services/redlines";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

/**
 * Fáze 116: „🌐 Odeslat k překreslení projektantovi / do Poolu“ ze záložky ✏️ Červenky stroje – už odeslaná Červenka
 * (bez předání při zadání) se předá firemnímu projektantovi závodu nebo do ELDOCK Poolu.
 */
export async function routeRedlineAction(input: RouteInput): Promise<ActionResult<{ mode: string }>> {
  const parsed = routeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Zkontrolujte údaje úkolu." };
  try {
    await assertPermission("submitChange");
    await assertTenantAccess({ changeRequestId: parsed.data.changeRequestId });
    const task = await routeChangeRequest(prisma, parsed.data);
    if (parsed.data.mode === "INTERNAL_DESIGNER") await notifyInternalDesigner(prisma, task.id, { origin: await requestOrigin(), send: smtpTransportFromEnv() }).catch((error) => console.error(error));
    const request = await prisma.changeRequest.findUnique({ where: { id: parsed.data.changeRequestId }, select: { equipmentId: true } });
    if (request) revalidatePath(equipmentHref(request.equipmentId));
    return { ok: true, data: { mode: task.mode } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Červenku se nepodařilo předat. Zkuste to prosím znovu." };
  }
}
