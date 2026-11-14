import type { PrismaClient } from "@/generated/prisma/client";
import type { ComponentWearCategory } from "@/generated/prisma/enums";
import { componentDataFromRow, designationKey } from "@/lib/bom-lifespan";
import { CROSS_SECTIONS, type CableInstallMethod } from "@/lib/cable-sizing";
import { partKeyOf } from "@/lib/component-datasheets";
import { isAlertLead } from "@/lib/component-lifespan";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { equipmentLifespan } from "./lifespan-report";

// Fáze 53: prediktivní údržba – provozní profil, sledované součástky (výměna kusu = reset 0 %)
// a kabelový pasport přívodu. Služby dostávají `prisma`, testují se nad SQLite (test-db.ts).

export interface OperatingProfileInput {
  equipmentId: string;
  shiftRegime: number;
  internalTempC: number | null;
  /** Fáze 116: předstih upozornění pro všechny součástky stroje (30 / 60 / 90 / 180 dní). */
  lifespanAlertDays?: number;
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
  if (input.lifespanAlertDays !== undefined && !isAlertLead(input.lifespanAlertDays))
    throw new WorkflowError("VALIDATION", "Předstih upozornění musí být 30, 60, 90 nebo 180 dní.");
  return prisma.equipment.update({
    where: { id: input.equipmentId },
    data: {
      shiftRegime: input.shiftRegime,
      internalTempC: input.internalTempC,
      ...(input.lifespanAlertDays !== undefined ? { lifespanAlertDays: input.lifespanAlertDays } : {}),
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
  // Fáze 116: díl s MPN se odepíše ze skladu závodu (sdílený všemi stroji), bez MPN z počtu u součástky
  const plantId = (await prisma.equipment.findUnique({ where: { id: input.equipmentId }, select: { floor: { select: { building: { select: { plantId: true } } } } } }))?.floor.building.plantId;
  const key = partKeyOf(component.modelNumber);
  const shared = key && plantId ? await prisma.sparePartStock.findUnique({ where: { plantId_partKey: { plantId, partKey: key } } }) : null;
  const fromStock = shared ? shared.quantity > 0 : component.replacementStockCount > 0;
  if (shared && shared.quantity > 0) await prisma.sparePartStock.update({ where: { id: shared.id }, data: { quantity: shared.quantity - 1 } });
  const entry = `Výměna ${now.toLocaleDateString("cs-CZ", { timeZone: "Europe/Prague" })}${fromStock ? " (kus ze skladu)" : ""}`;
  return prisma.monitoredComponent.update({
    where: { id: component.id },
    data: {
      installedAt: now,
      manualCyclesOffset: 0,
      hoursReading: null,
      hoursReadingAt: null,
      replacementStockCount: shared
        ? component.replacementStockCount
        : fromStock
          ? component.replacementStockCount - 1
          : 0,
      notes: [entry, component.notes].filter(Boolean).join(" · ").slice(0, 500),
    },
  });
}

// ---------------------------------------------------------------------------
//  Fáze 116: řádky kusovníku s automatickým modelem životnosti
// ---------------------------------------------------------------------------

export interface BomComponentRef {
  equipmentId: string;
  /** Označení ve schématu („K1“ / „-K1“). */
  designation: string;
  /** Revize, jejíž kusovník je na obrazovce (jinak platná). */
  revisionId?: string | null;
}

/**
 * Uložená součástka pro řádek kusovníku: existující se stejným označením, jinak se vytvoří z automatického modelu
 * řádku (technický list výrobce / odhad kategorie, instalace = rok instalace stroje).
 */
export async function materializeBomComponent(prisma: PrismaClient, input: BomComponentRef) {
  const lifespan = await equipmentLifespan(prisma, input.equipmentId, { revisionId: input.revisionId });
  if (!lifespan) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  const key = designationKey(input.designation);
  const entry = lifespan.rows.find(({ row }) => row.key === key);
  if (!entry) throw new WorkflowError("NOT_FOUND", `Pozice ${input.designation} v kusovníku není.`);
  if (entry.row.componentId) return { id: entry.row.componentId, plantId: lifespan.plantId, row: entry.row };
  const data = componentDataFromRow(entry.row);
  if (!data) throw new WorkflowError("VALIDATION", `${entry.row.designation} je pasivní prvek bez modelu životnosti (svorka, pojistka …).`);
  const created = await prisma.monitoredComponent.create({ data: { equipmentId: input.equipmentId, ...data } });
  return { id: created.id, plantId: lifespan.plantId, row: entry.row };
}

export interface BomComponentPatch extends BomComponentRef {
  /** Četnost spínání [sepnutí / h] (stykače, relé). */
  cyclesPerHour?: number | null;
  /** Odečet počítadla motohodin (měnič, zdroj) k dnešku. */
  hoursReading?: number | null;
  /** Předstih upozornění jen pro tuto součástku; `null` = podle stroje. */
  alertLeadDays?: number | null;
  /** Zaznamenané výboje přepěťové ochrany / cykly z čítače PLC. */
  manualCyclesOffset?: number;
  maxElectricalCycles?: number | null;
  maxOperatingHours?: number | null;
  maxCalendarMonths?: number | null;
  now?: Date;
}

/** Úprava parametrů provozu řádku kusovníku (okamžitý přepočet zbývající životnosti a data konce). */
export async function updateBomComponent(prisma: PrismaClient, input: BomComponentPatch) {
  if (input.cyclesPerHour != null && (!(input.cyclesPerHour >= 0) || input.cyclesPerHour > 3600))
    throw new WorkflowError("VALIDATION", "Četnost spínání musí být 0 až 3 600 sepnutí za hodinu.");
  if (input.hoursReading != null && (!(input.hoursReading >= 0) || input.hoursReading > 1_000_000))
    throw new WorkflowError("VALIDATION", "Odečet motohodin musí být 0 až 1 000 000 h.");
  if (input.alertLeadDays != null && !isAlertLead(input.alertLeadDays))
    throw new WorkflowError("VALIDATION", "Předstih upozornění musí být 30, 60, 90 nebo 180 dní.");
  const { id } = await materializeBomComponent(prisma, input);
  const now = input.now ?? new Date();
  return prisma.monitoredComponent.update({
    where: { id },
    data: {
      ...(input.cyclesPerHour !== undefined ? { cyclesPerHour: input.cyclesPerHour } : {}),
      ...(input.hoursReading !== undefined ? { hoursReading: input.hoursReading, hoursReadingAt: input.hoursReading === null ? null : now } : {}),
      ...(input.alertLeadDays !== undefined ? { alertLeadDays: input.alertLeadDays } : {}),
      ...(input.manualCyclesOffset !== undefined ? { manualCyclesOffset: Math.max(0, Math.round(input.manualCyclesOffset)) } : {}),
      ...(input.maxElectricalCycles !== undefined ? { maxElectricalCycles: input.maxElectricalCycles } : {}),
      ...(input.maxOperatingHours !== undefined ? { maxOperatingHours: input.maxOperatingHours } : {}),
      ...(input.maxCalendarMonths !== undefined ? { maxCalendarMonths: input.maxCalendarMonths } : {}),
    },
  });
}

/**
 * Sklad dílu řádku kusovníku: s objednacím číslem sklad závodu (platí pro všechny stroje se stejným MPN), bez něj
 * počet u sledované součástky.
 */
export async function setComponentStock(prisma: PrismaClient, input: BomComponentRef & { quantity: number }) {
  const quantity = Math.round(input.quantity);
  if (!(quantity >= 0) || quantity > 100_000) throw new WorkflowError("VALIDATION", "Počet kusů skladem musí být 0 až 100 000.");
  const lifespan = await equipmentLifespan(prisma, input.equipmentId, { revisionId: input.revisionId });
  if (!lifespan) throw new WorkflowError("NOT_FOUND", "Zařízení neexistuje.");
  const entry = lifespan.rows.find(({ row }) => row.key === designationKey(input.designation));
  if (!entry) throw new WorkflowError("NOT_FOUND", `Pozice ${input.designation} v kusovníku není.`);
  const key = partKeyOf(entry.row.partNumber);
  if (key) {
    await prisma.sparePartStock.upsert({
      where: { plantId_partKey: { plantId: lifespan.plantId, partKey: key } },
      create: { plantId: lifespan.plantId, partKey: key, partNumber: entry.row.partNumber!.trim(), manufacturer: entry.row.manufacturer, description: entry.row.description.slice(0, 200), quantity },
      update: { quantity, manufacturer: entry.row.manufacturer ?? undefined },
    });
    return { shared: true, partNumber: entry.row.partNumber!.trim(), quantity };
  }
  const { id } = await materializeBomComponent(prisma, input);
  await prisma.monitoredComponent.update({ where: { id }, data: { replacementStockCount: quantity } });
  return { shared: false, partNumber: null, quantity };
}

/** „🔄 Vyměněno (Reset 100 %)“ u řádku kusovníku – nový kus od dneška, odpis ze skladu. */
export async function replaceBomComponent(prisma: PrismaClient, input: BomComponentRef & { now?: Date }) {
  const { id } = await materializeBomComponent(prisma, input);
  return replaceMonitoredComponent(prisma, { componentId: id, equipmentId: input.equipmentId, now: input.now });
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
