import type { PrismaClient } from "@/generated/prisma/client";
import { isAddonModule, moduleStateFrom, type AddonModule } from "@/lib/modules";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Konfigurace licenčních modulů tenantu (Technický ředitel v /admin/modules).

export async function loadModuleState(prisma: PrismaClient) {
  return moduleStateFrom(await prisma.tenantModule.findMany({ select: { key: true, enabled: true } }));
}

export async function setModuleEnabled(prisma: PrismaClient, key: string, enabled: boolean, actorId: string) {
  if (!isAddonModule(key)) throw new WorkflowError("VALIDATION", "Core moduly nelze vypnout.");
  await prisma.tenantModule.upsert({
    where: { key },
    create: { key, enabled, updatedById: actorId },
    update: { enabled, updatedById: actorId },
  });
  return loadModuleState(prisma);
}

/** Ochrana Server Actions a API: vypnutý modul = akce odmítnuta (UI ji jen skrývá). */
export function assertModuleEnabled(state: Record<AddonModule, boolean>, key: AddonModule, label: string) {
  if (!state[key]) throw new WorkflowError("FORBIDDEN", `Funkce je dostupná v modulu „${label}“, který není aktivní.`);
}
