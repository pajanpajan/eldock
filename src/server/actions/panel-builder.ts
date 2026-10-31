"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { COMPONENT_CATEGORIES } from "@/lib/panel-builder/catalog";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { analyzePanelPhoto, extractDatasheetComponents, lookupComponent, type AiMode } from "@/server/services/geminiPanelService";
import { PHASE_OPTIONS, type TreeIssue } from "@/lib/panel-builder/tree";
import { analyzeProject, assignCatalogComponent, createPanelProject, importDatasheet, configureItem, lookupComponentForItem, mergeItems, releaseDocumentation, saveThermalInputs, saveTree, splitItem, updateItemText, type ImportedComponent } from "@/server/services/panel-builder";
import { getCurrentAccount } from "@/server/session";
import { readStoredFile } from "@/server/storage";

import type { ActionResult } from "./workflow";

async function guard() {
  const account = await getCurrentAccount();
  if (!account.can("panelBuilder")) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.panelBuilder}.`);
  await assertFeature("enterprise.ai_panel_builder");
  return account;
}

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

const id = z.string().min(1).max(64);
const fileUrl = z
  .string()
  .max(300)
  .regex(/^(\/api\/files\/(photos|documents)\/[\w./-]+|\/demo-docs\/[\w.-]+\.pdf)$/);

const datasheetSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  fileUrl: fileUrl.nullable().optional(),
  pages: z.array(z.array(z.string().max(2000)).max(400)).min(1).max(80),
});

/** Atomizace PDF datasheetu do katalogu prvků (Gemini z PDF, jinak deterministicky z textu). */
export async function importDatasheetAction(input: z.input<typeof datasheetSchema>): Promise<ActionResult<{ mode: AiMode; components: ImportedComponent[] }>> {
  const parsed = datasheetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "PDF se nepodařilo přečíst (příliš velký nebo prázdný soubor)." };
  try {
    await guard();
    const pdf = parsed.data.fileUrl ? await readStoredFile(parsed.data.fileUrl) : null;
    const result = await importDatasheet(prisma, parsed.data, (input) => extractDatasheetComponents({ pages: input.pages, pdf: pdf?.mimeType === "application/pdf" ? pdf.bytes : null }));
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Import datasheetu se nepodařil. Zkuste to prosím znovu.");
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  customerName: z.string().trim().max(120).nullable(),
  photoUrl: fileUrl.nullable(),
  dominantManufacturer: z.string().trim().min(1).max(40),
  dinRailsCount: z.number().int().min(1).max(12),
  modulesPerRail: z.number().int().min(4).max(48),
});

const readPhoto = (url: string) => readStoredFile(url);

/** Nový projekt z fotky + okamžitá analýza (krok 1). */
export async function createPanelProjectAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string; mode: AiMode; warning?: string }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte název rozváděče a parametry skříně." };
  try {
    const account = await guard();
    const { dinRailsCount, modulesPerRail, ...rest } = parsed.data;
    const project = await createPanelProject(prisma, { ...rest, dims: { dinRailsCount, modulesPerRail }, createdById: account.user.id });
    const result = await analyzeProject(prisma, project.id, { analyze: analyzePanelPhoto, readPhoto });
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { id: project.id, mode: result.mode, warning: result.warning } };
  } catch (error) {
    return failure(error, "Projekt se nepodařilo založit.");
  }
}

/** Znovu analyzovat fotku (nahradí prvky projektu). */
export async function analyzePanelProjectAction(projectId: string): Promise<ActionResult<{ mode: AiMode; total: number; unresolved: number; warning?: string }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný projekt." };
  try {
    await guard();
    const result = await analyzeProject(prisma, projectId, { analyze: analyzePanelPhoto, readPhoto });
    revalidatePath(`/panel-builder/${projectId}`);
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Analýza fotky se nepodařila.");
  }
}

/** Smart Fallback Picker: přiřadit katalogový kus jedním klikem. */
export async function assignComponentAction(itemId: string, componentId: string): Promise<ActionResult> {
  if (!id.safeParse(itemId).success || !id.safeParse(componentId).success) return { ok: false, error: "Neplatný výběr." };
  try {
    await guard();
    const item = await assignCatalogComponent(prisma, itemId, componentId);
    revalidatePath(`/panel-builder/${item.projectId}`);
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Přiřazení se nepodařilo.");
  }
}

const lookupSchema = z.object({
  itemId: id,
  text: z.string().trim().min(1).max(120),
  hints: z.object({
    category: z.enum(COMPONENT_CATEGORIES).nullable(),
    poles: z.string().max(8).nullable(),
    current: z.number().positive().max(6300).nullable(),
    curve: z.string().max(2).nullable(),
    manufacturer: z.string().max(40).nullable(),
  }),
});

/** „Dohledat v datasheetech přes Gemini AI“ podle textu z čela přístroje. */
export async function lookupComponentAction(input: z.input<typeof lookupSchema>): Promise<ActionResult<{ mode: AiMode | "CATALOG"; component: ImportedComponent | null }>> {
  const parsed = lookupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Opište alespoň část typového označení z čela přístroje." };
  try {
    await guard();
    const result = await lookupComponentForItem(prisma, parsed.data, lookupComponent);
    if (result.component?.status === "created") revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Dohledání přístroje se nepodařilo.");
  }
}

const treeSchema = z.object({
  projectId: id,
  assignments: z
    .array(
      z.object({
        id,
        parentItemId: id.nullable(),
        fedFromIncomer: z.boolean(),
        phaseAssignment: z.enum(PHASE_OPTIONS).nullable(),
        circuitLabel: z.string().max(80),
        designation: z.string().max(8),
      }),
    )
    .max(300),
});

/** Krok 2: uložení stromu zapojení z editoru (autosave). */
export async function saveTreeAction(input: z.input<typeof treeSchema>): Promise<ActionResult<{ status: string; connected: boolean; issues: TreeIssue[] }>> {
  const parsed = treeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data stromu zapojení." };
  try {
    await guard();
    const result = await saveTree(prisma, parsed.data.projectId, parsed.data.assignments);
    revalidatePath(`/panel-builder/${parsed.data.projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Strom se nepodařilo uložit.");
  }
}

