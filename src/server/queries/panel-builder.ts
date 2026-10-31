import "server-only";

import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeSearch, type CatalogFilter } from "@/lib/panel-builder/catalog";
import { prisma } from "@/lib/prisma";

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

export const getPanelProjects = cache(() =>
  prisma.panelBoardProject.findMany({
    orderBy: { code: "asc" },
    include: {
      equipment: { select: { id: true, tag: true, name: true } },
      items: { select: { recognitionStatus: true, parentItemId: true, fedFromIncomer: true } },
    },
  }),
);

/** Detail projektu: prvky v pořadí lišta → pozice, s katalogovými kusy a vazbou na zařízení. */
export const getPanelProject = cache((id: string) =>
  prisma.panelBoardProject.findUnique({
    where: { id },
    include: {
      equipment: { select: { id: true, tag: true, name: true } },
      items: { orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], include: { catalogComponent: true } },
    },
  }),
);

export type PanelProjectDetail = NonNullable<Awaited<ReturnType<typeof getPanelProject>>>;
export type PanelItemDetail = PanelProjectDetail["items"][number];

/** Kusy katalogu pro Smart Fallback Picker (bez skříní). */
export const getPickerCatalog = cache(() =>
  prisma.catalogComponent.findMany({
    where: { category: { not: "ENCLOSURE" } },
    select: {
      id: true,
      manufacturer: true,
      typeCode: true,
      articleNumber: true,
      category: true,
      poles: true,
      ratedCurrentA: true,
      trippingCurve: true,
      modulesCount: true,
      powerLossWatts: true,
      description: true,
    },
    orderBy: [{ manufacturer: "asc" }, { typeCode: "asc" }],
  }),
);

export type PickerComponent = Awaited<ReturnType<typeof getPickerCatalog>>[number];

/** Rozváděče v závodech, ke kterým lze pasport propustit (výběr v kroku 4). */
export const getReleaseTargets = cache(() =>
  prisma.equipment.findMany({
    where: { type: "SWITCHBOARD" },
    select: { id: true, tag: true, name: true, floor: { select: { name: true, building: { select: { name: true, plant: { select: { name: true } } } } } } },
    orderBy: [{ tag: "asc" }],
  }),
);

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
