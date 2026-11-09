import "server-only";

import { HIDDEN_MANUFACTURER_NAMES, brandOf, isFanOnlyManufacturer, isHiddenManufacturer } from "@/lib/panel-builder/brands";
import { catalogGroupOf, componentGroup, componentGroupWhere, type CatalogGroupId } from "@/lib/panel-builder/catalog-groups";
import { cache } from "react";

import type { Prisma } from "@/generated/prisma/client";
import { normalizeSearch, type CatalogFilter } from "@/lib/panel-builder/catalog";
import { prisma } from "@/lib/prisma";
import { SAMPLE_PROJECT_CODE } from "@/lib/panel-builder/project-admin";
import { getPanelCompany } from "@/server/panel-session";

// Čtení dat AI Panel Builderu: katalog prvků, seznam projektů a detail projektu.

const CATALOG_LIMIT = 300;

export function catalogWhere(filter: CatalogFilter): Prisma.CatalogComponentWhereInput {
  const terms = filter.q ? normalizeSearch(filter.q).split(" ").filter(Boolean).slice(0, 6) : [];
  return {
    category: filter.category,
    manufacturer: filter.manufacturer ? { equals: filter.manufacturer, notIn: HIDDEN_MANUFACTURER_NAMES } : { notIn: HIDDEN_MANUFACTURER_NAMES },
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
    prisma.catalogComponent.count({ where: { manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } } }),
    prisma.catalogComponent.count({ where }),
    prisma.catalogComponent.findMany({ where: { manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } }, distinct: ["manufacturer"], select: { manufacturer: true }, orderBy: { manufacturer: "asc" } }),
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
    // Naposledy upravené nahoře (index companyId + updatedAt, fáze 48)
    orderBy: { updatedAt: "desc" },
    include: {
      equipment: { select: { id: true, tag: true, name: true } },
      items: { select: { recognitionStatus: true, parentItemId: true, fedFromIncomer: true } },
    },
  });
});

const companyProfile = { companyName: true, ico: true, dic: true, street: true, city: true, zip: true, contactName: true, phone: true, email: true, authorizationNumber: true, logoUrl: true, stampUrl: true, circuitChipsJson: true } as const;

const projectDetail = {
  equipment: { select: { id: true, tag: true, name: true } },
  // Fáze 75: vybraná skříň (krok 3 – kontrola, že se do ní návrh vejde)
  enclosure: true,
  company: { select: companyProfile },
  items: {
    orderBy: [{ dinRailIndex: "asc" as const }, { positionOnRail: "asc" as const }],
    include: { catalogComponent: true, wiringDevices: { include: { wiringDevice: { select: { title: true, articleNumber: true, category: true } } }, orderBy: { id: "asc" as const } } },
  },
};

/** Detail projektu přihlášené firmy (cizí projekt → `null` = 404): prvky v pořadí lišta → pozice, katalogové kusy, výrobce. */
export const getPanelProject = cache(async (id: string) => {
  const company = await getPanelCompany();
  if (!company) return null;
  return prisma.panelBoardProject.findFirst({ where: { id, companyId: company.id }, include: projectDetail });
});

/** Vzorový projekt PB-001 pro veřejnou ukázku elaborátu na úvodní stránce (fáze 48) – bez přihlášení. */
export const getShowcaseProject = cache(() => prisma.panelBoardProject.findUnique({ where: { code: SAMPLE_PROJECT_CODE }, include: projectDetail }));

/** Fáze 54: úvodní stránka nabízí vzorový elaborát jen tehdy, když PB-001 v databázi je (jinak by náhled ukázal 404). */
export const hasShowcaseProject = cache(async () => (await prisma.panelBoardProject.count({ where: { code: SAMPLE_PROJECT_CODE } })) > 0);

export type PanelProjectDetail = NonNullable<Awaited<ReturnType<typeof getPanelProject>>>;
export type PanelItemDetail = PanelProjectDetail["items"][number];

/** Rozváděče ve vlastním závodě firmy, ke kterým lze pasport propustit (krok 5); firma bez závodu → nic. */
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
  const rows = await prisma.catalogComponent.groupBy({ by: ["manufacturer"], where: { category: { not: "ENCLOSURE" }, manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES }, NOT: { articleNumber: { startsWith: "CFG-" } } }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.manufacturer, row._count._all]));
});

const visibleBoardParts = { manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES }, NOT: { articleNumber: { startsWith: "CFG-" } } };

