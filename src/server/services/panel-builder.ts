import type { PrismaClient } from "@/generated/prisma/client";
import type { EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";
import { buildSearchText, isMix } from "@/lib/panel-builder/catalog";
import { extractComponents, type ExtractedComponent } from "@/lib/panel-builder/datasheet-extract";
import type { EnclosureDims } from "@/lib/panel-builder/layout";
import { catalogCategory, configFromComponent, defaultConfig, matchConfig, parseConfig, polesForWidth, synthesizeComponent, type ItemConfig } from "@/lib/panel-builder/configurator";
import { parseBox, type BoundingBox } from "@/lib/panel-builder/layout";
import { DESIGNATION_PREFIX, compact, designationsInOrder, matchDetection, type Detection } from "@/lib/panel-builder/matching";
import { nextProjectCode, type ManufacturerInfo } from "@/lib/panel-builder/project";
import { releaseBlockers, type DocItem } from "@/lib/panel-builder/documentation";
import { thermalDevices, thermalEnclosure, type ThermalItemInput } from "@/lib/panel-builder/thermal-input";
import { ancestors, isConnected, isPhaseAssignment, renumber, treeNodeFrom, validateTree, type TreeAssignment } from "@/lib/panel-builder/tree";
import { calculateThermal } from "@/lib/thermalCalculation";
import { WorkflowError } from "@/lib/workflow/state-machine";

import type { AiMode, analyzePanelPhoto, lookupComponent } from "./geminiPanelService";

// AI Panel Builder – zápisy: katalog prvků (atomizace PDF datasheetů), projekty rozváděčů,
// výsledek analýzy fotky a přiřazení katalogových kusů (Smart Fallback Picker).

export interface DatasheetInput {
  fileName: string;
  /** Text stránek PDF (řádky), vytěžený v prohlížeči přes pdf.js. */
  pages: string[][];
}

export interface ImportedComponent {
  id: string;
  articleNumber: string;
  typeCode: string;
  manufacturer: string;
  category: ExtractedComponent["category"];
  description: string;
  powerLossWatts: number;
  status: "created" | "existing";
}

/** Extraktor prvků z PDF (Gemini, nebo deterministický z textu). */
export type DatasheetExtractor = (input: DatasheetInput) => Promise<{ components: ExtractedComponent[]; mode: "GEMINI" | "DEMO" }>;

type CatalogRow = Omit<ImportedComponent, "status">;
const summary = (row: CatalogRow, status: ImportedComponent["status"]): ImportedComponent => ({
  id: row.id,
  articleNumber: row.articleNumber,
  typeCode: row.typeCode,
  manufacturer: row.manufacturer,
  category: row.category,
  description: row.description,
  powerLossWatts: row.powerLossWatts,
  status,
});

export const textExtractor: DatasheetExtractor = async (input) => ({ components: extractComponents(input.pages), mode: "DEMO" });

/**
 * „Atomizovat PDF datasheet“: z PDF vytáhne jednotlivé přístroje a každý uloží jako samostatný
 * řádek katalogu. Existující objednací čísla se nepřepisují (katalog je zdroj pravdy pro výpočty).
 */
export async function importDatasheet(prisma: PrismaClient, input: DatasheetInput, extractor: DatasheetExtractor = textExtractor) {
  const { components, mode } = await extractor(input);
  if (!components.length) {
    throw new WorkflowError("VALIDATION", "V PDF jsem nenašel žádný přístroj s objednacím číslem. Nahrajte kusovník nebo katalogový list výrobce.");
  }
  const existing = new Map(
    (await prisma.catalogComponent.findMany({ where: { articleNumber: { in: components.map((c) => c.articleNumber) } } })).map((row) => [row.articleNumber, row]),
  );

  const result: ImportedComponent[] = [];
  for (const component of components) {
    const found = existing.get(component.articleNumber);
    if (found) {
      result.push(summary(found, "existing"));
      continue;
    }
    const { powerLossEstimated, sourcePage, ...fields } = component;
    const created = await prisma.catalogComponent.create({
      data: {
        ...fields,
        dataSource: mode === "GEMINI" ? "GEMINI_AI" : powerLossEstimated ? "IEC_ESTIMATE" : "PDF_DATASHEET",
        sourcePdfName: input.fileName.slice(0, 200),
        sourcePage,
        searchText: buildSearchText(component),
      },
    });
    existing.set(created.articleNumber, created);
    result.push(summary(created, "created"));
  }
  return { mode, components: result };
}

// ---------------------------------------------------------------------------
//  Projekty rozváděčů a analýza fotky (krok 1)
// ---------------------------------------------------------------------------

export interface CreateProjectInput {
  name: string;
  customerName: string | null;
  photoUrl: string | null;
  dominantManufacturer?: string;
  manufacturerInfo?: ManufacturerInfo;
  dims?: Partial<EnclosureDims & { depthMm: number }>;
  createdById?: string | null;
}

export async function createPanelProject(prisma: PrismaClient, input: CreateProjectInput) {
  const name = input.name.trim();
  if (!name) throw new WorkflowError("VALIDATION", "Zadejte název rozváděče.");
  const codes = (await prisma.panelBoardProject.findMany({ select: { code: true } })).map((row) => row.code);
  return prisma.panelBoardProject.create({
    data: {
      code: nextProjectCode(codes),
      name: name.slice(0, 120),
      customerName: input.customerName?.trim().slice(0, 120) || null,
      photoUrl: input.photoUrl,
      dominantManufacturer: input.dominantManufacturer ?? "ABB",
      manufacturerInfoJson: JSON.stringify(input.manufacturerInfo ?? {}),
      createdById: input.createdById ?? null,
      ...input.dims,
    },
  });
}

/**
 * Výsledek analýzy fotky → prvky projektu: každá detekce se spáruje s katalogem (VERIFIED /
 * PARTIAL / UNRECOGNIZED) a dostane IEC značení. Předchozí prvky projektu nahradí.
 */
export async function applyDetections(prisma: PrismaClient, projectId: string, detections: readonly Detection[], mode: AiMode, dominant: string | null) {
  if (!detections.length) throw new WorkflowError("VALIDATION", "Na fotce nebyl rozpoznán žádný přístroj.");
  const catalog = await prisma.catalogComponent.findMany({
    where: { category: { not: "ENCLOSURE" } },
    select: { id: true, manufacturer: true, typeCode: true, articleNumber: true, category: true, poles: true, ratedCurrentA: true, trippingCurve: true, modulesCount: true },
  });
  // „Různí výrobci“ (null): bez preference – každý modul se páruje podle vlastního výrobce.
  const manufacturer = isMix(dominant) ? null : dominant;
  const matches = detections.map((detection) => matchDetection(detection, catalog, manufacturer));
  const byId = new Map(catalog.map((component) => [component.id, component]));
  const designations = designationsInOrder(detections.map((detection, index) => byId.get(matches[index].componentId ?? "")?.category ?? detection.category));
  const rails = Math.max(...detections.map((detection) => detection.dinRailIndex));

  await prisma.$transaction(async (tx) => {
    await tx.panelBoardItem.deleteMany({ where: { projectId } });
    await tx.panelBoardItem.createMany({
      data: detections.map((detection, index) => {
        const match = matches[index];
        const component = byId.get(match.componentId ?? "");
        return {
          projectId,
          catalogComponentId: match.componentId,
          dinRailIndex: detection.dinRailIndex,
          positionOnRail: detection.positionOnRail,
          modulesWidth: component?.modulesCount || detection.modules,
          boundingBoxJson: detection.box ? JSON.stringify(detection.box) : null,
          recognitionStatus: match.status,
          confidence: Math.round(match.confidence * 100) / 100,
          rawOcrText: detection.rawOcrText || null,
          detectedJson: JSON.stringify({
            category: detection.category,
            poles: detection.poles,
            ratedCurrentA: detection.ratedCurrentA,
            trippingCurve: detection.trippingCurve,
            manufacturer: detection.manufacturer,
            modules: detection.modules,
          }),
          designation: detection.designation ?? designations[index],
          circuitLabel: detection.circuitLabel ?? "",
          sortOrder: index,
        };
      }),
    });
    const project = await tx.panelBoardProject.findUniqueOrThrow({ where: { id: projectId }, select: { dinRailsCount: true } });
    await tx.panelBoardProject.update({
      where: { id: projectId },
      data: { status: "RECOGNIZED", analysisMode: mode, dinRailsCount: Math.max(project.dinRailsCount, rails) },
    });
  });
  return { mode, total: detections.length, unresolved: matches.filter((match) => match.status !== "VERIFIED").length };
}

export type PhotoReader = (photoUrl: string) => Promise<{ bytes: Buffer; mimeType: string } | null>;

/** Krok 1: analýza fotky (Gemini nebo demo) a uložení rozpoznaných prvků. */
export async function analyzeProject(prisma: PrismaClient, projectId: string, deps: { analyze: typeof analyzePanelPhoto; readPhoto: PhotoReader }) {
  const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const image = project.photoUrl ? await deps.readPhoto(project.photoUrl) : null;
  const hint = isMix(project.dominantManufacturer) ? null : project.dominantManufacturer;
  const result = await deps.analyze({ image, dims: project, manufacturerHint: hint });
  const saved = await applyDetections(prisma, projectId, result.detections, result.mode, hint);
  return { ...saved, warning: result.warning };
}

/** Picker: přiřazení katalogového kusu k prvku (jedním klikem) → zelená. */
export async function assignCatalogComponent(prisma: PrismaClient, itemId: string, componentId: string) {
  const [item, component] = await Promise.all([
    prisma.panelBoardItem.findUnique({ where: { id: itemId }, select: { id: true } }),
    prisma.catalogComponent.findUnique({ where: { id: componentId } }),
  ]);
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  if (!component) throw new WorkflowError("NOT_FOUND", "Katalogový prvek neexistuje.");
  return prisma.panelBoardItem.update({
    where: { id: itemId },
    data: { catalogComponentId: component.id, recognitionStatus: "VERIFIED", confidence: 1, modulesWidth: component.modulesCount || 1 },
    select: { id: true, projectId: true },
  });
}

/**
 * „Dohledat v datasheetech“: nejdřív lokální katalog (typ / objednací číslo v textu), pak Gemini
 * (nebo deterministický odhad). Nový přístroj se trvale uloží do katalogu.
 */
export async function lookupComponentForItem(
  prisma: PrismaClient,
  input: { itemId: string; text: string; hints: Parameters<typeof lookupComponent>[0]["hints"] },
  lookup: typeof lookupComponent,
): Promise<{ mode: AiMode | "CATALOG"; component: ImportedComponent | null }> {
  const text = compact(input.text);
  if (text.length < 3) throw new WorkflowError("VALIDATION", "Opište alespoň část typového označení z čela přístroje (např. S201 B16).");
  if (!(await prisma.panelBoardItem.findUnique({ where: { id: input.itemId }, select: { id: true } }))) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");

  const local = (await prisma.catalogComponent.findMany({ where: { category: { not: "ENCLOSURE" } } }))
    .filter((row) => text.includes(compact(row.articleNumber)) || (compact(row.typeCode).length >= 4 && text.includes(compact(row.typeCode))))
    .sort((a, b) => compact(b.typeCode).length - compact(a.typeCode).length);
  if (local[0]) return { mode: "CATALOG", component: summary(local[0], "existing") };

  const { mode, component } = await lookup({ text: input.text, hints: input.hints });
  if (!component) return { mode, component: null };
  const existing = await prisma.catalogComponent.findUnique({ where: { articleNumber: component.articleNumber } });
  if (existing) return { mode, component: summary(existing, "existing") };
  const { powerLossEstimated, sourcePage, ...fields } = component;
  const created = await prisma.catalogComponent.create({
    data: {
      ...fields,
      dataSource: mode === "GEMINI" ? "GEMINI_AI" : powerLossEstimated ? "IEC_ESTIMATE" : "PDF_DATASHEET",
      sourcePage: mode === "GEMINI" ? null : sourcePage,
      searchText: buildSearchText(component),
    },
  });
  return { mode, component: summary(created, "created") };
}

// ---------------------------------------------------------------------------
//  Strom zapojení (krok 2)
// ---------------------------------------------------------------------------

const DESIGNATION = /^-[A-Z]{1,3}\d{1,3}$/;

/**
 * Uloží celý strom z editoru (rodič, napájení ze vstupu, fáze, popis obvodu, značení). Cykly a
 * duplicitní značení odmítne; ostatní nálezy hlídače jen vrátí. Plně zapojený strom = TREE_BUILT.
 */
export async function saveTree(prisma: PrismaClient, projectId: string, assignments: readonly TreeAssignment[]) {
  const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, include: { items: { include: { catalogComponent: true } } } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const ids = new Set(project.items.map((item) => item.id));
  const byAssignment = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  for (const assignment of assignments) {
    if (!ids.has(assignment.id)) throw new WorkflowError("VALIDATION", "Strom obsahuje prvek jiného projektu.");
    if (assignment.parentItemId && (!ids.has(assignment.parentItemId) || assignment.parentItemId === assignment.id)) throw new WorkflowError("VALIDATION", "Neplatný nadřazený prvek.");
    if (assignment.phaseAssignment && !isPhaseAssignment(assignment.phaseAssignment)) throw new WorkflowError("VALIDATION", "Neplatné přiřazení fáze.");
    if (!DESIGNATION.test(assignment.designation)) throw new WorkflowError("VALIDATION", `Neplatné značení „${assignment.designation}“ (např. -F3).`);
  }
  const nodes = project.items.map((item) => {
    const assignment = byAssignment.get(item.id);
    return treeNodeFrom(assignment ? { ...item, ...assignment, parentItemId: assignment.parentItemId, fedFromIncomer: assignment.parentItemId ? false : assignment.fedFromIncomer } : item);
  });
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const cyclic = nodes.find((node) => ancestors(node.id, byId) === null);
  if (cyclic) throw new WorkflowError("VALIDATION", `${cyclic.designation} by napájel sám sebe (cyklus ve stromu).`);
  const seen = new Map<string, string>();
  for (const node of nodes) {
    if (seen.has(node.designation)) throw new WorkflowError("VALIDATION", `Značení ${node.designation} je použito dvakrát – přečíslujte prvky.`);
    seen.set(node.designation, node.id);
  }

  const connected = nodes.every((node) => isConnected(node.id, byId));
  const status = project.status === "COMPLETED" ? "COMPLETED" : connected ? "TREE_BUILT" : project.status === "DRAFT" ? "DRAFT" : "RECOGNIZED";
  await prisma.$transaction([
    ...nodes.map((node) =>
      prisma.panelBoardItem.update({
        where: { id: node.id },
        data: { parentItemId: node.parentItemId, fedFromIncomer: node.fedFromIncomer, phaseAssignment: node.phaseAssignment, circuitLabel: node.circuitLabel.slice(0, 80), designation: node.designation },
      }),
    ),
    prisma.panelBoardProject.update({ where: { id: projectId }, data: { status } }),
  ]);
  return { status, connected, issues: validateTree(nodes, project.simultaneityFactor) };
}

// ---------------------------------------------------------------------------
//  Výpočet oteplení (krok 3) – vstupy skříně a výpočtové proudy vývodů
// ---------------------------------------------------------------------------

export interface ThermalInputs {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  enclosureType: EnclosureType;
  enclosureMaterial: EnclosureMaterial;
  ipRating: string;
  ambientTempC: number;
  simultaneityFactor: number;
  internalWiringLossW: number;
  /** Výpočtový proud Ib vývodu (null = In snížené na vnitřní teplotu). */
  operatingCurrents: { itemId: string; value: number | null }[];
}

export async function saveThermalInputs(prisma: PrismaClient, projectId: string, input: ThermalInputs) {
  const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, select: { id: true, items: { select: { id: true } } } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const ids = new Set(project.items.map((item) => item.id));
  if (input.operatingCurrents.some((entry) => !ids.has(entry.itemId))) throw new WorkflowError("VALIDATION", "Výpočtový proud patří prvku jiného projektu.");
  if (input.simultaneityFactor <= 0 || input.simultaneityFactor > 1) throw new WorkflowError("VALIDATION", "Koeficient soudobosti musí být v rozsahu 0–1.");
  const { operatingCurrents, ...enclosure } = input;
  await prisma.$transaction([
    prisma.panelBoardProject.update({ where: { id: projectId }, data: { ...enclosure, ipRating: enclosure.ipRating.trim().slice(0, 12) || "IP 41" } }),
    ...operatingCurrents.map((entry) => prisma.panelBoardItem.update({ where: { id: entry.itemId }, data: { operatingCurrentA: entry.value } })),
  ]);
}

// ---------------------------------------------------------------------------
//  Výstupní dokumentace (krok 4) – propuštění do provozu
// ---------------------------------------------------------------------------

/** Stav projektu pro dokumentaci: výpočet oteplení, zapojení a překážky propuštění. */
export function documentationState(project: {
  heightMm: number;
  widthMm: number;
  depthMm: number;
  enclosureType: EnclosureType;
  ambientTempC: number;
  simultaneityFactor: number;
  internalWiringLossW: number;
  items: (ThermalItemInput & DocItemSource)[];
}) {
  const nodes = project.items.map(treeNodeFrom);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const connected = nodes.every((node) => isConnected(node.id, byId));
  const thermal = calculateThermal(thermalDevices(project.items), thermalEnclosure(project));
  const docItems = project.items.map(toDocItem);
  const blockers = releaseBlockers({ items: docItems.map((item, index) => ({ ...item, recognitionStatus: project.items[index].recognitionStatus })), connected, thermalOk: thermal.ok });
  return { thermal, connected, docItems, blockers };
}

type DocItemSource = {
  dinRailIndex: number;
  positionOnRail: number;
  fedFromIncomer: boolean;
  recognitionStatus: string;
  catalogComponent: (ThermalItemInput["catalogComponent"] & { articleNumber: string; manufacturer: string }) | null;
};

export const toDocItem = (item: ThermalItemInput & DocItemSource): DocItem => ({
  id: item.id,
  designation: item.designation,
  circuitLabel: item.circuitLabel,
  dinRailIndex: item.dinRailIndex,
  positionOnRail: item.positionOnRail,
  parentItemId: item.parentItemId,
  fedFromIncomer: item.fedFromIncomer,
  component: item.catalogComponent
    ? { articleNumber: item.catalogComponent.articleNumber, typeCode: item.customTypeCode ?? item.catalogComponent.typeCode, manufacturer: item.catalogComponent.manufacturer, description: item.catalogComponent.description, category: item.catalogComponent.category }
    : null,
});

/**
 * „Propustit dokumentaci do provozu“: pasport se přiřadí ke kartě rozváděče v Eldocku a projekt se
 * uzavře (COMPLETED). Jen s potvrzenými přístroji, kompletním stromem a vyhovujícím oteplením.
 */
export async function releaseDocumentation(prisma: PrismaClient, projectId: string, equipmentId: string, now = new Date()) {
  const [project, equipment] = await Promise.all([
    prisma.panelBoardProject.findUnique({ where: { id: projectId }, include: { items: { include: { catalogComponent: true } } } }),
    prisma.equipment.findUnique({ where: { id: equipmentId }, select: { id: true, type: true, tag: true } }),
  ]);
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  if (equipment.type !== "SWITCHBOARD") throw new WorkflowError("VALIDATION", `${equipment.tag} není rozváděč – pasport lze přiřadit jen ke kartě rozváděče.`);
  const { blockers } = documentationState(project);
  if (blockers.length) throw new WorkflowError("VALIDATION", `Dokumentaci zatím nelze propustit: ${blockers.join(" ")}`);
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: { equipmentId, status: "COMPLETED", releasedAt: now } });
  return equipment;
}

