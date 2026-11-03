import "server-only";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { assertFeature } from "@/server/modules";
import { getPanelCompany } from "@/server/panel-session";

// Kontroly přístupu pro Server Actions AI Panel Builderu (záměrně mimo „use server“, aby se z nich
// nestaly volatelné akce). Samostatný produkt (fáze 41): jen přihlášená registrovaná firma a její projekty.

export async function guardCompany() {
  const company = await getPanelCompany();
  if (!company) throw new WorkflowError("FORBIDDEN", "Přihlaste se do AI Panel Builderu.");
  await assertFeature("enterprise.ai_panel_builder");
  return company;
}

/** Projekt musí patřit přihlášené firmě (cizí projekt = nenalezen). */
export async function guardProject(projectId: string) {
  const company = await guardCompany();
  if (!(await prisma.panelBoardProject.count({ where: { id: projectId, companyId: company.id } }))) throw new WorkflowError("NOT_FOUND", "Projekt nebyl nalezen.");
  return company;
}

/** Prvek musí patřit do projektu přihlášené firmy. */
export async function guardItem(itemId: string) {
  const company = await guardCompany();
  if (!(await prisma.panelBoardItem.count({ where: { id: itemId, project: { companyId: company.id } } }))) throw new WorkflowError("NOT_FOUND", "Prvek nebyl nalezen.");
  return company;
}

export function actionFailure(error: unknown, fallback: string): { ok: false; error: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}
