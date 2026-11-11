// Fáze 92: průvodce závodem, režim A – skutečné založení první haly s hlavním rozváděčem / trafostanicí a prvního
// zdokumentovaného stroje (nebo podružného rozváděče) s PDF schématem. Halu ukládá Studio výstavby (`saveStudioBuilding` –
// mapa areálu, půdorys patra, QR kódy), stroj dostane výchozí platnou revizi schématu v1.0 (výchozí digitalizace bez
// změnového řízení). Záměrně bez `server-only` (testy nad SQLite).

import type { PrismaClient } from "@/generated/prisma/client";
import { kwToAmps } from "@/lib/cable-sizing";
import { cleanTag, hallDraft, sourceCurrentA, uniqueTag, type HallInput, type MachineInput } from "@/lib/plant-onboarding";
import { WorkflowError, formatVersion } from "@/lib/workflow/state-machine";

import { saveStudioBuilding } from "./studio";

const fail = (message: string): never => {
  throw new WorkflowError("VALIDATION", message);
};

async function plantTags(prisma: PrismaClient, plantId: string): Promise<Set<string>> {
  const rows = await prisma.equipment.findMany({ where: { floor: { building: { plantId } } }, select: { tag: true } });
  return new Set(rows.map((row) => row.tag.toUpperCase()));
}

/** Krok 1: hala s rozvodnou a hlavním zdrojem (jmenovitý proud uložený u zařízení). */
export async function createOnboardingHall(prisma: PrismaClient, plantId: string, input: HallInput) {
  const hallName = input.hallName.trim();
  if (hallName.length < 3 || hallName.length > 80) fail("Zadejte název haly (3–80 znaků).");
  if (input.sourceKind === "TRANSFORMER" ? !(input.rating >= 50 && input.rating <= 4000) : !(input.rating >= 16 && input.rating <= 6300)) {
    fail(input.sourceKind === "TRANSFORMER" ? "Výkon trafostanice: 50–4000 kVA." : "Jmenovitý proud hlavního rozváděče: 16–6300 A.");
  }
  const [buildings, tags] = await Promise.all([prisma.building.findMany({ where: { plantId }, select: { code: true, mapPolygon: true } }), plantTags(prisma, plantId)]);
  const tag = uniqueTag(cleanTag(input.boardTag, input.sourceKind === "TRANSFORMER" ? "TS-1" : "HR-1"), tags);
  const result = await saveStudioBuilding(prisma, hallDraft(plantId, { ...input, hallName, boardTag: tag }, { codes: buildings.map((building) => building.code), polygons: buildings.map((building) => building.mapPolygon) }));
  const board = await prisma.equipment.findFirst({ where: { tag, floor: { buildingId: result.buildingId } }, select: { id: true, floorId: true, tag: true, name: true } });
  if (!board || !result.firstFloorId) throw new WorkflowError("VALIDATION", "Hlavní rozváděč haly se nepodařilo založit.");
  await prisma.equipment.update({ where: { id: board.id }, data: { ratedCurrent: `${sourceCurrentA(input)} A`, ratedVoltage: "3 × 400 V / 50 Hz" } });
  return { buildingId: result.buildingId, floorId: result.firstFloorId, boardId: board.id, boardTag: board.tag, boardName: board.name };
}

/**
 * Krok 2: první stroj / podružný rozváděč v hale napájený z hlavního zdroje haly, se jmenovitým odběrem z příkonu
 * a výchozí platnou revizí schématu (nahrané PDF nebo vzorové schéma).
 */
export async function addOnboardingMachine(prisma: PrismaClient, plantId: string, authorId: string, input: MachineInput & { schematicUrl: string; schematicTitle?: string | null }) {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 80) fail("Zadejte název stroje nebo rozváděče (2–80 znaků).");
  if (!(input.powerKw > 0 && input.powerKw <= 2000)) fail("Příkon stroje: 0,1–2000 kW.");
  if (!/^\/api\/files\/[\w./-]+\.pdf$/i.test(input.schematicUrl) && !/^\/demo-docs\/[\w.-]+\.pdf$/.test(input.schematicUrl)) fail("Schéma musí být PDF nahrané do Eldocku nebo vzorové schéma.");
  const building = await prisma.building.findFirst({
    where: { id: input.buildingId, plantId },
    select: { id: true, floors: { orderBy: { level: "asc" }, take: 1, select: { id: true, equipment: { select: { id: true, type: true, fedFromEquipmentId: true } } } } },
  });
  const floor = building?.floors[0];
  if (!building || !floor) throw new WorkflowError("NOT_FOUND", "Hala nebyla nalezena.");
  const source = floor.equipment.find((item) => !item.fedFromEquipmentId && (item.type === "SWITCHBOARD" || item.type === "TRANSFORMER"));
  const tags = await plantTags(prisma, plantId);
  const tag = uniqueTag(cleanTag(input.tag, input.type === "SWITCHBOARD" ? "R-101" : "STROJ-1"), tags);
  const index = floor.equipment.length;
  const result = await saveStudioBuilding(prisma, {
    plantId,
    grid: { cols: 10, rows: 6, stepMeters: 6, scale: "1:200" },
    building: { mode: "existing", id: building.id },
    floors: [],
    equipment: [
      {
        key: "stroj",
        floor: { kind: "existing", id: floor.id },
        // Stroje v hale po řadě (výroba 36 × 30 m)
        pos: { x: 6 + ((Math.max(1, index) - 1) % 4) * 8, y: 8 + (Math.floor((Math.max(1, index) - 1) / 4) % 3) * 8 },
        roomKey: null,
        tag,
        name,
        type: input.type,
        parent: source ? { kind: "existing", id: source.id } : null,
        circuit: source ? `QF${index + 1}` : null,
        zone: "Výroba",
        isRoot: !source && input.type === "SWITCHBOARD",
      },
    ],
  });
  const machine = await prisma.equipment.findFirst({ where: { tag, floor: { buildingId: result.buildingId } }, select: { id: true, tag: true, name: true, qrToken: true } });
  if (!machine) throw new WorkflowError("VALIDATION", "Stroj se nepodařilo založit.");
  const version = { major: 1, minor: 0 };
  const now = new Date();
  await prisma.$transaction([
    prisma.equipment.update({ where: { id: machine.id }, data: { nominalCurrentA: kwToAmps(input.powerKw), ratedVoltage: "3 × 400 V / 50 Hz" } }),
    prisma.documentRevision.create({
      data: {
        equipmentId: machine.id,
        version: formatVersion(version),
        major: version.major,
        minor: version.minor,
        status: "ACTIVE",
        title: input.schematicTitle?.trim().slice(0, 120) || `Elektrické schéma ${tag}`,
        summary: "Výchozí dokumentace nahraná v průvodci závodem.",
        schematicUrl: input.schematicUrl,
        schematicFormat: "PDF",
        sheetCount: 1,
        authorId,
        approverId: authorId,
        approvedAt: now,
        createdAt: now,
      },
    }),
  ]);
  return { equipmentId: machine.id, tag: machine.tag, name: machine.name, qrToken: machine.qrToken, buildingId: result.buildingId, floorId: floor.id };
}