const thermalSchema = z.object({
  projectId: id,
  heightMm: z.number().int().min(100).max(3000),
  widthMm: z.number().int().min(100).max(3000),
  depthMm: z.number().int().min(50).max(1500),
  enclosureType: z.enum(["WALL_MOUNTED", "FLUSH_MOUNTED", "FREE_STANDING"]),
  enclosureMaterial: z.enum(["PLASTIC", "PAINTED_STEEL", "STAINLESS_STEEL"]),
  ipRating: z.string().max(12),
  ambientTempC: z.number().min(-25).max(60),
  simultaneityFactor: z.number().gt(0).max(1),
  internalWiringLossW: z.number().min(0).max(2000),
  operatingCurrents: z.array(z.object({ itemId: id, value: z.number().positive().max(6300).nullable() })).max(300),
});

/** Krok 3: parametry skříně a výpočtové proudy (autosave). */
export async function saveThermalInputsAction(input: z.input<typeof thermalSchema>): Promise<ActionResult> {
  const parsed = thermalSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte parametry skříně (rozměry, teplota, soudobost 0–1)." };
  try {
    await guard();
    const { projectId, ...inputs } = parsed.data;
    await saveThermalInputs(prisma, projectId, inputs);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Parametry se nepodařilo uložit.");
  }
}

