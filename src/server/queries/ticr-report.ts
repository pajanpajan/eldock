import "server-only";

import { prisma } from "@/lib/prisma";
import type { InspectorProfileView } from "@/lib/revision-signature";
import { plantAccessWhere } from "@/server/queries/plant";
import { monthlyReport, profileView } from "@/server/services/revision-signing";

export type TicrProfile = InspectorProfileView & { plantName: string };

/** Fáze 108: profily revizních techniků v závodech přihlášeného účtu (výběr čísla osvědčení TIČR). */
export async function getTicrProfiles(): Promise<TicrProfile[]> {
  const profiles = await prisma.inspectorProfile.findMany({
    where: { plant: await plantAccessWhere() },
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    include: { plant: { select: { name: true } } },
  });
  const now = new Date();
  return profiles.map(({ plant, ...profile }) => ({ ...profileView(profile, now), plantName: plant.name }));
}

/** Měsíční report pod číslem osvědčení profilu – revize ve všech závodech účtu. */
export async function getTicrReport(profile: Pick<TicrProfile, "certificateNo">, month: string) {
  return monthlyReport(prisma, { certificateNo: profile.certificateNo, month, plant: await plantAccessWhere() });
}
