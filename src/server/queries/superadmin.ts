import "server-only";

import { prisma } from "@/lib/prisma";

// Data velínu /superadmin (fáze 50) – stránka je chráněná cookie velínu (proxy + `isSuperadmin`).

export async function getSuperadminOverview() {
  const [byScope, projects, pending, openFeedback] = await Promise.all([
    prisma.registeredCompany.groupBy({ by: ["productScope"], _count: { _all: true } }),
    prisma.panelBoardProject.count({ where: { companyId: { not: null } } }),
    prisma.creditOrder.aggregate({ where: { status: "PENDING" }, _count: { _all: true }, _sum: { priceCzkInclVat: true } }),
    prisma.aiFeedbackReport.count({ where: { status: "OPEN" } }),
  ]);
  const scope = (value: string) => byScope.find((row) => row.productScope === value)?._count._all ?? 0;
  return {
    panelCompanies: scope("PANEL_BUILDER"),
    plantCompanies: scope("PLANT_MANAGEMENT"),
    projects,
    pendingOrders: pending._count._all,
    pendingCzk: pending._sum.priceCzkInclVat ?? 0,
    openFeedback,
  };
}

export const getSuperadminCompanies = () =>
  prisma.registeredCompany.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      productScope: true,
      companyName: true,
      ico: true,
      dic: true,
      city: true,
      contactName: true,
      email: true,
      phone: true,
      authorizationNumber: true,
      createdAt: true,
      creditsRemaining: true,
      _count: { select: { panelProjects: true } },
      panelProjects: { orderBy: { updatedAt: "desc" }, take: 40, select: { id: true, code: true, name: true, status: true, photoUrl: true, railPhotosJson: true, updatedAt: true, _count: { select: { items: true } } } },
    },
  });

export const getSuperadminOrders = () =>
  prisma.creditOrder.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200, include: { company: { select: { companyName: true, ico: true } } } });

export const getSuperadminFeedback = () =>
  prisma.aiFeedbackReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { company: { select: { companyName: true, email: true } }, project: { select: { id: true, code: true, name: true } } },
  });
