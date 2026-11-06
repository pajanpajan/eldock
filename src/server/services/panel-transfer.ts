import type { PrismaClient } from "@/generated/prisma/client";
import { HIDDEN_MANUFACTURER_NAMES } from "@/lib/panel-builder/brands";
import { buildSearchText } from "@/lib/panel-builder/catalog";
import { catalogCategory, configFromComponent, parseConfig, synthesizeComponent } from "@/lib/panel-builder/configurator";
import { planTransfer, reflowRails, transferSummary, type TransferRow } from "@/lib/panel-builder/manufacturer-transfer";
import { railCapacities, railColumns } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { renumberProject } from "./panel-builder";

// Fáze 60: převod celého rozváděče na jiného výrobce se zachováním hodnot přístrojů, značení, popisů obvodů, stromu
// zapojení i pořadí na lištách. Náhled (bez zápisu) i provedení v jedné transakci; přeplněné lišty se přerozdělí.

export interface TransferResult {
  manufacturer: string;
  rows: TransferRow[];
  summary: ReturnType<typeof transferSummary>;
  /** Přístroje přesunuté na další lištu kvůli jiné šířce. */
  moved: number;
  applied: boolean;
}

export async function transferManufacturer(prisma: PrismaClient, projectId: string, manufacturer: string, options: { apply: boolean }): Promise<TransferResult> {
  const name = manufacturer.trim();
  if (!name || HIDDEN_MANUFACTURER_NAMES.includes(name)) throw new WorkflowError("VALIDATION", "Zvolte výrobce z databáze prvků.");
  const project = await prisma.panelBoardProject.findUnique({
    where: { id: projectId },
    select: { id: true, dinRailsCount: true, modulesPerRail: true, railModulesJson: true, items: { include: { catalogComponent: true }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }] } },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const items = project.items.map((item) => ({
    id: item.id,
    designation: item.designation,
    circuitLabel: item.circuitLabel,
    modulesWidth: item.modulesWidth,
    config: parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null),
    component: item.catalogComponent ? { manufacturer: item.catalogComponent.manufacturer, typeCode: item.catalogComponent.typeCode, articleNumber: item.catalogComponent.articleNumber } : null,
  }));
  const categories = [...new Set(items.map((item) => (item.config ? catalogCategory(item.config) : null)).filter((category): category is NonNullable<typeof category> => category !== null))];
  const catalog = categories.length ? await prisma.catalogComponent.findMany({ where: { category: { in: categories }, manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } } }) : [];
  const rows = planTransfer(items, catalog, name);
  const summary = transferSummary(rows);
  if (!options.apply) return { manufacturer: name, rows, summary, moved: 0, applied: false };
  if (!summary.changed) throw new WorkflowError("VALIDATION", `Rozváděč už je od výrobce ${name} – není co převádět.`);

  // Odhady (výrobce kus v katalogu nemá): parametry z konfigurace, ztrátový výkon dle IEC – jako v konfigurátoru
  const componentIds = new Map<string, string>();
  for (const row of rows.filter((candidate) => candidate.status === "estimate" && candidate.config)) {
    const synthesized = synthesizeComponent(row.config!);
    const component = await prisma.catalogComponent.upsert({ where: { articleNumber: synthesized.articleNumber }, create: { ...synthesized, dataSource: "IEC_ESTIMATE", searchText: buildSearchText(synthesized) }, update: {} });
    componentIds.set(row.itemId, component.id);
  }
  // Nové šířky → přeplněné lišty: konec lišty na další / novou lištu (pořadí a strom zůstávají)
  const byId = new Map(rows.map((row) => [row.itemId, row]));
  const reflow = reflowRails(
    railCapacities(project),
    project.items.map((item) => ({ id: item.id, rail: item.dinRailIndex, position: item.positionOnRail, width: byId.get(item.id)?.modulesTo ?? item.modulesWidth })),
  );
  const slots = new Map(reflow.slots.map((slot) => [slot.id, slot]));
  await prisma.$transaction([
    ...project.items.map((item) => {
      const row = byId.get(item.id)!;
      const slot = slots.get(item.id)!;
      const componentId = row.componentId ?? componentIds.get(item.id) ?? null;
      return prisma.panelBoardItem.update({
        where: { id: item.id },
        data: {
          dinRailIndex: slot.rail,
          positionOnRail: slot.position,
          sortOrder: slot.rail * 100 + slot.position,
          ...(row.status !== "keep" && row.config ? { configJson: JSON.stringify(row.config), modulesWidth: row.modulesTo, ...(componentId ? { catalogComponentId: componentId } : {}), customTypeCode: null, recognitionStatus: "VERIFIED" as const } : {}),
        },
      });
    }),
    prisma.panelBoardProject.update({ where: { id: projectId }, data: { ...railColumns(reflow.capacities), dominantManufacturer: name } }),
  ]);
  await renumberProject(prisma, projectId);
  return { manufacturer: name, rows, summary, moved: reflow.moved, applied: true };
}
