import type { PrismaClient } from "@/generated/prisma/client";
import { HIDDEN_MANUFACTURER_NAMES, isHiddenManufacturer } from "@/lib/panel-builder/brands";
import { catalogCategory, isCombAccessory, matchConfig, parseConfig, synthesizeComponent, type ItemConfig } from "@/lib/panel-builder/configurator";
import { parseChipSet, type ChipSet } from "@/lib/panel-builder/circuit-chips";
import { parseApplianceLibrary, parseApplianceList, type ApplianceLibrary } from "@/lib/panel-builder/appliances";
import { brandLabel, railLimits } from "@/lib/panel-builder/enclosure-choice";
import { enclosureProjectData, type EnclosureLike } from "@/lib/panel-builder/enclosures";
import { environmentOf, isEnvironmentId } from "@/lib/panel-builder/environments";
import { isStandardEdition, parseRoutineTest, routineTestVerdict, standardEditionOf, type RoutineTest } from "@/lib/legislation-2027";
import { freeOnRail, parseRailPhotos, railCapacities, railColumns, railMoveTarget, withRailCapacity, withRailsSwapped } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { addRail, componentForConfig, createPanelProject, renumberProject } from "./panel-builder";
import type { analyzeRailPhoto } from "./geminiPanelService";
import { isMix } from "@/lib/panel-builder/catalog";
import { matchDetection, type Detection } from "@/lib/panel-builder/matching";
import { planRailMerge, signatureFromItem, signatureOf } from "@/lib/panel-builder/rail-merge";
import { layoutPreviewDto, type LayoutChoice, type LayoutPreviewDto } from "@/lib/panel-builder/layout-options";
import { isCombSetting, type CombSetting } from "@/lib/panel-builder/comb-busbars";
import { SINGLE_LAYOUT, fillRailsToEnclosure, layoutAfterRailSwap, layoutNeed, layoutOptions, lowStartRail, matchLayoutEnclosures, normalizeLayout, packRails, parseRailLayout, planLayout, planTwoBoards, projectGroups, serializeRailLayout, withComb, withFields, type EnclosureMatch, type PlannedRail, type RailLayout } from "@/lib/panel-builder/rail-layout";
import type { FeederInfo } from "./panel-projects";

// Návrh rozváděče od nuly (fáze 43): kapacita a pořadí DIN lišt, osazení přístrojů z kaskádového
// menu (drag & drop, 1× / +3× / +6×), živá karta přiřazeného přístroje, výběr skříně a razítko firmy.

async function railProject(prisma: PrismaClient, projectId: string) {
  const project = await prisma.panelBoardProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      dinRailsCount: true,
      modulesPerRail: true,
      railModulesJson: true,
      railLayoutJson: true,
      enclosureFixed: true,
      enclosure: { select: { manufacturer: true, model: true, rows: true, modulesPerRow: true } },
      items: { select: { id: true, dinRailIndex: true, positionOnRail: true, modulesWidth: true } },
    },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  return { ...project, capacities: railCapacities(project) };
}

const decimal = (value: number) => String(Math.round(value * 10) / 10).replace(".", ",");

/** Šířka řady v modulech (presety 8 / 12 / 14 / 18 / 24 / 36M nebo − / + po 1 modulu). */
export async function setRailCapacity(prisma: PrismaClient, projectId: string, rail: number, modules: number) {
  const project = await railProject(prisma, projectId);
  if (rail < 1 || rail > project.capacities.length) throw new WorkflowError("VALIDATION", "Neplatná DIN lišta.");
  // Fáze 85: skříň zvolená při zakládání nepustí širší lištu, než má řadu
  const fixed = project.enclosureFixed ? project.enclosure : null;
  if (fixed && modules > railLimits(fixed).maxModules) throw new WorkflowError("VALIDATION", `Zvolená skříň ${brandLabel(fixed.manufacturer)} ${fixed.model} má řady po ${fixed.modulesPerRow} M – širší lištu nepustí (omezení uvolníte v kroku 3 Skříň).`);
  const capacities = withRailCapacity(project.capacities, rail, modules);
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: railColumns(capacities) });
  return { capacities, overflow: Math.max(0, -freeOnRail(capacities, project.items, rail)) };
}

/** Přesun lišty šipkou nahoru / dolů: prohodí přístroje i šířky sousedních lišt a přečísluje značení. */
export async function moveRail(prisma: PrismaClient, projectId: string, rail: number, direction: -1 | 1) {
  const project = await railProject(prisma, projectId);
  const target = railMoveTarget(project.capacities.length, rail, direction);
  if (!target) throw new WorkflowError("VALIDATION", direction < 0 ? "Lišta už je nahoře." : "Lišta už je dole.");
  await prisma.$transaction([
    ...project.items
      .filter((item) => item.dinRailIndex === rail || item.dinRailIndex === target)
      .map((item) => {
        const next = item.dinRailIndex === rail ? target : rail;
        return prisma.panelBoardItem.update({ where: { id: item.id }, data: { dinRailIndex: next, sortOrder: next * 100 + item.positionOnRail } });
      }),
    prisma.panelBoardProject.update({
      where: { id: projectId },
      data: {
        ...railColumns(withRailsSwapped(project.capacities, rail, target)),
        // Fáze 112: volba hřebenu se přesune s lištou
        ...(project.railLayoutJson ? { railLayoutJson: serializeRailLayout(layoutAfterRailSwap(parseRailLayout(project.railLayoutJson, project.capacities.length), rail, target, project.capacities.length)) } : {}),
      },
    }),
  ]);
  await renumberProject(prisma, projectId);
  return { rail: target };
}