/**
 * Fáze 60: výrobci, ze kterých jde postavit celý domovní rozváděč (jističe i chrániče v databázi) – volba výrobce
 * při generování z půdorysu a převod rozváděče. Počet = jističe + chrániče + jističochrániče.
 */
export const getBoardManufacturers = cache(async (): Promise<{ name: string; count: number }[]> => {
  const rows = await prisma.catalogComponent.groupBy({ by: ["manufacturer", "category"], where: { category: { in: ["MCB", "RCD", "RCBO"] }, ...visibleBoardParts }, _count: { _all: true } });
  const brands = new Map<string, { mcb: number; rcd: number }>();
  for (const row of rows) {
    const name = brandOf(row.manufacturer)?.value ?? row.manufacturer;
    const current = brands.get(name) ?? { mcb: 0, rcd: 0 };
    if (row.category === "MCB") current.mcb += row._count._all;
    else current.rcd += row._count._all;
    brands.set(name, current);
  }
  return [...brands.entries()]
    .filter(([name, counts]) => counts.mcb >= 5 && counts.rcd >= 1 && !isHiddenManufacturer(name))
    .map(([name, counts]) => ({ name, count: counts.mcb + counts.rcd }))
    .sort((a, b) => (a.name === "ABB" ? -1 : b.name === "ABB" ? 1 : b.count - a.count));
});

/** Vybraná skříň z katalogu rozvodnic (kusovník, P_max). */
export const getProjectEnclosure = cache((enclosureId: string | null) => (enclosureId ? prisma.panelEnclosure.findUnique({ where: { id: enclosureId } }) : null));

/** Fáze 74: propojené rozváděče z jednoho půdorysu – nadřazený rozváděč a podružné rozváděče (jen v rámci firmy). */
export async function getLinkedBoards(project: { id: string; parentBoardId: string | null; companyId: string | null }) {
  const scope = project.companyId ? { companyId: project.companyId } : { companyId: null };
  const [parent, children] = await Promise.all([
    project.parentBoardId ? prisma.panelBoardProject.findFirst({ where: { id: project.parentBoardId, ...scope }, select: { id: true, code: true, name: true, boardCode: true } }) : null,
    prisma.panelBoardProject.findMany({ where: { parentBoardId: project.id, ...scope }, select: { id: true, code: true, name: true, boardCode: true, feederJson: true }, orderBy: { code: "asc" } }),
  ]);
  return { parent, children };
}

/** Fáze 75: všechny skříně rozvodnic pro krok 3 (filtry výrobce, montáže, materiálu a krytí běží v prohlížeči). */
export const getEnclosureCatalog = cache(async () => (await prisma.panelEnclosure.findMany({ orderBy: [{ totalModules: "asc" }, { model: "asc" }] })).filter((row) => !isHiddenManufacturer(row.manufacturer)));

// ---------------------------------------------------------------------------
//  Katalog po výrobcích a kategoriích (fáze 47)
// ---------------------------------------------------------------------------

const visibleComponents = { manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES }, NOT: { articleNumber: { startsWith: "CFG-" } } };
const brandKey = (manufacturer: string) => brandOf(manufacturer)?.value ?? manufacturer;

/** Výrobci se zápisy v databázi → značka (sloučí „EATON“ / „Eaton“, „Schneider Electric“ / „Schneider“). */
async function manufacturerNames() {
  const [components, enclosures, wiring, fans] = await Promise.all([
    prisma.catalogComponent.groupBy({ by: ["manufacturer"], where: visibleComponents, _count: { _all: true } }),
    prisma.panelEnclosure.groupBy({ by: ["manufacturer"], _count: { _all: true } }),
    prisma.wiringDevice.groupBy({ by: ["manufacturer"], _count: { _all: true } }),
    prisma.enclosureFan.groupBy({ by: ["manufacturer"], _count: { _all: true } }),
  ]);
  const brands = new Map<string, { names: Set<string>; count: number }>();
  for (const row of [...components, ...enclosures, ...wiring, ...fans]) {
    if (isHiddenManufacturer(row.manufacturer) || isFanOnlyManufacturer(row.manufacturer)) continue;
    const key = brandKey(row.manufacturer);
    const entry = brands.get(key) ?? { names: new Set<string>(), count: 0 };
    entry.names.add(row.manufacturer);
    entry.count += row._count._all;
    brands.set(key, entry);
  }
  return brands;
}

/** Krok 1: karty aktivních výrobců s počtem prvků (od největšího). */
export const getCatalogBrands = cache(async () => {
  const brands = await manufacturerNames();
  return [...brands.entries()].map(([brand, entry]) => ({ brand, count: entry.count })).sort((a, b) => b.count - a.count || a.brand.localeCompare(b.brand));
});

