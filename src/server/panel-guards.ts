import "server-only";

import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import type { PaywallInfo } from "@/lib/credits/entitlements";
import { assertFeature } from "@/server/modules";
import { getPanelCompany } from "@/server/panel-session";
import { assertEditable } from "@/server/services/switchboard-versions";

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

/**
 * Fáze 103: úprava rozváděče – projekt firmy v rozpracovaném stavu. Předaný ke kusové zkoušce nebo uzamčený ve vydané
 * verzi (karta /q/EL-…) se nemění, dokud ho firma neodemkne (nová revize); protokol kusové zkoušky jde vyplnit i během ní.
 */
export async function guardEditableProject(projectId: string, options: { allowPending?: boolean } = {}) {
  const company = await guardProject(projectId);
  await assertEditable(prisma, { projectId }, options);
  return company;
}

/** Fáze 103: úprava prvku jen v rozpracovaném rozváděči. */
export async function guardEditableItem(itemId: string) {
  const company = await guardItem(itemId);
  await assertEditable(prisma, { itemId });
  return company;
}

export function actionFailure(error: unknown, fallback: string): { ok: false; error: string; paywall?: PaywallInfo } {
  // Fáze 111: nedostatek kreditů → data prodejního modalu „💎 Odemkněte plnou verzi ELDOCK“
  if (error instanceof WorkflowError && "paywall" in error) return { ok: false, error: error.message, paywall: (error as WorkflowError & { paywall: PaywallInfo }).paywall };
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}
