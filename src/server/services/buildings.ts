// Fáze 108: správa budov závodu mimo Studio – úprava (název, kód, rozměr a poloha na mapě), přesun tažením na mapě,
// úprava podlaží a smazání budovy / zařízení s počty toho, co zmizí. Smazání budovy se zapíše do bezpečnostního deníku
// firmy. Čisté služby nad Prisma klientem (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { buildingEditSchema, floorEditSchema, metersToMapRect, needsTypedConfirmation, placementError, rectToBuildingMap, type BuildingEditInput } from "@/lib/building-edit";
import type { CampusRect } from "@/lib/campus-layout";
import { STUDIO_MENU_KEY, allMenuTemplates, parseStudioMenu } from "@/lib/studio-menu";
import { OPEN_STATUSES, WorkflowError } from "@/lib/workflow/state-machine";

import { refreshFloorInventory } from "./studio";

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

export interface BuildingImpact {
  floors: number;
  equipment: number;
  inspections: number;
  documents: number;
}

/** Co smazání budovy odstraní (podlaží, zařízení, záznamy revizí, dokumenty a revize výkresů). */
export async function buildingImpact(prisma: PrismaClient, buildingId: string): Promise<BuildingImpact> {
  const viaBuilding = { equipment: { floor: { buildingId } } };
  const [floors, equipment, inspections, revisions, documents] = await Promise.all([
    prisma.floor.count({ where: { buildingId } }),
    prisma.equipment.count({ where: { floor: { buildingId } } }),
    prisma.inspectionRecord.count({ where: viaBuilding }),
    prisma.documentRevision.count({ where: viaBuilding }),
    prisma.equipmentDocument.count({ where: viaBuilding }),
  ]);
  return { floors, equipment, inspections, documents: revisions + documents };
}

async function loadBuilding(prisma: PrismaClient, buildingId: string) {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { id: true, name: true, code: true, plantId: true, mapPolygon: true, plant: { select: { id: true, campusWidthM: true, campusDepthM: true, buildings: { select: { id: true, name: true, code: true, mapPolygon: true } } } } },
  });
  if (!building) throw new WorkflowError("NOT_FOUND", "Budova nebyla nalezena.");
  return building;
}

/** Úprava budovy: název, kód (v závodu jedinečný), zkrácený název, poloha a rozměr v metrech pozemku. */
export async function updateBuilding(prisma: PrismaClient, raw: BuildingEditInput) {
  const parsed = buildingEditSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error!.issues[0]?.message ?? "Zkontrolujte údaje budovy.");
  const input = parsed.data!;
  const building = await loadBuilding(prisma, input.buildingId);
  const code = input.code.toUpperCase();
  if (building.plant.buildings.some((other) => other.id !== building.id && other.code.toUpperCase() === code)) fail(`Kód ${code} už má jiná budova závodu.`);
  let map: ReturnType<typeof rectToBuildingMap> | null = null;
  if (input.map) {
    const rect = metersToMapRect(input.map, { width: building.plant.campusWidthM, height: building.plant.campusDepthM });
    const error = placementError(rect, building.id, building.plant.buildings);
    if (error) fail(error);
    map = rectToBuildingMap(rect);
  }
  return prisma.building.update({
    where: { id: building.id },
    data: { name: input.name, code, shortName: input.shortName?.trim() || null, ...(map ?? {}) },
    select: { id: true, name: true, code: true, mapPolygon: true, labelX: true, labelY: true, plantId: true },
  });
}

/** Přesun budovy tažením na mapě areálu (obdélník v procentech mapy) – mimo areál ani přes jinou halu nejde. */
export async function moveBuilding(prisma: PrismaClient, buildingId: string, rect: CampusRect) {
  const building = await loadBuilding(prisma, buildingId);
  const error = placementError(rect, building.id, building.plant.buildings);
  if (error) fail(error);
  return prisma.building.update({ where: { id: building.id }, data: rectToBuildingMap(rect), select: { id: true, mapPolygon: true, labelX: true, labelY: true, plantId: true } });
}

