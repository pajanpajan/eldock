import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { ACCOUNT_TYPES, canSeeType, can, equipmentScope, visibleTypes, type Permission } from "@/lib/accounts";
import { prisma } from "@/lib/prisma";
import { ACCOUNT_COOKIE, DEMO_USER_ID, PLANT_COOKIE, ROLE_COOKIE, parseRole, type AppRole } from "@/lib/roles";

/** Uživatel aktuálního účtu: cookie účtu, jinak výchozí účet podle (starší) cookie role. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const accountId = store.get(ACCOUNT_COOKIE)?.value;
  if (accountId) {
    const user = await prisma.user.findFirst({ where: { id: accountId, accountType: { not: null } } });
    if (user) return user;
  }
  return prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID[parseRole(store.get(ROLE_COOKIE)?.value)] } });
});

/** Aktuální účet: typ, definice (oprávnění, výřez) a uživatel. */
export const getCurrentAccount = cache(async () => {
  const user = await getCurrentUser();
  const accountType = user.accountType ?? (user.role === "CAE_ENGINEER" ? "CAE_ENGINEER" : "MAINTENANCE_LEAD");
  const account = { accountType, scopeLayers: user.scopeLayers };
  return {
    ...account,
    user,
    definition: ACCOUNT_TYPES[accountType],
    /** Viditelné typy zařízení (`null` = vše). */
    types: visibleTypes(account),
    /** Prisma filtr výřezu pro `equipment`. */
    scope: equipmentScope(account),
    can: (permission: Permission) => can(account, permission),
    canSee: (type: Parameters<typeof canSeeType>[1]) => canSeeType(account, type),
  };
});

export type CurrentAccount = Awaited<ReturnType<typeof getCurrentAccount>>;

/** Workflow role pro stavový automat (odvozená z typu účtu). */
export const getCurrentRole = cache(async (): Promise<AppRole> => (await getCurrentAccount()).definition.workflowRole);

/** Id naposledy otevřeného závodu (cookie), pokud existuje. */
export const getRememberedPlantId = cache(async (): Promise<string | undefined> => {
  const store = await cookies();
  return store.get(PLANT_COOKIE)?.value;
});
