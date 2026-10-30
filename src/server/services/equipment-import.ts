import type { PrismaClient } from "@/generated/prisma/client";
import type { EquipmentType } from "@/generated/prisma/enums";
import { inspectionRuleFor, isPortable } from "@/lib/inspection-rules";
import { renderInspectionReportSvg } from "@/lib/mock-graphics/compliance";
import { newQrToken } from "@/lib/qr-label";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Hromadný import spotřebičů a zařízení (průvodce /inspections/import, krok 3).

export interface ImportItem {
  tag: string;
  name: string;
  type: EquipmentType;
  floorId: string;
  intervalMonths: number | null;
  lastInspection: Date | null;
  location: string;
}

/** Uloží vygenerovanou zprávu (SVG) a vrátí její URL – v aplikaci `saveUpload`, v testech stub. */
export type ReportWriter = (svg: string) => Promise<string>;

const czDate = (date: Date) => date.toLocaleDateString("cs-CZ", { timeZone: "UTC" });

/** Piny importovaných kusů v řadách u spodního okraje půdorysu (pak je lze přesunout ve Studiu). */
export function importPin(index: number) {
  return { pinX: 6 + (index % 12) * 8, pinY: Math.max(8, 92 - Math.floor(index / 12) * 7) };
}

export async function importEquipment(prisma: PrismaClient, input: { items: ImportItem[]; writeReport: ReportWriter; now?: Date }) {
  const now = input.now ?? new Date();
  if (!input.items.length) throw new WorkflowError("VALIDATION", "Není co importovat.");
  if (input.items.length > 500) throw new WorkflowError("VALIDATION", "Najednou lze importovat nejvýše 500 položek.");

  const floorIds = [...new Set(input.items.map((item) => item.floorId))];
  const floors = await prisma.floor.findMany({
    where: { id: { in: floorIds } },
    select: { id: true, name: true, building: { select: { name: true, plantId: true } }, _count: { select: { equipment: true } } },
  });
  const floorById = new Map(floors.map((floor) => [floor.id, floor]));
  const missing = input.items.find((item) => !floorById.has(item.floorId));
  if (missing) throw new WorkflowError("VALIDATION", `Položka ${missing.tag} nemá přiřazené platné patro.`);

  // Evidenční čísla musí být v závodě jedinečná (i vůči již evidovaným zařízením).
  const plantIds = [...new Set(floors.map((floor) => floor.building.plantId))];
  const existing = await prisma.equipment.findMany({
    where: { tag: { in: input.items.map((item) => item.tag) }, floor: { building: { plantId: { in: plantIds } } } },
    select: { tag: true, floor: { select: { building: { select: { plantId: true } } } } },
  });
  const taken = new Set(existing.map((row) => `${row.floor.building.plantId}|${row.tag}`));

  const skipped: { tag: string; reason: string }[] = [];
  const accepted: ImportItem[] = [];
  for (const item of input.items) {
    const key = `${floorById.get(item.floorId)!.building.plantId}|${item.tag}`;
    if (taken.has(key)) {
      skipped.push({ tag: item.tag, reason: "Evidenční číslo už v závodě existuje." });
      continue;
    }
    taken.add(key);
    accepted.push(item);
  }

  // Zprávy převzatých revizí se zapíšou ještě před transakcí (soubor bez záznamu nevadí).
  const reports = new Map<string, string>();
  for (const item of accepted) {
    if (!item.lastInspection) continue;
    const floor = floorById.get(item.floorId)!;
    const rule = inspectionRuleFor({ type: item.type, usageGroup: isPortable(item.type) ? "C" : null });
    const validUntil = addMonths(item.lastInspection, item.intervalMonths ?? rule.months);
    reports.set(
      item.tag,
      await input.writeReport(
        renderInspectionReportSvg({
          tag: item.tag,
          name: item.name,
          location: `${floor.building.name} › ${floor.name}`,
          ratedVoltage: null,
          ratedCurrent: null,
          type: "PERIODIC",
          reportNumber: `IMP-${item.tag}`,
          inspectionDate: czDate(item.lastInspection),
          validUntil: czDate(validUntil),
          inspectorName: "Převzato z evidence (import)",
          inspectorLicense: "–",
          result: "CAPABLE",
          defectsSummary: "Záznam převzat z dosavadní evidence revizí při importu do systému Eldock.",
          standard: rule.standard,
        }),
      ),
    );
  }

  const placed = new Map(floors.map((floor) => [floor.id, floor._count.equipment]));
  const created = await prisma.$transaction(async (tx) => {
    const result: { id: string; tag: string; qrToken: string }[] = [];
    for (const item of accepted) {
      const portable = isPortable(item.type);
      const rule = inspectionRuleFor({ type: item.type, usageGroup: portable ? "C" : null });
      const months = item.intervalMonths ?? rule.months;
      const index = placed.get(item.floorId)!;
      placed.set(item.floorId, index + 1);
      const qrToken = newQrToken();
      const equipment = await tx.equipment.create({
        data: {
          floorId: item.floorId,
          tag: item.tag,
          name: `${item.tag} - ${item.name}`,
          type: item.type,
          description: "Importováno z CSV / Excelu.",
          inventoryNumber: item.tag,
          assignedZone: item.location || null,
          usageGroup: portable ? "C" : null,
          protectionClass: portable ? "I" : null,
          inspectionIntervalMonths: months,
          qrToken,
          ...importPin(index),
          inspections: item.lastInspection
            ? {
                create: {
                  type: "PERIODIC",
                  inspectionDate: item.lastInspection,
                  validUntil: addMonths(item.lastInspection, months),
                  reportNumber: `IMP-${item.tag}`,
                  inspectorName: "Převzato z evidence (import)",
                  inspectorLicense: "–",
                  result: "CAPABLE",
                  defectsSummary: null,
                  reportUrl: reports.get(item.tag)!,
                },
              }
            : undefined,
        },
        select: { id: true, tag: true },
      });
      result.push({ ...equipment, qrToken });
    }
    return result;
  });

  return { created, skipped, importedAt: now };
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}
