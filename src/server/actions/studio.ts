"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SCALES, ZONE_KIND_KEYS } from "@/lib/cad-grid";
import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE } from "@/lib/roles";
import { floorHref, plantHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { assertPermission } from "@/server/permissions";
import { getCurrentUser } from "@/server/session";
import { saveStudioConcept, saveStudioMenu } from "@/server/services/studio";
import { studioMenuSchema, type StudioMenu } from "@/lib/studio-menu";

import type { ActionResult } from "./workflow";

const id = z.string().min(1).max(64);
const ref = z.string().min(2).max(6);
const meters = z.number().min(0).max(2000);
const gridSchema = z.object({
  cols: z.number().int(),
  rows: z.number().int(),
  stepMeters: z.number().positive().max(30),
  scale: z.enum(SCALES),
  widthM: z.number().min(1).max(2000).optional(),
  depthM: z.number().min(1).max(2000).optional(),
});
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

const buildingSchema = z.object({
  grid: gridSchema,
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
        zones: z.array(z.object({ key: id, x: meters, y: meters, w: meters, h: meters, name: text(80), kind: z.enum(ZONE_KIND_KEYS) })).max(80),
        gates: z.array(z.object({ at: ref, label: text(60) })).max(30),
        existingId: id.optional(),
        grid: gridSchema.optional(),
      }),
    )
    .max(12),
  equipment: z
    .array(
      z.object({
        key: id,
        floor: z.discriminatedUnion("kind", [z.object({ kind: z.literal("draft"), key: id }), z.object({ kind: z.literal("existing"), id })]),
        pos: z.object({ x: meters, y: meters }),
        roomKey: text(64).nullable(),
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
  floorRenames: z.array(z.object({ id, usage: text(80) })).max(40).optional(),
  equipmentEdits: z
    .array(z.object({ id, tag: text(24), name: text(120), parentId: id.nullable(), circuit: text(80).nullable(), zone: text(80).nullable() }))
    .max(200)
    .optional(),
});

const conceptSchema = z.object({
  plantId: id,
  newPlant: z.object({ name: text(120), code: text(6), location: text(200) }).nullable().optional(),
  campus: z.object({ widthM: z.number().int().min(1).max(5000), depthM: z.number().int().min(1).max(5000) }).nullable().optional(),
  buildings: z.array(buildingSchema).min(1).max(12),
});

type Summary = { href: string; buildings: number; floors: number; editedFloors: number; equipment: number; plantCreated: boolean };

/** Uloží celý koncept Studia (jedna či více budov) v jedné transakci a vrátí odkaz na první patro; nový závod si zapamatuje. */
export async function saveStudioAction(input: z.input<typeof conceptSchema>): Promise<ActionResult<Summary>> {
  const parsed = conceptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná data konceptu. Zkontrolujte vyplněné údaje." };
  try {
    await assertPermission("studio");
    await assertFeature("enterprise.studio");
    const results = await saveStudioConcept(prisma, parsed.data);
    const first = results[0];
    if (first.plantCreated) {
      (await cookies()).set(PLANT_COOKIE, first.plantId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
    }
    revalidatePath("/", "layout");
    const target = results.find((result) => result.firstFloorId) ?? first;
    const href = target.firstFloorId ? floorHref(target.plantId, target.buildingId, target.firstFloorId) : plantHref(first.plantId);
    const sum = (key: "floors" | "editedFloors" | "equipment") => results.reduce((total, result) => total + result[key], 0);
    return { ok: true, data: { href, buildings: results.length, floors: sum("floors"), editedFloors: sum("editedFloors"), equipment: sum("equipment"), plantCreated: first.plantCreated } };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Koncept se nepodařilo uložit. Zkuste to prosím znovu." };
  }
}

/** Uloží vlastní nabídku kroku 3 (názvy kategorií, dlaždice, prefixy) do nastavení tenantu. */
export async function saveStudioMenuAction(input: z.input<typeof studioMenuSchema>): Promise<ActionResult<StudioMenu>> {
  const parsed = studioMenuSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatná nabídka – zkontrolujte názvy a prefixy (jen písmena, číslice, tečka, pomlčka)." };
  try {
    await assertPermission("studio");
    await assertFeature("enterprise.studio");
    const user = await getCurrentUser();
    const menu = await saveStudioMenu(prisma, parsed.data as StudioMenu, user.id);
    revalidatePath("/studio");
    return { ok: true, data: menu };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Nabídku se nepodařilo uložit. Zkuste to prosím znovu." };
  }
}