/** Fáze 112: propojovací hřeben lišty – Auto (podle chrániče) / 3f / 1f / Vyp (uloženo v uspořádání projektu). */
export async function setRailComb(prisma: PrismaClient, projectId: string, rail: number, setting: CombSetting) {
  const project = await railProject(prisma, projectId);
  if (rail < 1 || rail > project.capacities.length) throw new WorkflowError("VALIDATION", "Neplatná DIN lišta.");
  if (!isCombSetting(setting)) throw new WorkflowError("VALIDATION", "Neplatná volba hřebenu.");
  const layout = withComb(parseRailLayout(project.railLayoutJson, project.capacities.length), rail, setting, project.capacities.length);
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: { railLayoutJson: serializeRailLayout(layout) } });
  return { rail, setting };
}

export interface PlaceInput {
  config: ItemConfig;
  rail: number;
  /** Kolik kusů vložit (1× / +3× / +6× nebo jedno přetažení). */
  count: number;
  /** Pozice na liště (1 = zleva), kam se kusy vloží; null = na konec lišty. */
  position?: number | null;
  circuitLabel?: string;
}

/**
 * Osazení z karty „Přiřazený přístroj k osazení“: vloží `count` stejných přístrojů na lištu (na konec
 * nebo na pozici), přiřadí přesný kus katalogu (jinak odhad IEC) a přečísluje IEC značení. Vloží jen
 * tolik kusů, kolik se na lištu vejde.
 */
export async function placeComponents(prisma: PrismaClient, projectId: string, input: PlaceInput) {
  const project = await railProject(prisma, projectId);
  if (input.rail < 1 || input.rail > project.capacities.length) throw new WorkflowError("VALIDATION", "Neplatná DIN lišta.");
  // Fáze 115: hřeben a koncovka hřebenu se na lištu nevkládají (zasouvají se do svorek, volba v záhlaví lišty)
  if (isCombAccessory(input.config)) throw new WorkflowError("VALIDATION", "Propojovací hřeben se nevkládá na DIN lištu jako modul – zvolte ho v záhlaví lišty tlačítkem „Hřeben: …“ (započítá se do kusovníku).");
  const requested = Math.min(24, Math.max(1, Math.round(input.count)));
  const free = freeOnRail(project.capacities, project.items, input.rail);
  // Fáze 81: kus chytré domácnosti má šířku podle katalogu (Miniserver 9 M, SysAP s adaptérem 7 M …)
  const component = await componentForConfig(prisma, input.config);
  const config = input.config.category === "SMART_HOME" && component.modulesCount > 0 ? { ...input.config, modules: component.modulesCount } : input.config;
  const fits = Math.min(requested, Math.floor((free + 1e-9) / config.modules));
  if (fits < 1) {
    throw new WorkflowError("VALIDATION", `Na lištu ${input.rail} se ${decimal(config.modules)}M přístroj už nevejde (volno ${decimal(Math.max(0, free))} M). Rozšiřte lištu nebo přidejte další řadu.`);
  }
  const onRail = project.items.filter((item) => item.dinRailIndex === input.rail).sort((a, b) => a.positionOnRail - b.positionOnRail);
  const insertAt = Math.min(Math.max(1, input.position ?? onRail.length + 1), onRail.length + 1);
  const shifted = onRail.filter((item) => item.positionOnRail >= insertAt);
  const created = await prisma.$transaction([
    ...shifted.map((item) => prisma.panelBoardItem.update({ where: { id: item.id }, data: { positionOnRail: item.positionOnRail + fits, sortOrder: input.rail * 100 + item.positionOnRail + fits } })),
    ...Array.from({ length: fits }, (_, index) =>
      prisma.panelBoardItem.create({
        data: {
          projectId,
          catalogComponentId: component.id,
          dinRailIndex: input.rail,
          positionOnRail: insertAt + index,
          modulesWidth: config.modules,
          recognitionStatus: "VERIFIED",
          confidence: 1,
          configJson: JSON.stringify(config),
          circuitLabel: (input.circuitLabel ?? "").trim().slice(0, 80),
          designation: "-X99",
          sortOrder: input.rail * 100 + insertAt + index,
        },
      }),
    ),
  ]);
  await renumberProject(prisma, projectId);
  return { ids: created.slice(shifted.length).map((row) => row.id), placed: fits, requested, typeCode: component.typeCode };
}

/**
 * Fáze 93: oprava Elektro-linteru 1 klikem – přístroje (spoušť CENTRAL STOP, elektroměr MID, okruh B zdravotnického
 * prostoru) na první lištu s volným místem, jinak na novou DIN lištu (pokud ji skříň pustí).
 */
export async function placeLintDevices(prisma: PrismaClient, projectId: string, devices: readonly { config: ItemConfig; label: string }[]) {
  const placed: { rail: number; typeCode: string }[] = [];
  for (const device of devices) {
    const project = await railProject(prisma, projectId);
    let rail = project.capacities.findIndex((_, index) => freeOnRail(project.capacities, project.items, index + 1) + 1e-9 >= device.config.modules) + 1;
    if (rail < 1) {
      const added = await addRail(prisma, projectId);
      rail = added.dinRailsCount;
    }
    const result = await placeComponents(prisma, projectId, { config: device.config, rail, count: 1, position: null, circuitLabel: device.label });
    placed.push({ rail, typeCode: result.typeCode });
  }
  return placed;
}

export interface ConfigPreview {
  manufacturer: string;
  typeCode: string;
  articleNumber: string | null;
  powerLossWatts: number;
  modules: number;
  /** Kus v katalogu není – parametry z konfigurátoru, Pv odhadnut dle IEC. */
  estimated: boolean;
  /** Příslušenství z databáze (pomocné kontakty, spouště, hřebeny, vložky) – nejvýš 6. */
  accessories: { typeCode: string; articleNumber: string; relationType: string; verified: boolean; description: string }[];
  accessoryCount: number;
}

