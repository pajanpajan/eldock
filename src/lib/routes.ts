// Odkazy na úrovně mapy a detail zařízení – jediné místo, kde se skládají URL.

/** Rozcestník přihlášené aplikace (na `/` je veřejná úvodní stránka). */
export const APP_HOME = "/app";

/**
 * Fáze 54: trasy Správy závodů (skupiny `(app)` a `(print)`) a reálné PDF projekty. Jen ty bez přihlášení přesměrují na `/login`;
 * neznámá adresa dostane 404. Nová trasa ve skupině `(app)` / `(print)` sem musí přibýt (hlídá `phase54.test.ts`).
 */
// Fáze 115: „📋 Revize & Plánovač“ (/revize) jen po přihlášení
export const PLANT_ROUTE_PREFIXES = ["/app", "/admin", "/cae", "/equipment", "/inspections", "/plant", "/studio", "/demo-docs", "/ucet", "/rychla-revize", "/revize"] as const;

export const isPlantRoute = (pathname: string) => PLANT_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

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
/** Fáze 108: 🛡️ Měsíční report & Ochrana TIČR (pro revizní techniky). */
export const ticrReportHref = "/inspections/ticr";

/** Notifikace a hlídač lhůt (souhrnné avízo vedení závodu). */
export const inspectionAlertsHref = "/inspections/alerts";

/** Hromadný import spotřebičů z CSV / Excelu. */
export const inspectionImportHref = "/inspections/import";

export const auditReportHref = "/inspections/audit-report";
