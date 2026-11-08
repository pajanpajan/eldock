"use server";

import type { AccountType } from "@/generated/prisma/enums";
import { isAccountSwitcherLocked } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEMO_USER_ID, roleSchema } from "@/lib/roles";
import { applyAccount } from "@/server/account-switch";
import { getAuthState } from "@/server/session";

/**
 * Přepne účet. Z aktuální cesty si zapamatuje závod (`/plant/<id>/…`), aby se uživatel
 * po návratu vrátil tam, kde byl. `redirectTo` (interní cesta) nechá uživatele na místě,
 * jinak přistane na domovské stránce účtu.
 */
export async function setAccount(userId: string, pathname: string, redirectTo?: string) {
  const state = await getAuthState();
  const signedIn = state.user;
  // Registrovaná firma (fáze 41) má účet vždy uzamčený na přihlášeného uživatele, demo účty z ní nejsou dostupné.
  if ((isAccountSwitcherLocked() || signedIn?.companyId) && signedIn?.id !== userId) {
    throw new Error("Přepínání účtů je uzamčené – pro jiný účet se odhlaste a přihlaste na /login.");
  }
  // Fáze 67: přepínač obchodního dema smí jen na demo účty (ne na uživatele registrované firmy).
  if (signedIn?.id !== userId && !(await prisma.user.findFirst({ where: { id: userId, accountType: { not: null }, companyId: null }, select: { id: true } }))) {
    throw new Error("Účet neexistuje.");
  }
  return applyAccount(userId, pathname, redirectTo);
}

/** Přepne na první demo účet daného typu (výzvy „Přepnout na …“). */
export async function setAccountType(accountType: AccountType, pathname: string, redirectTo?: string) {
  const user = await prisma.user.findFirst({ where: { accountType, companyId: null }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  if (!user) throw new Error("Účet neexistuje.");
  return setAccount(user.id, pathname, redirectTo);
}

/** Starší přepínač pohledu Údržba / CAE → výchozí účet role. */
export async function setRole(role: string, pathname: string, redirectTo?: string) {
  return setAccount(DEMO_USER_ID[roleSchema.parse(role)], pathname, redirectTo);
}
