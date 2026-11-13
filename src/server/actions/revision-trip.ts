"use server";

import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { INSPECTION_MINUTES, MAX_TRIP_ITEMS, isTripHorizon, tripListText, tripUrgency, type TripRow } from "@/lib/revision-trip";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { smtpTransportFromEnv } from "@/server/mailer";
import { assertPermission } from "@/server/permissions";
import { canAccessEquipment } from "@/server/queries/plant";
import { getTripItems } from "@/server/queries/revision-trip";
import { getCurrentUser } from "@/server/session";
import { TRIP_KIND, assertMailQuota, deliverMail } from "@/server/services/revision-signing";
import { assertEntityAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 108: 📩 Odeslat sloučený seznam výjezdu reviznímu technikovi k přípravě – na e-mail uloženého profilu
// technika závodu (SMTP, jinak jen záznam v logu notifikací), bez profilu text pro vlastní poštovní program.

const id = z.string().min(1).max(64);
const schema = z.object({
  plantId: id,
  inspectorProfileId: id.nullable(),
  equipmentIds: z.array(id).min(1).max(MAX_TRIP_ITEMS),
  horizon: z.number().int().refine(isTripHorizon, "Neplatný horizont."),
  note: z.string().trim().max(1000).optional().nullable(),
});

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendTripListAction(input: z.input<typeof schema>): Promise<ActionResult<{ delivery: "SENT" | "LOGGED" | "FAILED" | "MAILTO"; to: string | null; subject: string; text: string }>> {
  try {
    await assertPermission("inspections");
    const data = schema.parse(input);
    await assertEntityAccess("plant", data.plantId);
    const ids = new Set(data.equipmentIds);
    if (!(await canAccessEquipment([...ids]))) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
    const items = (await getTripItems(data.plantId)).filter((item) => ids.has(item.id));
    if (items.length !== ids.size) throw new WorkflowError("VALIDATION", "Některá vybraná zařízení nepatří do tohoto závodu.");
    const rows: TripRow[] = items.map((item) => ({ item, urgency: tripUrgency(item) ?? "UPCOMING", minutes: INSPECTION_MINUTES[item.type], sameBuilding: false, distance: 0 }));
    const plantName = items[0]?.plantName ?? "";
    const subject = `Sloučený revizní výjezd – ${plantName} (${items.length} zařízení)`;
    const text = `${tripListText({ plantName, horizon: data.horizon }, rows)}${data.note ? `\n\nPoznámka: ${data.note}` : ""}\n\nOdesláno z Eldocku – Chytrá revize (optimalizace výjezdu revizního technika).`;
    if (!data.inspectorProfileId) return { ok: true, data: { delivery: "MAILTO", to: null, subject, text } };

    await assertEntityAccess("inspectorProfile", data.inspectorProfileId);
    const profile = await prisma.inspectorProfile.findUnique({ where: { id: data.inspectorProfileId }, select: { plantId: true, email: true, name: true } });
    if (!profile || profile.plantId !== data.plantId) throw new WorkflowError("NOT_FOUND", "Profil revizního technika nebyl nalezen.");
    if (!profile.email) throw new WorkflowError("VALIDATION", `Profil ${profile.name} nemá e-mail – doplňte ho, nebo seznam zkopírujte.`);
    const user = await getCurrentUser();
    await assertMailQuota(prisma, user?.id ?? null);
    const log = await deliverMail(prisma, {
      kind: TRIP_KIND,
      plantId: data.plantId,
      to: profile.email,
      subject,
      text,
      html: `<pre style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      itemCount: items.length,
      triggeredBy: user?.id ?? "user",
      transport: smtpTransportFromEnv(),
    });
    return { ok: true, data: { delivery: log.delivery as "SENT" | "LOGGED" | "FAILED", to: profile.email, subject, text } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Neplatná data." };
    console.error(error);
    return { ok: false, error: "Seznam se nepodařilo odeslat. Zkuste to prosím znovu." };
  }
}