/** Krok 2: počty prvků výrobce po kategoriích. */
export const getBrandGroups = cache(async (brand: string) => {
  const names = [...((await manufacturerNames()).get(brand)?.names ?? [])];
  const counts = new Map<CatalogGroupId, number>();
  if (!names.length) return { names, counts };
  const [components, enclosures, legacyEnclosures, wiring, fans] = await Promise.all([
    prisma.catalogComponent.groupBy({ by: ["category", "moduleSubtype"], where: { ...visibleComponents, manufacturer: { in: names }, category: { not: "ENCLOSURE" } }, _count: { _all: true } }),
    prisma.panelEnclosure.count({ where: { manufacturer: { in: names } } }),
    prisma.catalogComponent.count({ where: { manufacturer: { in: names }, category: "ENCLOSURE" } }),
    prisma.wiringDevice.count({ where: { manufacturer: { in: names } } }),
    prisma.enclosureFan.count({ where: { manufacturer: { in: names } } }),
  ]);
  for (const row of components) {
    const group = componentGroup(row);
    counts.set(group, (counts.get(group) ?? 0) + row._count._all);
  }
  if (enclosures + legacyEnclosures) counts.set("ENCLOSURE", enclosures + legacyEnclosures);
  if (wiring) counts.set("WIRING", wiring);
  if (fans) counts.set("FAN", fans);
  return { names, counts };
});

export interface CatalogItemFilter {
  poles?: string;
  current?: number;
  curve?: string;
  sensitivity?: number;
  series?: string;
}

const distinctValues = <T>(values: (T | null | undefined)[]) => [...new Set(values.filter((value): value is T => value !== null && value !== undefined && value !== 0 && value !== ""))];

/** Krok 3: prvky výrobce v kategorii (dlaždicové filtry) + hodnoty pro dlaždice. */
export async function getGroupItems(brand: string, group: CatalogGroupId, filter: CatalogItemFilter) {
  const names = [...((await manufacturerNames()).get(brand)?.names ?? [])];
  const source = catalogGroupOf(group).source;
  if (source === "enclosure") {
    const where = { manufacturer: { in: names }, ...(filter.series ? { series: filter.series } : {}) };
    const [rows, matching, series] = await Promise.all([
      prisma.panelEnclosure.findMany({ where, orderBy: [{ totalModules: "asc" }, { model: "asc" }], take: CATALOG_LIMIT }),
      prisma.panelEnclosure.count({ where }),
      prisma.panelEnclosure.findMany({ where: { manufacturer: { in: names } }, distinct: ["series"], select: { series: true }, orderBy: { series: "asc" } }),
    ]);
    return { kind: "enclosure" as const, rows, matching, options: { series: series.map((row) => row.series) } };
  }
  if (source === "wiring") {
    const where = { manufacturer: { in: names }, ...(filter.series ? { series: filter.series } : {}) };
    const [rows, matching, series] = await Promise.all([
      prisma.wiringDevice.findMany({ where, orderBy: [{ series: "asc" }, { category: "asc" }, { title: "asc" }], take: CATALOG_LIMIT }),
      prisma.wiringDevice.count({ where }),
      prisma.wiringDevice.findMany({ where: { manufacturer: { in: names } }, distinct: ["series"], select: { series: true }, orderBy: { series: "asc" } }),
    ]);
    return { kind: "wiring" as const, rows, matching, options: { series: series.map((row) => row.series) } };
  }
  if (source === "fan") {
    const rows = await prisma.enclosureFan.findMany({ where: { manufacturer: { in: names } }, orderBy: { airflowFreeM3h: "asc" } });
    return { kind: "fan" as const, rows, matching: rows.length, options: {} };
  }
  const base: Prisma.CatalogComponentWhereInput = { ...visibleComponents, manufacturer: { in: names }, ...componentGroupWhere(group) };
  const narrow: Prisma.CatalogComponentWhereInput = {
    ...(filter.poles ? { poles: filter.poles } : {}),
    ...(filter.current ? { ratedCurrentA: filter.current } : {}),
    ...(filter.curve ? { trippingCurve: filter.curve } : {}),
    ...(filter.sensitivity ? { rcdSensitivityMa: filter.sensitivity } : {}),
    ...(filter.series ? { series: filter.series } : {}),
  };
  const where: Prisma.CatalogComponentWhereInput = { AND: [base, narrow] };
  const [rows, matching, facets] = await Promise.all([
    prisma.catalogComponent.findMany({ where, orderBy: [{ poles: "asc" }, { trippingCurve: "asc" }, { ratedCurrentA: "asc" }, { typeCode: "asc" }], take: CATALOG_LIMIT }),
    prisma.catalogComponent.count({ where }),
    prisma.catalogComponent.findMany({ where: base, select: { poles: true, ratedCurrentA: true, trippingCurve: true, rcdSensitivityMa: true, series: true } }),
  ]);
  return {
    kind: "component" as const,
    rows,
    matching,
    options: {
      poles: distinctValues(facets.map((row) => row.poles)).sort(),
      current: distinctValues(facets.map((row) => row.ratedCurrentA)).sort((a, b) => a - b),
      curve: distinctValues(facets.map((row) => row.trippingCurve)).sort(),
      sensitivity: distinctValues(facets.map((row) => row.rcdSensitivityMa)).sort((a, b) => a - b),
      series: distinctValues(facets.map((row) => row.series)).sort(),
    },
  };
}

