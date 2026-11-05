import type { PrismaClient } from "@/generated/prisma/client";
import type { ComponentWearCategory } from "@/generated/prisma/enums";
import { CROSS_SECTIONS, type CableInstallMethod } from "@/lib/cable-sizing";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Fáze 53: prediktivní údržba – provozní profil, sledované součástky (výměna kusu = reset 0 %)
// a kabelový pasport přívodu. Služby dostávají `prisma`, testují se nad SQLite (test-db.ts).

export interface OperatingProfileInput {
  equipmentId: string;
  shiftRegime: number;
  internalTempC: number | null;
}

export async function updateOperatingProfile(
  prisma: PrismaClient,
  input: OperatingProfileInput,
) {
  if (![1, 2, 3, 4].includes(input.shiftRegime))
    throw new WorkflowError("VALIDATION", "Neplatná směnnost.");
  if (
    input.internalTempC !== null &&
    (input.internalTempC < -20 || input.internalTempC > 90)
  )
    throw new WorkflowError(
      "VALIDATION",
      "Teplota v rozváděči musí být −20 až 90 °C.",
    );
  return prisma.equipment.update({
    where: { id: input.equipmentId },
    data: {
      shiftRegime: input.shiftRegime,
      internalTempC: input.internalTempC,
    },
    select: { id: true },
  });
}

export interface ComponentInput {
  equipmentId: string;
  designation: string;
  name: string;
  manufacturer?: string | null;
  modelNumber?: string | null;
  wearCategory: ComponentWearCategory;
  installedAt?: Date;
  cyclesPerHour?: number | null;
  manualCyclesOffset?: number;
  maxElectricalCycles?: number | null;
  maxOperatingHours?: number | null;
  maxCalendarMonths?: number | null;
  replacementStockCount?: number;
  notes?: string | null;
}

export async function addMonitoredComponent(
  prisma: PrismaClient,
  input: ComponentInput,
) {
  const designation = input.designation.trim();
  const name = input.name.trim();
  if (!designation || !name)
    throw new WorkflowError(
      "VALIDATION",
      "Vyplňte označení a název součástky.",
    );
  if (
    !input.maxElectricalCycles &&
    !input.maxOperatingHours &&
    !input.maxCalendarMonths
  ) {
    throw new WorkflowError(
      "VALIDATION",
      "Zadejte alespoň jeden limit životnosti (cykly / B10d, motohodiny nebo měsíce).",
    );
  }
  if (input.maxElectricalCycles && !input.cyclesPerHour)
    throw new WorkflowError(
      "VALIDATION",
      "K limitu cyklů zadejte průměrný počet sepnutí za hodinu.",
    );
  const equipment = await prisma.equipment.findUnique({
    where: { id: input.equipmentId },
    select: { id: true },
  });
  if (!equipment) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  return prisma.monitoredComponent.create({
    data: {
      equipmentId: input.equipmentId,
      designation,
      name,
      manufacturer: input.manufacturer?.trim() || null,
      modelNumber: input.modelNumber?.trim() || null,
      wearCategory: input.wearCategory,
      installedAt: input.installedAt ?? new Date(),
      cyclesPerHour: input.cyclesPerHour ?? null,
      manualCyclesOffset: input.manualCyclesOffset ?? 0,
      maxElectricalCycles: input.maxElectricalCycles ?? null,
      maxOperatingHours: input.maxOperatingHours ?? null,
      maxCalendarMonths: input.maxCalendarMonths ?? null,
      replacementStockCount: input.replacementStockCount ?? 0,
      notes: input.notes?.trim() || null,
    },
  });
}

/**
 * „🔄 Zapsat výměnu kusu za nový“: počítadlo od dneška (instalace = teď, ruční offset 0), náhradní díl
 * ze skladu se odepíše a do poznámky se připíše datum výměny (historie kusu).
 */
export async function replaceMonitoredComponent(
  prisma: PrismaClient,
  input: { componentId: string; equipmentId: string; now?: Date },
) {
  const component = await prisma.monitoredComponent.findFirst({
    where: { id: input.componentId, equipmentId: input.equipmentId },
  });
  if (!component) throw new WorkflowError("NOT_FOUND", "Součástka neexistuje.");
  const now = input.now ?? new Date();
  const fromStock = component.replacementStockCount > 0;
  const entry = `Výměna ${now.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })}${fromStock ? " (kus ze skladu)" : ""}`;
  return prisma.monitoredComponent.update({
    where: { id: component.id },
    data: {
      installedAt: now,
      manualCyclesOffset: 0,
      replacementStockCount: fromStock
        ? component.replacementStockCount - 1
        : 0,
      notes: [entry, component.notes].filter(Boolean).join(" · ").slice(0, 500),
    },
  });
}

export async function deleteMonitoredComponent(
  prisma: PrismaClient,
  input: { componentId: string; equipmentId: string },
) {
  const result = await prisma.monitoredComponent.deleteMany({
    where: { id: input.componentId, equipmentId: input.equipmentId },
  });
  if (!result.count)
    throw new WorkflowError("NOT_FOUND", "Součástka neexistuje.");
}

export interface FeederCableInput {
  equipmentId: string;
  cableType: string | null;
  material: "CU" | "AL";
  crossSectionMm2: number | null;
  parallelRuns: number;
  lengthM: number | null;
  method: CableInstallMethod;
  groupingCount: number;
  ambientTempC: number;
  upstreamBreakerA: number | null;
  nominalCurrentA: number | null;
  measuredCurrentA: number | null;
}

/** „✏️ Upravit parametry kabelu a měření klešťákem“. */
export async function updateFeederCable(
  prisma: PrismaClient,
  input: FeederCableInput,
) {
  if (
    input.crossSectionMm2 !== null &&
    !CROSS_SECTIONS.includes(
      input.crossSectionMm2 as (typeof CROSS_SECTIONS)[number],
    )
  ) {
    throw new WorkflowError(
      "VALIDATION",
      "Průřez musí být z řady 1,5–240 mm².",
    );
  }
  return prisma.equipment.update({
    where: { id: input.equipmentId },
    data: {
      feederCableType: input.cableType?.trim() || null,
      feederConductorMaterial: input.material,
      feederCrossSectionMm2: input.crossSectionMm2,
      feederParallelRuns: Math.min(
        8,
        Math.max(1, Math.round(input.parallelRuns)),
      ),
      feederLengthM: input.lengthM,
      feederInstallMethod: input.method,
      feederGroupingCount: Math.min(
        20,
        Math.max(1, Math.round(input.groupingCount)),
      ),
      feederAmbientTempC: input.ambientTempC,
      feederUpstreamBreakerA: input.upstreamBreakerA,
      nominalCurrentA: input.nominalCurrentA,
      measuredCurrentA: input.measuredCurrentA,
    },
    select: { id: true },
  });
}
