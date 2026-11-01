import type { AccountType } from "@/generated/prisma/enums";
import { isAccountSwitcherLocked } from "@/lib/auth";

import { SwitchRoleButtonClient } from "./SwitchRoleButtonClient";

/** Výzva „Přepnout na účet …“; při uzamčeném přepínači účtů (ELDOCK_LOCK_ACCOUNT_SWITCHER=1) se nezobrazí. */
export function SwitchRoleButton(props: { role?: "MAINTENANCE" | "CAE_ENGINEER"; account?: AccountType }) {
  if (isAccountSwitcherLocked()) return null;
  return <SwitchRoleButtonClient {...props} />;
}