/** Globální hledání napříč výrobci (přístroje i domovní přístroje). */
export async function searchWholeCatalog(q: string) {
  const terms = normalizeSearch(q).split(" ").filter(Boolean).slice(0, 6);
  if (!terms.length) return null;
  const textWhere = terms.map((term) => ({ searchText: { contains: term } }));
  const [components, componentCount, wiring, wiringCount] = await Promise.all([
    prisma.catalogComponent.findMany({ where: { ...visibleComponents, AND: textWhere }, orderBy: [{ category: "asc" }, { manufacturer: "asc" }, { typeCode: "asc" }], take: CATALOG_LIMIT }),
    prisma.catalogComponent.count({ where: { ...visibleComponents, AND: textWhere } }),
    prisma.wiringDevice.findMany({ where: { AND: textWhere }, orderBy: [{ manufacturer: "asc" }, { title: "asc" }], take: 60 }),
    prisma.wiringDevice.count({ where: { AND: textWhere } }),
  ]);
  return { components, componentCount, wiring, wiringCount };
}

/** Ventilátory skříní s filtrem (fáze 47) – od nejmenšího průtoku. */
export const getEnclosureFans = cache(async () =>
  prisma.enclosureFan.findMany({
    orderBy: [{ airflowFreeM3h: "asc" }, { manufacturer: "asc" }],
    select: { id: true, manufacturer: true, typeCode: true, articleNumber: true, airflowFreeM3h: true, airflowFilterM3h: true, ratedVoltage: true, powerW: true, ipRating: true, cutoutMm: true, noiseDbA: true, datasheetUrl: true },
  }),
);

/** Designové řady domovních přístrojů s vypínači nebo zásuvkami (2D půdorys, fáze 49): „výrobce|řada“ + počet kusů. */
/** Fáze 63: knihovna samostatných spotřebičů přihlášené firmy (JSON) pro 2D půdorys. */
export const getApplianceLibraryJson = cache(async (): Promise<string | null> => {
  const company = await getPanelCompany();
  if (!company) return null;
  return (await prisma.registeredCompany.findUnique({ where: { id: company.id }, select: { applianceLibraryJson: true } }))?.applianceLibraryJson ?? null;
});

export const getWiringSeries = cache(async () => {
  const rows = await prisma.wiringDevice.groupBy({ by: ["manufacturer", "series"], where: { category: { in: ["WD_SOCKET", "WD_SWITCH"] } }, _count: { _all: true }, orderBy: [{ manufacturer: "asc" }, { series: "asc" }] });
  return rows.filter((row) => row._count._all >= 5).map((row) => ({ key: `${row.manufacturer}|${row.series}`, label: `${row.manufacturer} ${row.series}`, count: row._count._all }));
});

/** Objednávky kreditů přihlášené firmy (fáze 50), nejnovější nahoře. */
export const getCreditOrders = cache(async () => {
  const company = await getPanelCompany();
  if (!company) return [];
  return prisma.creditOrder.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 50 });
});

/** Objednávka přihlášené firmy s fakturačními údaji odběratele (cizí objednávka → null). */
export const getCreditOrder = cache(async (id: string) => {
  const company = await getPanelCompany();
  if (!company) return null;
  return prisma.creditOrder.findFirst({
    where: { id, companyId: company.id },
    include: { company: { select: { companyName: true, ico: true, dic: true, street: true, city: true, zip: true, email: true, contactName: true, phone: true } } },
  });
});
