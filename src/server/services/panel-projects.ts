import type { CableSummary } from "@/engine/cable-routing";
import { buildSwitchboardFromCircuits, generateCircuitsFromFloorplan, type InstallLevel, type InstallMethod } from "@/engine/floorplan-bridge";
import { floorplanFromSchedule, sanitizeSchedule, type ScheduleRoom } from "@/engine/room-schedule";
import type { PrismaClient } from "@/generated/prisma/client";
import { isHiddenManufacturer } from "@/lib/panel-builder/brands";
import { enclosureProjectData } from "@/lib/panel-builder/enclosures";
import { allElements, analyzeDraft, floorsOf, paletteItem, parseDraft, type CableReport, type EditorElement, type FloorplanDraft, type FrameGroup, type PlanBuild } from "@/lib/panel-builder/floorplan-editor";
import { gangsOf } from "@/lib/panel-builder/floorplan-frames";
import { environmentOf } from "@/lib/panel-builder/environments";
import { pickWiringDevice, type WiringNeed } from "@/lib/panel-builder/wiring-picker";
import { DEFAULT_COLOR, dbSeriesFor, designColor } from "@/lib/panel-builder/wiring-designs";
import { isSampleProject, projectUploads, refundsCredit } from "@/lib/panel-builder/project-admin";
import { railColumns } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { componentForConfig, createPanelProject, renumberProject, saveTree, type CreateProjectInput } from "./panel-builder";
import { describeConfig } from "@/lib/panel-builder/configurator";
import { isSystemDevice } from "@/lib/panel-builder/manufacturer-transfer";
import { sameManufacturer } from "@/lib/panel-builder/matching";
import { isPhaseAssignment, type PhaseAssignment } from "@/lib/panel-builder/tree";
import { buildSearchText } from "@/lib/panel-builder/catalog";
import { smartPlanOf } from "@/lib/panel-builder/smart-home-plan";
import { supplyById, supplyColumns } from "@/lib/panel-builder/supply";

// Správa projektů AI Panel Builderu (fáze 48): smazání (jednotlivě i hromadně) s vrácením kreditu
// a úklidem fotek, úprava hlavičky projektu přímo z přehledu.

export interface DeleteResult {
  deleted: number;
  refunded: number;
  /** Vynechané projekty (vzorový PB-001 při hromadném mazání). */
  skipped: string[];
  removedFiles: number;
}

/**
 * Smaže projekty firmy v jedné transakci (prvky a jejich domovní přístroje kaskádou). Za každý
 * nedokončený projekt mimo vzorový PB-001 vrátí 1 kredit. Fotky projektu se pak fyzicky smažou
 * z `storage/uploads` – kromě `seed/` a souborů, na které dál odkazuje jiný projekt.
 */
export async function deletePanelProjects(
  prisma: PrismaClient,
  companyId: string,
  ids: readonly string[],
  options: { protectSample?: boolean; removeFile?: (url: string) => Promise<boolean> } = {},
): Promise<DeleteResult> {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new WorkflowError("VALIDATION", "Vyberte alespoň jeden projekt.");
  const found = await prisma.panelBoardProject.findMany({ where: { id: { in: unique }, companyId }, select: { id: true, code: true, status: true, photoUrl: true, railPhotosJson: true } });
  if (found.length !== unique.length) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  const skipped = options.protectSample ? found.filter(isSampleProject).map((project) => project.code) : [];
  const targets = found.filter((project) => !skipped.includes(project.code));
  if (!targets.length) return { deleted: 0, refunded: 0, skipped, removedFiles: 0 };

  const refunded = targets.filter(refundsCredit).length;
  const targetIds = targets.map((project) => project.id);
  await prisma.$transaction([
    prisma.panelBoardProject.deleteMany({ where: { id: { in: targetIds }, companyId } }),
    ...(refunded ? [prisma.registeredCompany.update({ where: { id: companyId }, data: { creditsRemaining: { increment: refunded } } })] : []),
  ]);

  // Soubory až po potvrzené transakci; sdílené fotky (stejná URL v jiném projektu) zůstanou
  let removedFiles = 0;
  const urls = [...new Set(targets.flatMap(projectUploads))];
  if (urls.length && options.removeFile) {
    const others = await prisma.panelBoardProject.findMany({
      where: { OR: urls.flatMap((url) => [{ photoUrl: url }, { railPhotosJson: { contains: url } }]) },
      select: { photoUrl: true, railPhotosJson: true },
    });
    const stillUsed = new Set(others.flatMap(projectUploads));
    for (const url of urls) if (!stillUsed.has(url) && (await options.removeFile(url))) removedFiles++;
  }
  return { deleted: targets.length, refunded, skipped, removedFiles };
}

