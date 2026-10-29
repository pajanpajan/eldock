import { Lock } from "lucide-react";

import type { AccountType } from "@/generated/prisma/enums";
import { ACCOUNT_TYPES } from "@/lib/accounts";

import { EmptyState } from "./EmptyState";
import { SwitchRoleButton } from "./SwitchRoleButton";

/** Stránka mimo oprávnění účtu – s nabídkou přepnout na vhodný účet (demo bez přihlášení). */
export function NoAccess({ title, current, suggest }: { title: string; current: AccountType; suggest: AccountType }) {
  return (
    <EmptyState
      icon={Lock}
      title={title}
      description={`Účet ${ACCOUNT_TYPES[current].label} k této části nemá oprávnění. ${ACCOUNT_TYPES[current].scopeDescription}`}
      action={<SwitchRoleButton account={suggest} />}
    />
  );
}
