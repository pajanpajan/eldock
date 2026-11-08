"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { CATEGORY_LABELS, COMPONENT_CATEGORIES } from "@/lib/panel-builder/catalog";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { analyzePanelPhoto, analyzeRailPhoto, extractDatasheetComponents, lookupComponent, type AiMode, type AnalysisMode } from "@/server/services/geminiPanelService";
import { PHASE_OPTIONS, type TreeIssue } from "@/lib/panel-builder/tree";
import { analyzeProject, assignCatalogComponent, createPanelProject, importDatasheet, addModule, addRail, configureItem, deleteItem, deleteRail, lookupComponentForItem, mergeItems, releaseDocumentation, saveThermalInputs, saveTree, searchCatalog, setIncomer, splitItem, updateItemText, type CatalogHit, type ImportedComponent } from "@/server/services/panel-builder";
import { actionFailure, guardCompany, guardItem, guardProject } from "@/server/panel-guards";
import { consumeCredit } from "@/server/services/companies";
import { companyManufacturer } from "@/lib/registered-company";
import { assertPanelFiles } from "@/server/file-access";
import { readStoredFile } from "@/server/storage";
import { analyzeRailDetails } from "@/server/services/panel-design";

import { cleanArticle, datasheetLinks, type DatasheetLink } from "@/lib/panel-builder/datasheets";
import { symbolKindOf, type SymbolKind } from "@/lib/panel-builder/iec-symbols";

import type { ActionResult } from "./workflow";

const guard = guardCompany;
const failure = actionFailure;

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
    const company = await guard();
    // Fáze 68: server čte jen soubor přihlášené firmy (nebo vzorové PDF)
    await assertPanelFiles(company.id, [parsed.data.fileUrl]);
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
  installationSite: z.string().trim().max(120).nullable().optional(),
  photoUrl: fileUrl.nullable(),
  dominantManufacturer: z.string().trim().min(1).max(40),
  dinRailsCount: z.number().int().min(1).max(12),
  modulesPerRail: z.number().int().min(4).max(48),
  /** Fáze 43: návrh od nuly bez fotky (1× 12M) nebo pasportizace z fotky. */
  designMode: z.enum(["PHOTO", "DESIGN"]).default("PHOTO"),
  /** Fáze 51: detailní fotky lišt / snímky z videa (lišta → fotka) ke kombinované analýze. */
  railPhotos: z.array(z.object({ rail: z.number().int().min(1).max(12), url: z.string().max(300).regex(/^\/api\/files\/photos\/[\w./-]+$/) })).max(12).default([]),
  /** Fáze 55: soustava přívodu (1f / 3f, TN-C-S / TN-S / TT). */
  supplySystem: z.enum(["3F_TNCS", "3F_TNS", "3F_TT", "1F_TNS", "1F_TNCS"]).optional(),
});

const readPhoto = (url: string) => readStoredFile(url);

/** Nový projekt z fotky + okamžitá analýza (krok 1). */
export async function createPanelProjectAction(input: z.input<typeof createSchema>): Promise<ActionResult<{ id: string; mode: AiMode; warning?: string; design?: boolean; details?: number }>> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte název rozváděče a parametry skříně." };
  try {
    const company = await guard();
    const { dinRailsCount, modulesPerRail, designMode, railPhotos, ...rest } = parsed.data;
    if (designMode === "PHOTO" && !rest.photoUrl) return { ok: false, error: "Nahrajte fotku rozváděče, nebo zvolte návrh od nuly." };
    // Fáze 68: fotky jen z vlastních nahrání firmy (před odečtením kreditu)
    await assertPanelFiles(company.id, [rest.photoUrl, ...railPhotos.map((photo) => photo.url)]);
    // 1 kredit = 1 nový rozváděč; údaje firmy se propíšou jako výrobce rozváděče
    await consumeCredit(prisma, company.id);
    let project: Awaited<ReturnType<typeof createPanelProject>>;
    try {
      project = await createPanelProject(prisma, { ...rest, designMode, dims: { dinRailsCount, modulesPerRail }, companyId: company.id, manufacturerInfo: companyManufacturer(company) });
    } catch (error) {
      await prisma.registeredCompany.update({ where: { id: company.id }, data: { creditsRemaining: { increment: 1 } } });
      throw error;
    }
    // Návrh od nuly: čisté plátno bez analýzy fotky
    if (designMode === "DESIGN") {
      revalidatePath("/panel-builder", "layout");
      return { ok: true, data: { id: project.id, mode: "DEMO" as AiMode, design: true } };
    }
    const result = await analyzeProject(prisma, project.id, { analyze: analyzePanelPhoto, readPhoto });
    // Kombinovaná analýza: celková topologie + ostré hodnoty z detailních fotek lišt
    const details = railPhotos.length ? await analyzeRailDetails(prisma, project.id, railPhotos, { analyze: analyzeRailPhoto, readPhoto }) : null;
    revalidatePath("/panel-builder", "layout");
    const warning = [result.warning, ...(details?.warnings ?? [])].filter(Boolean).join(" ") || undefined;
    return { ok: true, data: { id: project.id, mode: result.mode, warning, details: details?.analyzed ?? 0 } };
  } catch (error) {
    return failure(error, "Projekt se nepodařilo založit.");
  }
}

