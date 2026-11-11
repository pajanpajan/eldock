// Fáze 95: zmenšený BIM model pro import do Správy závodů (prohlížeč → Server Action). Soubor IFC se čte v prohlížeči
// (exporty z Revitu mají desítky MB); na server jde jen to, co závod potřebuje: podlaží, místnosti (obálka), zdroje,
// rozváděče, stroje a kabely s délkou. Server data znovu ověří schématem.

import { z } from "zod";

import type { BimModel } from "./ifc-parser";

const text = (max: number) => z.string().trim().max(max);
const num = z.number().finite();
const rect = z.object({ x: num, y: num, w: num.min(0), h: num.min(0) });
const point = z.object({ x: num, y: num, z: num });

export const bimPlantPayloadSchema = z.object({
  schema: text(20),
  project: z.object({ name: text(120), description: text(400).nullable() }),
  buildings: z.array(z.object({ id: z.number().int(), guid: text(40), name: text(120), longName: text(160).nullable() })).max(20),
  storeys: z.array(z.object({ id: z.number().int(), guid: text(40), name: text(80), longName: text(120).nullable(), elevationM: num, buildingId: z.number().int().nullable() })).max(60),
  spaces: z
    .array(z.object({ id: z.number().int(), guid: text(40), code: text(60), name: text(120), storeyId: z.number().int().nullable(), bounds: rect, areaM2: num.min(0), heightM: num.nullable() }))
    .max(5000),
  electrical: z
    .array(
      z.object({
        id: z.number().int(),
        guid: text(40),
        ifcType: text(60),
        kind: z.enum(["transformer", "generator", "ups", "board", "machine"]),
        machineKind: z.enum(["cnc", "press", "compressor", "hvac", "pump", "motor", "machine"]).nullable(),
        tag: text(40),
        name: text(160),
        description: text(240).nullable(),
        storeyId: z.number().int().nullable(),
        spaceId: z.number().int().nullable(),
        position: point,
        props: z.object({
          nominalCurrentA: num.nullable(),
          powerKw: num.nullable(),
          apparentPowerKva: num.nullable(),
          voltageV: num.nullable(),
          phases: z.union([z.literal(1), z.literal(3)]).nullable(),
          ipRating: text(12).nullable(),
          circuit: text(60).nullable(),
          panel: text(60).nullable(),
          cableType: text(80).nullable(),
        }),
        backupTier: z.enum(["GRID_STANDARD", "BACKUP_GENERATOR_DA", "CRITICAL_UPS_ZIS"]),
        fedById: z.number().int().nullable(),
        feederCableId: z.number().int().nullable(),
      }),
    )
    .max(5000),
  cables: z.array(z.object({ id: z.number().int(), name: text(160), lengthM: num.min(0), cableType: text(80).nullable() })).max(20000),
  trays: z.object({ count: z.number().int().min(0), meters: num.min(0) }),
  bounds: rect,
});

export type BimPlantPayload = z.infer<typeof bimPlantPayloadSchema>;

/** Zmenšený model pro import do závodu (bez stěn, otvorů, domovních přístrojů a geometrie tras). */
export function toPlantPayload(model: BimModel): BimPlantPayload {
  const kinds = new Set(["transformer", "generator", "ups", "board", "machine"]);
  const trays = model.carriers.filter((carrier) => carrier.kind !== "cable" && carrier.kind !== "fitting");
  // Kabely jen ty, které model přiřazuje jako přívod zařízení (délka a typ přívodu)
  const feeders = new Set(model.electrical.map((element) => element.feederCableId).filter((id): id is number => id !== null));
  return {
    schema: model.schema.slice(0, 20),
    project: { name: model.project.name.slice(0, 120), description: model.project.description?.slice(0, 400) ?? null },
    buildings: model.buildings.slice(0, 20).map((building) => ({ ...building, guid: building.guid.slice(0, 40), name: building.name.slice(0, 120), longName: building.longName?.slice(0, 160) ?? null })),
    storeys: model.storeys.slice(0, 60).map((storey) => ({ ...storey, guid: storey.guid.slice(0, 40), name: storey.name.slice(0, 80), longName: storey.longName?.slice(0, 120) ?? null })),
    spaces: model.spaces.slice(0, 2000).map((space) => ({ id: space.id, guid: space.guid.slice(0, 40), code: space.code.slice(0, 60), name: space.name.slice(0, 120), storeyId: space.storeyId, bounds: space.bounds, areaM2: space.areaM2, heightM: space.heightM })),
    electrical: model.electrical
      .filter((element) => kinds.has(element.kind))
      .slice(0, 2000)
      .map((element) => ({
        id: element.id,
        guid: element.guid.slice(0, 40),
        ifcType: element.ifcType.slice(0, 60),
        kind: element.kind as BimPlantPayload["electrical"][number]["kind"],
        machineKind: element.machineKind,
        tag: element.tag.slice(0, 40),
        name: element.name.slice(0, 160),
        description: element.description?.slice(0, 240) ?? null,
        storeyId: element.storeyId,
        spaceId: element.spaceId,
        position: element.position,
        props: { ...element.props, ipRating: element.props.ipRating?.slice(0, 12) ?? null, circuit: element.props.circuit?.slice(0, 60) ?? null, panel: element.props.panel?.slice(0, 60) ?? null, cableType: element.props.cableType?.slice(0, 80) ?? null },
        backupTier: element.backupTier,
        fedById: element.fedById,
        feederCableId: element.feederCableId,
      })),
    cables: model.carriers
      .filter((carrier) => carrier.kind === "cable" && feeders.has(carrier.id))
      .slice(0, 20000)
      .map((carrier) => ({ id: carrier.id, name: carrier.name.slice(0, 160), lengthM: carrier.lengthM, cableType: carrier.cableType?.slice(0, 80) ?? null })),
    trays: { count: trays.length, meters: Math.round(trays.reduce((sum, carrier) => sum + carrier.lengthM, 0) * 10) / 10 },
    bounds: model.bounds,
  };
}
