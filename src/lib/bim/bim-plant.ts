// Fáze 95: BIM model (IFC) → koncept Studia výstavby závodu: budova s přesným rozměrem (rastr v metrech), podlaží
// z IfcBuildingStorey, místnosti z IfcSpace (obálka v metrech od osy A1, sever nahoru), zdroje (trafostanice, DA, UPS),
// rozváděče a stroje v přesných souřadnicích s hierarchií napájení z BIMu, úrovní zálohování a údaji z property setů
// (In, U, IP, příkon, přívodní kabel s délkou). Čisté funkce – uloží je služba přes `saveStudioConcept`.

import type { EquipmentType } from "@/generated/prisma/enums";
import { gridFromMeters, type GridZone, type ZoneKind } from "../cad-grid";
import { suggestCircuit } from "../power-hierarchy";
import { nextBuildingCode } from "../plant-onboarding";
import { polygonBounds } from "../campus-layout";
import type { StudioConceptDraft, StudioEquipmentDraft, StudioFloorDraft } from "../studio-draft";
import type { BimPlantPayload } from "./bim-payload";

type BimElectricalElement = BimPlantPayload["electrical"][number];

export interface BimEquipmentDetails {
  bimGuid: string;
  ratedCurrent: string | null;
  ratedVoltage: string | null;
  ipRating: string | null;
  ratedPowerKw: number | null;
  nominalCurrentA: number | null;
  feederCableType: string | null;
  feederLengthM: number | null;
  backupCapacityKva: number | null;
  description: string;
}

export interface BimPlantOptions {
  plantId: string;
  /** Rozměr areálu [m] a obrysy stávajících budov (procenta mapy) – volné místo pro novou budovu. */
  campus: { widthM: number; depthM: number };
  existingCodes: readonly string[];
  existingPolygons: readonly string[];
}