export interface ProjectHeaderInput {
  name: string;
  customerName: string | null;
  installationSite: string | null;
  /** Fáze 55: soustava přívodu – mění `supplyPhases` a `networkSystem`. */
  supplySystem?: string;
}

/** Rychlá úprava hlavičky z přehledu: název rozváděče, zákazník a místo instalace. */
export async function updateProjectHeader(prisma: PrismaClient, projectId: string, input: ProjectHeaderInput) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new WorkflowError("VALIDATION", "Zadejte název rozváděče.");
  const clean = (value: string | null) => value?.trim().slice(0, 120) || null;
  return prisma.panelBoardProject.update({
    where: { id: projectId },
    data: { name, customerName: clean(input.customerName), installationSite: clean(input.installationSite), ...(input.supplySystem ? supplyColumns(supplyById(input.supplySystem)) : {}) },
    select: { id: true, name: true, customerName: true, installationSite: true },
  });
}

// ---------------------------------------------------------------------------
//  Nový projekt ze soupisu místností (most „půdorys → rozváděč“, ČSN 33 2130 ed. 4)
// ---------------------------------------------------------------------------

export interface ScheduleProjectInput extends Omit<CreateProjectInput, "photoUrl" | "designMode" | "dims"> {
  rooms: readonly ScheduleRoom[];
  mode: InstallLevel;
  /** Fáze 52: způsob uložení kabelů a počítání dvojzásuvky jako 2 zásuvek (ČSN 33 2130 ed. 4). */
  installMethod?: InstallMethod;
  countDoubleAsTwo?: boolean;
}

/**
 * Soupis místností → okruhy → přístroje na lištách → nový návrh rozváděče (DESIGN): lišty podle
 * vybrané skříně (25 % rezerva, P_max), každý přístroj s konfigurací, katalogovým kusem a funkcí obvodu.
 */
export async function createProjectFromSchedule(prisma: PrismaClient, input: ScheduleProjectInput) {
  const rooms = sanitizeSchedule(input.rooms);
  if (!rooms.length) throw new WorkflowError("VALIDATION", "Zadejte alespoň jednu místnost.");
  const { plan, calibration } = floorplanFromSchedule(rooms, input.mode);
  const circuits = generateCircuitsFromFloorplan(plan, calibration, { installMethod: input.installMethod, countDoubleAsTwo: input.countDoubleAsTwo });
  if (!circuits.circuits.length) throw new WorkflowError("VALIDATION", "Soupis neobsahuje žádný vývod (zásuvky, světla nebo spotřebiče).");
  const enclosures = (await prisma.panelEnclosure.findMany({ orderBy: { totalModules: "asc" } })).filter((row) => !isHiddenManufacturer(row.manufacturer));
  const board = buildSwitchboardFromCircuits(circuits, { mode: input.mode, enclosures, supplyPhases: supplyById(input.supplySystem).phases });

  return createPlanProject(prisma, input, circuits, board);
}

type CircuitPlanResult = ReturnType<typeof generateCircuitsFromFloorplan>;
type SwitchboardResult = ReturnType<typeof buildSwitchboardFromCircuits>;

/**
 * Nový návrh (DESIGN) z vypočteného rozváděče: lišty podle vybrané skříně, každý přístroj s konfigurací,
 * katalogovým kusem a funkcí obvodu. `afterItems` dostane prvky v pořadí přístrojů rozváděče. Při chybě
 * se nedokončený projekt smaže.
 */