/** Živá karta „Přiřazený přístroj k osazení“: přesný kus pro konfiguraci (nic nezapisuje), jinak odhad IEC. */
export async function previewConfig(prisma: PrismaClient, config: ItemConfig): Promise<ConfigPreview> {
  const catalog = await prisma.catalogComponent.findMany({ where: { category: catalogCategory(config), manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } } });
  const component = matchConfig(catalog, config);
  // Syntetický kus z konfigurátoru (CFG-…) = jen odhad; skutečný kus s odhadnutým Pv si MPN ponechá
  if (!component || component.articleNumber.startsWith("CFG-")) {
    const synthesized = synthesizeComponent(config);
    return { manufacturer: synthesized.manufacturer, typeCode: synthesized.typeCode, articleNumber: null, powerLossWatts: synthesized.powerLossWatts, modules: config.modules, estimated: true, accessories: [], accessoryCount: 0 };
  }
  const [relations, accessoryCount] = await Promise.all([
    prisma.catalogRelation.findMany({
      where: { parentId: component.id },
      orderBy: [{ verified: "desc" }, { relationType: "desc" }],
      take: 6,
      select: { relationType: true, verified: true, child: { select: { typeCode: true, articleNumber: true, description: true } } },
    }),
    prisma.catalogRelation.count({ where: { parentId: component.id } }),
  ]);
  return {
    manufacturer: component.manufacturer,
    typeCode: component.typeCode,
    articleNumber: component.articleNumber,
    powerLossWatts: component.powerLossWatts,
    // Fáze 81: kus chytré domácnosti má šířku podle katalogu
    modules: config.category === "SMART_HOME" && component.modulesCount > 0 ? component.modulesCount : config.modules,
    estimated: component.dataSource === "IEC_ESTIMATE",
    accessories: relations.map((relation) => ({ ...relation.child, relationType: relation.relationType, verified: relation.verified })),
    accessoryCount,
  };
}

/** Skříně jednoho výrobce (filtr podle velikosti návrhu dělá `fitEnclosures` v UI i v testech). */
export function listEnclosures(prisma: PrismaClient, manufacturer: string) {
  return prisma.panelEnclosure.findMany({ where: { manufacturer }, orderBy: [{ totalModules: "asc" }, { rows: "asc" }, { model: "asc" }] });
}

/** Výběr skříně: rozměry, krytí, materiál, způsob instalace a P_max se propíšou do projektu a oteplení. */
export async function selectEnclosure(prisma: PrismaClient, projectId: string, enclosureId: string) {
  const enclosure = await prisma.panelEnclosure.findUnique({ where: { id: enclosureId } });
  if (!enclosure) throw new WorkflowError("NOT_FOUND", "Skříň v katalogu neexistuje.");
  return prisma.panelBoardProject.update({ where: { id: projectId }, data: { enclosureId, ...enclosureProjectData(enclosure) }, select: { id: true, enclosureModel: true, widthMm: true, heightMm: true, depthMm: true, enclosurePmaxW: true } });
}

/** Fáze 85: uvolnění omezení lišt skříní zvolenou při zakládání (skříň zůstává vybraná). */
export function releaseEnclosureLimit(prisma: PrismaClient, projectId: string) {
  return prisma.panelBoardProject.update({ where: { id: projectId }, data: { enclosureFixed: false }, select: { id: true, enclosureFixed: true } });
}

/** Logo a razítko firmy (URL nahraného souboru; null = odebrat). */
export async function setCompanyBranding(prisma: PrismaClient, companyId: string, input: { logoUrl?: string | null; stampUrl?: string | null }) {
  return prisma.registeredCompany.update({
    where: { id: companyId },
    data: { ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}), ...(input.stampUrl !== undefined ? { stampUrl: input.stampUrl } : {}) },
    select: { id: true, logoUrl: true, stampUrl: true },
  });
}

/** Prostředí instalace (fáze 45): uloží prostředí a teplotu okolí pro výpočet oteplení; výslovná volba = potvrzení (fáze 57). */
export async function setEnvironment(prisma: PrismaClient, projectId: string, environmentId: string) {
  if (!isEnvironmentId(environmentId)) throw new WorkflowError("VALIDATION", "Neznámé prostředí instalace.");
  const environment = environmentOf(environmentId);
  return prisma.panelBoardProject.update({ where: { id: projectId }, data: { environment: environment.id, ambientTempC: environment.ambientTempC, environmentConfirmedAt: new Date() }, select: { id: true, environment: true, ambientTempC: true } });
}

/** Štítky funkce obvodu firmy: uloží se jen novější sada (vyhrává novější `updatedAt`). */
export async function saveCircuitChips(prisma: PrismaClient, companyId: string, set: ChipSet) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { circuitChipsJson: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const stored = parseChipSet(company.circuitChipsJson);
  if (stored && stored.updatedAt >= set.updatedAt) return { saved: false, set: stored };
  const clean = parseChipSet(JSON.stringify(set));
  if (!clean) throw new WorkflowError("VALIDATION", "Neplatné štítky.");
  await prisma.registeredCompany.update({ where: { id: companyId }, data: { circuitChipsJson: JSON.stringify(clean) } });
  return { saved: true, set: clean };
}

