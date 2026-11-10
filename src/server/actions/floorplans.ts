"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { collectFileUrls } from "@/lib/file-ownership";
import { prisma } from "@/lib/prisma";
import { assertPanelFiles } from "@/server/file-access";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import {
  MAX_DRAFT_CHARS,
  createFloorplan,
  duplicateFloorplan,
  floorplanForProject,
  importBrowserDraft,
  listFloorplanVersions,
  listFloorplans,
  loadFloorplanDraft,
  purgeFloorplan,
  restoreFloorplan,
  restoreFloorplanVersion,
  saveFloorplanDraft,
  saveFloorplanLibrary,
  saveFloorplanVersion,
  stashDraft,
  trashFloorplan,
  updateFloorplanMeta,
} from "@/server/services/floorplans";

import type { ActionResult } from "./workflow";

// Fáze 64: 2D půdorysy uložené na serveru – akce editoru a seznamu půdorysů (vždy jen půdorysy přihlášené firmy).

const LIST_PATH = "/panel-builder/floorplan";
const id = z.string().min(1).max(64);
const text = z.string().trim().max(120);
const metaSchema = z.object({ name: text.min(1, "Zadejte název půdorysu."), customerName: text.nullable().optional(), installationSite: text.nullable().optional() });
/** Nákres jde do služby jako neznámá data – ověří ho `parseDraft`; tady jen pojistka velikosti. */
const draftSchema = z.unknown().refine((value) => value !== undefined && JSON.stringify(value).length <= MAX_DRAFT_CHARS, "Půdorys je příliš velký (přes 900 kB) – rozdělte ho na víc půdorysů.");

export interface FloorplanVersionDto {
  id: string;
  version: number;
  reason: "AUTO" | "MANUAL" | "GENERATE" | "RESTORE" | "CONFLICT" | "OVERWRITE" | "IMPORT";
  label: string | null;
  elementCount: number;
  createdAt: string;
}

const firstIssue = (error: z.ZodError, fallback: string) => error.issues[0]?.message || fallback;

/** Fáze 68: podklad půdorysu jen ze souborů firmy – mírně, starší nákres s neznámým odkazem se dál ukládá. */
const assertDraftFiles = (companyId: string, draft: unknown) => assertPanelFiles(companyId, collectFileUrls(draft), { strict: false });

