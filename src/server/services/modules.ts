import type { PrismaClient } from "@/generated/prisma/client";
import {
  ADDON_MODULES,
  FEATURES,
  FEATURE_KEYS,
  PRESETS,
  isAddonModule,
  isFeatureKey,
  moduleConfigFrom,
  type DisplayMode,
  type FeatureFlags,
  type FeatureKey,
  type ModuleConfig,
  type PresetKey,
} from "@/lib/modules";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Konfigurace licenčních modulů tenantu (správa modulů a tarifů v /admin/modules).

export const DISPLAY_MODE_KEY = "modules.displayMode";

export async function loadModuleConfig(prisma: PrismaClient): Promise<ModuleConfig> {
  const [modules, features, mode] = await Promise.all([
    prisma.tenantModule.findMany({ select: { key: true, enabled: true } }),
    prisma.tenantFeature.findMany({ select: { key: true, enabled: true } }),
    prisma.tenantSetting.findUnique({ where: { key: DISPLAY_MODE_KEY }, select: { value: true } }),
  ]);
  return moduleConfigFrom(modules, features, mode?.value);
}

export async function setModuleEnabled(prisma: PrismaClient, key: string, enabled: boolean, actorId: string) {
  if (!isAddonModule(key)) throw new WorkflowError("VALIDATION", "Core moduly nelze vypnout.");
  await prisma.tenantModule.upsert({ where: { key }, create: { key, enabled, updatedById: actorId }, update: { enabled, updatedById: actorId } });
  return loadModuleConfig(prisma);
}

export async function setFeatureEnabled(prisma: PrismaClient, key: string, enabled: boolean, actorId: string) {
  if (!isFeatureKey(key)) throw new WorkflowError("VALIDATION", "Neznámá funkce.");
  if (FEATURES[key].labs) throw new WorkflowError("VALIDATION", "Připravovanou funkci zatím nelze zapnout.");
  await prisma.tenantFeature.upsert({ where: { key }, create: { key, enabled, updatedById: actorId }, update: { enabled, updatedById: actorId } });
  return loadModuleConfig(prisma);
}

export async function setDisplayMode(prisma: PrismaClient, mode: DisplayMode, actorId: string) {
  await prisma.tenantSetting.upsert({ where: { key: DISPLAY_MODE_KEY }, create: { key: DISPLAY_MODE_KEY, value: mode, updatedById: actorId }, update: { value: mode, updatedById: actorId } });
  return loadModuleConfig(prisma);
}

/** Tarifní preset jedním klikem – zapíše moduly, podfunkce i režim v jedné transakci. */
export async function applyPreset(prisma: PrismaClient, preset: PresetKey, actorId: string) {
  const target = PRESETS[preset].apply(await loadModuleConfig(prisma));
  await prisma.$transaction([
    ...ADDON_MODULES.map((key) =>
      prisma.tenantModule.upsert({ where: { key }, create: { key, enabled: target.modules[key], updatedById: actorId }, update: { enabled: target.modules[key], updatedById: actorId } }),
    ),
    ...FEATURE_KEYS.filter((key) => !FEATURES[key].labs).map((key) =>
      prisma.tenantFeature.upsert({ where: { key }, create: { key, enabled: target.features[key], updatedById: actorId }, update: { enabled: target.features[key], updatedById: actorId } }),
    ),
    prisma.tenantSetting.upsert({
      where: { key: DISPLAY_MODE_KEY },
      create: { key: DISPLAY_MODE_KEY, value: target.displayMode, updatedById: actorId },
      update: { value: target.displayMode, updatedById: actorId },
    }),
  ]);
  return loadModuleConfig(prisma);
}

/** Ochrana Server Actions a API: vypnutá podfunkce (nebo její modul) = akce odmítnuta. */
export function assertFeatureEnabled(flags: FeatureFlags, key: FeatureKey) {
  if (!flags[key]) throw new WorkflowError("FORBIDDEN", `Funkce „${FEATURES[key].label}“ není ve vašem tarifu aktivní.`);
}