/** Fáze 63: knihovna samostatných spotřebičů firmy (2D půdorys) – uloží se jen novější knihovna (vyhrává `updatedAt`). */
export async function saveApplianceLibrary(prisma: PrismaClient, companyId: string, library: ApplianceLibrary) {
  const company = await prisma.registeredCompany.findUnique({ where: { id: companyId }, select: { applianceLibraryJson: true } });
  if (!company) throw new WorkflowError("NOT_FOUND", "Firma neexistuje.");
  const stored = parseApplianceLibrary(company.applianceLibraryJson);
  if (stored && stored.updatedAt >= library.updatedAt) return { saved: false, library: stored };
  const clean: ApplianceLibrary = { specs: parseApplianceList(library.specs), updatedAt: library.updatedAt };
  await prisma.registeredCompany.update({ where: { id: companyId }, data: { applianceLibraryJson: JSON.stringify(clean) } });
  return { saved: true, library: clean };
}

/** Edice normy rozváděče (fáze 46): DBO 61439-3 ed. 2, PSC 61439-2 ed. 3, strojní 60204-1 ed. 3. */
export async function setStandardEdition(prisma: PrismaClient, projectId: string, edition: string) {
  if (!isStandardEdition(edition)) throw new WorkflowError("VALIDATION", "Neznámá edice normy.");
  return prisma.panelBoardProject.update({ where: { id: projectId }, data: { standardEdition: edition, norm: standardEditionOf(edition).short }, select: { id: true, standardEdition: true } });
}

/** Protokol o kusové zkoušce (čl. 11 ČSN EN IEC 61439-1 ed. 3) – uloží normalizovaný JSON. */
export async function saveRoutineTest(prisma: PrismaClient, projectId: string, test: RoutineTest) {
  const clean = parseRoutineTest(JSON.stringify(test));
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: { routineTestJson: JSON.stringify(clean) } });
  return { test: clean, ...routineTestVerdict(clean) };
}

/**
 * Pravidlo F (fáze 47): přístroje jedné lišty z ostré detailní fotky – ostatní lišty zůstanou beze změny.
 * Potomci smazaných přístrojů ve stromu zapojení se odpojí (strom se pak doplní v kroku 2).
 */
export async function applyRailDetections(prisma: PrismaClient, projectId: string, rail: number, detections: readonly Detection[], dominant: string | null) {
  if (!detections.length) return { total: 0, unresolved: 0, merged: false, unmatched: false };
  const catalog = await prisma.catalogComponent.findMany({
    where: { category: { not: "ENCLOSURE" }, manufacturer: { notIn: HIDDEN_MANUFACTURER_NAMES } },
    select: { id: true, manufacturer: true, typeCode: true, articleNumber: true, category: true, poles: true, ratedCurrentA: true, trippingCurve: true, rcdType: true, rcdSensitivityMa: true, modulesCount: true },
  });
  const manufacturer = isMix(dominant) ? null : dominant;
  const ordered = [...detections].sort((a, b) => a.positionOnRail - b.positionOnRail);
  const matches = ordered.map((detection) => matchDetection(detection, catalog, manufacturer));
  const byId = new Map(catalog.map((component) => [component.id, component]));
  const old = await prisma.panelBoardItem.findMany({
    where: { projectId, dinRailIndex: rail },
    orderBy: { positionOnRail: "asc" },
    select: { id: true, modulesWidth: true, detectedJson: true, recognitionStatus: true, confidence: true, circuitLabel: true },
  });
  const detectedJsonOf = (detection: Detection) =>
    JSON.stringify({ category: detection.category, poles: detection.poles, ratedCurrentA: detection.ratedCurrentA, trippingCurve: detection.trippingCurve, rcdType: detection.rcdType ?? null, rcdSensitivityMa: detection.rcdSensitivityMa ?? null, manufacturer: detection.manufacturer, modules: detection.modules });

  // Fáze 56: detail jen části lišty přístroje zpřesní, nic nemaže (zapojení stromu zůstane).
  const plan = planRailMerge(old.map(signatureFromItem), ordered.map(signatureOf));
  if (plan.mode === "enrich") {
    // Přístroj potvrzený uživatelem (výběr z katalogu = VERIFIED s jistotou 1) se nepřepisuje.
    const pairs = plan.pairs.filter(([existing]) => !(old[existing].recognitionStatus === "VERIFIED" && old[existing].confidence >= 1));
    await prisma.$transaction(
      pairs.map(([existing, index]) =>
        prisma.panelBoardItem.update({
          where: { id: old[existing].id },
          data: {
            catalogComponentId: matches[index].componentId,
            recognitionStatus: matches[index].status,
            confidence: Math.round(matches[index].confidence * 100) / 100,
            rawOcrText: ordered[index].rawOcrText || null,
            detectedJson: detectedJsonOf(ordered[index]),
            ...(old[existing].circuitLabel ? {} : { circuitLabel: ordered[index].circuitLabel ?? "" }),
          },
        }),
      ),
    );
    return { total: pairs.length, unresolved: pairs.filter(([, index]) => matches[index].status !== "VERIFIED").length, merged: true, unmatched: plan.pairs.length === 0 };
  }
  await prisma.$transaction([
    prisma.panelBoardItem.updateMany({ where: { parentItemId: { in: old.map((item) => item.id) } }, data: { parentItemId: null, fedFromIncomer: false } }),
    prisma.panelBoardItem.deleteMany({ where: { id: { in: old.map((item) => item.id) } } }),
    prisma.panelBoardItem.createMany({
      data: ordered.map((detection, index) => {
        const match = matches[index];
        const component = byId.get(match.componentId ?? "");
        return {
          projectId,
          catalogComponentId: match.componentId,
          dinRailIndex: rail,
          positionOnRail: index + 1,
          modulesWidth: detection.modules || component?.modulesCount || 1,
          recognitionStatus: match.status,
          confidence: Math.round(match.confidence * 100) / 100,
          rawOcrText: detection.rawOcrText || null,
          detectedJson: detectedJsonOf(detection),
          designation: "-X99",
          circuitLabel: detection.circuitLabel ?? "",
          sortOrder: rail * 100 + index,
        };
      }),
    }),
  ]);
  await renumberProject(prisma, projectId);
  return { total: ordered.length, unresolved: matches.filter((match) => match.status !== "VERIFIED").length, merged: false, unmatched: false };
}