/** Znovu analyzovat fotku (nahradí prvky projektu) v režimu Auto / Odkrytovaný / Zakrytovaný. */
export async function analyzePanelProjectAction(projectId: string, mode: AnalysisMode = "AUTO"): Promise<ActionResult<{ mode: AiMode; total: number; unresolved: number; warning?: string }>> {
  if (!id.safeParse(projectId).success || !["AUTO", "UNCOVERED", "COVERED"].includes(mode)) return { ok: false, error: "Neplatný projekt." };
  try {
    await guardProject(projectId);
    const result = await analyzeProject(prisma, projectId, { analyze: analyzePanelPhoto, readPhoto, mode });
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
    await guardItem(itemId);
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
    await guardItem(parsed.data.itemId);
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
    await guardProject(parsed.data.projectId);
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
    await guardProject(parsed.data.projectId);
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
    const company = await guardProject(projectId);
    // Propustit lze jen do vlastního závodu firmy (samostatný Panel Builder bez závodu nepropouští)
    if (!company.plantId || !(await prisma.equipment.count({ where: { id: equipmentId, floor: { building: { plantId: company.plantId } } } }))) {
      throw new WorkflowError("FORBIDDEN", "Propuštění do provozu je dostupné jen pro firmu s vlastním závodem v Eldocku.");
    }
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
  category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "OTHER", "ACCESSORY"]),
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
    await guardItem(itemId);
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
    await guardItem(itemId);
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
    await guardItem(itemId);
    const result = await splitItem(prisma, itemId);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: { parts: result.parts } };
  } catch (error) {
    return failure(error, "Přístroj se nepodařilo rozdělit.");
  }
}

/** Karta „Přiřazený přístroj“: ruční typ a popis obvodu. */
export async function updateItemTextAction(itemId: string, input: { customTypeCode: string | null; circuitLabel: string; designation?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ customTypeCode: z.string().max(80).nullable(), circuitLabel: z.string().max(80), designation: z.string().max(8).nullable().optional() }).safeParse(input);
  if (!id.safeParse(itemId).success || !parsed.success) return { ok: false, error: "Neplatné údaje přístroje." };
  try {
    await guardItem(itemId);
    const item = await updateItemText(prisma, itemId, parsed.data);
    revalidatePath(`/panel-builder/${item.projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Údaje se nepodařilo uložit.");
  }
}

const catalogSearchSchema = z.object({
  q: z.string().trim().max(80),
  manufacturer: z.string().max(40).nullable(),
  category: z.enum(COMPONENT_CATEGORIES).nullable(),
  poles: z.string().max(8).nullable(),
});

/** Našeptávač konfigurátoru: rychlé hledání v databázi prvků (výrobce → kategorie → póly → text). */
export async function searchCatalogAction(input: z.input<typeof catalogSearchSchema>): Promise<ActionResult<CatalogHit[]>> {
  const parsed = catalogSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné hledání v katalogu." };
  try {
    await guard();
    return { ok: true, data: await searchCatalog(prisma, parsed.data) };
  } catch (error) {
    return failure(error, "Hledání v katalogu se nepodařilo.");
  }
}

/** Hlavní přívod rozváděče: shora / zespoda (krok 2). */
export async function setIncomerAction(projectId: string, incomerFrom: "TOP" | "BOTTOM"): Promise<ActionResult> {
  if (!id.safeParse(projectId).success || !z.enum(["TOP", "BOTTOM"]).safeParse(incomerFrom).success) return { ok: false, error: "Neplatný směr přívodu." };
  try {
    await guardProject(projectId);
    await setIncomer(prisma, projectId, incomerFrom);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Směr přívodu se nepodařilo uložit.");
  }
}

const rail = z.number().int().min(1).max(12);

/** „+ Přidat modul“ na konec DIN lišty. */
export async function addModuleAction(projectId: string, railIndex: number): Promise<ActionResult<{ id: string }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success) return { ok: false, error: "Neplatná DIN lišta." };
  try {
    await guardProject(projectId);
    const item = await addModule(prisma, projectId, railIndex);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { id: item.id } };
  } catch (error) {
    return failure(error, "Modul se nepodařilo přidat.");
  }
}

/** „Smazat prvek“ (chybně detekovaný modul). */
export async function deleteItemAction(itemId: string): Promise<ActionResult> {
  if (!id.safeParse(itemId).success) return { ok: false, error: "Neplatný prvek." };
  try {
    await guardItem(itemId);
    const result = await deleteItem(prisma, itemId);
    revalidatePath(`/panel-builder/${result.projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Prvek se nepodařilo smazat.");
  }
}

/** „Smazat celou lištu“ (falešně detekovaná lišta, např. svorkovnice PE/N). */
export async function deleteRailAction(projectId: string, railIndex: number): Promise<ActionResult<{ removed: number }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success) return { ok: false, error: "Neplatná DIN lišta." };
  try {
    await guardProject(projectId);
    const result = await deleteRail(prisma, projectId, railIndex);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Lištu se nepodařilo smazat.");
  }
}

