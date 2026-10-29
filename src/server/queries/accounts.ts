import "server-only";

import { prisma } from "@/lib/prisma";

/** Účty, za které se lze přepnout (přepínač v hlavičce, správa podúčtů). */
export async function getAccountUsers() {
  return prisma.user.findMany({
    where: { accountType: { not: null } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, email: true, title: true, company: true, accountType: true, scopeLayers: true, createdAt: true },
  });
}

export type AccountUser = Awaited<ReturnType<typeof getAccountUsers>>[number];
