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
  replaceMonitoredComponent,
  updateFeederCable,
  updateOperatingProfile,
} from "@/server/services/lifespan";
import { getCurrentAccount } from "@/server/session";

import type { ActionResult } from "./workflow";

// Fáze 53: prediktivní údržba na kartě zařízení – smí údržba (zadává změny) a revizní technici.

const id = z.string().min(1).max(64);
const num = (min: number, max: number) =>
  z.number().min(min).max(max).nullable();

const profileSchema = z.object({
  equipmentId: id,
  shiftRegime: z.number().int().min(1).max(4),
  internalTempC: num(-20, 90),
});
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
