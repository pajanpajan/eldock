"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isTrainerPreset } from "@/lib/panel-builder/panel-trainer-presets";
import { prisma } from "@/lib/prisma";
import { recordServerEvent } from "@/server/services/telemetry";
import { companyManufacturer } from "@/lib/registered-company";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import { createSandboxProject, openTrainerProject } from "@/server/services/panel-trainer";

import type { ActionResult } from "./workflow";

// Fáze 92: trenažéry AI Panel Builderu – rozváděč z cvičného bungalovu a tréninkové zakázky bez odečtu kreditu.

const sandboxSchema = z.object({ draft: z.unknown() });

/** ⚡ z trenažéru 2D půdorysu: rozváděč z cvičného bungalovu bez kreditu (server ověří, že jde o cvičný dům). */
export async function createSandboxProjectAction(input: z.input<typeof sandboxSchema>): Promise<ActionResult<{ id: string; circuits: number; devices: number; enclosure: string | null }>> {
  const parsed = sandboxSchema.safeParse(input);
  if (!parsed.success || JSON.stringify(parsed.data.draft ?? null).length > 900_000) return { ok: false, error: "Půdorys trenažéru je neplatný." };
  try {
    const company = await guardCompany();
    const result = await createSandboxProject(prisma, { companyId: company.id, draft: parsed.data.draft, manufacturerInfo: companyManufacturer(company) });
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: { id: result.id, circuits: result.circuits, devices: result.devices, enclosure: result.enclosure } };
  } catch (error) {
    return actionFailure(error, "Rozváděč z trenažéru se nepodařilo vygenerovat.");
  }
}

/** 🎯 Tréninková zakázka jedním klikem (TRENAŽÉR – 0 kreditů); podruhé otevře tu existující. */
export async function openTrainerProjectAction(preset: string): Promise<ActionResult<{ id: string; created: boolean }>> {
  if (!isTrainerPreset(preset)) return { ok: false, error: "Neznámá tréninková zakázka." };
  try {
    const company = await guardCompany();
    const result = await openTrainerProject(prisma, { companyId: company.id, preset, manufacturerInfo: companyManufacturer(company) });
    // Fáze 102: tréninková zakázka AI Panel Builderu v telemetrii
    await recordServerEvent(prisma, { type: "sandbox_started", path: "/panel-builder", props: { sandbox: "AI Panel Builder", preset } });
    if (result.created) revalidatePath("/panel-builder", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return actionFailure(error, "Tréninkovou zakázku se nepodařilo otevřít.");
  }
}
