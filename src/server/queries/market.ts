import "server-only";

import { prisma } from "@/lib/prisma";
import { allElements, analyzeDraft, parseDraft } from "@/lib/panel-builder/floorplan-editor";
import { compileFloorplanBom } from "@/lib/panel-builder/wiring-bom";
import { designSeriesOf } from "@/lib/panel-builder/wiring-designs";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { SOURCE_LABEL, TRAFFIC_SOURCES, parseProps, type TrafficSource } from "@/lib/telemetry";
import { leadRows } from "@/server/services/leads";

// Fáze 102: „📈 Návštěvnost, Leady & Tržní data“ ve velínu – trychtýř (návštěvy podle zdroje → trenažér → kontakty →
// registrované firmy), zachycené kontakty s daty z ARES, oblíbenost designových řad a značek přístrojů, objem materiálu
// (metry kabelů, krabice KOPOS, moduly) a poměr souhlasů s cookies. Výpočet z uložených půdorysů drží proces 10 minut.

export interface MarketOverview {
  days: number;
  funnel: { visits: number; bySource: { source: TrafficSource; label: string; count: number }[]; sandboxes: number; bySandbox: { sandbox: string; count: number }[]; leads: number; registered: number };
  leads: Awaited<ReturnType<typeof leadRows>>;
  series: { key: string; label: string; elements: number; floorplans: number; selected: number }[];
  brands: { brand: string; devices: number; modules: number }[];
  material: { floorplans: number; cableM: number; koposBoxes: number; boxes: number; modules: number; projects: number };
  consent: { total: number; acceptAll: number; necessaryOnly: number; custom: number };
  events: { type: string; count: number }[];
}

const FLOORPLAN_CACHE_MS = 10 * 60_000;
let floorplanCache: { at: number; value: { series: Map<string, { elements: number; floorplans: number }>; cableM: number; koposBoxes: number; boxes: number; floorplans: number } } | null = null;

/** Řady a materiál z uložených půdorysů (nejnovějších 300) – analýza tras a kusovník stejnými funkcemi jako editor. */
async function floorplanStats() {
  if (floorplanCache && Date.now() - floorplanCache.at < FLOORPLAN_CACHE_MS) return floorplanCache.value;
  const rows = await prisma.floorplan.findMany({ where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 300, select: { draftJson: true } });
  const series = new Map<string, { elements: number; floorplans: number }>();
  let cableM = 0;
  let koposBoxes = 0;
  let boxes = 0;
  let floorplans = 0;
  for (const row of rows) {
    let draft;
    try {
      draft = parseDraft(JSON.parse(row.draftJson));
    } catch {
      draft = null;
    }
    if (!draft) continue;
    floorplans += 1;
    const used = new Set<string>();
    for (const element of allElements(draft)) {
      const key = element.series ?? draft.series;
      if (!key || element.item === "panel") continue;
      const entry = series.get(key) ?? { elements: 0, floorplans: 0 };
      entry.elements += 1;
      if (!used.has(key)) {
        entry.floorplans += 1;
        used.add(key);
      }
      series.set(key, entry);
    }
    try {
      const analysis = analyzeDraft(draft);
      cableM += analysis.summary.byCable.reduce((sum, cable) => sum + cable.meters, 0);
      for (const bomRow of compileFloorplanBom(draft, { installation: draft.installation, cables: analysis.summary.byCable, cableEnds: {} })) {
        if (bomRow.category !== "Instalační krabice") continue;
        boxes += bomRow.quantity;
        if (bomRow.box?.maker.startsWith("KOPOS")) koposBoxes += bomRow.quantity;
      }
    } catch {
      // poškozený nákres statistiku nezastaví
    }
  }
  const value = { series, cableM: Math.round(cableM), koposBoxes, boxes, floorplans };
  floorplanCache = { at: Date.now(), value };
  return value;
}