/** Detailní fotka lišty / sekce: uloží fotku k liště a (s Gemini) přečte přístroje lišty z ostrého detailu. */
export async function analyzeRailDetail(
  prisma: PrismaClient,
  projectId: string,
  rail: number,
  photoUrl: string,
  deps: { analyze: typeof analyzeRailPhoto; readPhoto: (url: string) => Promise<{ bytes: Buffer; mimeType: string } | null> },
) {
  const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, select: { railPhotosJson: true, dominantManufacturer: true, dinRailsCount: true, coverState: true } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  if (rail < 1 || rail > Math.max(project.dinRailsCount, 1)) throw new WorkflowError("VALIDATION", "Neplatná DIN lišta.");
  const photos = { ...parseRailPhotos(project.railPhotosJson), [String(rail)]: photoUrl };
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: { railPhotosJson: JSON.stringify(photos) } });
  const hint = isMix(project.dominantManufacturer) ? null : project.dominantManufacturer;
  const result = await deps.analyze({ image: await deps.readPhoto(photoUrl), rail, manufacturerHint: hint, mode: project.coverState === "UNCOVERED" ? "UNCOVERED" : "COVERED" });
  const saved = await applyRailDetections(prisma, projectId, rail, result.detections, hint);
  const warning = saved.unmatched ? `Detail lišty ${rail} neodpovídá žádnému úseku lišty – přístroje zůstaly beze změny (zkontrolujte číslo lišty u fotky).` : result.warning;
  return { mode: result.mode, ...saved, warning };
}

/**
 * Fáze 51: kombinovaná analýza při založení projektu – po celkové fotce (topologie lišt) se každá
 * detailní fotka / snímek z videa přečte jako detail své lišty (ostré hodnoty B10 / B16 / DS301C …).
 * Lišta mimo rozpoznaný rozváděč se přeskočí s upozorněním; chyba jedné lišty nezastaví ostatní.
 */
export async function analyzeRailDetails(
  prisma: PrismaClient,
  projectId: string,
  photos: readonly { rail: number; url: string }[],
  deps: Parameters<typeof analyzeRailDetail>[4],
) {
  const project = await prisma.panelBoardProject.findUnique({ where: { id: projectId }, select: { dinRailsCount: true } });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const rails = Math.max(project.dinRailsCount, 1);
  // Fáze 56: víc detailů jedné lišty (dlouhá řada po kouscích) se přečte VŠECHNY – dřív zůstal jen poslední.
  const ordered = [...new Map(photos.map((photo) => [photo.url, photo])).values()].sort((a, b) => a.rail - b.rail);
  const warnings: string[] = [];
  let analyzed = 0;
  for (const photo of ordered) {
    if (photo.rail > rails) {
      warnings.push(`Detail lišty ${photo.rail} přeskočen – AI rozpoznala jen ${rails} ${rails === 1 ? "lištu" : rails < 5 ? "lišty" : "lišt"}.`);
      continue;
    }
    try {
      const result = await analyzeRailDetail(prisma, projectId, photo.rail, photo.url, deps);
      analyzed++;
      if (result.warning) warnings.push(`Lišta ${photo.rail}: ${result.warning}`);
    } catch (error) {
      warnings.push(`Lišta ${photo.rail}: ${error instanceof Error ? error.message : "detail se nepodařilo zpracovat"}`);
    }
  }
  return { analyzed, warnings: [...new Set(warnings)] };
}

/**
 * Fáze 59: přesun osazeného přístroje na jinou pozici téže lišty nebo na jinou lištu (◀ ▶, výběr lišty, přetažení).
 * Na cílové liště musí být místo; obě lišty se přečíslují, IEC značení se přepočítá, strom zapojení (rodič / potomci)
 * i konfigurace přístroje zůstávají.
 */
export async function moveItem(prisma: PrismaClient, itemId: string, rail: number, position: number) {
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId }, select: { id: true, projectId: true, dinRailIndex: true, positionOnRail: true, modulesWidth: true, designation: true } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  const project = await railProject(prisma, item.projectId);
  if (rail < 1 || rail > project.capacities.length) throw new WorkflowError("VALIDATION", "Neplatná DIN lišta.");
  if (rail !== item.dinRailIndex && freeOnRail(project.capacities, project.items, rail) + 1e-9 < item.modulesWidth) {
    throw new WorkflowError("VALIDATION", `Na lištu ${rail} se ${item.designation} (${decimal(item.modulesWidth)}M) nevejde – rozšiřte lištu nebo uvolněte místo.`);
  }
  const byPosition = (a: { positionOnRail: number }, b: { positionOnRail: number }) => a.positionOnRail - b.positionOnRail;
  const target = project.items.filter((entry) => entry.dinRailIndex === rail && entry.id !== item.id).sort(byPosition);
  const at = Math.min(Math.max(1, Math.round(position)), target.length + 1);
  target.splice(at - 1, 0, { ...item, dinRailIndex: rail });
  const source = rail !== item.dinRailIndex ? project.items.filter((entry) => entry.dinRailIndex === item.dinRailIndex && entry.id !== item.id).sort(byPosition) : [];
  const updates = [
    ...target.map((entry, index) => ({ id: entry.id, rail, position: index + 1 })),
    ...source.map((entry, index) => ({ id: entry.id, rail: item.dinRailIndex, position: index + 1 })),
  ];
  await prisma.$transaction(updates.map((entry) => prisma.panelBoardItem.update({ where: { id: entry.id }, data: { dinRailIndex: entry.rail, positionOnRail: entry.position, sortOrder: entry.rail * 100 + entry.position } })));
  await renumberProject(prisma, item.projectId);
  return { projectId: item.projectId, rail, position: at };
}

