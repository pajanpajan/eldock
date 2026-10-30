import type { PrismaClient } from "@/generated/prisma/client";
import { DEADLINE_TYPES, summarizeInspections } from "@/lib/inspection";
import { buildDigestEmail, digestBucket, type DigestItem } from "@/lib/inspection-digest";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { MailTransport } from "../mailer";

// Souhrnné avízo lhůt revizí: načtení ohrožených zařízení, příjemci a odeslání / uložení do logu.

export const DIGEST_KIND = "INSPECTION_DIGEST";

/** Účty, které avízo dostávají (vedení závodu). */
const RECIPIENT_TYPES = ["PLANT_ADMIN", "MAINTENANCE_LEAD"] as const;

export async function digestRecipients(prisma: PrismaClient) {
  return prisma.user.findMany({
    where: { accountType: { in: [...RECIPIENT_TYPES] } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, title: true },
  });
}

/** Zařízení závodu s končící nebo propadlou revizí (do 30 dnů). */
export async function loadDigestItems(prisma: PrismaClient, plantId: string, now: Date): Promise<DigestItem[]> {
  const equipment = await prisma.equipment.findMany({
    where: { floor: { building: { plantId } } },
    select: {
      id: true,
      tag: true,
      name: true,
      assignedZone: true,
      floor: { select: { name: true, building: { select: { name: true } } } },
      inspections: { where: { type: { in: [...DEADLINE_TYPES] } }, select: { type: true, inspectionDate: true, validUntil: true, result: true } },
    },
  });
  return equipment.flatMap(({ inspections, floor, assignedZone, ...item }) => {
    const summary = summarizeInspections(inspections, now);
    if (!summary.validUntil || summary.daysLeft === null || !digestBucket(summary.daysLeft)) return [];
    return [{ ...item, location: assignedZone ?? `${floor.building.name} › ${floor.name}`, validUntil: summary.validUntil, daysLeft: summary.daysLeft }];
  });
}

export async function prepareInspectionDigest(prisma: PrismaClient, { plantId, origin, now = new Date() }: { plantId: string; origin: string; now?: Date }) {
  const plant = await prisma.plant.findUnique({ where: { id: plantId }, select: { id: true, name: true } });
  if (!plant) throw new WorkflowError("NOT_FOUND", "Závod neexistuje.");
  const [items, recipients] = await Promise.all([loadDigestItems(prisma, plant.id, now), digestRecipients(prisma)]);
  return { plant, items, recipients, email: buildDigestEmail({ plantName: plant.name, items, origin, now }) };
}

/**
 * Odešle avízo vedení závodu. Bez SMTP transportu se jen uloží do `NotificationLog` (`LOGGED`),
 * chyba SMTP se zapíše jako `FAILED` (log vznikne vždy – auditní stopa).
 */
export async function sendInspectionDigest(
  prisma: PrismaClient,
  options: { plantId: string; origin: string; triggeredBy: string; transport: MailTransport | null; now?: Date },
) {
  const { plant, recipients, email } = await prepareInspectionDigest(prisma, options);
  const to = recipients.map((recipient) => recipient.email);
  let delivery: "SENT" | "LOGGED" | "FAILED" = "LOGGED";
  let error: string | null = null;
  if (options.transport && to.length) {
    try {
      await options.transport({ to, subject: email.subject, html: email.html, text: email.text });
      delivery = "SENT";
    } catch (cause) {
      delivery = "FAILED";
      error = cause instanceof Error ? cause.message.slice(0, 500) : "Neznámá chyba SMTP.";
    }
  }
  return prisma.notificationLog.create({
    data: {
      kind: DIGEST_KIND,
      plantId: plant.id,
      subject: email.subject,
      recipients: to.join(", "),
      html: email.html,
      text: email.text,
      itemCount: email.itemCount,
      delivery,
      error,
      triggeredBy: options.triggeredBy,
    },
  });
}

/** Cron: avízo pro každý závod. */
export async function sendAllInspectionDigests(prisma: PrismaClient, options: { origin: string; transport: MailTransport | null; now?: Date }) {
  const plants = await prisma.plant.findMany({ select: { id: true }, orderBy: { code: "asc" } });
  const logs = [];
  for (const plant of plants) logs.push(await sendInspectionDigest(prisma, { ...options, plantId: plant.id, triggeredBy: "cron" }));
  return logs;
}