export async function getMarketOverview(days = 30): Promise<MarketOverview> {
  const since = new Date(Date.now() - days * 86_400_000);
  const [landing, sandboxEvents, leadsCount, registered, selectedEvents, items, projects, consents, eventCounts, leads, plans] = await Promise.all([
    prisma.telemetryEvent.groupBy({ by: ["source"], where: { type: "page_view", landing: true, createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.telemetryEvent.findMany({ where: { type: "sandbox_started", createdAt: { gte: since } }, select: { props: true }, take: 20_000 }),
    prisma.lead.count({ where: { createdAt: { gte: since } } }),
    prisma.registeredCompany.count({ where: { createdAt: { gte: since }, id: { not: TESTER_COMPANY.id }, closedAt: null } }),
    prisma.telemetryEvent.findMany({ where: { type: "series_selected", createdAt: { gte: since } }, select: { props: true }, take: 20_000 }),
    prisma.panelBoardItem.findMany({ select: { modulesWidth: true, catalogComponent: { select: { manufacturer: true } } }, take: 50_000, orderBy: { id: "desc" } }),
    prisma.panelBoardProject.count(),
    prisma.consentRecord.findMany({ where: { createdAt: { gte: since } }, select: { analytics: true, marketing: true }, take: 50_000 }),
    prisma.telemetryEvent.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    leadRows(prisma, 300),
    floorplanStats(),
  ]);

  const bySource = TRAFFIC_SOURCES.filter((source) => source !== "internal").map((source) => ({ source, label: SOURCE_LABEL[source], count: landing.find((row) => row.source === source)?._count._all ?? 0 }));
  const sandboxCounts = new Map<string, number>();
  for (const event of sandboxEvents) {
    const sandbox = String(parseProps(event.props).sandbox ?? "neuvedeno");
    sandboxCounts.set(sandbox, (sandboxCounts.get(sandbox) ?? 0) + 1);
  }
  const selected = new Map<string, number>();
  for (const event of selectedEvents) {
    const key = String(parseProps(event.props).series ?? "");
    if (key) selected.set(key, (selected.get(key) ?? 0) + 1);
  }
  const keys = new Set([...plans.series.keys(), ...selected.keys()]);
  const series = [...keys]
    .map((key) => {
      const design = designSeriesOf(key);
      return { key, label: design ? `${design.brand.label} ${design.series.name}` : key.replace("|", " "), elements: plans.series.get(key)?.elements ?? 0, floorplans: plans.series.get(key)?.floorplans ?? 0, selected: selected.get(key) ?? 0 };
    })
    .sort((a, b) => b.elements - a.elements || b.selected - a.selected)
    .slice(0, 20);

  const brandMap = new Map<string, { devices: number; modules: number }>();
  let modules = 0;
  for (const item of items) {
    modules += item.modulesWidth;
    const brand = item.catalogComponent?.manufacturer;
    if (!brand) continue;
    const entry = brandMap.get(brand) ?? { devices: 0, modules: 0 };
    entry.devices += 1;
    entry.modules += item.modulesWidth;
    brandMap.set(brand, entry);
  }
  const brands = [...brandMap.entries()].map(([brand, value]) => ({ brand, devices: value.devices, modules: Math.round(value.modules) })).sort((a, b) => b.devices - a.devices).slice(0, 12);

  const acceptAll = consents.filter((row) => row.analytics && row.marketing).length;
  const necessaryOnly = consents.filter((row) => !row.analytics && !row.marketing).length;
  const sandboxes = sandboxEvents.length;
  return {
    days,
    funnel: { visits: bySource.reduce((sum, row) => sum + row.count, 0), bySource, sandboxes, bySandbox: [...sandboxCounts.entries()].map(([sandbox, count]) => ({ sandbox, count })).sort((a, b) => b.count - a.count), leads: leadsCount, registered },
    leads,
    series,
    brands,
    material: { floorplans: plans.floorplans, cableM: plans.cableM, koposBoxes: plans.koposBoxes, boxes: plans.boxes, modules: Math.round(modules), projects },
    consent: { total: consents.length, acceptAll, necessaryOnly, custom: consents.length - acceptAll - necessaryOnly },
    events: eventCounts.map((row) => ({ type: row.type, count: row._count._all })).sort((a, b) => b.count - a.count),
  };
}
