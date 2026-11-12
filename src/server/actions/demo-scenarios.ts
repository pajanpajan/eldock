"use server";

import { revalidatePath } from "next/cache";

import { demoDraft, demoScenario, isDemoScenarioId } from "@/lib/panel-builder/demo-scenarios";
import { prisma } from "@/lib/prisma";
import { actionFailure, guardCompany } from "@/server/panel-guards";
import { createFloorplan } from "@/server/services/floorplans";

import type { ActionResult } from "./workflow";

/**
 * Fáze 99: demo scénář na 1 klik – založí přihlášené firmě nový půdorys z připraveného nákresu (nic nepřepíše) a vrátí
 * jeho id; editor ho pak otevře ve fázi 1. Rozváděč z něj se generuje jako z každého jiného půdorysu (1 kredit).
 */
export async function createDemoFloorplanAction(scenario: string): Promise<ActionResult<{ id: string; name: string }>> {
  if (!isDemoScenarioId(scenario)) return { ok: false, error: "Neznámý demo scénář." };
  try {
    const company = await guardCompany();
    const info = demoScenario(scenario);
    const created = await createFloorplan(prisma, company.id, { meta: { name: info.name, customerName: info.customer, installationSite: info.site }, draft: demoDraft(scenario) });
    revalidatePath("/panel-builder/floorplan");
    return { ok: true, data: { id: created.id, name: info.name } };
  } catch (error) {
    return actionFailure(error, "Demo scénář se nepodařilo načíst.");
  }
}
