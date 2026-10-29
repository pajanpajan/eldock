"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COOKIE, DEMO_USER_ID, PLANT_COOKIE, ROLE_COOKIE, roleSchema } from "@/lib/roles";
import { getRememberedPlantId } from "@/server/session";

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  httpOnly: true,
} as const;

/**
 * Přepne účet. Z aktuální cesty si zapamatuje závod (`/plant/<id>/…`), aby se uživatel
 * po návratu vrátil tam, kde byl. `redirectTo` (interní cesta) nechá uživatele na místě,
 * jinak přistane na domovské stránce účtu.
 */
export async function setAccount(userId: string, pathname: string, redirectTo?: string) {
  const user = await prisma.user.findFirst({ where: { id: z.string().min(1).max(64).parse(userId), accountType: { not: null } } });
  if (!user?.accountType) throw new Error("Účet neexistuje.");
  const definition = ACCOUNT_TYPES[user.accountType];
  const store = await cookies();
  store.set(ACCOUNT_COOKIE, user.id, COOKIE_OPTIONS);
  store.set(ROLE_COOKIE, definition.workflowRole, COOKIE_OPTIONS);

  const fromPath = /^\/plant\/([^/]+)/.exec(pathname)?.[1];
  if (fromPath && (await prisma.plant.count({ where: { id: fromPath } })) > 0) {
    store.set(PLANT_COOKIE, fromPath, COOKIE_OPTIONS);
  }

  revalidatePath("/", "layout");

  if (redirectTo?.startsWith("/") && !redirectTo.startsWith("//")) redirect(redirectTo);
  if (definition.home !== "plant") redirect(definition.home);
  const plantId =
    fromPath ??
    (await getRememberedPlantId()) ??
    (await prisma.plant.findFirstOrThrow({ orderBy: { code: "asc" } })).id;
  redirect(`/plant/${plantId}`);
}

/** Přepne na první účet daného typu (výzvy „Přepnout na …“). */
export async function setAccountType(accountType: AccountType, pathname: string, redirectTo?: string) {
  const user = await prisma.user.findFirst({ where: { accountType }, orderBy: { sortOrder: "asc" } });
  if (!user) throw new Error("Účet neexistuje.");
  return setAccount(user.id, pathname, redirectTo);
}

/** Starší přepínač pohledu Údržba / CAE → výchozí účet role. */
export async function setRole(role: string, pathname: string, redirectTo?: string) {
  return setAccount(DEMO_USER_ID[roleSchema.parse(role)], pathname, redirectTo);
}