/** První uložení nového půdorysu z editoru (`/panel-builder/floorplan/novy`). */
export async function createFloorplanAction(input: { meta: z.input<typeof metaSchema>; draft: unknown }): Promise<ActionResult<{ id: string; code: string | null; version: number; savedAt: string }>> {
  const parsed = z.object({ meta: metaSchema, draft: draftSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Půdorys se nepodařilo uložit.") };
  try {
    const company = await guardCompany();
    await assertDraftFiles(company.id, parsed.data.draft);
    const created = await createFloorplan(prisma, company.id, parsed.data);
    revalidatePath(LIST_PATH);
    return { ok: true, data: { id: created.id, code: created.code, version: created.version, savedAt: created.savedAt.toISOString() } };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo uložit.");
  }
}

/** Průběžné uložení s kontrolou verze (`conflict` = půdorys mezitím změnilo jiné okno). */
export async function saveFloorplanAction(input: { id: string; baseVersion: number; draft: unknown; force?: boolean }): Promise<ActionResult<{ status: "saved" | "conflict"; version: number; savedAt: string }>> {
  const parsed = z.object({ id, baseVersion: z.number().int().min(1), draft: draftSchema, force: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Půdorys se nepodařilo uložit.") };
  try {
    const company = await guardCompany();
    await assertDraftFiles(company.id, parsed.data.draft);
    const result = await saveFloorplanDraft(prisma, company.id, parsed.data.id, parsed.data);
    return { ok: true, data: { status: result.status, version: result.version, savedAt: result.savedAt.toISOString() } };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo uložit.");
  }
}

/** Neuložené změny ze starší verze (záloha v prohlížeči) do historie verzí – aktuální stav se nepřepíše. */
export async function stashFloorplanDraftAction(input: { id: string; baseVersion: number | null; draft: unknown }): Promise<ActionResult<{ stored: boolean }>> {
  const parsed = z.object({ id, baseVersion: z.number().int().min(1).nullable(), draft: draftSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Zálohu se nepodařilo uložit.") };
  try {
    const company = await guardCompany();
    await assertDraftFiles(company.id, parsed.data.draft);
    const stored = await stashDraft(prisma, company.id, parsed.data.id, parsed.data);
    return { ok: true, data: { stored: !!stored } };
  } catch (error) {
    return actionFailure(error, "Zálohu se nepodařilo uložit.");
  }
}

/** Aktuální nákres ze serveru (po souběhu dvou oken). */
export async function loadFloorplanAction(floorplanId: string): Promise<ActionResult<{ version: number; savedAt: string; draft: unknown }>> {
  if (!id.safeParse(floorplanId).success) return { ok: false, error: "Půdorys nebyl nalezen." };
  try {
    const company = await guardCompany();
    const loaded = await loadFloorplanDraft(prisma, company.id, floorplanId);
    return { ok: true, data: { version: loaded.version, savedAt: loaded.savedAt.toISOString(), draft: loaded.draft } };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo načíst.");
  }
}

/** Přejmenování, zákazník a místo stavby. */
export async function updateFloorplanMetaAction(floorplanId: string, meta: z.input<typeof metaSchema>): Promise<ActionResult<{ name: string; customerName: string | null; installationSite: string | null }>> {
  const parsed = z.object({ id, meta: metaSchema }).safeParse({ id: floorplanId, meta });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Zkontrolujte název půdorysu.") };
  try {
    const company = await guardCompany();
    const saved = await updateFloorplanMeta(prisma, company.id, parsed.data.id, parsed.data.meta);
    revalidatePath(LIST_PATH, "layout");
    return { ok: true, data: saved };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo přejmenovat.");
  }
}

/** Kopie půdorysu. */
export async function duplicateFloorplanAction(floorplanId: string): Promise<ActionResult<{ id: string }>> {
  if (!id.safeParse(floorplanId).success) return { ok: false, error: "Půdorys nebyl nalezen." };
  try {
    const company = await guardCompany();
    const created = await duplicateFloorplan(prisma, company.id, floorplanId);
    revalidatePath(LIST_PATH);
    return { ok: true, data: { id: created.id } };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo zkopírovat.");
  }
}

/** Koš: smazat (obnovitelně), obnovit, smazat natrvalo (jen z koše). */
export async function trashFloorplanAction(floorplanId: string, mode: "trash" | "restore" | "purge"): Promise<ActionResult> {
  const parsed = z.object({ id, mode: z.enum(["trash", "restore", "purge"]) }).safeParse({ id: floorplanId, mode });
  if (!parsed.success) return { ok: false, error: "Půdorys nebyl nalezen." };
  try {
    const company = await guardCompany();
    if (mode === "trash") await trashFloorplan(prisma, company.id, floorplanId);
    else if (mode === "restore") await restoreFloorplan(prisma, company.id, floorplanId);
    else await purgeFloorplan(prisma, company.id, floorplanId);
    revalidatePath(LIST_PATH);
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Půdorys se nepodařilo upravit.");
  }
}

const versionDto = (row: { id: string; version: number; reason: FloorplanVersionDto["reason"]; label: string | null; elementCount: number; createdAt: Date }): FloorplanVersionDto => ({ ...row, createdAt: row.createdAt.toISOString() });

/** Historie verzí půdorysu. */
export async function listFloorplanVersionsAction(floorplanId: string): Promise<ActionResult<FloorplanVersionDto[]>> {
  if (!id.safeParse(floorplanId).success) return { ok: false, error: "Půdorys nebyl nalezen." };
  try {
    const company = await guardCompany();
    return { ok: true, data: (await listFloorplanVersions(prisma, company.id, floorplanId)).map(versionDto) };
  } catch (error) {
    return actionFailure(error, "Historii verzí se nepodařilo načíst.");
  }
}

/** „Uložit verzi“ s vlastním popisem. */
export async function saveFloorplanVersionAction(floorplanId: string, label: string | null): Promise<ActionResult<FloorplanVersionDto | null>> {
  const parsed = z.object({ id, label: z.string().trim().max(80).nullable() }).safeParse({ id: floorplanId, label });
  if (!parsed.success) return { ok: false, error: "Popis verze je příliš dlouhý." };
  try {
    const company = await guardCompany();
    const saved = await saveFloorplanVersion(prisma, company.id, floorplanId, parsed.data.label);
    return { ok: true, data: saved ? versionDto(saved) : null };
  } catch (error) {
    return actionFailure(error, "Verzi se nepodařilo uložit.");
  }
}

/** Obnovení verze z historie (současný stav zůstane v historii). */
export async function restoreFloorplanVersionAction(floorplanId: string, versionId: string): Promise<ActionResult<{ version: number; savedAt: string; draft: unknown }>> {
  if (!z.object({ id, versionId: id }).safeParse({ id: floorplanId, versionId }).success) return { ok: false, error: "Verze nebyla nalezena." };
  try {
    const company = await guardCompany();
    const restored = await restoreFloorplanVersion(prisma, company.id, floorplanId, versionId);
    revalidatePath(LIST_PATH);
    return { ok: true, data: { version: restored.version, savedAt: restored.savedAt.toISOString(), draft: restored.draft } };
  } catch (error) {
    return actionFailure(error, "Verzi se nepodařilo obnovit.");
  }
}

/** Převzetí rozpracovaného nákresu z prohlížeče (klíč `eldock.pb.floorplan` do fáze 63). */
export async function importBrowserFloorplanAction(input: { draft: unknown; name: string }): Promise<ActionResult<{ id: string; created: boolean }>> {
  const parsed = z.object({ draft: draftSchema, name: text }).safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error, "Nákres z prohlížeče se nepodařilo převzít.") };
  try {
    const company = await guardCompany();
    await assertDraftFiles(company.id, parsed.data.draft);
    const result = await importBrowserDraft(prisma, company.id, parsed.data);
    revalidatePath(LIST_PATH);
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Nákres z prohlížeče se nepodařilo převzít.");
  }
}

/** „Upravit půdorys“ u hotového projektu – vrátí půdorys k otevření (případně ho založí z kopie v projektu). */
export async function openProjectFloorplanAction(projectId: string): Promise<ActionResult<{ id: string; created: boolean }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Projekt nebyl nalezen." };
  try {
    const company = await guardCompany();
    const result = await floorplanForProject(prisma, company.id, projectId);
    if (result.created) revalidatePath(LIST_PATH);
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Půdorys projektu se nepodařilo otevřít.");
  }
}

/** Fáze 78: řádek „📂 Moje uložené půdorysy“ v editoru (rozpracované zakázky firmy, nejnověji upravené první). */
export interface CloudFloorplanRow {
  id: string;
  code: string | null;
  name: string;
  customerName: string | null;
  installationSite: string | null;
  elementCount: number;
  floorCount: number;
  updatedAt: string;
  project: { id: string; code: string } | null;
}

export async function listFloorplansAction(): Promise<ActionResult<CloudFloorplanRow[]>> {
  try {
    const company = await guardCompany();
    const rows = await listFloorplans(prisma, company.id);
    return {
      ok: true,
      data: rows.map((row) => ({ id: row.id, code: row.code, name: row.name, customerName: row.customerName, installationSite: row.installationSite, elementCount: row.elementCount, floorCount: row.floorCount, updatedAt: row.updatedAt.toISOString(), project: row.project ? { id: row.project.id, code: row.project.code } : null })),
    };
  } catch (error) {
    return actionFailure(error, "Seznam půdorysů se nepodařilo načíst.");
  }
}

const librarySchema = z.object({ templates: z.array(z.unknown()).max(200), favorites: z.array(z.string().max(100)).max(400), uiMode: z.enum(["wizard", "compact"]).optional(), updatedAt: z.number().int().nonnegative() });

/** Fáze 78: knihovna 2D půdorysu firmy (šablony sestav, oblíbené ⭐) – z prohlížeče do firmy, novější vyhrává. */
export async function saveFloorplanLibraryAction(input: z.input<typeof librarySchema>): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = librarySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná knihovna půdorysu." };
  try {
    const company = await guardCompany();
    const result = await saveFloorplanLibrary(prisma, company.id, parsed.data);
    return { ok: true, data: { saved: result.saved } };
  } catch (error) {
    return actionFailure(error, "Šablony a oblíbené se nepodařilo uložit do firmy.");
  }
}
