// Fáze 111: 🛡️ Hlídač revizí & Správa spotřebičů a zařízení – přehled budov, pater, místností a spotřebičů s lhůtou
// revize, rychlé nakreslení budovy s patry a místnostmi (Studio), osazení spotřebiče z palety na 1 klik a režim objektu
// (administrativa / výroba). Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import type { EquipmentType } from "@/generated/prisma/enums";
import { metersToPercent } from "@/lib/cad-grid";
import { deviceCapacityLeft, deviceEntitlement, deviceLimitMessage, type DeviceEntitlement } from "@/lib/credits";
import { TESTER_COMPANY } from "@/lib/registered-company";
import { findFreeSpot, polygonBounds } from "@/lib/campus-layout";
import { HLIDAC_MODES, HLIDAC_MODE_KEY, buildingGrid, devicePosition, isHlidacMode, nextBuildingCode, paletteDevice, roomZones, type HlidacMode } from "@/lib/hlidac";
import { summarizeInspections } from "@/lib/inspection";
import { inspectionRuleFor, ruleInputFrom } from "@/lib/inspection-rules";
import { newQrToken } from "@/lib/qr-label";
import { nextTag } from "@/lib/studio-autopilot";
import { frameOfFloor, layoutOfFloor } from "@/lib/studio-layout";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { refreshFloorInventory, saveStudioConcept } from "./studio";

/** Režim objektu závodu: uložený, jinak podle budov (výroba / montáž / sklad = výrobní závod). */
export async function getHlidacMode(prisma: PrismaClient, plantId: string): Promise<HlidacMode> {
  const stored = await prisma.tenantSetting.findUnique({ where: { key: HLIDAC_MODE_KEY(plantId) }, select: { value: true } });
  if (stored && isHlidacMode(stored.value)) return stored.value;
  const industrial = await prisma.building.count({ where: { plantId, type: { in: ["PRODUCTION", "ASSEMBLY", "WAREHOUSE"] } } });
  return industrial ? "FACTORY" : "OFFICE";
}

export async function setHlidacMode(prisma: PrismaClient, plantId: string, mode: HlidacMode, userId: string | null) {
  if (!isHlidacMode(mode)) throw new WorkflowError("VALIDATION", "Neznámý režim objektu.");
  await prisma.tenantSetting.upsert({ where: { key: HLIDAC_MODE_KEY(plantId) }, create: { key: HLIDAC_MODE_KEY(plantId), value: mode, updatedById: userId }, update: { value: mode, updatedById: userId } });
  return mode;
}

export interface HlidacDevice {
  id: string;
  tag: string;
  name: string;
  type: string;
  protectionClass: string | null;
  usageGroup: string | null;
  serialNumber: string | null;
  hasNameplate: boolean;
  intervalMonths: number;
  validUntil: string | null;
  state: string;
}

/** Budovy → patra → místnosti se spotřebiči a stavem revize (zařízení bez místnosti zvlášť). */
export async function hlidacOverview(prisma: PrismaClient, plantId: string, now = new Date()) {
  const buildings = await prisma.building.findMany({
    where: { plantId },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
      floors: {
        orderBy: { level: "asc" },
        select: {
          id: true,
          name: true,
          level: true,
          studioLayoutJson: true,
          floorplanSvg: true,
          equipment: {
            orderBy: { tag: "asc" },
            select: { id: true, tag: true, name: true, type: true, assignedZone: true, protectionClass: true, usageGroup: true, serialNumber: true, nameplatePhotoUrl: true, inspectionIntervalMonths: true, inspections: { where: { misuseFlaggedAt: null }, select: { type: true, inspectionDate: true, validUntil: true, result: true } } },
          },
        },
      },
    },
  });
  const device = (row: (typeof buildings)[number]["floors"][number]["equipment"][number]): HlidacDevice => {
    const summary = summarizeInspections(row.inspections, now);
    return { id: row.id, tag: row.tag, name: row.name, type: row.type, protectionClass: row.protectionClass, usageGroup: row.usageGroup, serialNumber: row.serialNumber, hasNameplate: Boolean(row.nameplatePhotoUrl), intervalMonths: row.inspectionIntervalMonths, validUntil: summary.validUntil?.toISOString() ?? null, state: summary.state };
  };
  return buildings.map((building) => ({
    id: building.id,
    code: building.code,
    name: building.name,
    type: building.type,
    floors: building.floors.map((floor) => {
      const zones = layoutOfFloor(floor).zones;
      const names = new Set(zones.map((zone) => zone.name));
      return {
        id: floor.id,
        name: floor.name,
        level: floor.level,
        rooms: zones.map((zone) => ({ key: zone.key, name: zone.name, kind: zone.kind, devices: floor.equipment.filter((row) => row.assignedZone === zone.name).map(device) })),
        unassigned: floor.equipment.filter((row) => !row.assignedZone || !names.has(row.assignedZone)).map(device),
      };
    }),
  }));
}

