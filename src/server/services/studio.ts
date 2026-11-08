// Studio výstavby závodu: uloží koncept budovy (patra s vygenerovaným půdorysem a zařízení
// s hierarchií napájení) v jedné transakci. Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import {
  EXISTING_FLOOR_FRAME,
  FLOOR_VIEWBOX,
  clampGrid,
  fmtM,
  insideFrame,
  metersToPercent,
  planFrame,
  pxToMeters,
  renderGridFloorplanSvg,
  zoneFits,
  type GridSpec,
  type PlanFrame,
} from "@/lib/cad-grid";
import { frameOfFloor, layoutOfFloor, parseLayout, serializeLayout } from "@/lib/studio-layout";
import { STUDIO_MENU_KEY, allMenuTemplates, normalizeMenu, parseStudioMenu, type StudioMenu } from "@/lib/studio-menu";
import { campusSizeValid, campusViewBox, polygonBounds, rectInsideCampus, rescalePolygon, type CampusSize } from "@/lib/campus-layout";
import { placementOf } from "@/lib/equipment-categories";
import { inspectionRuleFor, isPortable } from "@/lib/inspection-rules";
import { newQrToken } from "@/lib/qr-label";
import { validatePlacement, type PowerSource } from "@/lib/power-hierarchy";
import { floorLabel, floorName, rectPolygon, type StudioConceptDraft, type StudioDraft } from "@/lib/studio-draft";
import { OPEN_STATUSES, WorkflowError } from "@/lib/workflow/state-machine";

import { preparePlant } from "./plants";
import type { Tx } from "./workflow";

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Celý název zařízení „TAG - název“ (název, který už tagem začíná, se neopakuje). */
export function withTag(tag: string, name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return tag;
  const prefix = `${tag} - `;
  return trimmed.toUpperCase().startsWith(prefix.toUpperCase()) ? `${tag} - ${trimmed.slice(prefix.length).trim()}` : `${prefix}${trimmed}`;
}

/** Jedna budova v samostatné transakci (zpětná kompatibilita a testy). */
export function saveStudioBuilding(prisma: PrismaClient, draft: StudioDraft) {
  return prisma.$transaction((tx) => saveBuildingInTx(tx, draft), { timeout: 60_000 });
}

/**
 * Celý koncept Studia v JEDNÉ transakci: první budova případně založí nový závod a změní rozměr areálu,
 * další budovy se uloží do stejného závodu. Chyba u kterékoli budovy vrátí vše zpět.
 */
export async function saveStudioConcept(prisma: PrismaClient, concept: StudioConceptDraft) {
  if (!concept.buildings.length) fail("Koncept neobsahuje žádnou budovu.");
  return prisma.$transaction(
    async (tx) => {
      const results = [];
      let plantId = concept.plantId;
      for (const [index, building] of concept.buildings.entries()) {
        const result = await saveBuildingInTx(tx, { ...building, plantId, newPlant: index === 0 ? concept.newPlant : null, campus: concept.campus });
        plantId = result.plantId;
        results.push(result);
      }
      return results;
    },
    { timeout: 120_000 },
  );
}

