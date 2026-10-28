import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";

import { prisma } from "@/lib/prisma";
import { DEMO_USER_ID, PLANT_COOKIE, ROLE_COOKIE, parseRole, type AppRole } from "@/lib/roles";

export const getCurrentRole = cache(async (): Promise<AppRole> => {
  const store = await cookies();
  return parseRole(store.get(ROLE_COOKIE)?.value);
});

export const getCurrentUser = cache(async () => {
  const role = await getCurrentRole();
  return prisma.user.findUniqueOrThrow({ where: { id: DEMO_USER_ID[role] } });
});

/** Id naposledy otevřeného závodu (cookie), pokud existuje. */
export const getRememberedPlantId = cache(async (): Promise<string | undefined> => {
  const store = await cookies();
  return store.get(PLANT_COOKIE)?.value;
});
