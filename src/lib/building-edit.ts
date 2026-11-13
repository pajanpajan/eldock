// Fáze 108: úprava budovy závodu – název, kód, rozměr a poloha na mapě areálu (v metrech pozemku), přesun tažením
// a kontrola, že budova leží v areálu a nepřekrývá jinou halu. Čisté funkce (služba i formulář).

import { z } from "zod";

import { clampRect, overlappingBuildings, polygonBounds, rectInsideCampus, rectToMeters, type CampusRect, type CampusSize } from "./campus-layout";

export const buildingEditSchema = z.object({
  buildingId: z.string().min(1).max(64),
  name: z.string().trim().min(2, "Název budovy má aspoň 2 znaky.").max(80),
  code: z
    .string()
    .trim()
    .min(1, "Zadejte kód budovy (např. C).")
    .max(4)
    .regex(/^[A-Za-z0-9]+$/, "Kód budovy jen z písmen a číslic (např. C, H2)."),
  shortName: z.string().trim().max(40).optional().nullable(),
  /** Poloha a rozměr v metrech pozemku (levý horní roh X / Y, šířka, hloubka); bez = beze změny. */
  map: z
    .object({
      x: z.number().min(0).max(2000),
      y: z.number().min(0).max(2000),
      w: z.number().min(1).max(2000),
      h: z.number().min(1).max(2000),
    })
    .optional()
    .nullable(),
});
export type BuildingEditInput = z.input<typeof buildingEditSchema>;

export const floorEditSchema = z.object({
  floorId: z.string().min(1).max(64),
  name: z.string().trim().min(2, "Název podlaží má aspoň 2 znaky.").max(80),
  description: z.string().trim().max(300).optional().nullable(),
});

/** Metry pozemku → procenta mapy areálu (zaokrouhleno na 0,1 %). */
export function metersToMapRect(meters: { x: number; y: number; w: number; h: number }, campus: CampusSize): CampusRect {
  const round = (value: number) => Math.round(value * 10) / 10;
  return { x: round((meters.x / campus.width) * 100), y: round((meters.y / campus.height) * 100), w: round((meters.w / campus.width) * 100), h: round((meters.h / campus.height) * 100) };
}

/** Procenta mapy → metry pozemku (formulář úpravy budovy). */
export function mapRectToMeters(rect: CampusRect, campus: CampusSize) {
  const meters = rectToMeters(rect, campus);
  const round = (value: number) => Math.round(value * 10) / 10;
  return { x: round(meters.x), y: round(meters.y), w: round(meters.w), h: round(meters.h) };
}

/** Obdélník → polygon budovy „x,y x,y x,y x,y“ a poloha štítku (střed). */
export function rectToBuildingMap(rect: CampusRect): { mapPolygon: string; labelX: number; labelY: number } {
  const r = clampRect(rect);
  const round = (value: number) => Math.round(value * 10) / 10;
  const x2 = round(r.x + r.w);
  const y2 = round(r.y + r.h);
  return { mapPolygon: `${r.x},${r.y} ${x2},${r.y} ${x2},${y2} ${r.x},${y2}`, labelX: round(r.x + r.w / 2), labelY: round(r.y + r.h / 2) };
}

export interface MapBuilding {
  id: string;
  name: string;
  mapPolygon: string;
}

/**
 * Kontrola nové polohy budovy: leží celá v areálu a nepřekrývá jinou budovu. Vrací českou chybu (s názvy budov), nebo
 * null = poloha je v pořádku.
 */
export function placementError(rect: CampusRect, buildingId: string, buildings: readonly MapBuilding[]): string | null {
  if (!rectInsideCampus(rect)) return "Budova by ležela mimo areál – zmenšete ji nebo posuňte dovnitř mapy.";
  const others = buildings.filter((building) => building.id !== buildingId).map((building) => ({ name: building.name, rect: polygonBounds(building.mapPolygon) }));
  const hit = overlappingBuildings(rect, others);
  return hit.length ? `Budova by se překrývala s: ${hit.map((building) => building.name).join(", ")}. Zvolte volné místo.` : null;
}

/** Posun obdélníku o delta (procenta mapy) – hrana areálu zastaví budovu. */
export const shiftRect = (rect: CampusRect, dx: number, dy: number) => clampRect({ ...rect, x: rect.x + dx, y: rect.y + dy });

/** Text potvrzení smazání budovy (co všechno zmizí). */
export function deletionSummary(impact: { floors: number; equipment: number; inspections: number; documents: number }): string {
  const parts = [`${impact.floors} ${impact.floors === 1 ? "podlaží" : "podlaží"}`, `${impact.equipment} zařízení`];
  if (impact.inspections) parts.push(`${impact.inspections} ${impact.inspections === 1 ? "záznam revize" : impact.inspections < 5 ? "záznamy revizí" : "záznamů revizí"}`);
  if (impact.documents) parts.push(`${impact.documents} dokumentů a výkresů`);
  return parts.join(", ");
}

/** Smazání budovy se záznamy revizí a dokumenty vyžaduje opsat název budovy (doklady se tím nenávratně ztratí). */
export const needsTypedConfirmation = (impact: { inspections: number; documents: number; equipment: number }) => impact.inspections > 0 || impact.documents > 0 || impact.equipment > 0;
