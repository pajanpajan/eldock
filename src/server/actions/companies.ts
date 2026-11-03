"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { AUTH_COOKIE, AUTH_TTL_SECONDS, PANEL_AUTH_COOKIE, PANEL_AUTH_TTL_SECONDS, brandEnv, panelSubject, safeNextPath, signAuthToken } from "@/lib/auth";
import { companyDetailsSchema, companyLoginSchema, panelRegistrationSchema, plantRegistrationSchema } from "@/lib/registered-company";
import { prisma } from "@/lib/prisma";
import { PLANT_COOKIE } from "@/lib/roles";
import { plantHref } from "@/lib/routes";
import { WorkflowError } from "@/lib/workflow/state-machine";
import { applyAccount } from "@/server/account-switch";
import { getPanelCompany } from "@/server/panel-session";
import { authenticateCompany, registerPanelCompany, registerPlantCompany, updateCompanyDetails } from "@/server/services/companies";

import type { ActionResult } from "./workflow";

const secure = () => process.env.NODE_ENV === "production" && brandEnv("INSECURE_COOKIE") !== "1";

/** Bezpečný cíl uvnitř AI Panel Builderu po přihlášení (jinak přehled projektů). */
const panelNext = (next: unknown) => {
  const target = typeof next === "string" ? safeNextPath(next) : undefined;
  return target && target.startsWith("/panel-builder") && !target.startsWith("/panel-builder/auth") ? target : "/panel-builder";
};

async function signInCompany(companyId: string) {
  (await cookies()).set(PANEL_AUTH_COOKIE, await signAuthToken(panelSubject(companyId), { ttl: PANEL_AUTH_TTL_SECONDS }), {
    path: "/",
    maxAge: PANEL_AUTH_TTL_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: secure(),
  });
}

function failure(error: unknown, fallback: string): { ok: false; error: string; field?: string } {
  if (error instanceof WorkflowError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: fallback };
}

/** Chyba validace formuláře → první hláška (a pole, ke kterému patří). */
function invalid(issues: { message: string; path: PropertyKey[] }[]): { ok: false; error: string; field?: string } {
  const issue = issues[0];
  return { ok: false, error: issue?.message ?? "Zkontrolujte vyplněné údaje.", field: issue?.path[0] !== undefined ? String(issue.path[0]) : undefined };
}

/** Registrace firmy (Tester) do AI Panel Builderu → přihlášení a přechod do Panel Builderu. */
export async function registerPanelCompanyAction(input: unknown, next?: string): Promise<ActionResult<{ href: string }> & { field?: string }> {
  const parsed = panelRegistrationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    const company = await registerPanelCompany(prisma, parsed.data);
    await signInCompany(company.id);
    return { ok: true, data: { href: panelNext(next) } };
  } catch (error) {
    return failure(error, "Registraci se nepodařilo dokončit. Zkuste to prosím znovu.");
  }
}

/** Přihlášení firmy do AI Panel Builderu e-mailem a heslem. */
export async function loginPanelCompanyAction(input: unknown, next?: string): Promise<ActionResult<{ href: string }>> {
  const parsed = companyLoginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Zadejte e-mail a heslo." };
  const company = await authenticateCompany(prisma, parsed.data.email, parsed.data.password, "PANEL_BUILDER");
  if (!company) return { ok: false, error: "Nesprávný e-mail nebo heslo." };
  await signInCompany(company.id);
  return { ok: true, data: { href: panelNext(next) } };
}

/** Odhlášení z AI Panel Builderu (přihlášení do správy závodů zůstane). */
export async function logoutPanelCompanyAction() {
  (await cookies()).delete(PANEL_AUTH_COOKIE);
  redirect("/");
}

/** „Firemní údaje do razítka“ – propisují se do všech listů dokumentace rozváděčů firmy. */
export async function updateCompanyDetailsAction(input: unknown): Promise<ActionResult & { field?: string }> {
  const company = await getPanelCompany();
  if (!company) return { ok: false, error: "Přihlaste se do AI Panel Builderu." };
  const parsed = companyDetailsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  try {
    await updateCompanyDetails(prisma, company.id, parsed.data);
    revalidatePath("/panel-builder", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return failure(error, "Údaje se nepodařilo uložit.");
  }
}

/**
 * Registrace výrobního závodu: firma + nový závod + Technický ředitel v jedné transakci, přihlášení
 * a přesměrování do nového závodu (Studio, dokumentace a revize – bez Panel Builderu).
 */
export async function registerPlantAction(input: unknown): Promise<ActionResult & { field?: string }> {
  const parsed = plantRegistrationSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);
  let result: Awaited<ReturnType<typeof registerPlantCompany>>;
  try {
    result = await registerPlantCompany(prisma, parsed.data);
  } catch (error) {
    return failure(error, "Registraci závodu se nepodařilo dokončit. Zkuste to prosím znovu.");
  }
  const store = await cookies();
  store.set(AUTH_COOKIE, await signAuthToken(result.userId), { path: "/", maxAge: AUTH_TTL_SECONDS, sameSite: "lax", httpOnly: true, secure: secure() });
  store.set(PLANT_COOKIE, result.plant.id, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
  await applyAccount(result.userId, plantHref(result.plant.id), plantHref(result.plant.id));
  return { ok: true, data: undefined };
}