export interface BimPlantPlan {
  concept: StudioConceptDraft;
  /** Doplňky zařízení podle klíče konceptu (zapíše služba po uložení konceptu). */
  details: Record<string, BimEquipmentDetails>;
  /** Prvky BIMu, které se do závodu neuložily, a proč. */
  skipped: string[];
  buildingCode: string;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Druh místnosti Studia podle názvu („Rozvodna VN/NN“ → elektro). */
export function zoneKindOf(name: string): ZoneKind {
  if (/rozvodn|trafo|elektro|rozvad|ups|baterio/i.test(name)) return "ELECTRICAL";
  if (/sklad|expedic|regál|regal/i.test(name)) return "STORAGE";
  if (/díln|diln|údržb|udrzb|servis/i.test(name) && !/velín|velin/i.test(name)) return "WORKSHOP";
  if (/kancel|velín|velin|admin|zased|šatn|satn|jídel|jidel/i.test(name)) return "OFFICE";
  if (/chodb|koridor|schod/i.test(name)) return "CORRIDOR";
  if (/kompres|strojovn|kotel|vzt|čerpac|cerpac|technick|chlazen/i.test(name)) return "FACILITIES";
  return "PRODUCTION";
}

/** Typ zařízení Správy závodů pro elektro prvek BIMu (null = do závodu se neukládá). */
export function equipmentTypeOf(element: BimElectricalElement): EquipmentType | null {
  switch (element.kind) {
    case "transformer":
    case "generator":
    case "ups":
      return "TRANSFORMER";
    case "board":
      return "SWITCHBOARD";
    case "machine":
      return element.machineKind === "cnc" ? "CNC_MACHINE" : element.machineKind === "compressor" ? "COMPRESSOR" : element.machineKind === "hvac" ? "HVAC_UNIT" : "MACHINE";
    default:
      return null;
  }
}

const SOURCE_NAME: Record<string, string> = { transformer: "Trafostanice", generator: "Dieselagregát", ups: "UPS" };

/** Čitelný název zařízení: popis z BIMu („Hlavní rozváděč 1000 A“), jinak název bez opakovaného označení. */
function nameOf(element: BimElectricalElement): string {
  const own = (element.description ?? "").trim() || element.name.trim();
  const withoutTag = own.toUpperCase() === element.tag.toUpperCase() ? "" : own;
  if (withoutTag) return withoutTag.slice(0, 80);
  if (element.kind in SOURCE_NAME) return `${SOURCE_NAME[element.kind]}${element.props.apparentPowerKva ? ` ${element.props.apparentPowerKva} kVA` : ""}`;
  return element.kind === "board" ? "Rozváděč" : "Stroj";
}

/** Volné místo pro budovu v areálu (procenta mapy) – mřížka kandidátů, první bez překryvu. */
function freeSpot(size: { w: number; h: number }, polygons: readonly string[]) {
  const taken = polygons.map((polygon) => polygonBounds(polygon));
  const overlaps = (a: { x: number; y: number; w: number; h: number }) => taken.some((b) => a.x < b.x + b.w + 2 && b.x < a.x + a.w + 2 && a.y < b.y + b.h + 2 && b.y < a.y + a.h + 2);
  for (let y = 4; y + size.h <= 96; y += 4) for (let x = 4; x + size.w <= 96; x += 4) if (!overlaps({ x, y, ...size })) return { x, y, ...size };
  return null;
}

/**
 * Koncept Studia z BIMu. Areál se zvětší, když se budova nevejde (nejvýš 2000 m); zařízení mimo rastr budovy, bez
 * napájecího rozváděče (stroj ze zdroje) nebo s opakovaným označením se upraví nebo přeskočí s vysvětlením.
 */
export function bimToPlantPlan(model: BimPlantPayload, options: BimPlantOptions): BimPlantPlan {
  const skipped: string[] = [];
  const { bounds } = model;
  const widthM = Math.max(6, Math.ceil(bounds.w));
  const depthM = Math.max(6, Math.ceil(bounds.h));
  const grid = gridFromMeters(widthM, depthM, 6, widthM > 150 || depthM > 150 ? "1:1000" : "1:500");
  // Areál: budova se musí vejít i s okrajem; jinak se areál zvětší
  let campus = options.campus;
  let size = { w: round1((widthM / campus.widthM) * 100), h: round1((depthM / campus.depthM) * 100) };
  let spot = size.w <= 92 && size.h <= 92 ? freeSpot(size, options.existingPolygons) : null;
  if (!spot) {
    campus = { widthM: Math.min(2000, Math.max(campus.widthM, Math.ceil(widthM * 1.6))), depthM: Math.min(2000, Math.max(campus.depthM, Math.ceil(depthM * 1.6))) };
    size = { w: round1((widthM / campus.widthM) * 100), h: round1((depthM / campus.depthM) * 100) };
    spot = freeSpot(size, options.existingPolygons.map((polygon) => polygon)) ?? { x: 4, y: 4, ...size };
  }
  const resized = campus.widthM !== options.campus.widthM || campus.depthM !== options.campus.depthM;
  const bimBuilding = model.buildings[0];
  const ownCode = bimBuilding && /^[A-Z0-9]{1,4}$/i.test(bimBuilding.name) && !options.existingCodes.some((code) => code.toUpperCase() === bimBuilding.name.toUpperCase()) ? bimBuilding.name.toUpperCase() : null;
  const buildingCode = ownCode ?? nextBuildingCode(options.existingCodes);
  const buildingName = (bimBuilding?.longName ?? bimBuilding?.name ?? model.project.name).slice(0, 80);

  // Podlaží: ±0 = podlaží nejblíž kótě 0, pod ním PP, nad ním NP
  const storeys = model.storeys.length ? model.storeys : [{ id: -1, guid: "", name: "1. NP", elevationM: 0, buildingId: null, longName: null }];
  const groundIndex = storeys.reduce((best, storey, index) => (Math.abs(storey.elevationM) < Math.abs(storeys[best].elevationM) ? index : best), 0);
  const floorKey = (storeyId: number | null) => `f${storeyId ?? storeys[groundIndex].id}`;
  const toX = (x: number) => Math.min(widthM, Math.max(0, round1(x - bounds.x)));
  const toY = (y: number) => Math.min(depthM, Math.max(0, round1(bounds.y + bounds.h - y)));
  const floors: StudioFloorDraft[] = storeys.map((storey, index) => {
    const zones: GridZone[] = model.spaces
      .filter((space) => space.storeyId === storey.id || (space.storeyId === null && index === groundIndex))
      .map((space) => {
        const x = toX(space.bounds.x);
        const y = toY(space.bounds.y + space.bounds.h);
        return { key: `s${space.id}`, x, y, w: Math.min(round1(space.bounds.w), round1(widthM - x)), h: Math.min(round1(space.bounds.h), round1(depthM - y)), name: space.name.slice(0, 60), kind: zoneKindOf(space.name) };
      })
      .filter((zone) => zone.w >= 1 && zone.h >= 1);
    const usage = (storey.longName && storey.longName !== storey.name ? storey.longName : "").replace(/^\d+\.\s*(nadzemní|podzemní)\s+podlaží$/i, "").slice(0, 60);
    return { key: floorKey(storey.id), level: index - groundIndex, usage, zones, gates: [] };
  });

  // Zařízení: zdroje, rozváděče, stroje
  const items = model.electrical.filter((element) => equipmentTypeOf(element));
  const byId = new Map(model.electrical.map((element) => [element.id, element]));
  const keyOf = (element: BimElectricalElement) => `b${element.id}`;
  const occupied = new Set<string>();
  const tags = new Map<string, Set<string>>();
  const equipment: StudioEquipmentDraft[] = [];
  const details: Record<string, BimEquipmentDetails> = {};
  const childrenCount = new Map<number, number>();
  const cables = new Map(model.cables.map((carrier) => [carrier.id, carrier]));
  const main = items.find((element) => element.kind === "board" && (element.fedById === null || ["transformer", "generator", "ups"].includes(byId.get(element.fedById)?.kind ?? ""))) ?? null;

  for (const element of items) {
    const type = equipmentTypeOf(element)!;
    const floor = floorKey(element.storeyId);
    // Jemný rastr 1 m; obsazený bod → nejbližší volný soused
    let pos = { x: Math.round(toX(element.position.x)), y: Math.round(toY(element.position.y)) };
    for (let ring = 0; ring < 6 && occupied.has(`${floor}@${pos.x}:${pos.y}`); ring++) {
      const candidates = [
        { x: pos.x + 1, y: pos.y },
        { x: pos.x, y: pos.y + 1 },
        { x: pos.x - 1, y: pos.y },
        { x: pos.x, y: pos.y - 1 },
      ].filter((p) => p.x >= 0 && p.y >= 0 && p.x <= widthM && p.y <= depthM && !occupied.has(`${floor}@${p.x}:${p.y}`));
      if (candidates.length) pos = candidates[0];
    }
    occupied.add(`${floor}@${pos.x}:${pos.y}`);
    const floorTags = tags.get(floor) ?? new Set<string>();
    let tag = element.tag.toUpperCase().replace(/[^A-Z0-9.-]/g, "-").replace(/^[^A-Z0-9]+/, "").slice(0, 24) || `BIM-${element.id}`;
    if (floorTags.has(tag)) {
      skipped.push(`${tag}: označení se na podlaží opakuje – uloženo jako ${tag}-${element.id}.`);
      tag = `${tag.slice(0, 16)}-${element.id}`.slice(0, 24);
    }
    floorTags.add(tag);
    tags.set(floor, floorTags);
    // Napájení: rozváděč napájí rozváděč i stroj; trafostanice / DA / UPS jen rozváděč
    const parentElement = element.fedById ? byId.get(element.fedById) : undefined;
    const parentType = parentElement ? equipmentTypeOf(parentElement) : null;
    let parent: StudioEquipmentDraft["parent"] = null;
    let note = "";
    if (type === "TRANSFORMER") {
      if (parentElement) note = ` Napájení podle BIMu: ${parentElement.tag}.`;
    } else if (parentElement && parentType && (type === "SWITCHBOARD" || parentType === "SWITCHBOARD")) {
      parent = { kind: "draft", key: keyOf(parentElement) };
    } else if (type !== "SWITCHBOARD") {
      // Stroj bez rozváděče (nebo přímo ze zdroje) – napájí ho hlavní rozváděč budovy
      if (main && main.id !== element.id) {
        parent = { kind: "draft", key: keyOf(main) };
        skipped.push(`${tag}: v BIMu bez napájecího rozváděče${parentElement ? ` (napájeno z ${parentElement.tag})` : ""} – přiřazen k ${main.tag}, ověřte vývod.`);
      } else {
        skipped.push(`${tag}: bez napájecího rozváděče – v BIMu chybí rozváděč, zařízení se neuložilo.`);
        continue;
      }
    }
    const parentId = parent?.kind === "draft" ? Number(parent.key.slice(1)) : null;
    const siblings = parentId !== null ? (childrenCount.get(parentId) ?? 0) : 0;
    if (parentId !== null) childrenCount.set(parentId, siblings + 1);
    const circuit = parent ? (element.props.circuit?.slice(0, 40) ?? suggestCircuit(type, { type: equipmentTypeOf(byId.get(parentId!)!)! }, siblings)) : null;
    const key = keyOf(element);
    equipment.push({
      key,
      floor: { kind: "draft", key: floor },
      pos,
      roomKey: null,
      tag,
      name: nameOf(element),
      type,
      parent,
      circuit,
      zone: element.spaceId ? (model.spaces.find((space) => space.id === element.spaceId)?.name.slice(0, 60) ?? null) : null,
      isRoot: type === "SWITCHBOARD" && !parent,
      ...(type === "SWITCHBOARD" || type === "TRANSFORMER" ? { powerBackupTier: element.backupTier } : {}),
    });
    // Přívodní kabel: kabel z BIMu (IfcCableSegment), jinak odhad po trase (pravoúhle + výškový rozdíl)
    const cable = element.feederCableId ? cables.get(element.feederCableId) : undefined;
    const estimate = parentElement ? round1(Math.abs(parentElement.position.x - element.position.x) + Math.abs(parentElement.position.y - element.position.y) + Math.abs(parentElement.position.z - element.position.z) + 2) : null;
    const powerKw = element.props.powerKw;
    const voltage = element.props.voltageV ?? (element.props.phases === 1 ? 230 : 400);
    const ib = element.props.nominalCurrentA && type !== "SWITCHBOARD" ? element.props.nominalCurrentA : powerKw && type !== "SWITCHBOARD" && type !== "TRANSFORMER" ? round1((powerKw * 1000) / (voltage >= 380 ? Math.sqrt(3) * voltage * 0.85 : voltage * 0.95)) : null;
    const facts = [
      element.props.nominalCurrentA ? `In ${element.props.nominalCurrentA} A` : null,
      powerKw ? `P ${powerKw.toLocaleString("cs-CZ")} kW` : null,
      element.props.apparentPowerKva ? `S ${element.props.apparentPowerKva.toLocaleString("cs-CZ")} kVA` : null,
      element.props.ipRating,
      cable ? `přívod ${cable.name} ${cable.lengthM.toLocaleString("cs-CZ")} m` : null,
    ].filter(Boolean);
    details[key] = {
      bimGuid: element.guid.slice(0, 40),
      ratedCurrent: element.props.nominalCurrentA ? `${element.props.nominalCurrentA} A` : null,
      ratedVoltage: element.props.voltageV ? `${element.props.voltageV} V AC / 50 Hz` : null,
      ipRating: element.props.ipRating,
      ratedPowerKw: powerKw ?? (type === "TRANSFORMER" ? null : null),
      nominalCurrentA: ib,
      feederCableType: cable?.cableType ?? element.props.cableType ?? null,
      feederLengthM: cable ? round1(cable.lengthM) : parent ? estimate : null,
      backupCapacityKva: element.kind === "generator" || element.kind === "ups" ? element.props.apparentPowerKva : null,
      description: `Importováno z BIM modelu (${model.schema || "IFC"}, GlobalId ${element.guid || "–"})${facts.length ? `: ${facts.join(", ")}` : ""}.${note}`.slice(0, 400),
    };
  }
  const carrierMeters = round1(model.trays.meters);
  if (carrierMeters) skipped.push(`Kabelové trasy a žlaby (${carrierMeters.toLocaleString("cs-CZ")} m) se do mapy závodu ukládají jako přívody zařízení s délkou kabelu – samostatná vrstva tras zatím není.`);

  return {
    buildingCode,
    skipped,
    details,
    concept: {
      plantId: options.plantId,
      campus: resized ? campus : null,
      buildings: [
        {
          grid,
          building: { mode: "new", code: buildingCode, name: buildingName.length >= 3 ? buildingName : `Hala ${buildingCode}`, type: "PRODUCTION", map: spot },
          floors,
          equipment,
        },
      ],
    },
  };
}
