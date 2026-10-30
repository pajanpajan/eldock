import "server-only";

import { cache } from "react";

import { MODULES, type AddonModule } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { assertModuleEnabled, loadModuleState } from "@/server/services/modules";

/** Stav licenčních modulů pro aktuální požadavek (jeden dotaz na render). */
export const getModuleState = cache(() => loadModuleState(prisma));

/** V Server Action: vypnutý modul → WorkflowError s českou hláškou. */
export async function assertModule(key: AddonModule) {
  assertModuleEnabled(await getModuleState(), key, MODULES[key].label);
}
