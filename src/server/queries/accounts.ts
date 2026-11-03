import "server-only";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/session";

/**
 * Účty, za které se lze přepnout (přepínač v hlavičce, správa podúčtů). Registrovaná firma vidí jen své
 * účty, obchodní demo jen demo účty bez registrované firmy.
 */
export async function getAccountUsers(options: { demoOnly?: boolean } = {}) {
  const companyId = options.demoOnly ? null : ((await getCurrentUser()).companyId ?? null);
  return prisma.user.findMany({
    where: { accountType: { not: null }, companyId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, title: true, company: true, accountType: true, scopeLayers: true, createdAt: true },
  });
}

export type AccountUser = Awaited<ReturnType<typeof getAccountUsers>>[number];
