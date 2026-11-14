"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { equipmentHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import {
  addMonitoredComponent,
  deleteMonitoredComponent,
  replaceBomComponent,
  replaceMonitoredComponent,
  setComponentStock,
  updateBomComponent,
  updateFeederCable,
  updateOperatingProfile,
} from "@/server/services/lifespan";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 53: prediktivní údržba na kartě zařízení – smí údržba (zadává změny) a revizní technici.

const id = z.string().min(1).max(64);
const num = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();

const profileSchema = z.object({
  equipmentId: id,
  shiftRegime: z.number().int().min(1).max(4),
  internalTempC: num(-20, 90),
  lifespanAlertDays: z.number().int().min(1).max(365).optional(),
});
// Fáze 116: řádek kusovníku (pozice ve schématu) s automatickým modelem životnosti
const bomRef = { equipmentId: id, designation: z.string().trim().min(1).max(30), revisionId: id.nullable().optional() };
const bomPatchSchema = z.object({
  ...bomRef,
  cyclesPerHour: num(0, 3600).optional(),
  hoursReading: z.number().int().min(0).max(1_000_000).nullable().optional(),
  alertLeadDays: z.number().int().min(1).max(365).nullable().optional(),
  manualCyclesOffset: z.number().int().min(0).max(1_000_000_000).optional(),
});
const bomStockSchema = z.object({ ...bomRef, quantity: z.number().int().min(0).max(100_000) });
const bomReplaceSchema = z.object(bomRef);
const componentSchema = z.object({
  equipmentId: id,
  designation: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(120),
  manufacturer: z.string().max(80).nullable().optional(),
  modelNumber: z.string().max(80).nullable().optional(),
  wearCategory: z.enum([
    "SWITCHING_CONTACTOR",
    "SAFETY_ELEMENT",
    "POWER_ELECTRONICS",
    "COOLING_FAN_FILTER",
    "BATTERY",
    "SURGE_PROTECTION",
  ]),
  cyclesPerHour: num(0, 100_000),
  manualCyclesOffset: z.number().int().min(0).max(1_000_000_000).default(0),
  maxElectricalCycles: z.number().int().min(1).max(1_000_000_000).nullable(),
  maxOperatingHours: z.number().int().min(1).max(1_000_000).nullable(),
  maxCalendarMonths: z.number().int().min(1).max(600).nullable(),
  replacementStockCount: z.number().int().min(0).max(1000).default(0),
});
const componentRef = z.object({ equipmentId: id, componentId: id });
const cableSchema = z.object({
  equipmentId: id,
  cableType: z.string().max(60).nullable(),
  material: z.enum(["CU", "AL"]),
  crossSectionMm2: num(1.5, 240),
  parallelRuns: z.number().int().min(1).max(8),
  lengthM: num(0, 5000),
  method: z.enum(["B2", "C", "E", "D"]),
  groupingCount: z.number().int().min(1).max(20),
  ambientTempC: z.number().min(-10).max(70),
  upstreamBreakerA: num(1, 6300),
  nominalCurrentA: num(0, 6300),
  measuredCurrentA: num(0, 6300),
});

async function run<S extends z.ZodType, T>(
  schema: S,
  raw: unknown,
  action: (input: z.infer<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, error: "Zkontrolujte zadané hodnoty." };
  try {
    const account = await getCurrentAccount();
    if (!account.can("submitChange") && !account.can("recordInspection")) {
      throw new WorkflowError(
        "FORBIDDEN",
        `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.submitChange} nebo ${PERMISSION_LABELS.recordInspection}.`,
      );
    }
    await assertTenantAccess(parsed.data);
    const data = await action(parsed.data);
    revalidatePath(
      equipmentHref((parsed.data as { equipmentId: string }).equipmentId),
    );
    return { ok: true, data };
  } catch (error) {
    if (error instanceof WorkflowError)
      return { ok: false, error: error.message };
    console.error(error);
    return {
      ok: false,
      error: "Akci se nepodařilo dokončit. Zkuste to prosím znovu.",
    };
  }
}

export async function updateOperatingProfileAction(
  input: z.input<typeof profileSchema>,
) {
  return run(
    profileSchema,
    input,
    async (data) => void (await updateOperatingProfile(prisma, data)),
  );
}

export async function addMonitoredComponentAction(
  input: z.input<typeof componentSchema>,
) {
  return run(
    componentSchema,
    input,
    async (data) => (await addMonitoredComponent(prisma, data)).id,
  );
}

export async function replaceMonitoredComponentAction(
  input: z.input<typeof componentRef>,
) {
  return run(
    componentRef,
    input,
    async (data) => void (await replaceMonitoredComponent(prisma, data)),
  );
}

export async function deleteMonitoredComponentAction(
  input: z.input<typeof componentRef>,
) {
  return run(
    componentRef,
    input,
    async (data) => void (await deleteMonitoredComponent(prisma, data)),
  );
}

export async function updateFeederCableAction(
  input: z.input<typeof cableSchema>,
) {
  return run(
    cableSchema,
    input,
    async (data) => void (await updateFeederCable(prisma, data)),
  );
}

/** Fáze 116: četnost spínání, odečet motohodin a předstih upozornění řádku kusovníku (okamžitý přepočet). */
export async function updateBomComponentAction(input: z.input<typeof bomPatchSchema>) {
  return run(bomPatchSchema, input, async (data) => void (await updateBomComponent(prisma, data)));
}

/** Fáze 116: počet kusů skladem (díl s MPN = sklad závodu pro všechny stroje). */
export async function setComponentStockAction(input: z.input<typeof bomStockSchema>) {
  return run(bomStockSchema, input, async (data) => {
    const result = await setComponentStock(prisma, data);
    revalidatePath("/nakupni-report");
    return result;
  });
}

/** Fáze 116: „🔄 Vyměněno (Reset 100 %)“ u řádku kusovníku. */
export async function replaceBomComponentAction(input: z.input<typeof bomReplaceSchema>) {
  return run(bomReplaceSchema, input, async (data) => void (await replaceBomComponent(prisma, data)));
}
