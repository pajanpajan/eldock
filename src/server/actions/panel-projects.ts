"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { SCHEDULE_APPLIANCES } from "@/engine/room-schedule";
import { prisma } from "@/lib/prisma";
import { companyManufacturer } from "@/lib/registered-company";
import { actionFailure, guardCompany, guardProject } from "@/server/panel-guards";
import { consumeCredit } from "@/server/services/companies";
import { linkGeneratedProject } from "@/server/services/floorplans";
import { createProjectFromFloorplan, createProjectFromSchedule, deletePanelProjects, updateProjectHeader, type DeleteResult } from "@/server/services/panel-projects";
import { companyOwner } from "@/lib/file-ownership";
import { removeOwnedFile } from "@/server/file-access";

import type { ActionResult } from "./workflow";

// Správa projektů AI Panel Builderu (fáze 48): smazání, úprava hlavičky a návrh ze soupisu místností.

// Fáze 55: soustava přívodu (1f / 3f, TN-C-S / TN-S / TT)
const supplySchema = z.enum(["3F_TNCS", "3F_TNS", "3F_TT", "1F_TNS", "1F_TNCS"]).optional();
const id = z.string().min(1).max(64);
const text = z.string().trim().max(120);

/** Smazat projekt(y) přihlášené firmy; hromadně se vzorový PB-001 vynechá. */
export async function deletePanelProjectsAction(ids: string[], bulk = false): Promise<ActionResult<DeleteResult>> {
  const parsed = z.array(id).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Vyberte projekty ke smazání." };
  try {
    const company = await guardCompany();
    const result = await deletePanelProjects(prisma, company.id, parsed.data, { protectSample: bulk, removeFile: (url) => removeOwnedFile(companyOwner(company.id), url) });
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Projekt se nepodařilo smazat.");
  }
}

const headerSchema = z.object({ name: text.min(1), customerName: text.nullable(), installationSite: text.nullable(), supplySystem: supplySchema });

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
  supplySystem: supplySchema,
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

const floorplanSchema = z.object({ name: text.min(1), customerName: text.nullable(), installationSite: text.nullable(), draft: z.unknown(), manufacturer: z.string().trim().max(60).nullable().optional(), floorplanId: id.optional() });

/** ⚡ Vygenerovat rozváděč z 2D půdorysu (fáze 49) – 1 kredit; nepovedený návrh kredit vrátí. Fáze 64: vazba na uložený půdorys. */
export async function createFloorplanProjectAction(input: z.input<typeof floorplanSchema>): Promise<ActionResult<{ id: string; devices: number; circuits: number; enclosure: string | null; manufacturer: string | null; warnings: string[] }>> {
  const parsed = floorplanSchema.safeParse(input);
  // Fáze 59: vícepodlažní nákres s poznámkami je větší – limit 900 kB (Server Action do 1 MB)
  if (!parsed.success || JSON.stringify(parsed.data.draft ?? null).length > 900_000) return { ok: false, error: "Zadejte název rozváděče; půdorys je příliš velký nebo neplatný." };
  const { floorplanId, ...project } = parsed.data;
  try {
    const company = await guardCompany();
    await consumeCredit(prisma, company.id);
    try {
      const result = await createProjectFromFloorplan(prisma, { ...project, companyId: company.id, manufacturerInfo: companyManufacturer(company) });
      // Fáze 64: uložený půdorys ukazuje na poslední vygenerovaný rozváděč; nákres jde do historie verzí (chyba vazby generování nezruší)
      if (floorplanId) await linkGeneratedProject(prisma, company.id, floorplanId, result.id, project.draft).catch((error: unknown) => console.error("Vazba půdorysu na rozváděč selhala", error));
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