/**
 * „➕ Přidat prvek vpravo“ (prázdný nerozpoznaný 1M modul) a „📑 Duplikovat prvek“ (přesná kopie
 * se stejným katalogovým kusem a konfigurací) hned napravo od vybraného přístroje; přístroje vpravo se posunou.
 */
export async function insertNextTo(prisma: PrismaClient, itemId: string, mode: "blank" | "duplicate") {
  const item = await prisma.panelBoardItem.findUnique({ where: { id: itemId } });
  if (!item) throw new WorkflowError("NOT_FOUND", "Prvek rozváděče neexistuje.");
  const right = await prisma.panelBoardItem.findMany({ where: { projectId: item.projectId, dinRailIndex: item.dinRailIndex, positionOnRail: { gt: item.positionOnRail } }, select: { id: true, positionOnRail: true } });
  const duplicate = mode === "duplicate";
  const created = await prisma.$transaction(async (tx) => {
    for (const row of right) await tx.panelBoardItem.update({ where: { id: row.id }, data: { positionOnRail: row.positionOnRail + 1, sortOrder: item.dinRailIndex * 100 + row.positionOnRail + 1 } });
    return tx.panelBoardItem.create({
      data: {
        projectId: item.projectId,
        dinRailIndex: item.dinRailIndex,
        positionOnRail: item.positionOnRail + 1,
        sortOrder: item.dinRailIndex * 100 + item.positionOnRail + 1,
        modulesWidth: duplicate ? item.modulesWidth : 1,
        catalogComponentId: duplicate ? item.catalogComponentId : null,
        configJson: duplicate ? item.configJson : null,
        customTypeCode: duplicate ? item.customTypeCode : null,
        circuitLabel: duplicate ? item.circuitLabel : "",
        phaseAssignment: duplicate ? item.phaseAssignment : null,
        recognitionStatus: duplicate ? item.recognitionStatus : "UNRECOGNIZED",
        confidence: duplicate ? item.confidence : 0,
        designation: "-X99",
      },
      select: { id: true },
    });
  });
  await renumberProject(prisma, item.projectId);
  return { id: created.id, projectId: item.projectId };
}

// ---------------------------------------------------------------------------
//  Fáze 111: 📐 Uspořádání skříně a lišt (Silnoproud / Slaboproud) v AI Panel Builderu
// ---------------------------------------------------------------------------

const round2 = (value: number) => Math.round(value * 100) / 100;

async function visibleEnclosures(prisma: PrismaClient) {
  return (await prisma.panelEnclosure.findMany({ orderBy: { totalModules: "asc" } })).filter((row) => !HIDDEN_MANUFACTURER_NAMES.includes(row.manufacturer) && !isHiddenManufacturer(row.manufacturer));
}

/** Projekt s přístroji pro koncepce (kategorie z konfigurace, jinak z katalogu; ztráty z katalogového kusu). */
async function layoutProject(prisma: PrismaClient, projectId: string) {
  const project = await prisma.panelBoardProject.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      code: true,
      name: true,
      customerName: true,
      installationSite: true,
      companyId: true,
      createdById: true,
      manufacturerInfoJson: true,
      dominantManufacturer: true,
      supplyPhases: true,
      networkSystem: true,
      occupancy: true,
      boardCode: true,
      parentBoardId: true,
      dinRailsCount: true,
      modulesPerRail: true,
      railModulesJson: true,
      railLayoutJson: true,
      enclosureFixed: true,
      items: { select: { id: true, dinRailIndex: true, positionOnRail: true, modulesWidth: true, designation: true, circuitLabel: true, parentItemId: true, configJson: true, catalogComponent: { select: { category: true, powerLossWatts: true } } } },
    },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const items = project.items.map((item) => {
    const config = parseConfig(item.configJson);
    return {
      id: item.id,
      dinRailIndex: item.dinRailIndex,
      positionOnRail: item.positionOnRail,
      modulesWidth: item.modulesWidth,
      designation: item.designation,
      circuitLabel: item.circuitLabel,
      parentItemId: item.parentItemId,
      category: config ? catalogCategory(config) : (item.catalogComponent?.category ?? null),
      powerLossW: item.catalogComponent?.powerLossWatts ?? 0,
    };
  });
  const manufacturer = project.dominantManufacturer && project.dominantManufacturer !== "MIX" ? project.dominantManufacturer : null;
  return { project, items, manufacturer };
}

/** Náhled čtyř koncepcí pro osazený projekt (průvodce z horní lišty plátna). */
export async function previewProjectLayouts(prisma: PrismaClient, projectId: string): Promise<LayoutPreviewDto> {
  const { items, manufacturer } = await layoutProject(prisma, projectId);
  if (!items.length) throw new WorkflowError("VALIDATION", "Rozváděč zatím nemá přístroje – nejdřív je osaďte, pak zvolte uspořádání skříně a lišt.");
  const groups = projectGroups(items);
  const options = layoutOptions(groups, await visibleEnclosures(prisma), { manufacturer, limit: 3 });
  return layoutPreviewDto(options, {
    totalModules: round2(items.reduce((sum, item) => sum + item.modulesWidth, 0)),
    totalPowerLossW: round2(items.reduce((sum, item) => sum + item.powerLossW, 0)),
    smart: groups.some((group) => group.low),
  });
}

