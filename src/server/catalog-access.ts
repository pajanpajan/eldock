import "server-only";

import { getPanelCompany } from "@/server/panel-session";
import { getSignedInUser } from "@/server/session";
import { isSuperadmin } from "@/server/superadmin-session";

// Fáze 104: kdo smí číst katalogová data výrobců po kouscích (EAN, rámečky ETIM, index fotek) – jen přihlášení.

/** Přihlášený uživatel kterékoli části (firma AI Panel Builderu včetně ukázkové, uživatel závodu, velín). */
export async function hasCatalogSession(): Promise<boolean> {
  const [company, user, superadmin] = await Promise.all([getPanelCompany(), getSignedInUser(), isSuperadmin()]);
  return Boolean(company || user || superadmin);
}
