import "server-only";

import { cookies } from "next/headers";

import { SUPERADMIN_COOKIE, isSuperadminToken } from "@/lib/auth";
import { WorkflowError } from "@/lib/workflow/state-machine";

// Velín /superadmin (fáze 50): stránky i Server Actions ověřují cookie znovu (proxy je jen první brána).

export async function isSuperadmin(): Promise<boolean> {
  return isSuperadminToken((await cookies()).get(SUPERADMIN_COOKIE)?.value);
}

export async function requireSuperadmin() {
  if (!(await isSuperadmin())) throw new WorkflowError("FORBIDDEN", "Přihlaste se do velínu /superadmin.");
}