const pickMatch = <E extends EnclosureLike>(matches: readonly EnclosureMatch<E>[], id: string | null | undefined) =>
  (id ? matches.find((match) => match.enclosure.id === id) : null) ?? matches[0] ?? null;

const slotsOf = <T extends { id: string }>(rails: readonly PlannedRail<T>[]) => rails.flatMap((rail, index) => rail.devices.map((device, position) => ({ id: device.id, rail: index + 1, position: position + 1 })));

/**
 * Přeuspořádání osazeného projektu podle koncepce: přístroje na lišty (skupina chrániče pohromadě, slaboproud
 * v pravém poli / za přepážkou), šířky lišt, uspořádání a skříň z databáze. Dva rozváděče: slaboproud do nového
 * propojeného projektu RH2 (napájení z jističe řídicích obvodů v RH1), bez odečtu kreditu.
 */
export async function applyProjectLayout(prisma: PrismaClient, projectId: string, choice: LayoutChoice) {
  const { project, items, manufacturer } = await layoutProject(prisma, projectId);
  if (!items.length) throw new WorkflowError("VALIDATION", "Rozváděč zatím nemá přístroje.");
  const groups = projectGroups(items);
  const enclosures = await visibleEnclosures(prisma);
  const lossW = items.reduce((sum, item) => sum + item.powerLossW, 0);
  let mainRails: PlannedRail<(typeof items)[number]>[];
  let layout: RailLayout;
  let enclosure: (typeof enclosures)[number] | null;
  let second: { rails: PlannedRail<(typeof items)[number]>[]; enclosure: (typeof enclosures)[number] | null } | null = null;
  if (choice.concept === "two_boards") {
    if (project.parentBoardId) throw new WorkflowError("VALIDATION", "Podružný rozváděč nejde rozdělit na další dva – zvolte jinou koncepci.");
    const boards = planTwoBoards(groups, enclosures, manufacturer);
    layout = { ...SINGLE_LAYOUT, concept: "two_boards" };
    enclosure = pickMatch(boards.main.matches, choice.enclosureId)?.enclosure ?? null;
    // Fáze 114: větší rozvodnice z průvodce – tolik DIN lišt, kolik má skříň řad
    mainRails = choice.fillRows && enclosure ? fillRailsToEnclosure(boards.main.rails, layout, enclosure).rails : boards.main.rails;
    if (boards.second) {
      const secondEnclosure = pickMatch(boards.second.matches, choice.secondEnclosureId)?.enclosure ?? null;
      second = { rails: choice.fillRows && secondEnclosure ? fillRailsToEnclosure(boards.second.rails, SINGLE_LAYOUT, secondEnclosure).rails : boards.second.rails, enclosure: secondEnclosure };
    }
  } else {
    const plan = planLayout(groups, choice.concept);
    const need = layoutNeed(plan.rails, plan.layout.fields, lossW);
    const matches = matchLayoutEnclosures(enclosures, need, { manufacturer, exactWidth: choice.concept !== "two_field", limit: 400 });
    enclosure = pickMatch(matches, choice.enclosureId)?.enclosure ?? null;
    // Fáze 114: větší rozvodnice s rezervou – prázdné DIN lišty do řad zvolené skříně
    const filled = choice.fillRows && enclosure ? fillRailsToEnclosure(plan.rails, plan.layout, enclosure) : { rails: plan.rails, layout: plan.layout };
    mainRails = filled.rails;
    layout = filled.layout;
  }
  const mainSlots = slotsOf(mainRails);
  await prisma.$transaction([
    ...mainSlots.map((slot) => prisma.panelBoardItem.update({ where: { id: slot.id }, data: { dinRailIndex: slot.rail, positionOnRail: slot.position, sortOrder: slot.rail * 100 + slot.position } })),
    prisma.panelBoardProject.update({
      where: { id: projectId },
      data: {
        ...railColumns(mainRails.map((rail) => rail.capacity)),
        railLayoutJson: serializeRailLayout(normalizeLayout(layout, mainRails.length)),
        // Skříň z průvodce: rozměry, krytí a P_max do oteplení; omezení lišt na řady skříně se uvolní (lišty dává koncepce)
        ...(enclosure ? { enclosureId: enclosure.id, enclosureFixed: false, ...enclosureProjectData(enclosure) } : {}),
        ...(second ? { boardCode: project.boardCode ?? "RH1" } : {}),
      },
    }),
  ]);
  let secondId: string | null = null;
  if (second) {
    const created = await createPanelProject(prisma, {
      name: `${project.name} – RH2 Slaboproud / Smart Home`.slice(0, 120),
      customerName: project.customerName,
      installationSite: project.installationSite,
      photoUrl: null,
      designMode: "DESIGN",
      companyId: project.companyId,
      createdById: project.createdById,
      dominantManufacturer: project.dominantManufacturer,
      manufacturerInfo: JSON.parse(project.manufacturerInfoJson || "{}"),
      occupancy: project.occupancy,
    });
    const slots = slotsOf(second.rails);
    const moved = new Set(slots.map((slot) => slot.id));
    const parentOf = new Map(items.map((item) => [item.id, item.parentItemId]));
    const supply = items.find((item) => item.circuitLabel === "Ovládání a řídicí obvody" && !moved.has(item.id));
    const info: FeederInfo = { board: "RH2", fromBoard: project.boardCode ?? "RH1", fromProjectId: project.id, fromProjectCode: project.code, designation: supply?.designation ?? null, protection: "B6 1P", cable: "CYKY-J 3×1,5", lengthM: 1, voltageDropPct: 0, designW: Math.max(10, Math.round(second.rails.reduce((sum, rail) => sum + rail.devices.reduce((acc, device) => acc + device.powerLossW, 0), 0))) };
    await prisma.$transaction([
      // Přesun přístrojů do RH2; vazba na rodiče v RH1 končí – vrchol stromu RH2 je napájený z přívodu
      ...slots.map((slot) => {
        const parent = parentOf.get(slot.id) ?? null;
        return prisma.panelBoardItem.update({ where: { id: slot.id }, data: { projectId: created.id, dinRailIndex: slot.rail, positionOnRail: slot.position, sortOrder: slot.rail * 100 + slot.position, ...(parent && !moved.has(parent) ? { parentItemId: null, fedFromIncomer: true } : {}) } });
      }),
      prisma.panelBoardItem.updateMany({ where: { projectId, parentItemId: { in: [...moved] } }, data: { parentItemId: null } }),
      prisma.panelBoardProject.update({
        where: { id: created.id },
        data: {
          ...railColumns(second.rails.map((rail) => rail.capacity)),
          supplyPhases: project.supplyPhases,
          networkSystem: project.networkSystem,
          boardCode: "RH2",
          parentBoardId: project.id,
          feederJson: JSON.stringify(info),
          ...(second.enclosure ? { enclosureId: second.enclosure.id, ...enclosureProjectData(second.enclosure) } : {}),
        },
      }),
    ]);
    await renumberProject(prisma, created.id);
    secondId = created.id;
  }
  await renumberProject(prisma, projectId);
  return { rails: mainRails.length, layout, enclosure: enclosure ? `${brandLabel(enclosure.manufacturer)} ${enclosure.model}` : null, secondId, secondRails: second?.rails.length ?? 0 };
}