async function createPlanProject(
  prisma: PrismaClient,
  input: Omit<CreateProjectInput, "photoUrl" | "designMode" | "dims">,
  circuits: CircuitPlanResult,
  board: SwitchboardResult,
  options: {
    data?: { floorplanJson?: string; cableReportJson?: string; environment?: string; ambientTempC?: number; environmentConfirmedAt?: Date; dominantManufacturer?: string };
    afterItems?: (items: { id: string; device: SwitchboardResult["devices"][number] }[]) => Promise<string[]>;
    /** Fáze 60: jeden výrobce celého rozváděče (chybějící kus = odhad stejného výrobce, nikdy jiný výrobce). */
    manufacturer?: string | null;
  } = {},
) {
  const project = await createPanelProject(prisma, { ...input, photoUrl: null, designMode: "DESIGN" });
  try {
    await prisma.panelBoardProject.update({
      where: { id: project.id },
      data: {
        ...railColumns(board.rails.map((rail) => rail.capacity)),
        ...(board.enclosure ? { enclosureId: board.enclosure.id, ...enclosureProjectData(board.enclosure) } : {}),
        ...options.data,
      },
    });
    const devices = board.rails.flatMap((rail) => rail.devices.map((device, index) => ({ rail: rail.index, position: index + 1, device })));
    const rows = [];
    const estimated = new Set<string>();
    for (const { rail, position, device } of devices) {
      // Fáze 60: celý rozváděč od jednoho výrobce; systémové prvky chytré instalace zůstávají u svého systému
      const config = options.manufacturer && !isSystemDevice(device.config) && !device.article ? { ...device.config, manufacturer: options.manufacturer } : device.config;
      // Fáze 61: akční členy chytré domácnosti = přesný kus podle objednacího čísla (chybí-li v databázi, založí se)
      const component = device.article ? await componentForArticle(prisma, device.article, config) : await componentForConfig(prisma, config);
      if (options.manufacturer && !device.article && config.manufacturer === options.manufacturer && (component.dataSource === "IEC_ESTIMATE" || component.articleNumber.startsWith("CFG-"))) estimated.add(describeConfig(config));
      device.config = config;
      rows.push({
        projectId: project.id,
        catalogComponentId: component.id,
        dinRailIndex: rail,
        positionOnRail: position,
        modulesWidth: device.modules,
        recognitionStatus: "VERIFIED" as const,
        confidence: 1,
        configJson: JSON.stringify(device.config),
        // Příklad typu v závorce („např. …“) nepatří do funkce obvodu
        circuitLabel: device.label.replace(/\s*\(např\.[^)]*\)/, "").slice(0, 80),
        designation: device.designation,
        sortOrder: rail * 100 + position,
      });
    }
    await prisma.panelBoardItem.createMany({ data: rows });
    await renumberProject(prisma, project.id);
    const created = await prisma.panelBoardItem.findMany({ where: { projectId: project.id }, orderBy: [{ dinRailIndex: "asc" }, { positionOnRail: "asc" }], select: { id: true, designation: true, circuitLabel: true } });
    // Fáze 60: strom zapojení podle hierarchie generátoru (hlavní vypínač → SPD / chrániče → jejich jističe, řídicí obvody)
    const itemOfKey = new Map(created.map((item, index) => [devices[index].device.key, item.id]));
    await saveTree(
      prisma,
      project.id,
      created.map((item, index) => {
        const device = devices[index].device;
        return { id: item.id, designation: item.designation, circuitLabel: item.circuitLabel, parentItemId: device.parentKey ? (itemOfKey.get(device.parentKey) ?? null) : null, fedFromIncomer: device.parentKey === null, phaseAssignment: phaseAssignmentOf(device) };
      }),
    );
    const extraWarnings = options.afterItems ? await options.afterItems(created.map((item, index) => ({ id: item.id, device: devices[index].device }))) : [];
    const manufacturerWarnings = estimated.size ? [`${options.manufacturer} v databázi prvků nemá: ${[...estimated].join(", ")} – přístroje mají parametry návrhu a odhad ztrát dle IEC (ověřte, případně vyberte typ v konfigurátoru).`] : [];
    return { id: project.id, devices: rows.length, circuits: circuits.circuits.length, enclosure: board.enclosure?.model ?? null, manufacturer: options.manufacturer ?? null, warnings: [...manufacturerWarnings, ...circuits.warnings, ...board.warnings, ...extraWarnings] };
  } catch (error) {
    // Nedokončený návrh nenechávat v přehledu
    await prisma.panelBoardProject.delete({ where: { id: project.id } });
    throw error;
  }
}

// ---------------------------------------------------------------------------
//  Nový projekt z 2D půdorysu elektroinstalace (fáze 49)
// ---------------------------------------------------------------------------

export interface FloorplanProjectInput extends Omit<CreateProjectInput, "photoUrl" | "designMode" | "dims"> {
  draft: unknown;
  /** Fáze 60: výrobce přístrojů celého rozváděče (výchozí ABB). */
  manufacturer?: string | null;
}

