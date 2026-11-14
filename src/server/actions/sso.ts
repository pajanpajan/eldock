"use server";

import { redirect, unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";

import { safeNextPath } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { applyAccount } from "@/server/account-switch";
import { getPanelCompany } from "@/server/panel-session";
import { getAuthState, getCurrentAccount } from "@/server/session";
import { startPanelSession, startPlantSession } from "@/server/sso-session";
import { bridgePanelToPlant, bridgePlantToPanel, linkCompanies } from "@/server/services/sso-bridge";

import type { ActionResult } from "./workflow";

// Fáze 114: SSO přemostění AI Panel Builderu a Hlídače revizí / Správy závodů – jedno kliknutí místo druhé registrace.

const failure = (error: unknown, fallback: string): { ok: false; error: string } => {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
};

/** Cíl po přemostění do Správy závodů (výchozí Hlídač revizí); nový spárovaný účet dostane `?sso=novy`. */
const plantTarget = (next: unknown, created: boolean) => {
  const target = (typeof next === "string" ? safeNextPath(next) : undefined) ?? "/hlidac-revizi";
  return created ? `${target}${target.includes("?") ? "&" : "?"}sso=novy` : target;
};

/** Cíl po přemostění do AI Panel Builderu (jen stránky Panel Builderu). */
const panelTarget = (next: unknown, created: boolean) => {
  const target = typeof next === "string" ? safeNextPath(next) : undefined;
  const base = target?.startsWith("/panel-builder") && !target.startsWith("/panel-builder/auth") ? target : "/panel-builder";
  return created ? `${base}${base.includes("?") ? "&" : "?"}sso=novy` : base;
};

/**
 * „🔄 Pokračovat pod mým účtem z Panel Builderu“ – přihlášená firma AI Panel Builderu se přihlásí do spárovaného účtu
 * Hlídače revizí / Správy závodů (bez spárování ho založí se stejným e-mailem a heslem) a přejde na `next`.
 */
export async function continueWithPanelAccountAction(next?: string): Promise<ActionResult> {
  const company = await getPanelCompany();
  if (!company) return { ok: false, error: "Nejdřív se přihlaste do AI Panel Builderu." };
  let target: string;
  try {
    const result = await bridgePanelToPlant(prisma, company.id);
    if (result.kind === "login") return { ok: false, error: result.message };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: result.userId }, select: { id: true, companyId: true, email: true } });
    await startPlantSession(user, result.plantId, `SSO z AI Panel Builderu${result.created ? " – nový spárovaný účet" : ""}`);
    target = plantTarget(next, result.created);
    await applyAccount(user.id, "/hlidac-revizi", target);
  } catch (error) {
    // Přesměrování z `applyAccount` (redirect) propustit dál
    unstable_rethrow(error);
    return failure(error, "Přihlášení do Hlídače revizí se nepodařilo. Zkuste to prosím znovu.");
  }
  redirect(target);
}

/**
 * „⚡ Otevřít AI Panel Builder“ pod účtem Správy závodů (oprávnění Panel Builderu) – spárovaná firma AI Panel Builderu,
 * bez spárování nová se stejným e-mailem a heslem firmy.
 */
export async function openPanelBuilderAction(next?: string): Promise<ActionResult> {
  const state = await getAuthState();
  if (!state.user?.companyId) return { ok: false, error: "Přihlaste se do Správy závodů / Hlídače revizí." };
  const account = await getCurrentAccount();
  if (!account.can("panelBuilder")) return { ok: false, error: `Účet ${account.definition.label} nemá oprávnění k AI Panel Builderu.` };
  let target: string;
  try {
    const result = await bridgePlantToPanel(prisma, state.user.id);
    if (result.kind === "login") return { ok: false, error: result.message };
    await startPanelSession(result.companyId);
    target = panelTarget(next, result.created);
  } catch (error) {
    return failure(error, "Přechod do AI Panel Builderu se nepodařil. Zkuste to prosím znovu.");
  }
  revalidatePath("/panel-builder", "layout");
  redirect(target);
}

/** 🔗 Propojení účtů obou produktů (přihlášený v obou, ve Správě závodů jako správce firmy). */
export async function linkAccountsAction(): Promise<ActionResult<{ linked: boolean }>> {
  const company = await getPanelCompany();
  const state = await getAuthState();
  if (!company || !state.user?.companyId) return { ok: false, error: "Pro propojení buďte přihlášeni v AI Panel Builderu i ve Správě závodů." };
  if (state.user.accountType !== "PLANT_ADMIN") return { ok: false, error: "Účty propojí správce firmy (Technický ředitel)." };
  try {
    const result = await linkCompanies(prisma, company.id, state.user.companyId);
    revalidatePath("/", "layout");
    return { ok: true, data: result };
  } catch (error) {
    return failure(error, "Účty se nepodařilo propojit.");
  }
}