// ---------------------------------------------------------------------------
//  Živý konfigurátor prvku (krok 1) – konfigurace, sloučení a rozdělení modulů
// ---------------------------------------------------------------------------

/** IEC značení celého projektu znovu v pořadí lišt (po sloučení / rozdělení / změně kategorie). */
async function renumberProject(prisma: PrismaClient, projectId: string) {
  const items = await prisma.panelBoardItem.findMany({ where: { projectId }, include: { catalogComponent: { select: { category: true } } } });
  const designations = renumber(items.map((item) => ({ id: item.id, category: item.catalogComponent?.category ?? null, dinRailIndex: item.dinRailIndex, positionOnRail: item.positionOnRail })));
  // Dvoufázově kvůli dočasným kolizím značení není potřeba (značení není unikátní v DB).
  await prisma.$transaction(items.filter((item) => designations.get(item.id) !== item.designation).map((item) => prisma.panelBoardItem.update({ where: { id: item.id }, data: { designation: designations.get(item.id)! } })));
}

/** Pozice na liště znovu 1..n zleva (po odebrání / přidání modulů). */
async function resequenceRail(prisma: PrismaClient, projectId: string, rail: number) {
  const items = await prisma.panelBoardItem.findMany({ where: { projectId, dinRailIndex: rail }, orderBy: [{ positionOnRail: "asc" }, { sortOrder: "asc" }] });
  await prisma.$transaction(items.map((item, index) => prisma.panelBoardItem.update({ where: { id: item.id }, data: { positionOnRail: index + 1, sortOrder: rail * 100 + index } })));
}

