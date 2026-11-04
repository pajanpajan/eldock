"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import type { ItemConfig } from "@/lib/panel-builder/configurator";
import { MAX_RAIL_MODULES, MAX_RAILS, MIN_RAIL_MODULES } from "@/lib/panel-builder/rails";
import { actionFailure, guardCompany, guardProject } from "@/server/panel-guards";
import { saveRoutineTest, setStandardEdition } from "@/server/services/panel-design";
import { ROUTINE_TEST_POINTS } from "@/lib/legislation-2027";
import { listEnclosures, moveRail, placeComponents, previewConfig, saveCircuitChips, selectEnclosure, setCompanyBranding, setEnvironment, setRailCapacity, type ConfigPreview } from "@/server/services/panel-design";
import { MAX_CHIPS, type ChipSet } from "@/lib/panel-builder/circuit-chips";

import type { ActionResult } from "./workflow";

// Návrh rozváděče od nuly (fáze 43): lišty, osazení z kaskádového menu, skříně a razítko firmy.

const id = z.string().min(1).max(64);
const rail = z.number().int().min(1).max(MAX_RAILS);
const text = (max: number) => z.string().max(max).nullable().optional();

const configSchema = z.object({
  category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "OTHER", "ACCESSORY"]),
  manufacturer: z.string().trim().max(40).nullable(),
  poles: z.string().max(8),
  modules: z.number().positive().max(12),
  ratedCurrentA: z.number().positive().max(6300).nullable(),
  curve: text(2),
  breakingCapacityKa: z.number().positive().max(100).nullable().optional(),
  rcdType: text(3),
  rcdSensitivityMa: z.number().int().positive().max(1000).nullable().optional(),
  spdType: text(8),
  surgeCurrentKa: z.number().positive().max(200).nullable().optional(),
  contactConfig: text(10),
  coilVoltage: text(12),
  relaySubtype: text(20),
  moduleSubtype: text(24),
  power: text(12),
});

/** Šířka DIN lišty v modulech (preset nebo − / +). */
export async function setRailCapacityAction(projectId: string, railIndex: number, modules: number): Promise<ActionResult<{ overflow: number }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || !z.number().int().min(MIN_RAIL_MODULES).max(MAX_RAIL_MODULES).safeParse(modules).success) {
    return { ok: false, error: `Šířka lišty musí být ${MIN_RAIL_MODULES}–${MAX_RAIL_MODULES} modulů.` };
  }
  try {
    await guardProject(projectId);
    const result = await setRailCapacity(prisma, projectId, railIndex, modules);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { overflow: result.overflow } };
  } catch (error) {
    return actionFailure(error, "Šířku lišty se nepodařilo změnit.");
  }
}

/** Pořadí lišt: šipka nahoru / dolů. */
export async function moveRailAction(projectId: string, railIndex: number, direction: -1 | 1): Promise<ActionResult<{ rail: number }>> {
  if (!id.safeParse(projectId).success || !rail.safeParse(railIndex).success || (direction !== -1 && direction !== 1)) return { ok: false, error: "Neplatný přesun lišty." };
  try {
    await guardProject(projectId);
    const result = await moveRail(prisma, projectId, railIndex, direction);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Lištu se nepodařilo přesunout.");
  }
}

const placeSchema = z.object({
  projectId: id,
  config: configSchema,
  rail,
  count: z.number().int().min(1).max(24),
  position: z.number().int().min(1).max(200).nullable().optional(),
  circuitLabel: z.string().max(80).optional(),
});

/** Drag & drop / „➕ Vložit na aktivní lištu“ (1× / +3× / +6×). */
export async function placeComponentsAction(input: z.input<typeof placeSchema>): Promise<ActionResult<{ ids: string[]; placed: number; requested: number; typeCode: string }>> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné osazení přístroje." };
  try {
    await guardProject(parsed.data.projectId);
    const { projectId, ...rest } = parsed.data;
    const result = await placeComponents(prisma, projectId, { ...rest, config: rest.config as ItemConfig });
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Přístroj se nepodařilo vložit na lištu.");
  }
}

/** Živá karta „Přiřazený přístroj k osazení“ (přesný typ, MPN, Pv a příslušenství z databáze). */
export async function previewConfigAction(config: z.input<typeof configSchema>): Promise<ActionResult<ConfigPreview>> {
  const parsed = configSchema.safeParse(config);
  if (!parsed.success) return { ok: false, error: "Neplatná konfigurace." };
  try {
    await guardCompany();
    return { ok: true, data: await previewConfig(prisma, parsed.data as ItemConfig) };
  } catch (error) {
    return actionFailure(error, "Náhled přístroje se nepodařilo načíst.");
  }
}

/** Skříně vybraného výrobce (seznam se zobrazí až po volbě výrobce). */
export async function listEnclosuresAction(manufacturer: string): Promise<ActionResult<Awaited<ReturnType<typeof listEnclosures>>>> {
  if (!z.string().trim().min(1).max(40).safeParse(manufacturer).success) return { ok: false, error: "Vyberte výrobce skříně." };
  try {
    await guardCompany();
    return { ok: true, data: await listEnclosures(prisma, manufacturer) };
  } catch (error) {
    return actionFailure(error, "Skříně se nepodařilo načíst.");
  }
}

