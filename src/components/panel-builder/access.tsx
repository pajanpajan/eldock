import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { getFeatures } from "@/server/modules";
import { requirePanelCompany } from "@/server/panel-session";

/**
 * Stránky AI Panel Builderu (samostatný produkt, fáze 41): bez přihlášené firmy přesměruje na
 * `/panel-builder/auth`, s vypnutým modulem vrátí náhradní obsah, jinak null.
 */
export async function panelBuilderGuard() {
  const [, features] = await Promise.all([requirePanelCompany(), getFeatures()]);
  if (!features.on("enterprise.ai_panel_builder")) return <ModuleDisabled feature="enterprise.ai_panel_builder" canManage={false} />;
  return null;
}