const unionBox = (boxes: (BoundingBox | null)[]): BoundingBox | null => {
  const valid = boxes.filter((box): box is BoundingBox => box !== null);
  if (!valid.length) return null;
  return [Math.min(...valid.map((b) => b[0])), Math.min(...valid.map((b) => b[1])), Math.max(...valid.map((b) => b[2])), Math.max(...valid.map((b) => b[3]))];
};

/**
 * Konfigurace z dlaždic: najde nejbližší přesný kus katalogu (jinak uloží odhad IEC), přiřadí ho,
 * nastaví šířku a stav VERIFIED. `mergeNeighbors`: širší přístroj pohltí sousední moduly vpravo.
 */
export async function configureItem(prisma: PrismaClient, itemId: string, config: ItemConfig, options: { mergeNeighbors?: boolean } = {}) {
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId }, include: { catalogComponent: { select: { category: true } } } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  if (options.mergeNeighbors && config.modules > item.modulesWidth) await absorbRight(prisma, item.id, config.modules);

  const catalog = await prisma.catalogComponent.findMany({ where: { category: catalogCategory(config) } });
  let component = matchConfig(catalog, config);
  if (!component) {
    const synthesized = synthesizeComponent(config);
    component = await prisma.catalogComponent.upsert({
      where: { articleNumber: synthesized.articleNumber },
      create: { ...synthesized, dataSource: "IEC_ESTIMATE", searchText: buildSearchText(synthesized) },
      update: {},
    });
  }
  await prisma.panelBoardItem.update({
    where: { id: itemId },
    data: { catalogComponentId: component.id, recognitionStatus: "VERIFIED", confidence: 1, modulesWidth: config.modules, configJson: JSON.stringify(config) },
  });
  if (DESIGNATION_PREFIX[item.catalogComponent?.category ?? "MCB"] !== DESIGNATION_PREFIX[component.category]) await renumberProject(prisma, item.projectId);
  return { projectId: item.projectId, component: summary(component, "existing"), estimated: component.dataSource === "IEC_ESTIMATE" };
}