export type HlidacOverview = Awaited<ReturnType<typeof hlidacOverview>>;

export interface HlidacBuildingInput {
  plantId: string;
  mode: HlidacMode;
  name: string;
  floors: { usage: string; rooms: string[] }[];
}

/**
 * Rychlé nakreslení budovy: patra (1. NP, 2. NP …) s místnostmi 6 × 5 m z jejich názvů – uloží Studio v jedné transakci
 * (budova na volném místě areálu, půdorysy pater s místnostmi).
 */
export async function createHlidacBuilding(prisma: PrismaClient, input: HlidacBuildingInput) {
  const name = input.name.trim();
  if (name.length < 3) throw new WorkflowError("VALIDATION", "Zadejte název budovy (aspoň 3 znaky).");
  const floors = input.floors.filter((floor) => floor.rooms.length).slice(0, 10);
  if (!floors.length) throw new WorkflowError("VALIDATION", "Přidejte aspoň jedno patro s místností.");
  const plant = await prisma.plant.findUnique({ where: { id: input.plantId }, select: { id: true, buildings: { select: { code: true, mapPolygon: true } } } });
  if (!plant) throw new WorkflowError("NOT_FOUND", "Závod nebyl nalezen.");
  const code = nextBuildingCode(plant.buildings.map((building) => building.code));
  const map = findFreeSpot({ w: 16, h: 14 }, plant.buildings.map((building) => polygonBounds(building.mapPolygon)));
  const grid = buildingGrid(floors.map((floor) => floor.rooms.length));
  const [result] = await saveStudioConcept(prisma, {
    plantId: plant.id,
    buildings: [
      {
        grid,
        building: { mode: "new", code, name: name.slice(0, 80), type: HLIDAC_MODES[input.mode].buildingType, map },
        floors: floors.map((floor, level) => ({ key: `f${level}`, level, usage: floor.usage.trim().slice(0, 40), zones: roomZones(floor.rooms), gates: [] })),
        equipment: [],
      },
    ],
  });
  return { buildingId: result.buildingId, code, floors: result.floors };
}

/**
 * Spotřebič z palety na 1 klik do místnosti: tag v řadě (SP-0001, NR-0001, PP-0001 …), skupina používání podle režimu
 * objektu (administrativa E, výroba C), třída ochrany a „držený v ruce“ podle druhu a lhůta revize z pravidla.
 */
export async function addHlidacDevice(prisma: PrismaClient, input: { floorId: string; room: string; itemId: string; mode: HlidacMode }) {
  const item = paletteDevice(input.itemId);
  if (!item) throw new WorkflowError("VALIDATION", "Neznámý spotřebič palety.");
  return createRoomDevice(prisma, { floorId: input.floorId, room: input.room, label: item.label, type: item.type, protectionClass: item.protectionClass, handHeld: item.handHeld, mode: input.mode });
}

export interface RoomDeviceInput {
  floorId: string;
  room: string;
  label: string;
  type: EquipmentType;
  protectionClass: "I" | "II" | "III" | null;
  handHeld: boolean;
  mode: HlidacMode;
  /** Fáze 112: výrobní číslo z importu / štítku a vlastní evidenční číslo (obsazené = další volné). */
  serialNumber?: string | null;
  tag?: string | null;
}

/**
 * Spotřebič / zařízení v místnosti patra: evidenční číslo budovy, skupina používání podle režimu objektu, lhůta podle
 * ČSN 33 1600 ed. 2 / ČSN 33 1500 a pin v místnosti (paleta Hlídače revizí, import revizních dat, sekvenční sběr).
 */
