import "server-only";

import { prisma } from "@/lib/prisma";
import { DIGEST_KIND, prepareInspectionDigest } from "@/server/services/notifications";

/** Náhled aktuálního avíza lhůt pro závod (stejný e-mail, jaký by se odeslal). */
export function getDigestPreview(plantId: string, origin: string, now = new Date()) {
  return prepareInspectionDigest(prisma, { plantId, origin, now });
}

/** Historie odeslaných / uložených avíz závodu (nejnovější nahoře). */
export function getDigestLog(plantId: string, take = 10) {
  return prisma.notificationLog.findMany({
    where: { kind: DIGEST_KIND, plantId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, createdAt: true, delivery: true, subject: true, recipients: true, itemCount: true, error: true, triggeredBy: true, html: true },
  });
}

export type DigestLogEntry = Awaited<ReturnType<typeof getDigestLog>>[number];
