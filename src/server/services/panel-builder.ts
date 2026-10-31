import type { PrismaClient } from "@/generated/prisma/client";
import type { EnclosureMaterial, EnclosureType } from "@/generated/prisma/enums";
import { buildSearchText } from "@/lib/panel-builder/catalog";
import { extractComponents, type ExtractedComponent } from "@/lib/panel-builder/datasheet-extract";
import type { EnclosureDims } from "@/lib/panel-builder/layout";
import { compact, designationsInOrder, dominantManufacturer, matchDetection, type Detection } from "@/lib/panel-builder/matching";
import { nextProjectCode, type ManufacturerInfo } from "@/lib/panel-builder/project";
import { releaseBlockers, type DocItem } from "@/lib/panel-builder/documentation";
import { thermalDevices, thermalEnclosure, type ThermalItemInput } from "@/lib/panel-builder/thermal-input";
import { ancestors, isConnected, isPhaseAssignment, treeNodeFrom, validateTree, type TreeAssignment } from "@/lib/panel-builder/tree";
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
  const manufacturer = dominant ?? dominantManufacturer(detections);
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
      data: { status: "RECOGNIZED", analysisMode: mode, dominantManufacturer: manufacturer, dinRailsCount: Math.max(project.dinRailsCount, rails) },
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
  const result = await deps.analyze({ image, dims: project });
  const saved = await applyDetections(prisma, projectId, result.detections, result.mode, result.dominantManufacturer ?? project.dominantManufacturer);
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
    ? { articleNumber: item.catalogComponent.articleNumber, typeCode: item.catalogComponent.typeCode, manufacturer: item.catalogComponent.manufacturer, description: item.catalogComponent.description, category: item.catalogComponent.category }
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