async function saveBuildingInTx(prisma: Tx, draft: StudioDraft) {
  const grid: GridSpec = clampGrid(draft.grid);
  const frame = planFrame(grid);
  const campus: CampusSize | null = draft.campus ? { width: Math.round(draft.campus.widthM), height: Math.round(draft.campus.depthM) } : null;
  if (campus && !campusSizeValid(campus)) fail("Rozměr areálu: 50–2000 m v ose X i Y.");
  // Nový závod od nuly: ověřit hned, založit až v transakci spolu s budovou.
  const newPlant = draft.newPlant ? await preparePlant(prisma, { ...draft.newPlant, widthM: campus?.width, depthM: campus?.height }) : null;
  if (newPlant && draft.building.mode !== "new") fail("Nový závod začíná novou budovou.");
  const plant = newPlant
    ? { id: "", campusWidthM: newPlant.campusWidthM, campusDepthM: newPlant.campusDepthM }
    : await prisma.plant.findUnique({ where: { id: draft.plantId }, select: { id: true, campusWidthM: true, campusDepthM: true } });
  if (!plant) throw new WorkflowError("NOT_FOUND", "Závod nebyl nalezen.");

  // Změna rozměru stávajícího areálu: budovy si ponechají polohu v metrech a nesmí vypadnout z areálu.
  const oldCampus: CampusSize = { width: plant.campusWidthM, height: plant.campusDepthM };
  const resizeCampus = !newPlant && campus && (campus.width !== oldCampus.width || campus.height !== oldCampus.height) ? campus : null;
  const rescaled: { id: string; mapPolygon: string; labelX: number; labelY: number }[] = [];
  if (resizeCampus) {
    const buildings = await prisma.building.findMany({ where: { plantId: plant.id }, select: { id: true, name: true, mapPolygon: true, labelX: true, labelY: true } });
    for (const building of buildings) {
      const mapPolygon = rescalePolygon(building.mapPolygon, oldCampus, resizeCampus);
      if (!rectInsideCampus(polygonBounds(mapPolygon))) fail(`Budova ${building.name} by po změně rozměru ležela mimo areál ${resizeCampus.width} × ${resizeCampus.height} m.`);
      rescaled.push({
        id: building.id,
        mapPolygon,
        labelX: round1((building.labelX * oldCampus.width) / resizeCampus.width),
        labelY: round1((building.labelY * oldCampus.height) / resizeCampus.height),
      });
    }
  }

  // Existující budova a patra
  const existingBuilding =
    draft.building.mode === "existing"
      ? await prisma.building.findFirst({
          where: { id: draft.building.id, plantId: plant.id },
          include: { floors: { select: { id: true, level: true, code: true, name: true, floorplanSvg: true, studioLayoutJson: true } } },
        })
      : null;
  if (draft.building.mode === "existing" && !existingBuilding) throw new WorkflowError("NOT_FOUND", "Budova nebyla nalezena.");
  if (draft.building.mode === "new") {
    const { code, name, map } = draft.building;
    if (!/^[A-Z0-9]{1,4}$/i.test(code.trim())) fail("Kód budovy: 1–4 písmena nebo číslice (např. C).");
    if (name.trim().length < 3) fail("Zadejte název budovy.");
    if (!rectInsideCampus(map)) fail("Budova leží mimo areál – posuňte ji na mapě dovnitř pozemku.");
    if (!newPlant && (await prisma.building.findFirst({ where: { plantId: plant.id, code: code.trim().toUpperCase() }, select: { id: true } }))) {
      fail(`Budova s kódem ${code.trim().toUpperCase()} v závodě už existuje.`);
    }
  }
  // Přesun / změna velikosti stávající budovy v areálu
  const movedMap = draft.building.mode === "existing" ? (draft.building.map ?? null) : null;
  if (movedMap && !rectInsideCampus(movedMap)) fail("Budova leží mimo areál – posuňte ji na mapě dovnitř pozemku.");
  const levels = new Set(existingBuilding?.floors.map((floor) => floor.level) ?? []);
  // Upravovaná stávající patra: jejich vlastní rastr (uložený v JSON, u starších pater ze SVG)
  const edited = new Map<string, { grid: GridSpec; frame: PlanFrame }>();
  for (const floor of draft.floors) {
    if (floor.existingId) {
      const current = existingBuilding?.floors.find((entry) => entry.id === floor.existingId);
      if (!current) fail("Upravované patro do budovy nepatří.");
      if (edited.has(floor.existingId)) fail(`Patro ${floorLabel(current!.level).short} je v konceptu dvakrát.`);
      const floorGrid = clampGrid(floor.grid ?? layoutOfFloor(current!).grid);
      edited.set(floor.existingId, { grid: floorGrid, frame: planFrame(floorGrid) });
    } else {
      if (levels.has(floor.level)) fail(`Patro ${floorLabel(floor.level).short} už v budově existuje.`);
      levels.add(floor.level);
    }
    const floorFrame = floor.existingId ? edited.get(floor.existingId)!.frame : frame;
    for (const zone of floor.zones) {
      if (!zoneFits(zone, floorFrame)) fail(`${zone.name || "Místnost"}: přesahuje obvod patra ${floorLabel(floor.level).short} (${fmtM(floorFrame.widthM)} × ${fmtM(floorFrame.depthM)} m).`);
    }
  }
  const newFloors = draft.floors.filter((floor) => !floor.existingId);
  if (!existingBuilding && newFloors.length === 0) fail("Přidejte alespoň jedno patro.");
  /** Rám, ve kterém se ukládá pin zařízení na stávajícím patře (po úpravě nový rastr, jinak uložený). */
  const existingFrame = (floorId: string) => {
    const current = existingBuilding?.floors.find((entry) => entry.id === floorId);
    return edited.get(floorId)?.frame ?? (current ? frameOfFloor(current) : EXISTING_FLOOR_FRAME);
  };

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
  const occupied = new Map<string, string>();

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
    const itemFrame = item.floor.kind === "draft" ? frame : existingFrame(item.floor.id);
    if (!insideFrame(itemFrame, item.pos)) fail(`${item.tag}: poloha X ${fmtM(item.pos.x)} m, Y ${fmtM(item.pos.y)} m leží mimo půdorys.`);
    // Pevná zařízení v jemném rastru: jeden bod = jedno zařízení (spotřebiče a nářadí se řadí v místnosti).
    if (placementOf(item.type) === "grid") {
      const spot = `${floorKey}@${item.pos.x}:${item.pos.y}`;
      if (occupied.has(spot)) fail(`${item.tag}: bod je už obsazen zařízením ${occupied.get(spot)}.`);
      occupied.set(spot, item.tag);
    }
  }
  // Přejmenování stávajících pater upravované budovy
  const renames = (draft.floorRenames ?? []).filter((entry) => {
    const current = existingBuilding?.floors.find((floor) => floor.id === entry.id);
    if (!current) fail("Přejmenované patro do budovy nepatří.");
    return floorName(current!.level, entry.usage) !== current!.name;
  });
  // Úpravy stávajících zařízení (krok 3 „Upravit stávající“): jen zařízení této budovy, platné napájení
  const edits = draft.equipmentEdits ?? [];
  if (edits.length) {
    const rows = await prisma.equipment.findMany({ where: { id: { in: edits.map((edit) => edit.id) }, floorId: { in: [...existingFloorIds] } }, select: { id: true, floorId: true, type: true } });
    for (const edit of edits) {
      const row = rows.find((entry) => entry.id === edit.id);
      if (!row) fail("Upravované zařízení do budovy nepatří.");
      if (!edit.tag.trim()) fail("Zařízení musí mít označení (tag).");
      if (edit.parentId === edit.id) fail(`${edit.tag}: zařízení nemůže napájet samo sebe.`);
      if (edit.parentId && !sources.some((source) => source.id === edit.parentId)) fail(`${edit.tag}: nadřazený rozváděč neexistuje.`);
      if (edit.pos && !insideFrame(existingFrame(row!.floorId), edit.pos)) fail(`${edit.tag}: poloha X ${fmtM(edit.pos.x)} m, Y ${fmtM(edit.pos.y)} m leží mimo půdorys.`);
      const sameFloor = await prisma.equipment.findFirst({ where: { floorId: row!.floorId, tag: edit.tag.trim().toUpperCase(), NOT: { id: { in: [edit.id, ...(draft.equipmentDeletes ?? [])] } } }, select: { id: true } });
      if (sameFloor) fail(`${edit.tag}: na patře už zařízení s tímto označením je.`);
    }
  }
  // Mazání uložených zařízení (Studio „Smazat“ / „−“): jen v této budově, bez otevřeného požadavku
  // na změnu a bez zařízení, která z něj dál napájí (ta se musí nejdřív přepojit nebo smazat také).
  const deletes = [...new Set(draft.equipmentDeletes ?? [])];
  const deleted = new Set(deletes);
  if (deletes.length) {
    const rows = await prisma.equipment.findMany({
      where: { id: { in: deletes }, floorId: { in: [...existingFloorIds] } },
      select: { id: true, tag: true, changeRequests: { where: { status: { in: [...OPEN_STATUSES] } }, select: { number: true }, take: 1 }, feeds: { select: { id: true, tag: true } } },
    });
    for (const id of deletes) {
      const row = rows.find((entry) => entry.id === id);
      if (!row) fail("Mazané zařízení do budovy nepatří.");
      if (row!.changeRequests.length) fail(`${row!.tag}: má otevřený požadavek na změnu ${row!.changeRequests[0].number} – nejdřív ho uzavřete.`);
      const fed = row!.feeds.filter((child) => !deleted.has(child.id) && !edits.some((edit) => edit.id === child.id && edit.parentId !== id));
      if (fed.length) fail(`${row!.tag}: napájí ${fed.map((child) => child.tag).join(", ")} – nejdřív je přepojte nebo smažte také.`);
    }
    for (const item of draft.equipment) if (item.parent?.kind === "existing" && deleted.has(item.parent.id)) fail(`${item.tag}: nadřazený rozváděč se maže.`);
    for (const edit of edits) if (edit.parentId && deleted.has(edit.parentId) && !deleted.has(edit.id)) fail(`${edit.tag}: nadřazený rozváděč se maže.`);
  }
  if (draft.equipment.some((item) => item.floor.kind === "existing")) {
    const taken = await prisma.equipment.findMany({ where: { floorId: { in: [...existingFloorIds] } }, select: { id: true, floorId: true, tag: true } });
    for (const row of taken) if (!deleted.has(row.id) && tagsByFloor.get(row.floorId)?.has(row.tag.toUpperCase())) fail(`${row.tag}: na patře už zařízení s tímto označením je.`);
  }

  const tx = prisma;
  {
    if (newPlant) {
      const viewBox = campusViewBox({ width: newPlant.campusWidthM, height: newPlant.campusDepthM });
      plant.id = (await tx.plant.create({ data: { ...newPlant, campusViewBoxW: viewBox.width, campusViewBoxH: viewBox.height }, select: { id: true } })).id;
    }
    if (resizeCampus) {
      const viewBox = campusViewBox(resizeCampus);
      await tx.plant.update({
        where: { id: plant.id },
        data: { campusWidthM: resizeCampus.width, campusDepthM: resizeCampus.height, campusViewBoxW: viewBox.width, campusViewBoxH: viewBox.height },
      });
      for (const building of rescaled) await tx.building.update({ where: { id: building.id }, data: { mapPolygon: building.mapPolygon, labelX: building.labelX, labelY: building.labelY } });
    }
    let buildingId = existingBuilding?.id;
    if (existingBuilding && movedMap) {
      await tx.building.update({ where: { id: existingBuilding.id }, data: { mapPolygon: rectPolygon(movedMap), labelX: round1(movedMap.x + movedMap.w / 2), labelY: round1(movedMap.y + movedMap.h / 2) } });
    }
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
          description: `Navrženo ve Studiu výstavby závodu (rastr ${grid.cols} × ${grid.rows}, rozteč ${fmtM(grid.stepMeters)} m, ${fmtM(frame.widthM)} × ${fmtM(frame.depthM)} m).`,
          mapPolygon: rectPolygon(map),
          labelX: round1(map.x + map.w / 2),
          labelY: round1(map.y + map.h / 2),
          sortOrder: (last?.sortOrder ?? 0) + 1,
        },
      });
      buildingId = created.id;
    }

    const floorIds = new Map<string, string>();
    for (const floor of newFloors) {
      const name = floorName(floor.level, floor.usage);
      const created = await tx.floor.create({
        data: {
          buildingId: buildingId!,
          level: floor.level,
          code: floorLabel(floor.level).code,
          name,
          description: floor.usage.trim() || null,
          floorplanSvg: renderGridFloorplanSvg({ floorName: name, spec: grid, zones: floor.zones, gates: floor.gates }),
          studioLayoutJson: serializeLayout({ grid, zones: floor.zones, gates: floor.gates }),
        },
      });
      floorIds.set(floor.key, created.id);
    }

    // Úprava rozvržení stávajících pater: nový půdorys + JSON; piny zařízení se přepočítají přes metry
    // ze starého rámu do nového, takže zůstanou na stejném místě v hale.
    let editedFloors = 0;
    for (const floor of draft.floors) {
      if (!floor.existingId) continue;
      const current = existingBuilding!.floors.find((entry) => entry.id === floor.existingId)!;
      const target = edited.get(floor.existingId)!;
      const oldFrame = frameOfFloor(current);
      await tx.floor.update({
        where: { id: current.id },
        data: {
          floorplanSvg: renderGridFloorplanSvg({ floorName: current.name, spec: target.grid, zones: floor.zones, gates: floor.gates }),
          studioLayoutJson: serializeLayout({ grid: target.grid, zones: floor.zones, gates: floor.gates }),
        },
      });
      const pins = await tx.equipment.findMany({ where: { floorId: current.id }, select: { id: true, pinX: true, pinY: true } });
      for (const pin of pins) {
        const meters = pxToMeters(oldFrame, { x: (pin.pinX / 100) * FLOOR_VIEWBOX.width, y: (pin.pinY / 100) * FLOOR_VIEWBOX.height });
        await tx.equipment.update({ where: { id: pin.id }, data: metersToPercent(target.frame, meters) });
      }
      editedFloors++;
    }

    const equipmentIds = new Map<string, string>();
    // Fáze 66: lhůty nových zařízení podle účelu objektu (NV 190/2022 Sb., příloha č. 4)
    const buildingType =
      draft.building.mode === "new" ? draft.building.type : ((await tx.building.findUnique({ where: { id: buildingId! }, select: { type: true } }))?.type ?? null);
    for (const item of draft.equipment) {
      const floorId = item.floor.kind === "draft" ? floorIds.get(item.floor.key)! : item.floor.id;
      const pin = metersToPercent(item.floor.kind === "draft" ? frame : existingFrame(item.floor.id), item.pos);
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
          inspectionIntervalMonths: inspectionRuleFor({
            type: item.type,
            usageGroup: isPortable(item.type) ? "C" : null,
            protectionClass: isPortable(item.type) ? "I" : null,
            // Fáze 66: účel objektu podle typu budovy (NV 190/2022 Sb., příloha č. 4)
            buildingType,
          }).months,
          description: "Osazeno ve Studiu výstavby závodu.",
          qrToken: newQrToken(),
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

    for (const entry of renames) {
      const current = existingBuilding!.floors.find((floor) => floor.id === entry.id)!;
      await tx.floor.update({ where: { id: entry.id }, data: { name: floorName(current.level, entry.usage), description: entry.usage.trim() || null } });
    }
    for (const edit of edits) {
      if (deleted.has(edit.id)) continue;
      const tag = edit.tag.trim().toUpperCase();
      const row = edit.pos ? await tx.equipment.findUnique({ where: { id: edit.id }, select: { floorId: true } }) : null;
      await tx.equipment.update({
        where: { id: edit.id },
        data: {
          tag,
          name: withTag(tag, edit.name),
          fedFromEquipmentId: edit.parentId,
          fedFromCircuit: edit.parentId ? edit.circuit?.trim() || null : null,
          assignedZone: edit.zone?.trim() || null,
          ...(edit.pos && row ? metersToPercent(existingFrame(row.floorId), edit.pos) : {}),
        },
      });
    }
    // Smazání uložených zařízení (kaskádově i jejich historie revizí, dokumentů a požadavků)
    const deletedFloors = deletes.length ? (await tx.equipment.findMany({ where: { id: { in: deletes } }, select: { floorId: true } })).map((row) => row.floorId) : [];
    if (deletes.length) await tx.equipment.deleteMany({ where: { id: { in: deletes } } });

    // Seskupené štítky spotřebičů a nářadí v místnostech („☕ 2× Kávovar“) v uloženém půdorysu
    // všech pater, kterých se koncept dotkl (nová, upravená, s novým nebo upraveným zařízením).
    const touched = new Set<string>([
      ...floorIds.values(),
      ...edited.keys(),
      ...draft.equipment.flatMap((item) => (item.floor.kind === "existing" ? [item.floor.id] : [])),
      ...(edits.length ? (await tx.equipment.findMany({ where: { id: { in: edits.filter((edit) => !deleted.has(edit.id)).map((edit) => edit.id) } }, select: { floorId: true } })).map((row) => row.floorId) : []),
      ...deletedFloors,
    ]);
    if (touched.size) {
      const menu = parseStudioMenu((await tx.tenantSetting.findUnique({ where: { key: STUDIO_MENU_KEY }, select: { value: true } }))?.value);
      const templates = menu ? allMenuTemplates(menu) : [];
      for (const floorId of touched) await refreshFloorInventory(tx, floorId, templates);
    }

    // Přesměrování: patro prvního osazeného zařízení, jinak nové 1. NP, jinak první nové patro.
    const first = draft.equipment[0]?.floor;
    const firstFloorId =
      (first ? (first.kind === "draft" ? floorIds.get(first.key) : first.id) : undefined) ??
      floorIds.get(draft.floors.find((floor) => floor.level === 0)?.key ?? "") ??
      floorIds.values().next().value ??
      draft.floors.find((floor) => floor.existingId)?.existingId ??
      existingBuilding?.floors[0]?.id;
    return {
      plantId: plant.id,
      plantCreated: Boolean(newPlant),
      campusResized: Boolean(resizeCampus),
      buildingId: buildingId!,
      firstFloorId: firstFloorId ?? null,
      floors: floorIds.size,
      editedFloors,
      renamedFloors: renames.length,
      editedEquipment: edits.length,
      deletedEquipment: deletes.length,
      equipment: equipmentIds.size,
    };
  }
}