/** Krok 4: „Propustit dokumentaci do provozu“ – přiřazení pasportu ke kartě rozváděče. */
export async function releaseDocumentationAction(projectId: string, equipmentId: string): Promise<ActionResult<{ equipmentId: string; tag: string }>> {
  if (!id.safeParse(projectId).success || !id.safeParse(equipmentId).success) return { ok: false, error: "Vyberte rozváděč v Eldocku." };
  try {
    await guard();
    const equipment = await releaseDocumentation(prisma, projectId, equipmentId);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    revalidatePath(`/equipment/${equipment.id}`);
    return { ok: true, data: { equipmentId: equipment.id, tag: equipment.tag } };
  } catch (error) {
    return failure(error, "Dokumentaci se nepodařilo propustit.");
  }
}

const nullableText = (max: number) => z.string().max(max).nullable().optional();
const configSchema = z.object({
  category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "OTHER"]),
  manufacturer: z.string().trim().max(40).nullable(),
  poles: z.string().max(8),
  modules: z.number().positive().max(12),
  ratedCurrentA: z.number().positive().max(6300).nullable(),
  curve: nullableText(2),
  breakingCapacityKa: z.number().positive().max(100).nullable().optional(),
  rcdType: nullableText(3),
  rcdSensitivityMa: z.number().int().positive().max(1000).nullable().optional(),
  spdType: nullableText(8),
  surgeCurrentKa: z.number().positive().max(200).nullable().optional(),
  contactConfig: nullableText(10),
  coilVoltage: nullableText(12),
  relaySubtype: nullableText(20),
  moduleSubtype: nullableText(24),
  power: nullableText(12),
});

/** Živý konfigurátor: každý klik na dlaždici uloží prvek a přiřadí nejbližší přesný kus. */
export async function configureItemAction(itemId: string, config: z.input<typeof configSchema>, mergeNeighbors = false): Promise<ActionResult<{ typeCode: string; estimated: boolean }>> {
  const parsed = configSchema.safeParse(config);
  if (!id.safeParse(itemId).success || !parsed.success) return { ok: false, error: "Neplatná konfigurace prvku." };
  try {
    await guard();
    const result = await configureItem(prisma, itemId, parsed.data, { mergeNeighbors });
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { typeCode: result.component.typeCode, estimated: result.estimated } };
  } catch (error) {
    return failure(error, "Prvek se nepodařilo nastavit.");
  }
}

/** Geometrie na DIN liště: sloučit 2 / 3 / 4 sousední moduly. */
export async function mergeItemsAction(itemId: string, count: number): Promise<ActionResult<{ width: number }>> {
  if (!id.safeParse(itemId).success || ![2, 3, 4].includes(count)) return { ok: false, error: "Neplatné sloučení." };
  try {
    await guard();
    const result = await mergeItems(prisma, itemId, count);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { width: result.width } };
  } catch (error) {
    return failure(error, "Moduly se nepodařilo sloučit.");
  }
}

/** Geometrie na DIN liště: rozdělit vícemodulový přístroj na 1M moduly. */
export async function splitItemAction(itemId: string): Promise<ActionResult<{ parts: number }>> {
  if (!id.safeParse(itemId).success) return { ok: false, error: "Neplatný prvek." };
  try {
    await guard();
    const result = await splitItem(prisma, itemId);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { parts: result.parts } };
  } catch (error) {
    return failure(error, "Přístroj se nepodařilo rozdělit.");
  }
}

/** Karta „Přiřazený přístroj“: ruční typ a popis obvodu. */
export async function updateItemTextAction(itemId: string, input: { customTypeCode: string | null; circuitLabel: string }): Promise<ActionResult> {
  const parsed = z.object({ customTypeCode: z.string().max(80).nullable(), circuitLabel: z.string().max(80) }).safeParse(input);
  if (!id.safeParse(itemId).success || !parsed.success) return { ok: false, error: "Neplatné údaje přístroje." };
  try {
    await guard();
    const item = await updateItemText(prisma, itemId, parsed.data);
    revalidatePath(`/panel-builder/${item.projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Údaje se nepodařilo uložit.");
  }
}