/** „+ Přidat DIN lištu“. */
export async function addRailAction(projectId: string): Promise<ActionResult<{ dinRailsCount: number }>> {
  if (!id.safeParse(projectId).success) return { ok: false, error: "Neplatný projekt." };
  try {
    await guardProject(projectId);
    const result = await addRail(prisma, projectId);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Lištu se nepodařilo přidat.");
  }
}

export interface ComponentDatasheet {
  id: string;
  manufacturer: string;
  series: string;
  typeCode: string;
  articleNumber: string;
  description: string;
  symbol: SymbolKind;
  /** Hlavní parametry z katalogu (štítek → hodnota). */
  params: [string, string][];
  links: DatasheetLink[];
  /** Původ dat: výchozí katalog / datasheet PDF / AI / odhad IEC (+ zdrojový soubor a strana). */
  source: string;
}

const DATA_SOURCE_LABEL: Record<string, string> = { SEED_CATALOG: "výchozí katalog Eldocku", PDF_DATASHEET: "vytěženo z PDF datasheetu", GEMINI_AI: "dohledáno AI – ověřte", IEC_ESTIMATE: "ztrátový výkon odhadnut podle IEC" };

/** Fáze 58: náhled datasheetu přístroje – parametry z katalogu, značka dle ČSN EN 60617 a odkazy na podklady výrobce. */
export async function componentDatasheetAction(componentId: string): Promise<ActionResult<ComponentDatasheet>> {
  if (!id.safeParse(componentId).success) return { ok: false, error: "Neplatný prvek katalogu." };
  try {
    await guard();
    const row = await prisma.catalogComponent.findUnique({ where: { id: componentId } });
    if (!row) return { ok: false, error: "Prvek v katalogu neexistuje." };
    const num = (value: number | null, unit: string) => (value === null ? null : `${String(value).replace(".", ",")} ${unit}`);
    const params = (
      [
        ["Kategorie", CATEGORY_LABELS[row.category]],
        ["Póly", row.poles],
        ["Jmenovitý proud In", row.ratedCurrentA ? num(row.ratedCurrentA, "A") : null],
        ["Vypínací charakteristika", row.trippingCurve],
        ["Vypínací schopnost Icn", num(row.breakingCapacityKa, "kA")],
        ["Citlivost IΔn", num(row.rcdSensitivityMa, "mA")],
        ["Typ chrániče", row.rcdType],
        ["Typ SPD", row.spdType],
        ["Svodový proud", num(row.surgeCurrentKa, "kA")],
        ["Kontakty", row.contactConfig],
        ["Napětí cívky", row.coilVoltage],
        ["Šířka", num(row.modulesCount, "M")],
        ["Ztrátový výkon Pn", num(row.powerLossWatts, "W")],
        ["Rozměry", row.widthMm && row.heightMm ? `${row.widthMm} × ${row.heightMm}${row.depthMm ? ` × ${row.depthMm}` : ""} mm` : null],
        ["EAN", row.ean],
      ] as [string, string | null][]
    ).filter((entry): entry is [string, string] => Boolean(entry[1]));
    return {
      ok: true,
      data: {
        id: row.id,
        manufacturer: row.manufacturer,
        series: row.series,
        typeCode: row.typeCode,
        articleNumber: cleanArticle(row.articleNumber),
        description: row.description,
        symbol: symbolKindOf(row),
        params,
        links: datasheetLinks(row),
        source: [DATA_SOURCE_LABEL[row.dataSource] ?? row.dataSource, row.sourcePdfName ? `${row.sourcePdfName}${row.sourcePage ? `, str. ${row.sourcePage}` : ""}` : null].filter(Boolean).join(" · "),
      },
    };
  } catch (error) {
    return failure(error, "Datasheet se nepodařilo načíst.");
  }
}
