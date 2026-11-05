"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SCHEDULE_APPLIANCES } from "@/engine/room-schedule";
import { prisma } from "@/lib/prisma";
import { companyManufacturer } from "@/lib/registered-company";
import { actionFailure, guardCompany, guardProject } from "@/server/panel-guards";
import { consumeCredit } from "@/server/services/companies";
import { createProjectFromFloorplan, createProjectFromSchedule, deletePanelProjects, updateProjectHeader, type DeleteResult } from "@/server/services/panel-projects";
import { removeStoredFile } from "@/server/storage";

import type { ActionResult } from "./workflow";

// Správa projektů AI Panel Builderu (fáze 48): smazání, úprava hlavičky a návrh ze soupisu místností.

const id = z.string().min(1).max(64);
const text = z.string().trim().max(120);

/** Smazat projekt(y) přihlášené firmy; hromadně se vzorový PB-001 vynechá. */
export async function deletePanelProjectsAction(ids: string[], bulk = false): Promise<ActionResult<DeleteResult>> {
  const parsed = z.array(id).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Vyberte projekty ke smazání." };
  try {
    const company = await guardCompany();
    const result = await deletePanelProjects(prisma, company.id, parsed.data, { protectSample: bulk, removeFile: removeStoredFile });
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Projekt se nepodařilo smazat.");
  }
}

const headerSchema = z.object({ name: text.min(1), customerName: text.nullable(), installationSite: text.nullable() });

/** ✏️ Přejmenovat / upravit hlavičku projektu. */
export async function updateProjectHeaderAction(projectId: string, input: z.input<typeof headerSchema>): Promise<ActionResult> {
  const parsed = headerSchema.safeParse(input);
  if (!id.safeParse(projectId).success || !parsed.success) return { ok: false, error: "Zadejte název rozváděče (nejvýš 120 znaků)." };
  try {
    await guardProject(projectId);
    await updateProjectHeader(prisma, projectId, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Hlavičku se nepodařilo uložit.");
  }
}

const count = z.number().int().min(0).max(30);
const scheduleSchema = z.object({
  name: text.min(1),
  customerName: text.nullable(),
  installationSite: text.nullable(),
  mode: z.enum(["classic", "bus_loxone", "smart_retrofit"]),
  installMethod: z.enum(["C", "B2", "A2", "A1"]).default("C"),
  countDoubleAsTwo: z.boolean().default(true),
  rooms: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        distanceM: z.number().min(1).max(100),
        singleSockets: count,
        doubleSockets: count,
        lights: count,
        switchPlaces: z.number().int().min(0).max(6),
        appliances: z.array(z.enum(SCHEDULE_APPLIANCES as [string, ...string[]])).max(12),
      }),
    )
    .min(1)
    .max(30),
});

/** 🏠 Nový rozváděč ze soupisu okruhů / místností (ČSN 33 2130 ed. 4) – 1 kredit. */
export async function createScheduleProjectAction(input: z.input<typeof scheduleSchema>): Promise<ActionResult<{ id: string; devices: number; circuits: number; enclosure: string | null; warnings: string[] }>> {
  const parsed = scheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zkontrolujte název rozváděče a soupis místností." };
  try {
    const company = await guardCompany();
    await consumeCredit(prisma, company.id);
    try {
      const result = await createProjectFromSchedule(prisma, {
        ...parsed.data,
        rooms: parsed.data.rooms.map((room) => ({ ...room, appliances: room.appliances as (typeof SCHEDULE_APPLIANCES)[number][] })),
        companyId: company.id,
        manufacturerInfo: companyManufacturer(company),
      });
      revalidatePath("/panel-builder", "layout");
      return { ok: true, data: result };
    } catch (error) {
      // Nepovedený návrh kredit nespotřebuje
      await prisma.registeredCompany.update({ where: { id: company.id }, data: { creditsRemaining: { increment: 1 } } });
      throw error;
    }
  } catch (error) {
    return actionFailure(error, "Rozváděč ze soupisu se nepodařilo vygenerovat.");
  }
}

const floorplanSchema = z.object({ name: text.min(1), customerName: text.nullable(), installationSite: text.nullable(), draft: z.unknown() });

/** ⚡ Vygenerovat rozváděč z 2D půdorysu (fáze 49) – 1 kredit; nepovedený návrh kredit vrátí. */
export async function createFloorplanProjectAction(input: z.input<typeof floorplanSchema>): Promise<ActionResult<{ id: string; devices: number; circuits: number; enclosure: string | null; warnings: string[] }>> {
  const parsed = floorplanSchema.safeParse(input);
  if (!parsed.success || JSON.stringify(parsed.data.draft ?? null).length > 400_000) return { ok: false, error: "Zadejte název rozváděče; půdorys je příliš velký nebo neplatný." };
  try {
    const company = await guardCompany();
    await consumeCredit(prisma, company.id);
    try {
      const result = await createProjectFromFloorplan(prisma, { ...parsed.data, companyId: company.id, manufacturerInfo: companyManufacturer(company) });
      revalidatePath("/panel-builder", "layout");
      return { ok: true, data: result };
    } catch (error) {
      await prisma.registeredCompany.update({ where: { id: company.id }, data: { creditsRemaining: { increment: 1 } } });
      throw error;
    }
  } catch (error) {
    return actionFailure(error, "Rozváděč z půdorysu se nepodařilo vygenerovat.");
  }
}
