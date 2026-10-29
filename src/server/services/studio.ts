// Studio výstavby závodu: uloží koncept budovy (patra s vygenerovaným půdorysem a zařízení
// s hierarchií napájení) v jedné transakci. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { DEFAULT_GRID, clampGrid, gridToPercent, parseGridRef, renderGridFloorplanSvg, type GridSpec } from "@/lib/cad-grid";
import { inspectionRuleFor, isPortable } from "@/lib/inspection-rules";
import { validatePlacement, type PowerSource } from "@/lib/power-hierarchy";
import { floorLabel, floorName, rectPolygon, type StudioDraft } from "@/lib/studio-draft";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { preparePlant } from "./plants";

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

export async function saveStudioBuilding(prisma: PrismaClient, draft: StudioDraft) {
  const grid: GridSpec = clampGrid(draft.grid);
  // Nový závod od nuly: ověřit hned, založit až v transakci spolu s budovou.
  const newPlant = draft.newPlant ? await preparePlant(prisma, draft.newPlant) : null;
  if (newPlant && draft.building.mode !== "new") fail("Nový závod začíná novou budovou.");
  const plant = newPlant ? { id: "" } : await prisma.plant.findUnique({ where: { id: draft.plantId }, select: { id: true } });
  if (!plant) throw new WorkflowError("NOT_FOUND", "Závod nebyl nalezen.");

  // Existující budova a patra
  const existingBuilding =
    draft.building.mode === "existing"
      ? await prisma.building.findFirst({ where: { id: draft.building.id, plantId: plant.id }, include: { floors: { select: { id: true, level: true, code: true } } } })
      : null;
  if (draft.building.mode === "existing" && !existingBuilding) throw new WorkflowError("NOT_FOUND", "Budova nebyla nalezena.");
  if (draft.building.mode === "new") {
    const { code, name } = draft.building;
    if (!/^[A-Z0-9]{1,4}$/i.test(code.trim())) fail("Kód budovy: 1–4 písmena nebo číslice (např. C).");
    if (name.trim().length < 3) fail("Zadejte název budovy.");
    if (!newPlant && (await prisma.building.findFirst({ where: { plantId: plant.id, code: code.trim().toUpperCase() }, select: { id: true } }))) {
      fail(`Budova s kódem ${code.trim().toUpperCase()} v závodě už existuje.`);
    }
  }
  const levels = new Set(existingBuilding?.floors.map((floor) => floor.level) ?? []);
  for (const floor of draft.floors) {
    if (levels.has(floor.level)) fail(`Patro ${floorLabel(floor.level).short} už v budově existuje.`);
    levels.add(floor.level);
  }
  if (!existingBuilding && draft.floors.length === 0) fail("Přidejte alespoň jedno patro.");

  // Zdroje napájení: rozváděče a trafa závodu + rozváděče konceptu
  const plantSources = newPlant
    ? []
    : await prisma.equipment.findMany({
        where: { type: { in: ["SWITCHBOARD", "TRANSFORMER"] }, floor: { building: { plantId: plant.id } } },
        select: { id: true, tag: true, type: true, floorId: true },
      });
  const draftSources: PowerSource[] = draft.equipment
    .filter((item) => item.type === "SWITCHBOARD" || item.type === "TRANSFORMER")
    .map((item) => ({ id: `draft:${item.key}`, tag: item.tag, type: item.type, floorId: item.floor.kind === "draft" ? `draft:${item.floor.key}` : item.floor.id }));
  const sources = [...plantSources, ...draftSources];
  const existingFloorIds = new Set(existingBuilding?.floors.map((floor) => floor.id) ?? []);
  const draftFloorKeys = new Set(draft.floors.map((floor) => floor.key));
  const tagsByFloor = new Map<string, Set<string>>();

  for (const item of draft.equipment) {
    if (item.floor.kind === "draft" ? !draftFloorKeys.has(item.floor.key) : !existingFloorIds.has(item.floor.id)) fail(`${item.tag}: neznámé patro.`);
    const parentId = item.parent ? (item.parent.kind === "draft" ? `draft:${item.parent.key}` : item.parent.id) : null;
    const errors = validatePlacement({ type: item.type, tag: item.tag, parentId, circuit: item.circuit, zone: item.zone, isRoot: item.isRoot }, sources);
    if (errors.length) fail(`${item.tag || "Zařízení"}: ${errors.join(" ")}`);
    if (item.parent?.kind === "draft" && item.parent.key === item.key) fail(`${item.tag}: zařízení nemůže napájet samo sebe.`);
    const floorKey = item.floor.kind === "draft" ? `draft:${item.floor.key}` : item.floor.id;
    const tags = tagsByFloor.get(floorKey) ?? new Set<string>();
    if (tags.has(item.tag.trim().toUpperCase())) fail(`${item.tag}: označení se na patře opakuje.`);
    tags.add(item.tag.trim().toUpperCase());
    tagsByFloor.set(floorKey, tags);
    const spec = item.floor.kind === "draft" ? grid : DEFAULT_GRID;
    if (!parseGridRef(item.at, spec)) fail(`${item.tag}: bod ${item.at} leží mimo rastr.`);
  }
  if (draft.equipment.some((item) => item.floor.kind === "existing")) {
    const taken = await prisma.equipment.findMany({ where: { floorId: { in: [...existingFloorIds] } }, select: { floorId: true, tag: true } });
    for (const row of taken) if (tagsByFloor.get(row.floorId)?.has(row.tag.toUpperCase())) fail(`${row.tag}: na patře už zařízení s tímto označením je.`);
  }

  return prisma.$transaction(async (tx) => {
    if (newPlant) plant.id = (await tx.plant.create({ data: newPlant, select: { id: true } })).id;
    let buildingId = existingBuilding?.id;
    if (draft.building.mode === "new") {
      const last = await tx.building.findFirst({ where: { plantId: plant.id }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      const { map } = draft.building;
      const created = await tx.building.create({
        data: {
          plantId: plant.id,
          code: draft.building.code.trim().toUpperCase(),
          name: draft.building.name.trim(),
          shortName: draft.building.name.trim().split(" - ").pop() ?? null,
          type: draft.building.type,
          description: `Navrženo ve Studiu výstavby závodu (rastr ${grid.cols} × ${grid.rows}, rozteč ${grid.stepMeters} m).`,
          mapPolygon: rectPolygon(map),
          labelX: Math.round((map.x + map.w / 2) * 10) / 10,
          labelY: Math.round((map.y + map.h / 2) * 10) / 10,
          sortOrder: (last?.sortOrder ?? 0) + 1,
        },
      });
      buildingId = created.id;
    }

    const floorIds = new Map<string, string>();
    for (const floor of draft.floors) {
      const name = floorName(floor.level, floor.usage);
      const created = await tx.floor.create({
        data: {
          buildingId: buildingId!,
          level: floor.level,
          code: floorLabel(floor.level).code,
          name,
          description: floor.usage.trim() || null,
          floorplanSvg: renderGridFloorplanSvg({ floorName: name, spec: grid, zones: floor.zones, gates: floor.gates }),
        },
      });
      floorIds.set(floor.key, created.id);
    }

    const equipmentIds = new Map<string, string>();
    for (const item of draft.equipment) {
      const floorId = item.floor.kind === "draft" ? floorIds.get(item.floor.key)! : item.floor.id;
      const spec = item.floor.kind === "draft" ? grid : DEFAULT_GRID;
      const pin = gridToPercent(parseGridRef(item.at, spec)!, spec);
      const created = await tx.equipment.create({
        data: {
          floorId,
          tag: item.tag.trim().toUpperCase(),
          name: item.name.trim() ? `${item.tag.trim().toUpperCase()} - ${item.name.trim()}` : item.tag.trim().toUpperCase(),
          type: item.type,
          ...pin,
          assignedZone: item.zone?.trim() || null,
          usageGroup: isPortable(item.type) ? "C" : null,
          protectionClass: isPortable(item.type) ? "I" : null,
          inspectionIntervalMonths: inspectionRuleFor({ type: item.type, usageGroup: isPortable(item.type) ? "C" : null }).months,
          description: "Osazeno ve Studiu výstavby závodu.",
        },
      });
      equipmentIds.set(item.key, created.id);
    }
    for (const item of draft.equipment) {
      if (!item.parent) continue;
      await tx.equipment.update({
        where: { id: equipmentIds.get(item.key)! },
        data: {
          fedFromEquipmentId: item.parent.kind === "draft" ? equipmentIds.get(item.parent.key)! : item.parent.id,
          fedFromCircuit: item.circuit?.trim() || null,
        },
      });
    }

    // Přesměrování: patro prvního osazeného zařízení, jinak nové 1. NP, jinak první nové patro.
    const first = draft.equipment[0]?.floor;
    const firstFloorId =
      (first ? (first.kind === "draft" ? floorIds.get(first.key) : first.id) : undefined) ??
      floorIds.get(draft.floors.find((floor) => floor.level === 0)?.key ?? "") ??
      floorIds.values().next().value ??
      existingBuilding?.floors[0]?.id;
    return { plantId: plant.id, plantCreated: Boolean(newPlant), buildingId: buildingId!, firstFloorId: firstFloorId ?? null, floors: floorIds.size, equipment: equipmentIds.size };
  });
}
