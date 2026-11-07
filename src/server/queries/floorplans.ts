import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { getPanelCompany } from "@/server/panel-session";
import { getApplianceLibraryJson, getBoardManufacturers, getWiringSeries } from "@/server/queries/panel-builder";
import { getFloorplan, listFloorplans, type FloorplanListRow } from "@/server/services/floorplans";

// Fáze 64: čtení uložených 2D půdorysů přihlášené firmy (seznam, editor).

/** Řádek seznamu půdorysů pro klienta (datumy jako ISO). */
export interface FloorplanRow {
  id: string;
  name: string;
  customerName: string | null;
  installationSite: string | null;
  elementCount: number;
  roomCount: number;
  floorCount: number;
  updatedAt: string;
  deletedAt: string | null;
  project: { id: string; code: string; name: string } | null;
}

const toRow = (row: FloorplanListRow): FloorplanRow => ({
  id: row.id,
  name: row.name,
  customerName: row.customerName,
  installationSite: row.installationSite,
  elementCount: row.elementCount,
  roomCount: row.roomCount,
  floorCount: row.floorCount,
  updatedAt: row.updatedAt.toISOString(),
  deletedAt: row.deletedAt?.toISOString() ?? null,
  project: row.project,
});

export const getFloorplanList = cache(async (): Promise<{ active: FloorplanRow[]; deleted: FloorplanRow[] }> => {
  const company = await getPanelCompany();
  if (!company) return { active: [], deleted: [] };
  const [active, deleted] = await Promise.all([listFloorplans(prisma, company.id), listFloorplans(prisma, company.id, { deleted: true })]);
  return { active: active.map(toRow), deleted: deleted.map(toRow) };
});

/** Uložený půdorys pro editor; nákres jako JSON (klient ho ověří `parseDraft`). */
export const getFloorplanForEditor = cache(async (id: string) => {
  const company = await getPanelCompany();
  if (!company) return null;
  const row = await getFloorplan(prisma, company.id, id);
  if (!row) return null;
  return { ...toRow(row), version: row.version, draftJson: row.draftJson, valid: !!row.draft };
});

export type FloorplanForEditor = NonNullable<Awaited<ReturnType<typeof getFloorplanForEditor>>>;

/** Společná data editoru: řady přístrojů, výrobci rozváděčů, knihovna spotřebičů a název firmy. */
export async function getFloorplanEditorData() {
  const [series, manufacturers, applianceJson, company] = await Promise.all([getWiringSeries(), getBoardManufacturers(), getApplianceLibraryJson(), getPanelCompany()]);
  return { series: series.map(({ key, label, count }) => ({ key, label, count })), manufacturers, applianceJson, company: company?.companyName ?? null };
}