/**
 * „Šířka všech lišt: 12M / 18M / 24M / 36M“ – všechny lišty najednou a přístroje znovu na lišty nové šířky (skupina
 * chrániče pohromadě, slaboproud v pravém poli / za přepážkou / na vlastní liště); prázdné lišty zmizí. Skříň zvolená při
 * zakládání omezí šířku.
 */
export async function setAllRailCapacities(prisma: PrismaClient, projectId: string, modules: number) {
  const rails = await railProject(prisma, projectId);
  const fixed = rails.enclosureFixed ? rails.enclosure : null;
  if (fixed && modules > railLimits(fixed).maxModules) throw new WorkflowError("VALIDATION", `Zvolená skříň ${brandLabel(fixed.manufacturer)} ${fixed.model} má řady po ${fixed.modulesPerRow} M – širší lišty nepustí (omezení uvolníte v kroku 3 Skříň).`);
  const { project, items } = await layoutProject(prisma, projectId);
  const count = Math.max(1, project.dinRailsCount);
  const current = parseRailLayout(project.railLayoutJson, count);
  if (!items.length) {
    const capacities = rails.capacities.map(() => modules);
    await prisma.panelBoardProject.update({ where: { id: projectId }, data: railColumns(capacities) });
    return { rails: capacities.length, layout: current };
  }
  const groups = projectGroups(items);
  const plan =
    current.fields === 2
      ? planLayout(groups, "two_field", { railModules: modules })
      : current.partitionAfterRail
        ? planLayout(groups, "wide24", { railModules: modules })
        : { rails: packRails(groups, modules).map((rail) => ({ ...rail, field: 0 as const, low: false })), layout: current };
  const layout = normalizeLayout({ ...plan.layout, concept: current.concept }, plan.rails.length);
  const slots = slotsOf(plan.rails);
  await prisma.$transaction([
    ...slots.map((slot) => prisma.panelBoardItem.update({ where: { id: slot.id }, data: { dinRailIndex: slot.rail, positionOnRail: slot.position, sortOrder: slot.rail * 100 + slot.position } })),
    prisma.panelBoardProject.update({ where: { id: projectId }, data: { ...railColumns(plan.rails.map(() => modules)), ...(project.railLayoutJson || layout.fields === 2 || layout.partitionAfterRail ? { railLayoutJson: serializeRailLayout(layout) } : {}) } }),
  ]);
  await renumberProject(prisma, projectId);
  return { rails: plan.rails.length, layout };
}

/**
 * „Sloupce (Pole): 1 pole / 2 pole vedle sebe (Silnoproud | Slaboproud)“ – dvě pole dělí lišty podle první lišty se
 * slaboproudem (PLC, zdroje, moduly chytré domácnosti), jinak napůl; `fieldARails` posune hranici polí.
 */
export async function setRailFields(prisma: PrismaClient, projectId: string, fields: 1 | 2, fieldARails?: number | null) {
  const project = await prisma.panelBoardProject.findUnique({
    where: { id: projectId },
    select: { dinRailsCount: true, railLayoutJson: true, items: { select: { dinRailIndex: true, configJson: true, catalogComponent: { select: { category: true } } } } },
  });
  if (!project) throw new WorkflowError("NOT_FOUND", "Projekt rozváděče neexistuje.");
  const count = Math.max(1, project.dinRailsCount);
  if (fields === 2 && count < 2) throw new WorkflowError("VALIDATION", "Pro 2 pole vedle sebe potřebuje rozváděč aspoň 2 DIN lišty – přidejte lištu.");
  const current = parseRailLayout(project.railLayoutJson, count);
  const lowStart = lowStartRail(project.items.map((item) => {
    const config = parseConfig(item.configJson);
    return { dinRailIndex: item.dinRailIndex, category: config ? catalogCategory(config) : (item.catalogComponent?.category ?? null) };
  }));
  let layout = withFields(current, count, fields, lowStart);
  if (fields === 2 && fieldARails) layout = normalizeLayout({ ...layout, fieldARails }, count);
  await prisma.panelBoardProject.update({ where: { id: projectId }, data: { railLayoutJson: serializeRailLayout(layout) } });
  return { layout };
}

