"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { requestOrigin } from "@/server/request-url";
import { sendInspectionDigest } from "@/server/services/notifications";
import { getCurrentUser } from "@/server/session";

import type { ActionResult } from "./workflow";

const schema = z.object({ plantId: z.string().min(1).max(64) });

/** „Odeslat souhrnné avízo nyní“ – bez SMTP se avízo uloží do logu a UI ukáže náhled. */
export async function sendInspectionDigestAction(input: z.input<typeof schema>): Promise<
  ActionResult<{ id: string; delivery: string; subject: string; recipients: string; itemCount: number; html: string; error: string | null }>
> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data." };
  try {
    await assertPermission("inspections");
    await assertFeature("inspections.alerts");
    const user = await getCurrentUser();
    const log = await sendInspectionDigest(prisma, {
      plantId: parsed.data.plantId,
      origin: await requestOrigin(),
      triggeredBy: `manual:${user.id}`,
      transport: smtpTransportFromEnv(),
    });
    revalidatePath("/inspections/alerts");
    return { ok: true, data: { id: log.id, delivery: log.delivery, subject: log.subject, recipients: log.recipients, itemCount: log.itemCount, html: log.html, error: log.error } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Avízo se nepodařilo odeslat. Zkuste to prosím znovu." };
  }
}