/** Úprava podlaží (název „1. NP - Výroba“ a popis). */
export async function updateFloor(prisma: PrismaClient, raw: { floorId: string; name: string; description?: string | null }) {
  const parsed = floorEditSchema.safeParse(raw);
  if (!parsed.success) fail(parsed.error!.issues[0]?.message ?? "Zkontrolujte údaje podlaží.");
  const input = parsed.data!;
  const floor = await prisma.floor.findUnique({ where: { id: input.floorId }, select: { id: true } });
  if (!floor) throw new WorkflowError("NOT_FOUND", "Podlaží nebylo nalezeno.");
  const updated = await prisma.floor.update({ where: { id: floor.id }, data: { name: input.name, description: input.description?.trim() || null }, select: { id: true, name: true, description: true } });
  // Název patra je i v uloženém půdorysu ze Studia (popisek výkresu)
  const menu = parseStudioMenu((await prisma.tenantSetting.findUnique({ where: { key: STUDIO_MENU_KEY }, select: { value: true } }))?.value);
  await refreshFloorInventory(prisma, floor.id, menu ? allMenuTemplates(menu) : []);
  return updated;
}

const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase("cs") === b.trim().toLocaleLowerCase("cs");

/**
 * Smazání budovy i s podlažími a zařízeními (kaskáda databáze). Budova se zařízeními, revizemi nebo dokumenty se smaže
 * jen po opsání svého názvu – doklady o revizích se tím nenávratně ztratí (doporučení: nejdřív export dat firmy).
 */
export async function deleteBuilding(prisma: PrismaClient, input: { buildingId: string; confirmName?: string | null; actorId?: string | null }) {
  const building = await loadBuilding(prisma, input.buildingId);
  const impact = await buildingImpact(prisma, building.id);
  if (needsTypedConfirmation(impact) && !sameName(input.confirmName ?? "", building.name)) {
    fail(`Pro smazání budovy se zařízeními a revizemi opište její název „${building.name}“.`);
  }
  const company = await prisma.registeredCompany.findFirst({ where: { plantId: building.plantId, productScope: "PLANT_MANAGEMENT" }, select: { id: true } });
  await prisma.$transaction([
    prisma.building.delete({ where: { id: building.id } }),
    prisma.securityEvent.create({
      data: {
        kind: "BUILDING_DELETED",
        companyId: company?.id ?? null,
        actorId: input.actorId ?? null,
        detail: JSON.stringify({ plantId: building.plantId, buildingId: building.id, code: building.code, name: building.name, ...impact }).slice(0, 1000),
      },
    }),
  ]);
  return { plantId: building.plantId, name: building.name, impact };
}

export interface EquipmentImpact {
  tag: string;
  name: string;
  inspections: number;
  documents: number;
}

export async function equipmentImpact(prisma: PrismaClient, equipmentId: string): Promise<EquipmentImpact> {
  const equipment = await prisma.equipment.findUnique({ where: { id: equipmentId }, select: { tag: true, name: true } });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  const [inspections, revisions, documents] = await Promise.all([
    prisma.inspectionRecord.count({ where: { equipmentId } }),
    prisma.documentRevision.count({ where: { equipmentId } }),
    prisma.equipmentDocument.count({ where: { equipmentId } }),
  ]);
  return { tag: equipment.tag, name: equipment.name, inspections, documents: revisions + documents };
}

/**
 * Smazání zařízení z podlaží (stejná pravidla jako „Smazat“ ve Studiu): bez otevřeného požadavku na změnu, nenapájí
 * jiná zařízení; se záznamy revizí nebo dokumenty jen po opsání svého označení (tagu). Uložený půdorys patra se
 * překreslí (štítky inventáře místností).
 */
export async function deleteEquipment(prisma: PrismaClient, input: { equipmentId: string; confirmTag?: string | null }) {
  const impact = await equipmentImpact(prisma, input.equipmentId);
  const row = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    select: { floorId: true, changeRequests: { where: { status: { in: [...OPEN_STATUSES] } }, select: { number: true }, take: 1 }, feeds: { select: { tag: true } } },
  });
  if (!row) throw new WorkflowError("NOT_FOUND", "Zařízení nebylo nalezeno.");
  if (row.changeRequests.length) fail(`${impact.tag}: má otevřený požadavek na změnu ${row.changeRequests[0].number} – nejdřív ho uzavřete.`);
  if (row.feeds.length) fail(`${impact.tag}: napájí ${row.feeds.map((child) => child.tag).join(", ")} – nejdřív je přepojte nebo smažte.`);
  if ((impact.inspections || impact.documents) && !sameName(input.confirmTag ?? "", impact.tag)) fail(`Zařízení má revize a dokumenty – pro smazání opište jeho označení „${impact.tag}“.`);
  await prisma.equipment.delete({ where: { id: input.equipmentId } });
  const menu = parseStudioMenu((await prisma.tenantSetting.findUnique({ where: { key: STUDIO_MENU_KEY }, select: { value: true } }))?.value);
  await refreshFloorInventory(prisma, row.floorId, menu ? allMenuTemplates(menu) : []);
  return { ...impact, floorId: row.floorId };
}