/** Pohltí sousední moduly vpravo, dokud šířka nedosáhne cíle (chytré sloučení při volbě 3P / 4P). */
async function absorbRight(prisma: PrismaClient, itemId: string, targetModules: number) {
  const item = await prisma.panelBoardItem.findUniqueOrThrow({ where: { id: itemId } });
  const rail = await prisma.panelBoardItem.findMany({ where: { projectId: item.projectId, dinRailIndex: item.dinRailIndex }, orderBy: { positionOnRail: "asc" } });
  const start = rail.findIndex((entry) => entry.id === item.id);
  let width = item.modulesWidth;
  let count = 1;
  while (width < targetModules && rail[start + count]) width += rail[start + count++].modulesWidth;
  if (count > 1) await mergeItems(prisma, itemId, count, { keepConfig: true });
}

/**
 * Sloučí vybraný modul a `count − 1` sousedů vpravo na téže liště do jednoho přístroje: sečte šířku,
 * spojí rámečky na fotce, sousedy smaže (jejich potomky ve stromu převezme sloučený prvek), přečísluje.
 */
export async function mergeItems(prisma: PrismaClient, itemId: string, count: number, options: { keepConfig?: boolean } = {}) {
  if (count < 2 || count > 4) throw new WorkflowError("VALIDATION", "Sloučit lze 2 až 4 sousední moduly.");
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId }, include: { catalogComponent: true } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  const rail = await prisma.panelBoardItem.findMany({ where: { projectId: item.projectId, dinRailIndex: item.dinRailIndex }, orderBy: { positionOnRail: "asc" } });
  const start = rail.findIndex((entry) => entry.id === item.id);
  const group = rail.slice(start, start + count);
  if (group.length < count) throw new WorkflowError("VALIDATION", `Napravo od ${item.designation} nejsou na liště ${count - 1} další moduly ke sloučení.`);
  const absorbed = group.slice(1);
  const width = group.reduce((sum, entry) => sum + entry.modulesWidth, 0);
  const box = unionBox(group.map((entry) => parseBox(entry.boundingBoxJson)));
  const ids = absorbed.map((entry) => entry.id);

  await prisma.$transaction([
    prisma.panelBoardItem.updateMany({ where: { parentItemId: { in: ids } }, data: { parentItemId: item.id } }),
    prisma.panelBoardItem.deleteMany({ where: { id: { in: ids } } }),
    prisma.panelBoardItem.update({
      where: { id: item.id },
      data: {
        modulesWidth: width,
        boundingBoxJson: box ? JSON.stringify(box) : null,
        rawOcrText: group.map((entry) => entry.rawOcrText).filter(Boolean).join(" | ").slice(0, 200) || null,
        circuitLabel: item.circuitLabel || group.find((entry) => entry.circuitLabel)?.circuitLabel || "",
      },
    }),
  ]);
  await resequenceRail(prisma, item.projectId, item.dinRailIndex);

  // Známá kategorie → rovnou vícepólový přístroj stejných parametrů (3× 1P B16 → 3P B16).
  const base = parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null);
  if (!options.keepConfig) {
    if (base && base.category !== "OTHER" && base.category !== "RELAY") {
      const poles = polesForWidth(base.category, width);
      const config = { ...base, poles, modules: width, ...(base.category === "CONTACTOR" ? { contactConfig: `${poles.replace(/\D/g, "") || "2"}NO` } : {}) };
      await configureItem(prisma, item.id, config);
    } else {
      await prisma.panelBoardItem.update({ where: { id: item.id }, data: { recognitionStatus: "PARTIAL", catalogComponentId: null, confidence: 0.5 } });
    }
  }
  await renumberProject(prisma, item.projectId);
  return { projectId: item.projectId, width, removed: ids.length };
}