/** Fáze 61: katalogový kus podle objednacího čísla (akční člen chytré domácnosti); bez čísla odhad podle konfigurace. */
async function componentForArticle(prisma: PrismaClient, article: NonNullable<SwitchboardResult["devices"][number]["article"]>, config: Parameters<typeof componentForConfig>[1]) {
  if (!article.articleNumber) return componentForConfig(prisma, { ...config, manufacturer: article.manufacturer });
  const existing = await prisma.catalogComponent.findUnique({ where: { articleNumber: article.articleNumber } });
  if (existing) return existing;
  const fields = {
    manufacturer: article.manufacturer,
    series: article.series ?? article.manufacturer,
    typeCode: article.typeCode,
    articleNumber: article.articleNumber,
    category: config.moduleSubtype === "PSU_DC" ? ("PSU" as const) : ("PLC" as const),
    poles: "1P",
    ratedCurrentA: 0,
    moduleSubtype: config.moduleSubtype ?? "PLC",
    modulesCount: config.modules,
    widthMm: config.modules * 17.5,
    powerLossWatts: Math.max(1, config.modules * 0.5),
    description: article.description,
  };
  return prisma.catalogComponent.create({ data: { ...fields, dataSource: "IEC_ESTIMATE", searchText: buildSearchText(fields) } });
}

/** Fáze přístroje ve stromu (1P+N / 2P → „L1,N“, 4P / 3P+N → „L1,L2,L3,N“). */
function phaseAssignmentOf(device: Pick<SwitchboardResult["devices"][number], "phase" | "poles">): PhaseAssignment | null {
  const phase = device.phase;
  if (!phase) return null;
  const neutral = /\+N|^2P$|^4P$/.test(device.poles);
  const value = phase === "L1,L2,L3" ? (neutral ? "L1,L2,L3,N" : "L1,L2,L3") : phase.includes(",") ? phase : neutral ? `${phase},N` : phase;
  return isPhaseAssignment(value) ? value : null;
}

/** Výpočet nad nákresem: okruhy a výkaz kabeláže (bez zápisu do DB). */
export function analyzeFloorplan(draft: FloorplanDraft) {
  try {
    return analyzeDraft(draft);
  } catch (error) {
    throw new WorkflowError("VALIDATION", error instanceof Error ? error.message : "Neplatný půdorys.");
  }
}

export function cableReportOf(summary: CableSummary, profile: FloorplanDraft["profile"]): CableReport {
  return {
    mode: summary.selected,
    totals: summary.totals,
    savingVsBottomM: summary.savingVsBottomM,
    savingVsTopM: summary.savingVsTopM,
    byCable: summary.byCable,
    circuits: summary.circuits.map((row) => ({ label: row.label, cable: row.cable, routing: row.routing, lengthM: row.lengthsM[summary.selected], longestM: row.longestM, voltageDropPct: row.voltageDropPct, limitPct: row.limitPct, ok: row.ok })),
    profile: { ceilingHeightMm: profile.ceilingHeightMm, switchboardHeightMm: profile.switchboardHeightMm, defaultSocketHeightMm: profile.defaultSocketHeightMm, worktopSocketHeightMm: profile.worktopSocketHeightMm, defaultSwitchHeightMm: profile.defaultSwitchHeightMm, slackPercent: profile.slackPercent },
  };
}

/**
 * „⚡ Vygenerovat rozváděč z tohoto půdorysu“: okruhy dle ČSN 33 2130 ed. 4, přístroje, fáze, skříň,
 * domovní přístroje vybrané řady přiřazené k jističům (po místnostech) a uložený výkaz kabeláže.
 */
