import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeSearch, type CatalogFilter } from "@/lib/panel-builder/catalog";
import { prisma } from "@/lib/prisma";
import { getPanelCompany } from "@/server/panel-session";

// Čtení dat AI Panel Builderu: katalog prvků, seznam projektů a detail projektu.

const CATALOG_LIMIT = 300;

export function catalogWhere(filter: CatalogFilter): Prisma.CatalogComponentWhereInput {
  const terms = filter.q ? normalizeSearch(filter.q).split(" ").filter(Boolean).slice(0, 6) : [];
  return {
    category: filter.category,
    manufacturer: filter.manufacturer,
    poles: filter.poles,
    ratedCurrentA: filter.current,
    trippingCurve: filter.curve,
    AND: terms.map((term) => ({ searchText: { contains: term } })),
  };
}

/** Katalog podle filtru (indexy kategorie/póly/proud a výrobce/typ) + seznam výrobců pro filtr. */
export const getCatalog = cache(async (filter: CatalogFilter) => {
  const where = catalogWhere(filter);
  const [items, total, matching, manufacturers] = await Promise.all([
    prisma.catalogComponent.findMany({ where, orderBy: [{ category: "asc" }, { manufacturer: "asc" }, { poles: "asc" }, { ratedCurrentA: "asc" }, { typeCode: "asc" }], take: CATALOG_LIMIT }),
    prisma.catalogComponent.count(),
    prisma.catalogComponent.count({ where }),
    prisma.catalogComponent.findMany({ distinct: ["manufacturer"], select: { manufacturer: true }, orderBy: { manufacturer: "asc" } }),
  ]);
  return { items, total, matching, limit: CATALOG_LIMIT, manufacturers: manufacturers.map((row) => row.manufacturer) };
});

export type CatalogRow = Awaited<ReturnType<typeof getCatalog>>["items"][number];

/** Rozváděče přihlášené firmy (fáze 41: každá firma vidí jen své projekty). */
export const getPanelProjects = cache(async () => {
  const company = await getPanelCompany();
  if (!company) return [];
  return prisma.panelBoardProject.findMany({
    where: { companyId: company.id },
    orderBy: { code: "asc" },
    include: {
      equipment: { select: { id: true, tag: true, name: true } },
      items: { select: { recognitionStatus: true, parentItemId: true, fedFromIncomer: true } },
    },
  });
});

const companyProfile = { companyName: true, ico: true, dic: true, street: true, city: true, zip: true, contactName: true, phone: true, email: true, authorizationNumber: true, logoUrl: true, stampUrl: true } as const;

/** Detail projektu přihlášené firmy (cizí projekt → `null` = 404): prvky v pořadí lišta → pozice, katalogové kusy, výrobce. */
export const getPanelProject = cache(async (id: string) => {
  const company = await getPanelCompany();
  if (!company) return null;
  return prisma.panelBoardProject.findFirst({
    where: { id, companyId: company.id },
    include: {
      equipment: { select: { id: true, tag: true, name: true } },
      company: { select: companyProfile },
      items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], include: { catalogComponent: true } },
    },
  });
});

export type PanelProjectDetail = NonNullable<Awaited<ReturnType<typeof getPanelProject>>>;
export type PanelItemDetail = PanelProjectDetail["items"][number];

/** Rozváděče ve vlastním závodě firmy, ke kterým lze pasport propustit (krok 4); firma bez závodu → nic. */
export const getReleaseTargets = cache(async () => {
  const plantId = (await getPanelCompany())?.plantId;
  if (!plantId) return [];
  return prisma.equipment.findMany({
    where: { type: "SWITCHBOARD", floor: { building: { plantId } } },
    select: { id: true, tag: true, name: true, floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } } },
    orderBy: [{ tag: "asc" }],
  });
});

/** Propuštěné pasporty rozváděče (karta zařízení). */
export const getEquipmentPassports = cache((equipmentId: string) =>
  prisma.panelBoardProject.findMany({
    where: { equipmentId, status: "COMPLETED" },
    select: { id: true, code: true, name: true, releasedAt: true },
    orderBy: { releasedAt: "desc" },
  }),
);

/** Katalogová skříň projektu podle modelu (např. „ABB MISTRAL41W, 36M 3R“ → řada MISTRAL41W). */
export const getEnclosureComponent = cache(async (enclosureModel: string) => {
  if (!enclosureModel.trim()) return null;
  const enclosures = await prisma.catalogComponent.findMany({ where: { category: "ENCLOSURE" } });
  const model = enclosureModel.toLowerCase();
  return enclosures.find((row) => model.includes(row.series.toLowerCase()) || model.includes(row.typeCode.toLowerCase())) ?? null;
});

/** Počty kusů v databázi prvků podle výrobce (karty kaskádového menu, fáze 43); bez skříní a odhadů IEC. */
export const getBrandCounts = cache(async (): Promise<Record<string, number>> => {
  const rows = await prisma.catalogComponent.groupBy({ by: ["manufacturer"], where: { category: { not: "ENCLOSURE" }, dataSource: { not: "IEC_ESTIMATE" } }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.manufacturer, row._count._all]));
});

/** Vybraná skříň z katalogu rozvodnic (kusovník, P_max). */
export const getProjectEnclosure = cache((enclosureId: string | null) => (enclosureId ? prisma.panelEnclosure.findUnique({ where: { id: enclosureId } }) : null));
