import "server-only";

import { cache } from "react";

import { effectiveFeatures, type FeatureKey } from "@/lib/modules";
import { prisma } from "@/lib/prisma";
import { assertFeatureEnabled, loadModuleConfig } from "@/server/services/modules";

/** Konfigurace modulů pro aktuální požadavek (jeden dotaz na render). */
export const getModuleConfig = cache(() => loadModuleConfig(prisma));

/**
 * Účinné podfunkce (modul + podfunkce zapnuté) a režim zobrazení vypnutých funkcí.
 * `show(key)` = funkci vykreslit (zapnutá, nebo v obchodním demu se zámkem).
 */
export const getFeatures = cache(async () => {
  const config = await getModuleConfig();
  const flags = effectiveFeatures(config);
  const upsell = config.displayMode === "UPSELL";
  return { config, flags, upsell, on: (key: FeatureKey) => flags[key], show: (key: FeatureKey) => flags[key] || upsell };
});

/** V Server Action / API: vypnutá podfunkce → WorkflowError s českou hláškou. */
export async function assertFeature(key: FeatureKey) {
  assertFeatureEnabled((await getFeatures()).flags, key);
}
