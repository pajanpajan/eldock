import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACCOUNT_TYPES } from "@/lib/accounts";
import { resolveHome } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COOKIE, PLANT_COOKIE, ROLE_COOKIE } from "@/lib/roles";
import { getFeatures } from "@/server/modules";
import { getRememberedPlantId } from "@/server/session";

// Nastavení účtu bez kontroly zámku přepínače. Záměrně mimo `"use server"` (není to Server Action,
// klient ho nemůže zavolat): používá ho přepínač účtů (po kontrole zámku) a přihlášení na /login.

const COOKIE_OPTIONS = {
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  httpOnly: true,
} as const;

/** Nastaví účet (cookie účtu, role a závodu) a přesměruje – volá ho i přihlášení (/login). */
export async function applyAccount(userId: string, pathname: string, redirectTo?: string) {
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
  if (definition.home !== "plant") redirect(resolveHome(definition.home, (await getFeatures()).flags));
  const plantId =
    fromPath ??
    (await getRememberedPlantId()) ??
    (await prisma.plant.findFirstOrThrow({ orderBy: { code: "asc" } })).id;
  redirect(`/plant/${plantId}`);
}

