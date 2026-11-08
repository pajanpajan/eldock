import "server-only";

import { prisma } from "@/lib/prisma";
import { pendingClosure } from "@/server/services/data-requests";

// Fáze 69: přehled pro „Data firmy“ – čekající zrušení účtu a evidence žádostí firmy (bez osobních údajů).

export type DataRequestRow = { id: string; kind: "COMPANY_EXPORT" | "PERSONAL_EXPORT" | "COMPANY_CLOSURE" | "USER_REMOVAL"; status: "PENDING" | "DONE" | "CANCELLED" | "FAILED"; requestedBy: string; requestedAt: string; scheduledAt: string | null; completedAt: string | null; cancelledAt: string | null };

const toRow = (request: { id: string; kind: DataRequestRow["kind"]; status: DataRequestRow["status"]; requestedBy: string; requestedAt: Date; scheduledAt: Date | null; completedAt: Date | null; cancelledAt: Date | null }): DataRequestRow => ({
  id: request.id,
  kind: request.kind,
  status: request.status,
  requestedBy: request.requestedBy,
  requestedAt: request.requestedAt.toISOString(),
  scheduledAt: request.scheduledAt?.toISOString() ?? null,
  completedAt: request.completedAt?.toISOString() ?? null,
  cancelledAt: request.cancelledAt?.toISOString() ?? null,
});

export async function getCompanyDataOverview(companyId: string) {
  const [company, pending, requests] = await Promise.all([
    prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { id: true, companyName: true, ico: true, productScope: true } }),
    pendingClosure(prisma, companyId),
    prisma.dataRequest.findMany({ where: { companyId }, orderBy: { requestedAt: "desc" }, take: 20 }),
  ]);
  return { company, pending: pending ? toRow(pending) : null, requests: requests.map(toRow) };
}

/** Čekající zrušení účtu firmy (pruh v „Můj účet“). */
export async function getPendingClosure(companyId: string | null) {
  if (!companyId) return null;
  const pending = await pendingClosure(prisma, companyId);
  return pending ? toRow(pending) : null;
}

/** Velín: čekající zrušení účtů a posledních 25 žádostí všech firem. */
export async function getSuperadminDataRequests() {
  const [pending, recent] = await Promise.all([
    prisma.dataRequest.findMany({ where: { kind: "COMPANY_CLOSURE", status: "PENDING" }, select: { companyId: true, scheduledAt: true } }),
    prisma.dataRequest.findMany({ orderBy: { requestedAt: "desc" }, take: 25 }),
  ]);
  return {
    pendingByCompany: new Map(pending.filter((row) => row.companyId).map((row) => [row.companyId as string, row.scheduledAt?.toISOString() ?? null])),
    recent: recent.map((request) => ({ ...toRow(request), companyName: request.companyName, companyIco: request.companyIco, error: request.error })),
  };
}
