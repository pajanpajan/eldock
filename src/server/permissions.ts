import "server-only";

import { PERMISSION_LABELS, type Permission } from "@/lib/accounts";
import { WorkflowError } from "@/lib/workflow/state-machine";

import { getCurrentAccount } from "./session";

/** Ověří oprávnění aktuálního účtu v Server Action (UI tlačítka jen skrývá). */
export async function assertPermission(permission: Permission) {
  const account = await getCurrentAccount();
  if (!account.can(permission)) {
    throw new WorkflowError("FORBIDDEN", `Účet ${account.definition.label} nemá oprávnění: ${PERMISSION_LABELS[permission]}.`);
  }
  return account;
}