export async function createProjectFromFloorplan(prisma: PrismaClient, input: FloorplanProjectInput) {
  const draft = parseDraft(input.draft);
  if (!draft) throw new WorkflowError("VALIDATION", "Půdorys se nepodařilo načíst.");
  const { build, circuits, summary } = analyzeFloorplan(draft);
  if (!circuits.circuits.length) throw new WorkflowError("VALIDATION", "V půdorysu není žádný silový vývod (zásuvka, světlo nebo spotřebič).");
  const enclosures = (await prisma.panelEnclosure.findMany({ orderBy: { totalModules: "asc" } })).filter((row) => !isHiddenManufacturer(row.manufacturer));
  // Fáze 55: soustava z nákresu půdorysu (přepínač v editoru), jinak z dialogu
  const supply = supplyById(draft.supplySystem ?? input.supplySystem);
  // Fáze 60: skříň přednostně od výrobce přístrojů, jinak nejmenší vyhovující z databáze
  const manufacturer = input.manufacturer?.trim() || "ABB";
  const own = enclosures.filter((row) => sameManufacturer(row.manufacturer, manufacturer));
  // Fáze 61: chytrá domácnost – akční členy, zdroj a rozhraní zvoleného systému do rozváděče
  const smartPlan = smartPlanOf(draft);
  const smart = smartPlan?.modules.map((unit) => ({ role: unit.role, label: unit.label, manufacturer: smartPlan.system.manufacturer, series: smartPlan.system.label.replace(/\s*\(.*\)$/, ""), typeCode: unit.typeCode, articleNumber: unit.articleNumber, modules: unit.modules }));
  const preferred = own.length ? buildSwitchboardFromCircuits(circuits, { mode: draft.installation, enclosures: own, supplyPhases: supply.phases, smart }) : null;
  const board = preferred?.enclosure ? preferred : buildSwitchboardFromCircuits(circuits, { mode: draft.installation, enclosures, supplyPhases: supply.phases, smart });
  const header = { name: input.name, customerName: input.customerName, installationSite: input.installationSite, companyId: input.companyId, manufacturerInfo: input.manufacturerInfo, createdById: input.createdById, supplySystem: supply.id };
  // Fáze 57: prostředí dle ČSN 33 2000-5-51 ed. 3 zvolené v půdorysu = potvrzené prostředí dokumentace
  const environment = draft.environment ? environmentOf(draft.environment) : null;
  return createPlanProject(prisma, header, circuits, board, {
    data: {
      floorplanJson: JSON.stringify(draft),
      cableReportJson: JSON.stringify(cableReportOf(summary, draft.profile)),
      ...(environment ? { environment: environment.id, ambientTempC: environment.ambientTempC, environmentConfirmedAt: new Date() } : {}),
      dominantManufacturer: manufacturer,
    },
    manufacturer,
    afterItems: async (items) => [...(smartPlan?.warnings ?? []).map((warning) => `Chytrá domácnost (${smartPlan!.system.label}): ${warning}`), ...(await assignWiringDevices(prisma, items, circuits, build, draft))],
  });
}

/**
 * Domovní přístroje řady a barvy ke každému jističi (fáze 49, rozšířeno ve fázi 51): zásuvky, rámečky,
 * vypínače světel po místnostech (S5, S6+6, tlačítka, LED, IP44, stmívač, PIR), žaluziové ovladače
 * a termostaty (k okruhu světel své místnosti).
 */
