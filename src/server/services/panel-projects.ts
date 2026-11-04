import { buildSwitchboardFromCircuits, generateCircuitsFromFloorplan, type InstallMode } from "@/engine/floorplan-bridge";
import { floorplanFromSchedule, sanitizeSchedule, type ScheduleRoom } from "@/engine/room-schedule";
import type { PrismaClient } from "@/generated/prisma/client";
import { isHiddenManufacturer } from "@/lib/panel-builder/brands";
import { enclosureProjectData } from "@/lib/panel-builder/enclosures";
import { isSampleProject, projectUploads, refundsCredit } from "@/lib/panel-builder/project-admin";
import { railColumns } from "@/lib/panel-builder/rails";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { componentForConfig, createPanelProject, renumberProject, type CreateProjectInput } from "./panel-builder";

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
}

/** Rychlá úprava hlavičky z přehledu: název rozváděče, zákazník a místo instalace. */
export async function updateProjectHeader(prisma: PrismaClient, projectId: string, input: ProjectHeaderInput) {
  const name = input.name.trim().slice(0, 120);
  if (!name) throw new WorkflowError("VALIDATION", "Zadejte název rozváděče.");
  const clean = (value: string | null) => value?.trim().slice(0, 120) || null;
  return prisma.panelBoardProject.update({
    where: { id: projectId },
    data: { name, customerName: clean(input.customerName), installationSite: clean(input.installationSite) },
    select: { id: true, name: true, customerName: true, installationSite: true },
  });
}

// ---------------------------------------------------------------------------
//  Nový projekt ze soupisu místností (most „půdorys → rozváděč“, ČSN 33 2130 ed. 4)
// ---------------------------------------------------------------------------

export interface ScheduleProjectInput extends Omit<CreateProjectInput, "photoUrl" | "designMode" | "dims"> {
  rooms: readonly ScheduleRoom[];
  mode: Extract<InstallMode, "classic" | "bus_loxone">;
}

/**
 * Soupis místností → okruhy → přístroje na lištách → nový návrh rozváděče (DESIGN): lišty podle
 * vybrané skříně (25 % rezerva, P_max), každý přístroj s konfigurací, katalogovým kusem a funkcí obvodu.
 */
export async function createProjectFromSchedule(prisma: PrismaClient, input: ScheduleProjectInput) {
  const rooms = sanitizeSchedule(input.rooms);
  if (!rooms.length) throw new WorkflowError("VALIDATION", "Zadejte alespoň jednu místnost.");
  const { plan, calibration } = floorplanFromSchedule(rooms, input.mode);
  const circuits = generateCircuitsFromFloorplan(plan, calibration);
  if (!circuits.circuits.length) throw new WorkflowError("VALIDATION", "Soupis neobsahuje žádný vývod (zásuvky, světla nebo spotřebiče).");
  const enclosures = (await prisma.panelEnclosure.findMany({ orderBy: { totalModules: "asc" } })).filter((row) => !isHiddenManufacturer(row.manufacturer));
  const board = buildSwitchboardFromCircuits(circuits, { mode: input.mode, enclosures });

  const project = await createPanelProject(prisma, { ...input, photoUrl: null, designMode: "DESIGN" });
  try {
    return await fillScheduleProject(prisma, project.id, board, circuits);
  } catch (error) {
    // Nedokončený návrh nenechávat v přehledu
    await prisma.panelBoardProject.delete({ where: { id: project.id } });
    throw error;
  }
}

async function fillScheduleProject(prisma: PrismaClient, projectId: string, board: ReturnType<typeof buildSwitchboardFromCircuits>, circuits: ReturnType<typeof generateCircuitsFromFloorplan>) {
  const project = { id: projectId };
  const capacities = board.rails.map((rail) => rail.capacity);
  await prisma.panelBoardProject.update({
    where: { id: project.id },
    data: {
      ...railColumns(capacities),
      ...(board.enclosure ? { enclosureId: board.enclosure.id, ...enclosureProjectData(board.enclosure) } : {}),
    },
  });
  const rows = [];
  for (const rail of board.rails) {
    let position = 0;
    for (const device of rail.devices) {
      position++;
      const component = await componentForConfig(prisma, device.config);
      rows.push({
        projectId: project.id,
        catalogComponentId: component.id,
        dinRailIndex: rail.index,
        positionOnRail: position,
        modulesWidth: device.modules,
        recognitionStatus: "VERIFIED" as const,
        confidence: 1,
        configJson: JSON.stringify(device.config),
        // Příklad typu v závorce („např. …“) nepatří do funkce obvodu
        circuitLabel: device.label.replace(/\s*\(např\.[^)]*\)/, "").slice(0, 80),
        designation: device.designation,
        sortOrder: rail.index * 100 + position,
      });
    }
  }
  await prisma.panelBoardItem.createMany({ data: rows });
  await renumberProject(prisma, project.id);
  return { id: project.id, devices: rows.length, circuits: circuits.circuits.length, enclosure: board.enclosure?.model ?? null, warnings: [...circuits.warnings, ...board.warnings] };
}