/** Kliknutím na skříň se rozměry, model a P_max propíšou do projektu a výpočtu oteplení. */
export async function selectEnclosureAction(projectId: string, enclosureId: string): Promise<ActionResult<{ enclosureModel: string }>> {
  if (!id.safeParse(projectId).success || !id.safeParse(enclosureId).success) return { ok: false, error: "Neplatná skříň." };
  try {
    await guardProject(projectId);
    const project = await selectEnclosure(prisma, projectId, enclosureId);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { enclosureModel: project.enclosureModel } };
  } catch (error) {
    return actionFailure(error, "Skříň se nepodařilo vybrat.");
  }
}

const imageUrl = z
  .string()
  .max(300)
  .regex(/^\/api\/files\/(photos|documents)\/[\w./-]+\.(png|jpe?g|svg|webp)$/i)
  .nullable()
  .optional();

/** Logo a razítko firmy v profilu (propisují se do dokumentace kroku 4). */
export async function setCompanyBrandingAction(input: { logoUrl?: string | null; stampUrl?: string | null }): Promise<ActionResult<{ logoUrl: string | null; stampUrl: string | null }>> {
  const parsed = z.object({ logoUrl: imageUrl, stampUrl: imageUrl }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Nahrajte obrázek PNG, JPG nebo SVG." };
  try {
    const company = await guardCompany();
    const result = await setCompanyBranding(prisma, company.id, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { logoUrl: result.logoUrl, stampUrl: result.stampUrl } };
  } catch (error) {
    return actionFailure(error, "Logo nebo razítko se nepodařilo uložit.");
  }
}

/** Prostředí instalace (ČSN 33 2000-5-51 ed. 3) – nastaví i teplotu okolí pro oteplení. */
export async function setEnvironmentAction(projectId: string, environment: string): Promise<ActionResult<{ ambientTempC: number }>> {
  if (!id.safeParse(projectId).success || !z.string().max(20).safeParse(environment).success) return { ok: false, error: "Neplatné prostředí." };
  try {
    await guardProject(projectId);
    const result = await setEnvironment(prisma, projectId, environment);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: { ambientTempC: result.ambientTempC } };
  } catch (error) {
    return actionFailure(error, "Prostředí se nepodařilo uložit.");
  }
}

const chipSchema = z.object({
  updatedAt: z.number().int().nonnegative(),
  chips: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        label: z.string().trim().min(1).max(40),
        numbered: z.boolean().optional(),
        preset: z
          .object({
            category: z.enum(["MCB", "RCD", "RCBO", "MAIN_SWITCH", "SPD", "CONTACTOR", "RELAY", "OTHER", "ACCESSORY"]),
            poles: z.string().max(8).optional(),
            curve: z.string().max(2).optional(),
            ratedCurrentA: z.number().positive().max(6300).optional(),
          })
          .nullable()
          .optional(),
      }),
    )
    .max(MAX_CHIPS),
});

/** Štítky funkce obvodu – synchronizace z prohlížeče do firmy (novější vyhrává). */
export async function saveCircuitChipsAction(input: z.input<typeof chipSchema>): Promise<ActionResult<{ saved: boolean; set: ChipSet }>> {
  const parsed = chipSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatné štítky." };
  try {
    const company = await guardCompany();
    return { ok: true, data: await saveCircuitChips(prisma, company.id, parsed.data as ChipSet) };
  } catch (error) {
    return actionFailure(error, "Štítky se nepodařilo uložit.");
  }
}

/** Edice normy rozváděče (krok 1 a krok 4) – propisuje se do Listu 5 a 6 dokumentace. */
export async function setStandardEditionAction(projectId: string, edition: string): Promise<ActionResult> {
  if (!id.safeParse(projectId).success || !z.string().max(30).safeParse(edition).success) return { ok: false, error: "Neplatná norma." };
  try {
    await guardProject(projectId);
    await setStandardEdition(prisma, projectId, edition);
    revalidatePath(`/panel-builder/${projectId}`, "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return actionFailure(error, "Normu se nepodařilo změnit.");
  }
}

const result = z.enum(["PASS", "FAIL"]).nullable();
const routineSchema = z.object({
  points: z.object(Object.fromEntries(ROUTINE_TEST_POINTS.map((point) => [point.id, result])) as Record<(typeof ROUTINE_TEST_POINTS)[number]["id"], typeof result>),
  insulationMOhm: z.number().min(0).max(100_000).nullable(),
  testedBy: z.string().max(120),
  testedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().max(1000),
});

/** Protokol o kusové zkoušce – autosave z kroku 4. */
export async function saveRoutineTestAction(projectId: string, test: z.input<typeof routineSchema>): Promise<ActionResult<{ verdict: string; missing: string[] }>> {
  const parsed = routineSchema.safeParse(test);
  if (!id.safeParse(projectId).success || !parsed.success) return { ok: false, error: "Neplatný protokol kusové zkoušky." };
  try {
    await guardProject(projectId);
    const saved = await saveRoutineTest(prisma, projectId, parsed.data);
    revalidatePath(`/panel-builder/${projectId}/documentation`);
    return { ok: true, data: { verdict: saved.verdict, missing: saved.missing } };
  } catch (error) {
    return actionFailure(error, "Protokol se nepodařilo uložit.");
  }
}