/**
 * Překreslí uložený půdorys patra ze Studia (JSON rozvržení) se seskupenými štítky inventáře místností.
 * Starší patra bez JSON (půdorys jen jako SVG) se nemění.
 */
export async function refreshFloorInventory(prisma: Tx, floorId: string, templates: Parameters<typeof renderGridFloorplanSvg>[0]["templates"] = []) {
  const floor = await prisma.floor.findUnique({ where: { id: floorId }, select: { name: true, studioLayoutJson: true } });
  const layout = parseLayout(floor?.studioLayoutJson);
  if (!floor || !layout) return false;
  const frame = planFrame(layout.grid);
  const rows = await prisma.equipment.findMany({ where: { floorId }, select: { tag: true, name: true, type: true, pinX: true, pinY: true } });
  const roomItems = rows
    .filter((row) => placementOf(row.type) === "room")
    .map((row) => ({ tag: row.tag, name: row.name, type: row.type, pos: pxToMeters(frame, { x: (row.pinX / 100) * FLOOR_VIEWBOX.width, y: (row.pinY / 100) * FLOOR_VIEWBOX.height }) }));
  await prisma.floor.update({
    where: { id: floorId },
    data: { floorplanSvg: renderGridFloorplanSvg({ floorName: floor.name, spec: layout.grid, zones: layout.zones, gates: layout.gates, roomItems, templates }) },
  });
  return true;
}

/** Vlastní nabídka kroku 3 Studia (nastavení tenantu); bez úprav `null`. */
export async function getStudioMenu(prisma: PrismaClient): Promise<StudioMenu | null> {
  return parseStudioMenu((await prisma.tenantSetting.findUnique({ where: { key: STUDIO_MENU_KEY }, select: { value: true } }))?.value);
}

/** Uloží nabídku kroku 3 pro celý tenant; starší verze (podle `updatedAt`) nepřepíše novější. */
export async function saveStudioMenu(prisma: PrismaClient, menu: StudioMenu, actorId: string | null): Promise<StudioMenu> {
  const current = await getStudioMenu(prisma);
  if (current && current.updatedAt > menu.updatedAt) return current;
  const value = JSON.stringify(normalizeMenu(menu));
  if (value.length > 60_000) throw new WorkflowError("VALIDATION", "Nabídka je příliš velká – smažte nepoužívané dlaždice.");
  await prisma.tenantSetting.upsert({ where: { key: STUDIO_MENU_KEY }, create: { key: STUDIO_MENU_KEY, value, updatedById: actorId }, update: { value, updatedById: actorId } });
  return normalizeMenu(menu);
}
