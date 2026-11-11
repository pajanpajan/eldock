// Fáze 95: souhrn BIM modelu pro okno kontroly před importem (stavební struktura, zdroje, rozváděče, stroje, trasy).
// Čisté funkce nad `BimModel`.

import type { BimBackupTier, BimElectricalElement, BimModel } from "./ifc-parser";

export const BACKUP_LABEL: Record<BimBackupTier, string> = { GRID_STANDARD: "Síť", BACKUP_GENERATOR_DA: "DA", CRITICAL_UPS_ZIS: "UPS / ZIS" };

const KIND_LABEL: Record<"transformer" | "generator" | "ups", string> = { transformer: "Trafostanice", generator: "Dieselagregát (DA)", ups: "UPS" };

export interface BimSummary {
  buildings: number;
  storeys: number;
  spaces: number;
  areaM2: number;
  /** Vnější rozměr „84,0 × 42,5 m“. */
  dimensions: string;
  sources: { tag: string; name: string; kind: string; kva: number | null; tier: string }[];
  boards: { tag: string; name: string; location: string; currentA: number | null; powerKw: number | null; ip: string | null; tier: string; fedFrom: string | null }[];
  machines: { tag: string; name: string; powerKw: number | null; location: string; fedFrom: string | null }[];
  wiring: { outlets: number; lights: number; switches: number; sensors: number; actuators: number };
  routes: { count: number; meters: number; cables: number; cableMeters: number };
  windows: number;
  doors: number;
}

export const metres = (value: number) => value.toLocaleString("cs-CZ", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function bimSummary(model: BimModel): BimSummary {
  const storeyName = new Map(model.storeys.map((storey) => [storey.id, storey.name]));
  const spaceName = new Map(model.spaces.map((space) => [space.id, space.name]));
  const byId = new Map(model.electrical.map((element) => [element.id, element]));
  const location = (element: BimElectricalElement) => [element.storeyId ? storeyName.get(element.storeyId) : null, element.spaceId ? spaceName.get(element.spaceId) : null].filter(Boolean).join(" · ") || "–";
  const fedFrom = (element: BimElectricalElement) => (element.fedById ? (byId.get(element.fedById)?.tag ?? null) : null);
  // Název, který jen opakuje označení („HR1“), nahradí popis z BIMu („Hlavní rozváděč 1000 A“)
  const title = (element: BimElectricalElement) => (element.description && element.name.trim().toUpperCase() === element.tag.toUpperCase() ? element.description : element.name);
  const of = (kind: BimElectricalElement["kind"]) => model.electrical.filter((element) => element.kind === kind);
  const trays = model.carriers.filter((carrier) => carrier.kind !== "cable" && carrier.kind !== "fitting");
  const cables = model.carriers.filter((carrier) => carrier.kind === "cable");
  const sum = (values: number[]) => Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10;
  return {
    buildings: Math.max(model.buildings.length, model.spaces.length ? 1 : 0),
    storeys: model.storeys.length,
    spaces: model.spaces.length,
    areaM2: Math.round(model.spaces.reduce((total, space) => total + space.areaM2, 0)),
    dimensions: `${metres(model.bounds.w)} × ${metres(model.bounds.h)} m`,
    sources: model.electrical
      .filter((element) => element.kind === "transformer" || element.kind === "generator" || element.kind === "ups")
      .map((element) => ({ tag: element.tag, name: title(element), kind: KIND_LABEL[element.kind as keyof typeof KIND_LABEL], kva: element.props.apparentPowerKva, tier: BACKUP_LABEL[element.backupTier] })),
    boards: of("board").map((element) => ({ tag: element.tag, name: title(element), location: location(element), currentA: element.props.nominalCurrentA, powerKw: element.props.powerKw, ip: element.props.ipRating, tier: BACKUP_LABEL[element.backupTier], fedFrom: fedFrom(element) })),
    machines: of("machine").map((element) => ({ tag: element.tag, name: element.name, powerKw: element.props.powerKw, location: location(element), fedFrom: fedFrom(element) })),
    wiring: { outlets: of("outlet").length, lights: of("light").length, switches: of("switch").length, sensors: of("sensor").length, actuators: of("actuator").length },
    routes: { count: trays.length, meters: sum(trays.map((carrier) => carrier.lengthM)), cables: cables.length, cableMeters: sum(cables.map((carrier) => carrier.lengthM)) },
    windows: model.openings.filter((opening) => opening.kind === "window").length,
    doors: model.openings.filter((opening) => opening.kind === "door").length,
  };
}