/** Fáze 113: překročený limit zařízení tarifu – snímek Scan & Snap zůstane ve frontě (HTTP 402), nic se nezahodí. */
export class DeviceLimitError extends WorkflowError {
  constructor(message: string) {
    super("FORBIDDEN", message);
  }
}

/** Fáze 113: limit zařízení závodu podle tarifu firmy závodu (⭐ neomezený přístup, tarif, zkušební limit). */
export async function plantDeviceEntitlement(prisma: PrismaClient, plantId: string, now = new Date()): Promise<DeviceEntitlement> {
  const [companies, used] = await Promise.all([
    prisma.registeredCompany.findMany({ where: { plantId, closedAt: null }, select: { id: true, unlimitedAccess: true, subscriptionPlan: true, subscriptionUntil: true } }),
    prisma.equipment.count({ where: { floor: { building: { plantId } } } }),
  ]);
  return deviceEntitlement(companies, used, now, [TESTER_COMPANY.id]);
}

/** Fáze 113: vejde se `adding` nových zařízení do limitu tarifu? Jinak `DeviceLimitError` s nabídkou tarifu. */
export async function assertDeviceCapacity(prisma: PrismaClient, plantId: string, adding = 1) {
  const entitlement = await plantDeviceEntitlement(prisma, plantId);
  if (deviceCapacityLeft(entitlement) < adding) throw new DeviceLimitError(deviceLimitMessage(entitlement));
}

export async function createRoomDevice(prisma: PrismaClient, input: RoomDeviceInput) {
  const floor = await prisma.floor.findUnique({ where: { id: input.floorId }, select: { id: true, name: true, studioLayoutJson: true, floorplanSvg: true, building: { select: { id: true, code: true, plantId: true, type: true, name: true } } } });
  if (!floor) throw new WorkflowError("NOT_FOUND", "Patro nebylo nalezeno.");
  // Fáze 113: nové zařízení jen do limitu tarifu závodu (zkušební limit / REVIZE & BUDOVY / PRŮMYSL & ENTERPRISE)
  await assertDeviceCapacity(prisma, floor.building.plantId);
  const zone = layoutOfFloor(floor).zones.find((candidate) => candidate.key === input.room || candidate.name === input.room);
  if (!zone) throw new WorkflowError("NOT_FOUND", "Místnost nebyla nalezena.");
  const [inRoom, tags] = await Promise.all([
    prisma.equipment.count({ where: { floorId: floor.id, assignedZone: zone.name } }),
    prisma.equipment.findMany({ where: { floor: { building: { plantId: floor.building.plantId } } }, select: { tag: true } }),
  ]);
  const taken = new Set(tags.map((row) => row.tag.toUpperCase()));
  const own = input.tag?.trim().toUpperCase();
  const tag = own && /^[A-Z0-9][A-Z0-9-]{0,23}$/.test(own) && !taken.has(own) ? own : nextTag(input.type, { buildingCode: floor.building.code, tags: tags.map((row) => row.tag) });
  const usageGroup = HLIDAC_MODES[input.mode].usageGroup;
  const rule = inspectionRuleFor(ruleInputFrom({ type: input.type, usageGroup, protectionClass: input.protectionClass, handHeld: input.handHeld }, floor.building));
  const pin = metersToPercent(frameOfFloor(floor), devicePosition(zone, inRoom));
  const created = await prisma.equipment.create({
    data: {
      floorId: floor.id,
      tag,
      name: `${tag} - ${input.label}`.slice(0, 160),
      type: input.type,
      usageGroup: ["APPLIANCE", "POWER_TOOL", "EXTENSION_CORD", "WELDER"].includes(input.type) ? usageGroup : null,
      protectionClass: input.protectionClass,
      handHeld: input.handHeld,
      assignedZone: zone.name,
      pinX: pin.pinX,
      pinY: pin.pinY,
      inspectionIntervalMonths: rule.months,
      qrToken: newQrToken(),
      ...(input.serialNumber?.trim() ? { serialNumber: input.serialNumber.trim().slice(0, 80) } : {}),
    },
    select: { id: true, tag: true, name: true, inspectionIntervalMonths: true },
  });
  // Štítky inventáře místností v půdorysu patra (Studio)
  await refreshFloorInventory(prisma, floor.id).catch(() => false);
  return created;
}
