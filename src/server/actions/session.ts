"use server";

import { cookies } from "next/headers";

import type { AccountType } from "@/generated/prisma/enums";
import { AUTH_COOKIE, isAccountSwitcherLocked, verifyAuthToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_ID, roleSchema } from "@/lib/roles";
import { applyAccount } from "@/server/account-switch";

/**
 * Přepne účet. Z aktuální cesty si zapamatuje závod (`/plant/<id>/…`), aby se uživatel
 * po návratu vrátil tam, kde byl. `redirectTo` (interní cesta) nechá uživatele na místě,
 * jinak přistane na domovské stránce účtu.
 */
export async function setAccount(userId: string, pathname: string, redirectTo?: string) {
  const session = await verifyAuthToken((await cookies()).get(AUTH_COOKIE)?.value);
  // Registrovaná firma (fáze 41) má účet vždy uzamčený na přihlášeného uživatele, demo účty z ní nejsou dostupné.
  const registered = session ? await prisma.user.findFirst({ where: { id: session.userId, companyId: { not: null } }, select: { id: true } }) : null;
  if ((isAccountSwitcherLocked() || registered) && session?.userId !== userId) {
    throw new Error("Přepínání účtů je uzamčené – pro jiný účet se odhlaste a přihlaste na /login.");
  }
  return applyAccount(userId, pathname, redirectTo);
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
