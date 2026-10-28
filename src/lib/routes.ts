// Odkazy na úrovně mapy a detail zařízení – jediné místo, kde se skládají URL.

export const plantHref = (plantId: string) => `/plant/${plantId}`;

export const buildingHref = (plantId: string, buildingId: string) => `${plantHref(plantId)}/building/${buildingId}`;

export const floorHref = (plantId: string, buildingId: string, floorId: string) =>
  `${buildingHref(plantId, buildingId)}/floor/${floorId}`;

export const equipmentHref = (equipmentId: string) => `/equipment/${equipmentId}`;

/** Klik na budovu v areálu: vícepodlažní → výběr patra, jednopodlažní → rovnou půdorys. */
export function buildingEntryHref(plantId: string, buildingId: string, floorIds: string[]): string {
  return floorIds.length === 1
    ? floorHref(plantId, buildingId, floorIds[0])
    : buildingHref(plantId, buildingId);
}

export const caeTicketHref = (changeRequestId: string) => `/cae/tickets/${changeRequestId}`;

export const caeRevisionHref = (changeRequestId: string) => `${caeTicketHref(changeRequestId)}/revision`;

export const inspectionsHref = "/inspections";

export const rapidInspectionHref = "/inspections/rapid";