/** Rozdělí vícemodulový přístroj na jednotlivé 1M moduly (rámeček na fotce poměrně podle šířky). */
export async function splitItem(prisma: PrismaClient, itemId: string) {
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId }, include: { catalogComponent: true } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  const parts = Math.round(item.modulesWidth);
  if (parts < 2) throw new WorkflowError("VALIDATION", `${item.designation} má šířku 1 modul – není co rozdělit.`);
  const box = parseBox(item.boundingBoxJson);
  const slice = (index: number): string | null => {
    if (!box) return null;
    const [ymin, xmin, ymax, xmax] = box;
    const step = (xmax - xmin) / parts;
    return JSON.stringify([ymin, Math.round((xmin + step * index) * 100) / 100, ymax, Math.round((xmin + step * (index + 1)) * 100) / 100]);
  };
  const base = parseConfig(item.configJson) ?? (item.catalogComponent ? configFromComponent(item.catalogComponent) : null);
  // Za přístrojem se pozice posunou, nové moduly vloží hned za něj.
  const after = await prisma.panelBoardItem.findMany({ where: { projectId: item.projectId, dinRailIndex: item.dinRailIndex, positionOnRail: { gt: item.positionOnRail } } });
  await prisma.$transaction([
    ...after.map((entry) => prisma.panelBoardItem.update({ where: { id: entry.id }, data: { positionOnRail: entry.positionOnRail + parts - 1 } })),
    prisma.panelBoardItem.update({ where: { id: item.id }, data: { modulesWidth: 1, boundingBoxJson: slice(0), recognitionStatus: "PARTIAL", catalogComponentId: null } }),
    prisma.panelBoardItem.createMany({
      data: Array.from({ length: parts - 1 }, (_, index) => ({
        projectId: item.projectId,
        dinRailIndex: item.dinRailIndex,
        positionOnRail: item.positionOnRail + index + 1,
        modulesWidth: 1,
        boundingBoxJson: slice(index + 1),
        recognitionStatus: "UNRECOGNIZED" as const,
        confidence: 0.3,
        rawOcrText: item.rawOcrText,
        detectedJson: item.detectedJson,
        designation: `${item.designation}.${index + 1}`,
        sortOrder: item.sortOrder,
      })),
    }),
  ]);
  await resequenceRail(prisma, item.projectId, item.dinRailIndex);
  // Jistič / chránič / … známé kategorie → všechny díly jako 1P (resp. nejmenší varianta) stejných parametrů.
  if (base && base.category !== "OTHER" && base.category !== "RELAY") {
    const pieces = await prisma.panelBoardItem.findMany({
      where: { projectId: item.projectId, dinRailIndex: item.dinRailIndex, positionOnRail: { gte: item.positionOnRail, lt: item.positionOnRail + parts } },
    });
    for (const piece of pieces) {
      await configureItem(prisma, piece.id, { ...defaultConfig(base.category, { manufacturer: base.manufacturer, modules: 1, ratedCurrentA: base.ratedCurrentA, curve: base.curve }), ...(base.category === "MCB" ? { breakingCapacityKa: base.breakingCapacityKa ?? 6 } : {}) });
    }
  }
  await renumberProject(prisma, item.projectId);
  return { projectId: item.projectId, parts };
}

/** Ruční typové označení a popis obvodu z karty „Přiřazený přístroj“. */
export async function updateItemText(prisma: PrismaClient, itemId: string, input: { customTypeCode: string | null; circuitLabel: string }) {
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId }, select: { id: true, projectId: true } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  return prisma.panelBoardItem.update({
    where: { id: itemId },
    data: { customTypeCode: input.customTypeCode?.trim().slice(0, 80) || null, circuitLabel: input.circuitLabel.trim().slice(0, 80) },
    select: { id: true, projectId: true },
  });
}