async function assignWiringDevices(prisma: PrismaClient, items: { id: string; device: SwitchboardResult["devices"][number] }[], circuits: CircuitPlanResult, build: PlanBuild, draft: FloorplanDraft): Promise<string[]> {
  const everything = allElements(draft);
  const keys = [...new Set([draft.series, ...everything.map((element) => element.series)])].map((key) => dbSeriesFor(key)).filter((key): key is NonNullable<typeof key> => key !== null);
  // Fáze 59: víceramečky (všechna podlaží) – jeden rámeček NR za skupinu k jističi kotvy
  const groupOf = new Map<string, FrameGroup>();
  for (const floor of floorsOf(draft)) for (const group of floor.frames) for (const id of group.members) groupOf.set(id, group);
  const frameItem = new Map<string, string>();
  const devices = keys.length
    ? await prisma.wiringDevice.findMany({ where: { OR: keys.map((key) => ({ manufacturer: key.manufacturer, series: { in: key.series } })) }, select: { id: true, manufacturer: true, series: true, category: true, title: true, frameUnits: true, ipRating: true, featuresJson: true } })
    : [];
  const ofSeries = (key: string | null) => {
    const parsed = dbSeriesFor(key ?? draft.series);
    return parsed ? devices.filter((device) => device.manufacturer === parsed.manufacturer && parsed.series.includes(device.series)) : [];
  };
  const rows = new Map<string, { itemId: string; wiringDeviceId: string; room: string; quantity: number }>();
  const missing = new Set<string>();
  const add = (itemId: string, element: EditorElement, need: WiringNeed, quantity: number, label: string) => {
    const color = designColor(element.color ?? draft.color) ?? designColor(DEFAULT_COLOR)!;
    const device = pickWiringDevice(ofSeries(element.series), need, { colorFamilies: color.families });
    if (!device) return void missing.add(label);
    const key = `${itemId}|${device.id}|${element.room}`;
    const row = rows.get(key) ?? { itemId, wiringDeviceId: device.id, room: element.room, quantity: 0 };
    row.quantity += quantity;
    rows.set(key, row);
  };
  const byCircuit = new Map(circuits.circuits.map((circuit) => [circuit.id, circuit]));
  /** Jistič okruhu světel místnosti (žaluzie, termostat), jinak první jistič. */
  const roomItem = new Map<string, string>();
  for (const { id: itemId, device } of items) {
    const circuit = device.circuitId ? byCircuit.get(device.circuitId) : null;
    if (!circuit) continue;
    const elements = [...new Map(circuit.nodeIds.map((nodeId) => build.elementOf.get(nodeId)).filter((element): element is EditorElement => Boolean(element)).map((element) => [element.id, element])).values()];
    for (const element of elements) {
      const item = paletteItem(element.item);
      if (item?.kind === "light" && !roomItem.has(element.room)) roomItem.set(element.room, itemId);
      const group = groupOf.get(element.id);
      if (group && !frameItem.has(group.id)) frameItem.set(group.id, itemId);
      if (item?.kind === "single_socket" || item?.kind === "double_socket") {
        // Dvojzásuvka ve víceramečku = 2 jednozásuvky
        if (group && item.kind === "double_socket") add(itemId, element, { kind: "socket", double: false, ip44: item.variant === "ip44" }, element.frameUnits * 2, "zásuvka 1N");
        else add(itemId, element, { kind: "socket", double: item.kind === "double_socket", ip44: item.variant === "ip44" }, element.frameUnits, item.label);
        if (!group && element.frameUnits > 1) add(itemId, element, { kind: "frame", units: element.frameUnits }, 1, `rámeček ${element.frameUnits}R`);
      }
      if (item?.kind === "light") {
        // Ovladače světla: 1 místo = č. 1, 2 místa = č. 6, další = č. 7; pevné typy (S5, S6+6, tlačítka, stmívač, PIR) zůstanou
        const controllers = everything.filter((candidate) => candidate.controls.includes(element.id));
        controllers.forEach((controller, index) => {
          const palette = paletteItem(controller.item);
          if (!palette) return;
          // Fáze 57: sběrnicová a bezdrátová tlačítka nejsou v katalogu domovních přístrojů (kusovník je vede bez MPN)
          if (palette.bus || palette.wireless) return;
          if (palette.wiringCategory) return add(itemId, controller, { kind: "category", category: palette.wiringCategory }, 1, palette.label);
          const base = palette.fixedSwitchNo ?? (controllers.length === 1 ? "1" : index < 2 ? "6" : "7");
          const switchNo = palette.led && (base === "1" || base === "6" || base === "7") ? `${base}So` : base;
          add(itemId, controller, { kind: "switch", switchNo, ip44: palette.ip44 }, 1, `vypínač č. ${switchNo.replace("So", "S")}`);
        });
      }
    }
  }
  // Žaluziové ovladače a termostaty (nejsou na silovém okruhu) → jistič světel své místnosti
  const fallbackItem = items[0]?.id;
  for (const group of new Set(groupOf.values())) {
    const anchor = everything.find((element) => element.id === group.members[0]);
    const itemId = frameItem.get(group.id) ?? fallbackItem;
    if (!anchor || !itemId) continue;
    const gangs = Math.min(5, group.members.reduce((sum, id) => sum + gangsOf(everything.find((element) => element.id === id) ?? { item: "socket", frameUnits: 1 }), 0));
    add(itemId, anchor, { kind: "frame", units: gangs }, 1, `víceramček ${gangs}R`);
  }
  for (const element of everything) {
    const palette = paletteItem(element.item);
    if (!palette?.wiringCategory || (palette.control !== "blind" && palette.control !== "thermostat")) continue;
    const itemId = roomItem.get(element.room) ?? fallbackItem;
    if (itemId) add(itemId, element, { kind: "category", category: palette.wiringCategory }, element.frameUnits, palette.label);
  }
  if (rows.size) await prisma.panelItemWiring.createMany({ data: [...rows.values()] });
  return missing.size ? [`Ve zvolené řadě chybí: ${[...missing].join(", ")} – doplňte je v konfigurátoru jističe.`] : [];
}

