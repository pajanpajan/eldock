"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE } from "@/lib/roles";
import { floorHref, plantHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { saveStudioBuilding } from "@/server/services/studio";

import type { ActionResult } from "./workflow";

const id = z.string().min(1).max(64);
const ref = z.string().min(2).max(3);
const text = (max: number) => z.string().max(max);
const equipmentType = z.enum([
  "SWITCHBOARD",
  "TRANSFORMER",
  "PRODUCTION_LINE",
  "MACHINE",
  "CNC_MACHINE",
  "ROBOT_CELL",
  "HVAC_UNIT",
  "COMPRESSOR",
  "POWER_TOOL",
  "APPLIANCE",
  "EXTENSION_CORD",
  "WELDER",
  "LIGHTNING_ROD",
  "EMERGENCY_LIGHTING",
  "OTHER",
]);

const draftSchema = z.object({
  plantId: id,
  newPlant: z
    .object({ name: text(120), code: text(6), location: text(200), widthM: z.number().int().min(1).max(5000), depthM: z.number().int().min(1).max(5000) })
    .nullable()
    .optional(),
  grid: z.object({ cols: z.number().int(), rows: z.number().int(), stepMeters: z.number().positive().max(30), scale: z.enum(["1:100", "1:200", "1:500"]) }),
  building: z.discriminatedUnion("mode", [
    z.object({
      mode: z.literal("new"),
      code: text(4),
      name: text(120),
      type: z.enum(["PRODUCTION", "ASSEMBLY", "ENERGY", "WAREHOUSE", "OFFICE", "OTHER"]),
      map: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100), w: z.number().min(2).max(100), h: z.number().min(2).max(100) }),
    }),
    z.object({ mode: z.literal("existing"), id }),
  ]),
  floors: z
    .array(
      z.object({
        key: id,
        level: z.number().int().min(-5).max(20),
        usage: text(80),
        zones: z.array(z.object({ from: ref, to: ref, name: text(80), kind: z.enum(["PRODUCTION", "STORAGE", "HAZARD"]) })).max(60),
        gates: z.array(z.object({ at: ref, label: text(60) })).max(30),
      }),
    )
    .max(12),
  equipment: z
    .array(
      z.object({
        key: id,
        floor: z.discriminatedUnion("kind", [z.object({ kind: z.literal("draft"), key: id }), z.object({ kind: z.literal("existing"), id })]),
        at: ref,
        tag: text(24),
        name: text(120),
        type: equipmentType,
        parent: z.discriminatedUnion("kind", [z.object({ kind: z.literal("draft"), key: id }), z.object({ kind: z.literal("existing"), id })]).nullable(),
        circuit: text(80).nullable(),
        zone: text(80).nullable(),
        isRoot: z.boolean(),
      }),
    )
    .max(200),
});

/** Uloží budovu ze Studia (ředitel, vedoucí údržby) a vrátí odkaz na první patro; nový závod si zapamatuje jako aktuální. */
export async function saveStudioAction(input: z.input<typeof draftSchema>): Promise<ActionResult<{ href: string; floors: number; equipment: number; plantCreated: boolean }>> {
  const parsed = draftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data konceptu. Zkontrolujte vyplněné údaje." };
  try {
    await assertPermission("studio");
    await assertFeature("enterprise.studio");
    const result = await saveStudioBuilding(prisma, parsed.data);
    if (result.plantCreated) {
      (await cookies()).set(PLANT_COOKIE, result.plantId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
    }
    revalidatePath("/", "layout");
    const href = result.firstFloorId ? floorHref(result.plantId, result.buildingId, result.firstFloorId) : plantHref(result.plantId);
    return { ok: true, data: { href, floors: result.floors, equipment: result.equipment, plantCreated: result.plantCreated } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Budovu se nepodařilo uložit. Zkuste to prosím znovu." };
  }
}
