"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { PERMISSION_LABELS } from "@/lib/accounts";
import { bimPlantPayloadSchema } from "@/lib/bim/bim-payload";
import { prisma } from "@/lib/prisma";
import { companyManufacturer } from "@/lib/registered-company";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { getPanelCompany } from "@/server/panel-session";
import { importBimToPlant, type BimImportResult } from "@/server/services/bim-import";
import { consumeCredit } from "@/server/services/companies";
import { createProjectFromBimBoard } from "@/server/services/panel-projects";
import { getCurrentAccount } from "@/server/session";
import { assertTenantAccess } from "@/server/tenant";

import type { ActionResult } from "./workflow";

// Fáze 95: import BIM modelu (IFC) do Správy závodů (Studio / mapa areálu) a návrh vnitřního osazení rozváděče z BIMu
// v AI Panel Builderu. Soubor IFC se čte v prohlížeči – sem jde zmenšený model (podlaží, místnosti, zdroje, rozváděče,
// stroje a kabely s délkou), který se znovu ověří schématem.

const importSchema = z.object({ plantId: z.string().min(1).max(64), mode: z.enum(["CREATE", "UPDATE"]), payload: bimPlantPayloadSchema });

function failure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

/** 🏢 Import BIM modelu závodu: nová budova se zařízeními, nebo aktualizace stávajících rozváděčů podle kódů. */
export async function importBimAction(input: z.input<typeof importSchema>): Promise<ActionResult<BimImportResult>> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "BIM model se nepodařilo převzít – soubor IFC je neúplný nebo příliš velký." };
  try {
    const account = await getCurrentAccount();
    if (!account.can("studio")) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.studio}.`);
    await assertFeature("enterprise.studio");
    await assertTenantAccess({ plantId: parsed.data.plantId });
    const result = await importBimToPlant(prisma, parsed.data.plantId, parsed.data.payload, parsed.data.mode);
    revalidatePath(`/plant/${result.plantId}`, "layout");
    revalidatePath("/studio");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Import BIM modelu se nepodařil. Zkuste to prosím znovu.");
  }
}

const boardSchema = z.object({ equipmentId: z.string().min(1).max(64) });

/**
 * ⚡ Rozváděč z BIMu do AI Panel Builderu: vývody k napájeným zařízením a hlavní vypínač → nový návrh v projektech
 * přihlášené firmy AI Panel Builderu (1 kredit, nepovedený návrh kredit vrátí).
 */
export async function createBimBoardProjectAction(input: z.input<typeof boardSchema>): Promise<ActionResult<{ id: string; devices: number; circuits: number; warnings: string[] }>> {
  const parsed = boardSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Neplatný rozváděč." };
  try {
    const account = await getCurrentAccount();
    if (!account.can("panelBuilder")) throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS.panelBuilder}.`);
    await assertTenantAccess(parsed.data);
    const company = await getPanelCompany();
    if (!company) throw new WorkflowError("FORBIDDEN", "Přihlaste se do AI Panel Builderu (účet firmy) – návrh rozváděče se uloží do projektů vaší firmy.");
    await assertFeature("enterprise.ai_panel_builder");
    await consumeCredit(prisma, company.id);
    try {
      const result = await createProjectFromBimBoard(prisma, { equipmentId: parsed.data.equipmentId, companyId: company.id, manufacturerInfo: companyManufacturer(company) });
      revalidatePath("/panel-builder", "layout");
      return { ok: true, data: { id: result.id, devices: result.devices, circuits: result.circuits, warnings: result.warnings } };
    } catch (error) {
      await prisma.registeredCompany.update({ where: { id: company.id }, data: { creditsRemaining: { increment: 1 } } });
      throw error;
    }
  } catch (error) {
    return failure(error, "Návrh rozváděče z BIMu se nepodařilo vytvořit.");
  }
}
