// Odkazy na úrovně mapy a detail zařízení – jediné místo, kde se skládají URL.

/** Rozcestník přihlášené aplikace (na `/` je veřejná úvodní stránka). */
export const APP_HOME = "/app";

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

/** Revizní protokol k tisku / PDF (VTZ nebo spotřebič podle zařízení). */
export const inspectionReportHref = (recordId: string) => `/inspections/report/${recordId}`;

export const caeRevisionHref = (changeRequestId: string) => `${caeTicketHref(changeRequestId)}/revision`;

export const inspectionsHref = "/inspections";

export const rapidInspectionHref = "/inspections/rapid";

export const plannerHref = "/inspections/planner";

/** Notifikace a hlídač lhůt (souhrnné avízo vedení závodu). */
export const inspectionAlertsHref = "/inspections/alerts";

/** Hromadný import spotřebičů z CSV / Excelu. */
export const inspectionImportHref = "/inspections/import";

export const auditReportHref = "/inspections/audit-report";
