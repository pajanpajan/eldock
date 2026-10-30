"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ADDON_MODULES, FEATURE_KEYS, type ModuleConfig } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertPermission } from "@/server/permissions";
import { applyPreset, setDisplayMode, setFeatureEnabled, setModuleEnabled } from "@/server/services/modules";
import { getCurrentUser } from "@/server/session";

import type { ActionResult } from "./workflow";

// Správa modulů a tarifů (technický ředitel a vedoucí údržby – oprávnění manageModules).

async function run<S extends z.ZodType>(schema: S, raw: unknown, action: (input: z.infer<S>, actorId: string) => Promise<ModuleConfig>): Promise<ActionResult<ModuleConfig>> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Neznámý modul nebo funkce." };
  try {
    await assertPermission("manageModules");
    const user = await getCurrentUser();
    const config = await action(parsed.data, user.id);
    // Navigace, stránky i detail zařízení se mění podle modulů → celé rozhraní.
    revalidatePath("/", "layout");
    return { ok: true, data: config };
  } catch (error) {
    if (error instanceof WorkflowError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Nastavení modulů se nepodařilo uložit." };
  }
}

export async function setModuleEnabledAction(input: { key: string; enabled: boolean }) {
  return run(z.object({ key: z.enum(ADDON_MODULES), enabled: z.boolean() }), input, ({ key, enabled }, actorId) => setModuleEnabled(prisma, key, enabled, actorId));
}

export async function setFeatureEnabledAction(input: { key: string; enabled: boolean }) {
  return run(z.object({ key: z.enum(FEATURE_KEYS), enabled: z.boolean() }), input, ({ key, enabled }, actorId) => setFeatureEnabled(prisma, key, enabled, actorId));
}

export async function setDisplayModeAction(input: { mode: string }) {
  return run(z.object({ mode: z.enum(["CLEAN", "UPSELL"]) }), input, ({ mode }, actorId) => setDisplayMode(prisma, mode, actorId));
}

export async function applyPresetAction(input: { preset: string }) {
  return run(z.object({ preset: z.enum(["START", "PROFI", "ENTERPRISE"]) }), input, ({ preset }, actorId) => applyPreset(prisma, preset, actorId));
}
