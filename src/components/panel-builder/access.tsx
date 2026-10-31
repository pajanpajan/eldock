import { ModuleDisabled } from "@/components/common/ModuleDisabled";
import { NoAccess } from "@/components/common/NoAccess";
import { getFeatures } from "@/server/modules";
import { getCurrentAccount } from "@/server/session";

/** Stránky AI Panel Builderu: bez oprávnění nebo s vypnutým modulem vrátí náhradní obsah, jinak null. */
export async function panelBuilderGuard(title: string) {
  const [account, features] = await Promise.all([getCurrentAccount(), getFeatures()]);
  if (!account.can("panelBuilder")) return <NoAccess title={title} current={account.accountType} suggest="MAINTENANCE_LEAD" />;
  if (!features.on("enterprise.ai_panel_builder")) return <ModuleDisabled feature="enterprise.ai_panel_builder" canManage={account.can("manageModules")} />;
  return null;
}
